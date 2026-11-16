export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { requireUser } from "@/lib/auth";
import {
  addChannel,
  clipCountsByChannel,
  listChannels,
  monitorAgeSec,
  monitorRunning,
  readMonitor,
  removeChannel,
} from "@/lib/watchlist";

/**
 * The watchlist, backed by `channels.json` on this machine.
 *
 * The watcher process re-reads that file every poll interval, so a channel
 * added here starts recording on the next tick and a removed one stops. This
 * route never touches the stream itself — it only edits the list.
 */

function workerSummary(): {
  running: boolean;
  ageSec: number | null;
  pid: number | null;
  startedAt: string | null;
  updatedAt: string | null;
  live: number;
  recording: number;
} {
  const snap = readMonitor();
  return {
    running: monitorRunning(snap),
    ageSec: monitorAgeSec(snap),
    pid: snap?.pid ?? null,
    startedAt: snap?.startedAt ?? null,
    updatedAt: snap?.updatedAt ?? null,
    live: snap?.totals?.live ?? 0,
    recording: snap?.totals?.recording ?? 0,
  };
}

export async function GET(): Promise<Response> {
  if (process.env.VERCEL) return Response.json({ error: "Live monitoring runs on the Mac" }, { status: 501 });
  const user = await requireUser();
  if (user instanceof Response) return user;

  let channels;
  try {
    channels = listChannels();
  } catch {
    return Response.json({ error: "watchlist could not be read" }, { status: 500 });
  }

  const snap = readMonitor();
  const clips = clipCountsByChannel();
  return Response.json({
    channels: channels.map((c) => ({
      ...c,
      monitor: snap?.channels?.[c.slug] ?? null,
      clips: clips[c.slug] ?? { count: 0, lastAt: null, lastTrigger: null },
    })),
    worker: workerSummary(),
  });
}

export async function POST(req: Request): Promise<Response> {
  if (process.env.VERCEL) return Response.json({ error: "Live monitoring runs on the Mac" }, { status: 501 });
  const user = await requireUser();
  if (user instanceof Response) return user;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "expected JSON body" }, { status: 400 });
  }
  const channel = typeof (body as { channel?: unknown })?.channel === "string"
    ? (body as { channel: string }).channel
    : "";
  if (!channel.trim()) {
    return Response.json({ error: "channel is required" }, { status: 400 });
  }

  try {
    const { created, record } = addChannel(channel, user.userId);
    return Response.json(
      { created, channel: record, worker: workerSummary() },
      { status: created ? 201 : 200 },
    );
  } catch (err) {
    return Response.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 400 },
    );
  }
}

export async function DELETE(req: Request): Promise<Response> {
  if (process.env.VERCEL) return Response.json({ error: "Live monitoring runs on the Mac" }, { status: 501 });
  const user = await requireUser();
  if (user instanceof Response) return user;

  const slug = new URL(req.url).searchParams.get("slug") || "";
  try {
    const removed = removeChannel(slug);
    if (!removed) return Response.json({ error: "channel not on the watchlist" }, { status: 404 });
    return Response.json({ removed: slug, worker: workerSummary() });
  } catch (err) {
    return Response.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 400 },
    );
  }
}
