"use client";

import { useState } from "react";
import Icon from "./Icon";
import type { DemoStreamer } from "@/mocks/demo";

function alertTime(iso: string): string {
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  return m ? `${m[1]}:${m[2]}` : "—";
}

export default function StreamerCard({ streamer }: { streamer: DemoStreamer }) {
  const [watchlisted, setWatchlisted] = useState(false);
  return (
    <article className="card lift-3d flex flex-col p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-display truncate text-[15px] leading-tight text-[var(--text)]">
              {streamer.channel}
            </h3>
            {streamer.live ? <span className="pulse-dot" aria-hidden="true" /> : null}
          </div>
          <p className="mt-1 truncate text-[13px] text-[var(--muted)]">{streamer.title}</p>
        </div>
        <span className={"chip shrink-0 " + (streamer.live ? "chip-live" : "")}>
          {streamer.live ? "Live" : "Offline"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="label">{streamer.category}</span>
        <span aria-hidden="true" className="h-3 w-px bg-white/10" />
        <span className="num text-[12px] text-[var(--muted)]">
          {streamer.live ? `${streamer.viewers.toLocaleString("en-US")} viewers` : "— viewers"}
        </span>
      </div>

      <div className="mt-3.5 border-t border-[var(--line)] pt-3">
        {streamer.alerts.length > 0 ? (
          <ul className="space-y-1.5">
            {streamer.alerts.map((a) => (
              <li key={a.id} className="flex items-start gap-2 text-[12.5px] leading-snug text-[var(--muted)]">
                <span aria-hidden="true" className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-[var(--red)]" />
                <span className="min-w-0 flex-1">{a.label}</span>
                <span className="num shrink-0 text-[11px] text-[var(--faint)]">{alertTime(a.timeUtc)} UTC</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12.5px] text-[var(--faint)]">No alerts in this window.</p>
        )}
      </div>

      <div className="mt-auto flex items-center gap-2 pt-4">
        <button
          type="button"
          onClick={() => setWatchlisted((w) => !w)}
          aria-pressed={watchlisted}
          className="btn flex-1 !h-9 !px-3 !text-[12.5px]"
        >
          {watchlisted ? (
            <>
              <Icon name="check" size={14} /> Watchlisted
            </>
          ) : (
            "Watchlist"
          )}
        </button>
        <a
          href={streamer.channelUrl}
          target="_blank"
          rel="noreferrer"
          className="btn !h-9 !px-3 !text-[12.5px]"
          aria-label={`Open ${streamer.channel} on Kick (opens in a new tab)`}
        >
          Open <Icon name="external" size={13} />
        </a>
      </div>
    </article>
  );
}
