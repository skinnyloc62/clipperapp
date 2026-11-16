import Icon from "./Icon";

/* Page-level header. One per route, always: kicker → title → one honest
   sentence → actions. Keeps every screen starting the same way. */
export default function PageHeader({
  kicker,
  title,
  description,
  actions,
  meta,
}: {
  kicker: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <header className="border-b border-white/[0.07] pb-7">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="h-[2px] w-7 rounded-full"
              style={{ background: "var(--red)", boxShadow: "0 0 12px rgba(225,6,0,0.7)" }}
            />
            <span className="kicker">{kicker}</span>
          </div>
          <h1 className="hero-title-display text-[30px] leading-[1.06] text-[var(--text)] sm:text-[42px] lg:text-[46px]">
            {title}
          </h1>
          {description ? (
            <p className="mt-3 max-w-[58ch] text-[14px] leading-relaxed text-[var(--muted)] sm:text-[15px]">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {meta ? <div className="mt-5 flex flex-wrap items-center gap-2">{meta}</div> : null}
    </header>
  );
}

/* Section heading with an optional count and a right-hand slot. */
export function SectionHead({
  title,
  count,
  hint,
  action,
  id,
}: {
  title: string;
  count?: number;
  hint?: string;
  action?: React.ReactNode;
  id?: string;
}) {
  return (
    <div className="mb-3.5 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 id={id} className="sec-head text-[13px]">
          {title}
          {typeof count === "number" ? (
            <span className="num ml-1 rounded-md border border-white/10 px-1.5 py-0.5 text-[10.5px] text-[var(--muted)]">
              {count}
            </span>
          ) : null}
        </h2>
        {hint ? <p className="mt-1.5 pl-[13px] text-[12px] text-[var(--faint)]">{hint}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/* Contextual instruction block. Every screen carries one so the UI
   explains itself without a manual. */
export function HelpPanel({
  title = "How this screen works",
  items,
  tone = "info",
  stacked = false,
}: {
  title?: string;
  items: { label: string; body: React.ReactNode }[];
  tone?: "info" | "warn";
  /* Use in narrow asides (<360px): label stacks above body instead of
     squeezing the body into a 120px column. */
  stacked?: boolean;
}) {
  return (
    <aside className="help-panel" aria-label={title}>
      <div className="mb-2.5 flex items-center gap-2 pl-2">
        <Icon name="info" size={14} className={tone === "warn" ? "text-[var(--amber)]" : "text-[var(--blue)]"} />
        <h2 className="text-[12px] font-semibold tracking-wide text-[var(--text)]">{title}</h2>
      </div>
      <dl className="space-y-2 pl-2">
        {items.map((it) => (
          <div
            key={it.label}
            className={
              stacked
                ? "space-y-1"
                : "grid gap-0.5 sm:grid-cols-[128px_1fr] sm:gap-3"
            }
          >
            <dt className="label pt-[3px]">{it.label}</dt>
            <dd className="text-[12.5px] leading-relaxed text-[var(--muted)]">{it.body}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
