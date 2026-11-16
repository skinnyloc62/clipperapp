import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { mediaOnLocalDisk } from "./storage-mode";

export type AssetStatus = "uploaded" | "validated" | "invalid";

export interface AssetRecord {
  assetId: string;
  userId: string;
  filename: string;
  bytes: number;
  contentType: string;
  /** Public Blob URL when stored remotely, local dev path marker otherwise. */
  blobUrl: string | null;
  /** Absolute local path for STORAGE_DRIVER=local dev only. Never client-controlled. */
  localPath: string | null;
  /** Machine-readable storage state. `stored:false` means NOT persisted — never treat as ready media. */
  stored: boolean;
  status: AssetStatus;
  durationSec: number | null;
  codec: string | null;
  width: number | null;
  height: number | null;
  createdAt: string;
  updatedAt: string;
}

function dataDir(): string {
  // Repo-root .data (gitignored). Serverless never reaches here: Vercel sets VERCEL=1.
  const root = join(dirname(new URL(import.meta.url).pathname), "..", "..", "..");
  return join(root, ".data");
}

function registryPath(): string {
  return join(dataDir(), "assets.json");
}

function assertDevStoreAllowed(): void {
  if (process.env.VERCEL) {
    throw new Error("local asset registry is disabled on Vercel; configure DATABASE_URL + Blob");
  }
  if (!mediaOnLocalDisk()) {
    // Blob/remote storage is in play: assets must be Prisma rows pointing at Blob URLs.
    throw new Error("media is not on local disk: use Prisma media rows with Blob URLs");
  }
}

function readAll(): Record<string, AssetRecord> {
  const p = registryPath();
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, "utf8")) as Record<string, AssetRecord>;
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, AssetRecord>): void {
  mkdirSync(dataDir(), { recursive: true });
  writeFileSync(registryPath(), JSON.stringify(all, null, 2));
}

/**
 * Dev-only asset registry (local `next dev` with media on local disk).
 * This is independent of DATABASE_URL: Postgres media rows carry Blob URLs only,
 * so a local file can only be indexed here. Ownership is always scoped: callers
 * must pass the authenticated userId.
 */
export const devStore = {
  save(record: AssetRecord): AssetRecord {
    assertDevStoreAllowed();
    const all = readAll();
    all[record.assetId] = record;
    writeAll(all);
    return record;
  },
  /** Returns the record only when it belongs to userId. */
  get(assetId: string, userId: string): AssetRecord | null {
    assertDevStoreAllowed();
    const rec = readAll()[assetId];
    if (!rec || rec.userId !== userId) return null;
    return rec;
  },
  update(assetId: string, userId: string, patch: Partial<AssetRecord>): AssetRecord | null {
    assertDevStoreAllowed();
    const all = readAll();
    const rec = all[assetId];
    if (!rec || rec.userId !== userId) return null;
    const next = { ...rec, ...patch, assetId: rec.assetId, userId: rec.userId, updatedAt: new Date().toISOString() };
    all[assetId] = next;
    writeAll(all);
    return next;
  },
};
