import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const level = v.union(
  v.literal("RED"),
  v.literal("AMBER"),
  v.literal("GREEN"),
);

export const itemType = v.union(
  v.literal("exercise"),
  v.literal("medication"),
  v.literal("vital"),
);

/** Unit is part of the vital's identity. Thresholds are defined per unit and
 *  nothing is converted at read time. See invariant 7. */
export const vitalUnit = v.union(
  v.literal("mmHg"),
  v.literal("mg/dL"),
  v.literal("mmol/L"),
  v.literal("C"),
  v.literal("F"),
  v.literal("%"),
);

export default defineSchema({
  patients: defineTable({
    name: v.string(),
    email: v.string(),
    clerkingNote: v.optional(v.string()),
    // Clinician-set bands. Absent means the AMBER band for that measure is
    // unavailable, which resolves to AMBER rather than GREEN.
    painCeiling: v.optional(v.number()),
    glucoseTarget: v.optional(
      v.object({ unit: vitalUnit, low: v.number(), high: v.number() }),
    ),
  }).index("by_email", ["email"]),

  items: defineTable({
    patientId: v.id("patients"),
    type: itemType,
    title: v.string(),
    detail: v.string(),
    cadenceHours: v.number(),
    status: v.union(
      v.literal("draft"),
      v.literal("approved"),
      v.literal("issued"),
    ),
    // Every drafted item cites the guideline it came from.
    sourceUrl: v.optional(v.string()),
    sourceTitle: v.optional(v.string()),
    // Filled by the Firecrawl crawl. A citation nobody checked is a claim, not
    // a source: these record that the page was actually fetched, when, and the
    // sentence the threshold came from.
    sourceExcerpt: v.optional(v.string()),
    sourceVerifiedAt: v.optional(v.number()),
    // Type-specific payload.
    measure: v.optional(
      v.union(
        v.literal("bp"),
        v.literal("glucose"),
        v.literal("temperature"),
        v.literal("spo2"),
      ),
    ),
    unit: v.optional(vitalUnit),
    critical: v.optional(v.boolean()),
    approvedAt: v.optional(v.number()),
    issuedAt: v.optional(v.number()),
    lastCheckinAt: v.optional(v.number()),
  })
    .index("by_patient", ["patientId"])
    .index("by_status", ["status"]),

  checkins: defineTable({
    patientId: v.id("patients"),
    itemId: v.optional(v.id("items")),
    // The unparsed reply body. Stored before anything is extracted from it.
    rawText: v.string(),
    receivedAt: v.number(),
    level,
    reasons: v.array(v.string()),
    keywordHits: v.array(v.string()),
    extracted: v.optional(v.any()),
    // Which layer produced the typed fields. Shown on the board so a clinician
    // can see whether the model was involved in reading this reply.
    extractionSource: v.optional(
      v.union(v.literal("parser"), v.literal("model"), v.literal("merged")),
    ),
    channel: v.union(v.literal("email"), v.literal("paste")),
    acknowledged: v.boolean(),
  })
    .index("by_patient", ["patientId"])
    .index("by_level", ["level"]),
});
