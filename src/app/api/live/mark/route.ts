export const runtime = "nodejs";

import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { requireUser } from "@/lib/auth";
import { dataPath } from "@/lib/data-root";
import { probeFile } from "@/lib/ffmpeg";

const exec = promisify(execFile);
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const PRE_MS = 12_000;
const POST_MS = 28_000;

function timeMs(raw: string, channel: string, mode: string): number | null {
  if (mode === "elapsed") {
    const match = /^(\d{1,3}):(\d{2}):(\d{2})$/.exec(raw);
    if (!match || Number(match[2]) > 59 || Number(match[3]) > 59) return null;
    try {
      const monitor = JSON.parse(readFileSync(dataPath("watch", "monitor.json"), "utf8"));
      const started = monitor.channels?.[channel]?.streamStartedAt;
      const base = Date.parse(String(started).replace(" ", "T") + "Z");
      return Number.isFinite(base)
        ? base + (Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])) * 1000 : null;
    } catch { return null; }
  }
  if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) {
    const [h, m, s] = raw.split(":").map(Number);
    if (h > 23 || m > 59 || s > 59) return null;
    const date = new Date();
    date.setHours(h, m, s, 0);
    if (date.getTime() - Date.now() > 12 * 60 * 60_000) date.setDate(date.getDate() - 1);
    return date.getTime();
  }
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}
function writeRow(name: string, id: string, row: unknown) {
  const path = dataPath(name);
  const rows = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
  rows[id] = row;
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(rows, null, 2));
  renameSync(tmp, path);
}
async function segments(channel: string) {
  const dir = dataPath("watch", channel, "buf");
  if (!existsSync(dir)) return [];
  const names = readdirSync(dir).filter((name) => /^seg_\d+\.ts$/.test(name)).sort();
  const found = [];
  for (const name of names) {
    const path = join(dir, name);
    try {
      const stat = statSync(path);
      if (Date.now() - stat.mtimeMs < 1_500) continue;
      const probe = await probeFile(path);
      if (!probe.valid || !probe.durationSec) continue;
      found.push({ path, start: stat.mtimeMs - probe.durationSec * 1000, end: stat.mtimeMs });
    } catch { /* watcher may prune a file during the scan */ }
  }
  return found.sort((a, b) => a.start - b.start);
}

