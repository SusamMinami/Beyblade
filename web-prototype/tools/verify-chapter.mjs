import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { DEFAULT_BUILD } from "../src/data/parts.js";
import { createDefaultLoadouts } from "../src/core/loadouts.js";

// Isolated progression/ownership fixture; the victory and replay run the real solver.
const key = "spin-core-web-prototype-v2";
const build = { ...DEFAULT_BUILD, coreLock: "core_lock.low_center" };
const fixture = {
  version: 2, coins: 700, sound: false, activeLoadoutIndex: 0,
  loadouts: createDefaultLoadouts(build), ownedPartIds: Object.values(build),
  tutorial: { completed: true, stage: "complete", firstRewardClaimed: true },
  campaign: { completed: ["first-echo"], mastered: [], journal: [] },
};
let checks = 0;
const check = (condition, name) => { assert.ok(condition, name); checks++; };
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const base = process.env.LAB_TEST_URL ?? "http://127.0.0.1:5173";
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
await context.addInitScript(({ key, fixture }) => {
  if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(fixture));
}, { key, fixture });
const page = await context.newPage();
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
const battle = async () => {
  await page.locator("#start-battle").click();
  await page.waitForFunction(() => !document.querySelector("#launch-button")?.disabled);
  await page.locator("#launch-button").click();
  await page.locator("#result-card:not(.is-hidden)").waitFor({ timeout: 100000 });
};
try {
  await page.goto(`${base}/#journey`);
  await page.selectOption("#mission-select", "rival-arrives");
  await battle();
  check((await saved()).campaign.completed.includes("rival-arrives"), "Real solver victory clears the chapter");
  check((await saved()).campaign.journal[0].winner === "player", "Victory was actually recorded");
  check((await page.locator("#campaign-result .chapter-moment").textContent()).includes("阿砾"), "First clear renders the companion response");
  check(await page.locator("#result-restart").textContent() === "前往修理铺", "Chapter action names the next destination");
  check((await saved()).coins === 820, "Chapter clear only pays the canonical victory reward");
  await page.locator("#result-restart").click();
  check(await page.locator("#mission-select").inputValue() === "repair-lesson", "Next destination selects the correct mission");
  check(await page.locator(".journey-moments article").count() === 1, "New response is available in the archive");
  await page.selectOption("#mission-select", "rival-arrives");
  await battle();
  check((await saved()).campaign.journal[1].winner === "player", "Replay also completes in the real solver");
  check(await page.locator("#campaign-result .chapter-moment").count() === 0, "Replay never repeats first-clear response");
  check((await saved()).campaign.completed.length === 2 && (await saved()).coins === 940, "Replay does not duplicate progress or first-clear rewards");
  check(errors.length === 0, `No runtime errors: ${errors.join("; ")}`);
  await writeFile("../.impeccable/review/growth/chapter-live.json",
    JSON.stringify({ status: "PASS", checks, errors, fixture: "isolated first-echo completion and owned low-center core; real solver battles" }, null, 2));
  console.log(`PASS ${checks}: live chapter first clear, next destination and replay`);
} finally {
  await browser.close();
}
