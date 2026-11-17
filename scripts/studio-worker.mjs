#!/usr/bin/env node
/* Processes hosted edit jobs on the Mac. The live watcher is separate. */
import { PrismaClient } from "@prisma/client";
import { put } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scoutVideo } from "./scout-video.mjs";

const run = promisify(execFile);
const db = new PrismaClient();
const once = process.argv.includes("--once");
const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
const ffprobe = process.env.FFPROBE_PATH || "ffprobe";
if (!process.env.DATABASE_URL || !process.env.DIRECT_URL || !process.env.BLOB_READ_WRITE_TOKEN) {
  console.error("Studio worker needs DATABASE_URL, DIRECT_URL, and BLOB_READ_WRITE_TOKEN.");
  process.exit(2);
}

function cleanError(error) { return String(error?.message || error).slice(0, 300).replace(/https:\/\/[^\s]+/g, "[media URL]"); }
async function exec(bin, args, timeout = 600_000) {
  await run(bin, args, { timeout, maxBuffer: 4 * 1024 * 1024 });
}
async function log(renderJobId, level, message) {
  await db.processingLog.create({ data: { renderJobId, level, message: message.slice(0, 500) } });
}
async function probe(url) {
  const { stdout } = await run(ffprobe, ["-v", "error", "-show_entries", "format=duration:stream=codec_type,codec_name,width,height",
    "-of", "json", url], { timeout: 90_000, maxBuffer: 1024 * 1024 });
  const parsed = JSON.parse(stdout);
  const video = parsed.streams?.find(s => s.codec_type === "video");
  const duration = Number(parsed.format?.duration);
  if (!video || !Number.isFinite(duration) || duration <= 0) throw new Error("Source has no valid video duration.");
  return { duration, codec: video.codec_name, width: video.width, height: video.height };
}
function srtTime(sec) {
  const ms = Math.max(0, Math.round(sec * 1000));
  return `${String(Math.floor(ms / 3600000)).padStart(2, "0")}:${String(Math.floor(ms / 60000) % 60).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
}
async function transcribe(wide, dir, jobId) {
  const audio = join(dir, "speech.wav");
  await exec(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-i", wide, "-vn", "-ar", "16000", "-ac", "1", audio]);
  const target = join(dir, "speech");
  try {
    await exec("whisper", [audio, "--model", "tiny.en", "--language", "en", "--fp16", "False",
      "--output_format", "json", "--output_dir", dir, "--verbose", "False", "--condition_on_previous_text", "False"], 360_000);
    const data = JSON.parse(await readFile(`${target}.json`, "utf8"));
    const segments = (data.segments || []).filter(s => typeof s.text === "string" && s.text.trim() &&
      Number(s.avg_logprob) > -0.85 && Number(s.no_speech_prob) < 0.6 && s.end > s.start);
    if (!segments.length) { await log(jobId, "warn", "No reliable speech captions detected; render will have no captions."); return null; }
    const srt = segments.map((s, i) => `${i + 1}\n${srtTime(s.start)} --> ${srtTime(s.end)}\n${s.text.trim().replace(/<[^>]+>/g, "")}\n`).join("\n");
    const srtPath = join(dir, "captions.srt");
    await writeFile(srtPath, srt);
    return { srtPath, text: segments.map(s => s.text.trim()).join(" ").slice(0, 8000), segments };
  } catch (error) { await log(jobId, "warn", `Caption transcription unavailable: ${cleanError(error)}`); return null; }
}
function captionCues(segments) {
  const cues = [];
  for (const segment of segments) {
    const words = segment.text.trim().split(/\s+/);
    const parts = Math.ceil(words.length / 7);
    for (let i = 0; i < parts; i++) {
      const part = words.slice(i * 7, (i + 1) * 7);
      const half = Math.ceil(part.length / 2);
      cues.push({ start: segment.start + (segment.end - segment.start) * i / parts,
        end: segment.start + (segment.end - segment.start) * (i + 1) / parts,
        text: part.length > 4 ? `${part.slice(0, half).join(" ")}\n${part.slice(half).join(" ")}` : part.join(" ") });
    }
  }
  cues.sort((a, b) => a.start - b.start || a.end - b.end);
  return cues.map((cue, i) => ({ ...cue, end: Math.min(cue.end, (cues[i + 1]?.start ?? Infinity) - 0.04) }))
    .filter(cue => cue.end - cue.start >= 0.15);
}
async function makeCaptionImages(segments, dir) {
  const cues = captionCues(segments);
  for (const [i, cue] of cues.entries()) {
    cue.path = join(dir, `caption-${i}.png`);
    await exec("/opt/homebrew/bin/magick", ["-size", "1080x240", "xc:none", "-font", "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
      "-pointsize", "54", "-gravity", "center", "-fill", "white", "-stroke", "black", "-strokewidth", "4",
      "-annotate", "+0+0", cue.text, "-depth", "8", "-define", "png:color-type=6", cue.path], 30_000);
  }
  return cues;
}
async function captionTrack(cues, dir, duration) {
  const empty = join(dir, "caption-empty.png");
  await exec("/opt/homebrew/bin/magick", ["-size", "1080x240", "xc:none", "-depth", "8", "-define", "png:color-type=6", empty], 30_000);
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
  await writeFile(path, `${lines.join("\n")}\n`);
  return path;
}
async function suggestTitle(text) {
  if (!text || text.split(/\s+/).length < 6) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);
    const res = await fetch("http://127.0.0.1:11434/api/generate", { method: "POST", signal: controller.signal,
      headers: { "content-type": "application/json" }, body: JSON.stringify({ model: "gemma3:1b-it-qat", stream: false,
        prompt: `Write one short social-video title, 60 characters maximum. Use only facts explicitly stated in this transcript. No invented names, stakes, or claims. Return only the title. Transcript: ${text.slice(0, 2000)}` }) });
    clearTimeout(timer);
    if (!res.ok) return null;
    const candidate = String((await res.json()).response || "").split("\n")[0].replace(/^['"* ]+|['"* ]+$/g, "").slice(0, 60);
    return candidate.length >= 6 ? candidate : null;
  } catch { return null; }
}
async function processJob(job) {
  const clip = job.clipProject;
  const asset = clip.asset;
  const claimed = await db.renderJob.updateMany({ where: { id: job.id, status: "queued" }, data: { status: "running" } });
  if (!claimed.count) return;
  let dir;
  try {
    if (!asset?.blobUrl || asset.mediaType !== "video") throw new Error("Source upload is missing.");
    dir = await mkdtemp(join(tmpdir(), "hge-studio-"));
    await log(job.id, "info", "Processing started on Mac worker.");
    const source = await probe(asset.blobUrl);
    if (clip.endSec > source.duration + 0.2 || clip.startSec < 0 || clip.endSec - clip.startSec > 60)
      throw new Error("Selected range is outside the source or exceeds 60 seconds.");
    await db.mediaAsset.update({ where: { id: asset.id }, data: { status: "validated", durationSec: source.duration,
      codec: source.codec, width: source.width, height: source.height } });
    const wide = join(dir, "wide.mp4");
    const vertical = join(dir, "vertical.mp4");
    await exec(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-ss", String(clip.startSec), "-i", asset.blobUrl,
      "-t", String(clip.endSec - clip.startSec), "-c:v", "libx264", "-preset", "veryfast", "-c:a", "aac", "-movflags", "+faststart", wide]);
    const captions = job.captionsEnabled ? await transcribe(wide, dir, job.id) : null;
    const baseFilter = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920";
    let cues = [];
    if (captions) {
      try { cues = await makeCaptionImages(captions.segments, dir); }
      catch (error) { await log(job.id, "warn", `Caption images failed: ${cleanError(error)}`); cues = []; }
    }
    const args = ["-hide_banner", "-loglevel", "error", "-y", "-i", wide];
    if (cues.length) args.push("-f", "concat", "-safe", "0", "-i", await captionTrack(cues, dir, clip.endSec - clip.startSec));
    if (job.musicUrl) args.push("-stream_loop", "-1", "-i", job.musicUrl);
    const filters = [`[0:v]${baseFilter}[v0]`];
    if (cues.length) filters.push("[v0][1:v]overlay=(W-w)/2:H-h-100:shortest=1[v1]");
    if (job.musicUrl) filters.push(`[0:a]volume=1[a];[${cues.length ? 2 : 1}:a]volume=0.12[bg];[a][bg]amix=inputs=2:duration=first:dropout_transition=2[out]`);
    args.push("-filter_complex", filters.join(";"), "-map", cues.length ? "[v1]" : "[v0]", "-map", job.musicUrl ? "[out]" : "0:a?",
      "-t", String(clip.endSec - clip.startSec), "-c:v", "libx264", "-preset", "veryfast", "-c:a", "aac", "-movflags", "+faststart", vertical);
    let captionsApplied = cues.length > 0;
    let musicApplied = Boolean(job.musicUrl);
    try { await exec(ffmpeg, args); }
    catch (error) {
      if (!cues.length && !job.musicUrl) throw error;
      await log(job.id, "warn", `Optional caption/music mix failed; plain vertical render used: ${cleanError(error)}`);
      await exec(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-i", wide, "-vf", baseFilter,
        "-c:v", "libx264", "-preset", "veryfast", "-c:a", "aac", vertical]);
      captionsApplied = false;
      musicApplied = false;
    }
    const check = await probe(vertical);
    if (check.width !== 1080 || check.height !== 1920 || Math.abs(check.duration - (clip.endSec - clip.startSec)) > 1.5)
      throw new Error("Finished render failed dimensions or duration QA.");
    const wideBlob = await put(`studio/${clip.userId}/${clip.id}/wide.mp4`, createReadStream(wide),
      { access: "public", contentType: "video/mp4", addRandomSuffix: false });
    const renderBlob = await put(`studio/${clip.userId}/${clip.id}/vertical.mp4`, createReadStream(vertical),
      { access: "public", contentType: "video/mp4", addRandomSuffix: false });
    const title = clip.title || await suggestTitle(captions?.text);
    await db.$transaction(async tx => {
      await tx.clipProject.update({ where: { id: clip.id }, data: { clipUrl: wideBlob.url,
        title: title || null, status: "cut" } });
      await tx.renderJob.update({ where: { id: job.id }, data: { renderUrl: renderBlob.url, status: "done", captionsApplied, musicApplied } });
      if (captions) await tx.transcript.create({ data: { clipProjectId: clip.id, source: "whisper-local",
        text: captions.text, segmentsJson: JSON.stringify(captions.segments) } });
    });
    await log(job.id, "info", `QA PASS: vertical 1080x1920, ${check.duration.toFixed(1)} seconds.`);
    console.log(`DONE ${clip.id} ${job.id} ${check.duration.toFixed(1)}s captions=${captionsApplied} music=${musicApplied}`);
  } catch (error) {
    const message = cleanError(error);
    await db.renderJob.update({ where: { id: job.id }, data: { status: "failed" } });
    await log(job.id, "error", message);
    console.error(`FAILED ${clip.id} ${job.id}: ${message}`);
  } finally { if (dir) await rm(dir, { recursive: true, force: true }); }
}
async function processScoutJob(job) {
  const claimed = await db.scoutJob.updateMany({ where: { id: job.id, status: "queued" }, data: { status: "running" } });
  if (!claimed.count) return;
  try {
    if (!job.asset?.blobUrl || job.asset.mediaType !== "video") throw new Error("Source upload is missing.");
    const report = await scoutVideo(job.asset.blobUrl, { marks: job.markSec == null ? [] : [job.markSec], limit: 5 });
    report.source = job.asset.id;
    report.sourceLabel = job.asset.filename || "Uploaded video";
    await db.scoutJob.update({ where: { id: job.id }, data: { status: "done", reportJson: JSON.stringify(report), error: null } });
    console.log(`SCOUT DONE ${job.id} ${report.overallStatus} candidates=${report.candidates.length}`);
  } catch (error) {
    const message = cleanError(error);
    await db.scoutJob.update({ where: { id: job.id }, data: { status: "failed", error: message } });
    console.error(`SCOUT FAILED ${job.id}: ${message}`);
  }
}
async function tick() {
  const job = await db.renderJob.findFirst({ where: { status: "queued", clipProject: { status: "pending", asset: { status: { in: ["uploaded", "validated"] } } } },
    include: { clipProject: { include: { asset: true } } }, orderBy: { createdAt: "asc" } });
  if (job) { await processJob(job); return true; }
  const scout = await db.scoutJob.findFirst({ where: { status: "queued", asset: { status: { in: ["uploaded", "validated"] } } },
    include: { asset: true }, orderBy: { createdAt: "asc" } });
  if (scout) await processScoutJob(scout);
  return Boolean(scout);
}
try {
  do { await tick(); if (!once) await new Promise(resolve => setTimeout(resolve, 15_000)); } while (!once);
} catch (error) { console.error(`Worker stopped: ${cleanError(error)}`); process.exitCode = 1; }
finally { await db.$disconnect(); }
