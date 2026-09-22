import { describe, it, expect } from "vitest";
import { assertSendable, NotApproved, AUTO_REPLIES } from "./gate";

describe("invariant 4: the approval gate", () => {
  it("refuses to send a draft item", () => {
    expect(() => assertSendable({ status: "draft", title: "Walk 10 minutes" })).toThrow(NotApproved);
  });
  it("allows an approved item", () => {
    expect(() => assertSendable({ status: "approved", title: "Walk 10 minutes" })).not.toThrow();
  });
  it("allows an already issued item", () => {
    expect(() => assertSendable({ status: "issued", title: "Walk 10 minutes" })).not.toThrow();
  });
});

describe("invariant 5: auto-replies contain no generated clinical content", () => {
  it("has exactly two auto-replies", () => {
    expect(Object.keys(AUTO_REPLIES)).toHaveLength(2);
  });
  it("the red-flag reply routes to a human and disclaims the channel", () => {
    expect(AUTO_REPLIES.redFlag).toMatch(/contact your clinical team/i);
    expect(AUTO_REPLIES.redFlag).toMatch(/not an emergency channel/i);
  });
  it("the acknowledgement gives no clinical guidance", () => {
    expect(AUTO_REPLIES.acknowledgement).not.toMatch(/should|dose|take|stop|increase|reduce/i);
  });
});
