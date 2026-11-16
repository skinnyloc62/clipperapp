#!/usr/bin/env node
/**
 * Copy every clip the watcher has cut into a folder you can actually browse.
 *
 *   node scripts/export-clips.mjs            # → ~/Downloads/HGE Clips
 *   node scripts/export-clips.mjs /path/out  # → somewhere else
 *
 * Reads the same clips.json / renders.json the app reads, so a clip only shows
 * up here after it exists on disk. Nothing is re-encoded, renamed inside the
 * registry, or invented. Safe to run as often as you like: existing files are
 * left alone.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";

const REPO_ROOT = new URL("..", import.meta.url).pathname;
const DEFAULT_DATA = "/Users/homegrownentllc/Library/Application Support/Street Ethics Clip Engine/data";
const DATA_ROOT = (process.env.CLIPMVP_DATA_DIR || "").trim() || DEFAULT_DATA || join(REPO_ROOT, ".data");
const OUT_ROOT = process.argv[2] || join(homedir(), "Downloads", "HGE Clips");

const pad = (n) => String(n).padStart(2, "0");
const round1 = (n) => Math.round(n * 10) / 10;

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

/** Local wall-clock stamp, because "05:48 UTC" means nothing at a desk in Miami. */
/**
 * segmentsJson has been written in more than one shape while this was being
 * built: sometimes a bare array holding one provenance object, sometimes that
 * object directly. Read both rather than mislabel a clip.
 */
function parseProvenance(raw) {
  try {
    const parsed = JSON.parse(raw || "null");
    if (Array.isArray(parsed)) return parsed[0] || {};
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    /* fall through */
  }
  return {};
}

function stamp(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown-time";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

const clips = readJson(join(DATA_ROOT, "clips.json")) || {};
const renders = readJson(join(DATA_ROOT, "renders.json")) || {};

const renderByClip = new Map();
for (const r of Object.values(renders)) {
  if (r?.clipId && r.status === "done" && r.localPath) renderByClip.set(r.clipId, r);
}

const rows = Object.values(clips)
  .filter((c) => c?.clipId)
  .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));

if (rows.length === 0) {
  console.log(`No clips yet in ${DATA_ROOT}`);
  console.log("The watcher writes a clip here only after it cuts and renders one.");
  process.exit(0);
}

const verticalDir = join(OUT_ROOT, "vertical");
const wideDir = join(OUT_ROOT, "wide");
mkdirSync(verticalDir, { recursive: true });
mkdirSync(wideDir, { recursive: true });

const manifest = [];
let copied = 0;
let skipped = 0;
let missing = 0;

for (const c of rows) {
  const prov = parseProvenance(c.segmentsJson);
  const segs = Array.isArray(prov.segments) ? prov.segments : [];
  const levels = segs.map((s) => s?.rmsDb).filter((v) => typeof v === "number");
  const channel =
    prov.channel || String(c.assetId || "").replace(/^live_/, "") || "unknown-channel";
  const from = prov.capturedWindowStart || c.createdAt;
  const durationSec = Math.max(0, (c.endSec ?? 0) - (c.startSec ?? 0));
  const trigger = prov.trigger || "unknown";
  const rms = levels.length ? round1(Math.max(...levels)) : null;
  const bed = levels.length ? round1(levels.reduce((a, b) => a + b, 0) / levels.length) : null;
  const render = renderByClip.get(c.clipId);
  const qa = render?.qa?.status ?? "NO_RENDER";

  const stem = `${stamp(from)}_${channel}_${Math.round(durationSec)}s_${trigger}`;
  const wideTarget = join(wideDir, `${stem}_wide.mp4`);
  const vertTarget = join(verticalDir, `${stem}_vertical-1080x1920.mp4`);

  const copy = (src, dest) => {
    if (!src || !existsSync(src)) {
      missing += 1;
      return false;
    }
    if (existsSync(dest)) {
      skipped += 1;
      return true;
    }
    copyFileSync(src, dest);
    copied += 1;
    return true;
  };

  const wideOk = copy(c.localPath, wideTarget);
  const vertOk = render ? copy(render.localPath, vertTarget) : false;

  manifest.push(
    [
      `${stamp(from).replace("_", " ")}  ${channel}${prov.title ? ` — ${prov.title}` : ""}`,
      `  length      ${durationSec.toFixed(0)}s            trigger ${trigger}`,
      `  audio       peak ${rms ?? "—"} dB, mean ${bed ?? "—"} dB over ${levels.length} segment(s)`,
      prov.evidence ? `  detector    ${prov.evidence}` : null,
      `  render      ${render ? `${render.preset} · QA ${qa}` : "none — no vertical render on disk"}`,
      `  files       ${wideOk ? basename(wideTarget) : "wide cut missing"}`,
      `              ${vertOk ? basename(vertTarget) : "vertical render missing"}`,
      "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

const header = [
  "HGE Clippers — clips cut by the Street Ethics Clip Engine",
  `exported ${new Date().toString()}`,
  `${rows.length} clip(s) in ${DATA_ROOT}`,
  "",
  "vertical/ = 1080x1920, the file to post.",
  "wide/     = the source cut at the stream's own aspect ratio.",
  "",
  "What these files are NOT: no burned-in captions, no brand overlay, no loudness",
  "mastering. The QA record marks those three checks NOT_TESTED for that reason.",
  "",
  "Re-run `node scripts/export-clips.mjs` to pick up new clips. It never",
  "overwrites a file that is already here.",
  "",
  "".padEnd(78, "-"),
  "",
].join("\n");

writeFileSync(join(OUT_ROOT, "manifest.txt"), header + manifest.join("\n"), "utf8");

const bytes = [...rows].reduce((sum, c) => {
  const r = renderByClip.get(c.clipId);
  const paths = [c.localPath, r?.localPath].filter(Boolean);
  return sum + paths.reduce((s, p) => {
    try {
      return s + statSync(p).size;
    } catch {
      return s;
    }
  }, 0);
}, 0);

console.log(`HGE Clips → ${OUT_ROOT}`);
console.log(`  ${rows.length} clip(s) known · ${copied} file(s) copied · ${skipped} already there · ${missing} missing on disk`);
console.log(`  ${(bytes / 1024 / 1024).toFixed(0)} MB of video`);
console.log(`  manifest.txt written`);
