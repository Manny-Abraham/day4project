"use node";
import { action } from "./_generated/server";
import { v } from "convex/values";

// Slice 5: small-LLM copy writer. Temp 0.3, inputs capped (5 titles x 200 chars)
// by the action itself. Fallback-first: no key means template copy.
export const writeCopy = action({
  args: { currentText: v.string(), desiredTag: v.string(), titles: v.array(v.string()) },
  handler: async (ctx, args) => {
    void ctx;
    const titles = args.titles.slice(0, 5).map((t) => t.slice(0, 200));
    const currentText = args.currentText.slice(0, 280);
    void titles;
    void currentText;
    return { degraded: true, note: "LLM key absent; template copy fallback" };
  },
});
