import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { normalizeMaintenance } from "../src/core/maintenance-state.js";
const out = process.env.QA_OUTPUT_DIR ?? "../.impeccable/review/maintenance";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const base = process.env.LAB_TEST_URL ?? "http://127.0.0.1:5173";
const checks = [], errors = [];
const check = (ok, label) => { assert.ok(ok, label); checks.push(label); };
const ready = page => page.waitForFunction(() => window.app?.maintenanceScreen?.ready, null, { timeout: 15000 });
async function open(viewport, mobile = false) {
  const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    if (!localStorage.getItem("spin-core-web-prototype-v2"))
      localStorage.setItem("spin-core-web-prototype-v2", JSON.stringify({
        version: 2, sound: false, tutorial: { completed: true, stage: "complete" },
      }));
  });
  const page = await context.newPage();
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", msg => { if (msg.type() === "error") errors.push(msg.text()); });
  await page.route(/\/src\/main\.js(\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace(
      'new BeybladeApp(document.querySelector("#app"));',
      'window.app = new BeybladeApp(document.querySelector("#app"));') });
  });
  await page.goto(`${base}/#maintenance`);
  await ready(page);
  return { page, context };
}
// Locate a real visible contact, then drive real pointer events through Chrome.
async function point(page, zone) {
  return page.evaluate(zone => {
    const s = app.maintenanceScreen.stage;
    const r = s.canvas.getBoundingClientRect();
    for (let y = r.y + 8; y < r.bottom - 8; y += 5)
      for (let x = r.x + 8; x < r.right - 8; x += 5) {
        const h = s.hit(x, y);
        if (h?.zone === zone) return { x, y };
      }
    return null;
  }, zone);
}
async function stroke(page, zone) {
  const p = await point(page, zone);
  check(Boolean(p), `Visible ${zone} surface is directly reachable`);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 12, p.y + 8, { steps: 6 });
  await page.mouse.up();
  return p;
}
try {
  const mobile = await open({ width: 390, height: 844 }, true);
  await mobile.page.locator(".game-shell").screenshot({ path: `${out}/mobile.png` });
  const { page, context } = await open({ width: 1440, height: 1000 });
  await page.locator(".game-shell").screenshot({ path: `${out}/desktop.png` });
  const starting = await page.evaluate(() => JSON.stringify(app.state));
  await page.locator('[data-focus="transmission"]').click();
  const oilPoint = await stroke(page, "transmission");
  check(await page.evaluate(() => app.maintenanceScreen.draft.launcher.length > 0), "Model strokes create oil at actual contact positions");
  check(await page.evaluate(before => JSON.stringify(app.state) === before, starting), "Draft strokes do not mutate saved state");
  const oilyAmount = await page.evaluate(() => app.maintenanceScreen.draft.launcher.reduce((n, s) => n + s.amount, 0));
  await page.locator('[data-tool="wipe"]').click();
  await page.mouse.click(oilPoint.x, oilPoint.y);
  check(await page.evaluate(before => app.maintenanceScreen.draft.launcher.reduce((n, s) => n + s.amount, 0) < before, oilyAmount),
    "Actual wipe pointer removes local oil");
  await page.locator('[data-maintenance="undo"]').click();
  await page.locator('[data-tool="oil"]').click();
  await page.locator('[data-maintenance="undo"]').click();
  check(await page.evaluate(() => app.maintenanceScreen.draft.launcher.length === 0), "Undo restores the preceding stroke");
  await stroke(page, "transmission");
  await page.locator('[data-maintenance="trial"]').click();
  check(await page.locator(".maintenance-trial").isVisible(), "Controlled trial shows solver measurements");
  await page.locator("#three-stage").screenshot({ path: `${out}/transmission.png` });
  await page.locator('[data-focus="grip"]').click();
  await stroke(page, "support");
  await page.locator('[data-workshop="top"]').click();
  await page.locator('[data-workshop="care"]').click(); await ready(page);
  await page.locator('[data-focus="tip"]').click();
  await stroke(page, "tip");
  await page.locator(".game-shell").screenshot({ path: `${out}/tip.png` });
  const draft = JSON.stringify(normalizeMaintenance(await page.evaluate(() => app.maintenanceScreen.draft)));
  await page.locator('[data-maintenance="save"]').click();
  check(await page.evaluate(() => app.screen === "assembly"), "Saving returns to assembly");
  check(await page.evaluate(expected => JSON.stringify(app.state.maintenance) === expected, draft), "Save preserves spatial oil");
  await page.reload();
  check(await page.evaluate(expected => JSON.stringify(app.state.maintenance) === expected, draft), "Saved oil survives reload");
  await page.evaluate(() => app.goTo("battle"));
  check(await page.evaluate(() => app.simulation.maintenance.player.transmission > 0 &&
    app.simulation.maintenance.player.contact > 0), "Next battle uses drive and tip maintenance");
  await page.evaluate(() => app.goTo("maintenance")); await ready(page);
  await page.locator('[data-maintenance="clean"]').click();
  await page.locator('[data-maintenance="cancel"]').click();
  check(await page.evaluate(expected => JSON.stringify(app.state.maintenance) === expected, draft), "Discarding a clean does not change saved oil");
  await page.locator('[data-workshop="care"]').click(); await ready(page);
  check(await page.evaluate(() => app.screen === "assembly"), "Care stays inside original assembly");
  await page.locator('[data-maintenance="cancel"]').click();
  const memory = [];
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => app.goTo("maintenance")); await ready(page);
    await page.locator('[data-workshop="top"]').click();
    await page.locator('[data-workshop="care"]').click(); await ready(page);
    await page.locator('[data-maintenance="cancel"]').click();
    memory.push(await page.evaluate(() => ({ ...app.labScreen.stage.renderer.info.memory })));
  }
  check(memory.at(-1).geometries <= memory[0].geometries + 2 &&
    memory.at(-1).textures <= memory[0].textures + 2, "Repeated entry releases maintenance GPU resources");
  await context.close();

  const p = mobile.page;
  check(await p.evaluate(() => {
    const r = document.querySelector(".maintenance-view");
    return r.scrollWidth <= r.clientWidth + 1;
  }), "Mobile has no horizontal overflow");
  await p.locator('[data-focus="transmission"]').click();
  const hit = await point(p, "transmission");
  check(Boolean(hit), "Touch can reach exposed drive");
  const cdp = await mobile.context.newCDPSession(p);
  const before = await p.evaluate(() => JSON.stringify(app.maintenanceScreen.draft));
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: hit.x, y: hit.y, id: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
  check(await p.evaluate(before => JSON.stringify(app.maintenanceScreen.draft) === before, before), "Touch cancellation rolls back an interrupted stroke");
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: hit.x, y: hit.y, id: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [
    { x: hit.x, y: hit.y, id: 1 }, { x: hit.x + 40, y: hit.y + 20, id: 2 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [
    { x: hit.x - 10, y: hit.y, id: 1 }, { x: hit.x + 60, y: hit.y + 30, id: 2 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  check(await p.evaluate(before => JSON.stringify(app.maintenanceScreen.draft) === before, before), "Pinch/orbit does not accidentally paint");
  check(errors.length === 0, `No browser or shader errors: ${errors.join("; ")}`);
  await writeFile(`${out}/verification.json`, JSON.stringify({ checks, errors, memory }, null, 2));
  console.log(JSON.stringify({ checks, memory }, null, 2));
  await mobile.context.close();
} finally { await browser.close(); }
