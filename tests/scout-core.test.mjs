import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assessTranscript, editorialScore, exactQuote, selectWindows } from "../scripts/lib/scout-core.mjs";

describe("grounded scout", () => {
  it("uses source seconds, keeps a stronger nearby spike, and honors a manual mark", () => {
    const levels = Array.from({ length: 160 }, (_, sec) => ({ sec, db: -42 }));
    levels[50].db = -27;
    levels[55].db = -25;
    levels[130].db = -27;
    const windows = selectWindows(levels, 160, [8]);
    assert.deepEqual(windows.map(w => w.peakSec), [8, 130]);
    assert.equal(windows[0].origin, "owner-mark");
    assert.equal(windows[1].endSec - windows[1].startSec, 44);
    assert.throws(() => selectWindows(levels, 160, [161]), /outside video/);
  });

  it("abstains on repetitive or low-confidence song ASR", () => {
    const repeated = Array.from({ length: 6 }, (_, i) => ({ start: i, end: i + 1,
      text: "mm hmm mm hmm", avg_logprob: -0.4, no_speech_prob: 0.1 }));
    assert.equal(assessTranscript(repeated).trustworthy, false);
    const lowConfidence = [{ start: 0, end: 5, text: "a strong viral moment happened here",
      avg_logprob: -0.9, no_speech_prob: 0.1 }];
    assert.equal(assessTranscript(lowConfidence).trustworthy, false);
  });

  it("requires exact quoted evidence and a bounded score breakdown", () => {
    const transcript = "He asked where the song went and everyone started laughing.";
    assert.equal(exactQuote("everyone started laughing", transcript), "everyone started laughing");
    assert.equal(exactQuote("the crowd went wild", transcript), null);
    assert.equal(editorialScore({ hook: 10, clarity: 10, payoff: 10, novelty: 5,
      emotion: 4, fit: 8, technical: 4 }), 51);
    assert.equal(editorialScore({ hook: 21, clarity: 10, payoff: 10, novelty: 5,
      emotion: 4, fit: 8, technical: 4 }), null);
  });
});
