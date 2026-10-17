"use node";
import { action } from "./_generated/server";
import { v } from "convex/values";

// Slice 1: rule-based recommend (vote order + template copy).
// Slices 4-5 replace ranking/copy with Jev + LLM behind this same seam.
export const recommend = action({
  args: { desiredTag: v.string(), currentText: v.optional(v.string()), minRating: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const movies = await ctx.runQuery("movies:listByTag", { tag: args.desiredTag });
    const pool = movies
      .filter((m) => m.voteAverage >= (args.minRating ?? 7.0) && m.voteCount >= 50)
      .sort((a, b) => b.voteAverage - a.voteAverage || b.voteCount - a.voteCount)
      .slice(0, 5);
    const cur = (args.currentText ?? "").replace(/\s+/g, " ").trim().slice(0, 280) || "any mood";
    return {
      results: pool.map((m) => ({ ...m, whyMatch: `Gentle shift ${cur} to ${args.desiredTag}, no heavy lift.`.slice(0, 120) })),
      empty: pool.length === 0,
      degraded: true,
    };
  },
});
