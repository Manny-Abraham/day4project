export const EMOTION_TAGS = ["Happy","Sad","Stressed","Angry","Bored","Lonely","Excited","Tired/Relaxed"];
export const MIN_RATING = 7.0;
export const MIN_VOTES = 50;
export const LOOSE_RATING = 6.5;

export function normalizeText(s, max = 280) {
  return (s ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function normalizeDesired(raw) {
  const t = normalizeText(raw).toLowerCase();
  const hit = EMOTION_TAGS.find((e) => e.toLowerCase() === t);
  if (hit) return hit;
  const loose = EMOTION_TAGS.find((e) => t.includes(e.toLowerCase().split("/")[0]));
  return loose ?? null;
}

export function templateWhy(current, desired) {
  const c = normalizeText(current) || "any mood";
  const line = `Gentle shift ${c} to ${desired}, no heavy lift.`.slice(0, 120);
  return line;
}

export function recommend(movies, { desiredTag, currentText = "", minRating = MIN_RATING } = {}) {
  if (!desiredTag) return { results: [], empty: true, reason: "desired-required" };
  const pool = movies.filter(
    (m) => (m.desiredTags ?? []).includes(desiredTag) && m.voteAverage >= minRating && (m.voteCount ?? 0) >= MIN_VOTES
  );
  pool.sort((a, b) => b.voteAverage - a.voteAverage || b.voteCount - a.voteCount);
  const top = pool.slice(0, 5).map((m) => ({ ...m, whyMatch: templateWhy(currentText, desiredTag) }));
  return { results: top, empty: top.length === 0, degraded: true };
}
