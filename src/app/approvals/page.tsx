import Link from "next/link";
import PageHeader, { HelpPanel, SectionHead } from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import Icon, { type IconName } from "@/components/Icon";

/* Stage 04 — Approve. An empty queue is the correct state right now:
   no clip has been cut, so nothing can be approved. */

const STEPS: { n: string; icon: IconName; title: string; body: string }[] = [
  {
    n: "01",
    icon: "scissors",
    title: "Review the cut",
    body: "Watch the vertical render, check the crop and the burned captions.",
  },
  {
    n: "02",
    icon: "check",
    title: "Approve or reject",
    body: "One decision per clip, recorded with a timestamp. Rejections send it back to the editor.",
  },
  {
    n: "03",
    icon: "upload",
    title: "Render and collect",
    body: "Approved clips render once and become downloadable from the export screen.",
  },
];

export default function ApprovalsPage() {
  return (
    <div>
      <PageHeader
        kicker="Stage 04 · Approve"
        title="Approvals"
        description="The single gate between a cut and a file leaving the app. Nothing renders, downloads, or posts without a decision here."
        actions={
          <Link href="/clips" className="btn btn-primary">
            Review clips <Icon name="arrow" size={15} />
          </Link>
        }
        meta={
          <>
            <span className="chip">0 in queue</span>
            <span className="chip chip-warn">approval API not wired</span>
          </>
        }
      />

      <div className="mt-7 space-y-9">
        <EmptyState
          icon="check"
          title="Nothing waiting on you"
          body="No clip has reached the approval gate. Cut a candidate in the editor first, then it appears here for a yes or no."
          action={
            <>
              <Link href="/clips" className="btn btn-primary">
                Open clip inbox
              </Link>
              <Link href="/editor" className="btn">
                Go to editor
              </Link>
            </>
          }
          note="Empty queue — not a loading state"
        />

        <section aria-labelledby="how-heading">
          <SectionHead
            id="how-heading"
            title="How a decision moves"
            hint="Three steps, no shortcuts. The gate exists so a bad crop never ships by accident."
          />
          <ol className="grid gap-4 sm:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="card lift-3d flex flex-col p-5">
                <div className="flex items-center justify-between">
                  <span className="num text-[10.5px] tracking-[0.14em] text-[var(--faint)]">{s.n}</span>
                  <Icon name={s.icon} size={16} className="text-[var(--faint)]" />
                </div>
                <h3 className="mt-3 text-[13.5px] font-medium text-[var(--text)]">{s.title}</h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--muted)]">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start">
          <HelpPanel
            title="Why the gate exists"
            items={[
              { label: "No auto-publish", body: "Clipping tools that post on their own are how accounts get flagged. This one always asks." },
              { label: "One decision", body: "Approve means render-and-keep. Reject sends the clip back with its notes intact — nothing is deleted." },
              { label: "Audit trail", body: "Each decision will store who approved it and when, so a bad export can be traced to a step." },
            ]}
          />
          <section className="card p-5" aria-labelledby="gates-heading">
            <h2 id="gates-heading" className="text-[13.5px] font-semibold text-[var(--text)]">
              What approval unlocks
            </h2>
            <ul className="mt-3 space-y-2.5">
              {[
                { label: "Render", state: "gated" },
                { label: "Download master", state: "gated" },
                { label: "Publish to platform", state: "not built" },
              ].map((row) => (
                <li
                  key={row.label}
                  className="flex items-center justify-between gap-3 border-b border-[var(--line)] pb-2.5 last:border-0 last:pb-0"
                >
                  <span className="flex items-center gap-2 text-[12.5px] text-[var(--muted)]">
                    <Icon name={row.state === "gated" ? "clock" : "info"} size={14} className="text-[var(--faint)]" />
                    {row.label}
                  </span>
                  <span className={row.state === "gated" ? "chip chip-warn" : "chip"}>{row.state}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
