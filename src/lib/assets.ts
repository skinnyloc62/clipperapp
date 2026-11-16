import { existsSync, realpathSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { dataPath, safeRealpath } from "./data-root";
import { mediaUsesPrisma } from "./storage-mode";

export type ResolvedAsset =
  | { kind: "local"; path: string; durationSec: number | null; status: string }
  | { kind: "blob"; url: string; durationSec: number | null; status: string }
  | { kind: "error"; status: number; error: string; code?: string; stored?: boolean };

/**
 * Server-side asset resolution shared by cut/render (validate keeps its own
 * proven copy; unify in Section 3b). Clients never supply paths: the asset ID
 * maps to a DB row or the dev registry, scoped to the caller. Local files
 * resolve only under .data/uploads/<userId>/ with a realpath containment
 * check (traversal + symlink escape -> 403 path_escape).
 */
export async function resolveAssetFile(assetId: string, userId: string): Promise<ResolvedAsset> {
  let localPath: string | null = null;
  let blobUrl: string | null = null;
  let durationSec: number | null = null;
  let status = "uploaded";

  if (mediaUsesPrisma()) {
    try {
      const { getPrisma } = await import("./db");
      const row = await getPrisma().mediaAsset.findFirst({ where: { id: assetId, userId } });
      if (!row) return { kind: "error", status: 404, error: "unknown asset", stored: false };
      if (!row.blobUrl) {
        return { kind: "error", status: 409, error: "media not stored", stored: false };
      }
      blobUrl = row.blobUrl;
      durationSec = row.durationSec ?? null;
      status = row.status;
    } catch (err) {
      console.error("asset lookup failed:", (err as Error).message);
      return { kind: "error", status: 500, error: "asset lookup failed" };
    }
  } else {
    if (process.env.VERCEL) {
      return { kind: "error", status: 503, error: "storage not configured", code: "blob_not_configured" };
    }
    const { devStore } = await import("./store");
    const rec = devStore.get(assetId, userId);
    if (!rec) return { kind: "error", status: 404, error: "unknown asset", stored: false };
    if (!rec.stored) {
      return { kind: "error", status: 409, error: "media not stored", stored: false };
    }
    localPath = rec.localPath;
    blobUrl = rec.blobUrl;
    durationSec = rec.durationSec;
    status = rec.status;
  }

  if (blobUrl) return { kind: "blob", url: blobUrl, durationSec, status };

  if (localPath) {
    const root = safeRealpath(dataPath("uploads", userId));
    let real: string;
    try {
      real = realpathSync(localPath);
    } catch {
      return { kind: "error", status: 410, error: "stored file missing", stored: true };
    }
    if (real !== root && !real.startsWith(root + "/")) {
      return { kind: "error", status: 403, error: "stored file outside allowlist", code: "path_escape" };
    }
    if (!existsSync(real) || !statSync(real).isFile()) {
      return { kind: "error", status: 410, error: "stored file missing", stored: true };
    }
    if (basename(real) !== basename(localPath)) {
      return { kind: "error", status: 403, error: "stored file outside allowlist", code: "path_escape" };
    }
    return { kind: "local", path: real, durationSec, status };
  }

  return { kind: "error", status: 409, error: "media not stored", stored: false };
}
