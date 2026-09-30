import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const out = process.env.QA_OUTPUT_DIR ?? "../.impeccable/review/launcher-integration";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const base = process.env.LAB_TEST_URL ?? "http://127.0.0.1:5173";
const checks = [], errors = [];
const check = (ok, text) => { assert.ok(ok, text); checks.push(text); };
const ready = p => p.waitForFunction(() => window.app?.maintenanceScreen?.ready, null, { timeout: 30000 });
async function open(viewport, coins = 1000, reducedMotion = "no-preference") {
  const context = await browser.newContext({ viewport, reducedMotion });
  await context.addInitScript(coins => {
    if (!localStorage.getItem("spin-core-web-prototype-v2"))
      localStorage.setItem("spin-core-web-prototype-v2", JSON.stringify({ version: 2, sound: false,
        coins, tutorial: { completed: true, stage: "complete" } }));
  }, coins);
  const p = await context.newPage();
  p.on("pageerror", e => errors.push(e.message));
  await p.route(/\/src\/main\.js(\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace(
      'new BeybladeApp(document.querySelector("#app"));', 'window.app = new BeybladeApp(document.querySelector("#app"));') });
  });
  await p.goto(`${base}/#launcher`); await ready(p);
  return { p, context };
}
try {
  const { p, context } = await open({ width: 1440, height: 1000 });
  await p.screenshot({ path: `${out}/desktop.png`, fullPage: true });
  check(await p.evaluate(() => app.screen === "assembly" && location.hash === "#assembly" &&
    app.workshopMode === "outfit"), "Legacy launcher route opens outfit inside original assembly");
  const initial = await p.evaluate(() => JSON.stringify(app.state));
  await p.locator('[data-launcher-part="launcher.rack.r02"]').click(); await ready(p);
  check(await p.evaluate(s => JSON.stringify(app.state) === s, initial), "Locked preview cannot mutate coins, ownership, or equipment");
  check(await p.evaluate(() => app.maintenanceScreen.stage.model.userData.config.build.rack.endsWith("r02")), "Preview mounts real R02 geometry");
  await p.locator('[data-maintenance="equip"]').click();
  check(await p.evaluate(() => app.state.coins === 860 && app.state.ownedPartIds.includes("launcher.rack.r02") &&
    app.state.launcher.build.rack.endsWith("r01")), "Purchase deducts existing coins once; equipment remains a draft");
  await p.locator('[data-launcher-slot="transmission"]').click(); await ready(p);
  const camera = await p.evaluate(() => {
    const s = app.maintenanceScreen.stage;
    window.housingId = s.model.userData.slots.housing.uuid;
    return [s.yaw, s.pitch, s.radius];
  });
  await p.locator('[data-launcher-part="launcher.transmission.t02"]').click(); await ready(p);
  check(await p.evaluate(c => {
    const s = app.maintenanceScreen.stage;
    return s.model.userData.slots.housing.uuid === housingId && JSON.stringify([s.yaw, s.pitch, s.radius]) === JSON.stringify(c);
  }, camera), "Swapping a cartridge retains housing and inspection camera");
  await p.locator('[data-maintenance="equip"]').click();
  await p.locator('[data-launcher-slot="coupler"]').click(); await ready(p);
  await p.locator('[data-launcher-part="launcher.coupler.c02"]').click(); await ready(p);
  await p.locator('[data-maintenance="equip"]').click();
  await p.locator('[data-maintenance="red"]').click();
  await p.locator('[data-focus=""]').click();
  await p.locator(".maintenance-view").evaluate(el => el.scrollTo(0, 0));
  await p.screenshot({ path: `${out}/outfit-red.png`, fullPage: true });
  await p.locator('[data-maintenance="trial"]').click();
  check(await p.locator(".maintenance-trial").innerText().then(t => t.includes("机构残留能")), "Bench exposes actual energy, effort and release measurements");
  const linkage = await p.evaluate(async () => {
    const { poseLauncher } = await import("/src/render/launcher-model.js");
    const s = app.maintenanceScreen.stage, model = s.model;
    s.motionTime = 0;
    const nodes = {};
    model.traverse(o => { if (o.userData.inspectionGroup) nodes[o.userData.inspectionGroup] = o; });
    poseLauncher(model, { pull: .8, release: 0 });
    const before = Object.fromEntries(["release_cam", "release_jaw_0", "release_jaw_1", "release_jaw_2", "release_fork"]
      .map(id => [id, nodes[id].position.clone()]));
    poseLauncher(model, { pull: .8, release: 1 });
    const moved = Object.entries(before).every(([id, v]) => v.distanceTo(nodes[id].position) > .05);
    const angle = .8 / (.046 * 36 / (2 * Math.PI));
    const gears = Math.abs(nodes.input_rotor.rotation.y + angle) < 1e-6 ||
      Math.abs(nodes.input_rotor.quaternion.y - Math.sin(-angle / 2)) < 1e-6;
    poseLauncher(model, { explode: .7 });
    return { moved, gears };
  });
  check(linkage.moved && linkage.gears, "Fork, cam, three radial dogs and input gear articulate independently");
  await p.locator('[data-maintenance="save"]').click();
  await p.reload();
  const saved = await p.evaluate(() => app.state.launcher);
  check(saved.build.rack.endsWith("r02") && saved.build.transmission.endsWith("t02") &&
    saved.build.coupler.endsWith("c02") && saved.colors.accent === "#b83722", "Three cartridges and red paint survive save/reload");
  await p.evaluate(() => app.goTo("battle"));
  await p.waitForFunction(() => app.stage.arenaReady, null, { timeout: 30000 });
  check(await p.evaluate(() => JSON.stringify(app.simulation.launchers.player) === JSON.stringify(app.stage.launcherRoot.children[0].userData.config)),
    "Battle geometry and solver use identical equipment");
  await p.locator("#launch-button").click();
  await p.waitForFunction(() => app.stage.launcherRelease);
  check(await p.evaluate(() => app.simulation.phase === "ready"), "Physics waits for the dogs to clear");
  await p.waitForFunction(() => app.simulation.phase === "running");
  check(await p.evaluate(() => app.simulation.player.launcherTelemetry.releaseMs === 95 &&
    !app.stage.launcherRoot.visible && !app.stage.launchVectorRoot.visible), "Release uses equipped exit time and clears aiming");
  await p.evaluate(() => { app.goTo("battle"); });
  await p.waitForFunction(() => app.stage.arenaReady);
  await p.locator("#launch-button").click();
  await p.evaluate(() => app.goTo("assembly"));
  check(await p.evaluate(() => !app.stage.launcherRelease && !app.simulation), "Navigation cancels pending release");
  await context.close();

  const mobile = await open({ width: 390, height: 844 }, 0, "reduce");
  await mobile.p.screenshot({ path: `${out}/mobile.png`, fullPage: true });
  await mobile.p.locator('[data-launcher-part="launcher.rack.r03"]').click(); await ready(mobile.p);
  check(await mobile.p.locator('[data-maintenance="equip"]').isDisabled(), "Insufficient coins allow preview but block purchase");
  await mobile.p.locator('[data-maintenance="save"]').click();
  check(await mobile.p.evaluate(() => app.state.launcher.build.rack.endsWith("r01")), "Saving a locked preview never equips it");
  await mobile.p.evaluate(() => app.goTo("launcher")); await ready(mobile.p);
  check(await mobile.p.evaluate(() => {
    const el = document.querySelector(".maintenance-view");
    return el.scrollWidth <= el.clientWidth + 1;
  }), "Mobile workbench has no horizontal overflow");
  // Review F1: both drafts remain visible while crossing workbench modes.
  await mobile.p.locator('[data-maintenance="red"]').click();
  await mobile.p.locator('[data-workshop="care"]').click(); await ready(mobile.p);
  check((await mobile.p.locator(".maintenance-draft").innerText()).includes("装备未保存"),
    "F1: equipment dirty state remains visible in maintenance mode");
  await mobile.p.locator('[data-focus="transmission"]').click();
  await mobile.p.locator("#three-stage canvas").focus();
  await mobile.p.keyboard.press("Enter");
  check(await mobile.p.evaluate(() => app.maintenanceScreen.draft.launcher.some(s => s.zone === "transmission")),
    "Keyboard reticle applies oil to an actual transmission surface");
  await mobile.p.locator('[data-workshop="outfit"]').click(); await ready(mobile.p);
  const dirty = await mobile.p.locator(".maintenance-draft").innerText();
  check(dirty.includes("装备未保存") && dirty.includes("保养未保存"),
    "F1: maintenance and equipment dirty states remain visible together");
  await mobile.p.locator(".maintenance-draft").scrollIntoViewIfNeeded();
  await mobile.p.screenshot({ path: `${out}/mobile-dirty.png`, fullPage: true });
  // Review F2/F3: use a Tab/Enter path, preserving the selected node across async swaps.
  const tabTo = async selector => {
    for (let i = 0; i < 45; i++) {
      if (await mobile.p.locator(selector).evaluate(el => document.activeElement === el)) return;
      await mobile.p.keyboard.press("Tab");
    }
    throw new Error(`Keyboard cannot reach ${selector}`);
  };
  const focusIs = selector => mobile.p.locator(selector).evaluate(el => document.activeElement === el);
  await tabTo('[data-launcher-slot="transmission"]');
  await mobile.p.keyboard.press("Enter"); await ready(mobile.p);
  check(await focusIs('[data-launcher-slot="transmission"]'), "F2: slot activation retains keyboard focus");
  await tabTo('[data-launcher-part="launcher.transmission.t02"]');
  await mobile.p.keyboard.press("Enter"); await ready(mobile.p);
  check(await focusIs('[data-launcher-part="launcher.transmission.t02"]'), "F2: async preview retains keyboard focus");
  check(await mobile.p.locator('[data-launcher-part="launcher.transmission.t02"]').evaluate(el =>
    el.matches(":focus-visible") && parseFloat(getComputedStyle(el).outlineOffset) >= 2),
  "F3: selected button retains a visible separated focus outline");
  await mobile.p.screenshot({ path: `${out}/mobile-focus.png`, fullPage: true });
  await tabTo('[data-maintenance="trial"]');
  await mobile.p.keyboard.press("Enter");
  check(await focusIs('[data-maintenance="trial"]'), "F2: keyboard trial retains focus");
  await tabTo('[data-maintenance="save"]');
  await mobile.p.keyboard.press("Enter");
  check(await mobile.p.evaluate(() => app.screen === "assembly" && app.state.maintenance.launcher.length > 0 &&
    app.state.launcher.colors.accent === "#b83722" && app.state.launcher.build.transmission.endsWith("t01")),
  "Keyboard save commits both drafts but never the locked preview");
  await mobile.context.close();
  check(errors.length === 0, `No browser exceptions: ${errors.join("; ")}`);
  await writeFile(`${out}/browser.json`, JSON.stringify({ checks, linkage, saved, errors }, null, 2));
  console.log(`PASS: ${checks.length} launcher outfit/browser contracts`);
} finally { await browser.close(); }
