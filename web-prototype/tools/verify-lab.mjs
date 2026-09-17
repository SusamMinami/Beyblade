import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { PARTS, DEFAULT_BUILD } from "../src/data/parts.js";
import { calculateBuild } from "../src/core/assembly-calculator.js";
import { completeLabTest, normalizeLabState, measureBuild, labLevel } from "../src/core/lab-state.js";

const origin = process.env.LAB_TEST_URL ?? "http://127.0.0.1:5173";
const storageKey = "spin-core-web-prototype-v2";
const output = resolve("../.impeccable/review/web");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
let checks = 0;
const check = (condition, label) => { assert.ok(condition, label); checks++; };
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
await context.addInitScript((key) => {
  if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({
    version: 2, coins: 0, tutorial: { completed: true, stage: "complete" },
  }));
}, storageKey);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const saved = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey);
const button = (action) => page.locator(`.lab-view [data-lab="${action}"]`).first();
const close = async () => { await button("close").click(); };
const finishTest = async () => {
  await button("test").click();
  await page.waitForFunction(() => document.querySelector(".lab-start b")?.textContent === "再次测试", { timeout: 15000 });
};

try {
  await page.goto(`${origin}/#lab`);
  await button("test").waitFor();
  await page.waitForFunction(() => !document.querySelector(".lab-start")?.disabled);
  check(await page.locator(".lab-loadout-list canvas").count() === 3, "Three real specimen thumbnails");
  check((await page.locator(".lab-accessible-readout").textContent()).includes("1.22"), "Real calculator values on entry");
  await page.screenshot({ path: `${output}/desktop.png` });
  await page.locator(".game-shell").screenshot({ path: `${output}/lab-portrait.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${output}/mobile.png` });
  const layout = await page.locator(".lab-view").evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return [...el.querySelectorAll("button")].filter((button) => !button.closest("dialog")).map((button) => {
      const r = button.getBoundingClientRect();
      return { label: button.textContent.trim(), inside: r.left >= rect.left - 1 && r.right <= rect.right + 1 && r.top >= 0 && r.bottom <= innerHeight };
    });
  });
  check(layout.every((item) => item.inside), "All phone controls fit onscreen");
  await button("records").click();
  check((await page.locator(".lab-view dialog").textContent()).includes("还没有测试报告"), "Honest empty history");
  await close();
  await finishTest();
  let state = await saved();
  check(state.lab.records.length === 1 && state.lab.xp === 30, "Test writes report and first-time XP");
  await finishTest();
  state = await saved();
  check(state.lab.records.length === 2 && state.lab.xp === 30, "Repeated test does not farm XP");
  await page.reload();
  await page.waitForFunction(() => !document.querySelector(".lab-start")?.disabled);
  check((await page.locator("#lab-xp").textContent()).startsWith("30"), "XP restored after reload");
  await button("records").click();
  check(await page.locator(".lab-report").count() === 2, "Reports restored");
  await page.screenshot({ path: `${output}/records.png` });
  const downloadPromise = page.waitForEvent("download");
  await button("export").click();
  const download = await downloadPromise;
  check(download.suggestedFilename().endsWith(".json"), "Report export downloads JSON");
  await close();
  await button("settings").click();
  await page.selectOption('[data-setting="wind"]', { label: "强逆风" });
  await page.selectOption('[data-setting="terrain"]', { label: "砂砾扰动" });
  await page.uncheck('[data-setting="autoRotate"]');
  await page.selectOption('[data-setting="quality"]', "performance");
  await page.screenshot({ path: `${output}/settings.png` });
  await close();
  await page.locator('[data-mode="balance"]').click();
  check((await page.locator(".lab-accessible-readout").textContent()).includes("42"), "Environment settings affect scores");
  await finishTest();
  check((await saved()).lab.xp === 60, "Different test earns XP");
  await button("calibrate").click();
  await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key)).lab.calibratedAt > 0, storageKey);
  check((await saved()).lab.xp === 60, "Calibration does not affect physics XP");
  await page.locator('.lab-loadout-list [data-loadout="1"]').click();
  check((await saved()).activeLoadoutIndex === 1, "Loadout selector shares existing saved state");
  await button("gems").click();
  check((await page.locator(".lab-view dialog").textContent()).includes("尚未开放"), "Diamond interface declares future status");
  await close();
  await button("shop").click();
  const part = PARTS.find((item) => !Object.values(DEFAULT_BUILD).includes(item.id));
  await page.locator(`[data-part="${part.id}"]`).click();
  check(await button("buy").isDisabled(), "Insufficient balance prevents purchase");
  await close();
  // Funding is confined to this disposable browser context.
  await page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key));
    state.coins = 500;
    localStorage.setItem(key, JSON.stringify(state));
  }, storageKey);
  await page.reload();
  await page.waitForFunction(() => !document.querySelector(".lab-start")?.disabled);
  await button("shop").click();
  await page.locator(`[data-part="${part.id}"]`).click();
  await button("buy").click();
  state = await saved();
  check(state.coins === 500 - part.price && state.ownedPartIds.includes(part.id), "Purchase reuses existing price and ownership");
  check(state.loadouts[1].build[part.type] === part.id, "Purchased part equips active loadout");
  await close();
  await button("assembly").click();
  check(await page.locator(".game-shell").getAttribute("data-screen") === "assembly", "Assembly navigation");
  check(Number(await page.locator("#coin-count").textContent()) === 500 - part.price, "Assembly wallet updates after lab purchase");
  await page.locator(".open-lab-button").click();
  await button("battle").click();
  check(await page.locator(".game-shell").getAttribute("data-screen") === "map", "Battle navigation enters arena selection");
  await page.locator('[data-go="lab"]').first().click();
  check(await page.locator(".game-shell").getAttribute("data-screen") === "lab", "Lab remains reachable from navigation");
  check(errors.length === 0, `No browser exceptions: ${errors.join("; ")}`);
  // Pure-state edge cases that protect save growth and physics isolation.
  const build = calculateBuild(DEFAULT_BUILD);
  let lab = normalizeLabState({ records: [null, {}, { id: "bad", timestamp: 1, metrics: [null] }], xp: "Infinity", settings: { wind: "invalid" } });
  check(lab.records.length === 0 && lab.xp === 0 && lab.settings.wind === "无风", "Invalid lab save fields normalize");
  const before = JSON.stringify(build);
  for (let i = 0; i < 45; i++) lab = completeLabTest(lab, build, { name: "Test" }, "mass", i).lab;
  check(lab.records.length === 40 && lab.xp === 30, "History bounded and XP deduplicated");
  check(JSON.stringify(build) === before, "Lab cannot mutate shared physics build");
  check(labLevel(120).level === 2, "Level threshold");
  check(measureBuild(build, "center", lab.settings)[0].value === build.centerOfMass[1], "CG reads calculator coordinates");
  console.log(`PASS: ${checks} lab integration checks; screenshots in ${output}`);
} finally {
  await browser.close();
}
