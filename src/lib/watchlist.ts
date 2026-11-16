import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { dataPath } from "./data-root";
import { mediaOnLocalDisk } from "./storage-mode";

/**
 * The watchlist the app owns and the watcher process reads.
 *
 * `channels.json` is a single flat registry: one record per channel, keyed by
 * Kick slug. `scripts/watch.mjs` re-reads it every poll interval, so a channel
 * added here starts recording on the next tick with no restart. The watcher
 * treats an empty file as "nothing to do" and seeds it from its own env once —
 * after that this app is the only writer of that file.
 *
 * `watch/monitor.json` is what the watcher publishes about itself. It is read
 * defensively: a missing file, a truncated write, or a stale timestamp all mean
 * "not running", and the UI says so rather than showing a hopeful green light.
 */

export interface ChannelRecord {
  slug: string;
  displayName: string;
  addedAt: string;
  addedBy: string;
  source: string;
}

export interface ChannelMonitor {
  slug: string;
  displayName: string;
  live: boolean;
  viewers: number | null;
  title: string | null;
  category: string | null;
  followers?: number | null;
  avatar?: string | null;
  streamStartedAt: string | null;
  lastPollAt: string | null;
  lastError: string | null;
  recording: boolean;
  bufferedSec: number;
  segmentCount: number;
  rmsDb: number | null;
  baselineDb: number | null;
  spikes: number;
  fallbackCuts: number;
  clips: number;
  lastClipId: string | null;
  lastClipAt: string | null;
  lastClipTrigger: string | null;
}

export interface MonitorSnapshot {
  version: number;
  running: boolean;
  pid: number;
  startedAt: string;
  updatedAt: string;
  dataRoot: string;
  userId: string;
  config?: {
    pollSec: number;
    segmentSec: number;
    ringSec: number;
    clipWindowSec: [number, number];
    spikeDb: number;
    jumpDb?: number;
    spikeFloorDb?: number;
    spikeConfirmSegments?: number;
    cooldownSec?: number;
    fallbackSec: number;
    fallbackMinDb?: number;
  };
  totals: { channels: number; live: number; recording: number; spikes: number; clips: number };
  channels: Record<string, ChannelMonitor>;
}

/** Pages on kick.com that are not channels. Rejecting them early beats a 404 loop. */
const RESERVED = new Set([
  "video", "videos", "category", "categories", "browse", "following", "search",
  "dashboard", "messages", "settings", "drops", "subscriptions", "clips",
  "about", "terms", "privacy", "login", "signup", "help", "support", "brands",
]);

function channelsPath(): string {
  return dataPath("channels.json");
}

function monitorPath(): string {
  return dataPath("watch", "monitor.json");
}

function assertWritable(): void {
  if (process.env.VERCEL || !mediaOnLocalDisk()) {
    throw new Error("the watchlist is stored on this machine; hosted builds cannot write it");
  }
}

function readRaw<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeAtomic(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2));
  renameSync(tmp, path);
}

/**
 * Clips actually sitting in the inbox, grouped by the live channel they came
 * from. The watcher tags every cut with `assetId: live_<slug>`, so this counts
 * records in `clips.json` instead of the watcher's per-session counter — a
 * restart clears the counter but never deletes a clip, and the UI must not
 * pretend the inbox is empty because the worker was restarted.
 */
export interface ChannelClips {
  count: number;
  lastAt: string | null;
  lastTrigger: string | null;
}

interface ClipRow {
  assetId?: string;
  createdAt?: string;
  segmentsJson?: string;
}

function triggerOf(segmentsJson: string | undefined): string | null {
  if (!segmentsJson) return null;
  try {
    const segs = JSON.parse(segmentsJson) as Array<{ trigger?: string }>;
    return segs?.[0]?.trigger ?? null;
  } catch {
    return null;
  }
}

