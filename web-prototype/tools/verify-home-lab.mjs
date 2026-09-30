import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { syncHomeProgression, homeScreen } from "../src/core/home-progression.js";
import { CAMPAIGN_MISSIONS } from "../src/data/campaign.js";

const out = "../.impeccable/review/home-lab";
await mkdir(out, { recursive: true });
const checks = [], errors = [];
const check = (value, label) => { assert.ok(value, label); checks.push(label); };
const completed = CAMPAIGN_MISSIONS.slice(0, 4).map(m => m.id);
const veteran = { version: 2, sound: false, tutorial: { completed: true, stage: "complete" } };
const story = { ...veteran, campaign: { completed } };
let state = { ...story, ...syncHomeProgression(story) };
check(state.lab.xp === 120 && state.lab.settings.room === "advanced" &&
  state.showroom.equipped === "arena", "Second chapter uses existing 120 XP floor and upgrades both scenes");
const again = syncHomeProgression(state);
check(JSON.stringify(again) === JSON.stringify(syncHomeProgression({ ...state, ...again })),
  "Migration and repeated saves cannot farm XP or duplicate ownership");
check(syncHomeProgression({ ...story, lab: { xp: 560 } }).lab.xp === 560, "High XP saves keep their experience");
check(syncHomeProgression({ ...veteran, campaign: { completed: ["choose-a-line"] } }).lab.xp === 0,
  "Malformed out-of-order campaign cannot unlock rooms");
check(homeScreen(veteran) === "collection" && homeScreen({}) === "assembly", "Home resumes the correct phase");
const manual = syncHomeProgression({ ...state, lab: { ...state.lab, settings: { ...state.lab.settings,
  room: "childhood", followStory: false } }, showroom: { ...state.showroom, equipped: "holo", followStory: false } });
