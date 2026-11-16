import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface ProbeResult {
  valid: boolean;
  durationSec?: number;
  codec?: string;
  width?: number;
  height?: number;
  reason?: string;
}

function ffprobeBin(): string {
  return process.env.FFPROBE_PATH || "ffprobe";
}

/** Probe a local media file with ffprobe. /tmp (or repo fixture) only on serverless. */
export async function probeFile(filePath: string, timeoutMs = 30_000): Promise<ProbeResult> {
  let raw: string;
  try {
    const { stdout } = await execFileAsync(
      ffprobeBin(),
      [
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        filePath,
      ],
      { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 },
    );
    raw = stdout;
  } catch (err) {
    // Generic message to callers: exec errors can echo the command line (paths).
    console.error(`probeFile failed for ${filePath}: ${(err as Error).message}`);
    return { valid: false, reason: "ffprobe failed to read the file" };
  }

  try {
    const data = JSON.parse(raw) as {
      format?: { duration?: string };
      streams?: Array<{
        codec_type?: string;
        codec_name?: string;
        width?: number;
        height?: number;
      }>;
    };
    const video = data.streams?.find((s) => s.codec_type === "video");
    if (!video) return { valid: false, reason: "no video stream found" };
    const durationSec = data.format?.duration ? Number(data.format.duration) : undefined;
    return {
      valid: true,
      durationSec: Number.isFinite(durationSec) ? durationSec : undefined,
      codec: video.codec_name,
      width: video.width,
      height: video.height,
    };
  } catch (err) {
    return { valid: false, reason: `unparseable ffprobe output: ${(err as Error).message}` };
  }
}

function ffmpegBin(): string {
  return process.env.FFMPEG_PATH || "ffmpeg";
}

export interface RenderResult {
  ok: boolean;
  reason?: string;
}

/** Trim a segment with re-encode (frame-accurate). Args array — never a shell string. */
export async function trimFile(
  input: string,
  startSec: number,
  durSec: number,
  output: string,
  timeoutMs = 120_000,
): Promise<RenderResult> {
  try {
    await execFileAsync(
      ffmpegBin(),
      ["-hide_banner", "-loglevel", "error", "-y", "-ss", String(startSec), "-i", input, "-t", String(durSec), "-c:v", "libx264", "-preset", "veryfast", "-c:a", "aac", output],
      { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 },
    );
    return { ok: true };
  } catch (err) {
    console.error(`trimFile failed: ${(err as Error).message}`);
    return { ok: false, reason: "trim render failed" };
  }
}

/** Center-crop to 9:16 and scale to 1080x1920 with AAC audio. */
export async function renderVertical(input: string, output: string, timeoutMs = 300_000): Promise<RenderResult> {
  try {
    await execFileAsync(
      ffmpegBin(),
      ["-hide_banner", "-loglevel", "error", "-y", "-i", input, "-vf", "crop=ih*9/16:ih,scale=1080:1920", "-c:v", "libx264", "-preset", "veryfast", "-c:a", "aac", output],
      { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 },
    );
    return { ok: true };
  } catch (err) {
    console.error(`renderVertical failed: ${(err as Error).message}`);
    return { ok: false, reason: "vertical render failed" };
  }
}
