/**
 * Deterministic triage. No model output reaches this file as a severity.
 *
 * The model extracts typed fields; this code decides the level. The thresholds
 * below are placeholders sourced from the guideline body the clinic selects and
 * MUST be confirmed and cited by a clinician before any clinical use.
 */

export type Level = "RED" | "AMBER" | "GREEN";

const RANK: Record<Level, number> = { GREEN: 0, AMBER: 1, RED: 2 };

export function maxLevel(...levels: Level[]): Level {
  return levels.reduce((a, b) => (RANK[b] > RANK[a] ? b : a), "GREEN" as Level);
}

/**
 * Red-flag phrases, scanned against the RAW reply body.
 *
 * This runs independently of extraction so that an extraction failure cannot
 * swallow a red flag (invariant 2). The catalogue is deliberately scanned as a
 * union rather than per item type: a patient replying about their exercise may
 * describe a drug reaction, and we would rather over-escalate than route by a
 * guess about which item the text belongs to.
 */
export const RED_FLAGS: { phrase: string; source: "exercise" | "medication" }[] = [
  // Exercise / spinal and cardiovascular emergencies
  { phrase: "numbness", source: "exercise" },
  { phrase: "numb", source: "exercise" },
  { phrase: "saddle", source: "exercise" },
  { phrase: "bladder", source: "exercise" },
  { phrase: "bowel", source: "exercise" },
  { phrase: "incontinen", source: "exercise" },
  { phrase: "night pain", source: "exercise" },
  { phrase: "pain at night", source: "exercise" },
  { phrase: "weight loss", source: "exercise" },
  { phrase: "weakness", source: "exercise" },
  { phrase: "calf pain", source: "exercise" },
  { phrase: "calf swelling", source: "exercise" },
  { phrase: "swollen calf", source: "exercise" },
  { phrase: "chest pain", source: "exercise" },
  { phrase: "breathless", source: "exercise" },
  { phrase: "short of breath", source: "exercise" },
  // Medication / serious adverse reaction
  { phrase: "swelling", source: "medication" },
  { phrase: "swollen", source: "medication" },
  { phrase: "difficulty breathing", source: "medication" },
  { phrase: "trouble breathing", source: "medication" },
  { phrase: "can't breathe", source: "medication" },
  { phrase: "cant breathe", source: "medication" },
  { phrase: "fainting", source: "medication" },
  { phrase: "fainted", source: "medication" },
  { phrase: "passed out", source: "medication" },
  { phrase: "black stool", source: "medication" },
  { phrase: "yellow eyes", source: "medication" },
  { phrase: "jaundice", source: "medication" },
  { phrase: "rash", source: "medication" },
];

/** Returns every red-flag phrase present in the raw body. */
export function scanRedFlags(rawText: string): string[] {
  const haystack = rawText.toLowerCase();
  const hits = new Set<string>();
  for (const { phrase } of RED_FLAGS) {
    if (haystack.includes(phrase)) hits.add(phrase);
  }
  return [...hits];
}

/** A question about medication is routed to a human, never answered (invariant 6). */
const MED_QUESTION = /\?|\bshould i\b|\bcan i\b|\bis it ok\b|\bwhat if\b|\bdo i need\b/i;

export function looksLikeQuestion(rawText: string): boolean {
  return MED_QUESTION.test(rawText);
}

// ---------------------------------------------------------------------------
// Vitals
// ---------------------------------------------------------------------------

export type VitalMeasure = "bp" | "glucose" | "temperature" | "spo2";
export type VitalUnit = "mmHg" | "mg/dL" | "mmol/L" | "C" | "F" | "%";

export type VitalReading = {
  measure: VitalMeasure;
  unit: VitalUnit | null;
  systolic?: number | null;
  diastolic?: number | null;
  value?: number | null;
};

export type GlucoseTarget = { unit: VitalUnit; low: number; high: number };

export type TriageResult = { level: Level; reasons: string[] };

/**
 * Glucose and temperature are two rows each, one per unit, never one row plus a
 * conversion. A threshold table written in Fahrenheit silently ignores a
 * reported fever of 39, and a miss is the failure direction this cannot have.
 */
