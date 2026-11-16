export const runtime = "nodejs";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { safeFilename } from "@/lib/blob";

const requestSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(127),
  size: z.number().int().positive(),
  kind: z.enum(["video", "music"]),
});

export async function POST(req: Request): Promise<Response> {
  const user = await requireUser();
  if (user instanceof Response) return user;
  if (!process.env.VERCEL || !process.env.BLOB_READ_WRITE_TOKEN || !process.env.DATABASE_URL)
    return Response.json({ error: "hosted studio unavailable" }, { status: 503 });
  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid upload details" }, { status: 400 });
  const { filename, contentType, size, kind } = parsed.data;
  const max = kind === "video" ? 1024 * 1024 * 1024 : 25 * 1024 * 1024;
  if (size > max || (kind === "video" ? !contentType.startsWith("video/") : !contentType.startsWith("audio/")))
    return Response.json({ error: kind === "video" ? "Video must be at most 1 GB." : "Music must be at most 25 MB." }, { status: 413 });
  const assetId = `asset_${randomUUID()}`;
  const pathname = `${kind === "video" ? "uploads" : "music"}/${user.userId}/${assetId}/${safeFilename(filename)}`;
  await getPrisma().mediaAsset.create({ data: {
    id: assetId, userId: user.userId, blobUrl: "", bytes: size, filename: safeFilename(filename),
    mimeType: contentType, mediaType: kind, status: "pending",
  } });
  return Response.json({ assetId, pathname, kind, size }, { status: 201 });
}
