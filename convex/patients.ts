import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { vitalUnit } from "./schema";

export const list = query({
  args: {},
  handler: async (ctx) => await ctx.db.query("patients").collect(),
});

export const get = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, { patientId }) => await ctx.db.get(patientId),
});

export const create = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    clerkingNote: v.optional(v.string()),
    painCeiling: v.optional(v.number()),
    glucoseTarget: v.optional(
      v.object({ unit: vitalUnit, low: v.number(), high: v.number() }),
    ),
  },
  handler: async (ctx, args) => await ctx.db.insert("patients", args),
});
