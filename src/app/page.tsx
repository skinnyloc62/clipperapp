import Link from "next/link";
import PageHeader, { HelpPanel, SectionHead } from "@/components/PageHeader";
import StatusStrip from "@/components/StatusStrip";
import EmptyState from "@/components/EmptyState";
import Icon, { type IconName } from "@/components/Icon";
import { readDashboard } from "@/lib/dashboard";
import {
  listChannels,
  monitorAgeSec,
  monitorRunning,
  readMonitor,
  type ChannelMonitor,
  type ChannelRecord,
} from "@/lib/watchlist";

/* Command Center — the one screen that answers "what is happening right
   now and what needs me?". Every count is read from records this app wrote
   (src/lib/dashboard.ts). Nothing on this route is invented: where a stage
   has produced no records yet, the section says so instead of filling in. */

export const dynamic = "force-dynamic";

type Stage = { n: string; title: string; icon: IconName; body: string; href: string };

const STAGES: Stage[] = [
  {
    n: "01",
    title: "Monitor",
    icon: "radar",
    body: "Watch each Kick channel you add and record detection events.",
    href: "/radar",
  },
  {
    n: "02",
    title: "Detect",
    icon: "spark",
    body: "A sustained jump above the stream's own audio bed gets scored into a clip candidate.",
    href: "/clips",
  },
  {
    n: "03",
    title: "Cut",
    icon: "scissors",
    body: "Trim the moment, reframe vertical, burn captions.",
    href: "/editor",
  },
  {
    n: "04",
    title: "Approve",
    icon: "check",
    body: "Nothing renders or leaves the app until you approve it.",
    href: "/approvals",
  },
  {
    n: "05",
    title: "Export",
    icon: "upload",
    body: "Download the master file, then post it wherever you post.",
    href: "/earnings",
  },
];

/* UTC clock from an ISO stamp — no timezone drift between server and client. */
function shortUtc(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  return m ? `${m[2]}/${m[3]} · ${m[4]}:${m[5]} UTC` : iso;
}

function Pipeline() {
  return (
    <section aria-labelledby="pipeline-heading" className="panel-3d overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <h2 id="pipeline-heading" className="text-[13.5px] font-semibold text-[var(--text)]">
            The pipeline
          </h2>
          <span className="chip">5 stages</span>
        </div>
        <p className="text-[11.5px] text-[var(--faint)]">Left to right. Every stage has its own screen.</p>
      </div>

      <ol className="grid gap-px bg-white/[0.055] sm:grid-cols-2 lg:grid-cols-5">
        {STAGES.map((s) => (
          <li key={s.n} className="group relative bg-[var(--panel)]">
            <Link href={s.href} className="flex h-full flex-col gap-2 p-4 transition-colors hover:bg-[var(--panel-2)]">
              <div className="flex items-center justify-between">
                <span className="num text-[10.5px] tracking-[0.14em] text-[var(--faint)]">{s.n}</span>
                <Icon
                  name={s.icon}
                  size={16}
                  className="text-[var(--faint)] transition-colors group-hover:text-[var(--red-hi)]"
                />
              </div>
              <span className="text-[13px] font-medium text-[var(--text)]">{s.title}</span>
              <span className="text-[11.5px] leading-relaxed text-[var(--faint)]">{s.body}</span>
            </Link>
          </li>
        ))}
      </ol>

      <p className="border-t border-[var(--line)] bg-white/[0.012] px-5 py-3 text-[11.5px] leading-relaxed text-[var(--faint)]">
        Upload, cut, and export routes are wired to this machine, and the watcher records and cuts on its own
        once it is running. This footer changes nothing that the counters above do not already prove.
      </p>
    </section>
  );
}

const nf = new Intl.NumberFormat("en-US");

