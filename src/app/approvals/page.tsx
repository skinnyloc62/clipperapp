import { redirect } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import ClipDecision from "@/components/ClipDecision";
import TitleEditor from "@/components/TitleEditor";
import { requireUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  if (!process.env.VERCEL) redirect("/clips");
  const user = await requireUser();
  if (user instanceof Response) redirect("/login");
  const clips = await getPrisma().clipProject.findMany({
    where: { userId: user.userId, status: { in: ["pending", "cut"] }, assetId: { not: null } },
    include: { renderJobs: true, asset: true, transcripts: true }, orderBy: { createdAt: "desc" }, take: 40,
  });
  return <div><PageHeader kicker="Review queue" title="Approve or deny"
    description="Watch the finished edit, fix its title, then approve to keep it. Denied clips leave this queue. Processing needs the Mac online."
    meta={<span className="chip">{clips.length} waiting</span>} />
    {clips.length === 0 ? <div className="card mt-7 p-6 text-sm text-[var(--muted)]">No clips waiting for review. Use Editor to upload a video and mark a moment.</div> :
      <div className="mt-7 grid gap-5 md:grid-cols-2">{clips.map(clip => {
        const render = clip.renderJobs.find(r => r.status === "done" && r.renderUrl);
        const work = clip.renderJobs[0];
        const transcript = clip.transcripts.find(t => t.source === "whisper-local");
        return <article className="card p-4" key={clip.id}>
          {render?.renderUrl ? <video className="mx-auto max-h-[500px] w-full rounded-lg bg-black" controls playsInline preload="metadata" src={render.renderUrl} /> :
            <div className="rounded-lg bg-black/40 p-8 text-center text-sm text-[var(--muted)]">{work?.status === "failed" ? "Processing failed. See the job log." : "Waiting for the Mac to finish this edit."}</div>}
          <h2 className="mt-4 font-semibold">{clip.title || clip.asset?.filename || "Untitled clip"}</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">{clip.startSec.toFixed(1)}–{clip.endSec.toFixed(1)}s · {work?.status || "queued"} · captions {work?.captionsApplied ? "applied; review accuracy" : transcript?.text ? "transcribed, not applied" : "not available"}</p>
          {work?.status === "failed" && <p className="mt-2 text-xs text-red-400">This render failed. The source is still saved; try another range.</p>}
          <TitleEditor clipId={clip.id} initialTitle={clip.title} />
          <div className="mt-3"><ClipDecision clipId={clip.id} status={clip.status} ready={Boolean(render)} /></div>
        </article>;
      })}</div>}
    <p className="mt-6 text-xs text-[var(--muted)]">What is real on this screen: rows are submitted edits, previews are completed Blob renders, and transcript status comes from saved worker output. Deny hides a clip from this queue; it does not erase the source upload.</p>
  </div>;
}
