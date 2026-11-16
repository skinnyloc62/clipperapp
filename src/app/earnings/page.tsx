import Link from "next/link";
import PageHeader, { HelpPanel, SectionHead } from "@/components/PageHeader";
import Icon from "@/components/Icon";

/* Stage 05 — Export & earnings. No platform integration exists, so the
   ledger renders its own structure with em-dashes instead of invented
   revenue. Zero rows is the truth here. */

const SUMMARY = [
  { label: "Awaiting payout", value: "—", note: "no approved exports" },
  { label: "Paid out", value: "—", note: "no connected account" },
  { label: "Clips exported", value: "—", note: "none yet" },
];

export default function EarningsPage() {
  return (
    <div>
      <PageHeader
        kicker="Stage 05 · Export"
        title="Earnings"
        description="A ledger of approved clips and what they earned. No platform account is connected, so there are no amounts to show — and none are invented."
        actions={
          <>
            <button type="button" disabled className="btn">
              <Icon name="upload" size={15} /> Export CSV
            </button>
            <Link href="/approvals" className="btn btn-primary">
              Approvals <Icon name="arrow" size={15} />
            </Link>
          </>
        }
        meta={
          <>
            <span className="chip chip-demo">no revenue data</span>
            <span className="chip">0 rows</span>
            <span className="chip">payouts not connected</span>
          </>
        }
      />

      <div className="mt-7 space-y-9">
        <section aria-label="Earnings summary" className="panel-3d overflow-hidden">
          <dl className="grid grid-cols-3 gap-px bg-white/[0.055]">
            {SUMMARY.map((s) => (
              <div key={s.label} className="bg-[var(--panel)] px-3.5 py-4 sm:px-5 sm:py-5">
                <dt className="label !text-[9.5px] sm:!text-[10.5px]">{s.label}</dt>
                <dd className="num mt-2 text-[24px] leading-none text-[var(--faint)] sm:text-[28px]">
                  {s.value}
                </dd>
                <p className="mt-2 text-[10.5px] leading-snug text-[var(--faint)] sm:text-[11px]">
                  {s.note}
                </p>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="ledger-heading">
          <SectionHead
            id="ledger-heading"
            title="Payout ledger"
            hint="One row per approved export once a platform is connected."
            action={<span className="chip chip-demo">empty</span>}
          />
          <div className="panel-3d overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left sm:min-w-[620px]">
                <thead>
                  <tr className="border-b border-[var(--line)]">
                    {["Date", "Clip", "Channel", "Status", "Amount"].map((h, i) => (
                      <th
                        key={h}
                        scope="col"
                        className={
                          "whitespace-nowrap px-3 py-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.13em] text-[var(--faint)] sm:px-4 " +
                          (i === 4 ? "text-right" : "")
                        }
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center">
                      <span className="mx-auto grid h-9 w-9 place-items-center rounded-full border border-[var(--line-2)] text-[var(--faint)]">
                        <Icon name="wallet" size={16} />
                      </span>
                      <p className="mt-3 text-[13px] font-medium text-[var(--text)]">No payouts recorded</p>
                      <p className="mx-auto mt-1 max-w-[44ch] text-[12px] leading-relaxed text-[var(--muted)]">
                        This table fills in after an approved clip is exported and a platform reports
                        revenue for it. Neither has happened yet.
                      </p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] px-4 py-2.5">
              <span className="text-[11px] text-[var(--faint)]">0 of 0 rows</span>
              <span className="text-[11px] text-[var(--faint)]">Amounts settle in the platform&apos;s currency</span>
            </div>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start">
          <HelpPanel
            title="Why this screen is blank"
            items={[
              { label: "No integration", body: "Kick and clip-marketplace revenue both need an API connection. Without one there is nothing to total." },
              { label: "No guessed numbers", body: "A placeholder figure would be worse than an empty table — you would not know which one to trust." },
              { label: "What will appear", body: "Per-export rows: date, clip, channel, payout status, and amount, with a running total above." },
            ]}
          />
          <section className="card p-5" aria-labelledby="connect-heading">
            <div className="flex items-center justify-between gap-2">
              <h2 id="connect-heading" className="text-[13.5px] font-semibold text-[var(--text)]">
                Connect a payout source
              </h2>
              <span className="chip">not built</span>
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--muted)]">
              Platform payouts and marketplace earnings will each connect separately. The button stays
              disabled until there is an endpoint behind it.
            </p>
            <button type="button" disabled className="btn mt-4 w-full">
              Connect account
            </button>
            <p className="mt-2 text-[11px] leading-relaxed text-[var(--faint)]">
              Disabled — no OAuth flow exists in this build.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
