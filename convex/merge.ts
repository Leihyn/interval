/**
 * Merges the model's extraction over the deterministic parse.
 *
 * The parser is the FLOOR, never the ceiling. A model value is taken only where
 * the parser produced nothing, so a model failure or hallucination can never
 * erase a value the parser read correctly out of the text.
 *
 * The model is never allowed to supply a unit. It reports only what the patient
 * literally wrote (`unitStated`), which is then subjected to the same
 * contradiction check as the parser's: a stated unit that disagrees with the
 * unit the clinician issued resolves to unresolved, never to a conversion.
 */

import type { VitalReading, MedicationReport, ExerciseReport, VitalUnit } from "./triage";

export type ExtractionSource = "parser" | "model" | "merged";

/**
 * Normalises the model's payload shape.
 *
 * The prompt asks for the fields at the top level, but a prompt is a request
 * rather than a contract: the model also returns them nested under the item
 * type, e.g. {"vital": {"systolic": 186}}. Reading only one shape means a shape
 * change silently disables extraction and everything still looks healthy,
 * because the deterministic parser quietly covers for it. Accept both.
 */
export function unwrapExtraction(
  parsed: unknown,
  itemType: "exercise" | "medication" | "vital",
): Record<string, unknown> | null {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const obj = parsed as Record<string, unknown>;

  const nested = obj[itemType];
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  return obj;
}

/** Takes b only where a is null/undefined. Returns whether b contributed. */
function fill<T>(a: T | null | undefined, b: T | null | undefined): [T | null, boolean] {
  if (a !== null && a !== undefined) return [a, false];
  if (b !== null && b !== undefined) return [b, true];
  return [null, false];
}

function source(usedParser: boolean, usedModel: boolean): ExtractionSource {
  if (usedParser && usedModel) return "merged";
  return usedModel ? "model" : "parser";
}

export function mergeVital(
  parsed: VitalReading,
  model: Record<string, unknown> | null,
  issuedUnit: VitalUnit,
  parserSawConflict: boolean,
): { reading: VitalReading; source: ExtractionSource } {
  if (!model) return { reading: parsed, source: "parser" };

  const [value, mv] = fill(parsed.value, model.value as number | null);
  const [systolic, ms] = fill(parsed.systolic, model.systolic as number | null);
  const [diastolic, md] = fill(parsed.diastolic, model.diastolic as number | null);

  // The model may only REPORT a unit the patient wrote. It may never choose one.
  const stated = typeof model.unitStated === "string" ? model.unitStated : null;
  const modelSawConflict = stated !== null && stated !== issuedUnit;
  const conflict = parserSawConflict || modelSawConflict;

  const usedParser =
    parsed.value != null || parsed.systolic != null || parsed.diastolic != null;

  return {
    reading: {
      measure: parsed.measure,
      unit: conflict ? null : issuedUnit,
      value,
      systolic,
      diastolic,
    },
    source: source(usedParser, mv || ms || md || modelSawConflict),
  };
}

export function mergeMedication(
  parsed: MedicationReport,
  model: Record<string, unknown> | null,
): { report: MedicationReport; source: ExtractionSource } {
  if (!model) return { report: parsed, source: "parser" };

  const [taken, mt] = fill(parsed.taken, model.taken as boolean | null);
  const [missed, mm] = fill(
    parsed.consecutiveMissed || null,
    model.consecutiveMissed as number | null,
  );
  const modelSymptom = model.newSymptom === true;

  return {
    report: {
      taken,
      // A missed dose always counts as at least one.
      consecutiveMissed: taken === false ? (missed ?? 1) : 0,
      newSymptom: parsed.newSymptom || modelSymptom,
      critical: parsed.critical,
    },
    source: source(parsed.taken != null, mt || mm || (modelSymptom && !parsed.newSymptom)),
  };
}

export function mergeExercise(
  parsed: ExerciseReport,
  model: Record<string, unknown> | null,
): { report: ExerciseReport; source: ExtractionSource } {
  if (!model) return { report: parsed, source: "parser" };

  const [completed, mc] = fill(parsed.completed, model.completed as boolean | null);
  const [pain, mp] = fill(parsed.pain, model.pain as number | null);
  const modelPersist = model.painPersistingOver24h === true;

  return {
    report: {
      completed,
      pain,
      consecutiveMissedDays: parsed.consecutiveMissedDays,
      painPersistingOver24h: parsed.painPersistingOver24h || modelPersist,
    },
    source: source(
      parsed.completed != null || parsed.pain != null,
      mc || mp || (modelPersist && !parsed.painPersistingOver24h),
    ),
  };
}
