import { test } from "node:test";
import assert from "node:assert/strict";
import { badges, mergeEnrichment } from "../lib/recommend.js";

test("badges conditional on enrichment", () => {
  assert.deepEqual(badges({ voteAverage: 8.3 }), ["★ 8.3"]);
  assert.deepEqual(badges({ voteAverage: 8.3, imdbRating: "8.3", rottenTomatoes: "89%" }), ["★ 8.3", "IMDb 8.3", "RT 89%"]);
});

test("enrichment null-safe merge", () => {
  const m = mergeEnrichment({ title: "x", voteAverage: 8 }, {});
  assert.equal(m.imdbRating, null);
  assert.equal(m.rottenTomatoes, null);
  const e = mergeEnrichment({ title: "x", voteAverage: 8 }, { imdbRating: "8.3", trailerYouTubeKey: "abc" });
  assert.equal(e.imdbRating, "8.3");
  assert.equal(e.trailerYouTubeKey, "abc");
});
