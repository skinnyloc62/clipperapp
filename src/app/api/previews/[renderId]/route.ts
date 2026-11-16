export const runtime = "nodejs";

import { readFileSync, realpathSync, statSync } from "node:fs";
import { relative, isAbsolute } from "node:path";
import { requireUser } from "@/lib/auth";
import { devClips, devRenders } from "@/lib/clips";
import { dataPath } from "@/lib/data-root";

/** Review playback for the owner on this Mac. Publication and downloads stay gated. */
export async function GET(req: Request, ctx: { params: Promise<{ renderId: string }> }): Promise<Response> {
  const user = await requireUser();
  if (user instanceof Response) return user;
  if (process.env.VERCEL) return Response.json({ error: "local preview only" }, { status: 404 });

  const { renderId } = await ctx.params;
  if (!/^render_[a-zA-Z0-9-]{1,150}$/.test(renderId))
    return Response.json({ error: "unknown preview" }, { status: 404 });
  const render = devRenders.get(renderId, user.userId);
  const clip = render && devClips.get(render.clipId, user.userId);
  if (!render || !clip || render.status !== "done" || !render.localPath)
    return Response.json({ error: "unknown preview" }, { status: 404 });

  try {
    const root = realpathSync(dataPath());
    const path = realpathSync(render.localPath);
    const rel = relative(root, path);
    if (!rel || rel.startsWith("..") || isAbsolute(rel))
      return Response.json({ error: "unknown preview" }, { status: 404 });
    const size = statSync(path).size;
    const range = req.headers.get("range");
    const match = range?.match(/^bytes=(\d*)-(\d*)$/);
    if (range && !match) return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
    const start = match?.[1] ? Number(match[1]) : 0;
    const end = match?.[2] ? Number(match[2]) : size - 1;
    if (start > end || end >= size || (range && !match?.[1] && !match?.[2]))
      return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
    const bytes = readFileSync(path).subarray(start, end + 1);
    return new Response(new Uint8Array(bytes), {
      status: range ? 206 : 200,
      headers: {
        "content-type": "video/mp4",
        "content-disposition": "inline",
        "content-length": String(bytes.byteLength),
        "accept-ranges": "bytes",
        ...(range ? { "content-range": `bytes ${start}-${end}/${size}` } : {}),
        "cache-control": "private, no-store",
      },
    });
  } catch {
    return Response.json({ error: "stored file missing" }, { status: 410 });
  }
}