export function triageVital(
  reading: VitalReading,
  target?: GlucoseTarget,
): TriageResult {
  const reasons: string[] = [];

  // Invariant 3: unresolved never means fine.
  if (reading.unit === null || reading.unit === undefined) {
    return {
      level: "AMBER",
      reasons: ["Unit could not be resolved from the reply; raw text shown"],
    };
  }

  switch (reading.measure) {
    case "bp": {
      const { systolic: sys, diastolic: dia } = reading;
      if (reading.unit !== "mmHg") {
        return { level: "AMBER", reasons: [`Unexpected unit ${reading.unit} for blood pressure`] };
      }
      if (sys == null || dia == null) {
        return { level: "AMBER", reasons: ["Blood pressure incomplete in the reply"] };
      }
      if (sys >= 180 || dia >= 120) reasons.push(`Hypertensive crisis range (${sys}/${dia} mmHg)`);
      if (sys < 90) reasons.push(`Hypotensive (systolic ${sys} mmHg)`);
      if (reasons.length) return { level: "RED", reasons };
      if (sys >= 160 || dia >= 100) {
        return { level: "AMBER", reasons: [`Raised blood pressure (${sys}/${dia} mmHg)`] };
      }
      return { level: "GREEN", reasons: [`Blood pressure ${sys}/${dia} mmHg`] };
    }

    case "glucose": {
      const value = reading.value;
      if (value == null) return { level: "AMBER", reasons: ["Glucose value missing"] };
      if (reading.unit === "mg/dL") {
        if (value < 70) return { level: "RED", reasons: [`Hypoglycaemia (${value} mg/dL)`] };
        if (value > 300) return { level: "RED", reasons: [`Marked hyperglycaemia (${value} mg/dL)`] };
      } else if (reading.unit === "mmol/L") {
        if (value < 3.9) return { level: "RED", reasons: [`Hypoglycaemia (${value} mmol/L)`] };
        if (value > 16.7) return { level: "RED", reasons: [`Marked hyperglycaemia (${value} mmol/L)`] };
      } else {
        return { level: "AMBER", reasons: [`Unexpected unit ${reading.unit} for glucose`] };
      }
      // The AMBER band is the clinician-set target, and is not assumed.
      if (!target || target.unit !== reading.unit) {
        return {
          level: "AMBER",
          reasons: [`No clinician-set target in ${reading.unit}; not classified as normal`],
        };
      }
      if (value < target.low || value > target.high) {
        return {
          level: "AMBER",
          reasons: [`Outside target ${target.low}-${target.high} ${target.unit} (${value})`],
        };
      }
      return { level: "GREEN", reasons: [`Glucose ${value} ${reading.unit}`] };
    }

    case "temperature": {
      const value = reading.value;
      if (value == null) return { level: "AMBER", reasons: ["Temperature value missing"] };
      if (reading.unit === "C") {
        if (value >= 39.0) return { level: "RED", reasons: [`Fever ${value} C`] };
        if (value >= 38.0) return { level: "AMBER", reasons: [`Raised temperature ${value} C`] };
        return { level: "GREEN", reasons: [`Temperature ${value} C`] };
      }
      if (reading.unit === "F") {
        if (value >= 102.2) return { level: "RED", reasons: [`Fever ${value} F`] };
        if (value >= 100.4) return { level: "AMBER", reasons: [`Raised temperature ${value} F`] };
        return { level: "GREEN", reasons: [`Temperature ${value} F`] };
      }
      return { level: "AMBER", reasons: [`Unexpected unit ${reading.unit} for temperature`] };
    }

    case "spo2": {
      const value = reading.value;
      if (value == null) return { level: "AMBER", reasons: ["SpO2 value missing"] };
      if (reading.unit !== "%") {
        return { level: "AMBER", reasons: [`Unexpected unit ${reading.unit} for SpO2`] };
      }
      if (value < 92) return { level: "RED", reasons: [`Hypoxaemia (SpO2 ${value}%)`] };
      if (value <= 94) return { level: "AMBER", reasons: [`Borderline SpO2 ${value}%`] };
      return { level: "GREEN", reasons: [`SpO2 ${value}%`] };
    }
  }
}

