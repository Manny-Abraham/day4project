import { query } from "./_generated/server";
import { v } from "convex/values";
export const listByTag = query({
  args: { tag: v.string() },
  handler: async (ctx, args) => ctx.db.query("movies").collect().then((all) => all.filter((m) => m.desiredTags.includes(args.tag))),
});
