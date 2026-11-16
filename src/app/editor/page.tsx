import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import PipelinePanel from "@/components/PipelinePanel";
import HostedEditor from "@/components/HostedEditor";
import { requireUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import Icon from "@/components/Icon";
import { MAX_CLIP_SEC, MAX_UPLOAD_MB } from "@/lib/validators";

/* Stage 03 — Cut. Hosts the real pipeline driver: upload → validate → cut →
   render → download, each step posting to the same routes the contract tests
   exercise. Limits are read here (server side) so the client component never
   imports the validator module, which pulls zod and server env into the bundle. */

export const dynamic = "force-dynamic";

export default async function EditorPage() {
  if (process.env.VERCEL) {
    const user = await requireUser();
    if (user instanceof Response) return <p>Sign in to open the editor.</p>;
    const db = getPrisma();
    const [assets, clips] = await Promise.all([
      db.mediaAsset.findMany({ where: { userId: user.userId, mediaType: "video", status: { in: ["uploaded", "validated"] } },
        orderBy: { createdAt: "desc" }, take: 20 }),
      db.clipProject.findMany({ where: { userId: user.userId, assetId: { not: null } }, include: { renderJobs: true },
        orderBy: { createdAt: "desc" }, take: 30 }),
    ]);
    return <div className="space-y-7"><PageHeader kicker="Cloud studio" title="Editor"
      description="Upload a long video from a laptop or iPhone, mark a moment, and queue a vertical clip. Processing runs on the Mac when it is online."
      meta={<span className="chip">{clips.length} recent edit jobs</span>} />
      <HostedEditor assets={assets.filter(a => a.blobUrl).map(a => ({ id: a.id, filename: a.filename || "Video", url: a.blobUrl,
        bytes: a.bytes, createdAt: a.createdAt.toISOString() }))}
        jobs={clips.map(c => ({ id: c.id, title: c.title, status: c.status, renderStatus: c.renderJobs[0]?.status || "queued",
          startSec: c.startSec, endSec: c.endSec }))} />
    </div>;
  }
  return (
    <div className="space-y-7">
      <PageHeader
        kicker="Stage 03 · Cut"
        title="Editor"
        description="Take one source file through the real pipeline: store it, probe it, trim it, render a vertical master, then download the finished file."
        actions={
          <Link href="/clips" className="btn">
            <Icon name="inbox" size={15} /> Clip inbox
          </Link>
        }
        meta={
          <>
            <span className="chip chip-live">pipeline connected</span>
            <span className="chip">local disk storage</span>
            <span className="chip">captions at approval</span>
          </>
        }
      />

      <PipelinePanel maxClipSec={MAX_CLIP_SEC} maxUploadMb={MAX_UPLOAD_MB} />
    </div>
  );
}
