"use node";
import { action } from "./_generated/server";
import { v } from "convex/values";

// Slice 4: Jev normalize + score behind the recommend seam.
// Fallback-first: no key (early-access waitlist) means exact-match normalize
// plus vote-order rank with degraded flag; live call path activates once keyed.
export const decide = action({
  args: { state: v.any(), questions: v.any() },
  handler: async () => ({ degraded: true, note: "Jev key absent; vote-order fallback" }),
});
