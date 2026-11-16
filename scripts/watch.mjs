#!/usr/bin/env node
/**
 * Live watcher for Kick channels.
 *
 *   1. Reads `channels.json` (the list the app owns) and polls each channel on
 *      kick.com every 15s for playback_url, viewers, title and category.
 *   2. While a channel is live, records its HLS stream into short MPEG-TS
 *      segments in a ring buffer on local disk.
 *   3. Measures audio energy on every finished segment. A segment clearly
 *      louder than the rolling median is a spike.
 *   4. Cuts a clip from the ring around the spike (12s before, 28s after),
 *      renders a 1080x1920 vertical copy, probes both, and only then writes
 *      rows to clips.json / renders.json — the same registries the app reads.
 *
 * Standalone Node process. No Next.js runtime, no npm dependencies.
 * Env: CLIPMVP_DATA_DIR, WATCH_CHANNELS, WATCH_* tuning knobs.
 */
import { spawn } from "node:child_process";
import {
  existsSync, mkdirSync, readdirSync, readFileSync, renameSync,
  rmSync, statSync, unlinkSync, writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const CONFIG = {
  dataRoot: (process.env.CLIPMVP_DATA_DIR || "").trim() || join(REPO_ROOT, ".data"),
  userId: process.env.CLIPMVP_USER_ID || "household",
  pollMs: int("WATCH_POLL_MS", 15_000),
  segmentSec: int("WATCH_SEGMENT_SEC", 4),
  ringSec: int("WATCH_RING_SEC", 240),
  preSec: int("WATCH_CLIP_PRE_SEC", 12),
  postSec: int("WATCH_CLIP_POST_SEC", 28),
  cooldownSec: int("WATCH_SPIKE_COOLDOWN_SEC", 180),
  spikeDb: int("WATCH_SPIKE_DB", 9),
  jumpDb: int("WATCH_JUMP_DB", 6),
  spikeFloorDb: int("WATCH_SPIKE_FLOOR_DB", -30),
  spikeConfirmSegments: int("WATCH_SPIKE_CONFIRM_SEGMENTS", 2),
  localBedSegments: int("WATCH_LOCAL_BED_SEGMENTS", 4),
  baselineSegments: int("WATCH_BASELINE_SEGMENTS", 8),
  fallbackSec: int("WATCH_FALLBACK_SEC", 900),
  fallbackMinDb: int("WATCH_FALLBACK_MIN_DB", -20),
  stallMs: int("WATCH_STALL_MS", 30_000),
  restartBackoffMs: int("WATCH_RESTART_BACKOFF_MS", 5_000),
  restartBackoffMaxMs: int("WATCH_RESTART_BACKOFF_MAX_MS", 60_000),
  maxRingBytes: int("WATCH_RING_MAX_MB", 700) * 1024 * 1024,
  fallbackSlugs: (process.env.WATCH_CHANNELS || "deenthegreat")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
};

const FFMPEG = pickBin("FFMPEG_PATH", "/opt/homebrew/bin/ffmpeg", "ffmpeg");
const FFPROBE = pickBin("FFPROBE_PATH", "/opt/homebrew/bin/ffprobe", "ffprobe");
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const WATCH_DIR = join(CONFIG.dataRoot, "watch");
const MONITOR_PATH = join(WATCH_DIR, "monitor.json");
const LOG_PATH = join(WATCH_DIR, "watch.log");
const CHANNELS_PATH = join(CONFIG.dataRoot, "channels.json");

const STARTED_AT = nowIso();
const states = new Map();
let cutting = false;
let shuttingDown = false;

/* ---------------------------------------------------------------- helpers */

function int(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function pickBin(envName, preferred, fallback) {
  const explicit = (process.env[envName] || "").trim();
  if (explicit) return explicit;
  return existsSync(preferred) ? preferred : fallback;
}

function nowIso() {
  return new Date().toISOString();
}

function readJson(path, fallback) {
  try {
    if (!existsSync(path)) return fallback;
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2));
  renameSync(tmp, path);
}

function log(line) {
  const text = `[${nowIso()}] ${line}`;
  console.log(text);
  try {
    mkdirSync(WATCH_DIR, { recursive: true });
    const prior = existsSync(LOG_PATH) ? readFileSync(LOG_PATH, "utf8") : "";
    const trimmed = prior.length > 400_000 ? prior.slice(-300_000) : prior;
    writeFileSync(LOG_PATH, `${trimmed}${text}\n`);
  } catch {
    /* logging must never take the watcher down */
  }
}

function median(values) {
  if (values.length === 0) return -90;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function run(bin, args, timeoutMs = 180_000) {
  return new Promise((resolve) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      try { child.kill("SIGKILL"); } catch { /* already gone */ }
    }, timeoutMs);
    child.stdout.on("data", (b) => { stdout += b.toString(); });
    child.stderr.on("data", (b) => { stderr += b.toString().slice(0, 4000); });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: `${stderr}${err.message}` });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });
}

