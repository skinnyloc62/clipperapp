export const runtime = "nodejs";

import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { head } from "@vercel/blob";
import { requireUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

type Payload = { assetId: string };
function parsePayload(raw: string | null | undefined): Payload | null {
  try { const p = JSON.parse(raw || "") as Payload; return /^asset_[a-f0-9-]{36}$/.test(p.assetId) ? p : null; }
  catch { return null; }
}

/** Blob verifies its completion callback; only token generation needs a session. */
export async function POST(req: Request): Promise<Response> {
  let body: HandleUploadBody;
  try { body = await req.json() as HandleUploadBody; }
  catch { return Response.json({ error: "invalid upload protocol" }, { status: 400 }); }
  try {
    const result = await handleUpload({ request: req, body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const user = await requireUser();
        if (user instanceof Response) throw new Error("unauthorized");
        const meta = parsePayload(clientPayload);
        if (!meta) throw new Error("invalid upload intent");
        const asset = await getPrisma().mediaAsset.findFirst({ where: { id: meta.assetId, userId: user.userId, status: "pending" } });
        if (!asset || !asset.mimeType || !asset.filename) throw new Error("upload intent not found");
        const expected = `${asset.mediaType === "music" ? "music" : "uploads"}/${user.userId}/${asset.id}/${asset.filename}`;
        if (pathname !== expected) throw new Error("upload path mismatch");
        return { allowedContentTypes: [asset.mimeType], maximumSizeInBytes: asset.bytes,
          addRandomSuffix: false, allowOverwrite: false,
          tokenPayload: JSON.stringify({ assetId: asset.id, userId: user.userId, pathname: expected }) };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        try {
          const p = JSON.parse(tokenPayload || "") as { assetId: string; userId: string; pathname: string };
          const asset = await getPrisma().mediaAsset.findFirst({ where: { id: p.assetId, userId: p.userId, status: "pending" } });
          if (!asset || blob.pathname !== p.pathname) return;
          const info = await head(blob.url);
          if (info.pathname !== p.pathname || info.size > asset.bytes || info.contentType !== asset.mimeType) return;
          await getPrisma().mediaAsset.updateMany({ where: { id: asset.id, userId: p.userId, status: "pending" },
            data: { blobUrl: blob.url, bytes: info.size, status: "uploaded" } });
        } catch (error) { console.error("studio upload callback failed:", (error as Error).message); }
      },
    });
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: (error as Error).message || "upload denied" }, { status: 400 });
  }
}
