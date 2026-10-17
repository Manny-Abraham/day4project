## Problem Statement

Viewers know how they feel now and how they want to feel, but cannot quickly turn that into a movie pick. Browsing TMDB-style catalogues by genre/rating ignores the emotional arc (Stressed to Relaxed), and free-text mood entry has nowhere to go. The result is scrolling without a confident, explainable top pick.

## Solution

A Convex + Svelte + Tailwind web app that takes current feeling (optional text) + desired feeling (required, normalized to one of 8 tags, via chips or image quiz) and returns 5 explainable picks. Convex tag-filters cached TMDB (+ OMDb ratings fallback), Jev picks/ranks the top 5 with confidence, and a small LLM writes only the one-line why-match arc copy. Voice-to-text arrives in v2.

## User Stories

1. As a viewer, I want to type my current feeling in free text, so that the picks can acknowledge where I am now.
2. As a viewer, I want quick-pick chips for both fields, so that I can answer in one tap without typing.
3. As a viewer, I want to pick a desired feeling from a fixed set, so that matching stays reliable.
4. As a viewer, I want desired to allow the same value as current, so that I can get a comfort watch.
5. As a viewer, I want to answer a 6-image quiz instead of picking words, so that choosing feels playful like BuzzFeed.
6. As a viewer, I want to skip the quiz to manual picks, so that I am never trapped in the quiz.
7. As a viewer, I want to dictate my current feeling by voice (v2), so that I can answer hands-free with typing fallback.
8. As a viewer, I want validation that blocks Recommend until desired is set, so that I never get random results.
9. As a viewer, I want to see 5 poster cards with title/year/genre/ratings, so that I can scan fast.
10. As a viewer, I want a one-line why-match arc (current to desired) per card, so that I trust the pick.
11. As a viewer, I want trailer links that open in a new tab when available, so that I can preview without losing my list.
12. As a viewer, I want IMDb/RT badges only when enriched, so that missing data never looks broken.
13. As a viewer, I want an explicit empty state with loosen-to-6.5 plus retry, so that zero hits still move me forward.
14. As a viewer, I want a degraded badge when fallback ranking is used, so that I calibrate trust.
15. As a keyboard user, I want focusable cards/buttons with poster alt text and AA contrast, so that the list is usable without a mouse.
16. As a builder, I want TMDB attribution in footer/About from day one, so that non-commercial use stays compliant.

## Implementation Decisions

