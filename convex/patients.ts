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

/**
 * Repoints the demo patient at a real address, so an external reply to the
 * clinic inbox matches a patient and reaches the board. Does not touch the
 * board, unlike reseeding.
 */
export const setEmail = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const patient = (await ctx.db.query("patients").collect())[0];
    if (!patient) throw new Error("No patient to update");
    await ctx.db.patch(patient._id, { email: email.toLowerCase().trim() });
    return { patientId: patient._id, email: email.toLowerCase().trim() };
  },
});
