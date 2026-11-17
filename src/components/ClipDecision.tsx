"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ClipDecision({ clipId, status, ready = true, local = false }: { clipId: string; status: string; ready?: boolean; local?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [music, setMusic] = useState<File | null>(null);
  const [captions, setCaptions] = useState(true);
  async function decide(decision: "approved" | "rejected") {
    setBusy(true);
    setError("");
    setWarning("");
    try {
      let res: Response;
      const typedTitle = (document.getElementById(`clip-title-${clipId}`) as HTMLInputElement | null)?.value.trim() || "";
      if (local && decision === "approved") {
        const form = new FormData();
        form.append("clipId", clipId);
        form.append("captions", String(captions));
        if (typedTitle) form.append("title", typedTitle);
        if (music) form.append("music", music);
        res = await fetch("/api/clips/enrich", { method: "POST", body: form });
      } else {
        if (!local && decision === "approved" && typedTitle) {
          const titleRes = await fetch("/api/studio/title", { method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ clipId, title: typedTitle }) });
          const titleBody = await titleRes.json().catch(() => ({}));
          if (!titleRes.ok) throw new Error(typeof titleBody.error === "string" ? titleBody.error : "Could not save the title.");
          if (titleBody.rebuilding) {
            setWarning("The Mac is rebuilding the video with your title. Approve it after the new preview is ready.");
            router.refresh();
            return;
          }
        }
        res = await fetch("/api/approvals", { method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ clipId, decision }) });
      }
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not save decision. Please try again.");
      if (body.warning) setWarning(body.warning);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save decision.");
    } finally { setBusy(false); }
  }
  return <div className="flex flex-wrap items-center gap-2">
    {local && status !== "approved" && <div className="w-full space-y-2 text-xs text-[var(--muted)]">
      <label className="flex items-center gap-2"><input type="checkbox" checked={captions} onChange={e => setCaptions(e.target.checked)} /> Add speech captions if clear words are detected</label>
      <label className="block">Music (optional, your audio file up to 25 MB)
        <input type="file" accept="audio/*" className="mt-1 block w-full" onChange={e => setMusic(e.target.files?.[0] || null)} />
      </label>
    </div>}
    {status !== "approved" && ready && <button className="btn btn-primary" disabled={busy} onClick={() => decide("approved")}>{busy ? "Finishing…" : "Approve"}</button>}
    {status !== "rejected" && <button className="btn" disabled={busy} onClick={() => decide("rejected")}>Deny</button>}
    {error && <span role="alert" className="w-full text-xs text-red-400">{error}</span>}
    {warning && <span role="status" className="w-full text-xs text-[var(--muted)]">{warning}</span>}
  </div>;
}
