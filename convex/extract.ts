import { action } from "./_generated/server";
import { v } from "convex/values";
import { unwrapExtraction } from "./merge";

/**
 * OpenAI extraction: free text to typed fields.
 *
 * INVARIANT 1 — the model extracts, code triages. The prompt below contains no
 * threshold, no severity level, and no notion of urgency. The model is asked
 * only to read values out of prose. Every escalation decision is made
 * afterwards by convex/triage.ts against the threshold tables.
 *
 * INVARIANT 7 — the model is never asked to infer or convert a unit. It is told
 * which unit the clinician issued the item in, and reports `unitStated` only
 * when the patient explicitly wrote one, so a contradiction can be detected and
 * resolved to unresolved rather than converted.
 *
 * This layer sits ABOVE the deterministic parser, never replaces it. If the
 * call fails, is slow, or returns something unusable, the caller keeps the
 * parser's result and the pipeline is unaffected.
 */

const SYSTEM = `You read a patient's plain-language reply to a clinician-issued home care item and pull out the values they reported.

You are an extraction tool ONLY. You do not assess urgency, severity, risk, or whether anything is normal or abnormal. You do not give advice. You never mention thresholds. Report only what the patient actually wrote.

Return strict JSON. Use null for anything the patient did not state. Never guess a number that is not in the text.

Return the fields at the TOP LEVEL of the JSON object. Do not nest them under a key.

Fields, by item type:

exercise: {"completed": true|false|null, "pain": number 0-10 or null, "painPersistingOver24h": true|false|null}
  - "did 2 of 3 sets" means completed=false. "did them all" means completed=true.

medication: {"taken": true|false|null, "consecutiveMissed": number or null, "newSymptom": true|false|null}
  - newSymptom is true only if they describe a NEW physical symptom alongside the drug.
  - If they both took one dose and missed another, taken=null.

vital: {"value": number or null, "systolic": number or null, "diastolic": number or null, "unitStated": string or null}
  - For blood pressure fill systolic and diastolic, leave value null.
  - For everything else fill value, leave systolic and diastolic null.
  - unitStated: ONLY the unit the patient literally wrote (e.g. "C", "F", "mmol/L", "mg/dL", "%"). If they wrote a bare number with no unit, unitStated is null. Never infer it.`;

export const extractReply = action({
  args: {
    rawText: v.string(),
    itemType: v.union(v.literal("exercise"), v.literal("medication"), v.literal("vital")),
    measure: v.optional(v.string()),
    issuedUnit: v.optional(v.string()),
  },
  handler: async (_ctx, { rawText, itemType, measure, issuedUnit }) => {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return null; // No key configured: caller keeps the deterministic parse.

    const context = [
      `Item type: ${itemType}`,
      measure ? `Measure: ${measure}` : null,
      issuedUnit ? `The clinician issued this item in ${issuedUnit}.` : null,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: `${context}\n\nPatient reply:\n"""${rawText}"""` },
          ],
        }),
      });

      if (!res.ok) {
        // Never logs the key. Status and a truncated body only.
        const detail = (await res.text()).slice(0, 300);
        console.error(`[extract] OpenAI HTTP ${res.status}: ${detail}`);
        return null;
      }
      const body = await res.json();
      const content = body?.choices?.[0]?.message?.content;
      if (typeof content !== "string") {
        console.error(`[extract] unexpected response shape: ${JSON.stringify(body).slice(0, 300)}`);
        return null;
      }
      return unwrapExtraction(JSON.parse(content), itemType);
    } catch (err) {
      // Any failure at all falls through to the deterministic parser.
      console.error(`[extract] threw: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  },
});
