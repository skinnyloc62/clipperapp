import { randomUUID } from "node:crypto";
import { mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { resolveAssetFile } from "./assets";
import { trimFile, renderVertical, probeFile } from "./ffmpeg";
import { fetchBlobToTmp } from "./media";
import { stubCandidates, validateCandidate } from "./highlights";
import { devClips, devRenders, getBrand, putBrand, type QaRecord, type QaCheck } from "./clips";
import { mediaOnLocalDisk, mediaUsesPrisma } from "./storage-mode";
import { MAX_UPLOAD_MB } from "./validators";

/**
 * Clip Engine MCP tool implementations (Vercel-hosted, Streamable HTTP).
 * Every function takes an explicit already-authenticated userId — no cookies,
 * no headers in here, so the same code serves the MCP route and stays
 * unit-testable. All state changes are owner-scoped.
 */

export interface McpOk<T = unknown> {
  ok: true;
  result: T;
}
export interface McpErr {
  ok: false;
  error: string;
  code?: string;
}
export type McpOut<T = unknown> = McpOk<T> | McpErr;

const err = (error: string, code?: string): McpErr => ({ ok: false, error, code });
const done = <T>(result: T): McpOk<T> => ({ ok: true, result });

async function withInputFile(
  userId: string,
  assetId: string,
  fn: (inputPath: string, cleanup: () => void) => Promise<McpOut>,
): Promise<McpOut> {
  const resolved = await resolveAssetFile(assetId, userId);
  if (resolved.kind === "error") {
    const { status: _s, ...rest } = resolved;
    return err(rest.error, rest.code ?? "resolve_failed");
  }
  if (resolved.kind === "blob") {
    try {
      const fetched = await fetchBlobToTmp(resolved.url);
      const cleanup = () => {
        try {
          unlinkSync(fetched.tmpPath);
        } catch { /* best effort */ }
      };
      try {
        return await fn(fetched.tmpPath, cleanup);
      } finally {
        cleanup();
      }
    } catch (e) {
      return err((e as Error).message || "fetch failed", "fetch_failed");
    }
  }
  return fn(resolved.path, () => {});
}

async function recordClip(
  userId: string,
  clipId: string,
  assetId: string,
  startSec: number,
  endSec: number,
  localPath: string | null,
  clipBlobUrl: string | null,
) {
  const now = new Date().toISOString();
  if (mediaUsesPrisma()) {
    const { getPrisma } = await import("./db");
    await getPrisma().clipProject.create({
      data: { id: clipId, assetId, userId, startSec, endSec, clipUrl: clipBlobUrl, status: "pending" },
    });
    return;
  }
  devClips.save(
    {
      clipId, assetId, userId, startSec, endSec, localPath, clipBlobUrl,
      stored: true, status: "cut", segmentsJson: "[]", createdAt: now, updatedAt: now,
    },
    clipId,
  );
}

export const clipengine_status = {
  description: "Clip Engine health and pipeline counts for the authenticated owner.",
  inputSchema: z.object({}),
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  async handler(_args: Record<string, never>, userId: string): Promise<McpOut> {
    void _args;
    return done({
      userId,
      storage: mediaUsesPrisma() ? "postgres" : mediaOnLocalDisk() ? "local-dev" : "unconfigured",
      blob: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
      limits: { maxUploadMB: MAX_UPLOAD_MB, functionBytes: 4_500_000 },
    });
  },
};

export const clipengine_ingest_url = {
  description: "Ingest fourth-party-authorized media from a public URL (native Kick clip export, stock, owned file). Server fetches, caps, and stores it; returns an assetId. Never use for URLs you have no right to reuse.",
  inputSchema: z.object({
    url: z.string().url().max(2048),
    filename: z.string().min(1).max(255).optional(),
    contentType: z.string().min(1).max(127).optional(),
  }),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  async handler(args: { url: string; filename?: string; contentType?: string }, userId: string): Promise<McpOut> {
    if (!/^https:/.test(args.url)) return err("only https URLs are ingested", "bad_url");
    const { fetchBlobToTmp: fetch } = await import("./media");
    let fetched;
    try {
      fetched = await fetch(args.url);
    } catch (e) {
      return err((e as Error).message || "fetch failed", "fetch_failed");
    }
    const probe = await probeFile(fetched.tmpPath);
    try {
      unlinkSync(fetched.tmpPath);
    } catch { /* best effort */ }
    if (!probe.valid) return err(probe.reason || "not valid media", "invalid_media");

    const assetId = `asset_${randomUUID()}`;
    const now = new Date().toISOString();
    const filename = (args.filename || args.url.split("/").pop() || "ingest").slice(0, 128);
    if (mediaUsesPrisma()) {
      const { getPrisma } = await import("./db");
      await getPrisma().mediaAsset.create({
        data: {
          id: assetId, userId, blobUrl: args.url, bytes: fetched.bytes,
          durationSec: probe.durationSec, codec: probe.codec, width: probe.width, height: probe.height,
          status: "uploaded",
        },
      });
      return done({ assetId, stored: true, status: "uploaded", note: "URL stored by reference; Blob copy on first cut/render" });
    }
    if (process.env.VERCEL) return err("storage not configured", "blob_not_configured");
    const { devStore } = await import("./store");
    devStore.save({
      assetId, userId, filename, bytes: fetched.bytes,
      contentType: args.contentType || fetched.contentType || "video/mp4",
      blobUrl: args.url, localPath: null, stored: true, status: "uploaded",
      durationSec: probe.durationSec ?? null, codec: probe.codec ?? null,
      width: probe.width ?? null, height: probe.height ?? null,
      createdAt: now, updatedAt: now,
    });
    return done({ assetId, stored: true, status: "uploaded", durationSec: probe.durationSec });
  },
};

export const clipengine_validate = {
  description: "Validate a stored asset by server-issued asset ID. Resolves storage server-side, probes content, flips status. Never accepts paths.",
  inputSchema: z.object({ assetId: z.string().min(1).max(128) }),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  async handler(args: { assetId: string }, userId: string): Promise<McpOut> {
    const resolved = await resolveAssetFile(args.assetId, userId);
    if (resolved.kind === "error") {
      const { status: _s, ...rest } = resolved;
      return err(rest.error, rest.code ?? "resolve_failed");
    }
    return withInputFile(userId, args.assetId, async (inputPath) => {
      const probe = await probeFile(inputPath);
      if (!probe.valid) return err(probe.reason || "invalid media", "invalid_media");
      return done({ assetId: args.assetId, valid: true, durationSec: probe.durationSec, codec: probe.codec, width: probe.width, height: probe.height });
    });
  },
};

export const clipengine_cut = {
  description: "Trim [startSec, endSec) from a validated asset into a persisted clip. Range must sit inside the asset duration and be <= 60s.",
  inputSchema: z.object({
    assetId: z.string().min(1).max(128),
    startSec: z.number().nonnegative(),
    endSec: z.number().positive(),
  }),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  async handler(args: { assetId: string; startSec: number; endSec: number }, userId: string): Promise<McpOut> {
    const dur = args.endSec - args.startSec;
    if (!(dur > 0) || dur > 60) return err("range must satisfy 0 < end-start <= 60", "bad_range");
    const resolved = await resolveAssetFile(args.assetId, userId);
    if (resolved.kind === "error") {
      const { status: _s, ...rest } = resolved;
      return err(rest.error, rest.code ?? "resolve_failed");
    }
    if (resolved.durationSec == null) return err("asset not validated yet", "needs_validation");
    if (!(args.startSec >= 0) || !(args.endSec <= resolved.durationSec)) {
      return err(`range outside asset duration ${resolved.durationSec}s`, "bad_range");
    }
    return withInputFile(userId, args.assetId, async (inputPath) => {
      const clipId = `clip_${randomUUID()}`;
      if (process.env.VERCEL && !process.env.BLOB_READ_WRITE_TOKEN) {
        return err("storage not configured", "blob_not_configured");
      }
      const out = process.env.VERCEL
        ? join((await import("node:os")).tmpdir(), `${clipId}.mp4`)
        : (() => {
            mkdirSync(join(process.cwd(), ".data", "cuts", userId), { recursive: true });
            return join(process.cwd(), ".data", "cuts", userId, `${clipId}.mp4`);
          })();
      const trim = await trimFile(inputPath, args.startSec, dur, out);
      if (!trim.ok) return err(trim.reason || "trim failed", "trim_failed");
      const check = await probeFile(out);
      if (!check.valid) return err("trimmed clip failed verification", "verify_failed");
      let clipBlobUrl: string | null = null;
      let localPath: string | null = out;
      if (process.env.VERCEL && process.env.BLOB_READ_WRITE_TOKEN) {
        const { put } = await import("@vercel/blob");
        const { readFileSync, unlinkSync: rm } = await import("node:fs");
        const uploaded = await put(`clips/${userId}/${clipId}.mp4`, readFileSync(out), { access: "public", contentType: "video/mp4" });
        rm(out);
        clipBlobUrl = uploaded.url;
        localPath = null;
      }
      await recordClip(userId, clipId, args.assetId, args.startSec, args.endSec, localPath, clipBlobUrl);
      return done({ clipId, stored: true, status: "cut", clipBlobUrl });
    });
  },
};

export const clipengine_highlights = {
  description: "Score deterministic highlight candidates for a clip per the adopted rubric (hook 20/clarity 20/payoff 20/novelty 15/emotion 10/fit 10/technical 5). Editorial rank, never a virality probability.",
  inputSchema: z.object({ clipId: z.string().min(1).max(128) }),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  async handler(args: { clipId: string }, userId: string): Promise<McpOut> {
    let durationSec: number | null = null;
    if (mediaUsesPrisma()) {
      const { getPrisma } = await import("./db");
      const clip = await getPrisma().clipProject.findFirst({ where: { id: args.clipId, userId } });
      if (!clip) return err("unknown clip", "not_found");
      durationSec = clip.endSec - clip.startSec;
    } else {
      if (process.env.VERCEL) return err("storage not configured", "blob_not_configured");
      const clip = devClips.get(args.clipId, userId);
      if (!clip) return err("unknown clip", "not_found");
      durationSec = clip.endSec - clip.startSec;
    }
    if (!durationSec || durationSec <= 0) return err("clip has no usable duration", "bad_clip");
    try {
      const candidates = stubCandidates(args.clipId, durationSec);
      for (const c of candidates) {
        const v = validateCandidate(c, durationSec);
        if (v) return err(`candidate invalid: ${v}`, "contract_violation");
      }
      return done({ clipId: args.clipId, source: "stub", candidates });
    } catch (e) {
      return err((e as Error).message || "scoring failed", "scoring_failed");
    }
  },
};

export const clipengine_render = {
  description: "Render a clip to vertical 1080x1920 MP4 with machine QA gates. Unimplemented checks report NOT_TESTED, never PASS.",
  inputSchema: z.object({ clipId: z.string().min(1).max(128) }),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  async handler(args: { clipId: string }, userId: string): Promise<McpOut> {
    let clipLocal: string | null = null;
    let clipBlob: string | null = null;
    if (mediaUsesPrisma()) {
      const { getPrisma } = await import("./db");
      const clip = await getPrisma().clipProject.findFirst({ where: { id: args.clipId, userId } });
      if (!clip) return err("unknown clip", "not_found");
      clipBlob = clip.clipUrl;
    } else {
      if (process.env.VERCEL) return err("storage not configured", "blob_not_configured");
      const clip = devClips.get(args.clipId, userId);
      if (!clip) return err("unknown clip", "not_found");
      clipLocal = clip.localPath;
      clipBlob = clip.clipBlobUrl;
    }
    let inputPath: string;
    if (clipBlob) {
      try {
        const fetched = await fetchBlobToTmp(clipBlob);
        inputPath = fetched.tmpPath;
      } catch (e) {
        return err((e as Error).message || "fetch failed", "fetch_failed");
      }
    } else if (clipLocal) {
      inputPath = clipLocal;
    } else {
      return err("clip media not stored", "not_stored");
    }
    const renderId = `render_${randomUUID()}`;
    const out = process.env.VERCEL
      ? join((await import("node:os")).tmpdir(), `${renderId}.mp4`)
      : (() => {
          mkdirSync(join(process.cwd(), ".data", "renders", userId), { recursive: true });
          return join(process.cwd(), ".data", "renders", userId, `${renderId}.mp4`);
        })();
    const r = await renderVertical(inputPath, out);
    if (clipBlob) {
      try {
        unlinkSync(inputPath);
      } catch { /* best effort */ }
    }
    if (!r.ok) return err(r.reason || "render failed", "render_failed");
    const probe = await probeFile(out);
    const checks = [
      { name: "artifact_exists", status: "PASS" as const, detail: "ffmpeg exited clean" },
      { name: "dimensions_1080x1920", status: (probe.width === 1080 && probe.height === 1920 ? "PASS" : "FAIL") as "PASS" | "FAIL", detail: `${probe.width}x${probe.height}` },
      { name: "has_video_stream", status: (probe.valid && probe.codec ? "PASS" : "FAIL") as "PASS" | "FAIL", detail: `codec=${probe.codec ?? "none"}` },
      { name: "duration_positive", status: (probe.valid && probe.durationSec && probe.durationSec > 0 ? "PASS" : "FAIL") as "PASS" | "FAIL", detail: `${probe.durationSec ?? "unknown"}s` },
      { name: "no_leading_black_frames", status: "NOT_TESTED" as const, detail: "frame-content analysis not implemented" },
      { name: "caption_safe_zones", status: "NOT_TESTED" as const, detail: "no captions burned in by this stub" },
      { name: "branding_overlay", status: "NOT_TESTED" as const, detail: "brand templates land in 3b" },
      { name: "loudness_target", status: "NOT_TESTED" as const, detail: "loudness not measured by this stub" },
    ];
    const failed = checks.filter((c) => c.status === "FAIL");
    const qa = { source_id: args.clipId, clip_asset_id: null, status: (failed.length ? "REVISE" : "PASS") as "REVISE" | "PASS", checks, tested_at: new Date().toISOString() };
    const now = new Date().toISOString();
    if (mediaUsesPrisma()) {
      const { getPrisma } = await import("./db");
      await getPrisma().renderJob.create({ data: { id: renderId, clipProjectId: args.clipId, preset: "vertical-1080x1920", status: "done" } });
    } else {
      devRenders.save({ renderId, clipId: args.clipId, userId, preset: "vertical-1080x1920", localPath: process.env.VERCEL ? null : out, renderBlobUrl: null, stored: true, status: "done", qa: qa as QaRecord, createdAt: now, updatedAt: now }, renderId);
    }
    return done({ renderId, status: "done", qa });
  },
};

export const clipengine_qa = {
  description: "Read the machine QA record for a render.",
  inputSchema: z.object({ renderId: z.string().min(1).max(128) }),
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  async handler(args: { renderId: string }, userId: string): Promise<McpOut> {
    if (mediaUsesPrisma()) {
      const { getPrisma } = await import("./db");
      const job = await getPrisma().renderJob.findFirst({ where: { id: args.renderId }, include: { clipProject: { select: { userId: true } } } });
      if (!job || job.clipProject.userId !== userId) return err("unknown render", "not_found");
      return done({ renderId: job.id, status: job.status, note: "file-level QA lives in dev mode; DB stores job status" });
    }
    if (process.env.VERCEL) return err("storage not configured", "blob_not_configured");
    const rec = devRenders.get(args.renderId, userId);
    if (!rec) return err("unknown render", "not_found");
    return done({ renderId: rec.renderId, status: rec.status, qa: rec.qa });
  },
};

export const clipengine_approve = {
  description: "Approve or reject a clip. Approval unlocks download only; it is not publication and does not clear rights review.",
  inputSchema: z.object({ clipId: z.string().min(1).max(128), decision: z.enum(["approved", "rejected"]) }),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  async handler(args: { clipId: string; decision: "approved" | "rejected" }, userId: string): Promise<McpOut> {
    const status = args.decision === "approved" ? "approved" : "rejected";
    if (mediaUsesPrisma()) {
      const { getPrisma } = await import("./db");
      const updated = await getPrisma().clipProject.updateMany({ where: { id: args.clipId, userId }, data: { status } });
      if (updated.count === 0) return err("unknown clip", "not_found");
      return done({ clipId: args.clipId, status });
    }
    if (process.env.VERCEL) return err("storage not configured", "blob_not_configured");
    const updated = devClips.update(args.clipId, userId, { status });
    if (!updated) return err("unknown clip", "not_found");
    return done({ clipId: args.clipId, status: updated.status });
  },
};

export const clipengine_download = {
  description: "Get a download handle for a render (or an approved clip). Blob mode returns a URL; local dev returns a path note (use the dashboard download route to stream it).",
  inputSchema: z.object({ id: z.string().min(1).max(160) }),
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  async handler(args: { id: string }, userId: string): Promise<McpOut> {
    if (mediaUsesPrisma()) {
      if (args.id.startsWith("render_")) {
        const { getPrisma } = await import("./db");
        const job = await getPrisma().renderJob.findFirst({ where: { id: args.id }, include: { clipProject: { select: { userId: true } } } });
        if (!job || job.clipProject.userId !== userId || !job.renderUrl) return err("unknown download", "not_found");
        return done({ url: job.renderUrl });
      }
      if (args.id.startsWith("clip_")) {
        const { getPrisma } = await import("./db");
        const clip = await getPrisma().clipProject.findFirst({ where: { id: args.id, userId } });
        if (!clip || clip.status !== "approved" || !clip.clipUrl) return err("unknown download", "not_found");
        return done({ url: clip.clipUrl });
      }
      return err("unknown download", "not_found");
    }
    if (process.env.VERCEL) return err("storage not configured", "blob_not_configured");
    if (args.id.startsWith("render_")) {
      const rec = devRenders.get(args.id, userId);
      if (!rec || !rec.stored || !rec.localPath) return err("unknown download", "not_found");
      return done({ localPath: rec.localPath, via: "GET /api/downloads/[renderId] with session cookie" });
    }
    if (args.id.startsWith("clip_")) {
      const rec = devClips.get(args.id, userId);
      if (!rec || rec.status !== "approved" || !rec.localPath) return err("unknown download", "not_found");
      return done({ localPath: rec.localPath, via: "GET /api/downloads/[renderId] with session cookie" });
    }
    return err("unknown download", "not_found");
  },
};

export const clipengine_brand_get = {
  description: "Read the caller's brand profile.",
  inputSchema: z.object({}),
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  async handler(_args: Record<string, never>, userId: string): Promise<McpOut> {
    void _args;
    if (process.env.DATABASE_URL) {
      const { getPrisma } = await import("./db");
      const row = await getPrisma().brandSetting.findUnique({ where: { userId } });
      return done(row ?? { userId, logoUrl: null, primaryColor: "#ffffff", captionStyle: "bottom", watermarkText: null });
    }
    if (process.env.VERCEL) return err("storage not configured", "blob_not_configured");
    return done(getBrand(userId));
  },
};

export const clipengine_brand_update = {
  description: "Update the caller's brand profile. Fields are allowlisted; logo must be an https URL.",
  inputSchema: z.object({
    logoUrl: z.string().url().max(2048).optional(),
    primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).max(7).optional(),
    captionStyle: z.enum(["bottom", "top", "karaoke"]).optional(),
    watermarkText: z.string().min(1).max(64).optional(),
  }),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  async handler(args: { logoUrl?: string; primaryColor?: string; captionStyle?: "bottom" | "top" | "karaoke"; watermarkText?: string }, userId: string): Promise<McpOut> {
    if (args.logoUrl && !/^https:/.test(args.logoUrl)) return err("logo must be https", "bad_url");
    if (process.env.DATABASE_URL) {
      const { getPrisma } = await import("./db");
      const row = await getPrisma().brandSetting.upsert({ where: { userId }, update: { ...args }, create: { userId, ...args } });
      return done(row);
    }
    if (process.env.VERCEL) return err("storage not configured", "blob_not_configured");
    return done(putBrand(userId, { ...args }));
  },
};

export const CLIPENGINE_TOOLS = {
  clipengine_status,
  clipengine_ingest_url,
  clipengine_validate,
  clipengine_cut,
  clipengine_highlights,
  clipengine_render,
  clipengine_qa,
  clipengine_approve,
  clipengine_download,
  clipengine_brand_get,
  clipengine_brand_update,
} as const;