function ChannelMini({ channel, monitor }: { channel: ChannelRecord; monitor: ChannelMonitor | null }) {
  const live = Boolean(monitor?.live);
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
      <div className="flex min-w-0 items-baseline gap-2">
        <span
          aria-hidden="true"
          className="mt-[5px] h-[6px] w-[6px] shrink-0 rounded-full"
          style={{ background: live ? "#3ddc97" : "rgba(255,255,255,0.18)" }}
        />
        <span className="truncate text-[13px] font-medium text-[var(--text)]">/{channel.slug}</span>
        <span className="truncate text-[11.5px] text-[var(--faint)]">
          {monitor?.title || (monitor ? "no title reported" : "not polled yet")}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {live ? (
          <span className="chip chip-live">
            {typeof monitor?.viewers === "number" ? `${nf.format(monitor.viewers)} watching` : "live"}
          </span>
        ) : (
          <span className="chip">offline</span>
        )}
        <span className="num text-[11.5px] text-[var(--faint)]">
          {monitor ? `${monitor.bufferedSec}s buffered` : "—"}
        </span>
        <span className="num text-[11.5px] text-[var(--faint)]">{monitor?.clips ?? 0} clips</span>
      </div>
    </li>
  );
}

function ScopePanel({ readable, watching }: { readable: boolean; watching: boolean }) {
  return (
    <section className="panel-3d p-5" aria-label="What is real on this screen">
      <h2 className="text-[13.5px] font-semibold text-[var(--text)]">What is real on this screen</h2>
      <ul className="mt-3 space-y-2.5">
        {[
          ["Layout & components", "Real. Built and running."],
          [
            "Counters",
            readable ? "Real. Counted from this machine's data folder." : "Unavailable on this host — no local data folder.",
          ],
          [
            "Clip detection",
            watching ? "Running on this machine — a clip needs a sustained jump above the stream's audio bed." : "Idle. Start the watcher to detect anything.",
          ],
          [
            "Channels & viewers",
            watching ? "Real. Polled from kick.com every 15s and written to monitor.json." : "Watchlist is on disk; nothing is polling right now.",
          ],
          ["Video previews", "None. No media is faked here."],
        ].map(([k, v]) => (
          <li key={k} className="flex items-baseline justify-between gap-3 border-b border-[var(--line)] pb-2.5 last:border-0 last:pb-0">
            <span className="text-[12.5px] text-[var(--muted)]">{k}</span>
            <span className="shrink-0 text-right text-[12px] text-[var(--faint)]">{v}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function CommandCenterPage() {
  const data = readDashboard();
  const channels = listChannels();
  const snap = readMonitor();
  const workerRunning = monitorRunning(snap);
  const heartbeat = monitorAgeSec(snap);
  const liveNow = channels.filter((c) => snap?.channels?.[c.slug]?.live).length;

  return (
    <div>
      <PageHeader
        kicker="Street Ethics · Clip Engine"
        title={
          <>
            Command <span className="text-[var(--red-hi)]">Center</span>
          </>
        }
        description="Watch the channels you care about, catch the moment that matters, and ship it — without a second app or a spreadsheet."
        actions={
          <>
            <Link href="/editor" className="btn btn-primary">
              Upload &amp; cut <Icon name="arrow" size={15} />
            </Link>
            <Link href="/radar" className="btn">
              <Icon name="radar" size={15} /> Live radar
            </Link>
          </>
        }
        meta={
          <>
            <span className="chip">local build</span>
            <span className="chip">counts read from disk</span>
            <span className="chip">{workerRunning ? "watcher running" : "watcher stopped"}</span>
          </>
        }
      />

      <div className="mt-7 space-y-9">
        <StatusStrip
          stats={[
            { label: "Uploaded", value: data.uploaded, hint: "Source files on this machine" },
            { label: "Cuts", value: data.cuts, hint: "Clips created from sources" },
            { label: "Awaiting you", value: data.awaitingApproval, tone: data.awaitingApproval > 0 ? "warn" : undefined, hint: "Cuts with no decision" },
            { label: "Approved", value: data.approved, hint: "Cleared to render" },
            { label: "Rendering", value: data.processing, hint: "Queued or running" },
            { label: "Exported", value: data.exported, hint: "Finished renders" },
            { label: "Failed", value: data.failed, tone: data.failed > 0 ? "bad" : undefined, hint: "Stages that errored" },
            {
              label: "Channels",
              value: channels.length,
              hint: workerRunning
                ? `${liveNow} live · heartbeat ${heartbeat ?? "—"}s ago`
                : channels.length
                  ? "On the watchlist · watcher stopped"
                  : "Watchlist empty",
            },
          ]}
        />

        <Pipeline />

        <div className="grid gap-9 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
          <div className="space-y-9">
            <section aria-labelledby="inbox-heading">
              <SectionHead
                id="inbox-heading"
                title="Needs your attention"
                count={data.awaitingApproval}
                hint="Cuts waiting on a decision, newest first."
                action={
                  <Link href="/approvals" className="btn btn-quiet !h-8 !px-2 !text-[12px]">
                    Approvals <Icon name="arrow" size={13} />
                  </Link>
                }
              />
              {data.recentCuts.length > 0 ? (
                <ul className="panel-3d divide-y divide-[var(--line)] overflow-hidden">
                  {data.recentCuts.map((c) => (
                    <li key={c.clipId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                      <div className="min-w-0">
                        <p className="num truncate text-[12.5px] text-[var(--text)]">{c.clipId}</p>
                        <p className="num mt-0.5 text-[11px] text-[var(--faint)]">
                          {Math.max(0, Math.round(c.endSec - c.startSec))}s · {shortUtc(c.createdAt)}
                        </p>
                      </div>
                      <span
                        className={
                          "chip " +
                          (c.status === "approved" ? "chip-live" : c.status === "rejected" ? "chip-red" : "chip-warn")
                        }
                      >
                        {c.status}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon="scissors"
                  title="Nothing is waiting on you"
                  body="No cut has been created yet, so there is nothing to approve. Upload a source on the Editor screen and cut a moment — it appears here with its status."
                  action={
                    <Link href="/editor" className="btn btn-primary">
                      Open editor <Icon name="arrow" size={15} />
                    </Link>
                  }
                  note="Empty because no clip exists — not a loading state"
                />
              )}
            </section>

            <section aria-labelledby="radar-heading">
              <SectionHead
                id="radar-heading"
                title="Live radar"
                count={channels.length}
                hint="One row per monitored channel, with the last thing the watcher reported."
                action={
                  <Link href="/radar" className="btn btn-quiet !h-8 !px-2 !text-[12px]">
                    Open radar <Icon name="arrow" size={13} />
                  </Link>
                }
              />
              {channels.length === 0 ? (
                <EmptyState
                  icon="radar"
                  title="No channels on the watchlist"
                  body="Add a Kick channel on the radar screen and the watcher starts recording it on its next poll. Each channel then appears here with its live status, buffer depth, and how many clips it has produced."
                  action={
                    <Link href="/radar" className="btn btn-primary">
                      Add a channel <Icon name="arrow" size={15} />
                    </Link>
                  }
                  note="Empty because nothing is watched — not a loading state"
                />
              ) : (
                <div className="panel-3d overflow-hidden">
                  <ul className="divide-y divide-[var(--line)]">
                    {channels.map((c) => (
                      <ChannelMini key={c.slug} channel={c} monitor={snap?.channels?.[c.slug] ?? null} />
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-8">
            <HelpPanel
              items={[
                { label: "Read the tiles", body: "The eight counts describe where work sits in the pipeline — not how well anything is performing." },
                { label: "Start here", body: "Upload a source, cut it, then approve it. Each tile fills in as you go." },
                { label: "Nothing auto-ships", body: "Rendering and export both wait on an explicit approval from you." },
              ]}
            />
            <ScopePanel readable={data.readable} watching={workerRunning} />
          </aside>
        </div>
      </div>
    </div>
  );
}
