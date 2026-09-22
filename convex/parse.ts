/**
 * Deterministic reply parsing.
 *
 * This is the fallback the build plan names for unreliable extraction: a
 * structured reply line such as "done 2/3, pain 6, BP 140/90". It is also the
 * floor under the model — when an OpenAI key is present the model's typed output
 * is merged over this, and when it is absent the loop still runs end to end.
 *
 * The unit is NEVER taken from the patient's text alone. It comes from the item
 * the clinician issued. If the patient states a unit that disagrees with the
 * item, that is a conflict and resolves to unresolved, not to a conversion.
 * See invariant 7.
 */

import type { VitalMeasure, VitalUnit, VitalReading, MedicationReport, ExerciseReport } from "./triage";

export type ParsedReply = {
  vital?: VitalReading;
  medication?: MedicationReport;
  exercise?: ExerciseReport;
  /** True when the patient wrote a unit that contradicts the issued item. */
  unitConflict?: boolean;
};

const NUM = String.raw`(\d+(?:\.\d+)?)`;

/** Blood pressure: "140/90", "BP 140 / 90", "bp: 140over90". */
export function parseBloodPressure(text: string): { systolic: number; diastolic: number } | null {
  // Scan every pair in the line, not just the first. "done 2/3, pain 6, BP
  // 140/90" leads with an adherence ratio, and stopping at the first match
  // would discard the reading that follows it.
  const pairs = text.matchAll(new RegExp(`${NUM}\\s*(?:/|over)\\s*${NUM}`, "gi"));
  for (const m of pairs) {
    const systolic = Number(m[1]);
    const diastolic = Number(m[2]);
    // A plausibility floor. "2/3" in "done 2/3" is not a blood pressure.
    if (systolic < 50 || systolic > 300 || diastolic < 20 || diastolic > 200) continue;
    if (diastolic >= systolic) continue;
    return { systolic, diastolic };
  }
  return null;
}

/** Pulls a stated unit out of the reply, if the patient wrote one. */
function statedUnit(text: string, measure: VitalMeasure): VitalUnit | null {
  const t = text.toLowerCase();
  if (measure === "temperature") {
    if (/\b(\d+(?:\.\d+)?)\s*°?\s*c\b/.test(t) || /celsius|centigrade/.test(t)) return "C";
    if (/\b(\d+(?:\.\d+)?)\s*°?\s*f\b/.test(t) || /fahrenheit/.test(t)) return "F";
  }
  if (measure === "glucose") {
    if (/mmol/.test(t)) return "mmol/L";
    if (/mg\s*\/?\s*dl/.test(t)) return "mg/dL";
  }
  if (measure === "spo2" && /%/.test(t)) return "%";
  if (measure === "bp" && /mmhg/.test(t)) return "mmHg";
  return null;
}

/** Number attached to a measure keyword, e.g. "temp 38.2", "glucose was 5.6". */
function labelledNumber(text: string, labels: string[]): number | null {
  for (const label of labels) {
    const m = text.match(new RegExp(`${label}\\s*(?:was|is|:|=|of)?\\s*${NUM}`, "i"));
    if (m) return Number(m[1]);
  }
  return null;
}

export function parseVital(
  text: string,
  measure: VitalMeasure,
  itemUnit: VitalUnit,
): { reading: VitalReading; unitConflict: boolean } {
  const said = statedUnit(text, measure);
  const conflict = said !== null && said !== itemUnit;
  // On conflict the unit is unresolved. We do not convert and we do not guess.
  const unit: VitalUnit | null = conflict ? null : itemUnit;

  if (measure === "bp") {
    const bp = parseBloodPressure(text);
    return {
      reading: {
        measure,
        unit,
        systolic: bp?.systolic ?? null,
        diastolic: bp?.diastolic ?? null,
      },
      unitConflict: conflict,
    };
  }

  const labels: Record<Exclude<VitalMeasure, "bp">, string[]> = {
    temperature: ["temperature", "temp", "fever"],
    glucose: ["glucose", "sugar", "bm", "bg"],
    spo2: ["spo2", "sats", "saturation", "oxygen", "o2"],
  };

  let value = labelledNumber(text, labels[measure as Exclude<VitalMeasure, "bp">]);
  if (value === null) {
    // A bare number in a reply to a single-measure item.
    const bare = text.match(new RegExp(`(?:^|[^\\d./])${NUM}(?![\\d./])`));
    value = bare ? Number(bare[1]) : null;
  }

  return { reading: { measure, unit, value }, unitConflict: conflict };
}

const TAKEN = /\b(took|taken|taking|done|yes|did)\b/i;
const MISSED = /\b(missed|miss|skipped|skip|forgot|didn'?t|did not|no)\b/i;
const NEW_SYMPTOM = /\b(dizzy|dizziness|nausea|nauseous|sick|headache|tired|itch|cramp|bruis|bleed|cough)\w*/i;

export function parseMedication(text: string, critical: boolean): MedicationReport {
  const missed = MISSED.test(text);
  const taken = TAKEN.test(text);
  // Ambiguity resolves to unknown, which the triage layer escalates.
  let resolved: boolean | null = null;
  if (taken && !missed) resolved = true;
  else if (missed && !taken) resolved = false;

  const consecutive = labelledNumber(text, ["missed", "skipped"]);
  return {
    taken: resolved,
    consecutiveMissed: resolved === false ? (consecutive ?? 1) : 0,
    newSymptom: NEW_SYMPTOM.test(text),
    critical,
  };
}

const DONE_RATIO = /\b(\d+)\s*(?:\/|of|out of)\s*(\d+)\b/i;

export function parseExercise(text: string): ExerciseReport {
  const pain = labelledNumber(text, ["pain", "sore", "soreness"]);
  const ratio = text.match(DONE_RATIO);

  let completed: boolean | null = null;
  if (ratio) {
    completed = Number(ratio[1]) >= Number(ratio[2]);
  } else if (TAKEN.test(text) && !MISSED.test(text)) {
    completed = true;
  } else if (MISSED.test(text) && !TAKEN.test(text)) {
    completed = false;
  }

  return {
    completed,
    pain,
    painPersistingOver24h: /still (sore|hurt|painful)|next day|24 ?h|day after/i.test(text),
  };
}
