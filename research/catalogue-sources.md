# Catalogue sources: TMDB vs OMDb (emotion movie recommender MVP)

Date: 2026-10-16. Ticket: Manny-Abraham/day4project#3. Parent map: Manny-Abraham/day4project#1.
Stack context: Convex + Svelte + Tailwind. Goal: unblock schema decision for movie catalogue.

## TL;DR recommendation

- **TMDB as primary catalogue** (discovery, search, details, posters/backdrops, genres, TMDB rating).
- **OMDb as optional fallback/enrichment for ratings only** (IMDb rating/votes + Rotten Tomatoes), keyed by `imdb_id` from TMDB (`movie-details.imdb_id` or `/movie/{id}/external_ids`).
- Do **not** use OMDb as primary: no discovery endpoint, thin search, single poster only (patron-gated hi-res), 1,000 req/day free cap, CC BY-NC 4.0 non-commercial-only terms.
- Cache everything in Convex (see §6). Never call either API from the browser with a secret key.

## 1. Discovery / search endpoints

### TMDB (v3, `https://api.themoviedb.org`)

| Endpoint | Purpose for MVP | Key params |
|---|---|---|
| `GET /3/discover/movie` | Emotion→genre/keyword browsing; 30+ filters + sort | `with_genres` (AND `,` / OR `|`), `with_keywords`, `vote_average.gte`, `vote_count.gte`, `primary_release_date.gte/lte`, `sort_by` (`popularity.desc`, `vote_average.desc`…), `page`, `language`, `region`, `watch_region` + `with_watch_providers` |
| `GET /3/search/movie` | Title text search (original/translated/alternative titles) | `query` (required), `year`, `primary_release_year`, `page`, `language`, `region`, `include_adult` |
| `GET /3/movie/{movie_id}` | Details for card + detail view; `append_to_response` supported | returns `genres[]`, `overview`, `runtime`, `release_date`, `poster_path`, `backdrop_path`, `popularity`, `vote_average`, `vote_count`, `imdb_id`, `origin_country`, `original_language` |
| `GET /3/movie/{movie_id}/external_ids` | Bridge key to OMDb | returns `imdb_id` (e.g. `tt0137523`), `wikidata_id`, social ids |
| `GET /3/movie/{movie_id}/images` | Gallery: `backdrops[]`, `posters[]`, `logos[]` with votes/dimensions | `language`, `include_image_language` |
| `GET /3/configuration` | Image URL construction | returns image `base_url` + available `file_size` values |

Sources: TMDB Discover Movie, Search Movie, Movie Details, External IDs, Images, Image Basics, Getting Started docs (developer.themoviedb.org).

Emotion-mapping fit: TMDB `with_genres` + `with_keywords` + `sort_by`/`vote_*` is the only one of the two that supports browsing by mood (e.g. comfort → Comedy/Family high `vote_average`, thrill → Thriller/Horror + popularity). OMDb has no equivalent.

### OMDb (`http://www.omdbapi.com/?apikey=KEY`, also `https://`)

| Form | Purpose | Params |
|---|---|---|
| `?t=` title | Single best match by title | `t` (required-ish), `y`, `type` (movie/series/episode), `plot` (short/full), `r` (json/xml) |
| `?i=` IMDb id | Single result by IMDb id — **the fallback join** | `i` (e.g. `tt1285016`), `plot`, `r` |
| `?s=` search | Thin title search, 10/page | `s` (required), `type`, `y`, `page` (1–100), `r` |
| Poster API `img.omdbapi.com` | Poster images | Patrons only |

At least one of `i`/`t` is required for detail; `s` requires a title. No genre/keyword discovery, no trending/popularity sort, no multi-poster/backdrop sets.

Sources: OMDb API usage/parameters tables (omdbapi.com), OMDb swagger.json (`/?t`, `/?i`, `/?s`, `apikey` query security).

## 2. Posters / backdrops

