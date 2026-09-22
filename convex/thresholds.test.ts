import { describe, it, expect } from "vitest";
import { THRESHOLDS } from "./thresholds";
import { triageVital } from "./triage";

/**
 * The table shown to a clinician must be the table the engine enforces. Each
 * probe below is driven through triageVital and asserted, so the two cannot
 * drift apart silently.
 */
describe("the displayed threshold table matches the engine", () => {
  for (const row of THRESHOLDS) {
    const { vital, measure, unit, probes } = row;

    if (probes.redPair) {
      it(`${vital} ${unit}: ${probes.redPair.join("/")} is RED`, () => {
        expect(triageVital({ measure, unit, systolic: probes.redPair![0], diastolic: probes.redPair![1] }).level).toBe("RED");
      });
    }
    if (probes.amberPair) {
      it(`${vital} ${unit}: ${probes.amberPair.join("/")} is AMBER`, () => {
        expect(triageVital({ measure, unit, systolic: probes.amberPair![0], diastolic: probes.amberPair![1] }).level).toBe("AMBER");
      });
    }
    if (probes.greenPair) {
      it(`${vital} ${unit}: ${probes.greenPair.join("/")} is GREEN`, () => {
        expect(triageVital({ measure, unit, systolic: probes.greenPair![0], diastolic: probes.greenPair![1] }).level).toBe("GREEN");
      });
    }
    if (probes.red !== undefined) {
      it(`${vital} ${unit}: ${probes.red} is RED`, () => {
        expect(triageVital({ measure, unit, value: probes.red }).level).toBe("RED");
      });
    }
    if (probes.amber !== undefined) {
      it(`${vital} ${unit}: ${probes.amber} is AMBER`, () => {
        expect(triageVital({ measure, unit, value: probes.amber }).level).toBe("AMBER");
      });
    }
    if (probes.green !== undefined) {
      it(`${vital} ${unit}: ${probes.green} is GREEN`, () => {
        expect(triageVital({ measure, unit, value: probes.green }).level).toBe("GREEN");
      });
    }
  }

  it("carries two rows for temperature, one per unit, and they disagree on 39", () => {
    const c = THRESHOLDS.find((r) => r.measure === "temperature" && r.unit === "C")!;
    const f = THRESHOLDS.find((r) => r.measure === "temperature" && r.unit === "F")!;
    expect(c).toBeTruthy();
    expect(f).toBeTruthy();
    expect(triageVital({ measure: "temperature", unit: "C", value: 39 }).level).toBe("RED");
    expect(triageVital({ measure: "temperature", unit: "F", value: 39 }).level).toBe("GREEN");
  });
});
