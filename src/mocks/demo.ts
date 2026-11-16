// DEMO-only mock data for frontend development.
// Every consumer must render the DEMO badge alongside these values.
// Real data arrives with Phase 1 Sections 2-4 and Phase 2 Kick monitoring.
export type DemoStreamer = {
  id: string;
  channel: string;
  title: string;
  category: string;
  viewers: number;
  live: boolean;
  channelUrl: string;
  alerts: { id: string; label: string; timeUtc: string }[];
};

export const DEMO_STREAMERS: DemoStreamer[] = [
  {
    id: "demo-1",
    channel: "demo_channel_one",
    title: "GTA 6 free-roam chaos night",
    category: "GTA 6",
    viewers: 12480,
    live: true,
    channelUrl: "https://kick.com/demo_channel_one",
    alerts: [
      { id: "a1", label: "Chat spike x4.2 — police chase", timeUtc: "2026-11-16T02:14:00Z" },
      { id: "a2", label: "Keyword burst — CLIP THAT", timeUtc: "2026-11-16T02:21:00Z" },
    ],
  },
  {
    id: "demo-2",
    channel: "demo_channel_two",
    title: "GTA 6 story mode first playthrough",
    category: "GTA 6",
    viewers: 0,
    live: false,
    channelUrl: "https://kick.com/demo_channel_two",
    alerts: [],
  },
];

export type DemoCandidate = {
  id: string;
  streamer: string;
  sourceUrl: string;
  eventTimeUtc: string;
  score: number;
  scoreNote?: string;
  reasons: string[];
  media: "available" | "needs_media";
};

export const DEMO_CANDIDATES: DemoCandidate[] = [
  {
    id: "demo-c1",
    streamer: "demo_channel_one",
    sourceUrl: "https://kick.com/demo_channel_one",
    eventTimeUtc: "2026-11-16T02:14:00Z",
    score: 82,
    reasons: ["chat spike x4.2 vs 5-min baseline", "keyword burst: CLIP THAT x18"],
    scoreNote: "engagement-potential rank, not a probability",
    media: "needs_media",
  },
  {
    id: "demo-c2",
    streamer: "demo_channel_one",
    sourceUrl: "https://kick.com/demo_channel_one",
    eventTimeUtc: "2026-11-16T02:21:00Z",
    score: 64,
    reasons: ["keyword burst: INSANE x11"],
    scoreNote: "engagement-potential rank, not a probability",
    media: "needs_media",
  },
];

export const DEMO_STATUS = {
  monitored: 2,
  live: 1,
  detected: 2,
  awaitingMedia: 2,
  processing: 0,
  awaitingApproval: 0,
  exported: 0,
  errors: 0,
};
