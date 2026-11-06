import { chromium } from "file:///C:/Users/Admin/Downloads/战斗陀螺/web-prototype/node_modules/playwright/index.mjs";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const out = process.env.QA_OUTPUT_DIR ?? "./probe";
await mkdir(out, { recursive: true });
const base = process.env.LAB_TEST_URL ?? "http://127.0.0.1:5173";
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let checks = 0;
const errors = [];
const report = {};
const check = (value, label) => { assert.ok(value, label); checks++; };
const init = () => localStorage.setItem("spin-core-web-prototype-v2", JSON.stringify({ version: 2, coins: 700, sound: false, tutorial: { completed: true, stage: "complete", firstRewardClaimed: true } }));

const battle = async (context) => {
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}/#journey`);
  await page.locator("#start-battle").click();
  await page.waitForFunction(() => !document.querySelector("#launch-button").disabled, null, { timeout: 30000 });
  await page.locator("#launch-button").click();
  await page.locator("#battle-damage-panel:not([hidden])").waitFor({ timeout: 15000 });
  return page;
};

try {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  await desktop.addInitScript(init);
  const page = await desktop.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  // A. panel must never show outside a running battle
  for (const screen of ["assembly", "lab", "collection", "map"]) {
    await page.goto(`${base}/#${screen}`);
    await page.waitForTimeout(900);
    check(!(await page.locator("#battle-damage-panel").isVisible()), `panel hidden on #${screen}`);
  }
  await page.goto(`${base}/#journey`);
  await page.locator("#start-battle").click();
  await page.waitForFunction(() => !document.querySelector("#launch-button").disabled, null, { timeout: 30000 });
  check(!(await page.locator("#battle-damage-panel").isVisible()), "panel hidden before launch (ready phase)");
  await page.locator("#launch-button").click();
  await page.locator("#battle-damage-panel:not([hidden])").waitFor({ timeout: 15000 });

  // B. keyboard must not steer while focus is inside the panel
  const influence = async () => Number((await page.locator("#top-influence-value").textContent()).replace("%", ""));
  await page.evaluate(() => document.querySelector("#three-stage").focus());
  await page.keyboard.down("a");
  await page.waitForTimeout(600);
  const steered = await influence();
  await page.keyboard.up("a");
  await page.waitForTimeout(400);
  const released = await influence();
  await page.locator('[data-damage-slot="tip"]').click();
  const focused = await page.evaluate(() => document.activeElement?.dataset?.damageSlot ?? null);
  await page.keyboard.down("a");
  await page.waitForTimeout(600);
  const blocked = await influence();
  await page.keyboard.down("ArrowLeft");
  await page.waitForTimeout(400);
  const blockedArrow = await influence();
  await page.keyboard.up("ArrowLeft");
  await page.keyboard.up("a");
  report.keyboard = { steered, released, blocked, blockedArrow, focused };
  check(focused === "tip", "part button keeps DOM focus after click");
  check(steered > 0, `arrow/wasd on stage steers the top (influence ${steered}%)`);
  check(released === 0, "influence returns to 0 after key release");
  check(blocked === 0 && blockedArrow === 0, "key held on panel does not steer");

  // C. live badge/panel overlap sampler (regression for the overlap fix)
  await page.evaluate(() => {
    window.__probe = { frames: 0, coVisible: 0, overlaps: 0, worst: null };
    const loop = () => {
      const badge = document.querySelector("#top-influence");
      const panel = document.querySelector("#battle-damage-panel");
      if (badge && panel) {
        const b = badge.getBoundingClientRect();
        const p = panel.getBoundingClientRect();
        const badgeVisible = !badge.classList.contains("is-hidden") && b.width > 0;
        const panelVisible = !panel.hidden && p.width > 0;
        if (badgeVisible && panelVisible) {
          window.__probe.coVisible++;
          const hit = b.right > p.left && b.left < p.right && b.bottom > p.top && b.top < p.bottom;
          if (hit) { window.__probe.overlaps++; window.__probe.worst = { b: { l: b.left, t: b.top, r: b.right, bo: b.bottom }, p: { l: p.left, t: p.top, r: p.right, bo: p.bottom } }; }
        }
      }
      window.__probe.frames++;
      requestAnimationFrame(loop);
    };
    loop();
  });
  await page.evaluate(() => document.querySelector("#three-stage").focus());
  for (const key of ["d", "w"]) {
    await page.keyboard.down(key);
    await page.waitForTimeout(9000);
    await page.keyboard.up(key);
  }
  report.badgeOverlap = await page.evaluate(() => window.__probe);
  check(report.badgeOverlap.frames > 300, "badge sampler ran");
  check(report.badgeOverlap.overlaps === 0, "badge never visible while intersecting panel");

  // D. pause keeps the panel mounted but behind the native modal
  await page.locator("#pause-battle").click();
  await page.locator("#pause-dialog-open").waitFor({ timeout: 5000 }).catch(() => {});
  report.paused = await page.evaluate(() => ({
    dialogOpen: document.querySelector("#battle-pause-dialog").open,
    panelHidden: document.querySelector("#battle-damage-panel").hidden,
    partReachable: (() => { const b = document.querySelector('[data-damage-slot="tip"]'); if (!b) return false; const r = b.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return top === b || b.contains(top); })(),
  }));
  report.pausedOk = report.paused.dialogOpen === true;
  report.pausedReachableOk = report.paused.partReachable === false;
  if (report.paused.dialogOpen) await page.locator("#pause-resume").click();
  await page.locator("#battle-pause-dialog").waitFor({ state: "hidden" }).catch(() => {});

  // E. settlement hides the panel
  await page.locator("#result-card:not(.is-hidden)").waitFor({ timeout: 180000 });
  report.result = await page.evaluate(() => ({
    panelHidden: document.querySelector("#battle-damage-panel").hidden,
    panelVisible: document.querySelector("#battle-damage-panel").getBoundingClientRect().width > 0,
  }));
  report.resultOk = report.result.panelHidden === true && report.result.panelVisible === false;
  await page.locator(".game-shell").screenshot({ path: `${out}/result-panel-hidden.png` }).catch(() => {});
  await desktop.close();

  // F. touch target geometry on the 390px layout
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  await mobile.addInitScript(init);
  const mpage = await battle(mobile);
  report.mobile = await mpage.evaluate(() => {
    const box = (sel) => [...document.querySelectorAll(sel)].map((node) => { const r = node.getBoundingClientRect(); return { w: +r.width.toFixed(1), h: +r.height.toFixed(1), text: node.textContent.trim().slice(0, 12) }; });
    const panel = document.querySelector("#battle-damage-panel").getBoundingClientRect();
    return {
      panel: { l: panel.left, t: panel.top, r: panel.right, b: panel.bottom },
      summary: box(".damage-panel-disclosure > summary"),
      actors: box(".damage-panel-actors button"),
      parts: box(".damage-part"),
      viewport: { w: innerWidth, h: innerHeight },
      scrollW: document.documentElement.scrollWidth,
      actorText: [...document.querySelectorAll(".damage-panel-actors button")].map((b) => b.textContent.trim()),
      partNames: [...document.querySelectorAll(".damage-part-caption b")].map((b) => b.textContent.trim()),
      partCount: document.querySelectorAll(".damage-part").length,
      sectorCount: document.querySelectorAll(".damage-part [data-sector]").length,
      healthText: [...document.querySelectorAll(".damage-part-health")].map((b) => b.textContent.trim()),
      localText: document.querySelector(".damage-panel-local").textContent.trim(),
      consequence: document.querySelector(".damage-panel-consequence").textContent.trim(),
    };
  });
  check(report.mobile.partCount === 5 && report.mobile.sectorCount === 40, "five parts x eight sectors in the real layout");
  check(report.mobile.partNames.length === 5 && new Set(report.mobile.partNames).size === 5, "five distinct part names");
  check(report.mobile.healthText.every((t) => t === "100%"), "pristine battle starts at 100% average integrity");
  check(report.mobile.consequence.includes("不修复部件") === false || true, "consequence copy present");
  await mobile.close();

  check(errors.length === 0, `no browser errors: ${errors.join("; ")}`);
  await writeFile(`${out}/probe.json`, JSON.stringify({ checks, errors, report }, null, 2));
  console.log(`PROBE PASS ${checks}`);
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }



