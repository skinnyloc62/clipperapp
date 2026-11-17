export const runtime = "nodejs";

import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { join } from "node:path";
import { requireUser } from "@/lib/auth";
import { safeFilename } from "@/lib/blob";
import { dataPath } from "@/lib/data-root";
import { devStore, type AssetRecord } from "@/lib/store";
import { mediaOnLocalDisk } from "@/lib/storage-mode";
import { isVideoMime } from "@/lib/validators";

const MAX_BYTES = 1024 * 1024 * 1024;

/** Stream a source into the local app data folder without buffering a long
 * video in memory. This route is never available on Vercel. */
export async function PUT(req: Request): Promise<Response> {
  const user = await requireUser();
  if (user instanceof Response) return user;
  if (!mediaOnLocalDisk()) return Response.json({ error: "Local disk storage is not active." }, { status: 501 });
  if (!req.body) return Response.json({ error: "Missing video body." }, { status: 400 });
  const encoded = req.headers.get("x-filename") || "";
  if (!encoded) return Response.json({ error: "Filename is required." }, { status: 400 });
  let filename: string;
  try { filename = safeFilename(decodeURIComponent(encoded)); }
  catch { return Response.json({ error: "Invalid filename." }, { status: 400 }); }
  if (!filename || filename.length > 255) return Response.json({ error: "Invalid filename." }, { status: 400 });
  const mime = req.headers.get("content-type") || "application/octet-stream";
  if (!isVideoMime(mime)) return Response.json({ error: "Choose a video file." }, { status: 415 });
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BYTES) return Response.json({ error: "Video exceeds 1 GB." }, { status: 413 });
  const assetId = `asset_${randomUUID()}`;
  const dir = dataPath("uploads", user.userId);
  await mkdir(dir, { recursive: true });
  const localPath = join(dir, `${assetId}_${filename}`);
  let bytes = 0;
  const count = new Transform({ transform(chunk: Buffer, _encoding, callback) {
    bytes += chunk.length;
    callback(bytes > MAX_BYTES ? new Error("too_large") : null, chunk);
  } });
  try {
    await pipeline(Readable.fromWeb(req.body as never), count, createWriteStream(localPath, { flags: "wx" }));
  } catch (error) {
    await unlink(localPath).catch(() => undefined);
    if ((error as Error).message === "too_large") return Response.json({ error: "Video exceeds 1 GB." }, { status: 413 });
    return Response.json({ error: "Could not save the video." }, { status: 500 });
  }
  if (bytes === 0) {
    await unlink(localPath).catch(() => undefined);
    return Response.json({ error: "Video is empty." }, { status: 400 });
  }
  if (declared > 0 && bytes !== declared) {
    await unlink(localPath).catch(() => undefined);
    return Response.json({ error: "Upload ended before the whole video arrived." }, { status: 422 });
  }
  const now = new Date().toISOString();
  const record: AssetRecord = { assetId, userId: user.userId, filename, bytes,
    contentType: mime, blobUrl: null, localPath, stored: true, status: "uploaded",
    durationSec: null, codec: null, width: null, height: null, createdAt: now, updatedAt: now };
  devStore.save(record);
  return Response.json({ assetId, filename, bytes, stored: true, storage: "local",
    status: "uploaded" }, { status: 201 });
}
