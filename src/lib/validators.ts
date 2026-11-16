import { z } from "zod";

export const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB ?? 500);
export const MAX_CLIP_SEC = Number(process.env.MAX_CLIP_SEC ?? 60);

export const uploadMetaSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(127),
});

export const uploadRequestSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(127),
  size: z.number().int().nonnegative(),
});

/** Section 2: asset ID only. Server resolves storage — clients never send paths. */
export const validateClipSchema = z.object({
  assetId: z.string().min(1).max(128),
});

export const cutSchema = z
  .object({
    assetId: z.string().min(1).max(128),
    startSec: z.number().nonnegative(),
    endSec: z.number().positive(),
  })
  .refine((v) => v.endSec > v.startSec, { message: "endSec must exceed startSec" })
  .refine((v) => v.endSec - v.startSec <= MAX_CLIP_SEC, {
    message: `clip length must be <= ${MAX_CLIP_SEC}s`,
  });

export function isVideoMime(mime: string): boolean {
  return mime.startsWith("video/") || mime === "application/octet-stream";
}

export function isUploadTooLarge(bytes: number): boolean {
  return bytes > MAX_UPLOAD_MB * 1024 * 1024;
}

export const brandSchema = z.object({
  logoUrl: z.string().url().max(2048).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).max(7).optional(),
  captionStyle: z.enum(["bottom", "top", "karaoke"]).optional(),
  watermarkText: z.string().min(1).max(64).optional(),
});

export const approvalSchema = z.object({
  clipId: z.string().min(1).max(128),
  decision: z.enum(["approved", "rejected"]),
});

export const renderSchema = z.object({
  clipId: z.string().min(1).max(128),
  preset: z.enum(["vertical-1080x1920"]).default("vertical-1080x1920"),
});
