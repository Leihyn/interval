import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { triage, type VitalMeasure, type VitalUnit } from "./triage";
import { matchItem } from "./match";
import { parseVital, parseMedication, parseExercise } from "./parse";
import { AUTO_REPLIES } from "./gate";

/**
 * The one ingress for every patient reply, whatever the channel.
 *
 * The AgentMail webhook calls it, and so does the paste box on the board. That
 * is deliberate: the triage path being demonstrated is the same code in both
 * cases, and the email transport is an adapter rather than a dependency.
 */
export const ingestReply = mutation({
  args: {
    email: v.string(),
    rawText: v.string(),
    channel: v.union(v.literal("email"), v.literal("paste")),
  },
  handler: async (ctx, { email, rawText, channel }) => {
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

    // Parse, then triage. The parser produces typed fields; it never produces a
    // level. The level is decided in triage.ts against the threshold tables.
    let parsed: ReturnType<typeof parseVital>["reading"] | undefined;
    let medication, exercise;

    if (item?.type === "vital" && item.measure && item.unit) {
      parsed = parseVital(rawText, item.measure as VitalMeasure, item.unit as VitalUnit).reading;
    } else if (item?.type === "medication") {
      medication = parseMedication(rawText, item.critical ?? false);
    } else if (item?.type === "exercise") {
      exercise = parseExercise(rawText);
    }

    const result = triage({
      rawText,
      itemType: item?.type ?? null,
      vital: parsed,
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
      extracted: parsed ?? medication ?? exercise ?? null,
      channel,
      acknowledged: false,
    });

    if (item) await ctx.db.patch(item._id, { lastCheckinAt: Date.now() });

    return {
      checkinId,
      level: result.level,
      reasons: result.reasons,
      // Exactly one of the two fixed strings. Never generated.
      autoReply: result.level === "RED" ? AUTO_REPLIES.redFlag : AUTO_REPLIES.acknowledgement,
    };
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
