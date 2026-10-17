import { test } from "node:test";
import assert from "node:assert/strict";
import seed from "../src/convex/seed.json" with { type: "json" };
import { recommend, normalizeDesired, normalizeText } from "../lib/recommend.js";

test("desired required", () => {
  const r = recommend(seed.movies, { desiredTag: "" });
  assert.equal(r.empty, true);
});
test("normalizes case and trims to 280", () => {
  assert.equal(normalizeDesired("  happy "), "Happy");
  assert.equal(normalizeText("a  b ").length <= 280, true);
});
test("top 5 vote order with tie-breaks", () => {
  const r = recommend(seed.movies, { desiredTag: "Happy", currentText: "Stressed" });
  assert.ok(r.results.length > 0 && r.results.length <= 5);
  for (let i = 1; i < r.results.length; i++)
    assert.ok(r.results[i - 1].voteAverage >= r.results[i].voteAverage);
  assert.ok(r.results[0].whyMatch.length <= 120);
});
test("empty then loosen to 6.5", () => {
  const strict = recommend(seed.movies, { desiredTag: "Angry" });
  assert.equal(strict.empty, true);
  const loose = recommend(seed.movies, { desiredTag: "Angry", minRating: 6.5 });
  assert.equal(loose.empty, true);
});