- Single primary seam: Convex `recommend(desiredTag, currentText?)` action. Svelte UI calls only `recommend` plus `getQuiz`; TMDB/OMDb/Jev/LLM live behind the seam and are stubbed in tests. Secondary server-only seams for sync/Jev/LLM copy if isolation is needed.
- Vocabulary follows GLOSSARY.md: current feeling (optional tone-only text), desired feeling (required target normalized to tag), emotion tag (fixed 8: Happy, Sad, Stressed, Angry, Bored, Lonely, Excited, Tired/Relaxed as one comfort tag).
- Inputs: unified text box + 8 chips for both fields, 280-char trim/collapse normalized; desired required with empty-prompt default; mic (v2 Web Speech filling current live, typed fallback, server Whisper only if browser unsupported, never blocks Recommend).
- Image quiz v1: one question, 6 images in `quizOptions` weighted to the 8 tags; one tap sets desired (Jev tie-break on low spread); raw quiz label retained for copy tone.
- Catalogue: TMDB primary (discover/search/details/images/videos, poster/backdrop paths via configuration, voteAverage/voteCount/popularity, free non-commercial with logo + notice), OMDb fallback for ratings only via `imdb_id` join (imdbRating/imdbVotes/Rotten Tomatoes nullable, 1k/day, CC BY-NC, patron-gated posters ignored).
- Movie record: tmdbId, imdbId, title, overview/synopsis, genres, releaseDate/year, runtime, posterPath, backdropPath, voteAverage, voteCount, popularity, imdbRating, imdbVotes, rottenTomatoes, trailerYouTubeKey nullable from TMDB videos (YouTube Trailer), desiredTags (1-3, overlap match on desired), lastSyncedAt. Seed via TMDB discover presets per emotion in `emotionMaps`, cached — no static JSON.
- Convex tables: `movies`, `emotionMaps` (emotion to genres/keywords/sort/min-votes), `quizOptions`, `syncState` (per-preset timestamps). No history table in v1. Secrets (TMDB key/Bearer, OMDb key, TYPESAFE_API_KEY, LLM key) in server actions only, never in the Svelte bundle.
- Caching: cache-first 14d catalogue / 7d ratings, scheduled refresh on stale read; OMDb enrichment lazy for top candidates only, failures leave nulls rather than errors.
- Matching inside `recommend`: tag-filter (desired in tags, voteAverage >= 7.0, voteCount >= 50) to up to 30 by voteAverage; Jev normalizes free-text/quiz to 8-tag and scores 30 to top 5 plus fit signal with calibrated confidence; small LLM (temp 0.3, input capped 30x200-char synopses) writes only the 120-char spoiler-free arc copy. Jev order is final; tie-break voteAverage then voteCount; LLM never re-sorts.
- Confidence gating from Jev: high auto-act, mid show badge/confirm, low ask-clarify; Jev/LLM failure or timeout falls back to voteAverage order + template why-match with `degraded:true` badge. Total budget about 0.6-2s and about $0.30-0.70 per 1k requests; Jev early-access waitlist so build fallback-first and pin versioned model id once keyed.
- Ranking/count/empty: top 5 fixed; empty on fit-low/zero-hits shows card with one-tap loosen (6.5, then same genre family) plus retry; no silent auto-loosen.
- Results UI v1 from prototype (branch `prototype/results-ui`, file `prototype/results-ui.html`, never merged): A-grid responsive 1-2-3 columns; B rail / C why-first list parked. Card fields exactly poster + alt, title/year, genre, TMDB star + conditional IMDb/RT, why-match, conditional trailer, degraded badge. A11y floor: focusable controls/cards, alt text, AA contrast, `prefers-reduced-motion` disables rail motion; details left to build.
- Research assets (never merged): `research/catalogue-sources.md` (TMDB vs OMDb + Convex caching plan) and `research/jev-matcher.md` (TypeSafe Jev System One + LLM split, latency/cost, confidence handling) on `research/*` branches, linked from their tickets.

## Testing Decisions

- Test external behavior only (inputs to picks/badges/empty states), not model internals or CSS.
- Primary coverage at the `recommend` action seam with stubbed TMDB/Jev/LLM: tag-filter + thresholds, Jev-order preservation with vote tie-breaks, why-match cap/tone passthrough, conditional trailer/badges, degraded fallback, empty loosen/retry.
- Secondary server-only tests for sync TTL, quiz-to-tag mapping, and confidence gates as needed.
- UI tests assert card fields/badges/empty-state/a11y floor against the A-grid stub, not pixel fidelity.
- No prior art in this greenfield repo; the prototype HTML and research markdowns are the reference fixtures.

## Out of Scope

- Custom ML model training; Jev + small hosted LLM only.
- Admin UI for catalogue editing; Convex seed-script/table edit only.
- Native mobile/offline; web MVP only.
- Custom backend beyond Convex; Convex actions/tables only.
- Watch history, accounts, persistence/personalization beyond cache; no history table in v1.

## Further Notes

- Wayfinder map [Map: emotion-based movie recommender spec](https://github.com/Manny-Abraham/day4project/issues/1) is 8/8 decisions closed; this spec is the handoff artifact.
- Jev is early-access (waitlist via console); validate prompts in the Playground once keyed and keep template fallback as the default path until then.
- Commercial launch needs a TMDB commercial licence and must drop OMDb (non-commercial only); show TMDB logo + notice from day one.