/* --------------------------------------------------------------- monitor */

function blankMonitor(slug) {
  return {
    slug,
    displayName: slug,
    live: false,
    viewers: null,
    title: null,
    category: null,
    streamStartedAt: null,
    lastPollAt: null,
    lastError: null,
    recording: false,
    bufferedSec: 0,
    segmentCount: 0,
    rmsDb: null,
    baselineDb: null,
    spikes: 0,
    fallbackCuts: 0,
    clips: 0,
    lastClipId: null,
    lastClipAt: null,
    lastClipTrigger: null,
  };
}

function publishMonitor() {
  const channels = {};
  for (const st of states.values()) {
    st.mon.recording = Boolean(st.writer && st.writer.exitCode === null);
    st.mon.segmentCount = st.segs.length;
    st.mon.bufferedSec = Math.round(ringSpanMs(st) / 1000);
    channels[st.slug] = st.mon;
  }
  const totals = {
    channels: states.size,
    live: [...states.values()].filter((s) => s.mon.live).length,
    recording: [...states.values()].filter((s) => s.writer && s.writer.exitCode === null).length,
    spikes: [...states.values()].reduce((n, s) => n + s.mon.spikes, 0),
    clips: [...states.values()].reduce((n, s) => n + s.mon.clips, 0),
  };
  writeJsonAtomic(MONITOR_PATH, {
    version: 1,
    running: !shuttingDown,
    pid: process.pid,
    startedAt: STARTED_AT,
    updatedAt: nowIso(),
    dataRoot: CONFIG.dataRoot,
    userId: CONFIG.userId,
    config: {
      pollSec: CONFIG.pollMs / 1000,
      segmentSec: CONFIG.segmentSec,
      ringSec: CONFIG.ringSec,
      clipWindowSec: [CONFIG.preSec, CONFIG.postSec],
      spikeDb: CONFIG.spikeDb,
      jumpDb: CONFIG.jumpDb,
      spikeFloorDb: CONFIG.spikeFloorDb,
      spikeConfirmSegments: CONFIG.spikeConfirmSegments,
      cooldownSec: CONFIG.cooldownSec,
      fallbackSec: CONFIG.fallbackSec,
      fallbackMinDb: CONFIG.fallbackMinDb,
    },
    totals,
    channels,
  });
}

/* -------------------------------------------------------------- watchlist */

/**
 * The app owns channels.json: every record it writes here is a channel to
 * watch. Only a missing file is seeded from WATCH_CHANNELS. An existing empty
 * registry is the owner's explicit stop decision and must stay empty.
 */
function readWatchlist() {
  if (existsSync(CHANNELS_PATH)) {
    const all = readJson(CHANNELS_PATH, {});
    return Object.values(all).filter((r) => r && typeof r.slug === "string");
  }

  const seeded = {};
  const at = nowIso();
  for (const slug of CONFIG.fallbackSlugs) {
    seeded[slug] = { slug, displayName: slug, addedAt: at, addedBy: "watcher-seed", source: "env" };
  }
  if (Object.keys(seeded).length > 0) {
    writeJsonAtomic(CHANNELS_PATH, seeded);
    log(`seeded channels.json with ${Object.keys(seeded).join(", ")}`);
  }
  return Object.values(seeded);
}

function syncWatchlist() {
  const records = readWatchlist();
  const wanted = new Set(records.map((r) => r.slug.toLowerCase()));

  for (const slug of wanted) {
    if (!states.has(slug)) {
      const bufDir = join(WATCH_DIR, slug, "buf");
      mkdirSync(bufDir, { recursive: true });
      const st = {
        slug,
        displayName: records.find((r) => r.slug.toLowerCase() === slug)?.displayName || slug,
        bufDir,
        mon: blankMonitor(slug),
        writer: null,
        writerUrl: null,
        segs: [],
        seen: new Set(),
        nextIndex: highestIndex(bufDir) + 1,
        startIndex: highestIndex(bufDir) + 1,
        pending: [],
        lastSpikeAt: 0,
        lastCutAt: 0,
        lastCutAnchorMs: 0,
        candidate: null,
        lastFallbackNoteAt: 0,
        liveSince: null,
        lastSegAt: 0,
        restartCount: 0,
        nextAttemptAt: 0,
        polling: false,
      };
      states.set(slug, st);
      log(`+ watching ${slug} (buffer ${bufDir})`);
    }
  }

  for (const [slug, st] of states) {
    if (wanted.has(slug)) continue;
    stopWriter(st, "removed from watchlist");
    states.delete(slug);
    log(`- stopped watching ${slug}`);
  }
}

/* ------------------------------------------------------------ channel poll */

