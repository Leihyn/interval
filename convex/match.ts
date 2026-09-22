/**
 * Chooses which open item a reply is answering.
 *
 * Kept free of Convex types so it can be tested directly. A reply that cannot
 * be matched returns null, which the triage layer treats as AMBER with the raw
 * text shown, rather than guessing an item and triaging against the wrong
 * thresholds.
 */

import { parseBloodPressure } from "./parse";
import type { VitalMeasure } from "./triage";

export type MatchableItem = {
  type: "exercise" | "medication" | "vital";
  status: "draft" | "approved" | "issued";
  measure?: VitalMeasure | null;
};

const MEASURE_WORDS: Record<VitalMeasure, RegExp> = {
  // A bare slash is deliberately NOT a blood-pressure signal: "3/3 sets" is an
  // adherence ratio. Either the measure is named, or a plausible reading is
  // actually present in the text.
  bp: /\b(bp|blood pressure|systolic|diastolic)\b/i,
  glucose: /\b(glucose|sugar|bm|bg)\b/i,
  temperature: /\b(temp|temperature|fever)\b/i,
  spo2: /\b(spo2|sats?|saturation|oxygen|o2)\b/i,
};

const MEDICATION_WORDS = /\b(took|taken|taking|dose|doses|tablet|tablets|pill|pills|mg|missed|skipped|forgot)\b/i;
const EXERCISE_WORDS = /\b(sets?|reps?|exercise|exercises|walk|walked|pain|session|physio|stretch)\b/i;

export function matchItem<T extends MatchableItem>(rawText: string, items: T[]): T | null {
  const issued = items.filter((i) => i.status === "issued");
  if (issued.length === 0) return null;

  // A named measure is the strongest signal.
  for (const item of issued) {
    if (item.type === "vital" && item.measure && MEASURE_WORDS[item.measure].test(rawText)) {
      return item;
    }
  }

  // A plausible blood-pressure reading counts even when "BP" is not written.
  if (parseBloodPressure(rawText)) {
    const bp = issued.find((i) => i.type === "vital" && i.measure === "bp");
    if (bp) return bp;
  }

  const medHit = MEDICATION_WORDS.test(rawText);
  const exHit = EXERCISE_WORDS.test(rawText);

  if (exHit && !medHit) {
    const ex = issued.find((i) => i.type === "exercise");
    if (ex) return ex;
  }
  if (medHit && !exHit) {
    const med = issued.find((i) => i.type === "medication");
    if (med) return med;
  }
  // Ambiguous wording is not resolved by preference order. It falls through to
  // the single-open-item case, and otherwise to null.
  return issued.length === 1 ? issued[0] : null;
}
