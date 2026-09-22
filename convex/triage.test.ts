import { describe, it, expect } from "vitest";
import {
  triage,
  triageVital,
  triageMedication,
  triageExercise,
  scanRedFlags,
  maxLevel,
} from "./triage";

/**
 * These tests encode the safety argument. The failure direction that matters is
 * a MISS: a reply that should have escalated and did not. Every case below that
 * asserts AMBER or RED is guarding against a miss.
 */

describe("invariant 7: thresholds are per unit, nothing is converted", () => {
  it("treats 39 C as a fever", () => {
    expect(
      triageVital({ measure: "temperature", unit: "C", value: 39.0 }).level,
    ).toBe("RED");
  });

  it("does not let a Fahrenheit table swallow a reported 39 C", () => {
    // 39 read against the F thresholds would be GREEN. This is the exact miss
    // that invariant 7 exists to prevent.
    const asC = triageVital({ measure: "temperature", unit: "C", value: 39.0 });
    const asF = triageVital({ measure: "temperature", unit: "F", value: 39.0 });
    expect(asC.level).toBe("RED");
    expect(asF.level).toBe("GREEN"); // 39 F is genuinely not a fever
    expect(asC.level).not.toBe(asF.level);
  });

  it("escalates 102.2 F as a fever", () => {
    expect(
      triageVital({ measure: "temperature", unit: "F", value: 102.2 }).level,
    ).toBe("RED");
  });

  it("refuses to classify glucose in a unit it has no table for", () => {
    expect(
      triageVital({ measure: "glucose", unit: "mmHg", value: 5.5 }).level,
    ).toBe("AMBER");
  });

  it("reads 5.5 as normal in mmol/L but dangerous-low in mg/dL", () => {
    const target = { unit: "mmol/L" as const, low: 4, high: 10 };
    expect(triageVital({ measure: "glucose", unit: "mmol/L", value: 5.5 }, target).level).toBe("GREEN");
    expect(triageVital({ measure: "glucose", unit: "mg/dL", value: 5.5 }).level).toBe("RED");
  });
});

describe("invariant 3: unresolved never means fine", () => {
  it("escalates a missing unit to AMBER, never GREEN", () => {
    expect(triageVital({ measure: "temperature", unit: null, value: 37.0 }).level).toBe("AMBER");
  });

  it("escalates an incomplete blood pressure", () => {
    expect(
      triageVital({ measure: "bp", unit: "mmHg", systolic: 140, diastolic: null }).level,
    ).toBe("AMBER");
  });

  it("will not call glucose normal without a clinician-set target", () => {
    const r = triageVital({ measure: "glucose", unit: "mmol/L", value: 6.0 });
    expect(r.level).toBe("AMBER");
    expect(r.reasons.join(" ")).toMatch(/target/i);
  });

  it("escalates a reply that matches no open item", () => {
    expect(triage({ rawText: "ok thanks", itemType: null }).level).toBe("AMBER");
  });
});

describe("invariant 2: the raw-text scan cannot be swallowed by extraction", () => {
  it("escalates on red-flag wording even when the numbers are perfect", () => {
    const r = triage({
      rawText: "BP was 118/76 today but my calf pain is worse",
      itemType: "vital",
      vital: { measure: "bp", unit: "mmHg", systolic: 118, diastolic: 76 },
    });
    expect(r.level).toBe("RED");
    expect(r.keywordHits).toContain("calf pain");
  });

  it("escalates on red-flag wording when extraction produced nothing at all", () => {
    const r = triage({ rawText: "woke up with numbness in both legs", itemType: null });
    expect(r.level).toBe("RED");
  });

  it("takes the max of keyword scan and threshold check", () => {
    const r = triage({
      rawText: "chest pain after the walk",
      itemType: "exercise",
      exercise: { completed: true, pain: 1 },
      painCeiling: 5,
    });
    // Threshold path alone would be GREEN.
    expect(triageExercise({ completed: true, pain: 1 }, 5).level).toBe("GREEN");
    expect(r.level).toBe("RED");
  });
});