async function pollChannel(st) {
  if (st.polling) return;
  st.polling = true;
  try {
    const res = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(st.slug)}`, {
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`kick api ${res.status}`);
    const data = await res.json();
    const live = data?.livestream;
    // Kick puts the signed HLS playback_url at the TOP level of the channel
    // payload. `livestream` has no playback_url field at all, so read both.
    const raw = [live?.playback_url, data?.playback_url]
      .find((u) => typeof u === "string" && u.length > 20);
    const playback = raw || null;

    st.mon.lastPollAt = nowIso();
    st.mon.lastError = null;
    st.mon.displayName = data?.slug ? st.slug : st.displayName;
    st.mon.live = Boolean(live && playback);
    st.mon.viewers = live?.viewer_count ?? null;
    st.mon.title = live?.session_title ?? null;
    st.mon.streamStartedAt = live?.start_time ?? null;
    st.mon.category = live?.categories?.[0]?.name ?? null;
    st.mon.followers = data?.followers_count ?? null;
    st.mon.avatar = data?.user?.profile_pic ?? null;

    if (st.mon.live) {
      if (!st.liveSince) {
        st.liveSince = Date.now();
        log(`${st.slug}: live — "${st.mon.title || "untitled"}" · ${st.mon.viewers ?? "?"} viewers`);
      }
      ensureWriter(st, playback);
    } else {
      if (st.liveSince) log(`${st.slug}: stream ended`);
      st.liveSince = null;
      stopWriter(st, "channel offline");
    }
  } catch (err) {
    st.mon.lastPollAt = nowIso();
    st.mon.lastError = String(err?.message || err).slice(0, 300);
    log(`${st.slug}: poll failed — ${st.mon.lastError}`);
  } finally {
    st.polling = false;
    publishMonitor();
  }
}

/* ------------------------------------------------------------- recording */

function highestIndex(dir) {
  try {
    const nums = readdirSync(dir)
      .map((f) => /^seg_(\d+)\.ts$/.exec(f))
      .filter(Boolean)
      .map((m) => Number.parseInt(m[1], 10));
    return nums.length ? Math.max(...nums) : -1;
  } catch {
    return -1;
  }
}

function ensureWriter(st, playbackUrl) {
  const healthy = st.writer && st.writer.exitCode === null && Date.now() - st.lastSegAt < CONFIG.stallMs;
  if (healthy) return;
  if (st.writer && st.writer.exitCode === null) {
    log(`${st.slug}: segmenter stalled, restarting`);
    stopWriter(st, "stall restart");
  }

  // A corrupt HLS packet kills ffmpeg outright. Back off so a broken stream
  // cannot turn into a spawn loop, then recover on its own once it settles.
  if (Date.now() < st.nextAttemptAt) return;

  const args = [
    "-hide_banner", "-loglevel", "warning", "-nostdin",
    "-user_agent", UA,
    "-i", playbackUrl,
    "-map", "0:v:0?", "-map", "0:a:0?",
    "-c", "copy",
    "-f", "segment",
    "-segment_format", "mpegts",
    "-segment_time", String(CONFIG.segmentSec),
    "-reset_timestamps", "1",
    "-segment_start_number", String(st.nextIndex),
    join(st.bufDir, "seg_%08d.ts"),
  ];
  st.writerUrl = playbackUrl;
  const child = spawn(FFMPEG, args, { stdio: ["ignore", "ignore", "pipe"] });
  st.writer = child;
  st.lastSegAt = Date.now();

  let tail = "";
  child.stderr.on("data", (b) => {
    tail = (tail + b.toString()).slice(-4000);
  });
  child.on("error", (err) => {
    log(`${st.slug}: ffmpeg failed to start — ${err.message}`);
    st.writer = null;
  });
  child.on("close", (code) => {
    const lastLine = tail.trim().split("\n").pop() || "";
    if (st.writer === child) st.writer = null;
    if (shuttingDown) return;
    log(`${st.slug}: segmenter exited (${code}) ${lastLine.slice(0, 160)}`);
    if (code === 0) {
      st.restartCount = 0;
      st.nextAttemptAt = 0;
      return;
    }
    st.restartCount += 1;
    const wait = Math.min(
      CONFIG.restartBackoffMaxMs,
      CONFIG.restartBackoffMs * 2 ** Math.min(st.restartCount - 1, 6),
    );
    st.nextAttemptAt = Date.now() + wait;
    st.mon.lastError = `segmenter exited (${code}) — retrying in ${Math.round(wait / 1000)}s`;
    log(`${st.slug}: retrying in ${Math.round(wait / 1000)}s (attempt ${st.restartCount})`);
  });
  log(`${st.slug}: recording from segment ${st.nextIndex}`);
}

function stopWriter(st, reason) {
  if (!st.writer) return;
  const child = st.writer;
  st.writer = null;
  try { child.kill("SIGTERM"); } catch { /* already gone */ }
  log(`${st.slug}: stopped recording (${reason})`);
}

function ringSpanMs(st) {
  if (st.segs.length < 2) return 0;
  return st.segs[st.segs.length - 1].endMs - st.segs[0].startMs;
}

/* ------------------------------------------------------ segments + energy */

async function probeSegment(file) {
  const res = await run(FFPROBE, [
    "-v", "error", "-print_format", "json", "-show_format", "-show_streams", file,
  ], 30_000);
  if (res.code !== 0) return null;
  try {
    const data = JSON.parse(res.stdout);
    const video = (data.streams || []).find((s) => s.codec_type === "video");
    const audio = (data.streams || []).find((s) => s.codec_type === "audio");
    const durationSec = Number(data.format?.duration);
    if (!video || !Number.isFinite(durationSec) || durationSec <= 0) return null;
    return { durationSec, audio: Boolean(audio), width: video.width, height: video.height };
  } catch {
    return null;
  }
}

/** RMS in dBFS from the segment's own audio — 8 kHz mono PCM, no video decode. */
async function measureRmsDb(file) {
  return new Promise((resolve) => {
    const child = spawn(FFMPEG, [
      "-v", "error", "-nostdin", "-i", file,
      "-vn", "-ac", "1", "-ar", "8000", "-f", "s16le", "pipe:1",
    ], { stdio: ["ignore", "pipe", "ignore"] });

    const chunks = [];
    let bytes = 0;
    const cap = 8000 * 2 * 30; // 30s of PCM is plenty
    const done = (value) => {
      try { child.kill("SIGKILL"); } catch { /* already gone */ }
      resolve(value);
    };
    const timer = setTimeout(() => done(rmsFrom(chunks, bytes)), 15_000);

    child.stdout.on("data", (buf) => {
      if (bytes >= cap) return;
      chunks.push(buf);
      bytes += buf.length;
    });
    child.on("error", () => { clearTimeout(timer); resolve(null); });
    child.on("close", () => {
      clearTimeout(timer);
      resolve(rmsFrom(chunks, bytes));
    });
  });
}

function rmsFrom(chunks, bytes) {
  const samples = Math.floor(bytes / 2);
  if (samples < 800) return null;
  const buf = Buffer.concat(chunks, bytes);
  let sum = 0;
  for (let i = 0; i < samples; i += 1) {
    const v = buf.readInt16LE(i * 2) / 32768;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / samples);
  if (rms < 1e-6) return -90;
  return Math.max(-90, 20 * Math.log10(rms));
}

async function ingestSegment(st, file, index) {
  if (st.seen.has(index)) return;
  st.seen.add(index);
  const info = await probeSegment(file);
  if (!info) {
    log(`${st.slug}: seg ${index} unreadable, skipped`);
    try { unlinkSync(file); } catch { /* best effort */ }
    return;
  }

  const endMs = statSync(file).mtimeMs;
  const startMs = endMs - info.durationSec * 1000;
  const rmsDb = info.audio ? await measureRmsDb(file) : null;

  st.lastSegAt = Date.now();
  if (st.restartCount > 0) {
    log(`${st.slug}: recovered after ${st.restartCount} restart attempt(s)`);
    st.restartCount = 0;
    st.nextAttemptAt = 0;
  }
  st.segs.push({ file, index, startMs, endMs, rmsDb, durationSec: info.durationSec });
  st.segs.sort((a, b) => a.startMs - b.startMs);
  st.mon.rmsDb = rmsDb == null ? null : round1(rmsDb);

  const prior = st.segs
    .filter((s) => s.index !== index)
    .slice(-40)
    .map((s) => s.rmsDb)
    .filter((v) => typeof v === "number" && v > -90);
  const baseline = median(prior);
  st.mon.baselineDb = prior.length ? round1(baseline) : null;

  // The bed immediately before this segment. A reaction has to jump out of
  // *this*, not just out of a 40-segment median that already includes it.
  const localBed = median(prior.slice(-CONFIG.localBedSegments));

  // Segments that predate this process only warm the baseline. Re-detecting
  // them would re-cut the same moment on every restart.
  const fresh = index >= st.startIndex;
  if (fresh && rmsDb != null && prior.length >= CONFIG.baselineSegments) {
    // Two different questions. Over the 40-segment median: is this loud at all
    // for this stream? Over the last 4 segments: did it *just* change? A
    // reaction needs both — steady loudness only has the first.
    const loudEnough = rmsDb > CONFIG.spikeFloorDb;
    const overBaseline = rmsDb > baseline + CONFIG.spikeDb;
    const jumped = rmsDb > localBed + CONFIG.jumpDb;

    if (!(loudEnough && overBaseline && jumped)) {
      // Talking, music bed, silence — not a moment. Drop any half-formed run.
      st.candidate = null;
    } else {
      const prev = st.candidate;
      const run = prev && prev.lastIndex === index - 1 ? prev.run + 1 : 1;
      const candidate = {
        run,
        lastIndex: index,
        startMs: run > 1 && prev ? prev.startMs : startMs,
        rmsDb,
        baseline,
        localBed,
      };
      st.candidate = candidate;

      // Two cuts inside one loud stretch is one clip's worth of moment, so the
      // cooldown is measured against the previous cut's anchor, not the clock.
      const sinceLastMs = candidate.startMs - (st.lastCutAnchorMs || 0);
      if (run < CONFIG.spikeConfirmSegments) {
        log(`${st.slug}: candidate at seg ${index} — ${round1(rmsDb)} dB vs bed ${round1(localBed)} dB, needs a second loud segment`);
      } else if (sinceLastMs < CONFIG.cooldownSec * 1000) {
        log(`${st.slug}: spike at seg ${index} ignored — ${Math.round(sinceLastMs / 1000)}s after the last cut (cooldown ${CONFIG.cooldownSec}s)`);
      } else {
        st.candidate = null;
        st.lastSpikeAt = Date.now();
        st.lastCutAnchorMs = candidate.startMs;
        st.mon.spikes += 1;
        log(`${st.slug}: sustained spike at seg ${index} — ${run} segs, peak ${round1(rmsDb)} dB vs bed ${round1(localBed)} dB / median ${round1(baseline)} dB`);
        scheduleCut(st, {
          trigger: "audio-spike",
          anchorMs: candidate.startMs,
          readyAt: endMs + CONFIG.postSec * 1000 + 2500,
          evidence: `${run} segments running above median ${round1(baseline)} dB + ${CONFIG.spikeDb} dB (bed ${round1(localBed)} dB, peak ${round1(rmsDb)} dB)`,
        });
      }
    }
  }
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function scheduleCut(st, job) {
  st.pending.push(job);
  publishMonitor();
}

function scanBuffer(st) {
  let files;
  try { files = readdirSync(st.bufDir); } catch { return; }
  const parsed = files
    .map((name) => {
      const m = /^seg_(\d+)\.ts$/.exec(name);
      return m ? { name, index: Number.parseInt(m[1], 10) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.index - b.index);

  const maxIndex = parsed.length ? parsed[parsed.length - 1].index : -1;
  for (const item of parsed) {
    if (st.seen.has(item.index)) continue;
    const file = join(st.bufDir, item.name);
    let stat;
    try { stat = statSync(file); } catch { continue; }
    // The newest file may still be open: only ingest it once it stops growing.
    const settled = item.index < maxIndex || Date.now() - stat.mtimeMs > 1500;
    if (!settled) continue;
    ingestSegment(st, file, item.index).catch((err) => {
      log(`${st.slug}: ingest failed for seg ${item.index} — ${err.message}`);
    });
  }
  st.nextIndex = Math.max(st.nextIndex, maxIndex + 1);
}

/* ---------------------------------------------------------------- cutting */

function pickFallback(st) {
  if (!st.mon.live || st.mon.clips > 0 || st.pending.length > 0) return;
  if (!st.liveSince || Date.now() - st.liveSince < CONFIG.fallbackSec * 1000) return;
  // Never cut a fallback out of audio from before this process started.
  if (!st.segs.some((s) => s.index >= st.startIndex)) return;
  const scored = st.segs.filter((s) => s.index >= st.startIndex && typeof s.rmsDb === "number" && s.rmsDb > -90);
  if (scored.length < CONFIG.baselineSegments) return;
  const loudest = scored.reduce((best, s) => (s.rmsDb > best.rmsDb ? s : best), scored[0]);

  // A fallback is a consolation prize, not a licence to cut ambient talking.
  // If the loudest thing in the window is still background noise, cut nothing.
  if (loudest.rmsDb < CONFIG.fallbackMinDb) {
    if (Date.now() - st.lastFallbackNoteAt > CONFIG.fallbackSec * 1000) {
      st.lastFallbackNoteAt = Date.now();
      log(`${st.slug}: nothing special yet — loudest buffered moment is ${round1(loudest.rmsDb)} dB, needs ${CONFIG.fallbackMinDb} dB for a fallback clip`);
    }
    return;
  }
  if (loudest.startMs - (st.lastCutAnchorMs || 0) < CONFIG.cooldownSec * 1000) return;

  st.lastCutAnchorMs = loudest.startMs;
  log(`${st.slug}: no spike in ${CONFIG.fallbackSec}s — cutting loudest buffered moment (seg ${loudest.index}, ${round1(loudest.rmsDb)} dB)`);
  st.mon.fallbackCuts += 1;
  scheduleCut(st, {
    trigger: "fallback-loudest",
    anchorMs: loudest.startMs,
    readyAt: Date.now(),
    evidence: `no spike in ${CONFIG.fallbackSec}s; loudest segment ${round1(loudest.rmsDb)} dB, above the ${CONFIG.fallbackMinDb} dB fallback floor`,
  });
}

async function processCuts() {
  if (cutting) return;
  for (const st of states.values()) pickFallback(st);

  const queue = [];
  for (const st of states.values()) {
    for (const job of st.pending) {
      if (Date.now() >= job.readyAt) queue.push({ st, job });
    }
  }
  if (queue.length === 0) return;
  queue.sort((a, b) => a.job.readyAt - b.job.readyAt);

  const { st, job } = queue[0];
  st.pending = st.pending.filter((j) => j !== job);
  cutting = true;
  try {
    await cutClip(st, job);
  } catch (err) {
    log(`${st.slug}: cut failed — ${String(err?.message || err).slice(0, 300)}`);
  } finally {
    cutting = false;
    publishMonitor();
  }
}

async function cutClip(st, job) {
  const wantedStart = job.anchorMs - CONFIG.preSec * 1000;
  const wantedEnd = job.anchorMs + CONFIG.postSec * 1000 + CONFIG.segmentSec * 1000;
  const available = st.segs.filter((s) => s.endMs > wantedStart && s.startMs < wantedEnd);
  if (available.length === 0) {
    log(`${st.slug}: nothing buffered for ${job.trigger}, skipped`);
    return;
  }

  const first = available[0];
  const last = available[available.length - 1];
  const startMs = Math.max(wantedStart, first.startMs);
  const endMs = Math.min(wantedEnd, last.endMs);
  const durationSec = (endMs - startMs) / 1000;
  if (durationSec < 10) {
    log(`${st.slug}: only ${durationSec.toFixed(1)}s buffered for ${job.trigger}, skipped`);
    return;
  }
  const offsetSec = Math.max(0, (startMs - first.startMs) / 1000);

  const tmpDir = join(WATCH_DIR, st.slug, "tmp");
  mkdirSync(tmpDir, { recursive: true });
  const listPath = join(tmpDir, `list_${randomUUID()}.txt`);
  writeFileSync(listPath, available.map((s) => `file '${s.file}'`).join("\n"));

  const clipId = `clip_${randomUUID()}`;
  const renderId = `render_${randomUUID()}`;
  const clipDir = join(CONFIG.dataRoot, "cuts", CONFIG.userId);
  const renderDir = join(CONFIG.dataRoot, "renders", CONFIG.userId);
  mkdirSync(clipDir, { recursive: true });
  mkdirSync(renderDir, { recursive: true });
  const clipPath = join(clipDir, `${clipId}.mp4`);
  const renderPath = join(renderDir, `${renderId}.mp4`);

  log(`${st.slug}: cutting ${durationSec.toFixed(1)}s from ${available.length} segments (${job.trigger})`);

  const cut = await run(FFMPEG, [
    "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
    "-f", "concat", "-safe", "0", "-i", listPath,
    "-ss", offsetSec.toFixed(3), "-t", durationSec.toFixed(3),
    "-fflags", "+genpts",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-r", "30",
    "-c:a", "aac", "-b:a", "128k", "-ac", "2",
    "-movflags", "+faststart", clipPath,
  ], 300_000);
  try { unlinkSync(listPath); } catch { /* best effort */ }
  if (cut.code !== 0) {
    log(`${st.slug}: ffmpeg cut exit ${cut.code} — ${cut.stderr.split("\n").pop()?.slice(0, 200)}`);
    try { rmSync(clipPath, { force: true }); } catch { /* best effort */ }
    return;
  }

  const clipProbe = await probeSegment(clipPath);
  if (!clipProbe) {
    log(`${st.slug}: cut produced no readable video, discarded`);
    try { rmSync(clipPath, { force: true }); } catch { /* best effort */ }
    return;
  }

  const render = await run(FFMPEG, [
    "-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-i", clipPath,
    "-filter_complex",
    "[0:v]split=2[bg][fg];" +
      "[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:2[bgb];" +
      "[fg]scale=1080:-2[fgs];[bgb][fgs]overlay=(W-w)/2:(H-h)/2",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "24", "-pix_fmt", "yuv420p", "-r", "30",
    "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", renderPath,
  ], 300_000);

  let renderProbe = null;
  if (render.code === 0) renderProbe = await probeSegment(renderPath);
  if (!renderProbe) {
    log(`${st.slug}: vertical render failed (exit ${render.code}) — clip kept, render omitted`);
    try { rmSync(renderPath, { force: true }); } catch { /* best effort */ }
  }

  const now = new Date().toISOString();
  const startSec = Math.round(offsetSec * 10) / 10;
  const endSec = Math.round((offsetSec + durationSec) * 10) / 10;
  const provenance = {
    source: "kick-live",
    channel: st.slug,
    trigger: job.trigger,
    evidence: job.evidence,
    spikeAt: new Date(job.anchorMs).toISOString(),
    capturedWindowStart: new Date(startMs).toISOString(),
    capturedWindowEnd: new Date(endMs).toISOString(),
    segments: available.map((s) => ({ index: s.index, rmsDb: s.rmsDb == null ? null : round1(s.rmsDb) })),
  };

  const clipRecord = {
    clipId,
    assetId: `live_${st.slug}`,
    userId: CONFIG.userId,
    startSec,
    endSec,
    localPath: clipPath,
    clipBlobUrl: null,
    stored: true,
    status: "cut",
    segmentsJson: JSON.stringify([provenance]),
    createdAt: now,
    updatedAt: now,
  };
  saveRegistry("clips.json", clipId, clipRecord);

  let qa = null;
  if (renderProbe) {
    const dimsOk = renderProbe.width === 1080 && renderProbe.height === 1920;
    const checks = [
      { name: "artifact_exists", status: "PASS", detail: "ffmpeg exited 0 and ffprobe read the file" },
      { name: "dimensions_1080x1920", status: dimsOk ? "PASS" : "FAIL", detail: `got ${renderProbe.width}x${renderProbe.height}` },
      { name: "has_video_stream", status: renderProbe ? "PASS" : "FAIL", detail: "video stream present" },
      { name: "duration_positive", status: renderProbe.durationSec > 0 ? "PASS" : "FAIL", detail: `duration=${renderProbe.durationSec.toFixed(3)}s` },
      { name: "no_leading_black_frames", status: "NOT_TESTED", detail: "frame-content analysis not run by the watcher" },
      { name: "caption_safe_zones", status: "NOT_TESTED", detail: "no captions burned in" },
      { name: "branding_overlay", status: "NOT_TESTED", detail: "no brand overlay applied" },
      { name: "loudness_target", status: "NOT_TESTED", detail: "mastering not applied" },
    ];
    qa = {
      source_id: clipId,
      clip_asset_id: null,
      status: dimsOk ? "PASS" : "REVISE",
      checks,
      tested_at: now,
    };
    const renderRecord = {
      renderId,
      clipId,
      userId: CONFIG.userId,
      preset: "vertical-1080x1920",
      localPath: renderPath,
      renderBlobUrl: null,
      stored: true,
      status: "done",
      qa,
      createdAt: now,
      updatedAt: now,
    };
    saveRegistry("renders.json", renderId, renderRecord);
  }

  st.mon.clips += 1;
  st.mon.lastClipId = clipId;
  st.mon.lastClipAt = now;
  st.mon.lastClipTrigger = job.trigger;
  st.lastCutAt = Date.now();
  log(`${st.slug}: clip ${clipId} — ${durationSec.toFixed(1)}s${renderProbe ? `, vertical render ${renderId} QA ${qa.status}` : ""}`);
}

function saveRegistry(name, id, record) {
  const path = join(CONFIG.dataRoot, name);
  const all = readJson(path, {});
  all[id] = record;
  writeJsonAtomic(path, all);
}

/* -------------------------------------------------------------- ring prune */

function segmentBytes(st) {
  let total = 0;
  for (const s of st.segs) {
    try { total += statSync(s.file).size; } catch { /* already gone */ }
  }
  return total;
}

/** Earliest moment a queued cut still needs. Infinity when nothing is queued. */
function protectedCutoffMs() {
  let cutoff = Number.POSITIVE_INFINITY;
  for (const st of states.values()) {
    for (const job of st.pending) {
      const wanted = job.anchorMs - CONFIG.preSec * 1000 - CONFIG.segmentSec * 1000;
      cutoff = Math.min(cutoff, wanted);
    }
  }
  return cutoff;
}

function dropSegment(st, seg) {
  try { unlinkSync(seg.file); } catch { /* best effort */ }
  st.segs = st.segs.filter((s) => s !== seg);
}

/** Time-based prune: keep `ringSec` of audio, plus anything a cut is waiting on. */
function pruneRing(st) {
  if (cutting) return;
  const keepAfter = Math.min(Date.now() - CONFIG.ringSec * 1000, protectedCutoffMs());
  const stale = st.segs.filter((s) => s.endMs < keepAfter);
  if (stale.length === 0) return;
  for (const seg of stale) dropSegment(st, seg);
  log(`${st.slug}: ring pruned ${stale.length} segment(s), ${st.segs.length} left`);
}

/**
 * Disk guard. The machine this runs on has ~20 GB free, so the ring is capped
 * in bytes as well as in time: drop the oldest unprotected segment first.
 */
function pruneBySize() {
  if (cutting) return;
  const budget = CONFIG.maxRingBytes;
  let bytes = [...states.values()].reduce((n, st) => n + segmentBytes(st), 0);
  if (bytes <= budget) return;

  const protectedMs = protectedCutoffMs();
  const candidates = [];
  for (const st of states.values()) {
    for (const s of st.segs) {
      if (s.endMs < protectedMs) candidates.push({ st, seg: s });
    }
  }
  candidates.sort((a, b) => a.seg.endMs - b.seg.endMs);

  let dropped = 0;
  for (const c of candidates) {
    if (bytes <= budget) break;
    let size = 0;
    try { size = statSync(c.seg.file).size; } catch { size = 0; }
    dropSegment(c.st, c.seg);
    bytes -= size;
    dropped += 1;
  }
  if (dropped > 0) {
    log(`ring over ${Math.round(budget / (1024 * 1024))} MB — dropped ${dropped} oldest segment(s), now ${Math.round(bytes / (1024 * 1024))} MB`);
  }
}

/* ------------------------------------------------------------------ main */

function banner() {
  const mb = Math.round(CONFIG.maxRingBytes / (1024 * 1024));
  log("=== Street Ethics Clip Engine · live watcher ===");
  log(`data root    ${CONFIG.dataRoot}`);
  log(`watchlist    ${CHANNELS_PATH}`);
  log(`workspace    ${CONFIG.userId}`);
  log(`ffmpeg       ${FFMPEG}`);
  log(`ffprobe      ${FFPROBE}`);
  log(`segments     ${CONFIG.segmentSec}s into a ${CONFIG.ringSec}s ring (cap ${mb} MB)`);
  log(`clip window  -${CONFIG.preSec}s / +${CONFIG.postSec}s around the loudest moment`);
  log(`spike rule   +${CONFIG.spikeDb} dB over the median AND +${CONFIG.jumpDb} dB over the last ${CONFIG.localBedSegments} segs, > ${CONFIG.spikeFloorDb} dBFS, held ${CONFIG.spikeConfirmSegments} segs`);
  log(`cooldown     ${CONFIG.cooldownSec}s between cut anchors — one loud stretch makes one clip`);
  log(`fallback     loudest buffered segment after ${CONFIG.fallbackSec}s with no spike, and only above ${CONFIG.fallbackMinDb} dBFS`);
  log(`polling      kick.com every ${CONFIG.pollMs / 1000}s`);
}

function pollAll() {
  if (shuttingDown) return;
  try {
    syncWatchlist();
  } catch (err) {
    log(`watchlist sync failed — ${String(err?.message || err).slice(0, 200)}`);
  }
  for (const st of states.values()) {
    pollChannel(st).catch((err) => {
      log(`${st.slug}: poll rejected — ${String(err?.message || err).slice(0, 200)}`);
    });
  }
}

function scanAll() {
  if (shuttingDown) return;
  for (const st of states.values()) {
    try {
      scanBuffer(st);
    } catch (err) {
      log(`${st.slug}: scan failed — ${String(err?.message || err).slice(0, 200)}`);
    }
  }
}

function cutAll() {
  if (shuttingDown) return;
  processCuts().catch((err) => {
    log(`cut queue failed — ${String(err?.message || err).slice(0, 300)}`);
  });
}

function pruneAll() {
  if (shuttingDown) return;
  for (const st of states.values()) {
    try {
      pruneRing(st);
    } catch (err) {
      log(`${st.slug}: prune failed — ${String(err?.message || err).slice(0, 200)}`);
    }
  }
  try {
    pruneBySize();
  } catch (err) {
    log(`size prune failed — ${String(err?.message || err).slice(0, 200)}`);
  }
}

const timers = [];

function every(ms, fn) {
  // Deliberately NOT unref'd: these timers are the only thing holding the
  // event loop open between ffmpeg crashes, and an unref'd interval silently
  // let the process exit when the last segmenter died.
  const id = setInterval(fn, ms);
  timers.push(id);
  return id;
}

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log(`${signal} — stopping recorders`);
  for (const id of timers) clearInterval(id);
  for (const st of states.values()) stopWriter(st, `shutdown (${signal})`);
  try { publishMonitor(); } catch { /* monitor is best effort */ }
  setTimeout(() => process.exit(0), 500).unref?.();
}

async function main() {
  mkdirSync(WATCH_DIR, { recursive: true });
  banner();
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("uncaughtException", (err) => {
    log(`uncaught exception (still running) — ${String(err?.stack || err).slice(0, 400)}`);
  });
  process.on("unhandledRejection", (err) => {
    log(`unhandled rejection (still running) — ${String(err?.stack || err).slice(0, 400)}`);
  });

  syncWatchlist();
  if (states.size === 0) {
    log("no channels in the watchlist yet — waiting for the app to add one");
  }
  publishMonitor();

  await Promise.all([...states.values()].map((st) => pollChannel(st)));

  every(CONFIG.pollMs, pollAll);
  every(1000, scanAll);
  every(2000, cutAll);
  every(10_000, () => { if (!shuttingDown) publishMonitor(); });
  every(20_000, pruneAll);

  log("watching — Ctrl-C to stop");
}

main().catch((err) => {
  log(`fatal — ${String(err?.stack || err)}`);
  process.exit(1);
});
