import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertSendable } from "./gate";
import { itemType, vitalUnit } from "./schema";

export const listForPatient = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, { patientId }) =>
    await ctx.db.query("items").withIndex("by_patient", (q) => q.eq("patientId", patientId)).collect(),
});

export const draft = mutation({
  args: {
    patientId: v.id("patients"),
    type: itemType,
    title: v.string(),
    detail: v.string(),
    cadenceHours: v.number(),
    sourceUrl: v.optional(v.string()),
    sourceTitle: v.optional(v.string()),
    measure: v.optional(
      v.union(v.literal("bp"), v.literal("glucose"), v.literal("temperature"), v.literal("spo2")),
    ),
    unit: v.optional(vitalUnit),
    critical: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // A vital without an explicit unit is not a valid item (invariant 7).
    if (args.type === "vital" && !args.unit) {
      throw new Error("A vital item must declare its unit. Thresholds are defined per unit.");
    }
    return await ctx.db.insert("items", { ...args, status: "draft" });
  },
});

export const approve = mutation({
  args: { itemId: v.id("items") },
  handler: async (ctx, { itemId }) => {
    const item = await ctx.db.get(itemId);
    if (!item) throw new Error("Item not found");
    await ctx.db.patch(itemId, { status: "approved", approvedAt: Date.now() });
  },
});

/**
 * Issuing is the only path by which an item reaches a patient. The gate is
 * checked here, in the mutation, so that a caller bypassing the interface still
 * cannot send an unapproved item.
 */
export const issue = mutation({
  args: { itemId: v.id("items") },
  handler: async (ctx, { itemId }) => {
    const item = await ctx.db.get(itemId);
    if (!item) throw new Error("Item not found");
    assertSendable(item);
    await ctx.db.patch(itemId, { status: "issued", issuedAt: Date.now() });
    return item;
  },
});

export const remove = mutation({
  args: { itemId: v.id("items") },
  handler: async (ctx, { itemId }) => await ctx.db.delete(itemId),
});
