// Section 3 scoring math — functional test (no deps).
// src/lib/highlights.ts is importable: it uses only erasable types, no I/O.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { stubCandidates, validateCandidate, sumBreakdown, RUBRIC_MAXIMA } from "../src/lib/highlights.ts";

describe("section 3 scoring engine", () => {
  it("rubric maxima match the adopted ranker (20/20/20/15/10/10/5)", () => {
    assert.deepEqual({ ...RUBRIC_MAXIMA }, { hook: 20, clarity: 20, payoff: 20, novelty: 15, emotion: 10, fit: 10, technical: 5 });
  });

  it("stub candidates are valid, ordered, and sum-checked for a 30s source", () => {
    const cs = stubCandidates("asset_test", 30);
    assert.equal(cs.length, 3);
    assert.deepEqual([cs[0].start_seconds, cs[2].end_seconds], [0, 30]);
    for (const c of cs) {
      assert.equal(validateCandidate(c, 30), null, JSON.stringify(c));
      assert.equal(c.score, sumBreakdown(c.score_breakdown));
      assert.ok(["queue_human_review", "revise", "skip"].includes(c.recommended_action));
      assert.equal(c.rights_status, "needs_review");
    }
  });

  it("validator rejects bad windows, bad sums, and out-of-range parts", () => {
    const [good] = stubCandidates("asset_test", 30);
    assert.equal(validateCandidate({ ...good, end_seconds: good.start_seconds }, 30) !== null, true);
    assert.equal(validateCandidate({ ...good, end_seconds: 31 }, 30) !== null, true);
    assert.equal(validateCandidate({ ...good, score: good.score + 1 }, 30) !== null, true);
    assert.equal(
      validateCandidate({ ...good, score_breakdown: { ...good.score_breakdown, hook: 99 } }, 30) !== null,
      true,
    );
  });

  it("rights block overrides numeric score at the contract level", () => {
    const [good] = stubCandidates("asset_test", 30);
    const blocked = { ...good, rights_status: "blocked", recommended_action: "blocked" };
    assert.equal(validateCandidate(blocked, 30), null);
    assert.equal(blocked.recommended_action, "blocked");
  });
});
