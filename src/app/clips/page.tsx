"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import PageHeader, { HelpPanel, SectionHead } from "@/components/PageHeader";
import ClipOpportunityCard from "@/components/ClipOpportunityCard";
import EmptyState from "@/components/EmptyState";
import Icon from "@/components/Icon";
import { DEMO_CANDIDATES } from "@/mocks/demo";

/* Stage 02 — Detect. The filter is the only state here: it runs over the
   demo array in the browser, so no request is made on any interaction. */

type Filter = "all" | "needs_media" | "available";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "needs_media", label: "Needs media" },
  { id: "available", label: "Media ready" },
];

export default function ClipsPage() {
  const [filter, setFilter] = useState<Filter>("all");

  const rows = useMemo(
    () => (filter === "all" ? DEMO_CANDIDATES : DEMO_CANDIDATES.filter((c) => c.media === filter)),
    [filter],
  );

  const counts: Record<Filter, number> = {
    all: DEMO_CANDIDATES.length,
    needs_media: DEMO_CANDIDATES.filter((c) => c.media === "needs_media").length,
    available: DEMO_CANDIDATES.filter((c) => c.media === "available").length,
  };

  return (
    <div>
      <PageHeader
        kicker="Stage 02 · Detect"
        title="Clip Inbox"
        description="Moments the detector ranked as worth cutting. Highest score first — you decide what moves to the editor."
        actions={
          <Link href="/editor" className="btn btn-primary">
            Open editor <Icon name="arrow" size={15} />
          </Link>
        }
        meta={
          <>
            <span className="chip chip-demo">demo data</span>
            <span className="chip">{DEMO_CANDIDATES.length} candidates</span>
            <span className="chip">filtering is client-side</span>
          </>
        }
      />

      <div className="mt-7 space-y-6">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter clips by media state">
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                aria-pressed={active}
                className={
                  "inline-flex h-8 items-center gap-2 rounded-full border px-3.5 text-[12.5px] transition-colors " +
                  (active
                    ? "border-[var(--red-line)] bg-[var(--red-soft)] text-[var(--text)]"
                    : "border-[var(--line-2)] bg-white/[0.02] text-[var(--muted)] hover:border-white/20 hover:text-[var(--text)]")
                }
              >
                {f.label}
                <span className={"num text-[10.5px] " + (active ? "text-[var(--red-hi)]" : "text-[var(--faint)]")}>
                  {counts[f.id]}
                </span>
              </button>
            );
          })}
        </div>

        <section aria-labelledby="queue-heading">
          <SectionHead
            id="queue-heading"
            title="Queue"
            count={rows.length}
            hint="Cards keep the detector's reasons attached so a score is never just a number."
          />
          {rows.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((c) => (
                <ClipOpportunityCard key={c.id} candidate={c} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon="scissors"
              title="No clips in this filter"
              body="Nothing here has a native file attached yet. Upload the source clip for a candidate and it will move into this view."
              action={
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className="btn"
                >
                  Show all candidates
                </button>
              }
              note="Empty because the filter matched nothing — not a loading state"
            />
          )}
        </section>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start">
          <HelpPanel
            title="Reading a card"
            items={[
              { label: "Rank", body: "An engagement-potential ordering, not a probability and not a promise. Two cards can both be 80 and behave differently." },
              { label: "Reasons", body: "The raw signals behind the rank. If a reason looks weak, the card is weak — trust the list over the number." },
              { label: "Media state", body: "Needs media means the moment was detected but no source file exists yet, so the editor stays locked." },
            ]}
          />
          <section className="card p-5" aria-label="Detector settings summary">
            <h2 className="text-[13.5px] font-semibold text-[var(--text)]">Signals feeding this queue</h2>
            <ul className="mt-3 divide-y divide-[var(--line)]">
              {[
                { k: "Chat velocity", v: "x3 over rolling 5-min baseline" },
                { k: "Keyword burst", v: "CLIP THAT · INSANE · NO WAY" },
                { k: "Cooldown", v: "90s between candidates per channel" },
              ].map((row) => (
                <li key={row.k} className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
                  <span className="text-[12.5px] text-[var(--muted)]">{row.k}</span>
                  <span className="num shrink-0 text-right text-[11.5px] text-[var(--faint)]">{row.v}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t border-[var(--line)] pt-3 text-[11px] leading-relaxed text-[var(--faint)]">
              Thresholds shown are the intended defaults. The detector is not running in this build.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
