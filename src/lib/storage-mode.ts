import { blobConfigured, storageDriver } from "./blob";

/**
 * Where media (uploads, cuts, renders) is persisted.
 *
 * Media has two homes:
 *  - local disk + the JSON registries in `store.ts` / `clips.ts` (this process owns the files), or
 *  - serverless storage: Postgres rows that point at public Blob URLs.
 *
 * Postgres media rows carry `blobUrl` only — there is no local-path column — so a database
 * connection alone cannot represent a file on disk. Users and the brand profile are different:
 * they hold no file reference and always follow `DATABASE_URL`.
 *
 * `mediaOnLocalDisk()` is therefore the switch for the media domain, and it is deliberately
 * conservative: local disk only when this is not Vercel, the driver says local, and no Blob
 * token exists. Change any of those and the Prisma + Blob path takes over automatically.
 */
export function mediaOnLocalDisk(): boolean {
  if (process.env.VERCEL) return false;
  if (blobConfigured()) return false;
  return storageDriver() === "local";
}

/** True when media rows must live in Postgres and point at Blob URLs. */
export function mediaUsesPrisma(): boolean {
  return Boolean(process.env.DATABASE_URL) && !mediaOnLocalDisk();
}