export function clipCountsByChannel(): Record<string, ChannelClips> {
  const rows = readRaw<Record<string, ClipRow>>(dataPath("clips.json"), {});
  const out: Record<string, ChannelClips> = {};
  for (const row of Object.values(rows)) {
    const assetId = typeof row?.assetId === "string" ? row.assetId : "";
    if (!assetId.startsWith("live_")) continue;
    const slug = assetId.slice("live_".length);
    if (!slug) continue;
    const entry = out[slug] ?? { count: 0, lastAt: null, lastTrigger: null };
    entry.count += 1;
    const at = typeof row.createdAt === "string" ? row.createdAt : null;
    if (at && (!entry.lastAt || at > entry.lastAt)) {
      entry.lastAt = at;
      entry.lastTrigger = triggerOf(row.segmentsJson);
    }
    out[slug] = entry;
  }
  return out;
}

export function listChannels(): ChannelRecord[] {
  const all = readRaw<Record<string, ChannelRecord>>(channelsPath(), {});
  return Object.values(all)
    .filter((c) => c && typeof c.slug === "string")
    .sort((a, b) => (a.addedAt < b.addedAt ? -1 : 1));
}

/**
 * Accepts `https://kick.com/deenthegreat`, `kick.com/deenthegreat`,
 * `kick.com/deenthegreat?…`, `@deenthegreat`, or `deenthegreat`.
 */
export function parseKickInput(raw: string):
  | { ok: true; slug: string }
  | { ok: false; error: string } {
  const input = (raw || "").trim();
  if (!input) return { ok: false, error: "Enter a Kick channel URL or handle." };
  if (input.length > 300) return { ok: false, error: "That input is too long to be a channel URL." };

  let candidate = input;
  const looksLikeUrl = /^https?:\/\//i.test(input) || /^(www\.)?kick\.com\//i.test(input);
  if (looksLikeUrl) {
    let url: URL;
    try {
      url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    } catch {
      return { ok: false, error: "That URL could not be parsed." };
    }
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== "kick.com") return { ok: false, error: "Only kick.com channel URLs are supported." };
    candidate = url.pathname.split("/").filter(Boolean)[0] || "";
  }

  candidate = candidate.replace(/^@/, "").trim().toLowerCase();
  if (!candidate) return { ok: false, error: "No channel name found in that URL." };
  if (RESERVED.has(candidate)) {
    return { ok: false, error: `"${candidate}" is a Kick page, not a channel.` };
  }
  if (!/^[a-z0-9_]{2,32}$/.test(candidate)) {
    return { ok: false, error: "A Kick handle is 2–32 letters, numbers, or underscores." };
  }
  return { ok: true, slug: candidate };
}

export function addChannel(
  raw: string,
  addedBy: string,
): { created: boolean; record: ChannelRecord } {
  assertWritable();
  const parsed = parseKickInput(raw);
  if (!parsed.ok) throw new Error(parsed.error);

  const all = readRaw<Record<string, ChannelRecord>>(channelsPath(), {});
  const existing = all[parsed.slug];
  if (existing) return { created: false, record: existing };

  const record: ChannelRecord = {
    slug: parsed.slug,
    displayName: parsed.slug,
    addedAt: new Date().toISOString(),
    addedBy,
    source: "app",
  };
  all[parsed.slug] = record;
  writeAtomic(channelsPath(), all);
  return { created: true, record };
}

export function removeChannel(slug: string): boolean {
  assertWritable();
  const key = (slug || "").trim().toLowerCase();
  if (!key) return false;
  const all = readRaw<Record<string, ChannelRecord>>(channelsPath(), {});
  if (!all[key]) return false;
  delete all[key];
  writeAtomic(channelsPath(), all);
  return true;
}

export function readMonitor(): MonitorSnapshot | null {
  const snap = readRaw<MonitorSnapshot | null>(monitorPath(), null);
  if (!snap || typeof snap !== "object" || !snap.channels) return null;
  return snap;
}

/** Seconds since the watcher last wrote its heartbeat, or null when it never has. */
export function monitorAgeSec(snap: MonitorSnapshot | null): number | null {
  if (!snap?.updatedAt) return null;
  const at = Date.parse(snap.updatedAt);
  if (!Number.isFinite(at)) return null;
  return Math.max(0, Math.round((Date.now() - at) / 1000));
}

/**
 * The watcher heartbeats every 10s. Anything older than 60s means the process
 * died or was stopped, so the UI must not claim it is running.
 */
export function monitorRunning(snap: MonitorSnapshot | null): boolean {
  if (!snap) return false;
  const age = monitorAgeSec(snap);
  return Boolean(snap.running) && age !== null && age <= 60;
}
