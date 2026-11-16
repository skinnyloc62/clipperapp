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
    const changed = await getPrisma().clipProject.updateMany({ where: { id: clipId, userId: user.userId, status: { not: "rejected" } }, data: { title } });
    if (!changed.count) return Response.json({ error: "unknown clip" }, { status: 404 });
  } else {
    const changed = devClips.update(clipId, user.userId, { title });
    if (!changed) return Response.json({ error: "unknown clip" }, { status: 404 });
  }
  return Response.json({ clipId, title });
}
