import Icon, { type IconName } from "./Icon";

/* Quiet, honest empty state. Never dresses up missing data as success —
   it says what is absent, why, and the one action that changes it. */
export default function EmptyState({
  icon = "inbox",
  title,
  body,
  action,
  note,
}: {
  icon?: IconName;
  title: string;
  body: React.ReactNode;
  action?: React.ReactNode;
  note?: string;
}) {
  return (
    <div className="panel-3d flex flex-col items-center px-6 py-12 text-center sm:py-16">
      <span
        aria-hidden="true"
        className="grid h-12 w-12 place-items-center rounded-full border border-[var(--line-2)] bg-white/[0.03] text-[var(--muted)]"
      >
        <Icon name={icon} size={20} />
      </span>
      <h3 className="mt-4 text-[15px] font-semibold text-[var(--text)]">{title}</h3>
      <p className="mt-2 max-w-[46ch] text-[13px] leading-relaxed text-[var(--muted)]">{body}</p>
      {action ? <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div> : null}
      {note ? (
        <p className="mt-5 font-mono text-[10.5px] uppercase tracking-[0.13em] text-[var(--faint)]">{note}</p>
      ) : null}
    </div>
  );
}