check(manual.lab.settings.room === "childhood" && manual.showroom.equipped === "holo",
  "Story synchronization preserves manual scene choices");
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const base = process.env.LAB_TEST_URL ?? "http://127.0.0.1:5173";
const ready = page => page.waitForFunction(() => {
  const app = window.app;
  return app?.screen === "assembly" && app.maintenanceScreen?.stage ? app.maintenanceScreen.ready :
    app?.screen === "collection" ? app.showroomScreen.ready :
      app?.screen === "lab" ? app.labScreen.loaded : Boolean(app);
}, null, { timeout: 30000 });
async function open(seed, viewport = { width: 1440, height: 1000 }, hash = "#home") {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  await context.addInitScript(seed => {
    if (!localStorage.getItem("spin-core-web-prototype-v2") && seed)
      localStorage.setItem("spin-core-web-prototype-v2", JSON.stringify(seed));
  }, seed);
  const page = await context.newPage();
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await page.route(/\/src\/main\.js(\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace(
      'new BeybladeApp(document.querySelector("#app"));',
      'window.app = new BeybladeApp(document.querySelector("#app"));') });
  });
  await page.goto(`${base}/${hash}`); await ready(page);
  return { page, context };
}
async function capture(page, name) {
  await page.evaluate(() => document.querySelector(".maintenance-console")?.scrollTo(0, 0));
  await page.locator(".game-shell").screenshot({ path: `${out}/${name}.png` });
}
try {
  const first = await open(null, undefined, "");
  check(await first.page.evaluate(() => app.screen === "battle" && !app.state.tutorial.completed),
    "Empty save retains original tutorial opening");
  await first.context.close();
  const returning = await open(veteran, undefined, "");
  check(await returning.page.evaluate(() => app.screen === "collection" &&
    app.showroomScreen.stage.stageId === "holo"), "Returning player opens existing holographic home");
  await capture(returning.page, "home-holo");
  await returning.page.locator('[data-collection="stages"]').click();
  const before = await returning.page.evaluate(() => JSON.stringify(app.state));
  await returning.page.locator('[data-preview-stage="arena"]').click(); await ready(returning.page);
  check(await returning.page.evaluate(s => JSON.stringify(app.state) === s, before),
    "Locked stage preview does not unlock, equip or award XP");
  await returning.page.evaluate(() => app.goTo("lab")); await ready(returning.page);
  await returning.page.locator('[data-lab="maintenance"]').click(); await ready(returning.page);
  await capture(returning.page, "childhood-desktop");
  await returning.page.setViewportSize({ width: 390, height: 844 });
  await capture(returning.page, "childhood-mobile");
  await returning.page.locator('[data-maintenance="cancel"]').click(); await ready(returning.page);
  check(await returning.page.evaluate(() => app.screen === "assembly" && app.workshopMode === "top"),
    "Discard restores the original top assembly in place");
  await returning.context.close();

  const { page, context } = await open(story);
  check(await page.evaluate(() => app.state.lab.xp === 120 && app.state.showroom.equipped === "arena"),
    "Legacy story save upgrades automatically on load");
  await capture(page, "home-arena");
  await page.evaluate(() => app.goTo("maintenance")); await ready(page);
  check(await page.evaluate(() => {
    const m = app.maintenanceScreen.stage, l = app.labScreen.stage;
    return m.scene === l.scene && m.renderer === l.renderer && l.roomSets.advanced.visible &&
      !l.specimen.visible && !l.advancedShield.some(n => n.visible) &&
      !l.active && m.workpiece.parent === l.scene;
  }), "Maintenance borrows exact room, renderer and cached assets with test overlays hidden");
  await capture(page, "desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await capture(page, "mobile");
  const fit = await page.evaluate(() => app.maintenanceScreen.stage.workpiece.scale.x);
  check(await page.locator('[data-maintenance="save"]').evaluate(el => {
    const r = el.getBoundingClientRect(), root = el.closest(".maintenance-view").getBoundingClientRect();
    return r.bottom <= root.bottom && r.top >= root.top && document.elementFromPoint(r.x + 4, r.y + 4) === el;
  }), "Mobile save is visible and reachable without scrolling");
  await page.locator('[data-workshop="outfit"]').click(); await ready(page);
  check(await page.evaluate(scale => Math.abs(app.maintenanceScreen.stage.workpiece.scale.x - scale) < 1e-6, fit),
    "Switching maintenance modes preserves the launcher world scale");
  await capture(page, "outfit-mobile");
  await page.locator('[data-maintenance="save"]').click(); await ready(page);
  check(await page.evaluate(() => app.screen === "assembly"), "Saving stays in unified assembly");
  await page.evaluate(() => app.goTo("lab")); await ready(page);
  await page.locator('[data-lab="settings"]').click();
  await page.selectOption('[data-setting="room"]', "childhood");
  await page.locator('[data-lab="close"]').click();
  await page.evaluate(() => app.goTo("home")); await ready(page);
  await page.locator('[data-collection="stages"]').click();
  await page.locator('[data-equip-stage="holo"]').click(); await ready(page);
  await page.reload(); await ready(page);
  check(await page.evaluate(() => app.state.showroom.equipped === "holo" &&
    app.state.lab.settings.room === "childhood" && app.state.lab.xp === 120),
    "Manual room and opening choices survive reload without losing XP");
  await page.locator('[data-collection="stages"]').click();
  await page.check("[data-follow-story]");
  await page.locator('[data-collection="close"]').click(); await ready(page);
  check(await page.evaluate(() => app.state.showroom.equipped === "arena"), "Follow-story control restores upgraded opening");
  // Borrow/release the same scene repeatedly, including while async loading runs.
  const memory = [];
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => { app.goTo("lab"); app.goTo("maintenance"); app.goTo("collection"); app.goTo("lab"); });
    await ready(page);
    await page.locator('[data-lab="maintenance"]').click(); await ready(page);
    await page.locator('[data-workshop="top"]').click();
    await page.locator('[data-workshop="care"]').click(); await ready(page);
    await page.locator('[data-maintenance="cancel"]').click(); await ready(page);
    await page.evaluate(() => app.goTo("lab")); await ready(page);
    memory.push(await page.evaluate(() => ({ ...app.labScreen.stage.renderer.info.memory })));
  }
  check(memory.at(-1).geometries <= memory[0].geometries + 2 &&
    memory.at(-1).textures <= memory[0].textures + 2, "Shared lab resources stay stable through repeated rapid navigation");
  check(await page.evaluate(() => app.labScreen.stage.renderer.domElement.parentElement.className === "lab-scene" &&
    app.labScreen.stage.specimen.visible && !app.maintenanceScreen.stage), "Canvas and specimen return to their active owner");
  // Failed writes must leave upgrade and room state unchanged.
  check(await page.evaluate(() => {
    const previous = JSON.stringify([app.state.lab, app.state.showroom]);
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error("quota"); };
    try { app._save(); } catch {} finally { Storage.prototype.setItem = set; }
    return previous === JSON.stringify([app.state.lab, app.state.showroom]);
  }), "Failed save leaves progression in memory unchanged");
  await page.evaluate(() => app.goTo("assembly")); await page.reload(); await ready(page);
  check(await page.evaluate(() => app.screen === "assembly"), "Explicit assembly deep link still resumes modification");
  check(errors.length === 0, `No browser or shader errors: ${errors.join("; ")}`);
  await writeFile(`${out}/verification.json`, JSON.stringify({ checks, memory, errors }, null, 2));
  console.log(JSON.stringify({ checks, memory }, null, 2));
  await context.close();
} finally { await browser.close(); }
