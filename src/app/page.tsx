import Link from "next/link";
import PageHeader, { HelpPanel, SectionHead } from "@/components/PageHeader";
import StatusStrip from "@/components/StatusStrip";
import StreamerCard from "@/components/StreamerCard";
import ClipOpportunityCard from "@/components/ClipOpportunityCard";
import Icon, { type IconName } from "@/components/Icon";
import { DEMO_CANDIDATES, DEMO_STATUS, DEMO_STREAMERS } from "@/mocks/demo";

/* Command Center — the one screen that answers "what is happening right
   now and what needs me?". Every number on this route comes from
   src/mocks/demo.ts and is labelled DEMO. No fetch happens here. */

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
    body: "Chat spikes and keyword bursts get scored into clip candidates.",
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
        Capture and rendering routes exist in the repo but are not connected to this UI yet — these
        screens are the front end for them.
      </p>
    </section>
  );
}

function ScopePanel() {
  return (
    <section className="panel-3d p-5" aria-label="What is real on this screen">
      <h2 className="text-[13.5px] font-semibold text-[var(--text)]">What is real on this screen</h2>
      <ul className="mt-3 space-y-2.5">
        {[
          ["Layout & components", "Real. Built and running."],
          ["Numbers & channels", "Demo. Fixed values from a mock file."],
          ["Auth session", "Real route, needs a database to sign in."],
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
            <Link href="/clips" className="btn btn-primary">
              Open clip inbox <Icon name="arrow" size={15} />
            </Link>
            <Link href="/radar" className="btn">
              <Icon name="radar" size={15} /> Live radar
            </Link>
          </>
        }
        meta={
          <>
            <span className="chip chip-demo">demo data</span>
            <span className="chip">local build</span>
            <span className="chip">no API calls on this screen</span>
          </>
        }
      />

      <div className="mt-7 space-y-9">
        <StatusStrip
          demo
          stats={[
            { label: "Monitored", value: DEMO_STATUS.monitored, hint: "Channels on the watchlist" },
            { label: "Live now", value: DEMO_STATUS.live, tone: "live", hint: "Broadcasting this minute" },
            { label: "Detected", value: DEMO_STATUS.detected, hint: "Candidates in the inbox" },
            { label: "Awaiting media", value: DEMO_STATUS.awaitingMedia, tone: "warn", hint: "Needs a native clip" },
            { label: "Processing", value: DEMO_STATUS.processing, hint: "Cuts running now" },
            { label: "Awaiting approval", value: DEMO_STATUS.awaitingApproval, hint: "Waiting on you" },
            { label: "Exported", value: DEMO_STATUS.exported, hint: "Files downloaded" },
            { label: "Errors", value: DEMO_STATUS.errors, tone: DEMO_STATUS.errors > 0 ? "bad" : undefined, hint: "Failed stages" },
          ]}
        />

        <Pipeline />

        <div className="grid gap-9 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
          <div className="space-y-9">
            <section aria-labelledby="inbox-heading">
              <SectionHead
                id="inbox-heading"
                title="Needs your attention"
                count={DEMO_CANDIDATES.length}
                hint="Scored moments waiting for a cut, in the order the detector ranked them."
                action={
                  <Link href="/clips" className="btn btn-quiet !h-8 !px-2 !text-[12px]">
                    All clips <Icon name="arrow" size={13} />
                  </Link>
                }
              />
              <div className="grid gap-4 sm:grid-cols-2">
                {DEMO_CANDIDATES.slice(0, 2).map((c) => (
                  <ClipOpportunityCard key={c.id} candidate={c} />
                ))}
              </div>
            </section>

            <section aria-labelledby="radar-heading">
              <SectionHead
                id="radar-heading"
                title="Live radar"
                count={DEMO_STREAMERS.filter((s) => s.live).length}
                hint="One row per monitored channel. Alerts appear as the detector fires."
                action={
                  <Link href="/radar" className="btn btn-quiet !h-8 !px-2 !text-[12px]">
                    Open radar <Icon name="arrow" size={13} />
                  </Link>
                }
              />
              <div className="grid gap-4 sm:grid-cols-2">
                {DEMO_STREAMERS.map((s) => (
                  <StreamerCard key={s.id} streamer={s} />
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-8">
            <HelpPanel
              items={[
                { label: "Read the tiles", body: "The eight counts describe where work sits in the pipeline — not how well anything is performing." },
                { label: "Start here", body: "Open the clip inbox. Cards arrive pre-scored; you decide what gets cut." },
                { label: "Nothing auto-ships", body: "Rendering and export both wait on an explicit approval from you." },
              ]}
            />
            <ScopePanel />
          </aside>
        </div>
      </div>
    </div>
  );
}
