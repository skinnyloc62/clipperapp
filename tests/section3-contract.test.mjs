// Section 3 data-contract lock — no new dependencies (node builtins only).
// Asserts the adopted highlight-candidate + render-QA specs are self-consistent
// and that the sample candidate obeys them. Section 3 scoring/render code must
// produce rows satisfying these same invariants.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const load = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));

const MAXIMA = { hook: 20, clarity: 20, payoff: 20, novelty: 15, emotion: 10, fit: 10, technical: 5 };

describe("section 3 highlight + QA contract", () => {
  it("candidate schema requires the scoring and rights fields", () => {
    const schema = load("docs/reference/clip-candidate.schema.json");
    for (const f of ["source_id", "start_seconds", "end_seconds", "hook", "score", "score_breakdown", "rights_status", "recommended_action"]) {
      assert.ok(schema.required.includes(f), `schema missing required ${f}`);
    }
    for (const part of Object.keys(MAXIMA)) {
      assert.ok(schema.properties.score_breakdown.required.includes(part), `breakdown missing ${part}`);
    }
  });

  it("sample candidate: score equals bounded breakdown sum, window ordered", () => {
    const c = load("fixtures/sample-candidate.json");
    assert.ok(c.start_seconds >= 0 && c.start_seconds < c.end_seconds, "window must satisfy 0 <= start < end");
    let sum = 0;
    for (const [part, max] of Object.entries(MAXIMA)) {
      const v = c.score_breakdown[part];
      assert.ok(Number.isInteger(v) && v >= 0 && v <= max, `${part} out of bounds: ${v}`);
      sum += v;
    }
    assert.equal(c.score, sum, `score ${c.score} must equal breakdown sum ${sum}`);
    assert.ok(c.score >= 0 && c.score <= 100, "score out of 0-100");
    assert.ok(c.rights_status && c.recommended_action, "rights status + action required");
  });

  it("render QA schema uses PASS/REVISE/BLOCK/NOT_TESTED only", () => {
    const schema = load("docs/reference/render-qa.schema.json");
    assert.deepEqual(
      [...schema.properties.status.enum].sort(),
      ["BLOCK", "NOT_TESTED", "PASS", "REVISE"],
      "unexpected QA verdict set",
    );
    assert.ok(existsSync(join(ROOT, "docs/reference/RENDER_CHAIN.md")), "render chain contract missing");
    assert.ok(existsSync(join(ROOT, "docs/reference/HIGHLIGHT_RANKER.md")), "ranker rubric missing");
  });
});
