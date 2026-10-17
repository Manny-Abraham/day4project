import { normalizeText } from "./recommend.js";

export function voiceSupported(recognitionCtor) {
  return typeof recognitionCtor === "function";
}

// Merge a live transcript into current feeling text, capped at 280.
// Never touches desired feeling; voice writes current only.
export function mergeTranscript(currentText, transcript) {
  const joined = [normalizeText(currentText), normalizeText(transcript)].filter(Boolean).join(" ");
  return normalizeText(joined);
}
