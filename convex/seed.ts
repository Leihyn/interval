import { mutation } from "./_generated/server";

/**
 * The demo patient. Synthetic record, as stated on the site.
 *
 * One patient carrying all three item types, which is the ordinary case after a
 * discharge rather than a contrived one: hypertensive, on two drugs, home with a
 * programme and a daily blood pressure reading.
 */
export const demo = mutation({
  args: {},
  handler: async (ctx) => {
    // Idempotent: re-seeding clears the previous demo rather than duplicating it.
    for (const table of ["checkins", "items", "patients"] as const) {
      for (const row of await ctx.db.query(table).collect()) await ctx.db.delete(row._id);
    }

    const patientId = await ctx.db.insert("patients", {
      name: "A. Demo (synthetic record)",
      email: "demo.patient@example.com",
      clerkingNote:
        "62F, discharged day 4 post right total knee replacement. Background hypertension, " +
        "type 2 diabetes. Home with ramipril 5mg od and metformin 500mg bd. For daily BP " +
        "monitoring and a graded home exercise programme. Pain ceiling agreed at 5/10.",
      painCeiling: 5,
      glucoseTarget: { unit: "mmol/L", low: 4, high: 10 },
    });

    const now = Date.now();
    const guideline = {
      sourceTitle: "NICE NG136: Hypertension in adults, diagnosis and management",
      sourceUrl: "https://www.nice.org.uk/guidance/ng136",
    };

    const items = [
      {
        type: "vital" as const,
        title: "Blood pressure, once daily",
        detail: "Seated, same arm, after five minutes rest. Report as systolic over diastolic.",
        cadenceHours: 24,
        measure: "bp" as const,
        unit: "mmHg" as const,
        ...guideline,
      },
      {
        type: "medication" as const,
        title: "Ramipril 5mg, once daily",
        detail: "One tablet each morning. Report taken or missed, and any new symptom.",
        cadenceHours: 24,
        critical: false,
        sourceTitle: "NICE NG136: Hypertension in adults, diagnosis and management",
        sourceUrl: "https://www.nice.org.uk/guidance/ng136",
      },
      {
        type: "exercise" as const,
        title: "Knee flexion programme, three sets daily",
        detail: "Three sets of ten, within the agreed pain ceiling of 5/10. Report sets done and pain.",
        cadenceHours: 24,
        sourceTitle: "NICE NG157: Joint replacement, primary care rehabilitation",
        sourceUrl: "https://www.nice.org.uk/guidance/ng157",
      },
    ];

    const ids = [];
    for (const item of items) {
      ids.push(
        await ctx.db.insert("items", {
          patientId,
          status: "issued",
          approvedAt: now - 86_400_000 * 3,
          issuedAt: now - 86_400_000 * 3,
          ...item,
        }),
      );
    }

    // One draft item left unapproved, so the gate is visible on the board.
    await ctx.db.insert("items", {
      patientId,
      type: "vital",
      title: "Blood glucose, twice daily",
      detail: "Before breakfast and before the evening meal.",
      cadenceHours: 12,
      status: "draft",
      measure: "glucose",
      unit: "mmol/L",
      sourceTitle: "NICE NG28: Type 2 diabetes in adults, management",
      sourceUrl: "https://www.nice.org.uk/guidance/ng28",
    });

    return { patientId, itemIds: ids };
  },
});
