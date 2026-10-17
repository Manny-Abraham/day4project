import { normalizeDesired } from "./recommend.js";

export const CONFIDENCE = { ACT: 0.75, BADGE: 0.5 };

export function gateConfidence(confidence) {
  if (confidence >= CONFIDENCE.ACT) return "act";
  if (confidence >= CONFIDENCE.BADGE) return "badge";
  return "clarify";
}

// Fallback-first Jev normalize: exact 8-tag match locally; without a key,
// unknown text returns null so the caller asks clarify instead of guessing.
export function normalizeViaJev(raw, { hasKey = false } = {}) {
  const exact = normalizeDesired(raw);
  if (exact) return { tag: exact, confidence: 0.95, source: "exact" };
  if (!hasKey) return { tag: null, confidence: 0.2, source: "fallback" };
  return { tag: null, confidence: 0.4, source: "jev-low" };
}

// Fallback-first Jev rank: without a key, keep vote order and mark degraded.
// Live path (keyed): score up-to-30 filtered candidates to top 5 plus fit signal here.
export function rankViaJev(candidates, { hasKey = false, confidence = 0.9 } = {}) {
  const ordered = [...candidates].sort((a, b) => b.voteAverage - a.voteAverage || b.voteCount - a.voteCount);
  return { ordered: ordered.slice(0, 5), confidence, degraded: !hasKey, gate: gateConfidence(hasKey ? confidence : 0.2) };
}
