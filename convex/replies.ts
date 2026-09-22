import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { triage, type VitalMeasure, type VitalUnit } from "./triage";
import { parseVital, parseMedication, parseExercise } from "./parse";
import { matchItem } from "./match";
import { mergeVital, mergeMedication, mergeExercise, type ExtractionSource } from "./merge";
import { AUTO_REPLIES } from "./gate";

/**
 * Tells the extraction layer what kind of item a reply is answering, so the
 * model can be given the item type and the issued unit without being given a
 * threshold. Read-only.
 */
export const replyContext = query({
  args: { email: v.string(), rawText: v.string() },
  handler: async (ctx, { email, rawText }) => {
    const patient = await ctx.db
      .query("patients")
      .withIndex("by_email", (q) => q.eq("email", email.toLowerCase().trim()))
      .unique();
    if (!patient) return null;

    const items = await ctx.db
      .query("items")
      .withIndex("by_patient", (q) => q.eq("patientId", patient._id))
      .collect();

    const item = matchItem(rawText, items);
    if (!item) return null;
    return { itemType: item.type, measure: item.measure ?? null, unit: item.unit ?? null };
  },
});

/**
 * The one ingress for every patient reply, whatever the channel.
 *
 * The AgentMail webhook calls it, and so does the board's paste box. That is
 * deliberate: the triage path being demonstrated is the triage path that runs
 * in production, and the email transport is an adapter rather than a dependency.
 *
 * `modelExtraction` is optional. When present it is merged OVER the
 * deterministic parse by convex/merge.ts, which only ever fills gaps. When
 * absent the deterministic parse stands alone and the pipeline is unchanged.
 */
export const ingestReply = mutation({
  args: {
    email: v.string(),
    rawText: v.string(),
    channel: v.union(v.literal("email"), v.literal("paste")),
    modelExtraction: v.optional(v.any()),
  },
  handler: async (ctx, { email, rawText, channel, modelExtraction }) => {
    const patient = await ctx.db
      .query("patients")
      .withIndex("by_email", (q) => q.eq("email", email.toLowerCase().trim()))
      .unique();
    if (!patient) throw new Error(`No patient with the address ${email}`);

    const items = await ctx.db
      .query("items")
      .withIndex("by_patient", (q) => q.eq("patientId", patient._id))
      .collect();

    const item = matchItem(rawText, items);
    const model = (modelExtraction ?? null) as Record<string, unknown> | null;

    // Parse deterministically first, then let the model fill gaps. Neither step
    // produces a level: that is decided afterwards, in code, against the
    // threshold tables.
    let vital, medication, exercise;
    let extractionSource: ExtractionSource = "parser";

    if (item?.type === "vital" && item.measure && item.unit) {
      const p = parseVital(rawText, item.measure as VitalMeasure, item.unit as VitalUnit);
      const m = mergeVital(p.reading, model, item.unit as VitalUnit, p.unitConflict);
      vital = m.reading;
      extractionSource = m.source;
    } else if (item?.type === "medication") {
      const m = mergeMedication(parseMedication(rawText, item.critical ?? false), model);
      medication = m.report;
      extractionSource = m.source;
    } else if (item?.type === "exercise") {
      const m = mergeExercise(parseExercise(rawText), model);
      exercise = m.report;
      extractionSource = m.source;
    }

    const result = triage({
      rawText,
      itemType: item?.type ?? null,
      vital,
      medication,
      exercise,
      painCeiling: patient.painCeiling,
      glucoseTarget: patient.glucoseTarget,
    });

    const checkinId = await ctx.db.insert("checkins", {
      patientId: patient._id,
      itemId: item?._id,
      rawText,
      receivedAt: Date.now(),
      level: result.level,
      reasons: result.reasons,
      keywordHits: result.keywordHits,
      extracted: vital ?? medication ?? exercise ?? null,
      extractionSource,
      channel,
      acknowledged: false,
    });

    if (item) await ctx.db.patch(item._id, { lastCheckinAt: Date.now() });

    return {
      checkinId,
      level: result.level,
      reasons: result.reasons,
      extractionSource,
      // Exactly one of the two fixed strings. Never generated.
      autoReply: result.level === "RED" ? AUTO_REPLIES.redFlag : AUTO_REPLIES.acknowledgement,
    };
  },
});

/**
 * Public entry point used by the board and the inbound webhook.
 *
 * Runs OpenAI extraction, then hands the typed fields to the mutation above.
 * If extraction fails for any reason the mutation still runs, on the
 * deterministic parse alone.
 */
export const submitReply = action({
  args: {
    email: v.string(),
    rawText: v.string(),
    channel: v.union(v.literal("email"), v.literal("paste")),
  },
  // Explicit return type: this action calls `api` from its own file, and
  // without an annotation the generated types resolve circularly to `any`,
  // which silently strips type safety from every consumer of the board query.
  handler: async (
    ctx,
    { email, rawText, channel },
  ): Promise<{
    checkinId: Id<"checkins">;
    level: "RED" | "AMBER" | "GREEN";
    reasons: string[];
    extractionSource: ExtractionSource;
    autoReply: string;
  }> => {
    let modelExtraction = null;

    const context = await ctx.runQuery(api.replies.replyContext, { email, rawText });
    if (context) {
      modelExtraction = await ctx.runAction(api.extract.extractReply, {
        rawText,
        itemType: context.itemType,
        measure: context.measure ?? undefined,
        issuedUnit: context.unit ?? undefined,
      });
    }

    return await ctx.runMutation(api.replies.ingestReply, {
      email,
      rawText,
      channel,
      modelExtraction,
    });
  },
});

/** The live board: every check-in, most urgent first, then most recent. */
export const board = query({
  args: {},
  handler: async (ctx) => {
    const checkins = await ctx.db.query("checkins").collect();
    const patients = await ctx.db.query("patients").collect();
    const items = await ctx.db.query("items").collect();

    const byPatient = new Map(patients.map((p) => [p._id, p]));
    const byItem = new Map(items.map((i) => [i._id, i]));
    const rank = { RED: 0, AMBER: 1, GREEN: 2 } as const;

    return checkins
      .map((c) => ({
        ...c,
        patientName: byPatient.get(c.patientId)?.name ?? "Unknown",
        itemTitle: c.itemId ? (byItem.get(c.itemId)?.title ?? null) : null,
      }))
      .sort((a, b) => rank[a.level] - rank[b.level] || b.receivedAt - a.receivedAt);
  },
});

export const acknowledge = mutation({
  args: { checkinId: v.id("checkins") },
  handler: async (ctx, { checkinId }) => await ctx.db.patch(checkinId, { acknowledged: true }),
});