/** Manually mark a live moment. The 240s ring limits how far back it can reach. */
export async function POST(req: Request): Promise<Response> {
  const user = await requireUser();
  if (user instanceof Response) return user;
  if (process.env.VERCEL) return Response.json({ error: "Live cutting runs on the owner's Mac" }, { status: 501 });
  let input: { channel?: string; at?: string; mode?: string };
  try { input = await req.json(); } catch { return Response.json({ error: "Expected channel and at" }, { status: 400 }); }
  if (!input || typeof input !== "object") return Response.json({ error: "Expected channel and at" }, { status: 400 });
  const channel = (input.channel || "").trim().toLowerCase();
  const mode = input.mode || "local";
  const at = timeMs((input.at || "").trim(), channel, mode);
  if (!/^[a-z0-9_]{2,32}$/.test(channel) || at === null) {
    return Response.json({ error: "Use a Kick channel and H:MM:SS stream time, HH:MM:SS local time, or an ISO timestamp" }, { status: 400 });
  }
  if (at > Date.now() + 5_000) return Response.json({ error: "Timestamp is in the future" }, { status: 400 });
  const wantedStart = at - PRE_MS, wantedEnd = at + POST_MS;
  let available = await segments(channel);
  if (!available.length || wantedStart < available[0].start) {
    return Response.json({ error: "That moment has expired from the live buffer" }, { status: 410 });
  }
  for (let i = 0; i < 22 && available.at(-1)!.end < wantedEnd; i++) {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    available = await segments(channel);
  }
  if (available.at(-1)!.end < wantedEnd) {
    return Response.json({ error: "The stream has not buffered 28 seconds after that moment; retry shortly" }, { status: 409 });
  }
  const chosen = available.filter((s) => s.end > wantedStart && s.start < wantedEnd);
  if (chosen.length < 2) return Response.json({ error: "Not enough stream segments for that moment" }, { status: 409 });

  const work = join(tmpdir(), `clip-mark-${randomUUID()}`);
  mkdirSync(work, { recursive: true });
  const clipId = `clip_${randomUUID()}`, renderId = `render_${randomUUID()}`;
  const clipDir = dataPath("cuts", user.userId), renderDir = dataPath("renders", user.userId);
  mkdirSync(clipDir, { recursive: true });
  mkdirSync(renderDir, { recursive: true });
  const clipPath = join(clipDir, `${clipId}.mp4`);
  const renderPath = join(renderDir, `${renderId}.mp4`);
  try {
    const copied = chosen.map((s, i) => {
      const path = join(work, `${i}.ts`);
      copyFileSync(s.path, path);
      return path;
    });
    const list = join(work, "list.txt");
    writeFileSync(list, copied.map((p) => `file '${p}'`).join("\n"));
    const offset = Math.max(0, (wantedStart - chosen[0].start) / 1000);
    await exec(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", list,
      "-ss", offset.toFixed(3), "-t", "40", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
      "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-b:a", "128k", clipPath], { timeout: 300_000 });
    const wide = await probeFile(clipPath);
    if (!wide.valid || !wide.durationSec || wide.durationSec < 39.5) throw new Error("source cut was incomplete; try a nearby timestamp");
    await exec(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-i", clipPath, "-filter_complex",
      "[0:v]split=2[bg][fg];[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:2[bgb];[fg]scale=1080:-2[fgs];[bgb][fgs]overlay=(W-w)/2:(H-h)/2",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "24", "-pix_fmt", "yuv420p", "-r", "30",
      "-c:a", "aac", "-b:a", "128k", renderPath], { timeout: 300_000 });
    const vertical = await probeFile(renderPath);
    if (!vertical.valid || vertical.width !== 1080 || vertical.height !== 1920 || !vertical.durationSec) {
      throw new Error("vertical render did not pass probe");
    }
    const now = new Date().toISOString();
    const provenance = { source: "kick-live", channel, trigger: "manual-timestamp",
      evidence: `Owner marked ${new Date(at).toISOString()}`,
      spikeAt: new Date(at).toISOString(), capturedWindowStart: new Date(wantedStart).toISOString(),
      capturedWindowEnd: new Date(wantedEnd).toISOString(), segments: [] };
    writeRow("clips.json", clipId, { clipId, assetId: `live_${channel}`, userId: user.userId,
      startSec: 0, endSec: wide.durationSec, localPath: clipPath, clipBlobUrl: null,
      stored: true, status: "cut", segmentsJson: JSON.stringify([provenance]), createdAt: now, updatedAt: now });
    writeRow("renders.json", renderId, { renderId, clipId, userId: user.userId,
      preset: "vertical-1080x1920", localPath: renderPath, renderBlobUrl: null,
      stored: true, status: "done", qa: { source_id: clipId, clip_asset_id: null, status: "PASS",
        checks: [
          { name: "artifact_exists", status: "PASS", detail: "ffmpeg and ffprobe succeeded" },
          { name: "dimensions_1080x1920", status: "PASS", detail: "got 1080x1920" },
          { name: "duration_positive", status: "PASS", detail: `duration=${vertical.durationSec.toFixed(3)}s` },
          { name: "caption_safe_zones", status: "NOT_TESTED", detail: "no captions burned in" },
        ], tested_at: now }, createdAt: now, updatedAt: now });
    return Response.json({ clipId, renderId, durationSec: vertical.durationSec, status: "cut" }, { status: 201 });
  } catch (error) {
    rmSync(clipPath, { force: true });
    rmSync(renderPath, { force: true });
    return Response.json({ error: (error as Error).message || "Manual cut failed" }, { status: 500 });
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
