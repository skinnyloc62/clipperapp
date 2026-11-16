export const runtime = "nodejs";

import { z } from "zod";
import { head } from "@vercel/blob";
import { requireUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

const schema = z.object({ assetId: z.string().regex(/^asset_[a-f0-9-]{36}$/), url: z.string().url().max(2048) });

/** The browser confirms a direct upload after Blob's callback (which may lag). */
export async function POST(req: Request): Promise<Response> {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid completion" }, { status: 400 });
  const { assetId, url } = parsed.data;
  const db = getPrisma();
  const asset = await db.mediaAsset.findFirst({ where: { id: assetId, userId: user.userId } });
  if (!asset) return Response.json({ error: "unknown upload" }, { status: 404 });
  if (asset.status === "uploaded" && asset.blobUrl === url) return Response.json({ assetId, status: "uploaded" });
  if (asset.status !== "pending" || !asset.filename || !asset.mimeType)
    return Response.json({ error: "upload not pending" }, { status: 409 });
  const expected = `${asset.mediaType === "music" ? "music" : "uploads"}/${user.userId}/${asset.id}/${asset.filename}`;
  let info;
  try { info = await head(url); }
  catch { return Response.json({ error: "uploaded object not found" }, { status: 404 }); }
  if (info.pathname !== expected || info.size > asset.bytes || info.contentType !== asset.mimeType)
    return Response.json({ error: "uploaded object does not match intent" }, { status: 422 });
  await db.mediaAsset.updateMany({ where: { id: assetId, userId: user.userId, status: "pending" },
    data: { blobUrl: url, bytes: info.size, status: "uploaded" } });
  return Response.json({ assetId, status: "uploaded" });
}
