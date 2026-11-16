export const runtime = "nodejs";

import { randomUUID } from "node:crypto";
import { mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { requireUser } from "@/lib/auth";
import { dataPath } from "@/lib/data-root";
import { cutSchema, MAX_CLIP_SEC } from "@/lib/validators";
import { resolveAssetFile } from "@/lib/assets";
import { trimFile, probeFile } from "@/lib/ffmpeg";
import { fetchBlobToTmp } from "@/lib/media";
import { devClips, type ClipRecord } from "@/lib/clips";
import { mediaUsesPrisma } from "@/lib/storage-mode";

/**
 * Persist a cut: trim [startSec, endSec) from the caller's validated asset.
 * Range is checked against the probed duration; output is re-encoded for
 * frame accuracy. Local dev writes .data/cuts/<clipId>.mp4; Blob mode uploads
 * the trimmed file and stores its URL. No client paths anywhere.
 */
export async function POST(req: Request): Promise<Response> {
  if (process.env.VERCEL) return Response.json({ error: "Clipping runs on the owner's Mac" }, { status: 501 });
  const user = await requireUser();
  if (user instanceof Response) return user;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "expected JSON {assetId, startSec, endSec}" }, { status: 400 });
  }
  const parsed = cutSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { assetId, startSec, endSec } = parsed.data;
  const dur = endSec - startSec;
  if (dur > MAX_CLIP_SEC) {
    return Response.json({ error: `clip length must be <= ${MAX_CLIP_SEC}s` }, { status: 400 });
  }

  const resolved = await resolveAssetFile(assetId, user.userId);
  if (resolved.kind === "error") {
    const { status, ...rest } = resolved;
    return Response.json(rest, { status: status as number });
  }
  if (resolved.durationSec == null) {
    return Response.json(
      { error: "asset not validated yet — run /api/clips/validate first", code: "needs_validation" },
      { status: 409 },
    );
  }
  if (!(startSec >= 0) || !(endSec <= resolved.durationSec)) {
    return Response.json(
      { error: `range [${startSec}, ${endSec}) outside asset duration ${resolved.durationSec}s` },
      { status: 400 },
    );
  }

  const clipId = `clip_${randomUUID()}`;
  let inputPath: string;
  let tmpInputCleanup: (() => void) | null = null;
  if (resolved.kind === "blob") {
    try {
      const fetched = await fetchBlobToTmp(resolved.url);
      inputPath = fetched.tmpPath;
      tmpInputCleanup = () => {
        try {
          unlinkSync(fetched.tmpPath);
        } catch { /* best effort */ }
      };
    } catch (err) {
      return Response.json({ error: (err as Error).message || "fetch failed" }, { status: 502 });
    }
  } else {
    inputPath = resolved.path;
  }

  try {
    let localPath: string | null = null;
    let clipBlobUrl: string | null = null;
    let verifyPath: string | null = null;

    if (process.env.BLOB_READ_WRITE_TOKEN && process.env.VERCEL) {
      const { tmpdir } = await import("node:os");
      const tmpOut = join(tmpdir(), `${clipId}.mp4`);
      const trim = await trimFile(inputPath, startSec, dur, tmpOut);
      if (!trim.ok) {
        return Response.json({ error: trim.reason }, { status: 500 });
      }
      verifyPath = tmpOut;
      const { put } = await import("@vercel/blob");
      const { readFileSync, unlinkSync: rm } = await import("node:fs");
      const key = `clips/${user.userId}/${clipId}.mp4`;
      const uploaded = await put(key, readFileSync(tmpOut), { access: "public", contentType: "video/mp4" });
      rm(tmpOut);
      clipBlobUrl = uploaded.url;
    } else if (!process.env.VERCEL) {
      const dir = dataPath("cuts", user.userId);
      mkdirSync(dir, { recursive: true });
      localPath = join(dir, `${clipId}.mp4`);
      const trim = await trimFile(inputPath, startSec, dur, localPath);
      if (!trim.ok) {
        return Response.json({ error: trim.reason }, { status: 500 });
      }
    } else {
      return Response.json({ error: "storage not configured", code: "blob_not_configured" }, { status: 503 });
    }

    // Verify the trimmed artifact before recording it.
    const probeTarget = localPath ?? verifyPath;
    const probe = probeTarget ? await probeFile(probeTarget) : { valid: false, reason: "no output to verify" };
    if (!probe.valid) {
      return Response.json({ error: "trimmed clip failed verification", reason: (probe as { reason?: string }).reason }, { status: 500 });
    }

    const now = new Date().toISOString();
    const record: ClipRecord = {
      clipId,
      assetId,
      userId: user.userId,
      startSec,
      endSec,
      localPath,
      clipBlobUrl,
      stored: true,
      status: "cut",
      segmentsJson: "[]",
      createdAt: now,
      updatedAt: now,
    };

    if (mediaUsesPrisma()) {
      const { getPrisma } = await import("@/lib/db");
      await getPrisma().clipProject.create({
        data: { id: clipId, assetId, userId: user.userId, startSec, endSec, clipUrl: clipBlobUrl, status: "pending" },
      });
    } else {
      devClips.save(record, clipId);
    }

    return Response.json({ clipId, assetId, startSec, endSec, stored: true, status: "cut", clipBlobUrl }, { status: 201 });
  } finally {
    if (tmpInputCleanup) tmpInputCleanup();
  }
}
