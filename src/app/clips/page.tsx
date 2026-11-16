import Link from "next/link";
import PageHeader, { HelpPanel, SectionHead } from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import Icon from "@/components/Icon";

/* Stage 02 — Detect. The detector is not connected in this build, so there is
   no candidate list to render. The screen states that plainly and shows the
   intended scoring inputs instead of inventing moments that never happened. */

export default function ClipsPage() {
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
            <span className="chip">0 candidates</span>
            <span className="chip chip-warn">detector not connected</span>
          </>
        }
      />

      <div className="mt-7 space-y-6">
        <section aria-labelledby="queue-heading">
          <SectionHead
            id="queue-heading"
            title="Queue"
            count={0}
            hint="Cards keep the detector's reasons attached so a score is never just a number."
          />
          <EmptyState
            icon="scissors"
            title="No clip candidates"
            body="Nothing has been detected because the monitor and detector are not connected in this build. Candidates appear here once a chat spike or keyword burst fires on a channel you are watching — each one arrives with its rank and the reasons behind it."
            action={
              <Link href="/radar" className="btn">
                <Icon name="radar" size={15} /> See the radar
              </Link>
            }
            note="Empty because detection is off — not a loading state"
          />
        </section>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start">
          <HelpPanel
            title="What a card will show"
            items={[
              { label: "Rank", body: "An engagement-potential ordering, not a probability and not a promise. Two cards can both be 80 and behave differently." },
              { label: "Reasons", body: "The raw signals behind the rank. If a reason looks weak, the card is weak — trust the list over the number." },
              { label: "Media state", body: "Needs media means the moment was detected but no source file exists yet, so the editor stays locked." },
            ]}
          />
          <section className="card p-5" aria-label="Detector settings summary">
            <h2 className="text-[13.5px] font-semibold text-[var(--text)]">Signals that will feed this queue</h2>
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
              These are the intended defaults, listed so you can see the shape of the detector. None of them
              are running in this build.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
