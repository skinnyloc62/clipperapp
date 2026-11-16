export const runtime = "nodejs";

import { requireUser } from "@/lib/auth";
import { approvalSchema } from "@/lib/validators";
import { devClips } from "@/lib/clips";
import { mediaUsesPrisma } from "@/lib/storage-mode";

/**
 * Owner approval gate. Only the owning user can approve/reject their clip.
 * Nothing here publishes or distributes anything — approval only unlocks
 * the download route. Third-party footage still requires the rights review
 * tracked on the highlight candidate (rights_status must be cleared first).
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
  const updated = devClips.update(clipId, user.userId, { status: decision === "approved" ? "approved" : "rejected" });
  if (!updated) return Response.json({ error: "unknown clip" }, { status: 404 });
  return Response.json({ clipId, status: updated.status });
}
