import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import PipelinePanel from "@/components/PipelinePanel";
import Icon from "@/components/Icon";
import { MAX_CLIP_SEC, MAX_UPLOAD_MB } from "@/lib/validators";

/* Stage 03 — Cut. Hosts the real pipeline driver: upload → validate → cut →
   render → download, each step posting to the same routes the contract tests
   exercise. Limits are read here (server side) so the client component never
   imports the validator module, which pulls zod and server env into the bundle. */

export default function EditorPage() {
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
            <span className="chip">captions not wired</span>
          </>
        }
      />

      <PipelinePanel maxClipSec={MAX_CLIP_SEC} maxUploadMb={MAX_UPLOAD_MB} />
    </div>
  );
}
