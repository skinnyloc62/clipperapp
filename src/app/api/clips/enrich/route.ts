export const runtime = "nodejs";

import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync, rmSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative } from "node:path";
import { requireUser } from "@/lib/auth";
import { devClips, devRenders, type QaRecord } from "@/lib/clips";
import { dataPath } from "@/lib/data-root";
import { probeFile } from "@/lib/ffmpeg";
import { makeTitleCard } from "../../../../../scripts/lib/title-card.mjs";

const run = promisify(execFile);
async function command(bin: string, args: string[], timeout = 360_000): Promise<void> {
  await run(bin, args, { timeout, maxBuffer: 4 * 1024 * 1024 });
}
type SpeechSegment = { text: string; start: number; end: number; avg_logprob: number; no_speech_prob: number };
async function transcript(input: string, dir: string): Promise<{ text: string; segments: SpeechSegment[] } | null> {
  const audio = join(dir, "speech.wav");
  await command(process.env.FFMPEG_PATH || "ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", input,
    "-vn", "-ar", "16000", "-ac", "1", audio]);
  await command(process.env.WHISPER_PATH || "/opt/homebrew/bin/whisper", [audio, "--model", "tiny.en", "--language", "en", "--fp16", "False", "--output_format", "json",
    "--output_dir", dir, "--verbose", "False", "--condition_on_previous_text", "False"]);
  const json = JSON.parse(readFileSync(join(dir, "speech.json"), "utf8")) as { segments?: SpeechSegment[] };
  const segments = (json.segments || []).filter(s => s.text?.trim() && s.end > s.start && s.avg_logprob > -0.85 && s.no_speech_prob < 0.6);
  if (!segments.length) return null;
  return { text: segments.map(s => s.text.trim()).join(" ").slice(0, 8000), segments };
}
async function captionImages(segments: SpeechSegment[], dir: string): Promise<Array<{ path: string; start: number; end: number }>> {
  const cues: Array<{ path: string; start: number; end: number }> = [];
  for (const segment of segments) {
    const words = segment.text.trim().split(/\s+/);
    const count = Math.ceil(words.length / 7);
    for (let i = 0; i < count; i++) {
      const part = words.slice(i * 7, (i + 1) * 7);
      const half = Math.ceil(part.length / 2);
      const caption = part.length > 4 ? `${part.slice(0, half).join(" ")}\n${part.slice(half).join(" ")}` : part.join(" ");
      const path = join(dir, `caption-${cues.length}.png`);
      await command("/opt/homebrew/bin/magick", ["-size", "1080x240", "xc:none", "-font", "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "-pointsize", "54", "-gravity", "center", "-fill", "white", "-stroke", "black", "-strokewidth", "4", "-annotate", "+0+0", caption,
        "-depth", "8", "-define", "png:color-type=6", path], 30_000);
      cues.push({ path, start: segment.start + (segment.end - segment.start) * i / count,
        end: segment.start + (segment.end - segment.start) * (i + 1) / count });
    }
  }
  cues.sort((a, b) => a.start - b.start || a.end - b.end);
  return cues.map((cue, i) => ({ ...cue, end: Math.min(cue.end, (cues[i + 1]?.start ?? Infinity) - 0.04) }))
    .filter(cue => cue.end - cue.start >= 0.15);
}
async function captionTrack(cues: Array<{ path: string; start: number; end: number }>, dir: string, duration: number): Promise<string> {
  const empty = join(dir, "caption-empty.png");
  await command("/opt/homebrew/bin/magick", ["-size", "1080x240", "xc:none", "-depth", "8", "-define", "png:color-type=6", empty], 30_000);
  const lines = ["ffconcat version 1.0"];
  let cursor = 0;
  for (const cue of cues) {
    const start = Math.max(cursor, Math.min(duration, cue.start));
    const end = Math.min(duration, cue.end);
    if (end - start < 0.1) continue;
    if (start > cursor) lines.push(`file '${empty}'`, `duration ${(start - cursor).toFixed(3)}`);
    lines.push(`file '${cue.path}'`, `duration ${(end - start).toFixed(3)}`);
    cursor = end;
  }
  if (cursor < duration) lines.push(`file '${empty}'`, `duration ${(duration - cursor).toFixed(3)}`);
  lines.push(`file '${empty}'`);
  const path = join(dir, "caption-track.ffconcat");
  writeFileSync(path, `${lines.join("\n")}\n`);
  return path;
}
async function titleFrom(text: string): Promise<string | null> {
  if (text.split(/\s+/).length < 6) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);
    const res = await fetch("http://127.0.0.1:11434/api/generate", { method: "POST", signal: controller.signal,
      headers: { "content-type": "application/json" }, body: JSON.stringify({ model: "gemma3:1b-it-qat", stream: false,
        prompt: `One factual social-video title, 60 characters max. Use only statements in this transcript. No invented names or claims. Return only the title. Transcript: ${text.slice(0, 2000)}` }) });
    clearTimeout(timer);
    if (!res.ok) return null;
    const value = String(((await res.json()) as { response?: string }).response || "").split("\n")[0].replace(/^['"* ]+|['"* ]+$/g, "").slice(0, 60);
    return value.length >= 6 ? value : null;
  } catch { return null; }
}

