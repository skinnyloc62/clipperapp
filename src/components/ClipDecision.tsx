"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ClipDecision({ clipId, status }: { clipId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function decide(decision: "approved" | "rejected") {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/approvals", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ clipId, decision }),
      });
      if (!res.ok) throw new Error("Could not save decision. Please try again.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save decision.");
    } finally { setBusy(false); }
  }
  return <div className="flex flex-wrap items-center gap-2">
    {status !== "approved" && <button className="btn btn-primary" disabled={busy} onClick={() => decide("approved")}>Approve</button>}
    {status !== "rejected" && <button className="btn" disabled={busy} onClick={() => decide("rejected")}>Deny</button>}
    {error && <span role="alert" className="text-xs text-red-400">{error}</span>}
  </div>;
}
