export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { requireUser } from "@/lib/auth";
import { blobConfigured, storageDriver, blobKey } from "@/lib/blob";
import { uploadRequestSchema, isVideoMime, isUploadTooLarge, MAX_UPLOAD_MB } from "@/lib/validators";
import { devStore, type AssetRecord } from "@/lib/store";
import { mediaUsesPrisma } from "@/lib/storage-mode";

interface IssuancePayload {
  assetId: string;
  userId: string;
  filename: string;
  contentType: string;
  size: number;
}

function isProtocolBody(raw: unknown): raw is HandleUploadBody {
  return typeof raw === "object" && raw !== null && "type" in raw;
}

function parseClientPayload(clientPayload: string | null | undefined): IssuancePayload | null {
  if (!clientPayload) return null;
  try {
    const p = JSON.parse(clientPayload) as Partial<IssuancePayload>;
    if (!p.assetId || !p.userId || !p.filename || !p.contentType || typeof p.size !== "number") return null;
    return p as IssuancePayload;
  } catch {
    return null;
  }
}

/**
 * Authenticated direct-to-storage upload endpoint (dual mode).
 *
 * Mode A — issuance (browser): POST {filename, contentType, size} AFTER auth.
 * Enforces type/size/quota BEFORE any token exists and returns the assetId plus
 * the clientPayload the browser must pass to upload(). No storage touched.
 *
 * Mode B — protocol (Blob SDK callback): POST the @vercel/blob client-upload
 * protocol body. handleUpload() returns a plain object wrapped in
 * NextResponse.json(). Policy is re-enforced inside onBeforeGenerateToken
 * (issuance can be bypassed), and the finished object is verified + recorded
 * in onUploadCompleted.
 */
export async function POST(request: Request): Promise<Response> {
  const user = await requireUser();
  if (user instanceof Response) return user;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "expected JSON body" }, { status: 400 });
  }

  // --- Mode B: protocol passthrough (Blob SDK -> server -> Blob) ---
  if (isProtocolBody(raw)) {
    if (!blobConfigured()) {
      return NextResponse.json({ error: "storage not configured", code: "blob_not_configured" }, { status: 503 });
    }
    try {
      const jsonResponse = await handleUpload({
        request,
        body: raw,
        onBeforeGenerateToken: async (_pathname, clientPayload) => {
          const meta = parseClientPayload(clientPayload);
          if (!meta || meta.userId !== user.userId) {
            throw new Error("upload rejected: invalid issuance");
          }
          if (!isVideoMime(meta.contentType) || isUploadTooLarge(meta.size)) {
            throw new Error("upload rejected: type or size policy");
          }
          return {
            allowedContentTypes: [meta.contentType],
            maximumSizeInBytes: meta.size,
            tokenPayload: JSON.stringify(meta),
          };
        },
        onUploadCompleted: async ({ blob, tokenPayload }) => {
          try {
            const meta = parseClientPayload(tokenPayload);
            if (!meta) return;
            // Verify the finished object; delete violators.
            const { head, del } = await import("@vercel/blob");
            const info = await head(blob.url);
            const badType = !isVideoMime(info.contentType || "");
            const badSize = (info.size || 0) > meta.size || isUploadTooLarge(info.size || 0);
            if (badType || badSize) {
              await del(blob.url);
              console.error("upload rejected after completion:", blob.url, info.contentType, info.size);
              return;
            }
            const now = new Date().toISOString();
            const record: AssetRecord = {
              assetId: meta.assetId,
              userId: meta.userId,
              filename: meta.filename,
              bytes: info.size || meta.size,
              contentType: info.contentType || meta.contentType,
              blobUrl: blob.url,
              localPath: null,
              stored: true,
              status: "uploaded",
              durationSec: null,
              codec: null,
              width: null,
              height: null,
              createdAt: now,
              updatedAt: now,
            };
            if (mediaUsesPrisma()) {
              // TODO Section 2b: persist via Prisma when Neon is provisioned.
              console.log("upload completed (db write pending):", record.assetId, record.blobUrl);
            } else {
              devStore.save(record);
            }
          } catch (err) {
            console.error("onUploadCompleted failed:", (err as Error).message);
          }
        },
      });
      return NextResponse.json(jsonResponse);
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message || "upload failed" }, { status: 400 });
    }
  }

  // --- Mode A: issuance (browser -> server, pre-token policy gate) ---
  const parsed = uploadRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { filename, contentType, size } = parsed.data;
  if (!isVideoMime(contentType)) {
    return NextResponse.json({ error: `unsupported content type: ${contentType}` }, { status: 415 });
  }
  if (isUploadTooLarge(size)) {
    return NextResponse.json(
      { error: `file exceeds ${MAX_UPLOAD_MB}MB application limit`, code: "too_large" },
      { status: 413 },
    );
  }

  const assetId = `asset_${randomUUID()}`;
  const meta: IssuancePayload = { assetId, userId: user.userId, filename, contentType, size };
  void blobKey(user.userId, assetId, filename);

  if (!blobConfigured()) {
    if (storageDriver() === "local" && !process.env.VERCEL) {
      return NextResponse.json({
        assetId,
        mode: "local-direct",
        uploadUrl: "/api/uploads",
        handleUploadUrl: "/api/uploads/token",
        clientPayload: meta,
        maxFunctionBytes: 4_500_000,
        note: "Blob not configured: POST multipart to uploadUrl (<=4.5MB).",
      });
    }
    return NextResponse.json({ error: "storage not configured", code: "blob_not_configured" }, { status: 503 });
  }

  return NextResponse.json({
    assetId,
    mode: "blob-client-upload",
    handleUploadUrl: "/api/uploads/token",
    clientPayload: meta,
    maximumSizeInBytes: size,
  });
}
