import { describe, it, expect } from "vitest";
import { mergeVital, mergeMedication, mergeExercise, unwrapExtraction } from "./merge";
import { triage } from "./triage";

describe("the parser is the floor, the model never overwrites it", () => {
  it("keeps the parser's blood pressure when the model disagrees", () => {
    const parsed = { measure: "bp" as const, unit: "mmHg" as const, systolic: 186, diastolic: 104 };
    const { reading } = mergeVital(parsed, { systolic: 120, diastolic: 80 }, "mmHg", false);
    expect(reading.systolic).toBe(186);
    expect(reading.diastolic).toBe(104);
  });

  it("takes a model value only where the parser found nothing", () => {
    const parsed = { measure: "temperature" as const, unit: "C" as const, value: null };
    const { reading, source } = mergeVital(parsed, { value: 38.4, unitStated: null }, "C", false);
    expect(reading.value).toBe(38.4);
    expect(source).toBe("model");
  });

  it("falls back to the parser entirely when the model returns nothing", () => {
    const parsed = { measure: "temperature" as const, unit: "C" as const, value: 38.4 };
    const { reading, source } = mergeVital(parsed, null, "C", false);
    expect(reading.value).toBe(38.4);
    expect(source).toBe("parser");
  });
});

describe("the model may report a unit but never choose one", () => {
  it("resolves to unresolved when the model reports a contradicting unit", () => {
    const parsed = { measure: "temperature" as const, unit: "C" as const, value: 101 };
    const { reading } = mergeVital(parsed, { value: 101, unitStated: "F" }, "C", false);
    expect(reading.unit).toBeNull();
    // and unresolved must escalate, never pass as normal
    expect(triage({ rawText: "temp 101 F", itemType: "vital", vital: reading }).level).toBe("AMBER");
  });

  it("keeps the issued unit when the model reports agreement", () => {
    const parsed = { measure: "temperature" as const, unit: "C" as const, value: 38.4 };
    const { reading } = mergeVital(parsed, { value: 38.4, unitStated: "C" }, "C", false);
    expect(reading.unit).toBe("C");
  });

  it("honours a conflict the parser already found even if the model is silent", () => {
    const parsed = { measure: "temperature" as const, unit: null, value: 101 };
    const { reading } = mergeVital(parsed, { value: 101, unitStated: null }, "C", true);
    expect(reading.unit).toBeNull();
  });
});

describe("medication and exercise merging", () => {
  it("lets the model resolve a dose the parser could not", () => {
    const { report, source } = mergeMedication(
      { taken: null, consecutiveMissed: 0, newSymptom: false, critical: true },
      { taken: false, consecutiveMissed: 2 },
    );
    expect(report.taken).toBe(false);
    expect(report.consecutiveMissed).toBe(2);
    expect(source).toBe("model");
  });

  it("never lets the model clear a symptom the parser saw", () => {
    const { report } = mergeMedication(
      { taken: true, consecutiveMissed: 0, newSymptom: true, critical: false },
      { taken: true, newSymptom: false },
    );
    expect(report.newSymptom).toBe(true);
  });

  it("lets the model read a pain score out of prose the regex missed", () => {
    const { report, source } = mergeExercise(
      { completed: true, pain: null },
      { completed: true, pain: 8 },
    );
    expect(report.pain).toBe(8);
    expect(source).toBe("merged");
  });
});

describe("model payload shape is normalised, not assumed", () => {
  it("reads fields nested under the item type", () => {
    const out = unwrapExtraction({ vital: { systolic: 186, diastolic: 104 } }, "vital");
    expect(out).toEqual({ systolic: 186, diastolic: 104 });
  });

  it("reads fields at the top level", () => {
    const out = unwrapExtraction({ systolic: 186, diastolic: 104 }, "vital");
    expect(out).toEqual({ systolic: 186, diastolic: 104 });
  });

  it("does not unwrap a key belonging to a different item type", () => {
    const out = unwrapExtraction({ taken: true }, "medication");
    expect(out).toEqual({ taken: true });
  });

  it("rejects a non-object payload", () => {
    expect(unwrapExtraction(null, "vital")).toBeNull();
    expect(unwrapExtraction("nope", "vital")).toBeNull();
    expect(unwrapExtraction([1, 2], "vital")).toBeNull();
  });

  it("survives the nested shape end to end", () => {
    const parsed = { measure: "bp" as const, unit: "mmHg" as const, systolic: null, diastolic: null };
    const model = unwrapExtraction({ vital: { systolic: 186, diastolic: 104, unitStated: null } }, "vital");
    const { reading, source } = mergeVital(parsed, model, "mmHg", false);
    expect(reading.systolic).toBe(186);
    expect(source).toBe("model");
  });
});
