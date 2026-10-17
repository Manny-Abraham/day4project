"use node";
import { action } from "./_generated/server";
import { v } from "convex/values";

// Slice 2: lazy OMDb enrichment for top candidates only.
// Null-safe by design: missing key or failed fetch leaves nullable fields empty.
export const enrichRatings = action({
  args: { imdbId: v.string() },
  handler: async (ctx, args) => {
    const key = process.env.OMDB_API_KEY;
    if (!key) return { imdbId: args.imdbId, imdbRating: null, imdbVotes: null, rottenTomatoes: null };
    const url = `https://www.omdbapi.com/?apikey=${key}&i=${encodeURIComponent(args.imdbId)}&r=json`;
    const res = await fetch(url);
    if (!res.ok) return { imdbId: args.imdbId, imdbRating: null, imdbVotes: null, rottenTomatoes: null };
    const data = await res.json();
    const rt = Array.isArray(data.Ratings) ? data.Ratings.find((r) => r.Source === "Rotten Tomatoes") : null;
    return {
      imdbId: args.imdbId,
      imdbRating: data.imdbRating ?? null,
      imdbVotes: data.imdbVotes ?? null,
      rottenTomatoes: rt?.Value ?? null,
    };
  },
});
