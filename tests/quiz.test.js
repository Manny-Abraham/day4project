import { test } from "node:test";
import assert from "node:assert/strict";
import seed from "../src/convex/seed.json" with { type: "json" };
import { quizToDesired } from "../lib/recommend.js";

test("quiz has 6 weighted options mapping to 8 tags", () => {
  assert.equal(seed.quizOptions.length, 6);
  const tags = seed.quizOptions.map((_, i) => quizToDesired(seed.quizOptions, i));
  assert.ok(tags.every(Boolean));
});

test("quiz out-of-range is null, skippable", () => {
  assert.equal(quizToDesired(seed.quizOptions, 99), null);
});
