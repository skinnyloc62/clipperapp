#!/usr/bin/env node
/** Local video scout. It reports source-time evidence and abstains when the
 * available ASR/video does not support a grounded editorial judgment. */
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";
import { assessTranscript, editorialScore, exactQuote, selectWindows } from "./lib/scout-core.mjs";

const run = promisify(execFile);
const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
const ffprobe = process.env.FFPROBE_PATH || "ffprobe";
const whisper = process.env.WHISPER_PATH || "whisper";
const visionModel = process.env.SCOUT_VISION_MODEL || "llava:latest";

async function exec(bin, args, timeout = 180_000) {
  return run(bin, args, { timeout, maxBuffer: 4 * 1024 * 1024 });
}

async function probe(input) {
  const { stdout } = await exec(ffprobe, ["-v", "error", "-show_entries",
    "format=duration:stream=codec_type,width,height", "-of", "json", input], 90_000);
  const parsed = JSON.parse(stdout);
  const video = parsed.streams?.find(s => s.codec_type === "video");
  const durationSec = Number(parsed.format?.duration);
  if (!video || !Number.isFinite(durationSec) || durationSec <= 0)
    throw new Error("Input must contain a video with a known duration.");
  return { durationSec, width: video.width, height: video.height,
    hasAudio: parsed.streams.some(s => s.codec_type === "audio") };
}

async function audioLevels(input) {
  const child = spawn(ffmpeg, ["-hide_banner", "-loglevel", "error", "-i", input,
    "-vn", "-ar", "4000", "-ac", "1", "-f", "s16le", "pipe:1"],
  { stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  child.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(-1000); });
  let carry = Buffer.alloc(0);
  let sumSquares = 0, samples = 0, sec = 0;
  const levels = [];
  for await (const chunk of child.stdout) {
    const bytes = carry.length ? Buffer.concat([carry, chunk]) : chunk;
    const complete = bytes.length - bytes.length % 2;
    for (let i = 0; i < complete; i += 2) {
      const value = bytes.readInt16LE(i) / 32768;
      sumSquares += value * value;
      samples++;
      if (samples === 4000) {
        const rms = Math.sqrt(sumSquares / samples);
        levels.push({ sec, db: rms > 0 ? 20 * Math.log10(rms) : -100 });
        sec++; samples = 0; sumSquares = 0;
      }
    }
    carry = complete < bytes.length ? bytes.subarray(complete) : Buffer.alloc(0);
  }
  if (samples) levels.push({ sec, db: 20 * Math.log10(Math.max(1e-5, Math.sqrt(sumSquares / samples))) });
  const exitCode = await new Promise(resolve => child.once("close", resolve));
  if (exitCode !== 0) throw new Error(`Audio scan failed: ${stderr.trim().slice(0, 200)}`);
  return levels;
}

async function transcribeWindow(input, window, dir) {
  const audio = join(dir, "speech.wav");
  await exec(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-ss", String(window.startSec),
    "-i", input, "-t", String(window.endSec - window.startSec), "-vn", "-ar", "16000", "-ac", "1", audio]);
  await exec(whisper, [audio, "--model", "tiny.en", "--language", "en", "--fp16", "False",
    "--output_format", "json", "--output_dir", dir, "--verbose", "False",
    "--condition_on_previous_text", "False"], 360_000);
  const data = JSON.parse(await readFile(join(dir, "speech.json"), "utf8"));
  return assessTranscript(data.segments);
}

async function frameDescription(input, window, dir) {
  const atSec = Math.round((window.startSec + (window.endSec - window.startSec) / 2) * 10) / 10;
  const frame = join(dir, "frame.jpg");
  await exec(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-ss", String(atSec),
    "-i", input, "-frames:v", "1", "-vf", "scale=640:-1", frame], 60_000);
  const image = (await readFile(frame)).toString("base64");
  const res = await fetch("http://127.0.0.1:11434/api/generate", { method: "POST",
    signal: AbortSignal.timeout(60_000), headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: visionModel, stream: false, images: [image],
      prompt: "Describe only directly visible objects and actions in this one frame, in one short sentence. Do not name anyone, infer dialogue, intent, or unseen events. If unclear, say unclear." }) });
  if (!res.ok) throw new Error(`Local vision model returned ${res.status}.`);
  const response = await res.json();
  return { atSec, text: String(response.response || "").trim().slice(0, 300), model: visionModel };
}

