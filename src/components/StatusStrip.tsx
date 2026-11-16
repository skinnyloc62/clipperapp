type Stat = { label: string; value: number | string; tone?: "live" | "warn" | "bad"; hint?: string };

const toneStyle: Record<string, { text: string; bar: string }> = {
  live: { text: "#62e6ae", bar: "linear-gradient(90deg, rgba(61,220,151,0.9), rgba(61,220,151,0.15))" },
  warn: { text: "#e8b563", bar: "linear-gradient(90deg, rgba(232,163,61,0.9), rgba(232,163,61,0.15))" },
  bad: { text: "#ff6b63", bar: "linear-gradient(90deg, rgba(225,6,0,0.95), rgba(225,6,0,0.15))" },
};

const neutral = { text: "var(--text)", bar: "linear-gradient(90deg, rgba(255,255,255,0.5), rgba(255,255,255,0.05))" };

export default function StatusStrip({ stats }: { stats: Stat[] }) {
  return (
    <section aria-label="System status" className="panel-3d overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <h2 className="text-[13.5px] font-semibold text-[var(--text)]">System status</h2>
        </div>
        <p className="text-[11.5px] text-[var(--faint)]">
          Counts describe the pipeline, not performance.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-px bg-white/[0.055] sm:grid-cols-4">
        {stats.map((s) => {
          const t = s.tone ? toneStyle[s.tone] ?? neutral : neutral;
          return (
            <div key={s.label} className="group relative bg-[var(--panel)] px-4 py-3.5 transition-colors hover:bg-[var(--panel-2)]">
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-[2px] opacity-70"
                style={{ background: t.bar }}
              />
              <dt className="label">{s.label}</dt>
              <dd
                className="num mt-1.5 text-[26px] font-medium leading-none"
                style={{ color: t.text }}
              >
                {s.value}
              </dd>
              {s.hint ? (
                <p className="mt-2 text-[11px] leading-snug text-[var(--faint)]">{s.hint}</p>
              ) : null}
            </div>
          );
        })}
      </dl>
    </section>
  );
}
