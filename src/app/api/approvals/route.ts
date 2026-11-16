export const runtime = "nodejs";

import { requireUser } from "@/lib/auth";
import { approvalSchema } from "@/lib/validators";
import { devClips } from "@/lib/clips";
import { mediaUsesPrisma } from "@/lib/storage-mode";

/**
 * Owner approval gate. Only the owning user can approve/reject their clip.
 * A hosted approval makes a finished render visible in the Clips page and
 * downloadable. Electron approvals run through /api/clips/enrich first so
 * the requested finishing pass succeeds before the status changes.
 */
export async function POST(req: Request): Promise<Response> {
  const user = await requireUser();
  if (user instanceof Response) return user;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "expected JSON {clipId, decision}" }, { status: 400 });
  }
  const parsed = approvalSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { clipId, decision } = parsed.data;

  if (mediaUsesPrisma()) {
    const { getPrisma } = await import("@/lib/db");
    if (decision === "approved") {
      const ready = await getPrisma().renderJob.findFirst({ where: { clipProjectId: clipId, status: "done", renderUrl: { not: null }, clipProject: { userId: user.userId } } });
      if (!ready) return Response.json({ error: "Wait for a finished render before approving." }, { status: 409 });
    }
    const updated = await getPrisma().clipProject.updateMany({
      where: { id: clipId, userId: user.userId },
      data: { status: decision === "approved" ? "approved" : "rejected" },
    });
    if (updated.count === 0) return Response.json({ error: "unknown clip" }, { status: 404 });
    return Response.json({ clipId, status: decision === "approved" ? "approved" : "rejected" });
  }
  if (process.env.VERCEL) {
    return Response.json({ error: "storage not configured", code: "blob_not_configured" }, { status: 503 });
  }
  if (decision === "approved")
    return Response.json({ error: "Approve from the Clip Inbox so captions, title, and optional music are finished first." }, { status: 409 });
  const updated = devClips.update(clipId, user.userId, { status: "rejected" });
  if (!updated) return Response.json({ error: "unknown clip" }, { status: 404 });
  return Response.json({ clipId, status: updated.status });
}