describe("blood pressure bands", () => {
  it("escalates a hypertensive crisis", () => {
    expect(triageVital({ measure: "bp", unit: "mmHg", systolic: 184, diastolic: 96 }).level).toBe("RED");
    expect(triageVital({ measure: "bp", unit: "mmHg", systolic: 150, diastolic: 122 }).level).toBe("RED");
  });

  it("escalates hypotension, not just hypertension", () => {
    expect(triageVital({ measure: "bp", unit: "mmHg", systolic: 84, diastolic: 55 }).level).toBe("RED");
  });

  it("flags the raised band as AMBER", () => {
    expect(triageVital({ measure: "bp", unit: "mmHg", systolic: 164, diastolic: 92 }).level).toBe("AMBER");
    expect(triageVital({ measure: "bp", unit: "mmHg", systolic: 140, diastolic: 104 }).level).toBe("AMBER");
  });

  it("passes a normal reading", () => {
    expect(triageVital({ measure: "bp", unit: "mmHg", systolic: 124, diastolic: 78 }).level).toBe("GREEN");
  });

  it("is exact at the boundaries", () => {
    expect(triageVital({ measure: "bp", unit: "mmHg", systolic: 180, diastolic: 80 }).level).toBe("RED");
    expect(triageVital({ measure: "bp", unit: "mmHg", systolic: 179, diastolic: 80 }).level).toBe("AMBER");
    expect(triageVital({ measure: "bp", unit: "mmHg", systolic: 90, diastolic: 60 }).level).toBe("GREEN");
    expect(triageVital({ measure: "bp", unit: "mmHg", systolic: 89, diastolic: 60 }).level).toBe("RED");
  });
});

describe("SpO2", () => {
  it("escalates below 92", () => {
    expect(triageVital({ measure: "spo2", unit: "%", value: 91 }).level).toBe("RED");
  });
  it("flags the 92 to 94 band", () => {
    expect(triageVital({ measure: "spo2", unit: "%", value: 92 }).level).toBe("AMBER");
    expect(triageVital({ measure: "spo2", unit: "%", value: 94 }).level).toBe("AMBER");
  });
  it("passes 95", () => {
    expect(triageVital({ measure: "spo2", unit: "%", value: 95 }).level).toBe("GREEN");
  });
});

describe("invariant 6: a medication question is routed, never answered", () => {
  it("escalates a question even when the dose was taken", () => {
    const r = triageMedication(
      { taken: true },
      "Took it this morning. Should I double up tomorrow since I missed Monday?",
    );
    expect(r.level).toBe("AMBER");
    expect(r.reasons.join(" ")).toMatch(/not answered/i);
  });
});

describe("medication", () => {
  it("escalates a missed dose of a critical drug immediately", () => {
    expect(triageMedication({ taken: false, consecutiveMissed: 1, critical: true }, "missed my insulin").level).toBe("AMBER");
  });
  it("escalates two consecutive missed doses", () => {
    expect(triageMedication({ taken: false, consecutiveMissed: 2 }, "missed again").level).toBe("AMBER");
  });
  it("passes a clean report", () => {
    expect(triageMedication({ taken: true }, "took both, all fine").level).toBe("GREEN");
  });
  it("escalates when it cannot tell whether the dose was taken", () => {
    expect(triageMedication({ taken: null }, "hmm").level).toBe("AMBER");
  });
});

describe("exercise", () => {
  it("escalates pain above the ceiling", () => {
    expect(triageExercise({ completed: true, pain: 8 }, 5).level).toBe("AMBER");
  });
  it("escalates pain with no ceiling set rather than assuming one", () => {
    expect(triageExercise({ completed: true, pain: 8 }).level).toBe("AMBER");
  });
  it("escalates three non-adherent days", () => {
    expect(triageExercise({ completed: false, consecutiveMissedDays: 3 }, 5).level).toBe("AMBER");
  });
  it("passes a session inside the limit", () => {
    expect(triageExercise({ completed: true, pain: 3 }, 5).level).toBe("GREEN");
  });
});

describe("keyword scan mechanics", () => {
  it("is case insensitive", () => {
    expect(scanRedFlags("CHEST PAIN since last night")).toContain("chest pain");
  });
  it("catches phrasing variants of breathlessness", () => {
    expect(scanRedFlags("felt short of breath").length).toBeGreaterThan(0);
    expect(scanRedFlags("difficulty breathing").length).toBeGreaterThan(0);
  });
  it("returns nothing for an ordinary reply", () => {
    expect(scanRedFlags("did all three sets, felt fine, bp 120/80")).toEqual([]);
  });
});

describe("maxLevel", () => {
  it("ranks RED above AMBER above GREEN", () => {
    expect(maxLevel("GREEN", "AMBER")).toBe("AMBER");
    expect(maxLevel("AMBER", "RED")).toBe("RED");
    expect(maxLevel("GREEN", "GREEN")).toBe("GREEN");
    expect(maxLevel("RED", "GREEN", "AMBER")).toBe("RED");
  });
});
