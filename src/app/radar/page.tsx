import Link from "next/link";
import PageHeader, { HelpPanel, SectionHead } from "@/components/PageHeader";
import StreamerCard from "@/components/StreamerCard";
import Icon from "@/components/Icon";
import { DEMO_STREAMERS } from "@/mocks/demo";

/* Stage 01 — Monitor. Shows the watchlist and, honestly, that the
   polling loop is not attached in this build. */

const FACTS = [
  { label: "Watchlist", value: "2", note: "channels" },
  { label: "Live now", value: "1", note: "broadcasting" },
  { label: "Detector", value: "2", note: "signals armed" },
];

function Scope() {
  return (
    <div className="relative mx-auto h-[150px] w-[150px] shrink-0 sm:h-[168px] sm:w-[168px]" aria-hidden="true">
      <div className="absolute inset-0 rounded-full border border-[var(--line-2)] bg-[radial-gradient(circle_at_50%_50%,rgba(225,6,0,0.05),rgba(0,0,0,0.25))]" />
      <div className="absolute inset-[13%] rounded-full border border-[var(--line)]" />
      <div className="absolute inset-[31%] rounded-full border border-[var(--line)]" />
      <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/[0.055]" />
      <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/[0.055]" />
      <div className="radar-sweep" />
      <span className="absolute left-[26%] top-[63%] h-[5px] w-[5px] rounded-full bg-[var(--green)] shadow-[0_0_10px_rgba(61,220,151,0.95)]" />
      <span className="absolute left-[26%] top-[63%] h-[13px] w-[13px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[rgba(61,220,151,0.4)]" />
      <span className="absolute left-[71%] top-[34%] h-[4px] w-[4px] rounded-full bg-[var(--faint)]" />
      <span className="absolute left-1/2 top-[7%] h-[3px] w-[3px] rounded-full bg-[var(--red)] shadow-[0_0_8px_rgba(225,6,0,0.9)]" />
    </div>
  );
}

export default function RadarPage() {
  const liveCount = DEMO_STREAMERS.filter((s) => s.live).length;
  return (
    <div>
      <PageHeader
        kicker="Stage 01 · Monitor"
        title="Live Radar"
        description="Every channel on the watchlist, what it is playing right now, and the moments the detector flagged."
        actions={
          <>
            <Link href="/clips" className="btn btn-primary">
              Clip inbox <Icon name="arrow" size={15} />
            </Link>
          </>
        }
        meta={
          <>
            <span className="chip chip-demo">demo data</span>
            <span className="chip chip-live">
              <span className="pulse-dot" aria-hidden="true" /> {liveCount} live
            </span>
            <span className="chip">polling not connected</span>
          </>
        }
      />

      <div className="mt-7 space-y-9">
        <section className="panel-3d overflow-hidden" aria-label="Radar summary">
          <div className="grid items-center gap-6 px-5 py-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:px-7 sm:py-6">
            <Scope />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[15px] font-semibold text-[var(--text)]">Scope is idle</h2>
                <span className="chip chip-warn">no live feed</span>
              </div>
              <p className="mt-2 max-w-[52ch] text-[13px] leading-relaxed text-[var(--muted)]">
                The visual below is a fixed rendering, not a screenshot of traffic. In this build the
                channel list is demo data and nothing is being polled — wire the monitor worker and these
                pips start moving on their own.
              </p>
              <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-[var(--line)] pt-4">
                {FACTS.map((f) => (
                  <div key={f.label}>
                    <dt className="label">{f.label}</dt>
                    <dd className="num mt-1 text-[22px] leading-none text-[var(--text)]">{f.value}</dd>
                    <p className="mt-1 text-[11px] text-[var(--faint)]">{f.note}</p>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        <section aria-labelledby="channels-heading">
          <SectionHead
            id="channels-heading"
            title="Monitored channels"
            count={DEMO_STREAMERS.length}
            hint="One card per channel. Alerts list what the detector would have fired."
            action={<span className="chip chip-demo">demo</span>}
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {DEMO_STREAMERS.map((s) => (
              <StreamerCard key={s.id} streamer={s} />
            ))}
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
          <HelpPanel
            title="How monitoring is meant to work"
            items={[
              { label: "Watchlist", body: "Channels you add are polled on an interval. Each poll is a cheap read — no recording until a signal fires." },
              { label: "Signals", body: "Chat velocity against a rolling baseline, plus keyword bursts you define. Either one creates a candidate." },
              { label: "Hand-off", body: "A candidate lands in the clip inbox with its score and the reasons behind it. Nothing is cut automatically." },
            ]}
          />

          <section className="card p-5" aria-labelledby="add-source-heading">
            <div className="flex items-center justify-between gap-3">
              <h2 id="add-source-heading" className="text-[13.5px] font-semibold text-[var(--text)]">
                Add a source
              </h2>
              <span className="chip">read-only preview</span>
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--muted)]">
              The form is shown so you can see the shape of it. Submitting writes to the sources table,
              which is not connected in this build — so the field is disabled rather than pretending.
            </p>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="label mb-1.5 block">Kick channel URL</span>
                <input
                  type="url"
                  disabled
                  placeholder="https://kick.com/channel"
                  className="field cursor-not-allowed opacity-60"
                />
              </label>
              <button type="button" disabled className="btn btn-primary w-full">
                <Icon name="radar" size={15} /> Start monitoring
              </button>
              <p className="text-[11px] leading-relaxed text-[var(--faint)]">
                Disabled — no endpoint is wired to this control yet.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
