import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const out = resolve("../.impeccable/review/street-scale");
const layout = JSON.parse(await readFile(resolve("../resources/battle_worlds/street_layout.json"), "utf8"));
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const base = process.env.LAB_TEST_URL ?? "http://127.0.0.1:5173";
const results = [];
const check = (ok, name) => { assert.ok(ok, name); results.push(name); };
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.addInitScript(() => {
  if (!localStorage.getItem("spin-core-web-prototype-v2")) localStorage.setItem("spin-core-web-prototype-v2", JSON.stringify({
    version: 2, tutorial: { completed: true, stage: "complete" }, lab: { xp: 120 },
  }));
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", e => errors.push(e.message));
page.on("console", e => { if (e.type() === "error") errors.push(e.text()); });
try {
  await page.goto(`${base}/#map`);
  await page.locator('.arena-card[data-arena="street"]').click();
  await page.waitForFunction(() => document.querySelector("#three-stage")?.dataset.assetState === "ready");
  const ownership = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("spin-core-web-prototype-v2"));
    return JSON.stringify([state.loadouts, state.coins, state.ownedParts, state.lab, state.campaign]);
  });
  for (const period of ["day", "night"]) {
    await page.locator("#scene-time").selectOption(period);
    check(await page.locator("#three-stage").getAttribute("data-scene-period") === period,
      `${period} changes the map atmosphere immediately`);
    await page.reload();
    await page.waitForFunction(() => document.querySelector("#three-stage")?.dataset.assetState === "ready");
    check(await page.locator("#scene-time").inputValue() === period, `${period} survives reload`);
    for (const [size, viewport] of [
      ["desktop", { width: 1440, height: 1000 }], ["mobile", { width: 390, height: 844 }],
    ]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(1000);
      check(await page.locator(".game-shell").getAttribute("data-arena") === "street",
        `${period} ${size} resize preserves the selected street map`);
      await page.locator(".game-shell").screenshot({ path: `${out}/${period}-map-${size}.png` });
    }
    await page.locator("#start-battle").click();
    await page.waitForFunction(() => !document.querySelector("#launch-button")?.disabled);
    check(await page.locator("#three-stage").getAttribute("data-scene-period") === period,
      `${period} carries into battle`);
    for (const [size, viewport] of [
      ["desktop", { width: 1440, height: 1000 }], ["mobile", { width: 390, height: 844 }],
    ]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(1000);
      check(await page.locator(".game-shell").getAttribute("data-screen") === "battle",
        `${period} ${size} capture is the loaded battle`);
      await page.locator(".game-shell").screenshot({ path: `${out}/${period}-${size}.png` });
    }
    if (period === "day") {
      await page.goto(`${base}/#map`);
      await page.waitForFunction(() => document.querySelector("#three-stage")?.dataset.assetState === "ready");
    }
  }
  check(await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("spin-core-web-prototype-v2"));
    return JSON.stringify([state.loadouts, state.coins, state.ownedParts, state.lab, state.campaign]);
  }) === ownership, "Period changes preserve loadouts, coins, ownership and progress");
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Mobile has no horizontal overflow");
  await page.locator("#launch-button").click();
  await page.waitForFunction(() => document.querySelector("#launch-controls")?.classList.contains("is-hidden"));
  check(true, "Detailed street launches through the real UI");

  // Isolated renderer harness exercises time, resources and actual offscreen
  // pixels without a production debug API or changing the player's save.
  await page.route("**/__street-check", route => route.fulfill({
    contentType: "text/html",
    body: `<html><body style="margin:0;background:#142635"><div id="stage" style="width:564px;height:1000px"></div>
      <script type="module">
        import { ThreeStage } from '/src/render/three-stage.js';
        import { ARENAS } from '/src/data/arenas.js';
        import * as THREE from '/node_modules/three/build/three.module.js';
        import { DEFAULT_BUILD } from '/src/data/parts.js';
        import { createTopModel, disposeTopModel } from '/src/render/top-model.js';
        import { resolveSceneTime, normalizeSceneTime } from '/src/render/scene-time.js';
        const layout = ${JSON.stringify(layout)};
        window.stage = new ThreeStage(document.querySelector('#stage'));
        window.arenas = ARENAS;
        window.measure = { THREE, DEFAULT_BUILD, createTopModel, disposeTopModel,
          resolveSceneTime, normalizeSceneTime, layout };
        stage.setSceneTime("night");
        stage.showArena(ARENAS.street);
      </script></body></html>`,
  }));
  await page.setViewportSize({ width: 1000, height: 1000 });
  await page.goto(`${base}/__street-check`);
  await page.waitForFunction(() => window.stage?.arenaReady);
  const measurements = await page.evaluate(async () => {
    const s = window.stage;
    s.camera.position.copy(s.desiredCameraPosition);
    s.cameraTarget.copy(s.desiredCameraTarget);
    s.update(0);
    const a = s.streetAtmosphere;
    const { THREE, DEFAULT_BUILD, createTopModel, disposeTopModel, layout,
      resolveSceneTime, normalizeSceneTime } = window.measure;
    const top = createTopModel(DEFAULT_BUILD, { ring: "#27c9b3", core: "#efbd3c" });
    top.scale.setScalar(.92);
    const topWidth = new THREE.Box3().setFromObject(top).getSize(new THREE.Vector3()).x;
    disposeTopModel(top);
    const doorRatio = layout.measurements["Door deep recess"][1] / topWidth;
    const wheelRatio = layout.measurements["Bicycle rubber tyre"][1] / topWidth;
    const scaleCorrect = doorRatio > 32 && doorRatio < 37 && wheelRatio > 10 && wheelRatio < 12;
    const bowlUnchanged = layout.measurements["Combat dish"][0] === 13.4 &&
      window.arenas.street.wallRadius === window.arenas.standard.wallRadius &&
      window.arenas.street.bowlForce === window.arenas.standard.bowlForce &&
      window.arenas.street.surfaceAt(0) === window.arenas.standard.surfaceAt(0);
    const automaticTime = [5, 6, 17, 18].map(hour =>
      resolveSceneTime("auto", new Date(2026, 8, 16, hour))).join() === "night,day,day,night" &&
      normalizeSceneTime("bad") === "auto";
    const rt = a.puddles.getRenderTarget();
    const sample = () => {
      const data = new Uint16Array(rt.width * rt.height * 4);
      s.renderer.readRenderTargetPixels(rt, 0, 0, rt.width, rt.height, data);
      return data;
    };
    const before = sample();
    const model = s.arenaRoot.children.find(child => child !== s.driveZoneModel);
    model.visible = false;
    s.update(0);
    const without = sample();
    model.visible = true;
    s.update(0);
    let changed = 0;
    for (let i = 0; i < before.length; i += 4) {
      if (Math.abs(before[i] - without[i]) > 64) changed++;
    }
    const first = a.materials.map(({ material }) => material.emissiveIntensity);
    s.update(.5);
    const animated = a.materials.some(({ material }, i) => material.emissiveIntensity !== first[i]);
    const clock = a.time;
    const pausedLevels = a.materials.map(({ material }) => material.emissiveIntensity);
    s.update(1, null, true);
    const paused = a.time === clock && a.materials.every(({ material }, i) => material.emissiveIntensity === pausedLevels[i]);
    s.reducedMotion = true;
    s.update(1);
    const reducedClock = a.time;
    s.update(1);
    const reduced = a.time === reducedClock && a.puddles.material.uniforms.time.value === 0 &&
      a.materials.every(({ material, base }) => material.emissiveIntensity === base);
    s.reducedMotion = false;
    const nightEnvironment = s.scene.environment;
    const nightPlastic = a.plastics[0].envMap;
    const nightSun = s.keyLight.position.clone();
    s.setSceneTime("day");
    await Promise.all([...s.preparations]);
    const dayMaterials = a.materials.every(({ material, base }) => material.emissiveIntensity < base * .08);
    const dayEnvironment = s.scene.environment !== nightEnvironment && a.plastics[0].envMap !== nightPlastic &&
      !s.keyLight.position.equals(nightSun) && s.scenePeriod === "day";
    s.update(0);
    s.setSceneTime("night");
    await Promise.all([...s.preparations]);
    s.renderer.info.autoReset = false;
    s.renderer.info.reset();
    s.update(0);
    const submittedTriangles = s.renderer.info.render.triangles;
    const drawCalls = s.renderer.info.render.calls;
    s.renderer.info.autoReset = true;
    let disposedTarget = false;
    rt.addEventListener("dispose", () => { disposedTarget = true; });
    s.showArena(window.arenas.standard);
    await Promise.all([...s.preparations]);
    s.update(0);
    const released = a.disposed && disposedTarget && !a.root.parent && s.streetAtmosphere === null;
    const standardLights = s.edgeLight.intensity === 1.3 && !s.bloom.enabled;
    const baseline = { ...s.renderer.info.memory };
    // Re-enter the actual loader twice; GPU counts should return to baseline.
    for (let i = 0; i < 2; i++) {
      s.showArena(window.arenas.street);
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { cleanup(); reject(new Error("Street reload timeout")); }, 15000);
        const onStatus = e => {
          if (e.detail.state === "ready") { cleanup(); resolve(); }
          if (e.detail.state === "error") { cleanup(); reject(new Error(e.detail.message)); }
        };
        const cleanup = () => { clearTimeout(timeout); s.container.removeEventListener("arenastatus", onStatus); };
        s.container.addEventListener("arenastatus", onStatus);
      });
      s.update(0);
      s.showArena(window.arenas.standard);
      await Promise.all([...s.preparations]);
      s.update(0);
    }
    const stableMemory = s.renderer.info.memory.geometries === baseline.geometries &&
      s.renderer.info.memory.textures === baseline.textures;
    const allMapPeriods = [];
    for (const arena of Object.values(window.arenas)) {
      s.setSceneTime("day");
      s.showArena(arena);
      if (!s.arenaReady) await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { cleanup(); reject(new Error("Map timeout")); }, 15000);
        const onStatus = e => {
          if (e.detail.state === "ready") { cleanup(); resolve(); }
          if (e.detail.state === "error") { cleanup(); reject(new Error(e.detail.message)); }
        };
        const cleanup = () => { clearTimeout(timeout); s.container.removeEventListener("arenastatus", onStatus); };
        s.container.addEventListener("arenastatus", onStatus);
      });
      s.update(0);
      allMapPeriods.push(s.arenaReady && s.scenePeriod === "day");
    }
    s.prepareBattle(window.arenas.street, DEFAULT_BUILD, DEFAULT_BUILD, { ring: "#27c9b3", core: "#efbd3c" });
    s.setSceneTime("night");
    const battlePeriodFixed = s.scenePeriod === "day";
    const targets = Object.values(s.outdoorEnvironments);
    let releasedEnvironments = 0;
    targets.forEach(target => target.addEventListener("dispose", () => releasedEnvironments++));
    s.destroy();
    return { changed, animated, paused, reduced, released, standardLights, stableMemory,
      submittedTriangles, drawCalls, reflectionSize: rt.width, topWidth, doorRatio, wheelRatio,
      scaleCorrect, bowlUnchanged, automaticTime, dayMaterials, dayEnvironment,
      allMapPeriods: allMapPeriods.every(Boolean), battlePeriodFixed,
      releasedEnvironments: releasedEnvironments === targets.length };
  });
  check(measurements.changed > 400, "Reflection target contains the actual rendered model");
  for (const key of ["animated", "paused", "reduced", "released", "standardLights", "stableMemory",
    "scaleCorrect", "bowlUnchanged", "automaticTime", "dayMaterials", "dayEnvironment",
    "allMapPeriods", "battlePeriodFixed", "releasedEnvironments"]) {
    check(measurements[key], key);
  }
  check(errors.length === 0, `No browser / WebGL errors: ${errors.join("; ")}`);
  await writeFile(`${out}/verification.json`, JSON.stringify({ results, measurements, errors }, null, 2));
  console.log(`PASS: ${results.length} street checks`, measurements);
} finally {
  await browser.close();
}
