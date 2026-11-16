import type { DemoCandidate } from "@/mocks/demo";

// Formats an ISO UTC stamp without timezone drift: 2026-11-16T02:14:00Z
// -> "11/16 · 02:14 UTC". Deterministic on server and client.
function utcStamp(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[2]}/${m[3]} · ${m[4]}:${m[5]} UTC`;
}

export default function ClipOpportunityCard({ candidate }: { candidate: DemoCandidate }) {
  const needsMedia = candidate.media === "needs_media";
  return (
    <article className="card lift-3d flex flex-col p-5">
      <div className="flex items-start gap-3">
        {/* min-w-0 lets this column shrink instead of pushing the rail off the card */}
        <div className="min-w-0 flex-1">
          <h3 className="font-display truncate text-[15px] leading-tight text-[var(--text)]">
            {candidate.streamer}
          </h3>
          <p className="label mt-1.5">{utcStamp(candidate.eventTimeUtc)}</p>
          <a
            href={candidate.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 block truncate text-[13px] text-[var(--muted)] transition-colors hover:text-[var(--text)]"
          >
            {candidate.sourceUrl}
          </a>
        </div>

        {/* Fixed-width score rail: the number can never reach the card edge */}
        <div className="flex w-14 shrink-0 flex-col items-end">
          <span className="num text-[30px] font-medium leading-none tracking-tight text-[var(--text)]">
            {candidate.score}
          </span>
          <span className="label mt-2">rank</span>
        </div>
      </div>

      <ul className="mt-4 space-y-1.5 border-t border-[var(--line)] pt-3.5">
        {candidate.reasons.map((r) => (
          <li key={r} className="flex gap-2 text-[13px] leading-snug text-[var(--muted)]">
            <span className="mt-[7px] h-[3px] w-[3px] shrink-0 rounded-full bg-[var(--red)]" aria-hidden="true" />
            <span className="min-w-0">{r}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className={"chip " + (needsMedia ? "chip-warn" : "chip-live")}>
          {needsMedia ? "Needs media" : "Media ready"}
        </span>
        <span className="text-[12px] text-[var(--faint)]">
          {needsMedia ? "Upload the native clip to edit" : "Ready for the editor"}
        </span>
      </div>

      <p className="mt-3 border-t border-[var(--line)] pt-3 text-[11px] leading-relaxed text-[var(--faint)]">
        Score is an engagement-potential rank, not a probability.
      </p>
    </article>
  );
}