// ---------------------------------------------------------------------------
// Medication and exercise
// ---------------------------------------------------------------------------

export type MedicationReport = {
  taken: boolean | null;
  consecutiveMissed?: number;
  newSymptom?: boolean;
  critical?: boolean;
};

export function triageMedication(report: MedicationReport, rawText: string): TriageResult {
  const reasons: string[] = [];

  if (looksLikeQuestion(rawText)) {
    reasons.push("Question about medication, routed to a clinician and not answered");
  }
  if (report.taken === null || report.taken === undefined) {
    reasons.push("Could not resolve whether the dose was taken");
  }
  if (report.taken === false) {
    if (report.critical) reasons.push("Missed dose of a drug flagged critical");
    if ((report.consecutiveMissed ?? 1) >= 2) {
      reasons.push(`${report.consecutiveMissed} consecutive missed doses`);
    }
    if (!report.critical && (report.consecutiveMissed ?? 1) < 2) {
      reasons.push("Single missed dose");
    }
  }
  if (report.newSymptom) reasons.push("New symptom reported alongside a drug");

  if (reasons.length === 0) return { level: "GREEN", reasons: ["Taken as prescribed"] };
  // Everything above is a clinician-review-today signal, not an emergency. RED
  // for medication comes only from the raw-text red-flag scan.
  return { level: "AMBER", reasons };
}

export type ExerciseReport = {
  completed: boolean | null;
  pain?: number | null;
  consecutiveMissedDays?: number;
  painPersistingOver24h?: boolean;
};

export function triageExercise(report: ExerciseReport, painCeiling?: number): TriageResult {
  const reasons: string[] = [];

  if (report.completed === null || report.completed === undefined) {
    reasons.push("Could not resolve whether the session was completed");
  }
  if (report.pain != null) {
    if (painCeiling === undefined) {
      reasons.push(`Pain ${report.pain} reported with no clinician-set ceiling`);
    } else if (report.pain > painCeiling) {
      reasons.push(`Pain ${report.pain} above ceiling of ${painCeiling}`);
    }
  }
  if ((report.consecutiveMissedDays ?? 0) >= 3) {
    reasons.push(`${report.consecutiveMissedDays} consecutive non-adherent days`);
  }
  if (report.painPersistingOver24h) {
    reasons.push("Pain persisting more than 24 hours after the session");
  }

  if (reasons.length === 0) return { level: "GREEN", reasons: ["Completed within the pain limit"] };
  return { level: "AMBER", reasons };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export type TriageInput = {
  rawText: string;
  itemType: "exercise" | "medication" | "vital" | null;
  vital?: VitalReading;
  medication?: MedicationReport;
  exercise?: ExerciseReport;
  painCeiling?: number;
  glucoseTarget?: GlucoseTarget;
};

/**
 * Final level is the max of the raw-text keyword scan and the threshold check.
 * The keyword scan runs first and unconditionally.
 */
export function triage(input: TriageInput): { level: Level; reasons: string[]; keywordHits: string[] } {
  const keywordHits = scanRedFlags(input.rawText);
  const reasons: string[] = [];
  let level: Level = "GREEN";

  if (keywordHits.length > 0) {
    level = "RED";
    reasons.push(`Red-flag wording in the reply: ${keywordHits.join(", ")}`);
  }

  let structured: TriageResult | null = null;
  if (input.itemType === "vital" && input.vital) {
    structured = triageVital(input.vital, input.glucoseTarget);
  } else if (input.itemType === "medication" && input.medication) {
    structured = triageMedication(input.medication, input.rawText);
  } else if (input.itemType === "exercise" && input.exercise) {
    structured = triageExercise(input.exercise, input.painCeiling);
  } else {
    // Nothing could be matched to an open item. That is not a normal reply.
    structured = {
      level: "AMBER",
      reasons: ["Reply could not be matched to an open item; raw text shown"],
    };
  }

  level = maxLevel(level, structured.level);
  reasons.push(...structured.reasons);

  return { level, reasons, keywordHits };
}
