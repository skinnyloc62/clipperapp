import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { mediaOnLocalDisk } from "./storage-mode";

/**
 * Dev-only registries for clips, renders, and brand profiles
 * (local `next dev` with media on local disk, never on Vercel).
 * Ownership is always scoped to the authenticated userId.
 */

export type ClipStatus = "cut" | "approved" | "rejected";

export interface ClipRecord {
  clipId: string;
  assetId: string;
  userId: string;
  startSec: number;
  endSec: number;
  /** Absolute local path of the trimmed clip (dev) or null (Blob mode). */
  localPath: string | null;
  clipBlobUrl: string | null;
  stored: boolean;
  status: ClipStatus;
  segmentsJson: string;
  createdAt: string;
  updatedAt: string;
}

export type RenderStatus = "queued" | "running" | "done" | "failed";

export interface RenderRecord {
  renderId: string;
  clipId: string;
  userId: string;
  preset: "vertical-1080x1920";
  localPath: string | null;
  renderBlobUrl: string | null;
  stored: boolean;
  status: RenderStatus;
  qa: QaRecord | null;
  createdAt: string;
  updatedAt: string;
}

export type QaVerdict = "PASS" | "REVISE" | "BLOCK" | "NOT_TESTED";

export interface QaCheck {
  name: string;
  status: QaVerdict | "FAIL";
  detail: string;
}

export interface QaRecord {
  source_id: string;
  clip_asset_id: string | null;
  status: QaVerdict;
  checks: QaCheck[];
  tested_at: string;
}

export interface BrandRecord {
  userId: string;
  logoUrl: string | null;
  primaryColor: string;
  captionStyle: "bottom" | "top" | "karaoke";
  watermarkText: string | null;
  updatedAt: string;
}

function dataDir(): string {
  return join(process.cwd(), ".data");
}

function readTable<T>(name: string): Record<string, T> {
  const p = join(dataDir(), name);
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, "utf8")) as Record<string, T>;
  } catch {
    return {};
  }
}

function writeTable<T>(name: string, all: Record<string, T>): void {
  mkdirSync(dataDir(), { recursive: true });
  writeFileSync(join(dataDir(), name), JSON.stringify(all, null, 2));
}

function guard(): void {
  if (process.env.VERCEL) throw new Error("dev registries are disabled on Vercel");
  if (!mediaOnLocalDisk()) {
    // Clips/renders reference media files, so they follow the media storage mode, not DATABASE_URL.
    throw new Error("media is not on local disk: use Prisma clip/render rows");
  }
}

function namespaced<T extends { userId: string }>(table: string) {
  return {
    get(id: string, userId: string): T | null {
      guard();
      const rec = readTable<T>(table)[id];
      if (!rec || rec.userId !== userId) return null;
      return rec;
    },
    save(rec: T, id: string): T {
      guard();
      const all = readTable<T>(table);
      all[id] = rec;
      writeTable(table, all);
      return rec;
    },
    update(id: string, userId: string, patch: Partial<T>): T | null {
      guard();
      const all = readTable<T>(table);
      const rec = all[id];
      if (!rec || rec.userId !== userId) return null;
      const next = { ...rec, ...patch } as T;
      (next as Record<string, unknown>).updatedAt = new Date().toISOString();
      all[id] = next;
      writeTable(table, all);
      return next;
    },
  };
}

export const devClips = namespaced<ClipRecord>("clips.json");

export const devRenders = namespaced<RenderRecord>("renders.json");

export function getBrand(userId: string): BrandRecord {
  guard();
  const all = readTable<BrandRecord>("brands.json");
  return (
    all[userId] ?? {
      userId,
      logoUrl: null,
      primaryColor: "#ffffff",
      captionStyle: "bottom",
      watermarkText: null,
      updatedAt: new Date().toISOString(),
    }
  );
}

export function putBrand(userId: string, patch: Partial<BrandRecord>): BrandRecord {
  guard();
  const all = readTable<BrandRecord>("brands.json");
  const next: BrandRecord = {
    ...getBrand(userId),
    ...patch,
    userId,
    updatedAt: new Date().toISOString(),
  };
  all[userId] = next;
  writeTable("brands.json", all);
  return next;
}
