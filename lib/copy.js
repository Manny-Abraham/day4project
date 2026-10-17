import { templateWhy } from "./recommend.js";

export const COPY_MAX = 120;

// Slice 5: LLM writes only the arc copy over decided picks, never re-sorts.
// Fallback-first: without a key, template copy stands in.
export function writeWhyMatch(movie, currentText, desiredTag, { hasKey = false, llmCopy = null } = {}) {
  if (hasKey && typeof llmCopy === "string" && llmCopy.trim()) return llmCopy.trim().slice(0, COPY_MAX);
  return templateWhy(currentText, desiredTag);
}

export function applyCopy(results, currentText, desiredTag, opts = {}) {
  return results.map((m) => ({ ...m, whyMatch: writeWhyMatch(m, currentText, desiredTag, opts) }));
}
