import { chromium } from "playwright";

const URL = "https://fearless-swordfish-992.convex.site";
const OUT = `${process.env.HOME}/Desktop/interval-shots`;
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2500);

const shot = async (n, name) => {
  await page.screenshot({ path: `${OUT}/${n}-${name}.png` });
  console.log(`  ${n}-${name}.png`);
};
const centre = async (sel) => {
  await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: "center" }), sel);
  await page.waitForTimeout(700);
};

// 1 — the primary: header, proof bar, first red card
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(500);
await shot("1", "board");

// 2 — the backend refusal
await centre(".items");
await page.getByRole("button", { name: /try to send unapproved/i }).first().click();
await page.waitForTimeout(1400);
// The refusal renders above the list, so centre the error itself.
await centre(".error");
await shot("2", "approval-gate-refusal");

// 3 — a Firecrawl-verified citation
await centre(".citation");
await shot("3", "verified-citation");

// 4 — the threshold table, both temperature rows
await centre(".thresholds");
await shot("4", "threshold-table");

// 5 — a red check-in with the fixed reply that went back
await page.evaluate(() => {
  const d = document.querySelector(".card.red .sent");
  if (d) d.setAttribute("open", "true");
  document.querySelector(".card.red")?.scrollIntoView({ block: "center" });
});
await page.waitForTimeout(700);
await shot("5", "red-checkin-and-fixed-reply");

await browser.close();
