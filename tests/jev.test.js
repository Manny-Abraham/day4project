import { test } from "node:test";
import assert from "node:assert/strict";
import { gateConfidence, normalizeViaJev, rankViaJev } from "../lib/jev.js";

test("confidence gates act/badge/clarify", () => {
  assert.equal(gateConfidence(0.9), "act");
  assert.equal(gateConfidence(0.6), "badge");
  assert.equal(gateConfidence(0.3), "clarify");
});

test("normalize exact without key, unknown clarifies", () => {
  assert.equal(normalizeViaJev("Happy").tag, "Happy");
  const u = normalizeViaJev("meh whatever");
  assert.equal(u.tag, null);
  assert.equal(gateConfidence(u.confidence), "clarify");
});

test("rank fallback keeps vote order degraded", () => {
  const c = [{ title: "a", voteAverage: 7.1, voteCount: 60 }, { title: "b", voteAverage: 8.5, voteCount: 60 }];
  const r = rankViaJev(c);
  assert.equal(r.ordered[0].title, "b");
  assert.equal(r.degraded, true);
});
