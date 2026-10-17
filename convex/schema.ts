import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
export default defineSchema({
  movies: defineTable({
    tmdbId: v.number(), imdbId: v.optional(v.string()), title: v.string(),
    overview: v.string(), genres: v.array(v.string()), releaseDate: v.optional(v.string()),
    year: v.number(), runtime: v.optional(v.number()), posterPath: v.optional(v.string()),
    backdropPath: v.optional(v.string()), popularity: v.number(), voteAverage: v.number(),
    voteCount: v.number(), imdbRating: v.optional(v.string()), imdbVotes: v.optional(v.string()),
    rottenTomatoes: v.optional(v.string()), trailerYouTubeKey: v.optional(v.string()),
    desiredTags: v.array(v.string()), lastSyncedAt: v.number(),
  }).index("by_tmdb", ["tmdbId"]),
  emotionMaps: defineTable({
    emotion: v.string(), withGenres: v.string(), withKeywords: v.string(),
    sortBy: v.string(), voteAverageGte: v.number(), voteCountGte: v.number(),
  }),
  quizOptions: defineTable({ label: v.string(), imageUrl: v.string(), weights: v.record(v.string(), v.number()) }),
  syncState: defineTable({ preset: v.string(), syncedAt: v.number() }),
});
