#!/usr/bin/env node
/**
 * Publish owner-approved Mac clips to the hosted viewer.
 *
 * Examples:
 *   node scripts/publish-clips.mjs --dry-run
 *   node scripts/publish-clips.mjs --approve clip_<id>
 *
 * --approve is an explicit owner decision for one registry clip. Without it,
 * only clips already marked approved in the local registry are considered.
 * No generated or placeholder clips are published.
 */
import { createReadStream, existsSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { put, head, BlobNotFoundError } from "@vercel/blob";
import { PrismaClient } from "@prisma/client";

const dataRoot = process.env.CLIPMVP_DATA_DIR ||
  join(homedir(), "Library/Application Support/Street Ethics Clip Engine/data");
const dryRun = process.argv.includes("--dry-run");
const approveIndex = process.argv.indexOf("--approve");
const approvedId = approveIndex >= 0 ? process.argv[approveIndex + 1] : null;
const titleIndex = process.argv.indexOf("--title");
const title = titleIndex >= 0 ? process.argv[titleIndex + 1] : null;
if (approveIndex >= 0 && (!approvedId || !/^clip_[a-zA-Z0-9-]+$/.test(approvedId))) {
  console.error("Usage: --approve clip_<id>");
  process.exit(2);
}
if (titleIndex >= 0 && (!approvedId || !title || title.length > 100)) {
  console.error("--title requires --approve clip_<id> and a title of 1–100 characters");
  process.exit(2);
}

function registry(name) {
  const path = join(dataRoot, name);
  if (!existsSync(path)) throw new Error(`Missing local registry: ${name}`);
  return { path, rows: JSON.parse(readFileSync(path, "utf8")) };
}
function validFile(path) {
  return typeof path === "string" && existsSync(path) && statSync(path).isFile() && statSync(path).size > 0;
}
function writeRegistry(path, rows) {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(rows, null, 2));
  renameSync(tmp, path);
}
async function ensureBlob(key, localPath) {
  try {
    const existing = await head(key);
    return { url: existing.url, uploaded: false };
  } catch (error) {
    if (!(error instanceof BlobNotFoundError)) throw error;
  }
  const result = await put(key, createReadStream(localPath), {
    access: "public", addRandomSuffix: false, multipart: true, contentType: "video/mp4",
  });
  return { url: result.url, uploaded: true };
}

const clips = registry("clips.json");
const renders = registry("renders.json");
if (approvedId && !clips.rows[approvedId]) {
  console.error(`Unknown clip: ${approvedId}`);
  process.exit(2);
}
const candidates = Object.values(clips.rows).filter((clip) =>
  clip.status === "approved" || clip.clipId === approvedId);
let published = 0, already = 0, skipped = 0, failed = 0;
let db;
try {
  if (!dryRun && candidates.length) {
    if (!process.env.DATABASE_URL || !process.env.DIRECT_URL || !process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error("DATABASE_URL, DIRECT_URL, and BLOB_READ_WRITE_TOKEN are required");
    }
    db = new PrismaClient();
  }
  for (const clip of candidates) {
    const render = Object.values(renders.rows).find((row) =>
      row.clipId === clip.clipId && row.status === "done" && row.qa?.status === "PASS");
    if (!render || !validFile(clip.localPath) || !validFile(render.localPath)) {
      console.log(`${clip.clipId} SKIP missing source/render file or passing render QA`);
      skipped++;
      continue;
    }
    if (dryRun) {
      console.log(`${clip.clipId} DRY-RUN would approve and publish ${render.renderId}`);
      published++;
      continue;
    }
    try {
      const prior = await db.clipProject.findUnique({
        where: { id: clip.clipId }, include: { renderJobs: true },
      });
      if (prior?.status === "approved" && prior.clipUrl && (!title || prior.title === title) &&
          prior.renderJobs.some((job) => job.id === render.renderId && job.status === "done" && job.renderUrl)) {
        console.log(`${clip.clipId} ALREADY published ${render.renderId}`);
        already++;
        continue;
      }
      const cut = await ensureBlob(`clips/household/${clip.clipId}.mp4`, clip.localPath);
      const vertical = await ensureBlob(`renders/household/${render.renderId}.mp4`, render.localPath);
      await db.$transaction(async (tx) => {
        await tx.user.upsert({
          where: { id: "household" }, create: { id: "household" }, update: {},
        });
        await tx.clipProject.upsert({
          where: { id: clip.clipId },
          create: {
            id: clip.clipId, userId: "household", assetId: null,
            startSec: clip.startSec, endSec: clip.endSec,
            clipUrl: cut.url, title, status: "approved",
            createdAt: new Date(clip.createdAt),
          },
          update: { clipUrl: cut.url, title: title || prior?.title, status: "approved" },
        });
        await tx.renderJob.upsert({
          where: { id: render.renderId },
          create: {
            id: render.renderId, clipProjectId: clip.clipId,
            renderUrl: vertical.url, preset: render.preset,
            status: "done", createdAt: new Date(render.createdAt),
          },
          update: { renderUrl: vertical.url, status: "done" },
        });
        if (clip.segmentsJson) {
          await tx.transcript.upsert({
            where: { id: `${clip.clipId}:provenance` },
            create: {
              id: `${clip.clipId}:provenance`, clipProjectId: clip.clipId,
              segmentsJson: clip.segmentsJson, source: "kick-live",
            },
            update: { segmentsJson: clip.segmentsJson },
          });
        }
      });
      if (clip.status !== "approved") {
        clips.rows[clip.clipId] = { ...clip, status: "approved", updatedAt: new Date().toISOString() };
        writeRegistry(clips.path, clips.rows);
      }
      console.log(`${clip.clipId} PUBLISHED ${render.renderId} (cut ${cut.uploaded ? "uploaded" : "reused"}, render ${vertical.uploaded ? "uploaded" : "reused"})`);
      published++;
    } catch (error) {
      console.error(`${clip.clipId} FAILED ${error.message}`);
      failed++;
    }
  }
  console.log(`Summary: published=${published} already=${already} skipped=${skipped} failed=${failed} dryRun=${dryRun}`);
  if (failed) process.exitCode = 1;
} catch (error) {
  console.error(`Publish failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (db) await db.$disconnect();
}
