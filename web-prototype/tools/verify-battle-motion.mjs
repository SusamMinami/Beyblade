import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true,
});
const results = [];
try {
  for (const reducedMotion of ["no-preference", "reduce"]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion });
    await context.addInitScript(() => localStorage.setItem("spin-core-web-prototype-v2",
      JSON.stringify({ version: 2, sound: false, tutorial: { completed: true, stage: "complete" } })));
    const page = await context.newPage();
    await page.goto(`${process.env.LAB_TEST_URL ?? "http://127.0.0.1:5173"}/#journey`);
    await page.locator("#start-battle").click();
    await page.waitForFunction(() => !document.querySelector("#launch-button").disabled);
    await page.evaluate(() => {
      window.finishTiming = {};
      const observer = new MutationObserver(() => {
        const result = document.querySelector("#result-card");
        if (!document.querySelector("#result-copy").textContent) return;
        window.finishTiming.settled ??= performance.now();
        if (!result.classList.contains("is-hidden")) {
          window.finishTiming.shown ??= performance.now();
          observer.disconnect();
        }
      });
      observer.observe(document.querySelector("#result-card"), { subtree: true, childList: true, attributes: true });
    });
    await page.locator("#launch-button").click();
    await page.locator("#result-card:not(.is-hidden)").waitFor({ timeout: 100000 });
    const timing = await page.evaluate(() => window.finishTiming);
    const delay = timing.shown - timing.settled;
    assert.ok(reducedMotion === "reduce" ? delay < 100 : delay >= 700 && delay < 2500,
      `${reducedMotion} finish delay ${delay}`);
    results.push({ reducedMotion, delayMs: Math.round(delay) });
    await context.close();
  }
  await writeFile("../.impeccable/review/structure/motion.json", JSON.stringify(results, null, 2));
  console.log("PASS: normal finishing hold and immediate reduced-motion report", results);
} finally {
  await browser.close();
}
