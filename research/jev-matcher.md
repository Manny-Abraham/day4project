# jev matcher: fast similarity layer + LLM re-rank (emotion movie recommender MVP)

Date: 2026-10-16. Ticket: Manny-Abraham/day4project#6. Parent map: Manny-Abraham/day4project#1.
Stack context: Convex + Svelte + Tailwind. Catalogue cached per `research/catalogue-sources.md` (TMDB primary, OMDb ratings fallback).
Purpose: fact-finding only for the open grilling session on ticket #6. No decision is closed here.

## TL;DR

- There is **no standard product, API, or Convex feature called "jev"**. No authoritative match was found in Convex docs, OpenAI/Voyage/Cohere/Jina embedding docs, or the TMDB/OMDb surface surveyed.
- **Most likely meaning (ranked #1): a small embedding model for fast similarity pre-filter** — i.e. the "Jina-small / BGE-small / MiniLM / Voyage-lite" class the ticket discussion gestured at. "jev" reads as shorthand/typo in that cluster (closest real name: **Jina Embeddings V-series**, e.g. `jina-embeddings-v3`, a 570M-parameter multilingual embedding model).
- **Recommended fast layer:** precomputed overview embeddings in a Convex vector index with tag `filterFields`, queried once per request from a Convex action; then a **small hosted LLM re-ranks to top 5 + writes the 1-line why-match**.
- **Alongside an LLM: yes.** Embedding fast-filter + small-LLM top-5 re-rank beats LLM-only on cost, latency, and determinism for this catalogue shape. The LLM never scans the catalogue; it only sees ~20 candidates.
- **Latency/cost note:** per request ≈ 1 embedding call (tens of tokens, ~100–300 ms, ~$0.0000004) + 1 small-LLM call over ~20 candidates (~2–4k input tokens, ~1–3 s, ~$0.0005–0.002 with `gpt-4o-mini`-class pricing). Embedding the catalogue is a one-time sync-time cost, not per request.

## 1. What "jev" most plausibly refers to

No primary source defines "JEV" as a matcher component. Candidates ranked by fit to the ticket wording ("quick decision making in this system", "used alongside an LLM"):

| # | Reading | Fit | Verdict |
|---|---|---|---|
| 1 | **Small embedding model for fast similarity** (Jina-small / `text-embedding-3-small` / Voyage-lite / BGE-small / MiniLM class) | Directly answers "quick decision": single vector lookup narrows hundreds of cached movies to ~20 in ms + one API call | **Most likely intent. Recommend adopting this meaning in grilling.** |
| 2 | **Convex vector search** (the `vectorIndex` + `ctx.vectorSearch` mechanism) | This is the *infrastructure* reading #1 runs on, not a model; fits "in this system (Convex)" | Plausible as shorthand for "the Convex fast layer". Keep as the mechanism, not the model. |
| 3 | **Small classifier / reranker** (Cohere Rerank 3.5, cross-encoder, or `gpt-4o-mini`-as-judge over candidates) | Matches "decision making" but rerankers *replace* the LLM re-rank step rather than sit beside it | Least likely as the meaning of "jev"; evaluate as an *alternative* to the small-LLM step (see §5). |

Grilling question to close the ambiguity: *"By 'jev' did you mean a small embedding model (Jina-small class) doing the fast pre-filter before the LLM re-rank?"* If yes, §3 is the spec. If they meant a reranker service, §5 option C applies.

## 2. Convex constraints that shape the answer (primary sources)

- Vector search needs a `vectorIndex` on a table: `vectorField`, fixed `dimensions` (2–4096, must match the embedding length), up to 16 `filterFields`, up to 4 vector indexes per table. Source: Convex Vector Search docs (`docs.convex.dev/search/vector-search`).
- `ctx.vectorSearch` runs **only inside actions** (never queries/mutations directly). Pattern: embed the query via `fetch` to a third-party API in the action → `ctx.vectorSearch(table, index, { vector, limit, filter })` → load docs via `ctx.runQuery`. Returns `{ _id, _score }` (`-1`–`1` cosine ANN, relevance-ordered, `limit` 1–256). Source: same page + Convex Actions docs (`docs.convex.dev/functions/actions`).
- `filterFields` support exact-equality filters (`q.eq(...)`, `or` of them) pushed into the index — this is where the deterministic tag-filter lives (emotion tag, genre). Score-threshold or secondary filtering happens in the action after results return. Source: Vector Search "Filter expressions" + "Other filtering" sections.
- Default action runtime supports `fetch` (no `"use node"` needed for hosted embedding/LLM APIs); `"use node"` is only for Node-only packages. Actions time out after 10 min; memory 64 MB default / 512 MB Node. Billing for vector search is in query-GBs over the index size. Sources: Actions docs; Vector Search "Costs"/"Limits".
- Fit to ticket: `filterFields: ["emotionTag", "genre"]` (or genre array handling per schema) gives **tag-filter then re-rank in one index call** — exactly the "rule tag-filter then re-rank" shape ticket #6 asks for.

## 3. Lightweight embedding options that fit Convex

All options below are *hosted-API* calls from the action (fits default runtime). Self-hosting (BGE-small/MiniLM in-process) does **not** fit: no GPU/persistent sidecar in Convex actions; would need an external host + `fetch` anyway, adding ops for no MVP gain.

| Model (hosted API) | Dims (native) | Shrinkable? | Price (input) | Notes for this MVP |
|---|---|---|---|---|
| `text-embedding-3-small` (OpenAI) | 1536 | Yes — `dimensions` param (e.g. 512/256, Matryoshka-trained) | **$0.02 / 1M tokens** (~62,500 pages/dollar); MTEB 62.3% | Default pick. Docs explicitly bless shortening (large@256 still beats ada-002@1536). Precompute overviews at sync; per-request embed is one short phrase. Sources: OpenAI Embeddings guide + v3 announcement pricing. |
| Voyage-lite class (`voyage-3-lite` / `3.5-lite`) | 512 (lite) / 1024 (full) | Yes (lite offers 2048/1024/512/256 variants) | **~$0.02 / 1M tokens** (lite) | Smaller native dims → smaller Convex index → lower query-GB billing. Strong retrieval-per-dollar. Verify current dims/pricing at implementation; surveyed via Voyage blog + gateway listings. |
| Cohere `embed-english-light` / Jina `jina-embeddings-v3` | 384 (Cohere light) / up to 1024 (Jina v3, 570M params, 89 langs, 8k context) | Varies by endpoint | Jina currently the value pick in third-party comparisons; Cohere light similar tier | Credible alternatives if multilingual or per-token savings matter. Jina v3 is the closest real product to "jev" by name. Sources: Jina model card; comparison surveys (secondary — confirm price at build). |
| BGE-small / MiniLM self-hosted | 384 | n/a | infra cost, not per-token | Rejected for MVP: no fit in Convex action runtime; external host required. Revisit only for offline/batch or strict data-residency needs. |

Recommendation: **`text-embedding-3-small` at reduced dims (512, or 256 if index cost bites), precomputed per movie at catalogue-sync time.** Single-vendor with the LLM call if the team picks OpenAI for both (one key, one retry policy). Voyage-lite is the drop-in swap if retrieval quality per dollar wins in testing — the Convex index `dimensions` is the only code change.

Schema sketch (extends `research/catalogue-sources.md` §7):

```ts
// movies table (existing fields per catalogue-sources) +:
embedding: v.array(v.float64()),      // or separate movieEmbeddings table per Convex "Advanced patterns"
emotionTag: v.string(),               // one of the 8 GLOSSARY tags
// schema:
.vectorIndex("by_emotion_embedding", {
  vectorField: "embedding",
  dimensions: 512,                    // must equal embed output length
  filterFields: ["emotionTag"],       // genre second if cardinality allows (≤16 fields)
})
```

Action sketch (per Convex docs pattern):

```ts
// 1. embed short desired-feeling phrase via fetch (tens of tokens)
// 2. ctx.vectorSearch("movies", "by_emotion_embedding",
//      { vector, limit: 20, filter: q => q.eq("emotionTag", desiredTag) })
// 3. ctx.runQuery(load candidates) → pass to LLM re-rank (§4)
```

## 4. Pattern: embedding fast-filter + small LLM top-5 + why-match (vs LLM-only)

### Recommended pipeline (per request)

1. **Deterministic tag-filter (free):** normalise desired feeling → 1 of 8 `emotionTag`s (GLOSSARY.md); genre/rating thresholds as `filterFields`/post-filters. Zero tokens.
2. **Embedding fast-filter (~100–300 ms):** 1 embed call on `"desired feeling + genre hint"` (~20–40 tokens) → `vectorSearch` top 20 (limit ≤ 256 allowed; 20 is the cost/quality sweet spot).
3. **Small-LLM re-rank + why-match (~1–3 s):** 1 chat call over the 20 candidates (title + 1–2-line overview each ≈ 100–150 tokens → ~2–3k input tokens) → JSON out: top 5 ids + 1-line why-match each.

Prompt shape (small hosted model, e.g. `gpt-4o-mini` class; temperature 0–0.3, JSON mode):

```text
system: You rank movies for a target feeling. Reply ONLY as JSON:
  {"picks":[{"tmdbId":number,"why":string}],"picks.length":5}.
  Each "why" ≤ 140 chars, names the feeling, no spoilers, no invented facts.
user: Desired feeling: {Excited}. Avoid: {horror, rating<7}.
  Candidates (tmdbId | title | genres | rating | overview):
  123 | … | Comedy,Adventure | 7.8 | …
  … (20 total)
```

### Fallback when the LLM is down (ticket explicitly requires this)

- Return the embedding-order top 5 directly with **templated why-copy** (no LLM): `"Matches {Desired feeling} via {genres} · ★{rating} · {short overview clause}."`
- Mark response `degraded: true` so the Svelte UI can show a "quick picks" badge instead of curated copy.
- Retry policy: 1 retry with backoff, then fallback — never block render on the LLM (same principle as catalogue-sources §6: nullable enrichment never blocks).
- Cache last-good LLM picks per `(emotionTag, genre, ratingBand)` with short TTL via the Action Cache component for repeat traffic.

### Cost/latency bounds (per request, `gpt-4o-mini`-class: $0.15/1M in, $0.60/1M out)

| Step | Tokens/API | Latency | Cost |
|---|---|---|---|
| Query embed (1 call, ~30 tokens) | ~30 in | ~100–300 ms | ~$0.0000006 |
| `vectorSearch` top-20 | index scan (query-GBs) | ~10–100 ms | Convex query-GBs (small index: hundreds of movies × 512 floats) |
| LLM re-rank (1 call, ~2.5k in / ~250 out) | ~2.75k total | ~1–3 s | ~$0.0005–0.001 |
| **Total per request** | | **~1.5–3.5 s p50** | **~$0.001 (≈ $1 per 1k requests)** |

Catalogue embedding is sync-time: ~500 movies × ~150 tokens ≈ 75k tokens ≈ **$0.0015 one-time** (negligible; re-embed only on overview change).

### Why not LLM-only?

- LLM-only must ingest the whole candidate set every request (hundreds of overviews ≈ 50k+ tokens) → 20× the input cost, multi-second+ latency, context-window pressure, and non-deterministic ranking with no stable `_score`.
- Embedding pre-filter is deterministic, cacheable (vectors stored), and reduces the LLM to a bounded 20-candidate judgment task — the only part LLMs add unique value to: taste, trade-offs ("uplifting but not saccharine"), and the 1-line why-copy.
- Cohere's own Rerank positioning concedes the same architecture (retrieve 50–200 → rerank top-k to cut LLM tokens); a dedicated reranker (Rerank 3.5 ≈ $2/1k queries) is 1000× the per-request cost of the embedding step and still can't write why-copy — so keep the small LLM, not a rerank API, for the final step. Sources: Cohere Rerank docs/blog (secondary fetches 2026-10-16); OpenAI pricing surveys.

## 5. Options for the grilling session (decision aid, not a decision)

- **A (recommended): tag-filter → small-embedding top-20 → small-LLM top-5 + why-match.** Cheapest flexible; fallback = embedding order + templated copy.
- **B (no-vector MVP): tag-filter + popularity/rating sort → small-LLM top-5.** Zero vector index; loses semantic matching on overviews ("comforting", "bittersweet"). Acceptable if sync-time embedding is deferred.
- **C (reranker swap): tag-filter → embedding top-50 → Cohere Rerank top-5, LLM only for why-copy.** Highest precision, highest cost/latency (extra hop + $2/1k queries). Only if A/B relevance tests fail.

Suggested grilling close-out: confirm (i) "jev" = option A fast layer, (ii) embedding vendor (OpenAI-small default vs Voyage-lite), (iii) index dims (512 vs 256), (iv) fallback copy template, (v) per-request latency budget (3 s?) and degraded-mode badge.

## Sources (primary, fetched 2026-10-16)

- https://docs.convex.dev/search/vector-search (vectorIndex shape, dimensions 2–4096, filterFields, action-only vectorSearch, cosine ANN, limits, query-GB billing)
- https://docs.convex.dev/functions/actions (fetch in default runtime, runQuery/runMutation from actions, 10-min timeout, scheduling anti-pattern)
- https://developers.openai.com/api/docs/guides/embeddings (1536/3072 dims, dimensions-shortening, pages-per-dollar table, $/token priced input)
- https://openai.com/index/new-embedding-models-and-api-updates/ (5× price cut small vs ada-002; Matryoshka shortening; large@256 beats ada-002@1536)
- https://jina.ai/models/jina-embeddings-v3/ (570M params, 89 languages, 8k context — closest "jev" name match)
- https://blog.voyageai.com/2024/09/18/voyage-3/ (lite dims/pricing tier; 3–4× smaller dims → lower vector-DB cost)
- https://cohere.com/rerank + https://cohere.com/blog/rerank-3 (retrieve-then-rerank pattern; 90–98% cheaper than LLM-ranking claim)
- Price/latency cross-checks (secondary): pecollective.com text-embedding/gpt-4o-mini pricing ($0.02/1M embed; $0.15/$0.60 mini), vercel.com AI Gateway (voyage-3.5-lite dims, rerank-v3.5 $2/1k queries)
- Repo context: `research/catalogue-sources.md` (TMDB primary/OMDb fallback, Convex cache-first actions pattern), `GLOSSARY.md` (8 emotion tags), ticket #6 body (tag-filter → small LLM re-rank → top 5 + why-match + fallback + bounds)
