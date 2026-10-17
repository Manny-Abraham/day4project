import { test } from "node:test";
import assert from "node:assert/strict";
import { applyCopy, writeWhyMatch, COPY_MAX } from "../lib/copy.js";

test("template fallback capped, order preserved", () => {
  const rs = [{ title: "b", voteAverage: 8.5 }, { title: "a", voteAverage: 7.1 }];
  const out = applyCopy(rs, "Stressed", "Tired/Relaxed");
  assert.deepEqual(out.map((m) => m.title), ["b", "a"]);
  assert.ok(out.every((m) => m.whyMatch.length <= COPY_MAX));
});

test("keyed copy used when provided, trimmed to cap", () => {
  const w = writeWhyMatch({}, "c", "Happy", { hasKey: true, llmCopy: ` ${"x".repeat(200)} ` });
  assert.equal(w.length, COPY_MAX);
});
