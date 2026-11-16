import Link from "next/link";
import PageHeader, { HelpPanel } from "@/components/PageHeader";
import Icon from "@/components/Icon";
import RadarBoard from "@/components/RadarBoard";
import MarkLiveMoment from "@/components/MarkLiveMoment";
import {
  clipCountsByChannel,
  listChannels,
  monitorAgeSec,
  monitorRunning,
  readMonitor,
} from "@/lib/watchlist";

/* Stage 01 — Monitor. The watchlist and every number on this screen come from
   channels.json and the watcher's monitor.json. The board polls its own API
   every 10s so status stays live without a page reload. */

export const dynamic = "force-dynamic";

export default function RadarPage() {
  const snap = readMonitor();
  const channels = listChannels();
  const clips = clipCountsByChannel();

  // Read the detector's real thresholds out of monitor.json so this screen
  // can never describe a rule the watcher is not actually running.
  const tune = snap?.config;
  const spikeDb = tune?.spikeDb ?? 9;
  const jumpDb = tune?.jumpDb ?? 6;
  const spikeFloorDb = tune?.spikeFloorDb ?? -30;
  const confirmSegs = tune?.spikeConfirmSegments ?? 2;
  const cooldownSec = tune?.cooldownSec ?? 180;

  const worker = {
    running: monitorRunning(snap),
    ageSec: monitorAgeSec(snap),
    pid: snap?.pid ?? null,
    startedAt: snap?.startedAt ?? null,
    updatedAt: snap?.updatedAt ?? null,
    live: snap?.totals?.live ?? 0,
    recording: snap?.totals?.recording ?? 0,
  };

  return (
    <div>
      <PageHeader
        kicker="Stage 01 · Monitor"
        title="Live Radar"
        description="Every channel on the watchlist, what it is streaming right now, and the clip the detector cut from it."
        actions={
          <Link href="/clips" className="btn btn-primary">
            Clip inbox <Icon name="arrow" size={15} />
          </Link>
        }
        meta={
          <>
            <span className="chip">kick.com source</span>
            <span className="chip">4s segments</span>
          </>
        }
      />

      <RadarBoard
        initial={{
          channels: channels.map((c) => ({
            ...c,
            monitor: snap?.channels?.[c.slug] ?? null,
            clips: clips[c.slug] ?? { count: 0, lastAt: null, lastTrigger: null },
          })),
          worker,
        }}
      />
      {!process.env.VERCEL && channels[0] ? <MarkLiveMoment channel={channels[0].slug} /> : null}

      <div className="mt-9 grid gap-5 lg:grid-cols-2 lg:items-start">
        <HelpPanel
          title="How this screen gets its numbers"
          items={[
            {
              label: "Watchlist",
              body: "channels.json in this app's data folder. The watcher re-reads it every 15s, so adding or removing a channel needs no restart.",
            },
            {
              label: "Live status",
              body: "Read from Kick's public channel payload each poll, including the signed HLS playback URL. An offline channel still shows its last title and viewer count.",
            },
            {
              label: "Signal",
              body: `A rolling median of the stream's audio level, plus the level of the four seconds just before. A clip is cut only when the audio is ${spikeDb} dB over that median, ${jumpDb} dB over the moment before it, louder than ${spikeFloorDb} dBFS, and holds for ${confirmSegs} segments in a row. Then nothing new for ${cooldownSec}s — one loud stretch makes one clip, not three.`,
            },
            {
              label: "Clips",
              body: "Counted from clips.json. Each cut carries its trigger, the segment range, and a vertical 1080x1920 render with a QA verdict.",
            },
          ]}
        />

        <HelpPanel
          stacked
          title="What is real here"
          items={[
            { label: "Rows", body: "Written by the watcher on this machine. No sample channels, no placeholder rows." },
            {
              label: "When the worker stops",
              body: "The heartbeat goes stale after 60s and every row is labelled as the last thing written, not a live reading.",
            },
            {
              label: "Chat signals",
              body: "Not connected. Kick's anonymous chat endpoints are closed, so detection runs on the stream's own audio until an official API app is registered.",
            },
          ]}
        />
      </div>
    </div>
  );
}
