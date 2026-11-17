export const runtime = "nodejs";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { resolveAssetFile } from "@/lib/assets";
import { dataPath } from "@/lib/data-root";
import { scoutVideo } from "../../../../scripts/scout-video.mjs";

const bodySchema = z.object({ assetId: z.string().min(1).max(128),
  markSec: z.number().finite().nonnegative().max(43200).optional() });

/** Electron/local only: analyze a saved source file and persist the report. */
export async function POST(req: Request): Promise<Response> {
  if (process.env.VERCEL) return Response.json({ error: "Local scout only" }, { status: 501 });
  const user = await requireUser();
  if (user instanceof Response) return user;
  let body: unknown;
  try { body = await req.json(); }
  catch { return Response.json({ error: "expected JSON {assetId, markSec?}" }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid asset or time mark." }, { status: 400 });
  const resolved = await resolveAssetFile(parsed.data.assetId, user.userId);
  if (resolved.kind === "error") return Response.json({ error: resolved.error }, { status: resolved.status });
  if (resolved.kind !== "local") return Response.json({ error: "Scout needs a local source file." }, { status: 409 });
  try {
    const report = await scoutVideo(resolved.path, { marks: parsed.data.markSec == null ? [] : [parsed.data.markSec], limit: 5 });
    report.source = parsed.data.assetId;
    const dir = dataPath("scouts", user.userId);
    await mkdir(dir, { recursive: true });
    const reportId = `scout_${randomUUID()}`;
    await writeFile(join(dir, `${reportId}.json`), JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
    return Response.json({ reportId, report });
  } catch (error) {
    return Response.json({ error: String((error as Error).message).slice(0, 180) }, { status: 422 });
  }
}
