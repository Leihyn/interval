import { describe, it, expect } from "vitest";
import { pickExcerpt, pickTitle } from "./citation";

const PAGE = `
# Hypertension in adults

Skip to main content

Accept cookies

This guideline covers identifying and treating primary hypertension in people aged 18 and over, including people with type 2 diabetes.

If clinic blood pressure is 180/120 mmHg or higher, carry out same-day specialist assessment and consider starting antihypertensive drug treatment immediately.

Last updated
`;

describe("excerpt selection", () => {
  it("prefers the paragraph that states the threshold", () => {
    const out = pickExcerpt(PAGE);
    expect(out).toContain("180/120 mmHg");
  });

  it("strips navigation and cookie noise", () => {
    const out = pickExcerpt(PAGE)!;
    expect(out.toLowerCase()).not.toContain("accept cookies");
    expect(out.toLowerCase()).not.toContain("skip to main");
  });

  it("falls back to the first substantial paragraph when nothing looks like a threshold", () => {
    const plain = "Accept cookies\n\nThis page explains how the service works and who it is for, in general terms and without numbers.";
    expect(pickExcerpt(plain)).toContain("how the service works");
  });

  it("returns null when the page yields nothing usable", () => {
    expect(pickExcerpt("")).toBeNull();
    expect(pickExcerpt("Accept\n\nMenu\n\nSearch")).toBeNull();
  });

  it("truncates politely", () => {
    const long = "x".repeat(500) + " mmHg";
    const out = pickExcerpt(long, 100)!;
    expect(out.length).toBeLessThanOrEqual(101);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("title selection", () => {
  it("takes the crawled title when present", () => {
    expect(pickTitle({ title: "NICE NG136" }, "fallback")).toBe("NICE NG136");
  });
  it("falls back when the crawl gave no title", () => {
    expect(pickTitle({}, "fallback")).toBe("fallback");
    expect(pickTitle(null, "fallback")).toBe("fallback");
    expect(pickTitle({ title: "   " }, "fallback")).toBe("fallback");
  });
});

describe("markdown link handling", () => {
  it("keeps link text and drops the URL", () => {
    const md = "If clinic blood pressure is 180/120 mmHg or higher, see [update information](https://example.com/x) for more, and carry out same-day specialist assessment without delay.";
    const out = pickExcerpt(md)!;
    expect(out).toContain("update information");
    expect(out).not.toContain("https://");
    expect(out).not.toContain("](");
  });
});
