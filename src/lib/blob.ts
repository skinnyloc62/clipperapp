import { randomUUID } from "node:crypto";

/** True when server-side Blob writes are possible. */
export function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function storageDriver(): "blob" | "local" {
  return process.env.STORAGE_DRIVER === "blob" ? "blob" : "local";
}

/** Strip path components and unsafe characters from a client-supplied filename. */
export function safeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() || "upload";
  const clean = base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 128);
  return clean || `upload_${randomUUID()}`;
}

/** Blob object key for an upload. Never trusts client paths. */
export function blobKey(userId: string, assetId: string, filename: string): string {
  return `uploads/${userId}/${assetId}/${safeFilename(filename)}`;
}