/** Electron-only finishing pass. Approval occurs only after the real render passes QA. */
export async function POST(req: Request): Promise<Response> {
  if (process.env.VERCEL) return Response.json({ error: "Mac finishing only" }, { status: 501 });
  const user = await requireUser();
  if (user instanceof Response) return user;
  let form: FormData;
  try { form = await req.formData(); }
  catch { return Response.json({ error: "expected form data" }, { status: 400 }); }
  const clipId = form.get("clipId");
  const typedTitle = form.get("title");
  const captionsWanted = form.get("captions") !== "false";
  const music = form.get("music");
  if (typeof clipId !== "string" || !/^clip_[a-zA-Z0-9-]{1,150}$/.test(clipId))
    return Response.json({ error: "invalid clip" }, { status: 400 });
  if (typedTitle !== null && (typeof typedTitle !== "string" || !typedTitle.trim() || typedTitle.trim().length > 100))
    return Response.json({ error: "Title must be 1–100 characters." }, { status: 400 });
  if (music && (!(music instanceof File) || !music.type.startsWith("audio/") || music.size > 25 * 1024 * 1024))
    return Response.json({ error: "Music must be an audio file under 25 MB." }, { status: 413 });
  const clip = devClips.get(clipId, user.userId);
  const original = devRenders.list(user.userId).find(r => r.clipId === clipId && r.status === "done" && r.localPath);
  if (!clip || !original?.localPath) return Response.json({ error: "A finished clip is needed before approval." }, { status: 409 });
  if (clip.status === "approved") return Response.json({ clipId, status: "approved" });
  let input: string;
  try {
    const root = realpathSync(dataPath()); input = realpathSync(original.localPath);
    const rel = relative(root, input);
    if (!rel || rel.startsWith("..") || isAbsolute(rel)) throw new Error("path outside media folder");
  } catch { return Response.json({ error: "Original render is missing." }, { status: 410 }); }
  const temp = mkdtempSync(join(tmpdir(), "hge-finish-"));
  const renderId = `render_${randomUUID()}`;
  const output = dataPath("renders", user.userId, `${renderId}.mp4`);
  try {
    const before = await probeFile(input);
    if (!before.valid || !before.durationSec) throw new Error("Original render has no valid duration.");
    let words: { text: string; segments: SpeechSegment[] } | null = null;
    let captionWarning: string | null = null;
    if (captionsWanted) {
      try { words = await transcript(input, temp); }
      catch { captionWarning = "Automatic speech captions could not be made; review this clip manually."; }
      if (!words && !captionWarning) captionWarning = "No reliable speech was detected, so no captions were added.";
    }
    let musicPath: string | null = null;
    if (music instanceof File) {
      musicPath = join(temp, "music.bin");
      writeFileSync(musicPath, Buffer.from(await music.arrayBuffer()));
    }
    mkdirSync(dataPath("renders", user.userId), { recursive: true });
    let cues: Array<{ path: string; start: number; end: number }> = [];
    if (words) {
      try { cues = await captionImages(words.segments, temp); }
      catch { captionWarning = "Caption graphics could not be made; review this clip manually."; }
    }
    const suggestion = typedTitle || clip.title ? null : await titleFrom(words?.text || "");
    const title = (typeof typedTitle === "string" ? typedTitle.trim() : "") || clip.title || suggestion || null;
    const titleCard = title ? await makeTitleCard(title, temp) : null;
    const args = ["-hide_banner", "-loglevel", "error", "-y", "-i", input];
    if (cues.length) args.push("-f", "concat", "-safe", "0", "-i", await captionTrack(cues, temp, before.durationSec));
    if (titleCard) args.push("-loop", "1", "-i", titleCard);
    if (musicPath) args.push("-stream_loop", "-1", "-i", musicPath);
    const filters = ["[0:v]null[v0]"];
    if (cues.length) filters.push("[v0][1:v]overlay=(W-w)/2:H-h-100:shortest=1[v1]");
    if (titleCard) filters.push(`[${cues.length ? "v1" : "v0"}][${cues.length ? 2 : 1}:v]overlay=(W-w)/2:105:enable='between(t,0,3.5)'[vtitle]`);
    if (musicPath) filters.push(`[0:a]volume=1[a];[${1 + Number(Boolean(cues.length)) + Number(Boolean(titleCard))}:a]volume=0.12[bg];[a][bg]amix=inputs=2:duration=first:dropout_transition=2[out]`);
    args.push("-filter_complex", filters.join(";"), "-map", titleCard ? "[vtitle]" : cues.length ? "[v1]" : "[v0]", "-map", musicPath ? "[out]" : "0:a?",
      "-t", String(before.durationSec), "-c:v", "libx264", "-preset", "veryfast", "-c:a", "aac", "-movflags", "+faststart", output);
    await command(process.env.FFMPEG_PATH || "ffmpeg", args);
    const after = await probeFile(output);
    if (!after.valid || after.width !== 1080 || after.height !== 1920 || !after.durationSec ||
        Math.abs(after.durationSec - (before.durationSec || 0)) > 1.5) throw new Error("Finished render failed QA.");
    const now = new Date().toISOString();
    const qa: QaRecord = { source_id: clipId, clip_asset_id: null, status: "PASS", tested_at: now,
      checks: [
        { name: "dimensions_1080x1920", status: "PASS", detail: "ffprobe verified output dimensions" },
        { name: "duration_matches_source", status: "PASS", detail: "ffprobe verified output duration" },
        { name: "caption_accuracy", status: "NOT_TESTED", detail: cues.length ? "Caption graphics applied; Whisper words need human review" : "No captions applied" },
        { name: "opening_title", status: titleCard ? "PASS" : "NOT_TESTED", detail: titleCard ? "Owner title graphic included in first 3.5 seconds" : "No title supplied" },
      ] };
    devRenders.save({ renderId, clipId, userId: user.userId, preset: "vertical-1080x1920", localPath: output,
      renderBlobUrl: null, stored: true, status: "done", qa, createdAt: now, updatedAt: now }, renderId);
    devClips.update(clipId, user.userId, { status: "approved", title,
      captionText: words?.text || null, captionsApplied: cues.length > 0, musicApplied: Boolean(musicPath) });
    return Response.json({ clipId, renderId, status: "approved", title,
      titleApplied: Boolean(titleCard), captionsApplied: cues.length > 0, musicApplied: Boolean(musicPath), warning: captionWarning });
  } catch (error) {
    if (existsSync(output)) rmSync(output, { force: true });
    const detail = error as Error & { code?: string | number; signal?: string; killed?: boolean; stderr?: string };
    console.error("local finishing failed:", { code: detail.code, signal: detail.signal, killed: detail.killed,
      stderr: detail.stderr?.slice(0, 500) });
    return Response.json({ error: "Finishing failed; clip remains unapproved." }, { status: 500 });
  } finally { rmSync(temp, { recursive: true, force: true }); }
}
