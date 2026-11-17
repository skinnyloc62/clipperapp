"use client";

import { upload } from "@vercel/blob/client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Asset = { id: string; filename: string; url: string; bytes: number; createdAt: string };
type Job = { id: string; title: string | null; status: string; renderStatus: string; startSec: number; endSec: number };
type ScoutCandidate = { startSec: number; endSec: number; origin: string; status: string;
  note: string; transcript: string | null; visualEvidence: { atSec: number; text: string } | null;
  assessment: { hook: string; payoff: string; editorialPotential: number; recommendedAction: string } | null };
type ScoutReport = { overallStatus: string; candidates: ScoutCandidate[] };
type ScoutJob = { id: string; assetId: string; status: string; markSec: number | null; reportJson: string | null; error: string | null };

function parseTimeMark(raw: string): number | undefined {
  const value = raw.trim();
  if (!value) return undefined;
  if (/^\d+(?:\.\d+)?$/.test(value)) return Number(value);
  const parts = value.split(":");
  if (parts.length < 2 || parts.length > 3 || parts.some(x => !/^\d+$/.test(x))) throw new Error("Use seconds, MM:SS, or HH:MM:SS for the mark.");
  const nums = parts.map(Number);
  if (nums.at(-1)! >= 60 || (parts.length === 3 && nums[1] >= 60)) throw new Error("Minutes and seconds must be under 60.");
  return parts.length === 2 ? nums[0] * 60 + nums[1] : nums[0] * 3600 + nums[1] * 60 + nums[2];
}
function stamp(sec: number): string {
  const n = Math.floor(sec);
  return `${Math.floor(n / 3600)}:${String(Math.floor(n / 60) % 60).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
}
function parseReport(json: string | null): ScoutReport | null {
  if (!json) return null;
  try {
    const report = JSON.parse(json);
    return Array.isArray(report?.candidates) ? report as ScoutReport : null;
  } catch { return null; }
}

async function post<T>(path: string, data: unknown): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : `Request failed (${res.status})`);
  return body as T;
}

export default function HostedEditor({ assets, jobs, scouts }: { assets: Asset[]; jobs: Job[]; scouts: ScoutJob[] }) {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const [chosen, setChosen] = useState<Asset | null>(assets[0] || null);
  const [start, setStart] = useState("0");
  const [end, setEnd] = useState("40");
  const [duration, setDuration] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [captions, setCaptions] = useState(true);
  const [music, setMusic] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [scoutMark, setScoutMark] = useState("");
  const [scoutBusy, setScoutBusy] = useState(false);
  const chosenScouts = scouts.filter(s => s.assetId === chosen?.id);
  const latestScout = chosenScouts[0];
  const scoutReport = parseReport(latestScout?.reportJson || null);

  useEffect(() => {
    if (!scouts.some(s => s.status === "queued" || s.status === "running")) return;
    const timer = setInterval(() => router.refresh(), 8000);
    return () => clearInterval(timer);
  }, [router, scouts]);

  async function uploadFile(file: File, kind: "video" | "music") {
    if (!file.type.startsWith(kind === "video" ? "video/" : "audio/")) throw new Error(`Choose a ${kind} file with a recognized media type.`);
    const intent = await post<{ assetId: string; pathname: string }>("/api/studio/intent", {
      filename: file.name, contentType: file.type, size: file.size, kind,
    });
    const blob = await upload(intent.pathname, file, {
      access: "public", contentType: file.type, multipart: true,
      handleUploadUrl: "/api/studio/blob", clientPayload: JSON.stringify({ assetId: intent.assetId }),
      onUploadProgress: ({ percentage }) => setProgress(`${kind} upload ${Math.round(percentage)}%`),
    });
    await post("/api/studio/complete", { assetId: intent.assetId, url: blob.url });
    return { id: intent.assetId, url: blob.url, filename: file.name, bytes: file.size,
      createdAt: new Date().toISOString() };
  }

  async function addVideo(file: File | null) {
    if (!file) return;
    setBusy(true); setError(""); setProgress("Preparing upload…");
    try {
      const asset = await uploadFile(file, "video");
      setChosen(asset); setDuration(null); setStart("0"); setEnd("40");
      setProgress("Video saved. Choose the moment below.");
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Upload failed."); }
    finally { setBusy(false); }
  }

  async function queue() {
    if (!chosen) return;
    const first = Number(start), last = Number(end);
    if (!Number.isFinite(first) || !Number.isFinite(last) || first < 0 || last <= first || last - first > 60 || (duration != null && last > duration + 0.1)) {
      setError("Choose a start and end inside the video, with a clip length of 60 seconds or less."); return;
    }
    setBusy(true); setError(""); setProgress("Saving clip request…");
    try {
      let musicAssetId: string | undefined;
      if (music) musicAssetId = (await uploadFile(music, "music")).id;
      await post("/api/studio/submit", { assetId: chosen.id, startSec: first, endSec: last,
        title: title.trim() || undefined, captionsEnabled: captions, musicAssetId });
      setProgress("Queued. Open Approvals when processing finishes.");
      setMusic(null); setTitle(""); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not queue the clip."); }
    finally { setBusy(false); }
  }

  async function queueScout() {
    if (!chosen) return;
    setScoutBusy(true); setError(""); setProgress("Queuing video scout…");
    try {
      const markSec = parseTimeMark(scoutMark);
      if (markSec != null && duration != null && markSec >= duration) throw new Error("The mark is outside this video.");
      await post("/api/studio/scout", { assetId: chosen.id, ...(markSec == null ? {} : { markSec }) });
      setProgress("Scout queued. The Mac will scan it while online.");
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not queue scout."); }
    finally { setScoutBusy(false); }
  }

  return <div className="space-y-7">
    <section className="card space-y-4 p-5">
      <h2 className="font-semibold">1. Add a long video</h2>
      <p className="text-sm text-[var(--muted)]">Upload a video up to 1 GB directly from your device. You can make several clips from one upload.</p>
      <input aria-label="Upload video" type="file" accept="video/*" disabled={busy}
        onChange={e => void addVideo(e.target.files?.[0] || null)} className="block w-full text-sm" />
      {assets.length > 0 && <label className="block text-sm">Or use a saved upload
        <select className="mt-2 w-full rounded-lg border border-white/20 bg-[#151519] p-2" value={chosen?.id || ""}
          onChange={e => { setChosen(assets.find(a => a.id === e.target.value) || null); setDuration(null); }}>
          {assets.map(a => <option key={a.id} value={a.id}>{a.filename} · {(a.bytes / 1048576).toFixed(1)} MB</option>)}
        </select></label>}
    </section>

    {chosen && <section className="card space-y-4 p-5">
      <h2 className="font-semibold">2. Find moments (optional)</h2>
      <p className="text-sm text-[var(--muted)]">Scan real audio and sampled frames for reviewable moments. Scores are editorial potential, never a viral percentage. Weak evidence gets no score.</p>
      <label className="block text-sm">Moment you noticed (optional)
        <input className="mt-1 w-full rounded-lg border border-white/20 bg-[#151519] p-2" value={scoutMark}
          onChange={e => setScoutMark(e.target.value)} placeholder="4:04:23, 04:23, or seconds" />
      </label>
      <button type="button" className="btn" disabled={busy || scoutBusy} onClick={() => void queueScout()}>Scout this video</button>
      {latestScout && <div className="space-y-3 border-t border-white/10 pt-4 text-sm">
        <p className="font-medium">Latest scout: {latestScout.status}{latestScout.markSec != null ? ` · marked ${stamp(latestScout.markSec)}` : ""}</p>
        {latestScout.error && <p className="text-red-400">{latestScout.error}</p>}
        {scoutReport && <>
          {scoutReport.overallStatus !== "review_candidates" && <p className="text-[var(--muted)]">No strong verified moment found. You can add a time mark or choose a range yourself.</p>}
          {scoutReport.candidates.map((c, i) => <div key={`${c.startSec}-${i}`} className="rounded-lg border border-white/10 p-3">
            <p className="font-medium">{stamp(c.startSec)}–{stamp(c.endSec)} · {c.origin} · {c.assessment ? `${c.assessment.editorialPotential}/100 editorial potential` : "No verified score"}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{c.note}</p>
            {c.assessment && <p className="mt-2 text-xs">Hook: “{c.assessment.hook}” · payoff: “{c.assessment.payoff}”</p>}
            {c.visualEvidence?.text && <p className="mt-2 text-xs text-[var(--muted)]">Frame at {stamp(c.visualEvidence.atSec)}: {c.visualEvidence.text}</p>}
            <button type="button" className="btn mt-3" onClick={() => {
              setStart(String(c.startSec)); setEnd(String(c.endSec));
              if (c.assessment && !title) setTitle(c.assessment.hook.slice(0, 60));
            }}>Use this range</button>
          </div>)}
        </>}
      </div>}
    </section>}

    {chosen && <section className="card space-y-4 p-5">
      <h2 className="font-semibold">3. Pick the moment</h2>
      <video ref={video} key={chosen.id} src={chosen.url} controls playsInline preload="metadata"
        onLoadedMetadata={e => { const d = e.currentTarget.duration; if (Number.isFinite(d)) setDuration(d); }}
        className="max-h-[480px] w-full rounded-lg bg-black" />
      <p className="text-xs text-[var(--muted)]">{duration != null ? `Video length: ${duration.toFixed(1)} seconds.` : "Waiting for video length."} Play or scrub, then mark the start and end.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Start (seconds)<input className="mt-1 w-full rounded-lg border border-white/20 bg-[#151519] p-2" type="number" min="0" step="0.1" value={start} onChange={e => setStart(e.target.value)} /></label>
        <label className="text-sm">End (seconds)<input className="mt-1 w-full rounded-lg border border-white/20 bg-[#151519] p-2" type="number" min="0" step="0.1" value={end} onChange={e => setEnd(e.target.value)} /></label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn" onClick={() => setStart((video.current?.currentTime || 0).toFixed(1))}>Use playhead as start</button>
        <button type="button" className="btn" onClick={() => setEnd((video.current?.currentTime || 0).toFixed(1))}>Use playhead as end</button>
      </div>
      <label className="block text-sm">Title (optional; you can edit the suggestion later)
        <input className="mt-1 w-full rounded-lg border border-white/20 bg-[#151519] p-2" value={title} maxLength={100}
          onChange={e => setTitle(e.target.value)} placeholder="Leave blank for a transcript-based suggestion" /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={captions} onChange={e => setCaptions(e.target.checked)} /> Add speech captions when clear words are detected</label>
      <label className="block text-sm">Music (optional; your own audio file, up to 25 MB)
        <input className="mt-2 block w-full" type="file" accept="audio/*" onChange={e => setMusic(e.target.files?.[0] || null)} />
      </label>
      <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void queue()}>Make clip</button>
    </section>}

    {progress && <p role="status" className="text-sm text-[var(--muted)]">{progress}</p>}
    {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
    <section className="card p-5"><h2 className="font-semibold">Recent edit jobs</h2>
      {jobs.length ? <ul className="mt-3 space-y-2 text-sm">{jobs.map(j => <li key={j.id} className="flex flex-wrap justify-between gap-2 border-t border-white/10 pt-2">
        <span>{j.title || `Clip ${j.startSec.toFixed(1)}–${j.endSec.toFixed(1)}s`}</span>
        <span className="text-[var(--muted)]">{j.renderStatus === "done" ? "Ready for review" : j.renderStatus}</span>
      </li>)}</ul> : <p className="mt-2 text-sm text-[var(--muted)]">No edit jobs yet.</p>}
      <p className="mt-3 text-xs text-[var(--muted)]">The Mac processes queued jobs when it is online. Refresh to see updates.</p>
    </section>
  </div>;
}
