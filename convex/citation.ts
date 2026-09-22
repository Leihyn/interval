/**
 * Picks the part of a crawled guideline page worth showing next to an item.
 *
 * A citation that is just a URL asks the clinician to take it on trust. Pulling
 * the sentence the threshold actually came from means the claim can be checked
 * without leaving the board.
 */

/** Wording that tends to surround a numeric threshold in clinical guidance. */
const THRESHOLD_HINTS = [
  "mmhg", "mg/dl", "mmol", "spo2", "saturation",
  "systolic", "diastolic", "blood pressure",
  "threshold", "target", "range", "above", "below",
  "or higher", "or more", "at least",
];

const NOISE = /^(cookies?|accept|skip to|sign in|log in|menu|search|share|print|last updated|\W*$)/i;

function paragraphs(markdown: string): string[] {
  return markdown
    .split(/\n{2,}/)
    // Keep the link text, drop the URL: a quote reads badly with a markdown
    // target hanging off the end of it.
    .map((p) => p.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1"))
    .map((p) => p.replace(/[#*_>`|]/g, " ").replace(/\s+/g, " ").trim())
    .filter((p) => p.length >= 60 && !NOISE.test(p));
}

/**
 * Prefers a paragraph that looks like it states a threshold, and falls back to
 * the first substantial paragraph. Returns null when the page yielded nothing
 * usable, which is treated as a failed verification rather than an empty quote.
 */
export function pickExcerpt(markdown: string, maxChars = 280): string | null {
  const paras = paragraphs(markdown);
  if (paras.length === 0) return null;

  const scored = paras
    .map((p) => {
      const lower = p.toLowerCase();
      const hits = THRESHOLD_HINTS.filter((h) => lower.includes(h)).length;
      const hasNumber = /\d/.test(p) ? 1 : 0;
      return { p, score: hits * 2 + hasNumber };
    })
    .sort((a, b) => b.score - a.score);

  const chosen = scored[0].score > 0 ? scored[0].p : paras[0];
  return chosen.length > maxChars ? chosen.slice(0, maxChars).trimEnd() + "…" : chosen;
}

/** Firecrawl returns the real page title in metadata. Fall back to the stored one. */
export function pickTitle(metadata: unknown, fallback: string): string {
  if (typeof metadata === "object" && metadata !== null) {
    const t = (metadata as Record<string, unknown>).title;
    if (typeof t === "string" && t.trim().length > 0) return t.trim();
  }
  return fallback;
}
