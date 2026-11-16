export const runtime = "nodejs";

import { existsSync, realpathSync, statSync, unlinkSync } from "node:fs";
import { join, basename } from "node:path";
import { probeFile } from "@/lib/ffmpeg";
import { validateClipSchema } from "@/lib/validators";
import { requireUser } from "@/lib/auth";
import { fetchBlobToTmp } from "@/lib/media";
import { devStore } from "@/lib/store";
import { dataPath, safeRealpath } from "@/lib/data-root";
import { mediaUsesPrisma } from "@/lib/storage-mode";

const MAX_SOURCE_SEC = 600; // 10-minute source cap for Phase 1/2.
const ALLOWED_VIDEO_CODECS = new Set(["h264", "hevc", "vp9", "av1", "mpeg4"]);

/**
 * Validate stored media by server-issued asset ID.
 *
 * The client NEVER supplies a filesystem path. Resolution order:
 * 1. Media rows in Postgres (Blob URLs) when storage mode requires it.
 * 2. Otherwise the local disk registry scoped to the caller.
 * Local files resolve only under .data/uploads/<userId>/ with a realpath
 * containment check (traversal + symlink escape rejected with 403).
 * Remote Blob objects are fetched to /tmp by the worker-style fetcher
 * (size-capped, timed out) and deleted after probing.
 */
export async function POST(req: Request): Promise<Response> {
  if (process.env.VERCEL) return Response.json({ error: "Validation runs on the owner's Mac" }, { status: 501 });
  const user = await requireUser();
  if (user instanceof Response) return user;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "expected JSON {assetId}" }, { status: 400 });
  }
  const parsed = validateClipSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { assetId } = parsed.data;

  // --- Resolve the server-side record (ownership-scoped) ---
  let localPath: string | null = null;
  let blobUrl: string | null = null;
  if (mediaUsesPrisma()) {
    try {
      const { getPrisma } = await import("@/lib/db");
      const row = await getPrisma().mediaAsset.findFirst({ where: { id: assetId, userId: user.userId } });
      if (!row) return Response.json({ error: "unknown asset", stored: false }, { status: 404 });
      if (!row.blobUrl) {
        return Response.json({ error: "media not stored", stored: false, status: row.status }, { status: 409 });
      }
      blobUrl = row.blobUrl;
    } catch (err) {
      console.error("validate db lookup failed:", (err as Error).message);
      return Response.json({ error: "asset lookup failed" }, { status: 500 });
    }
  } else {
    if (process.env.VERCEL) {
      return Response.json({ error: "storage not configured", code: "blob_not_configured" }, { status: 503 });
    }
    const rec = devStore.get(assetId, user.userId);
    if (!rec) return Response.json({ error: "unknown asset", stored: false }, { status: 404 });
    if (!rec.stored) {
      return Response.json({ error: "media not stored", stored: false, status: rec.status }, { status: 409 });
    }
    localPath = rec.localPath;
    blobUrl = rec.blobUrl;
  }

  // --- Resolve a probeable file without trusting any client input ---
  let probePath: string | null = null;
  let tmpCleanup: (() => void) | null = null;
  try {
    if (blobUrl) {
      const fetched = await fetchBlobToTmp(blobUrl);
      probePath = fetched.tmpPath;
      tmpCleanup = () => {
        try {
          unlinkSync(fetched.tmpPath);
        } catch { /* best effort */ }
      };
    } else if (localPath) {
      const root = safeRealpath(dataPath("uploads", user.userId));
      let real: string;
      try {
        real = realpathSync(localPath);
      } catch {
        return Response.json({ error: "stored file missing", stored: true }, { status: 410 });
      }
      if (real !== root && !real.startsWith(root + "/")) {
        return Response.json({ error: "stored file outside allowlist", code: "path_escape" }, { status: 403 });
      }
      if (!existsSync(real) || !statSync(real).isFile()) {
        return Response.json({ error: "stored file missing", stored: true }, { status: 410 });
      }
      if (basename(real) !== basename(localPath)) {
        return Response.json({ error: "stored file outside allowlist", code: "path_escape" }, { status: 403 });
      }
      probePath = real;
    } else {
      return Response.json({ error: "media not stored", stored: false }, { status: 409 });
    }

    // --- Content validation: never trust MIME headers, probe the bytes ---
    const probe = await probeFile(probePath);
    if (!probe.valid) {
      await markInvalid(assetId, user.userId);
      return Response.json({ assetId, stored: true, valid: false, reason: probe.reason }, { status: 422 });
    }
    if (!ALLOWED_VIDEO_CODECS.has(probe.codec || "")) {
      await markInvalid(assetId, user.userId);
      return Response.json(
        { assetId, stored: true, valid: false, reason: `unsupported video codec: ${probe.codec}` },
        { status: 422 },
      );
    }
    if (!probe.durationSec || !(probe.durationSec > 0) || probe.durationSec > MAX_SOURCE_SEC) {
      await markInvalid(assetId, user.userId);
      return Response.json(
        { assetId, stored: true, valid: false, reason: `duration out of range: ${probe.durationSec}` },
        { status: 422 },
      );
    }
    await markValidated(assetId, user.userId, probe);
    return Response.json(
      {
        assetId,
        stored: true,
        status: "validated",
        valid: true,
        durationSec: probe.durationSec,
        codec: probe.codec,
        width: probe.width,
        height: probe.height,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("validate failed:", (err as Error).message);
    return Response.json({ error: "validation failed" }, { status: 500 });
  } finally {
    if (tmpCleanup) tmpCleanup();
  }
}

async function markValidated(
  assetId: string,
  userId: string,
  probe: { durationSec?: number; codec?: string; width?: number; height?: number },
): Promise<void> {
  if (mediaUsesPrisma()) {
    const { getPrisma } = await import("@/lib/db");
    await getPrisma().mediaAsset.updateMany({
      where: { id: assetId, userId },
      data: {
        status: "validated",
        durationSec: probe.durationSec,
        codec: probe.codec,
        width: probe.width,
        height: probe.height,
      },
    });
    return;
  }
  devStore.update(assetId, userId, {
    status: "validated",
    durationSec: probe.durationSec ?? null,
    codec: probe.codec ?? null,
    width: probe.width ?? null,
    height: probe.height ?? null,
  });
}

async function markInvalid(assetId: string, userId: string): Promise<void> {
  if (mediaUsesPrisma()) {
    const { getPrisma } = await import("@/lib/db");
    await getPrisma().mediaAsset.updateMany({ where: { id: assetId, userId }, data: { status: "invalid" } });
    return;
  }
  devStore.update(assetId, userId, { status: "invalid" });
}
