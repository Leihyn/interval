import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { AUTO_REPLIES } from "./gate";

/**
 * AgentMail: the patient-facing transport.
 *
 * Two things are sent and nothing else. The approved programme, after a
 * clinician has released it, and one of exactly two fixed auto-replies when a
 * check-in lands. No generated clinical content ever leaves the building
 * (invariant 5), so the bodies below are assembled from the clinician's own
 * item text and two constant strings.
 */

const INBOX = () => process.env.AGENTMAIL_INBOX_ID ?? "onatola-6644@agentmail.to";

type SendResult = { sent: boolean; status: number | null; detail: string | null };

async function post(path: string, body: unknown): Promise<SendResult> {
  const key = process.env.AGENTMAIL_API_KEY;
  if (!key) return { sent: false, status: null, detail: "no AGENTMAIL_API_KEY configured" };

  try {
    const res = await fetch(`https://api.agentmail.to/v0${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`[agentmail] HTTP ${res.status}: ${text.slice(0, 300)}`);
      return { sent: false, status: res.status, detail: text.slice(0, 300) };
    }
    return { sent: true, status: res.status, detail: text.slice(0, 200) };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[agentmail] threw: ${detail}`);
    return { sent: false, status: null, detail };
  }
}

/** Low-level send. Used by the two callers below and by the diagnostic. */
export const send = action({
  args: { to: v.string(), subject: v.string(), text: v.string() },
  handler: async (_ctx, { to, subject, text }): Promise<SendResult> =>
    await post(`/inboxes/${encodeURIComponent(INBOX())}/messages/send`, { to, subject, text }),
});

/**
 * Issues an item and emails the patient their programme.
 *
 * The approval gate runs first, inside the mutation. If it throws, nothing is
 * sent, which is the ordering invariant 4 requires: the gate is not a UI state,
 * it is the thing standing between a draft and a patient's inbox.
 */
export const issueAndSend = action({
  args: { itemId: v.id("items") },
  handler: async (ctx, { itemId }): Promise<SendResult & { issued: boolean }> => {
    const item = await ctx.runMutation(api.items.issue, { itemId });
    const patient = await ctx.runQuery(api.patients.get, {
      patientId: item.patientId as Id<"patients">,
    });
    if (!patient) return { issued: true, sent: false, status: null, detail: "patient not found" };

    const body = [
      `Hello,`,
      ``,
      `Your clinic has sent you a home item to follow.`,
      ``,
      `${item.title}`,
      `${item.detail}`,
      item.sourceTitle ? `\nBased on: ${item.sourceTitle}` : ``,
      ``,
      `When you have done it, just reply to this email in your own words. There is nothing`,
      `to install and no password. For example: "did two of three sets, knee sharp at rep`,
      `eight, stopped."`,
      ``,
      `This mailbox is not monitored continuously and is not an emergency channel. If you`,
      `feel unwell, contact your clinical team or your local emergency number.`,
    ].join("\n");

    const result = await ctx.runAction(api.email.send, {
      to: patient.email,
      subject: `Your home item: ${item.title}`,
      text: body,
    });
    return { issued: true, ...result };
  },
});

/**
 * Sends one of the two fixed auto-replies. Never generated, never clinical.
 * Which one is chosen by the triage level, in code.
 */
export const sendAutoReply = action({
  args: { to: v.string(), level: v.union(v.literal("RED"), v.literal("AMBER"), v.literal("GREEN")) },
  handler: async (ctx, { to, level }): Promise<SendResult> => {
    const text = level === "RED" ? AUTO_REPLIES.redFlag : AUTO_REPLIES.acknowledgement;
    return await ctx.runAction(api.email.send, {
      to,
      subject: "We have your update",
      text,
    });
  },
});

/** Confirms the key and inbox resolve, without returning the key. */
export const diagnose = action({
  args: {},
  handler: async (_ctx): Promise<Record<string, unknown>> => {
    const key = process.env.AGENTMAIL_API_KEY;
    if (!key) return { keyPresent: false, inbox: INBOX() };
    try {
      const res = await fetch("https://api.agentmail.to/v0/inboxes", {
        headers: { Authorization: `Bearer ${key}` },
      });
      const text = await res.text();
      return {
        keyPresent: true,
        keyLength: key.length,
        inbox: INBOX(),
        status: res.status,
        ok: res.ok,
        body: text.slice(0, 400),
      };
    } catch (err) {
      return { keyPresent: true, inbox: INBOX(), threw: err instanceof Error ? err.message : String(err) };
    }
  },
});

/**
 * Registers the inbound webhook so a real reply reaches the board.
 *
 * Done over the API because AgentMail has no console UI for this. Idempotent
 * in effect: listing first means re-running does not pile up duplicates.
 */
export const registerWebhook = action({
  args: { url: v.string() },
  handler: async (_ctx, { url }): Promise<Record<string, unknown>> => {
    const key = process.env.AGENTMAIL_API_KEY;
    if (!key) return { ok: false, detail: "no AGENTMAIL_API_KEY configured" };
    const auth = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

    const existing = await fetch("https://api.agentmail.to/v0/webhooks", { headers: auth });
    const existingBody = await existing.text();
    if (existingBody.includes(url)) {
      return { ok: true, alreadyRegistered: true, detail: existingBody.slice(0, 300) };
    }

    const res = await fetch("https://api.agentmail.to/v0/webhooks", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        url,
        event_types: ["message.received"],
        inbox_ids: [INBOX()],
        client_id: "interval-inbound",
      }),
    });
    const text = await res.text();
    if (!res.ok) console.error(`[agentmail] webhook create HTTP ${res.status}: ${text.slice(0, 300)}`);
    return { ok: res.ok, status: res.status, detail: text.slice(0, 400) };
  },
});

/** Lists what is actually sitting in the inbox. Diagnostic only. */
export const listMessages = action({
  args: {},
  handler: async (): Promise<Record<string, unknown>> => {
    const key = process.env.AGENTMAIL_API_KEY;
    if (!key) return { ok: false };
    const res = await fetch(
      `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(INBOX())}/messages?limit=5`,
      { headers: { Authorization: `Bearer ${key}` } },
    );
    const text = await res.text();
    return { status: res.status, body: text.slice(0, 700) };
  },
});
