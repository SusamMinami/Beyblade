import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const out = resolve("../.impeccable/review/championship");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const base = process.env.LAB_TEST_URL ?? "http://127.0.0.1:5173";
const results = [], errors = [];
const check = (ok, label) => { assert.ok(ok, label); results.push(label); };
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.addInitScript(() => {
  if (!localStorage.getItem("spin-core-web-prototype-v2")) localStorage.setItem("spin-core-web-prototype-v2",
    JSON.stringify({ version: 2, tutorial: { completed: true, stage: "complete" }, lab: { xp: 120 } }));
});
const page = await context.newPage();
page.on("pageerror", e => errors.push(e.message));
page.on("console", e => { if (e.type() === "error") errors.push(e.text()); });
const ready = () => page.waitForFunction(() => document.querySelector("#three-stage")?.dataset.assetState === "ready");
try {
  await page.goto(`${base}/#map`);
  await page.locator('.arena-card[data-arena="metal"]').click();
  await ready();
  for (const period of ["day", "night"]) {
    await page.locator("#scene-time").selectOption(period);
    check(await page.locator("#three-stage").getAttribute("data-scene-period") === period,
      `${period} map lighting switches immediately`);
    await page.locator("#start-battle").click();
    await page.waitForFunction(() => !document.querySelector("#launch-button")?.disabled);
    for (const [size, viewport] of [
      ["desktop", { width: 1440, height: 1000 }], ["mobile", { width: 390, height: 844 }],
    ]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(750);
      check(await page.locator(".game-shell").getAttribute("data-arena") === "metal",
        `${period} ${size} retains the championship model`);
      await page.locator(".game-shell").screenshot({ path: `${out}/${period}-${size}.png` });
    }
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "No mobile horizontal overflow");
    await page.locator("#launch-button").click();
    await page.waitForFunction(() => document.querySelector("#launch-controls")?.classList.contains("is-hidden"));
    check(true, `${period} actual battle launches`);
    await page.waitForTimeout(750);
    await page.locator(".game-shell").screenshot({ path: `${out}/${period}-running-mobile.png` });
    await page.goto(`${base}/#map`);
    await ready();
  }
  await page.route("**/__championship-check", route => route.fulfill({
    contentType: "text/html",
    body: `<body style="margin:0"><div id="stage" style="width:564px;height:1000px"></div>
      <script type="module">
      import { ThreeStage } from '/src/render/three-stage.js';
      import { ARENAS } from '/src/data/arenas.js';
      import { DEFAULT_BUILD } from '/src/data/parts.js';
      import * as THREE from '/node_modules/three/build/three.module.js';
      window.stage = new ThreeStage(document.querySelector('#stage'));
      window.measure = { ARENAS, THREE, DEFAULT_BUILD };
      stage.setSceneTime('night'); stage.showArena(ARENAS.metal);
      </script></body>`,
  }));
  await page.setViewportSize({ width: 1000, height: 1000 });
  await page.goto(`${base}/__championship-check`);
  await page.waitForFunction(() => window.stage?.arenaReady);
  const measurements = await page.evaluate(async () => {
    const s = window.stage, a = s.championshipAtmosphere;
    const { THREE, ARENAS } = window.measure;
    s.camera.position.copy(s.desiredCameraPosition);
    s.cameraTarget.copy(s.desiredCameraTarget);
    s.update(0);
    const rt = new THREE.WebGLRenderTarget(282, 500);
    const pixels = () => {
      s.renderer.setRenderTarget(rt);
      s.renderer.render(s.scene, s.camera);
      const data = new Uint8Array(282 * 500 * 4);
      s.renderer.readRenderTargetPixels(rt, 0, 0, 282, 500, data);
      s.renderer.setRenderTarget(null);
      return data;
    };
    const diff = (x, y) => {
      let count = 0;
      for (let i = 0; i < x.length; i += 4)
        if (Math.abs(x[i]-y[i])+Math.abs(x[i+1]-y[i+1])+Math.abs(x[i+2]-y[i+2]) > 15) count++;
      return count;
    };
    const first = pixels();
    s.update(2);
    const movingPixels = diff(first, pixels());
    const snapshot = () => JSON.stringify([
      a.time, a.fixtures.map(f => [f.light.target.position.toArray(), f.head.quaternion.toArray(), f.light.intensity]),
      a.runners.map(r => r.material.uniforms.time.value),
    ]);
    const beforePause = snapshot();
    s.update(2, null, true);
    const paused = snapshot() === beforePause;
    s.reducedMotion = true;
    s.update(.1);
    const reducedStart = snapshot();
    s.update(3);
    const reduced = snapshot() === reducedStart;
    s.reducedMotion = false;
    s.update(0);
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    const hiddenStart = snapshot();
    s.update(2);
    const hidden = snapshot() === hiddenStart;
    delete document.hidden;
    // Hide beam meshes in both samples to prove the six real spots light metal.
    a.fixtures.forEach(f => { f.beam.visible = false; });
    const lit = pixels();
    a.fixtures.forEach(f => { f.light.visible = false; });
    const illuminatedPixels = diff(lit, pixels());
    a.fixtures.forEach(f => { f.light.visible = f.beam.visible = true; });
    const night = { beam: a.fixtures[0].beam.material.uniforms.strength.value,
      light: a.fixtures[0].light.intensity, runner: a.runners[0].material.uniforms.level.value };
    s.setSceneTime("day");
    const day = { beam: a.fixtures[0].beam.material.uniforms.strength.value,
      light: a.fixtures[0].light.intensity, runner: a.runners[0].material.uniforms.level.value };
    const dayReduced = Object.keys(day).every(k => day[k] < night[k]) && s.scenePeriod === "day";
    s.setSceneTime("night");
    s.update(0);
    const defaultSpotsDisabled = s.spotlights.every(l => !l.visible);
    const metalMaterial = s.arenaRoot.children.flatMap(c => c.children)
      .find(m => m.material?.name === "Arena satin titanium")?.material;
    const physicalMetal = !!metalMaterial?.isMeshPhysicalMaterial && metalMaterial.clearcoat > 0;
    const noShadowMaps = a.fixtures.every(f => !f.light.castShadow);
    const lightCount = a.fixtures.length;
    s.renderer.info.autoReset = false;
    s.renderer.info.reset();
    s.update(0);
    const drawCalls = s.renderer.info.render.calls, triangles = s.renderer.info.render.triangles;
    s.renderer.info.autoReset = true;
    rt.dispose();
    let beamReleased = false;
    a.fixtures[0].beam.geometry.addEventListener("dispose", () => { beamReleased = true; });
    const load = async arena => {
      s.showArena(arena);
      if (!s.arenaReady) await new Promise((resolve, reject) => {
        const cleanup = () => { clearTimeout(timer); s.container.removeEventListener("arenastatus", onStatus); };
        const timer = setTimeout(() => { cleanup(); reject(new Error("Arena load timeout")); }, 15000);
        const onStatus = e => {
          if (e.detail.state === "ready") { cleanup(); resolve(); }
          if (e.detail.state === "error") { cleanup(); reject(new Error(e.detail.message)); }
        };
        s.container.addEventListener("arenastatus", onStatus);
      });
      s.update(0);
    };
    await load(ARENAS.standard);
    const released = a.disposed && beamReleased && !a.root.parent && s.championshipAtmosphere === null;
    const standardRestored = !s.bloom.enabled && s.edgeLight.intensity === 1.3 && s.spotlights.every(l => l.visible);
    const baseline = { ...s.renderer.info.memory };
    for (let i = 0; i < 2; i++) { await load(ARENAS.metal); await load(ARENAS.standard); }
    const stableMemory = s.renderer.info.memory.geometries === baseline.geometries &&
      s.renderer.info.memory.textures === baseline.textures;
    s.destroy();
    return { movingPixels, illuminatedPixels, paused, reduced, hidden, dayReduced,
      defaultSpotsDisabled, physicalMetal, noShadowMaps, lightCount, released, standardRestored,
      stableMemory, drawCalls, triangles, day, night };
  });
  check(measurements.movingPixels > 100, "Sweep lights and runners change actual rendered pixels");
  check(measurements.illuminatedPixels > 100, "Moving spotlights illuminate the modeled surfaces");
  for (const key of ["paused", "reduced", "hidden", "dayReduced", "defaultSpotsDisabled",
    "physicalMetal", "noShadowMaps", "released", "standardRestored", "stableMemory"]) check(measurements[key], key);
  check(measurements.lightCount === 6, "Six authored moving fixtures");
  check(errors.length === 0, `No browser or WebGL errors: ${errors.join("; ")}`);
  await writeFile(`${out}/verification.json`, JSON.stringify({ results, measurements, errors }, null, 2));
  console.log(`PASS: ${results.length} championship checks`, measurements);
} finally {
  await browser.close();
}
