"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TitleEditor({ clipId, initialTitle }: { clipId: string; initialTitle: string | null }) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/studio/title", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clipId, title }) });
      if (!res.ok) throw new Error("Could not save title.");
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save title."); }
    finally { setBusy(false); }
  }
  return <div className="mt-3 flex flex-wrap gap-2">
    <input aria-label="Clip title" className="min-w-0 flex-1 rounded-lg border border-white/20 bg-[#151519] p-2 text-sm"
      value={title} maxLength={100} onChange={e => setTitle(e.target.value)} placeholder="Write a true, scroll-stopping title" />
    <button type="button" className="btn" disabled={busy || !title.trim()} onClick={() => void save()}>Save title</button>
    {error && <p role="alert" className="w-full text-xs text-red-400">{error}</p>}
  </div>;
}
