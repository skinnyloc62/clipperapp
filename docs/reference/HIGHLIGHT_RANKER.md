# Highlight ranker — explicit rubric and evidence

## Intake requirements

Use a grounded timecoded transcript (WhisperX or equivalent) with source seconds and optionally a source video analysis summary. Signal flags must be `available`, `not_available`, or `error`, per source. Never infer gameplay footage from words alone. Use candidate schema at `schemas/clip-candidate.schema.json`.

## Stages

1. Divide long transcript into configurable 12-minute chunks with overlap. Identify semantically complete candidate windows, adjust to 30–90 seconds as a configurable **starting range**, and keep exact start/end relative to source.
2. Reject missing source, rights `blocked`, campaign ineligible, misleading-context risk, wholly duplicated moment or missing actual payoff. If rights are `needs_review`, allow research/edit plans but **block publication**.
3. Score using weight maxima: hook 20, clarity 20, payoff 20, novelty 15, emotion 10, fit 10, technical 5. Sum breakdown exactly to `score`. No inferred virality percentage.
4. Compare top candidates pairwise: opening 2 sec, zero-context clarity, payoff timing, available footage and brand fit. Prefer fewer strong clips over high-volume filler.
5. Deduplicate with source time overlap, normalized transcript similarity, perceptual hashes if video exists, and already exported/published records; record rejection reason. Cross-platform versions of one source event share a `source_moment_id`.
6. Return up to 10 distinct candidates with exact transcript excerpt, why it works, start/end, rights status, campaign eligibility, warnings and human-review action. Use structured schema validation and deterministic fallback when AI JSON fails.

## Data integrity check

For every candidate: `0 <= start < end <= duration`; score is the **sum** of the seven bounded sub-scores; quote words appear in the transcript or are labeled paraphrase; candidate date/time is from actual source; chat/replay is marked unavailable if missing. Scores must not be tuned after seeing payout outcomes without preserving the previous model version.

## Calibration

Review a human-rated sample with positive and negative examples; track precision@N (owner approves top N), duplicate false positives, clip completion rates and QAs. Never claim improved ranking solely from one viral clip or a biased platform comparison.
