# Jev matcher: TypeSafe System One decisions + small-LLM why-copy (emotion movie recommender MVP)

Date: 2026-10-16 (corrected). Ticket: Manny-Abraham/day4project#6. Parent map: Manny-Abraham/day4project#1.
Stack context: Convex + Svelte + Tailwind. Catalogue cached per `research/catalogue-sources.md` (TMDB primary, OMDb ratings fallback).
Purpose: fact-finding only for the open grilling session on ticket #6. No decision is closed here.

## 0. Correction — "Jev" is NOT an embedding model

The previous version of this file (commit e159fe1) guessed "jev" meant a small embedding
model (Jina-small class). **That guess was wrong and is superseded.**

"Jev" is **Jev by TypeSafe AI (typesafe.ai)** — the first **System One decision model**:
unstructured state in, **typed probabilistic decisions out**. It does not generate prose
and cannot hallucinate strings. The old embedding fast-filter design (§5 appendix) is kept
below only as a rejected alternative. Do not build it under the "jev" name.

Primary sources for everything below: https://typesafe.ai,
https://typesafe.ai/blog/introducing-system-one-models-and-jev,
https://docs.typesafe.ai/introduction, /introduction/quickstart, /api, /models,
/confidence, /cookbooks/rerank_typesafe, /cookbooks/parallel_questions,
https://www.langchain.com/blog/building-a-harness-with-jev, and the TypeSafe console +
Playground (https://console.typesafe.ai/playground).

## TL;DR

- **Jev role:** owns every *quick decision* in the matcher — (1) normalize free-text +
  image-quiz answers to one of the 8 emotion tags with calibrated confidence +
  threshold/escalate, (2) score ~30 candidates down to a top-5 pick with probabilities,
  (3) fire the empty-state trigger. All outputs are typed values (`choice` /
  `probabilities` / `confidence`, `noul` 0–1, `score`) that code branches on.
- **Alongside an LLM: yes, with a hard split.** Jev never writes prose. A small hosted LLM
  owns exactly one job: the 1-line why-match copy per pick. It never scans the catalogue
  and never ranks; it receives the 5 decided picks only.
- **API shape:** `POST https://api.typesafe.ai/v1/systemone` with
  `Authorization: Bearer $TYPESAFE_API_KEY`, body `{state, model: "jev-latest", questions}`
  where questions are `choice` / `score` / `noul` maps; answers return under the same keys
  plus `usage {input_tokens, output_tokens}`.
- **Latency/cost:** Jev 70–500 ms end-to-end (40–200× faster than frontier LLMs on System
  One tasks); $0.042 / 1M input tokens ($42/BTok), **output tokens free**. A matcher call
  (~1–5k input tokens) costs ~$0.00005–0.0002 vs ~$0.0005–0.002 for a small-LLM re-rank and
  ~$0.014 / ~8.6 s for an LLM-only workflow (TypeSafe homepage demo figures).
- **Confidence handling:** gate on `confidence` (choice/score) or distance-from-0.5 (noul):
  high → act, medium → proceed-with-caution (confirm / templated copy), low → escalate
  (clarify, popularity fallback, `degraded: true`). Retry 429/529 with backoff; SDKs do
  this by default.
- **Access caveat:** Jev is in **early access behind a waitlist** (blog Sep 15 2026: "opening
  early access and bringing developers off the waitlist as quickly as we can"). Get a key at
  https://console.typesafe.ai/keys; until the key lands, build against the Playground and
  keep the LLM-only/templated fallback working.

## 1. What Jev is (and is not)

- System One model class (named for Kahneman fast thinking; trained with Reinforcement
  Learning for Calibrated Decisions, RLCD — not RLHF). Optimized for *decisions inside
  software*, not chat. Sources: typesafe.ai homepage; intro blog.
- **Inputs:** `state` = unstructured text or structured JSON (our user profile +
  candidates); `questions` = typed questions about that state. Any mix of question types
  per request; each evaluated **in parallel, in isolation** — adding questions barely
  changes latency and does not cause context-rot. Sources: docs /introduction, /patterns/fan-out.
- **Outputs:** typed answers only — never prose, never tool calls, never refusals:
  - `choice`: picks one of ≤255 defined options → `{choice, probabilities, confidence}`.
  - `score`: rates against 2–10 ordered levels → `{score, probabilities, confidence, legend}`.
  - `noul`: yes/no probability → `{noul}` 0–1 (no separate confidence; use `|2p−1|`).
  - "No type errors … mathematically impossible"; zero hallucinations by construction
    (nothing to hallucinate — no string generation). Sources: /api, /primitives/*, blog.
- **Not** a smaller LLM, **not** JSON-mode-on-an-LLM, **not** an embedding model. It gives
  up string generation to gain parallel sampling + calibration. Source: blog FAQ "Is Jev
  just a smaller LLM?"; LangChain harness post.

## 2. Which decisions Jev owns in OUR system

Inputs per request: `current-text` (free text, optional, tone only per GLOSSARY.md),
`desired` (required target feeling), `image-quiz` answers (structured picks). Jev accepts
images in state too (docs /images), but MVP sends quiz answers as JSON — cheaper and
sufficient.

| # | Decision | Jev question shape | Output used in code |
|---|---|---|---|
| D1 | Normalize free-text + quiz → 1 of 8 emotion tags (Happy/Sad/Stressed/Angry/Bored/Lonely/Excited/Tired-Relaxed) | One `choice` with 8 criteria (each tag + 1-line rubric from GLOSSARY.md), state = `{current_text, desired_text, quiz}` | `choice` + `probabilities` + `confidence`; threshold → escalate (see §4) |
| D2 | Score ~30 tag-filtered candidates → top-5 pick | Option A (recommended): **one `choice` with 30 options** (cardinality ≤255) in a single request; state = `{user profile, candidates[]}`. Option B (per cookbook): one `noul` per query-candidate pair ("could this candidate deliver {tag} for this user?"), sort by `noul` desc. A is 1 call; B is 30 parallel calls (cookbook ran 1200 calls concurrently, $0.0645 total) | `probabilities` sorted → top 5 ids; keep full distribution for ties |
| D3 | Empty-state trigger (no candidate fits / user input too thin) | `noul` "does any candidate fit?" or gate on D2 top-`noul` < floor (e.g. 0.35) and D1 `confidence` < 0.5 | boolean in code → empty-state UI path |
| — | 1-line why-match prose | **NOT Jev.** Small LLM over the 5 decided picks only (see §3) | string ≤140 chars per pick |

Decompose-then-compose rule (docs /concepts/how-to-build-with-system-one): keep each
question atomic (one gut-check each), combine with weights/thresholds **in code**, never
in one mega-prompt.

## 3. What stays with the small LLM (prose only)

Jev returns typed values, never prose — so the "why this matches" line must come from
elsewhere. Scope the LLM to exactly this:

- Input: 5 decided picks (tmdbId | title | genres | rating | 1–2-line overview) + decided
  emotion tag. (~500–800 input tokens, not the ~2–4k of LLM re-rank.)
- Output: JSON `{"picks":[{"tmdbId":number,"why":string}]}` — each `why` ≤ 140 chars, names
  the feeling, no spoilers, no invented facts. Temperature 0–0.3, JSON mode.
- The LLM never ranks, never filters, never sees the 30-candidate list. If it is down or
  its output fails validation, fall back to templated copy (see §4) — the picks stand
  because Jev already decided them.

## 4. Exact Convex integration

Server action only. The browser (Svelte) never holds `TYPESAFE_API_KEY` and never calls
TypeSafe directly.

```ts
// convex/matcher.ts — action (Convex actions support fetch in default runtime)
"use node"; // NOT needed for plain fetch; only if using the TS SDK's node deps
import { action } from "./_generated/server";

export const recommend = action(async (ctx, args: {
  currentText?: string; desiredText: string;
  quiz: { energy: string; company: string; pace: string };
}) => {
  // 1. deterministic pre-filter (free): candidates already cached in movies table
  const candidates = await ctx.runQuery("movies:listByTag", { /* tag after D1 */ });
  const shortlist = candidates.slice(0, 30); // tag + rating/popularity order

  // 2a. D1 — normalize to 8-tag (one Jev call, choice-8)
  // 2b. D2 — rank shortlist (one Jev call, choice-30 or 30 parallel nouls)
  const res = await fetch("https://api.typesafe.ai/v1/systemone", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.TYPESAFE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "jev-latest", // pin "jev-1.14.0" once thresholds are tuned (aliases move)
      state: {
        current_text: args.currentText ?? "",
        desired_text: args.desiredText,
        quiz: args.quiz,
        candidates: shortlist.map(m => ({
          tmdbId: m.tmdbId, title: m.title,
          genres: m.genres, rating: m.rating, overview: m.overview,
        })),
      },
      questions: {
        desired_tag: { type: "choice", instructions: "Which target feeling best matches what the viewer wants?",
          criteria: { Happy: "…", Sad: "…", Stressed: "…", Angry: "…",
            Bored: "…", Lonely: "…", Excited: "…", "Tired-Relaxed": "…" } },
        best_pick: { type: "choice", instructions: "Which candidate best delivers {desired} for this viewer?",
          criteria: { /* 30 × tmdbId: title + genres */ } },
        anything_fits: { type: "noul", instructions: "Does at least one candidate fit the desired feeling?",
          criteria: { true: "a listed candidate clearly delivers it",
                      false: "none clearly delivers it" } },
      },
    }),
  });
  // 3. combine in code: threshold desired_tag.confidence, sort
  //    best_pick.probabilities → top 5, gate anything_fits.noul → empty state
  // 4. small-LLM why-copy over top 5 only (or templated fallback)
});
```

Notes:
- Limits: 64k tokens/request, 32k per-question (`state` + any one question); 32 MiB body;
  ≤255 options per choice; ≤10 score levels; 64 nesting levels. Long-context header
  (`TypeSafe-Danger-Zone-Long-Context: true`) raises both to 262k — slower, avoid for MVP.
  Sources: /models, /api.
- Parallelism: D1+D2+D3 ride in **one request** (parallel questions, ~same latency as one).
  30-candidate Choice fits easily in context (30 × ~120 tokens ≈ 3.6k).
- Errors: 401 = bad key; 400/422 = schema; 413 = body; **429/529 → exponential backoff +
  retry** (SDKs default). Log `response.model` (versioned id) with every decision for
  threshold tuning across releases. Sources: /api, /models (aliases).

## 5. Latency / cost math vs LLM-only

| Path | Calls | Latency | Cost (at $0.042/M in, out free for Jev) |
|---|---|---|---|
| Jev D1+D2+D3 (one request, ~2–5k input tokens) | 1 | 70–500 ms | ~$0.0001–0.0002 |
| Small-LLM why-copy (5 picks, ~700 in / ~150 out) | 1 | ~0.5–1.5 s | ~$0.0001–0.0005 (provider-dependent) |
| **Jev + LLM total** | 2 | **~0.6–2 s** | **~$0.0003–0.0007 (≈ $0.30–0.70 / 1k req)** |
| Small-LLM re-rank (old plan: 20 candidates, ~2.5k in) | 1 | ~1–3 s | ~$0.0005–0.002 |
| LLM-only workflow (TypeSafe homepage demo) | N | 8.566 s, $0.01388 | ~$14 / 1k req — ~40× our Jev+LLM cost |

Jev-side figures from: blog + homepage (193.6× faster / 444.6× cheaper on System One
workflows; 70–500 ms vs 3–329 s LLM); /models (pricing, context); rerank cookbook (1200
calls, 1.536M in-tokens → $0.0645). LLM-side from prior file version (gpt-4o-mini-class
pricing, kept as order-of-magnitude only).

## 6. Fallback: low-confidence and Jev-down

Confidence semantics (docs /confidence): choice/score `confidence` ∈ [0,1] derived from
the probability spread (1 = all mass on one outcome, 0 = even split). Noul has no
confidence — threshold `noul` directly (unsure ≈ 0.5; confidence-style `|2p−1|` if you
want one scale).

Suggested thresholds (tune on own data; start conservative):

- `desired_tag.confidence ≥ 0.7` → accept tag. `0.4–0.7` → accept but flag
  `unverified:true` (UI shows "quick picks" badge). `< 0.4` → ask one clarifying quiz
  question or default to popularity within the top-probability tag.
- `best_pick` top-`probabilities` gap (top1/top2 ratio) < ~1.3 → tie: prefer higher
  rating/popularity deterministically.
- `anything_fits.noul < 0.35` → empty-state path ("nothing fits — try…") instead of
  forcing 5 weak picks.
- Jev 429/529 → backoff retry (≤2), then degraded; other 4xx → log + degraded (don't
  retry 401/422). Jev down/timeout (>2 s budget) → deterministic fallback: tag-keyword
  filter + rating/popularity sort → top 5 with **templated why-copy**
  (`"Matches {tag} via {genres} · ★{rating}."`), `degraded: true` so Svelte shows the
  badge. Never block render on either AI call.

## 7. Open signup / access caveat

Jev is in **early access behind a waitlist** as of the Sep 15 2026 launch post; TypeSafe
says they are "bringing developers off the waitlist as quickly as we can." Practical
consequences for ticket #6: (1) request access now (console.typesafe.ai) and record key
procurement as a dependency; (2) build the Convex action behind an interface so the
deterministic fallback (§6) is the working default until the key lands; (3) validate copy
shapes in the browser Playground (no code needed) in the meantime; (4) pin the versioned
model id once access arrives, since `jev-latest` moves under you.

## Appendix A (SUPERSEDED — kept for audit): old "jev = small embedding" guess

Commit e159fe1 reasoned "jev" was a Jina-small-class embedding pre-filter + Convex
`vectorIndex` + `ctx.vectorSearch` + small-LLM re-rank (§§1–5 of the old file). That
reading is **withdrawn**: the ticket's "Jev" is the TypeSafe decision model above, which
replaces the embedding step (semantic scoring happens inside Jev's questions, no vectors
stored, no index dims to tune). A `vectorIndex` remains a legitimate *alternative* fast
layer if Jev access stalls — tag-filter + popularity/rating sort (old option B) is the
cheaper interim, since it needs no index at all.

## Sources (primary, fetched 2026-10-16)

- https://typesafe.ai (System One positioning, $42/BTok, 193.6×/444.6× workflow claim)
- https://typesafe.ai/blog/introducing-system-one-models-and-jev (RLCD, parallel sampler, typed values + calibrated confidence, no string generation/hallucination, 70–500 ms, 64k/32k, cardinality 255, early-access waitlist)
- https://docs.typesafe.ai/introduction (state+questions→answers mental model, choice/score/noul table)
- https://docs.typesafe.ai/introduction/quickstart (endpoint, TYPESAFE_API_KEY, SDK + curl shapes, playground)
- https://docs.typesafe.ai/api (request/response schema, 255-choice / 10-level / 32 MiB / 64-nesting limits, error + 429/529 retry rules)
- https://docs.typesafe.ai/models (jev-1.14.0/jev-1.13.0, $0.042/MTok in + free out, 64k/32k + 262k long-context header, aliases, rate limits per-org)
- https://docs.typesafe.ai/confidence (confidence formulas, three-path gating, risk-scaled thresholds)
- https://docs.typesafe.ai/cookbooks/rerank_typesafe (BM25→TypeSafe rerank: top-1 5%→18%, 1200 calls/$0.0645 pattern for D2)
- https://docs.typesafe.ai/cookbooks/parallel_questions (13 questions in 1 call: 12.2× cheaper, 10× faster, same answers)
- https://www.langchain.com/blog/building-a-harness-with-jev (state+questions JSON, choice/score/noul kinds, TypeSafeClassifier, router/guardrail middleware = Jev-complements-LLM precedent)
- Repo context: `research/catalogue-sources.md` (TMDB/OMDb cache-first actions), `GLOSSARY.md` (8 emotion tags; current-text tone-only vs desired required), ticket #6 body