- **TMDB**: `poster_path` + `backdrop_path` on every movie; full galleries via `/images`; CDN assembly `https://image.tmdb.org/t/p/{size}{file_path}` with `base_url`/`file_size` from `/configuration` (e.g. `w500`). Multiple sizes; logos in SVG/PNG. Store `poster_path`/`backdrop_path`, resolve URLs client-side. Source: TMDB Image Basics + Movie Images + Details examples.
- **OMDb**: detail responses carry a single `Poster` URL (N/A when missing); dedicated Poster API (`img.omdbapi.com`) is **patron-only**, ~280,000 posters updated daily, up to 2000×3000. No backdrops. Source: OMDb homepage "Poster API … only available to patrons".

MVP implication: render all artwork from TMDB paths. OMDb adds zero artwork value on the free tier.

## 3. Ratings fields

- **TMDB** (native, per movie): `vote_average` (0–10) + `vote_count`, plus `popularity`. Good for sorting/filtering and social-proof display, but it is TMDB-community-only. Source: Movie Details + Discover/Sort examples.
- **OMDb** (the reason for fallback): aggregates third-party ratings. Documented usage returns `imdbRating`, `imdbVotes`, and a `Ratings[]` array carrying Rotten Tomatoes (and Metacritic) values; keyed by IMDb id/title. This is the only way in scope to show "IMDb / RT" badges users recognise.
  - Caveat: the `Ratings[]` shape was confirmed from OMDb's live usage-page examples and long-stable public response shape, not from swagger.json (which only defines request params). Verify field names with one keyed request at implementation (`?i=tt0137523&r=json`).

MVP implication: persist `voteAverage`, `voteCount`, plus nullable `imdbRating`, `imdbVotes`, `rottenTomatoes` (string like `"87%"`, nullable — not every title has one). Display TMDB rating always; IMDb/RT only when enrichment succeeded.

## 4. Licensing / attribution

- **TMDB**: free for **non-commercial** use with attribution. Required: TMDB logo + notice "This product uses the TMDB API but is not endorsed or certified by TMDB", placed in About/Credits, logo less prominent than app logo, use approved logos, link to https://www.themoviedb.org. Commercial use → contact sales@themoviedb.org. No ownership claim over images/data; DMCA compliance; no libellous/defamatory use. Must agree to terms before API key issuance. Sources: TMDB FAQ (cost, attribution, commercial, branding, legal notice) + Getting Started (agree to terms for key).
  - Note: direct `www.themoviedb.org/documentation/api/terms-of-use` fetch returned 403 in this environment; FAQ is the citable source above.
- **OMDb**: `All content licensed under CC BY-NC 4.0. This site is not endorsed by or affiliated with IMDb.com.` (footer + swagger `license`). Legal page (2015-03-12): site is **personal, non-commercial use only**; no commercial use, no copying/broadcasting/screen-scraping except as permitted, no derivative works, no index-building without written permission. Source: OMDb homepage footer, swagger.json `license`/`termsOfService`, OMDb legal.htm §§4–6,10.

MVP implication: both sources are non-commercial-only on free tiers — fine for this MVP, but a commercial launch needs TMDB commercial licence and must drop OMDb (or negotiate). Show TMDB attribution in footer/About from day one.

## 5. Cost / rate limits

| | TMDB | OMDb |
|---|---|---|
| Cost (MVP) | Free non-commercial (key after agreeing terms); commercial via sales | **FREE key: 1,000 requests/day**; higher quotas via Patreon/patron tiers (email-keyed). Poster API patron-only |
| Rate limit | Legacy 40 req/10 s disabled (2019); current upper bound "~40 requests per second range", subject to change; respect `429` | Daily quota is the binding constraint on free tier (1k/day); per-second limits not published on the pages surveyed |
| Auth | API key (register in account settings) / Bearer read-access token in `Authorization` header (per OpenAPI `securitySchemes`) | `?apikey=KEY` query param on every request |

Sources: TMDB FAQ (free/commercial), Getting Started (registration), Rate Limiting page (~40 rps + 429), OpenAPI security; OMDb apikey.aspx (FREE 1,000 daily limit, Patreon), OMDb swagger `APIKeyQueryParam`.

