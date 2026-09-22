/**
 * The threshold table, as data, for display.
 *
 * convex/triage.ts is the source of truth: it holds the logic and this holds
 * the numbers shown to a clinician. A table on screen that has drifted from
 * the engine behind it is worse than no table, so thresholds.test.ts asserts
 * every boundary here against what triageVital actually returns.
 */

export type ThresholdRow = {
  vital: string;
  measure: "bp" | "glucose" | "temperature" | "spo2";
  unit: "mmHg" | "mg/dL" | "mmol/L" | "C" | "F" | "%";
  red: string;
  amber: string;
  /** Concrete values the test drives through the engine to prove this row. */
  probes: { red?: number; amber?: number; green?: number; redPair?: [number, number]; amberPair?: [number, number]; greenPair?: [number, number] };
};

export const THRESHOLDS: ThresholdRow[] = [
  {
    vital: "Blood pressure", measure: "bp", unit: "mmHg",
    red: "sys ≥ 180, dia ≥ 120, or sys < 90", amber: "sys ≥ 160 or dia ≥ 100",
    probes: { redPair: [180, 80], amberPair: [160, 90], greenPair: [124, 78] },
  },
  {
    vital: "Blood glucose", measure: "glucose", unit: "mg/dL",
    red: "< 70 or > 300", amber: "outside clinician target",
    probes: { red: 69 },
  },
  {
    vital: "Blood glucose", measure: "glucose", unit: "mmol/L",
    red: "< 3.9 or > 16.7", amber: "outside clinician target",
    probes: { red: 3.8 },
  },
  {
    vital: "Temperature", measure: "temperature", unit: "C",
    red: "≥ 39.0", amber: "≥ 38.0",
    probes: { red: 39.0, amber: 38.0, green: 37.2 },
  },
  {
    vital: "Temperature", measure: "temperature", unit: "F",
    red: "≥ 102.2", amber: "≥ 100.4",
    probes: { red: 102.2, amber: 100.4, green: 98.6 },
  },
  {
    vital: "SpO2", measure: "spo2", unit: "%",
    red: "< 92", amber: "92 to 94",
    probes: { red: 91, amber: 92, green: 95 },
  },
];
