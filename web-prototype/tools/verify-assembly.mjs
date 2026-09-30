import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { syncHomeProgression } from "../src/core/home-progression.js";
import { CAMPAIGN_MISSIONS } from "../src/data/campaign.js";

const out = process.env.QA_OUTPUT_DIR ?? "../.impeccable/review/assembly-merge";
await mkdir(out, { recursive: true });
const checks = [], errors = [];
const check = (value, label) => { assert.ok(value, label); checks.push(label); };
const campaign = n => ({ completed: CAMPAIGN_MISSIONS.slice(0, n).map(m => m.id) });
check(syncHomeProgression({}).lab.settings.room === "minimal", "New players start in the incumbent minimal space");
check(syncHomeProgression({ campaign: campaign(2) }).lab.settings.room === "childhood", "Chapter one recommends the authored childhood desk");
check(syncHomeProgression({ campaign: campaign(4) }).lab.settings.room === "advanced", "Chapter two recommends precision");
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const base = process.env.LAB_TEST_URL ?? "http://127.0.0.1:5173";
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  await context.addInitScript(() => {
    if (!localStorage.getItem("spin-core-web-prototype-v2")) localStorage.setItem("spin-core-web-prototype-v2",
      JSON.stringify({ version: 2, coins: 1000, sound: false, tutorial: { completed: true, stage: "complete" } }));
  });
  const page = await context.newPage();
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await page.route(/\/src\/main\.js(\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace(
      'new BeybladeApp(document.querySelector("#app"));', 'window.app = new BeybladeApp(document.querySelector("#app"));') });
  });
  const readyTop = () => page.waitForFunction(() => app.stage.borrowedLab && app.workshopMode === "top");
  const readyTools = () => page.waitForFunction(() => app.maintenanceScreen?.ready);
  const capture = async name => {
    // Canvas resizing clears its pixels; wait for the active owner's draw.
    await page.evaluate(() => new Promise(resolve =>
      requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
    await page.screenshot({ path: `${out}/${name}.png` });
  };
  await page.goto(`${base}/#assembly`); await readyTop();
  check(await page.evaluate(() => app.stage.renderer === app.labScreen.stage.renderer &&
    app.stage.borrowedLab.base.scene === app.labScreen.stage.scene &&
    document.querySelectorAll("#three-stage canvas").length === 1), "Original assembly uses the same laboratory scene and renderer");
  await capture("top-desktop");
  // Click a real top surface through the original pointer hit path.
  const point = await page.evaluate(() => {
    const s = app.stage, r = s.renderer.domElement.getBoundingClientRect();
    for (let y = r.y + r.height * .35; y < r.y + r.height * .6; y += 8)
      for (let x = r.x + r.width * .25; x < r.x + r.width * .75; x += 8)
        if (s._pickAssemblyPart(x, y)?.slot === "attackRing") return { x, y };
    return null;
  });
  check(Boolean(point), "Original top remains directly selectable");
  await page.mouse.click(point.x, point.y);
  await page.waitForFunction(() => app.activeSlot === "attackRing");
  check(await page.locator("#variant-list .variant").count() === 3, "Original three-part picker is retained");
  await page.locator("#variant-list .variant.is-active").click();
  check(await page.evaluate(() => Boolean(app.diyDraft) && app.stage.partEditorSlot === "attackRing"),
    "Original DIY editor still opens from equipped part");
  await capture("diy-desktop");
  await page.evaluate(() => app._closePartEditor(false));
  await page.locator("#next-loadout").click();
  check(await page.evaluate(() => app.state.activeLoadoutIndex === 1), "Existing loadout carousel still commits its real loadout");
  await page.locator('[data-workshop="outfit"]').click(); await readyTools();
  const saved = await page.evaluate(() => JSON.stringify(app.state.launcher));
  await page.locator('[data-maintenance="red"]').click();
  await page.locator('[data-workshop="top"]').click(); await readyTop();
  await page.locator('[data-workshop="outfit"]').click(); await readyTools();
  check(await page.evaluate(before => app.maintenanceScreen.launcherDraft.colors.accent === "#b83722" &&
    JSON.stringify(app.state.launcher) === before, saved), "Internal top/launcher switches retain drafts without committing");
  await page.locator(".workshop-room summary").click();
  check(await page.locator('#workshop-room option[value="advanced"]').evaluate(option => option.disabled), "Advanced lab is locked below existing LV.2");
  await page.selectOption("#workshop-room", "childhood"); await readyTools();
  check(await page.evaluate(() => app.maintenanceScreen.launcherDraft.colors.accent === "#b83722" &&
    !app.state.lab.settings.followStory), "Room changes retain equipment drafts and set a manual preference");
  await page.locator(".workshop-room summary").click();
  await capture("childhood-launcher");
  await page.evaluate(() => { window.realSave = Storage.prototype.setItem; Storage.prototype.setItem = () => { throw Error("quota"); }; });
  await page.locator('[data-maintenance="save"]').click();
  check(await page.evaluate(before => JSON.stringify(app.state.launcher) === before &&
    app.maintenanceScreen.launcherDraft.colors.accent === "#b83722", saved), "Failed save retains the draft and rolls back live equipment");
  await page.evaluate(() => { Storage.prototype.setItem = realSave; });
  await page.locator('[data-maintenance="save"]').click();
  check(await page.evaluate(() => app.screen === "assembly" && location.hash === "#assembly" &&
    app.state.launcher.colors.accent === "#b83722"), "Save commits in the original assembly without navigation");
  await page.reload(); await readyTop();
  check(await page.evaluate(() => app.state.lab.settings.room === "childhood" &&
    app.state.launcher.colors.accent === "#b83722"), "Room and equipment preferences survive reload");
  await page.evaluate(campaign => { app.state.campaign.completed = campaign; app.state.lab.settings.followStory = true; app._save(); app.goTo("assembly"); },
    CAMPAIGN_MISSIONS.slice(0, 4).map(m => m.id));
  await readyTop();
  await page.setViewportSize({ width: 390, height: 844 });
  await capture("advanced-top");
  check(await page.evaluate(() => app.state.lab.settings.room === "advanced" && app.state.lab.xp === 120),
    "Story upgrade reaches the unified assembly through the existing XP floor");
  await page.locator(".workshop-room summary").click();
  await page.selectOption("#workshop-room", "minimal"); await readyTop();
  await capture("room-mobile");
  await page.reload(); await readyTop();
  check(await page.evaluate(() => app.state.lab.settings.room === "minimal" && !app.state.lab.settings.followStory),
    "A veteran can return to minimal and keep that choice");
  await page.locator('[data-workshop="outfit"]').click(); await readyTools();
  await capture("launcher-mobile");
  await page.locator('[data-workshop="care"]').click(); await readyTools();
  await capture("care-mobile");
  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-maintenance="save"]'), r = el.getBoundingClientRect();
    return r.bottom <= innerHeight + 1 && el.contains(document.elementFromPoint(r.x + 8, r.y + 8));
  });
  check(await page.locator('[data-maintenance="save"]').evaluate(el => {
    const r = el.getBoundingClientRect();
    return r.bottom <= innerHeight + 1 && el.contains(document.elementFromPoint(r.x + 8, r.y + 8));
  }), "Save remains reachable at 320 by 568");
  await capture("care-small");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('[data-workshop="outfit"]').click(); await readyTools();
  await capture("launcher-desktop");
  // Multiple ownership transfers, including an in-flight room load.
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => { app.goTo("lab"); app.goTo("launcher"); app.goTo("collection"); app.goTo("assembly"); });
    await readyTop();
  }
  check(await page.evaluate(() => app.stage.renderer.domElement.parentElement.id === "three-stage" &&
    !app.labScreen.stage.active && !app.maintenanceScreen.stage && app.labScreen.stage.scene.parent === app.stage.scene),
    "Rapid navigation returns canvas, scene and interaction ownership to assembly");
  await page.evaluate(() => app.goTo("lab"));
  await page.waitForFunction(() => app.labScreen.loaded);
  check(await page.evaluate(() => app.labScreen.stage.scene.parent === null &&
    app.labScreen.stage.scene.position.length() === 0 && app.labScreen.stage.specimen.visible),
    "Testing restores laboratory origin and specimen after assembly");
  check(!errors.length, `No browser/shader errors: ${errors.join("; ")}`);
  await writeFile(`${out}/verification.json`, JSON.stringify({ checks, errors }, null, 2));
  console.log(`PASS: ${checks.length} unified assembly contracts`);
} finally { await browser.close(); }
