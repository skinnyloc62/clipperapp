"use client";

import { useState } from "react";

export default function MarkLiveMoment({ channel }: { channel: string }) {
  const [at, setAt] = useState("");
  const [mode, setMode] = useState<"elapsed" | "local">("elapsed");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  async function mark(time: string, timeMode = mode) {
    setBusy(true);
    setResult("Waiting for the 28 seconds after this moment, then cutting…");
    try {
      const res = await fetch("/api/live/mark", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ channel, at: time, mode: timeMode }),
      });
      const body = await res.json();
      setResult(res.ok
        ? `Saved ${body.clipId} · ${Math.round(body.durationSec)}s. Review it in Clip Inbox before publishing.`
        : body.error || `Cut failed (HTTP ${res.status})`);
    } catch { setResult("Could not reach the local clip engine."); }
    finally { setBusy(false); }
  }
  return <section className="card mt-7 p-5">
    <h2 className="text-base font-semibold">Mark a live moment</h2>
    <p className="mt-1 text-sm text-[var(--muted)]">
      Saw something good on {channel}? Enter the stream player’s elapsed time or your Mac’s local time
      while it is still in the four minute buffer.
      The cut includes 12 seconds before and 28 seconds after your mark.
    </p>
    <form className="mt-4 flex flex-wrap gap-3" onSubmit={(e) => {
      e.preventDefault();
      void mark(at);
    }}>
      <label className="sr-only" htmlFor="mark-mode">Timestamp type</label>
      <select id="mark-mode" className="input" value={mode} onChange={(e) => setMode(e.target.value as "elapsed" | "local")}>
        <option value="elapsed">Stream time</option><option value="local">Mac clock</option>
      </select>
      <label className="sr-only" htmlFor="mark-time">Time H:MM:SS</label>
      <input id="mark-time" className="input" required pattern="[0-9]{1,3}:[0-9]{2}:[0-9]{2}"
        placeholder={mode === "elapsed" ? "4:04:23" : "02:04:23"} value={at} onChange={(e) => setAt(e.target.value)} />
      <button className="btn btn-primary" disabled={busy} type="submit">Cut at time</button>
      <button className="btn" disabled={busy} type="button" onClick={() => void mark(new Date().toLocaleTimeString("en-GB", { hour12: false }), "local")}>
        Mark now
      </button>
    </form>
    {result ? <p className="mt-3 text-sm" role="status">{result}</p> : null}
  </section>;
}
