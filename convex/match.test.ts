import { describe, it, expect } from "vitest";
import { matchItem, type MatchableItem } from "./match";

const bp: MatchableItem & { id: string } = { id: "bp", type: "vital", status: "issued", measure: "bp" };
const med: MatchableItem & { id: string } = { id: "med", type: "medication", status: "issued" };
const ex: MatchableItem & { id: string } = { id: "ex", type: "exercise", status: "issued" };
const draftGlucose: MatchableItem & { id: string } = { id: "glu", type: "vital", status: "draft", measure: "glucose" };

const all = [bp, med, ex, draftGlucose];

describe("reply routing", () => {
  it("does not mistake an adherence ratio for a blood pressure", () => {
    // The bug this test exists for: "3/3" routed an exercise reply to the BP item.
    expect(matchItem("Did 3/3 sets this morning, pain about 3. Felt ok.", all)?.id).toBe("ex");
  });

  it("routes a named blood pressure to the BP item", () => {
    expect(matchItem("BP 186/104 today", all)?.id).toBe("bp");
  });

  it("routes a bare plausible reading to the BP item", () => {
    expect(matchItem("140/90 this morning", all)?.id).toBe("bp");
  });

  it("routes a medication reply to the medication item", () => {
    expect(matchItem("took the tablet this morning", all)?.id).toBe("med");
  });

  it("never routes to a draft item", () => {
    expect(matchItem("glucose was 5.6", [draftGlucose])).toBeNull();
  });

  it("returns null when wording is ambiguous across items", () => {
    // "missed" is medication wording, "session" is exercise wording.
    expect(matchItem("missed the session", all)).toBeNull();
  });

  it("matches the sole open item when there is only one", () => {
    expect(matchItem("all fine thanks", [bp])?.id).toBe("bp");
  });

  it("returns null when nothing is issued", () => {
    expect(matchItem("anything", [draftGlucose])).toBeNull();
  });
});
