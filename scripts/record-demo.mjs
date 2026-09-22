import { chromium } from "playwright";

const URL = process.env.DEMO_URL ?? "https://fearless-swordfish-992.convex.site";
const W = 1280, H = 720;
const log = (m) => console.log(`  ${m}`);

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: W, height: H },
  recordVideo: { dir: "recordings/", size: { width: W, height: H } },
});
const page = await context.newPage();

async function caption(text, ms = 4200) {
  await page.evaluate((t) => {
    let d = document.getElementById("__cap");
    if (!d) {
      d = document.createElement("div");
      d.id = "__cap";
      d.style.cssText =
        "position:fixed;left:0;right:0;bottom:0;z-index:2147483647;padding:26px 40px 30px;" +
        "background:linear-gradient(transparent,rgba(6,8,12,.97) 45%);color:#fff;" +
        "font:600 27px/1.4 ui-sans-serif,system-ui,-apple-system,sans-serif;text-align:center;" +
        "pointer-events:none;letter-spacing:-.01em;transition:opacity .25s;";
      document.body.appendChild(d);
    }
    d.textContent = t;
    d.style.opacity = "1";
  }, text);
  await page.waitForTimeout(ms);
}

async function clearCaption() {
  await page.evaluate(() => {
    const d = document.getElementById("__cap");
    if (d) d.style.opacity = "0";
  });
}

async function beat(name, fn) {
  try { await fn(); log(`ok   ${name}`); }
  catch (e) { log(`SKIP ${name}: ${String(e).slice(0, 90)}`); }
}

async function reply(text, capBefore, capAfter) {
  const box = page.locator("textarea").first();
  await box.scrollIntoViewIfNeeded();
  await caption(capBefore, 3600);
  await box.click();
  await box.fill("");
  await box.type(text, { delay: 42 });
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: /send as patient/i }).click();
  await page.waitForTimeout(2600);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await page.waitForTimeout(600);
  await caption(capAfter, 5200);
}

log(`recording ${URL}`);
await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2500);

await beat("open", async () => {
  await caption("A patient is discharged with a programme, a drug chart, and a daily reading.", 4600);
  await caption("Then the clinic hears nothing for two weeks.", 4200);
  await caption("Interval: they just reply to an email.", 4000);
});

await beat("board", async () => {
  await caption("Check-ins, ordered by urgency rather than arrival.", 4600);
  await clearCaption();
  await page.waitForTimeout(1200);
});

await beat("worded reply", async () =>
  reply(
    "my blood pressure this morning was one eighty six over one oh four",
    "Watch this one. Not a single digit in the sentence.",
    "OpenAI read the numbers out of the words. Code decided it was a crisis.",
  ));

await beat("red flag reply", async () =>
  reply(
    "BP 120/80 but I have chest pain when I walk upstairs",
    "120 over 80 is a textbook normal blood pressure.",
    "Red anyway. The red-flag scan runs on the raw text, before anything is parsed.",
  ));

await beat("approval gate", async () => {
  await caption("Nothing reaches a patient without clinician approval.", 3800);
  const btn = page.getByRole("button", { name: /try to send unapproved/i }).first();
  await page.evaluate(() => {
    document.querySelector(".items")?.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(900);
  await btn.click();
  await page.waitForTimeout(1600);
  await caption("That refusal came from the backend, not a greyed-out button.", 5000);
});

await beat("citation", async () => {
  await page.evaluate(() => {
    document.querySelector(".citation")?.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(1200);
  await caption("Firecrawl fetched each guideline and pulled the sentence the threshold came from.", 5200);
});

await beat("thresholds", async () => {
  // Centre the table itself, not its heading, so both temperature rows are in
  // frame while the caption is talking about them.
  await page.evaluate(() => {
    document.querySelector(".thresholds")?.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(1200);
  await caption("Thresholds are defined per unit. Nothing is ever converted.", 4400);
  await caption("39 Celsius is a fever. 39 Fahrenheit is not. One table cannot hold both.", 7000);
});

await beat("close", async () => {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await page.waitForTimeout(1800);
  await caption("Convex runs all of it. OpenAI reads, Firecrawl checks, AgentMail carries.", 4800);
  await caption("The patient installed nothing. They answered an email.", 4600);
});

await context.close();
await browser.close();
const file = await page.video().path();
console.log(`VIDEO:${file}`);
