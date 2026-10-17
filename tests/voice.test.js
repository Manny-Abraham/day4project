import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeTranscript, voiceSupported } from "../lib/voice.js";

test("support detection is a function check", () => {
  assert.equal(voiceSupported(function () {}), true);
  assert.equal(voiceSupported(undefined), false);
});

test("transcript merges into current capped, desired untouched", () => {
  assert.equal(mergeTranscript("", "tired evening"), "tired evening");
  assert.equal(mergeTranscript("stressed", "after work"), "stressed after work");
  assert.ok(mergeTranscript("x".repeat(300), "y".repeat(300)).length <= 280);
});