MVP implication: TMDB headroom is ample for server-cached MVP traffic. OMDb's 1k/day forces selective enrichment (top-N per emotion, cached) — another reason it must be fallback-only.

## 6. Caching fit in Convex

- Convex pattern: browser calls a query/mutation; server-side **actions** (`fetch`) call third-party APIs, then persist via `runQuery`/`runMutation` (internal query/mutation). Default runtime supports `fetch`; `"use node"` only if a Node-only package is needed. Actions time out after 10 min; there is also an **Action Cache** component for expensive/frequent actions. Source: Convex Actions docs (fetch in default runtime, ctx.runQuery/runMutation, limits, Action Cache component).
- Recommended shape:
  - `actions`: `discoverByEmotion` (TMDB discover/search), `getMovieDetails` (TMDB + `append_to_response`), `enrichRatings(imdbId)` (OMDb `?i=`).
  - `tables`: `movies` (tmdbId PK, imdbId, title, overview, genres, releaseDate, runtime, posterPath, backdropPath, voteAverage, voteCount, popularity, imdbRating?, imdbVotes?, rottenTomatoes?, lastSyncedAt), `emotionMaps` (emotion → with_genres/with_keywords/sort preset), `syncState` (per-query cache timestamps).
  - Policy: cache-first with TTL (e.g. catalogue 7–30 d, ratings 7 d); OMDb enrichment queued/scheduled (mutation schedules internal action per Convex best practice — don't call actions directly from client in hot paths), failures leave nullable rating fields empty rather than blocking render.
- Secrets: TMDB Bearer/key + OMDb key live in Convex environment / server-only actions, never in Svelte client bundle.

## 7. Schema decision (unblocked)

```ts
movies: {
  tmdbId: number, imdbId: string | null,
  title: string, overview: string,
  genres: string[], releaseDate: string | null, runtime: number | null,
  posterPath: string | null, backdropPath: string | null,
  popularity: number, voteAverage: number, voteCount: number,
  imdbRating: string | null, imdbVotes: string | null,
  rottenTomatoes: string | null, lastSyncedAt: number,
}
emotionMaps: { emotion: string, withGenres: string, withKeywords: string,
  sortBy: string, voteAverageGte: number, voteCountGte: number }
```

Join key TMDB→OMDb is `imdb_id` (details or `external_ids`).

## 8. Risks / open checks for build

1. OMDb `Ratings[]`/RT presence varies by title — treat as nullable; confirm exact keys with one authenticated call.
2. OMDb free 1k/day — enrich lazily (detail view or top-N), never fan-out per search page.
3. OMDb search suppresses adult content and is title-only — not a discovery engine (per changelog 2019-01-20).
4. Both free tiers are non-commercial — revisit before monetisation.
5. TMDB `~40 rps` + `429` handling + `/configuration` refresh for image sizes.

## Sources (primary, fetched 2026-10-16)

- https://developer.themoviedb.org/docs/getting-started
- https://developer.themoviedb.org/docs/faq
- https://developer.themoviedb.org/docs/rate-limiting
- https://developer.themoviedb.org/docs/image-basics
- https://developer.themoviedb.org/reference/discover-movie
- https://developer.themoviedb.org/reference/search-movie
- https://developer.themoviedb.org/reference/movie-details
- https://developer.themoviedb.org/reference/movie-external-ids
- https://developer.themoviedb.org/reference/movie-images
- https://www.omdbapi.com/ (usage, parameters, Poster API)
- https://www.omdbapi.com/apikey.aspx (FREE 1,000 daily limit, Patreon)
- https://www.omdbapi.com/legal.htm (non-commercial terms, 2015-03-12)
- http://www.omdbapi.com/swagger.json (endpoints, apikey security, CC BY-NC 4.0)
- https://docs.convex.dev/functions/actions (fetch actions, runQuery/runMutation, Action Cache)
