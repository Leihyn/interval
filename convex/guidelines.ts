import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { pickExcerpt, pickTitle } from "./citation";

/**
 * Firecrawl: verifies the clinical guideline each item cites.
 *
 * Every drafted item carries a source URL. Left alone that is an assertion, and
 * a stale or wrong link is worse than none because it looks checked. This
 * fetches the page, confirms it resolves, records the real title, and pulls the
 * sentence that states the threshold so a clinician can check the claim from
 * the board.
 *
 * Failure is recorded as failure. An item whose source cannot be fetched keeps
 * its URL and stays unverified rather than silently appearing confirmed.
 */

export const itemsNeedingVerification = query({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db.query("items").collect();
    return items
      .filter((i) => i.sourceUrl && !i.sourceVerifiedAt)
      .map((i) => ({ itemId: i._id, url: i.sourceUrl!, title: i.sourceTitle ?? "" }));
  },
});

export const recordVerification = mutation({
  args: {
    itemId: v.id("items"),
    title: v.string(),
    excerpt: v.string(),
  },
  handler: async (ctx, { itemId, title, excerpt }) => {
    await ctx.db.patch(itemId, {
      sourceTitle: title,
      sourceExcerpt: excerpt,
      sourceVerifiedAt: Date.now(),
    });
  },
});

/** Scrapes one guideline page. Returns null on any failure. */
export const scrape = action({
  args: { url: v.string() },
  handler: async (
    _ctx,
    { url },
  ): Promise<{ title: string | null; excerpt: string | null; status: number } | null> => {
    const key = process.env.FIRECRAWL_API_KEY;
    if (!key) return null;

    try {
      const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
      });

      if (!res.ok) {
        console.error(`[firecrawl] HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
        return { title: null, excerpt: null, status: res.status };
      }

      const body = await res.json();
      const markdown: unknown = body?.data?.markdown;
      if (typeof markdown !== "string") {
        console.error(`[firecrawl] no markdown in response: ${JSON.stringify(body).slice(0, 300)}`);
        return { title: null, excerpt: null, status: res.status };
      }

      return {
        title: pickTitle(body?.data?.metadata, ""),
        excerpt: pickExcerpt(markdown),
        status: res.status,
      };
    } catch (err) {
      console.error(`[firecrawl] threw: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  },
});

/** Verifies every item whose citation has not been checked yet. */
export const verifyAll = action({
  args: {},
  handler: async (ctx): Promise<{ verified: number; failed: number; skipped: number }> => {
    const pending = await ctx.runQuery(api.guidelines.itemsNeedingVerification, {});
    let verified = 0;
    let failed = 0;

    for (const { itemId, url, title } of pending) {
      const result = await ctx.runAction(api.guidelines.scrape, { url });
      if (!result || !result.excerpt) {
        failed++;
        continue;
      }
      await ctx.runMutation(api.guidelines.recordVerification, {
        itemId: itemId as Id<"items">,
        title: result.title || title,
        excerpt: result.excerpt,
      });
      verified++;
    }

    return { verified, failed, skipped: 0 };
  },
});
