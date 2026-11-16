export const runtime = "nodejs";

import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { MAX_UPLOAD_MB, isUploadTooLarge, isVideoMime, uploadRequestSchema } from "@/lib/validators";
import { requireUser } from "@/lib/auth";
import { blobConfigured, storageDriver, safeFilename, blobKey } from "@/lib/blob";
import { devStore, type AssetRecord } from "@/lib/store";

/**
 * Vercel Functions cap request bodies at ~4.5MB. This multipart route therefore:
 * - rejects anything over the function payload limit with 413 + client-upload guidance,
 * - persists to local disk ONLY in local dev (STORAGE_DRIVER=local, no VERCEL env),
 * - otherwise returns 501: use POST /api/uploads/token (browser -> Blob direct).
 *
 * Response always carries machine-readable storage state:
 * `stored:false` means accepted-but-NOT-persisted. Never treat as ready media.
 */
const FUNCTION_PAYLOAD_LIMIT = 4_500_000;

export async function POST(req: Request): Promise<Response> {
  const user = await requireUser();
  if (user instanceof Response) return user;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "expected multipart form with a 'file' field" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "missing 'file' field" }, { status: 400 });
  }
  const parsed = uploadRequestSchema.safeParse({
    filename: file.name,
    contentType: file.type || "application/octet-stream",
    size: file.size,
  });
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  if (!isVideoMime(file.type) && file.type !== "") {
    return Response.json({ error: `unsupported content type: ${file.type || "unknown"}` }, { status: 415 });
  }
  if (isUploadTooLarge(file.size)) {
    return Response.json(
      { error: `file exceeds ${MAX_UPLOAD_MB}MB application limit`, code: "too_large" },
      { status: 413 },
    );
  }
  if (file.size > FUNCTION_PAYLOAD_LIMIT || blobConfigured() || storageDriver() === "blob" || process.env.VERCEL) {
    return Response.json(
      {
        error: "file must use direct browser-to-storage upload",
        code: "use_client_upload",
        tokenUrl: "/api/uploads/token",
      },
      { status: 413 },
    );
  }

  // Local dev only from here down.
  const assetId = `asset_${randomUUID()}`;
  const filename = safeFilename(file.name);
  const root = join(dirname(new URL(import.meta.url).pathname), "..", "..", "..", "..");
  const dir = join(root, ".data", "uploads", user.userId);
  mkdirSync(dir, { recursive: true });
  const localPath = join(dir, `${assetId}_${filename}`);
  const bytes = await file.arrayBuffer();
  writeFileSync(localPath, Buffer.from(bytes));

  const now = new Date().toISOString();
  const record: AssetRecord = {
    assetId,
    userId: user.userId,
    filename,
    bytes: file.size,
    contentType: file.type || "application/octet-stream",
    blobUrl: null,
    localPath,
    stored: true,
    status: "uploaded",
    durationSec: null,
    codec: null,
    width: null,
    height: null,
    createdAt: now,
    updatedAt: now,
  };
  devStore.save(record);

  return Response.json(
    {
      assetId,
      filename,
      bytes: file.size,
      blobUrl: null,
      stored: true,
      storage: "local-dev",
      status: "uploaded",
    },
    { status: 201 },
  );
}
