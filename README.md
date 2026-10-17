# day4project — emotion-based movie recommender

Svelte (Vite) + Tailwind + Convex. Glossary in `GLOSSARY.md`.

## Run locally (no backend)

```sh
npm install
npm test
npm run build
npm run dev
```

Without `VITE_CONVEX_URL` the UI runs the same rule logic locally
against the bundled `convex/seed.json` (offline demo mode).

## Connect Convex (one human step)

`npx convex dev` needs an interactive GitHub login, so it cannot be
done by an agent. Run once:

```sh
npx convex dev
```

This logs in, creates the project, writes `.env.local` with
`CONVEX_DEPLOYMENT`, generates `convex/_generated/`, and syncs the
functions in `convex/`. Then:

```sh
cp .env.example .env.local   # then set VITE_CONVEX_URL from convex output
npm run dev                  # UI now calls the deployed recommend action
```

Seed the tables from `convex/seed.json`:

```sh
npx convex import --table movies <(jq '.movies' convex/seed.json)
```

Server keys (`TMDB_API_KEY`, `OMDB_API_KEY`, `TYPESAFE_API_KEY`,
`LLM_API_KEY`) go in the Convex dashboard environment variables —
never in the client bundle.
