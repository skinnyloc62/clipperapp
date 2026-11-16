export const runtime = "nodejs";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { stubCandidates, validateCandidate, type HighlightCandidate } from "@/lib/highlights";
import { devClips } from "@/lib/clips";
import { mediaUsesPrisma } from "@/lib/storage-mode";

const bodySchema = z.object({ clipId: z.string().min(1).max(128) });

/**
 * Transcript/highlight stub: deterministic candidates per the adopted rubric
 * (weights + invariants in src/lib/highlights.ts, locked by contract tests).
 * Each candidate is re-validated before persistence; any violation fails the
 * request instead of storing a bad row. Real ASR replaces stubCandidates only.
 */
export async function POST(req: Request): Promise<Response> {
  const user = await requireUser();
  if (user instanceof Response) return user;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "expected JSON {clipId}" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { clipId } = parsed.data;

  // Clip duration bounds candidate windows; derive from the stored range.
  let durationSec: number | null = null;
  if (mediaUsesPrisma()) {
    const { getPrisma } = await import("@/lib/db");
    const clip = await getPrisma().clipProject.findFirst({ where: { id: clipId, userId: user.userId } });
    if (!clip) return Response.json({ error: "unknown clip" }, { status: 404 });
    durationSec = clip.endSec - clip.startSec;
  } else {
    if (process.env.VERCEL) {
      return Response.json({ error: "storage not configured", code: "blob_not_configured" }, { status: 503 });
    }
    const clip = devClips.get(clipId, user.userId);
    if (!clip) return Response.json({ error: "unknown clip" }, { status: 404 });
    durationSec = clip.endSec - clip.startSec;
  }
  if (!durationSec || durationSec <= 0) {
    return Response.json({ error: "clip has no usable duration" }, { status: 409 });
  }

  let candidates: HighlightCandidate[];
  try {
    // Windows are relative to the CLIP (0..clip duration); source mapping
    // (clip offset + clip.startSec) is applied by the editor in Section 3b.
    candidates = stubCandidates(clipId, durationSec);
  } catch (err) {
    console.error("candidate generation failed:", (err as Error).message);
    return Response.json({ error: "candidate generation failed" }, { status: 500 });
  }

  const segmentsJson = JSON.stringify(
    candidates.map((c) => ({ startSec: c.start_seconds, endSec: c.end_seconds, label: c.hook, score: c.score, source: "stub" })),
  );
  if (mediaUsesPrisma()) {
    const { getPrisma } = await import("@/lib/db");
    await getPrisma().transcript.upsert({
      where: { id: `${clipId}:stub` },
      update: { segmentsJson, source: "stub" },
      create: { id: `${clipId}:stub`, clipProjectId: clipId, text: null, segmentsJson, source: "stub" },
    });
  } else {
    devClips.update(clipId, user.userId, { segmentsJson });
  }

  return Response.json({ clipId, source: "stub", candidates }, { status: 200 });
}
