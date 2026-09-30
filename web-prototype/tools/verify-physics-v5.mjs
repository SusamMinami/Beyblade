import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const out = process.env.QA_OUTPUT_DIR ?? "../.impeccable/review/physics-v5";
const base = process.env.LAB_TEST_URL ?? "http://127.0.0.1:5173";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true, args: ["--autoplay-policy=no-user-gesture-required", "--no-sandbox"],
});
let checks = 0;
const errors = [];
const check = (value, label) => { assert.ok(value, label); checks++; };
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const name = viewport.width === 390 ? "mobile" : "desktop";
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    await context.addInitScript(() => localStorage.setItem("spin-core-web-prototype-v2", JSON.stringify({
      version: 2, coins: 700, sound: false,
      tutorial: { completed: true, stage: "complete", firstRewardClaimed: true },
    })));
    // Test-only reference for controlled runtime faults; shipping code has no hook.
    await context.route("**/src/main.js*", async route => {
      const response = await route.fetch();
      const source = await response.text();
      const body = source.replace('new BeybladeApp(document.querySelector("#app"));',
        'window.physicsFixture = new BeybladeApp(document.querySelector("#app"));');
      assert.notEqual(body, source, "fixture attached to current app entry");
      await route.fulfill({ response, body });
    });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${base}/#collection`);
    await page.locator(".collection-loading").waitFor({ state: "hidden" });
    const measurementButton = page.locator('[data-collection="measurements"]');
    await measurementButton.click();
    const dialog = page.locator(".collection-stage-dialog");
    check((await dialog.textContent()).includes("自由转时") &&
      (await dialog.textContent()).includes("基础发射器 · 无保养"), `${name}: collection exposes real measurements and conditions`);
    const dialogFits = await dialog.evaluate(node => {
      const r = node.getBoundingClientRect();
      return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight;
    });
    check(dialogFits, `${name}: measurement dialog fits viewport`);
    await page.locator(".game-shell").screenshot({ path: `${out}/measurements-${name}.png` });
    await page.keyboard.press("Escape");
    check(!(await dialog.isVisible()) && await measurementButton.evaluate(node => node === document.activeElement),
      `${name}: measurement dialog closes and restores keyboard focus`);
    await page.locator('[data-collection="assembly"]').click();
    await page.locator("#assembly-comparison > summary").click();
    await page.locator(".measurement-details > summary").click();
    check(await page.locator("#build-measurements").isVisible() &&
      (await page.locator(".measurement-details").textContent()).includes("无操控/碰撞/供能") &&
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    `${name}: assembly conditions are discoverable and fit viewport`);
    await page.locator(".game-shell").screenshot({ path: `${out}/assembly-${name}.png` });
    await page.goto(`${base}/#journey`);
    await page.locator("#start-battle").click();
    await page.waitForFunction(() => !document.querySelector("#launch-button").disabled, null, { timeout: 30000 });
    const pose = await page.evaluate(async () => {
      const app = window.physicsFixture, stage = app.stage;
      const THREE = await import("/node_modules/three/build/three.module.js");
      const { launcherLaunchState } = await import("/src/core/launcher-physics.js");
      app.launchParams.angle = .8; app.launchParams.direction = .4;
      app._updateLaunchOutputs();
      const initial = launcherLaunchState(app.simulation.player.build, app.simulation.launchers.player,
        { ...app.launchParams, speedScale: app.simulation.tuning.speedScale }, app.simulation.player.oil);
      const arrow = new THREE.Vector3(0, 1, 0).applyQuaternion(stage.launchVectorArrow.quaternion);
      const expected = new THREE.Vector3(initial.velocity.x, 0, initial.velocity.y).normalize();
      let error = 0, angleError = 0;
      for (let phase = 0; phase < Math.PI * 2; phase += .2) {
        const state = { ...initial, spinPhase: phase, position: { x: 0, y: 4.45 } };
        stage._positionTop(stage.playerTop, state);
        stage.playerTop.updateMatrixWorld(true);
        const tip = new THREE.Vector3(0, -stage.playerTop.userData.contactOffset, 0);
        stage.playerTop.localToWorld(tip);
        error = Math.max(error, Math.abs(tip.x), Math.abs(tip.z - 4.45),
          Math.abs(tip.y - stage.playerTop.userData.groundHeight - .012));
        const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(stage.playerTop.quaternion);
        angleError = Math.max(angleError, Math.abs(Math.acos(axis.y) - initial.tilt));
      }
      stage.updateLauncherPreview(app.launchParams);
      return { aligned: arrow.dot(expected), error, angleError };
    });
    check(pose.aligned > .999999 && pose.error < 1e-8 && pose.angleError < 1e-8, `${name}: real arrow and grounded pose match solver`);
    await page.locator("#launch-button").click();
    await page.locator("#launch-controls").waitFor({ state: "hidden" });
    await page.keyboard.down("d");
    await page.waitForFunction(() => Number(document.querySelector("#battle-time").textContent) > .3);
    await page.keyboard.up("d");
    const audio = await page.evaluate(() => {
      const app = window.physicsFixture;
      app.audio.setEnabled(true);
      for (let i = 0; i < 8; i++) {
        app.audio.playRisk("ring_out_risk", "warning");
        app.audio.playRisk("spin_risk", "critical");
        app.audio.playRisk("stability", "critical");
        app.audio.playCollision(.4);
      }
      const normal = app.audio.playRisk;
      app.audio.playRisk = () => { throw new Error("injected optional audio fault"); };
      app.simulation.events = [{ type: "spin_risk", actor: "player", state: "warning" }];
      app._processEvents();
      app.audio.playRisk = normal;
      return { ready: app.audio.ready, isolated: app.audioError === "injected optional audio fault",
        time: app.simulation.time };
    });
    check(audio.ready && audio.isolated, `${name}: real Tone repeated scheduling and injected failure`);
    await page.waitForFunction(time => window.physicsFixture.simulation.time > time + .2, audio.time);
    check(true, `${name}: RAF and physics continue after audio failure`);
    await page.locator(".game-shell").screenshot({ path: `${out}/running-${name}.png` });
    await page.locator("#pause-battle").click();
    await page.locator(".game-shell").screenshot({ path: `${out}/paused-${name}.png` });
    const before = await page.evaluate(() => {
      const app = window.physicsFixture;
      // First-battle draw fixture tests reward/progression alongside campaign finish objective.
      app.state.tutorial = { completed: false, stage: "first_battle", firstRewardClaimed: false };
      for (const [i, top] of [app.simulation.player, app.simulation.enemy].entries()) {
        top.spin = 0; top.velocity = { x: 0, y: 0 }; top.position = { x: i ? 3 : -3, y: 0 };
      }
      return { coins: app.state.coins, complete: app.state.campaign.completed.length,
        journal: app.state.campaign.journal.length };
    });
    await page.locator("#pause-resume").click();
    await page.locator("#result-card:not(.is-hidden)").waitFor({ timeout: 15000 });
    check((await page.locator("#result-title").textContent()).includes("平局"), `${name}: draw shown`);
    check((await page.locator("#result-cause").textContent()).includes("你停转，对手停转") &&
      (await page.locator("#result-reward-status").textContent()) === "平局不发放赏金",
    `${name}: draw explains elimination and does not claim payout`);
    const settled = await page.evaluate(() => {
      const app = window.physicsFixture;
      return { coins: app.state.coins, tutorial: app.state.tutorial,
        complete: app.state.campaign.completed.length, journal: app.state.campaign.journal.length,
        winner: app.simulation.result.winner, width: document.documentElement.scrollWidth <= innerWidth,
        saved: JSON.parse(localStorage.getItem("spin-core-web-prototype-v2")).battleNotes };
    });
    check(settled.coins === before.coins && !settled.tutorial.firstRewardClaimed &&
      settled.tutorial.stage === "first_battle", `${name}: draw does not grant or advance training`);
    check(settled.complete === before.complete && settled.journal === before.journal + 1,
      `${name}: draw records journal without campaign clear`);
    check(settled.width && Object.values(settled.saved).some(n => n.winner === "draw"), `${name}: saved draw and bounded layout`);
    await page.locator(".game-shell").screenshot({ path: `${out}/draw-${name}.png` });
    await page.locator("#result-restart").click();
    await page.locator("#launch-controls:not(.is-hidden)").waitFor();
    check(await page.locator("#launch-button").isVisible(), `${name}: rematch reaches launch`);
    await context.close();
  }
  check(errors.length === 0, errors.join("\n"));
  await writeFile(`${out}/browser.json`, JSON.stringify({ checks, errors }, null, 2));
  console.log(`PASS ${checks}: measurements, real launch/pose/audio, frame continuity, draw economy and rematch`);
} finally {
  await browser.close();
}
