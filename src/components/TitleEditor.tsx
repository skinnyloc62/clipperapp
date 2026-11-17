"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TitleEditor({ clipId, initialTitle, hosted = false }: { clipId: string; initialTitle: string | null; hosted?: boolean }) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle || "");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true); setError(""); setNotice("");
    try {
      const res = await fetch("/api/studio/title", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clipId, title }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not save title.");
      setNotice(body.rebuilding ? "Saved. The Mac is rebuilding the video with this opening title." : "Title saved for the opening video hook.");
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save title."); }
    finally { setBusy(false); }
  }
  return <div className="mt-3 flex flex-wrap gap-2">
    <input id={`clip-title-${clipId}`} aria-label="Clip title" className="min-w-0 flex-1 rounded-lg border border-white/20 bg-[#151519] p-2 text-sm"
      value={title} maxLength={100} onChange={e => setTitle(e.target.value)} placeholder="Write a true, scroll-stopping title" />
    <button type="button" className="btn" disabled={busy || !title.trim()} onClick={() => void save()}>{hosted ? "Save title & rebuild" : "Save on-video title"}</button>
    <p className="w-full text-xs text-[var(--muted)]">The title appears for the first 3.5 seconds of the finished video. Save before approving.</p>
    {notice && <p role="status" className="w-full text-xs text-emerald-400">{notice}</p>}
    {error && <p role="alert" className="w-full text-xs text-red-400">{error}</p>}
  </div>;
}
