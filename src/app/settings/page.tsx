import Link from "next/link";
import PageHeader, { HelpPanel } from "@/components/PageHeader";
import Icon from "@/components/Icon";
import { DEMO_STREAMERS } from "@/mocks/demo";

/* Settings — read-only in this build. Every control that would write is
   disabled and says so. No optimistic toggles pretending to save. */

function Block({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="panel-3d overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-5 py-3.5">
        <div className="min-w-0 flex-1">
          <h2 className="text-[13.5px] font-semibold text-[var(--text)]">{title}</h2>
          {hint ? <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--faint)]">{hint}</p> : null}
        </div>
        {action ? <div className="shrink-0 pt-0.5">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function Switch({ label, on }: { label: string; on: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled
      className={
        "relative h-[22px] w-[38px] shrink-0 rounded-full border transition-colors " +
        (on ? "border-[var(--red-line)] bg-[var(--red-soft)]" : "border-[var(--line-2)] bg-white/[0.04]")
      }
    >
      <span
        aria-hidden="true"
        className={
          "absolute top-1/2 h-[14px] w-[14px] -translate-y-1/2 rounded-full transition-all " +
          (on ? "left-[19px] bg-[var(--red-hi)]" : "left-[3px] bg-[var(--faint)]")
        }
      />
    </button>
  );
}

export default function SettingsPage() {
  return (
    <div>
      <PageHeader
        kicker="Workspace"
        title="Settings"
        description="Sources, detection rules, notifications, and storage. This screen is a read-only preview — the controls are shown, not live."
        actions={
          <Link href="/login" className="btn">
            Account <Icon name="arrow" size={15} />
          </Link>
        }
        meta={
          <>
            <span className="chip chip-warn">read-only preview</span>
            <span className="chip">local build</span>
          </>
        }
      />

      <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div className="space-y-5">
          <Block
            title="Monitored sources"
            hint="Channels the monitor will poll once it is connected."
            action={<span className="chip chip-demo">demo</span>}
          >
            <ul className="divide-y divide-[var(--line)]">
              {DEMO_STREAMERS.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-[var(--text)]">{s.channel}</p>
                    <p className="num mt-0.5 truncate text-[11px] text-[var(--faint)]">{s.channelUrl}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={"chip " + (s.live ? "chip-live" : "")}>{s.live ? "live" : "offline"}</span>
                    <button type="button" disabled className="btn !h-8 !px-2.5 !text-[12px]">
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] px-5 py-2.5">
              <span className="text-[11px] text-[var(--faint)]">Add or remove is disabled in this build.</span>
              <Link href="/radar" className="btn btn-quiet !h-8 !px-2 !text-[12px]">
                Open radar <Icon name="arrow" size={13} />
              </Link>
            </div>
          </Block>

          <Block
            title="Detection rules"
            hint="What turns a moment into a candidate. Shown as the intended defaults."
            action={<span className="chip">planned</span>}
          >
            <div className="space-y-4 px-5 py-4">
              <div>
                <span className="label mb-2 block">Keyword bursts</span>
                <div className="flex flex-wrap gap-1.5">
                  {["CLIP THAT", "INSANE", "NO WAY", "chat go crazy"].map((k) => (
                    <span key={k} className="chip !normal-case !tracking-normal">
                      {k}
                    </span>
                  ))}
                  <span className="chip !normal-case !tracking-normal opacity-50">+ add</span>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="label mb-1.5 block">Chat velocity threshold</span>
                  <input disabled defaultValue="3.0 × baseline" className="field cursor-not-allowed opacity-60" />
                </label>
                <label className="block">
                  <span className="label mb-1.5 block">Cooldown per channel</span>
                  <input disabled defaultValue="90 seconds" className="field cursor-not-allowed opacity-60" />
                </label>
              </div>
            </div>
          </Block>

          <Block title="Notifications" hint="Where an alert goes when the detector fires." action={<span className="chip">off</span>}>
            <ul className="divide-y divide-[var(--line)]">
              {[
                { label: "Email digest", detail: "One summary per session, not per alert.", on: false },
                { label: "Live alert banner", detail: "In-app banner the moment a candidate is created.", on: true },
              ].map((row) => (
                <li key={row.label} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-[13px] text-[var(--text)]">{row.label}</p>
                    <p className="mt-0.5 text-[11.5px] text-[var(--faint)]">{row.detail}</p>
                  </div>
                  <Switch label={row.label} on={row.on} />
                </li>
              ))}
            </ul>
            <p className="border-t border-[var(--line)] px-5 py-2.5 text-[11px] text-[var(--faint)]">
              Switches are disabled — no notification service is attached.
            </p>
          </Block>

          <Block title="Storage" hint="Where uploaded and rendered files are written." action={<span className="chip">local driver</span>}>
            <dl className="divide-y divide-[var(--line)]">
              {[
                ["Driver", "local"],
                ["Uploads", "kept on the app server"],
                ["Remote bucket", "not configured"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-3 px-5 py-2.5">
                  <dt className="text-[12.5px] text-[var(--muted)]">{k}</dt>
                  <dd className="num text-[11.5px] text-[var(--faint)]">{v}</dd>
                </div>
              ))}
            </dl>
          </Block>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-8">
          <HelpPanel
            stacked
            title="About this screen"
            items={[
              { label: "Nothing saves", body: "Every control is disabled on purpose. A toggle that flips but writes nowhere is worse than a greyed one." },
              { label: "Real values", body: "Driver and channel rows reflect the configured environment; the rest are intended defaults." },
              { label: "Next", body: "Sources and rules will write to the database before the monitor ships." },
            ]}
          />
          <section className="card p-4" aria-label="Environment">
            <h2 className="text-[13px] font-semibold text-[var(--text)]">Environment</h2>
            <dl className="mt-2.5 space-y-2">
              {[
                ["Build", "local dev"],
                ["Mode", "demo data"],
                ["Database", "not connected"],
                ["Worker", "not running"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3">
                  <dt className="text-[12px] text-[var(--muted)]">{k}</dt>
                  <dd className="num text-[11.5px] text-[var(--faint)]">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
