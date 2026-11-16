import { WORKSPACE_USER_ID } from "./auth";
import { devClips, devRenders, type ClipRecord } from "./clips";
import { mediaOnLocalDisk } from "./storage-mode";
import { devStore } from "./store";

/**
 * Real pipeline counters for the Command Center.
 *
 * Every value here is counted from records this app actually wrote — uploads in
 * `assets.json`, cuts in `clips.json`, renders in `renders.json`. Nothing is
 * estimated, sampled, or carried over from a fixture.
 *
 * The registries only exist where media lives on local disk. On a serverless
 * host (or any host without those files) the read is skipped and `readable` is
 * false, so the UI can say "not available here" instead of printing zeros that
 * look like a healthy empty pipeline.
 */

export interface Dashboard {
  /** Source files written to the local data folder. */
  uploaded: number;
  /** Cuts created from those sources. */
  cuts: number;
  /** Cuts waiting on an approval decision. */
  awaitingApproval: number;
  approved: number;
  rejected: number;
  /** Renders queued or running. */
  processing: number;
  /** Renders finished and downloadable. */
  exported: number;
  failed: number;
  /** Newest cuts, for the "needs your attention" list. */
  recentCuts: ClipRecord[];
  /** False when the local registries could not be read on this host. */
  readable: boolean;
}

const EMPTY: Dashboard = {
  uploaded: 0,
  cuts: 0,
  awaitingApproval: 0,
  approved: 0,
  rejected: 0,
  processing: 0,
  exported: 0,
  failed: 0,
  recentCuts: [],
  readable: false,
};

export function readDashboard(userId: string = WORKSPACE_USER_ID): Dashboard {
  if (!mediaOnLocalDisk()) return { ...EMPTY };

  try {
    const assets = devStore.list(userId);
    const clips = devClips.list(userId);
    const renders = devRenders.list(userId);

    return {
      uploaded: assets.length,
      cuts: clips.length,
      awaitingApproval: clips.filter((c) => c.status === "cut").length,
      approved: clips.filter((c) => c.status === "approved").length,
      rejected: clips.filter((c) => c.status === "rejected").length,
      processing: renders.filter((r) => r.status === "queued" || r.status === "running").length,
      exported: renders.filter((r) => r.status === "done").length,
      failed: renders.filter((r) => r.status === "failed").length,
      recentCuts: clips.slice(0, 3),
      readable: true,
    };
  } catch {
    // A malformed or unreadable registry must not take the home screen down.
    return { ...EMPTY };
  }
}
