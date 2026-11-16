export const runtime = "nodejs";

import { readFileSync } from "node:fs";
import { requireUser } from "@/lib/auth";
import { devClips, devRenders } from "@/lib/clips";
import { mediaUsesPrisma } from "@/lib/storage-mode";

/**
 * Authenticated download. Accepts render_<id> or clip_<id>.
 * - Blob mode: 302 redirect to the stored URL (public store MVP; private
 *   stores move to server-mediated serving in Section 4).
 * - Local dev: streams the file with attachment disposition. Ownership is
 *   verified before any bytes move; approved clips only for clip downloads.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ renderId: string }> }): Promise<Response> {
  const user = await requireUser();
  if (user instanceof Response) return user;

  const { renderId: id } = await ctx.params;
  if (!id || id.length > 160) {
    return Response.json({ error: "unknown download" }, { status: 404 });
  }

  let localPath: string | null = null;
  let blobUrl: string | null = null;
  let filename = "download.mp4";
  let allowed = false;

  if (id.startsWith("render_")) {
    if (mediaUsesPrisma()) {
      const { getPrisma } = await import("@/lib/db");
      const job = await getPrisma().renderJob.findFirst({
        where: { id },
        include: { clipProject: { select: { userId: true, status: true } } },
      });
      if (!job || job.clipProject.userId !== user.userId || job.clipProject.status !== "approved") {
        return Response.json({ error: "unknown download" }, { status: 404 });
      }
      blobUrl = job.renderUrl;
      allowed = true;
      filename = `${id}.mp4`;
    } else {
      if (process.env.VERCEL) {
        return Response.json({ error: "storage not configured", code: "blob_not_configured" }, { status: 503 });
      }
      const rec = devRenders.get(id, user.userId);
      if (!rec || devClips.get(rec.clipId, user.userId)?.status !== "approved") {
        return Response.json({ error: "unknown download" }, { status: 404 });
      }
      localPath = rec.localPath;
      blobUrl = rec.renderBlobUrl;
      allowed = !!rec.stored;
      filename = `${id}.mp4`;
    }
  } else if (id.startsWith("clip_")) {
    // Clip previews require approval — unapproved cuts are not downloadable.
    if (mediaUsesPrisma()) {
      const { getPrisma } = await import("@/lib/db");
      const clip = await getPrisma().clipProject.findFirst({ where: { id, userId: user.userId } });
      if (!clip || clip.status !== "approved") {
        return Response.json({ error: "unknown download" }, { status: 404 });
      }
      blobUrl = clip.clipUrl;
      allowed = !!blobUrl;
      filename = `${id}.mp4`;
    } else {
      if (process.env.VERCEL) {
        return Response.json({ error: "storage not configured", code: "blob_not_configured" }, { status: 503 });
      }
      const rec = devClips.get(id, user.userId);
      if (!rec || rec.status !== "approved") {
        return Response.json({ error: "unknown download" }, { status: 404 });
      }
      localPath = rec.localPath;
      blobUrl = rec.clipBlobUrl;
      allowed = rec.stored;
      filename = `${id}.mp4`;
    }
  } else {
    return Response.json({ error: "unknown download" }, { status: 404 });
  }

  if (!allowed) {
    return Response.json({ error: "media not stored", stored: false }, { status: 409 });
  }
  if (blobUrl) {
    return Response.redirect(blobUrl, 302);
  }
  if (localPath) {
    try {
      const data = readFileSync(localPath);
      const bytes = new Uint8Array(data);
      return new Response(bytes, {
        status: 200,
        headers: {
          "content-type": "video/mp4",
          "content-disposition": `attachment; filename="${filename}"`,
          "content-length": String(bytes.byteLength),
        },
      });
    } catch {
      return Response.json({ error: "stored file missing", stored: true }, { status: 410 });
    }
  }
  return Response.json({ error: "media not stored", stored: false }, { status: 409 });
}
