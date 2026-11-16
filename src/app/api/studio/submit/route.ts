export const runtime = "nodejs";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

const schema = z.object({
  assetId: z.string().regex(/^asset_[a-f0-9-]{36}$/),
  startSec: z.number().finite().nonnegative(),
  endSec: z.number().finite().positive(),
  title: z.string().trim().max(100).optional(),
  captionsEnabled: z.boolean().default(true),
  musicAssetId: z.string().regex(/^asset_[a-f0-9-]{36}$/).optional(),
}).refine(v => v.endSec > v.startSec && v.endSec - v.startSec <= 60,
  { message: "Choose a clip between 0 and 60 seconds." });

export async function POST(req: Request): Promise<Response> {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Choose a valid range of at most 60 seconds." }, { status: 400 });
  const input = parsed.data;
  const db = getPrisma();
  const asset = await db.mediaAsset.findFirst({ where: { id: input.assetId, userId: user.userId, mediaType: "video", status: { in: ["uploaded", "validated"] } } });
  if (!asset?.blobUrl) return Response.json({ error: "Upload the video first." }, { status: 409 });
  let musicUrl: string | null = null;
  if (input.musicAssetId) {
    const music = await db.mediaAsset.findFirst({ where: { id: input.musicAssetId, userId: user.userId, mediaType: "music", status: "uploaded" } });
    if (!music?.blobUrl) return Response.json({ error: "Music upload is not ready." }, { status: 409 });
    musicUrl = music.blobUrl;
  }
  const clipId = `clip_${randomUUID()}`;
  const renderId = `render_${randomUUID()}`;
  await db.clipProject.create({ data: {
    id: clipId, assetId: asset.id, userId: user.userId, startSec: input.startSec,
    endSec: input.endSec, title: input.title || null, status: "pending",
    renderJobs: { create: { id: renderId, preset: "vertical-1080x1920", status: "queued",
      captionsEnabled: input.captionsEnabled, musicUrl } },
  } });
  return Response.json({ clipId, renderId, status: "queued" }, { status: 201 });
}
