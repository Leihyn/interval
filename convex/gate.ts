/**
 * The approval gate, as a pure function so it can be tested directly.
 *
 * Invariant 4: nothing reaches a patient without clinician approval, and that
 * is enforced here rather than by hiding a button.
 */

import { ConvexError } from "convex/values";

export type Sendable = { status: "draft" | "approved" | "issued"; title: string };

/**
 * ConvexError, not Error. Convex strips a plain Error's message in production
 * and the client sees "Server Error", which makes a deliberate refusal look
 * like a crash. The whole point of this gate is that the clinician is told why.
 */
export class NotApproved extends ConvexError<string> {
  constructor(title: string, status: string) {
    super(`"${title}" is ${status} and has not been approved by a clinician. It cannot be sent.`);
    this.name = "NotApproved";
  }
}

export function assertSendable(item: Sendable): void {
  if (item.status === "draft") throw new NotApproved(item.title, item.status);
}

/** The only two auto-replies that exist. Neither contains generated clinical
 *  content, and the red-flag string is fixed text written once (invariant 5). */
export const AUTO_REPLIES = {
  acknowledgement:
    "Thanks, we have received your update and it is on your clinic's board.",
  redFlag:
    "Thanks, we have received your update. Based on what you have described, " +
    "please contact your clinical team now. If this is an emergency, call your " +
    "local emergency number or go to your nearest emergency department. " +
    "This mailbox is not monitored continuously and is not an emergency channel.",
} as const;
