/** Pure, conservative parts of the local video scout. Scores are editorial
 * potential, never odds of going viral. Lack of trustworthy evidence is null. */

export const SCOUT_WINDOW_SEC = 44;
export const SCOUT_COOLDOWN_SEC = 60;

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export function selectWindows(levels, durationSec, marks = [], limit = 5) {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return [];
  const peaks = [];
  for (let i = 0; i < levels.length; i++) {
    const point = levels[i];
    if (!Number.isFinite(point?.db) || !Number.isFinite(point?.sec)) continue;
    const bed = median(levels.slice(Math.max(0, i - 30), i).map(p => p.db).filter(Number.isFinite));
    if (bed == null || i < 8) continue;
    const jumpDb = point.db - bed;
    if (point.db > -30 && jumpDb >= 7) peaks.push({ sec: point.sec, strength: jumpDb, origin: "audio-spike" });
  }
  for (const sec of marks) {
    if (!Number.isFinite(sec) || sec < 0 || sec >= durationSec) throw new Error("mark is outside video duration");
    peaks.push({ sec, strength: Infinity, origin: "owner-mark" });
  }
  peaks.sort((a, b) => b.strength - a.strength || a.sec - b.sec);
  const selected = [];
  for (const peak of peaks) {
    if (selected.some(existing => Math.abs(existing.peakSec - peak.sec) < SCOUT_COOLDOWN_SEC)) continue;
    const length = Math.min(SCOUT_WINDOW_SEC, durationSec);
    const startSec = Math.max(0, Math.min(durationSec - length, peak.sec - 3));
    selected.push({ startSec: round(startSec), endSec: round(startSec + length),
      peakSec: round(peak.sec), origin: peak.origin,
      jumpDb: Number.isFinite(peak.strength) ? round(peak.strength) : null });
    if (selected.length >= limit) break;
  }
  return selected.sort((a, b) => a.startSec - b.startSec);
}

function round(value) { return Math.round(value * 10) / 10; }
function normalizedWords(text) {
  return text.toLowerCase().match(/[a-z0-9']+/g) || [];
}

export function assessTranscript(segments) {
  const kept = (Array.isArray(segments) ? segments : []).filter(s =>
    typeof s?.text === "string" && s.text.trim() && Number.isFinite(s.start) &&
    Number.isFinite(s.end) && s.end > s.start &&
    Number.isFinite(s.avg_logprob) && s.avg_logprob > -0.55 &&
    Number.isFinite(s.no_speech_prob) && s.no_speech_prob < 0.35);
  const text = kept.map(s => s.text.trim()).join(" ").trim();
  const words = normalizedWords(text);
  const unique = new Set(words);
  const trigramCounts = new Map();
  for (let i = 0; i + 2 < words.length; i++) {
    const key = words.slice(i, i + 3).join(" ");
    trigramCounts.set(key, (trigramCounts.get(key) || 0) + 1);
  }
  const repeated = [...trigramCounts.values()].some(n => n >= 3);
  const trustworthy = words.length >= 12 && unique.size >= 8 &&
    unique.size / words.length >= 0.35 && !repeated;
  return { trustworthy, text: trustworthy ? text : null,
    segments: trustworthy ? kept : [], words: words.length,
    reason: trustworthy ? null : "speech transcription is missing, repetitive, or too uncertain" };
}

/** Reject a model's quote unless it appears verbatim in trustworthy ASR. */
export function exactQuote(quote, transcript) {
  if (typeof quote !== "string" || typeof transcript !== "string") return null;
  const q = quote.trim().replace(/\s+/g, " ");
  if (q.length < 6 || q.length > 120) return null;
  const normalized = transcript.replace(/\s+/g, " ");
  return normalized.toLowerCase().includes(q.toLowerCase()) ? q : null;
}

export function editorialScore(parts) {
  const maxima = { hook: 20, clarity: 20, payoff: 20, novelty: 15, emotion: 10, fit: 10, technical: 5 };
  if (!parts || typeof parts !== "object") return null;
  let sum = 0;
  for (const [name, max] of Object.entries(maxima)) {
    const value = parts[name];
    if (!Number.isInteger(value) || value < 0 || value > max) return null;
    sum += value;
  }
  return sum;
}
