import { redirect } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import ClipDecision from "@/components/ClipDecision";
import { authBypassActive, getSession } from "@/lib/auth";
import { devClips, devRenders } from "@/lib/clips";
import { mediaUsesPrisma } from "@/lib/storage-mode";

export const dynamic = "force-dynamic";
type Row = { id: string; status: string; date: Date; channel: string; trigger: string; title: string | null; renderId: string | null };
function source(json: string | null): { channel?: string; trigger?: string } {
  try {
    const parsed = JSON.parse(json || "[]");
    return (Array.isArray(parsed) ? parsed[0] : parsed) || {};
  } catch { return {}; }
}
async function rows(): Promise<Row[]> {
  if (mediaUsesPrisma()) {
    const { getPrisma } = await import("@/lib/db");
    const clips = await getPrisma().clipProject.findMany({
      where: { userId: "household", status: "approved" },
      include: { renderJobs: true, transcripts: true }, orderBy: { createdAt: "desc" },
    });
    return clips.map((clip) => {
      const p = source(clip.transcripts.find((t) => t.source === "kick-live")?.segmentsJson ?? null);
      return { id: clip.id, status: clip.status, date: clip.createdAt, title: clip.title,
        channel: p.channel || "source video", trigger: p.trigger || "owner selected",
        renderId: clip.renderJobs.find((r) => r.status === "done" && r.renderUrl)?.id ?? null };
    });
  }
  if (process.env.VERCEL) return [];
  const renders = devRenders.list("household");
  return devClips.list("household").map((clip) => {
    const p = source(clip.segmentsJson);
    return { id: clip.clipId, status: clip.status, date: new Date(clip.createdAt), title: null,
      channel: p.channel || "source video", trigger: p.trigger || "owner selected",
      renderId: renders.find((r) => r.clipId === clip.clipId && r.status === "done")?.renderId ?? null };
  });
}
export default async function ClipsPage() {
  if (!authBypassActive() && !(await getSession()).userId) redirect("/login");
  const clips = await rows();
  const hosted = Boolean(process.env.VERCEL);
  return <div>
    <PageHeader kicker={hosted ? "Published clips" : "Local clip inbox"}
      title={hosted ? "Clips to watch" : "Clip Inbox"}
      description={hosted ? "Videos approved and published from the Mac." : "Real cuts saved by the local watcher."}
      meta={<span className="chip">{clips.length} {hosted ? "published" : "local"} clips</span>} />
    {clips.length === 0 ? <div className="card mt-7 p-6">
      <h2 className="text-lg font-semibold">{hosted ? "No published clips yet" : "No local clips yet"}</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">{hosted ? "Clips appear after the owner reviews and publishes a local cut." : "Live cuts and manual timestamp clips appear here when saved on this Mac."}</p>
    </div> : <div className="mt-7 grid gap-5 md:grid-cols-2">{clips.map((clip) =>
      <article className="card overflow-hidden p-4" key={clip.id}>
        {clip.renderId
          ? <video className="mx-auto max-h-[520px] w-full rounded-lg bg-black" controls preload="metadata"
              playsInline src={hosted ? `/api/downloads/${clip.renderId}` : `/api/previews/${clip.renderId}`} />
          : <div className="rounded-lg bg-black/40 p-8 text-center text-sm text-[var(--muted)]">
              Render unavailable
            </div>}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div><h2 className="font-semibold">{clip.title || clip.channel}</h2>
            <p className="text-xs text-[var(--muted)]">
              {clip.date.toLocaleString("en-US")} · {clip.trigger} · {clip.status}
            </p></div>
          <div className="flex flex-wrap items-center gap-2">
            {!hosted && <ClipDecision clipId={clip.id} status={clip.status} />}
            {clip.renderId && clip.status === "approved"
              ? <a className="btn" href={`/api/downloads/${clip.renderId}`}>Download</a> : null}
          </div>
        </div>
      </article>)}</div>}
    <p className="mt-6 text-xs text-[var(--muted)]">
      What is real on this screen: every listed clip comes from a saved local cut or a published database row.
      There are no sample clips or predicted viral scores.
    </p>
  </div>;
}
