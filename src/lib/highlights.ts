/**
 * Highlight scoring — deterministic Section 3 stub implementing the adopted
 * rubric weights (docs/reference/HIGHLIGHT_RANKER.md):
 * hook 20, clarity 20, payoff 20, novelty 15, emotion 10, fit 10, technical 5.
 * Editorial engagement-potential rank, NEVER a virality probability.
 *
 * Invariants (also locked by tests/section3-contract.test.mjs):
 * - 0 <= start < end <= duration
 * - score == sum of the seven bounded sub-scores, 0..100
 * - rights_status always present; `blocked` overrides any numeric score
 * - stub rows carry source:"stub" and must never be presented as AI analysis
 */

export const RUBRIC_MAXIMA = {
  hook: 20,
  clarity: 20,
  payoff: 20,
  novelty: 15,
  emotion: 10,
  fit: 10,
  technical: 5,
} as const;

export type RubricPart = keyof typeof RUBRIC_MAXIMA;
export type ScoreBreakdown = Record<RubricPart, number>;

export interface HighlightCandidate {
  source_id: string;
  campaign_id: string | null;
  start_seconds: number;
  end_seconds: number;
  transcript_excerpt: string | null;
  hook: string;
  why_it_works: string;
  score: number;
  score_breakdown: ScoreBreakdown;
  rights_status: "unknown" | "needs_review" | "blocked" | "cleared";
  campaign_eligibility: "unknown";
  warnings: string[];
  recommended_action: "queue_human_review" | "revise" | "skip" | "blocked";
}

export function sumBreakdown(b: ScoreBreakdown): number {
  return (Object.keys(RUBRIC_MAXIMA) as RubricPart[]).reduce((s, k) => s + b[k], 0);
}

/** Returns a reason string when the candidate violates the contract, else null. */
export function validateCandidate(c: HighlightCandidate, durationSec: number): string | null {
  if (!(c.start_seconds >= 0) || !(c.start_seconds < c.end_seconds)) {
    return "window must satisfy 0 <= start < end";
  }
  if (c.end_seconds > durationSec) {
    return "window exceeds source duration";
  }
  for (const [part, max] of Object.entries(RUBRIC_MAXIMA)) {
    const v = c.score_breakdown[part as RubricPart];
    if (!Number.isInteger(v) || v < 0 || v > (max as number)) {
      return `${part} out of bounds: ${v}`;
    }
  }
  if (c.score !== sumBreakdown(c.score_breakdown)) {
    return `score ${c.score} != breakdown sum ${sumBreakdown(c.score_breakdown)}`;
  }
  if (c.score < 0 || c.score > 100) return "score out of 0-100";
  if (!c.rights_status || !c.recommended_action) return "rights status + action required";
  return null;
}

function actionFor(score: number): HighlightCandidate["recommended_action"] {
  if (score >= 85) return "queue_human_review";
  if (score >= 70) return "revise";
  return "skip";
}

const THIRD_HOOKS = [
  "Opening segment — context and setup live here",
  "Middle segment — payoff usually lands here",
  "Closing segment — reaction and aftermath live here",
] as const;

/**
 * Deterministic stub candidates: duration thirds, fixed rubric parts that sum
 * exactly to the stated score. Real ASR + signal scoring replaces the PARTS
 * table in Section 3b; the invariants and action thresholds stay identical.
 */
export function stubCandidates(assetId: string, durationSec: number): HighlightCandidate[] {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return [];
  const third = durationSec / 3;
  const PARTS: ScoreBreakdown[] = [
    { hook: 15, clarity: 16, payoff: 14, novelty: 10, emotion: 7, fit: 8, technical: 5 },
    { hook: 12, clarity: 14, payoff: 12, novelty: 8, emotion: 6, fit: 7, technical: 5 },
    { hook: 10, clarity: 12, payoff: 10, novelty: 6, emotion: 5, fit: 6, technical: 4 },
  ];
  return PARTS.map((parts, i) => {
    const score = sumBreakdown(parts);
    const start = Math.round(i * third * 10) / 10;
    const end = Math.round((i === 2 ? durationSec : (i + 1) * third) * 10) / 10;
    const candidate: HighlightCandidate = {
      source_id: assetId,
      campaign_id: null,
      start_seconds: start,
      end_seconds: end,
      transcript_excerpt: null,
      hook: THIRD_HOOKS[i],
      why_it_works: "Stub segmentation by thirds; transcript-driven hooks arrive with ASR.",
      score,
      score_breakdown: parts,
      rights_status: "needs_review",
      campaign_eligibility: "unknown",
      warnings: ["stub_segmentation", "requires_rights_and_brief"],
      recommended_action: actionFor(score),
    };
    const violation = validateCandidate(candidate, durationSec);
    if (violation) throw new Error(`stub candidate invalid: ${violation}`);
    return candidate;
  });
}