async function evaluateEvidence(transcript, frame) {
  const opening = transcript.segments.filter(s => s.start <= 4).map(s => s.text.trim()).join(" ");
  const later = transcript.segments.filter(s => s.start >= 8).map(s => s.text.trim()).join(" ");
  if (!opening || !later) return null;
  const prompt = `Return JSON only. Decide if this 44-second source window has a clear first-seconds hook and a later payoff. Use only these exact transcript lines; the frame description is context, not proof of dialogue. If the moment is routine or unclear, return {}. Otherwise return {"hook_quote":"verbatim contiguous quote from OPENING","payoff_quote":"verbatim contiguous quote from LATER","parts":{"hook":0,"clarity":0,"payoff":0,"novelty":0,"emotion":0,"fit":0,"technical":0}}. Bounds: hook/clarity/payoff 0-20, novelty 0-15, emotion/fit 0-10, technical 0-5. Assign zero when unsupported. Never infer names or offscreen events. OPENING: ${opening.slice(0, 600)} LATER: ${later.slice(0, 2000)} FRAME: ${frame?.text || "unavailable"}`;
  const res = await fetch("http://127.0.0.1:11434/api/generate", { method: "POST",
    signal: AbortSignal.timeout(60_000), headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: visionModel, stream: false, format: "json", prompt }) });
  if (!res.ok) return null;
  const raw = String((await res.json()).response || "");
  let choice;
  try { choice = JSON.parse(raw); } catch { return null; }
  const hook = exactQuote(choice.hook_quote, opening);
  const payoff = exactQuote(choice.payoff_quote, later);
  const score = editorialScore(choice.parts);
  if (!hook || !payoff || score == null || hook.toLowerCase() === payoff.toLowerCase()) return null;
  return { hook, payoff, editorialPotential: score, scoreBreakdown: choice.parts,
    recommendedAction: score >= 80 ? "review" : score >= 60 ? "revise" : "skip" };
}

/** @param {string} input
 * @param {{ marks?: number[], limit?: number, includeVision?: boolean }} [options] */
export async function scoutVideo(input, { marks = [], limit = 5, includeVision = true } = {}) {
  if (!/^https?:\/\//.test(input)) await stat(input);
  const metadata = await probe(input);
  const levels = metadata.hasAudio ? await audioLevels(input) : [];
  const windows = selectWindows(levels, metadata.durationSec, marks, limit);
  const report = { source: input, sourceLabel: /^https?:\/\//.test(input) ? "hosted upload" : basename(input),
    durationSec: metadata.durationSec, width: metadata.width, height: metadata.height,
    method: "audio peaks plus owner marks; local Whisper and sampled-frame vision",
    scoreMeaning: "uncalibrated editorial potential out of 100, never a virality percentage",
    generatedAt: new Date().toISOString(), candidates: [] };
  for (const window of windows) {
    const dir = await mkdtemp(join(tmpdir(), "hge-scout-"));
    try {
      let transcript;
      try { transcript = await transcribeWindow(input, window, dir); }
      catch (error) { transcript = { trustworthy: false, text: null, segments: [],
        reason: `transcription failed: ${String(error.message).slice(0, 120)}` }; }
      let frame = null;
      if (includeVision) {
        try { frame = await frameDescription(input, window, dir); }
        catch { /* A frame is optional evidence; do not fabricate it. */ }
      }
      let assessment = null;
      if (transcript.trustworthy) {
        try { assessment = await evaluateEvidence(transcript, frame); }
        catch { /* A model failure is an abstention, not a score. */ }
      }
      report.candidates.push({ ...window,
        status: assessment ? "assessed" : "insufficient_evidence",
        transcript: transcript.text,
        transcriptSegments: transcript.segments.map(s => ({ startSec: Math.round((window.startSec + s.start) * 10) / 10,
          endSec: Math.round((window.startSec + s.end) * 10) / 10, text: s.text.trim() })),
        visualEvidence: frame,
        assessment,
        note: assessment ? "Review the actual video before publishing." :
          transcript.reason || "No exact opening hook and later payoff could be verified." });
    } finally { await rm(dir, { recursive: true, force: true }); }
  }
  report.overallStatus = report.candidates.some(c => c.assessment?.recommendedAction === "review") ? "review_candidates" :
    report.candidates.length ? "no_strong_verified_candidate" : "no_audio_spike_or_mark";
  return report;
}

function parseArgs(argv) {
  let input, output, limit = 5, includeVision = true;
  const marks = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--input") input = argv[++i];
    else if (arg === "--output") output = argv[++i];
    else if (arg === "--mark") marks.push(Number(argv[++i]));
    else if (arg === "--limit") limit = Number(argv[++i]);
    else if (arg === "--no-vision") includeVision = false;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!input || !output) throw new Error("Usage: node scripts/scout-video.mjs --input VIDEO --output REPORT.json [--mark SECONDS] [--limit 1-10]");
  if (!Number.isInteger(limit) || limit < 1 || limit > 10) throw new Error("limit must be 1–10");
  return { input, output, marks, limit, includeVision };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const report = await scoutVideo(options.input, options);
    await writeFile(options.output, JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
    console.log(`SCOUT ${report.overallStatus} candidates=${report.candidates.length} report=${options.output}`);
    for (const c of report.candidates)
      console.log(`${c.startSec}-${c.endSec}s ${c.origin} ${c.status}${c.assessment ? ` ${c.assessment.editorialPotential}/100` : ""}`);
  } catch (error) { console.error(`Scout failed: ${String(error.message).slice(0, 250)}`); process.exitCode = 1; }
}
