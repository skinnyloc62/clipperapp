export const runtime = "nodejs";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

const bodySchema = z.object({
  assetId: z.string().min(1).max(128),
  markSec: z.number().finite().nonnegative().max(43200).optional(),
});

/** Queue local evidence analysis. A score is never calculated on Vercel. */
export async function POST(req: Request): Promise<Response> {
  if (!process.env.VERCEL) return Response.json({ error: "Hosted uploads only" }, { status: 501 });
  const user = await requireUser();
  if (user instanceof Response) return user;
  let body: unknown;
  try { body = await req.json(); }
  catch { return Response.json({ error: "expected JSON {assetId, markSec?}" }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid asset or time mark." }, { status: 400 });
  const { assetId, markSec } = parsed.data;
  const db = getPrisma();
  const asset = await db.mediaAsset.findFirst({ where: { id: assetId, userId: user.userId,
    mediaType: "video", status: { in: ["uploaded", "validated"] }, blobUrl: { not: "" } } });
  if (!asset) return Response.json({ error: "Video upload not found." }, { status: 404 });
  if (asset.durationSec != null && markSec != null && markSec >= asset.durationSec)
    return Response.json({ error: "Time mark is outside this video." }, { status: 400 });
  const existing = await db.scoutJob.findFirst({ where: { userId: user.userId, assetId,
    markSec: markSec ?? null, status: { in: ["queued", "running"] } }, orderBy: { createdAt: "desc" } });
  if (existing) return Response.json({ scoutId: existing.id, status: existing.status }, { status: 200 });
  const job = await db.scoutJob.create({ data: { id: `scout_${randomUUID()}`, userId: user.userId,
    assetId, markSec: markSec ?? null, status: "queued" } });
  return Response.json({ scoutId: job.id, status: job.status }, { status: 201 });
}
