"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import EmptyState from "@/components/EmptyState";
import Icon from "@/components/Icon";

/* Live watchlist UI. Everything below is read from the watcher process and the
   app's own channels.json — no sample rows, no invented viewers. If the file is
   missing the list is honestly empty, and if the heartbeat is stale the board
   says the worker is stopped instead of showing a green light. */

interface Monitor {
  slug: string;
  live: boolean;
  viewers: number | null;
  title: string | null;
  category: string | null;
  followers?: number | null;
  streamStartedAt?: string | null;
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

interface Channel {
  slug: string;
  displayName: string;
  addedAt: string;
  addedBy: string;
  source: string;
  monitor: Monitor | null;
  /** Real cuts for this channel, counted from clips.json (survives restarts). */
  clips: { count: number; lastAt: string | null; lastTrigger: string | null };
}

interface Worker {
  running: boolean;
  ageSec: number | null;
  pid: number | null;
  startedAt: string | null;
  updatedAt: string | null;
  live: number;
  recording: number;
}

export interface RadarInitial {
  channels: Channel[];
  worker: Worker;
}

const viewers = new Intl.NumberFormat("en-US");

function fmtClock(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "0s";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  if (m <= 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function fmtDb(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(1)} dB`;
}

function fmtAge(iso: string | null): string {
  if (!iso) return "never";
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return "never";
  const sec = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  return `${Math.round(min / 60)}h ago`;
}

function Scope({ active }: { active: boolean }) {
  return (
    <div
      className="relative mx-auto h-[132px] w-[132px] shrink-0 sm:h-[150px] sm:w-[150px]"
      aria-hidden="true"
    >
      <div className="absolute inset-0 rounded-full border border-[var(--line-2)] bg-[radial-gradient(circle_at_50%_50%,rgba(225,6,0,0.06),rgba(0,0,0,0.25))]" />
      <div className="absolute inset-[13%] rounded-full border border-[var(--line)]" />
      <div className="absolute inset-[31%] rounded-full border border-[var(--line)]" />
      <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/[0.055]" />
      <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/[0.055]" />
      {active ? <div className="radar-sweep" /> : null}
      <span className="absolute left-1/2 top-1/2 h-[3px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--faint)]" />
    </div>
  );
}

function Stat({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: string }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="num mt-1 text-[20px] leading-none" style={tone ? { color: tone } : undefined}>
        {value}
      </dd>
      {note ? <p className="mt-1 truncate text-[11px] text-[var(--faint)]">{note}</p> : null}
    </div>
  );
}

function Dot({ live }: { live: boolean }) {
  if (!live) return <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-white/20" aria-hidden="true" />;
  return (
    <span className="relative flex h-[7px] w-[7px] shrink-0" aria-hidden="true">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#3ddc97] opacity-60" />
      <span className="relative inline-flex h-[7px] w-[7px] rounded-full bg-[#3ddc97]" />
    </span>
  );
}

function ChannelRow({
  channel,
  workerRunning,
  onRemove,
  removing,
}: {
  channel: Channel;
  workerRunning: boolean;
  onRemove: (slug: string) => void;
  removing: boolean;
}) {
  const m = channel.monitor;
  const live = Boolean(m?.live);
  const delta =
    m && m.rmsDb !== null && m.baselineDb !== null ? m.rmsDb - m.baselineDb : null;

  return (
    <li className="panel-3d overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Dot live={live} />
            <h3 className="truncate text-[14px] font-semibold text-[var(--text)]">{channel.displayName}</h3>
            <a
              href={`https://kick.com/${channel.slug}`}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-[11.5px] text-[var(--faint)] underline decoration-white/20 underline-offset-2 hover:text-[var(--muted)]"
            >
              /{channel.slug}
            </a>
          </div>
          <p className="mt-1.5 line-clamp-2 max-w-[62ch] text-[12.5px] leading-snug text-[var(--muted)]">
            {m?.title || (m ? "No stream title reported." : "Not polled yet — the watcher has not seen this channel.")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {live ? (
            <span className="chip chip-live">
              {m?.viewers !== null && m?.viewers !== undefined ? `${viewers.format(m.viewers)} watching` : "live"}
            </span>
          ) : (
            <span className="chip">offline</span>
          )}
          {m?.recording ? <span className="chip chip-red">recording</span> : null}
          <button
            type="button"
            onClick={() => onRemove(channel.slug)}
            disabled={removing}
            className="btn btn-quiet !h-7 !px-2 !text-[11.5px]"
            aria-label={`Stop watching ${channel.slug}`}
            title="Remove from watchlist"
          >
            <Icon name="close" size={12} /> {removing ? "Removing…" : "Remove"}
          </button>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-px bg-white/[0.05] sm:grid-cols-5">
        <div className="bg-[var(--panel)] px-4 py-3">
          <dt className="label">Category</dt>
          <dd className="mt-1 truncate text-[12.5px] text-[var(--text)]">{m?.category || "—"}</dd>
        </div>
        <div className="bg-[var(--panel)] px-4 py-3">
          <dt className="label">Buffered</dt>
          <dd className="num mt-1 text-[12.5px] text-[var(--text)]">
            {m ? fmtClock(m.bufferedSec) : "—"}
            <span className="ml-1.5 text-[11px] text-[var(--faint)]">{m ? `${m.segmentCount} seg` : ""}</span>
          </dd>
        </div>
        <div className="bg-[var(--panel)] px-4 py-3">
          <dt className="label">Signal</dt>
          <dd className="num mt-1 text-[12.5px] text-[var(--text)]">
            {fmtDb(m?.rmsDb ?? null)}
            <span className="ml-1.5 text-[11px] text-[var(--faint)]">
              {delta === null ? "no baseline" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)} vs base`}
            </span>
          </dd>
        </div>
        <div className="bg-[var(--panel)] px-4 py-3">
          <dt className="label">Spikes · this run</dt>
          <dd className="num mt-1 text-[12.5px] text-[var(--text)]">
            {m?.spikes ?? 0}
            <span className="ml-1.5 text-[11px] text-[var(--faint)]">
              {m?.fallbackCuts ? `${m.fallbackCuts} fallback` : "no fallback"}
            </span>
          </dd>
        </div>
        <div className="bg-[var(--panel)] px-4 py-3">
          <dt className="label">Clips</dt>
          <dd className="num mt-1 text-[12.5px] text-[var(--text)]">
            {channel.clips.count}
            <span className="ml-1.5 text-[11px] text-[var(--faint)]">
              {channel.clips.count ? fmtAge(channel.clips.lastAt) : "none yet"}
            </span>
          </dd>
        </div>
      </dl>

      {m?.lastError ? (
        <p className="border-t border-[var(--line)] bg-[rgba(225,6,0,0.06)] px-4 py-2 text-[11.5px] leading-relaxed text-[#ff8b84] sm:px-5">
          Last error: {m.lastError}
        </p>
      ) : null}

      {!workerRunning ? (
        <p className="border-t border-[var(--line)] px-4 py-2 text-[11.5px] leading-relaxed text-[var(--faint)] sm:px-5">
          Watcher stopped — this row is the last thing it wrote, not a live reading.
        </p>
      ) : null}
    </li>
  );
}

export default function RadarBoard({ initial }: { initial: RadarInitial }) {
  const [channels, setChannels] = useState<Channel[]>(initial.channels);
  const [worker, setWorker] = useState<Worker>(initial.worker);
  const [input, setInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [removingSlug, setRemovingSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [syncedAt, setSyncedAt] = useState<number>(() => Date.now());
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/radar/channels", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as RadarInitial;
      if (!mounted.current) return;
      setChannels(data.channels);
      setWorker(data.worker);
      setSyncedAt(Date.now());
    } catch {
      /* a dropped poll is not worth an error banner — the next one is 10s away */
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const id = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 10_000);
    return () => {
      mounted.current = false;
      window.clearInterval(id);
    };
  }, [refresh]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (adding) return;
    const value = input.trim();
    if (!value) {
      setError("Paste a Kick channel URL or type the handle.");
      return;
    }
    setAdding(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/radar/channels", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channel: value }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        created?: boolean;
        channel?: Channel;
      };
      if (!res.ok) {
        setError(data.error || `Could not add that channel (HTTP ${res.status}).`);
      } else {
        setInput("");
        setNotice(
          data.created
            ? `Added /${data.channel?.slug ?? value}. The watcher picks it up within 15 seconds.`
            : `/${data.channel?.slug ?? value} was already on the watchlist.`,
        );
        await refresh();
      }
    } catch {
      setError("The app could not reach its own API. Check that the window is still loading.");
    } finally {
      setAdding(false);
    }
  }

  async function remove(slug: string) {
    setRemovingSlug(slug);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/radar/channels?slug=${encodeURIComponent(slug)}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) setError(data.error || `Could not remove /${slug} (HTTP ${res.status}).`);
      else setNotice(`Removed /${slug}. Recording stops on the next poll.`);
      await refresh();
    } catch {
      setError("The app could not reach its own API.");
    } finally {
      setRemovingSlug(null);
    }
  }

  const liveCount = channels.filter((c) => c.monitor?.live).length;
  const clipCount = channels.reduce((n, c) => n + (c.clips?.count ?? 0), 0);
  const sweepActive = worker.running && liveCount > 0;

  return (
    <div className="mt-7 space-y-9">
      <section className="panel-3d overflow-hidden" aria-label="Watcher summary">
        <div className="grid items-center gap-6 px-5 py-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:px-7 sm:py-6">
          <Scope active={sweepActive} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[15px] font-semibold text-[var(--text)]">
                {worker.running ? "Watcher is running" : "Watcher is not running"}
              </h2>
              {worker.running ? (
                <span className="chip chip-live">heartbeat {worker.ageSec === null ? "—" : `${worker.ageSec}s`} ago</span>
              ) : (
                <span className="chip chip-warn">no heartbeat</span>
              )}
              {worker.pid ? <span className="chip">pid {worker.pid}</span> : null}
            </div>
            <p className="mt-2 max-w-[62ch] text-[13px] leading-relaxed text-[var(--muted)]">
              {worker.running
                ? "The watcher reads this watchlist every 15 seconds, records the live stream in 4-second segments, and cuts a clip only when the audio holds a jump above the stream's own baseline. One loud stretch makes one clip. Everything below is read from the files it writes."
                : "The watcher process is not writing a heartbeat, so nothing is being recorded. Start it from the project folder — the last values stay visible but are marked as stale."}
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--line)] pt-4 sm:grid-cols-4">
              <Stat label="Channels" value={String(channels.length)} note={channels.length ? "on the watchlist" : "nothing to watch"} />
              <Stat label="Live now" value={String(liveCount)} note={liveCount ? "streaming" : "none streaming"} tone={liveCount ? "#62e6ae" : undefined} />
              <Stat label="Recording" value={String(worker.recording)} note="segments buffering" />
              <Stat label="Clips cut" value={String(clipCount)} note={clipCount ? "in the clip inbox" : "none yet"} />
            </dl>
            <p className="mt-3 text-[11px] text-[var(--faint)]">Synced {fmtAge(new Date(syncedAt).toISOString())} · refreshes every 10s</p>
          </div>
        </div>
      </section>

      <section className="card p-5" aria-labelledby="add-source-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="add-source-heading" className="text-[13.5px] font-semibold text-[var(--text)]">
            Add a Kick channel
          </h2>
          <span className="chip">writes channels.json</span>
        </div>
        <p className="mt-2 max-w-[70ch] text-[12.5px] leading-relaxed text-[var(--muted)]">
          Paste the channel URL straight from Kick, or type the handle. The watcher re-reads the list on its
          next poll, so a new channel starts recording without restarting anything.
        </p>
        <form onSubmit={add} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block min-w-0 flex-1">
            <span className="label mb-1.5 block">Channel URL or handle</span>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="https://kick.com/deenthegreat"
              spellCheck={false}
              autoComplete="off"
              className="field"
              aria-describedby="add-source-hint"
            />
          </label>
          <button type="submit" disabled={adding} className="btn btn-primary sm:w-auto">
            <Icon name="radar" size={15} /> {adding ? "Adding…" : "Start monitoring"}
          </button>
        </form>
        <p id="add-source-hint" className="mt-3 text-[11px] leading-relaxed text-[var(--faint)]">
          Accepted: <span className="num">kick.com/slug</span>, a full <span className="num">https://</span> URL, a{" "}
          <span className="num">@handle</span>, or the bare handle. Pages like <span className="num">/browse</span> are rejected.
        </p>
        {error ? (
          <p role="alert" className="mt-3 rounded-md border border-[rgba(225,6,0,0.35)] bg-[rgba(225,6,0,0.08)] px-3 py-2 text-[12px] leading-relaxed text-[#ff9a94]">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="mt-3 rounded-md border border-[rgba(61,220,151,0.3)] bg-[rgba(61,220,151,0.07)] px-3 py-2 text-[12px] leading-relaxed text-[#7fe9bd]">
            {notice}
          </p>
        ) : null}
      </section>

      <section aria-labelledby="monitored-heading">
        <div className="mb-3.5 flex items-end justify-between gap-4">
          <div>
            <h2 id="monitored-heading" className="sec-head text-[13px]">
              Monitored channels
              <span className="num ml-1 rounded-md border border-white/10 px-1.5 py-0.5 text-[10.5px] text-[var(--muted)]">
                {channels.length}
              </span>
            </h2>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-[var(--faint)]">
              Live status, buffer depth, and audio level — all from the watcher's own heartbeat.
            </p>
          </div>
        </div>

        {channels.length === 0 ? (
          <EmptyState
            icon="radar"
            title="No channels on the watchlist"
            body="Add a Kick channel above and it appears here within one poll. Each row then shows whether the channel is live, how many seconds are buffered, the current audio level against its baseline, and every clip the detector has cut."
            note="Empty because nothing is watched — not a loading state"
          />
        ) : (
          <ul className="space-y-3">
            {channels.map((c) => (
              <ChannelRow
                key={c.slug}
                channel={c}
                workerRunning={worker.running}
                onRemove={remove}
                removing={removingSlug === c.slug}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
