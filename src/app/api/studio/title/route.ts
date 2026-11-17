export const runtime = "nodejs";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { devClips } from "@/lib/clips";

const schema = z.object({ clipId: z.string().regex(/^clip_[a-zA-Z0-9-]{1,150}$/), title: z.string().trim().min(1).max(100) });

export async function POST(req: Request): Promise<Response> {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Title must be 1–100 characters." }, { status: 400 });
  const { clipId, title } = parsed.data;
  if (process.env.VERCEL) {
    const db = getPrisma();
    const clip = await db.clipProject.findFirst({ where: { id: clipId, userId: user.userId,
      status: { in: ["pending", "cut"] } }, include: { renderJobs: { orderBy: { createdAt: "desc" }, take: 1 } } });
    if (!clip) return Response.json({ error: "Clip is unavailable for editing." }, { status: 404 });
    const render = clip.renderJobs[0];
    if (render?.status === "running") return Response.json({ error: "This clip is rendering. Change the title after it finishes." }, { status: 409 });
    if (clip.title === title) return Response.json({ clipId, title, rebuilding: false });
    const rebuilding = Boolean(render && (render.status === "done" || render.status === "failed"));
    await db.$transaction(async tx => {
      await tx.clipProject.update({ where: { id: clipId }, data: { title,
        ...(rebuilding ? { status: "pending" as const } : {}) } });
      if (rebuilding && render) await tx.renderJob.update({ where: { id: render.id }, data: {
        status: "queued", renderUrl: null, captionsApplied: false, musicApplied: false } });
    });
    return Response.json({ clipId, title, rebuilding });
  } else {
    const clip = devClips.get(clipId, user.userId);
    if (clip?.status === "approved") return Response.json({ error: "Title is already in the approved video. Make another edit to change it." }, { status: 409 });
    const changed = devClips.update(clipId, user.userId, { title });
    if (!changed) return Response.json({ error: "unknown clip" }, { status: 404 });
  }
  return Response.json({ clipId, title });
}
