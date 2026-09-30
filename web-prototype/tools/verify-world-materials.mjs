import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const out = resolve("../.impeccable/review/world-materials");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const base = process.env.LAB_TEST_URL ?? "http://127.0.0.1:5173";
const results = [], errors = [];
const check = (value, label) => { assert.ok(value, label); results.push(label); };
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.route("**/__world-materials", route => route.fulfill({
    contentType: "text/html",
    body: `<html><body style="margin:0"><div id="stage" style="width:506px;height:900px"></div>
      <script type="module">
        import { ThreeStage } from '/src/render/three-stage.js';
        import { ARENAS } from '/src/data/arenas.js';
        import * as THREE from '/node_modules/three/build/three.module.js';
        window.stage = new ThreeStage(document.querySelector('#stage'));
        window.arenas = ARENAS; window.THREE = THREE;
        stage.setSceneTime("night"); stage.showArena(ARENAS.ruins);
      </script></body></html>`,
  }));
  await page.goto(`${base}/__world-materials`);
  await page.waitForFunction(() => window.stage?.arenaReady);
  const measurements = await page.evaluate(async () => {
    const s = window.stage;
    const wait = async () => {
      if (!s.arenaReady) await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { cleanup(); reject(new Error("Arena timeout")); }, 20000);
        const listener = event => {
          if (event.detail.state === "ready") { cleanup(); resolve(); }
          else if (event.detail.state === "error") { cleanup(); reject(new Error(event.detail.message)); }
        };
        const cleanup = () => { clearTimeout(timeout); s.container.removeEventListener("arenastatus", listener); };
        s.container.addEventListener("arenastatus", listener);
      });
      await Promise.all([...s.preparations]);
      s.camera.position.copy(s.desiredCameraPosition);
      s.cameraTarget.copy(s.desiredCameraTarget);
      s.update(0);
    };
    const target = new THREE.WebGLRenderTarget(360, 640);
    const sample = () => {
      const previous = s.renderer.getRenderTarget();
      const pixels = new Uint8Array(target.width * target.height * 4);
      try {
        s.renderer.setRenderTarget(target);
        s.renderer.render(s.scene, s.camera);
        s.renderer.readRenderTargetPixels(target, 0, 0, target.width, target.height, pixels);
      } finally { s.renderer.setRenderTarget(previous); }
      return pixels;
    };
    const difference = (a, b) => {
      let pixels = 0;
      for (let i = 0; i < a.length; i += 4) {
        if (Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]) > 6) pixels++;
      }
      return pixels;
    };
    const report = {};
    for (const id of ["ruins", "street"]) {
      if (s.activeArena.id !== id) s.showArena(window.arenas[id]);
      await wait();
      const materials = new Set();
      s.arenaRoot.traverse(mesh => { if (mesh.material?.userData.worldSurface) materials.add(mesh.material); });
      const physical = [...materials].filter(material => material.isMeshPhysicalMaterial);
      const lit = sample();
      const env = [...materials].map(material => material.envMapIntensity);
      materials.forEach(material => { material.envMapIntensity = 0; });
      const reflectionPixels = difference(lit, sample());
      [...materials].forEach((material, i) => { material.envMapIntensity = env[i]; });
      // Compare with only normal relief removed, preserving base colors,
      // roughness, lights, camera, and geometry in this isolated harness.
      const callbacks = [...materials].map(material => ({
        compile: material.onBeforeCompile, key: material.customProgramCacheKey,
      }));
      [...materials].forEach((material, i) => {
        material.onBeforeCompile = shader => {
          callbacks[i].compile(shader);
          shader.fragmentShader = shader.fragmentShader
            .replace("normal = surfaceRelief(normal, surfaceHeight);", "")
            .replace("clearcoatNormal = surfaceRelief(clearcoatNormal, surfaceHeight*.18);", "");
        };
        material.customProgramCacheKey = () => `${callbacks[i].key()}-qa-no-relief`;
        material.needsUpdate = true;
      });
      const reliefPixels = difference(lit, sample());
      [...materials].forEach((material, i) => {
        material.onBeforeCompile = callbacks[i].compile;
        material.customProgramCacheKey = callbacks[i].key;
        material.needsUpdate = true;
      });
      const atmosphere = id === "ruins" ? s.ruinsAtmosphere : s.streetAtmosphere;
      const levels = atmosphere.luminaires.map(({ light }) => light.intensity);
      atmosphere.luminaires.forEach(({ light }) => { light.intensity = 0; });
      const localLightPixels = difference(lit, sample());
      atmosphere.luminaires.forEach(({ light }, i) => { light.intensity = levels[i]; });
      const night = sample();
      s.setSceneTime("day");
      await wait();
      const dayPixels = difference(night, sample());
      s.setSceneTime("night");
      await wait();
      s.reducedMotion = true;
      s.update(0);
      const still = sample();
      s.update(1);
      const reducedMotion = difference(still, sample()) === 0;
      s.reducedMotion = false;
      s.update(0);
      const paused = sample();
      s.update(1, null, true);
      const pauseStable = difference(paused, sample()) === 0;
      report[id] = {
        materialCount: materials.size, physicalCount: physical.length,
        physicalDefines: physical.every(material => "PHYSICAL" in material.defines),
        reflectionPixels, reliefPixels, localLightPixels, dayPixels, reducedMotion, pauseStable,
        noExtraShadows: atmosphere.luminaires.every(({ light }) => !light.castShadow),
      };
    }
    target.dispose();
    // Warm shared day/night environments before establishing the release
    // baseline; only these shared caches are retained across scene exits.
    s.showArena(window.arenas.standard);
    await wait();
    const baseline = { ...s.renderer.info.memory };
    const released = [];
    for (let cycle = 0; cycle < 2; cycle++) {
      for (const id of ["ruins", "street"]) {
        s.showArena(window.arenas[id]);
        await wait();
        const atmosphere = s[`${id}Atmosphere`];
        s.showArena(window.arenas.standard);
        await wait();
        released.push(atmosphere.disposed && !atmosphere.root.parent &&
          s.renderer.info.memory.geometries === baseline.geometries &&
          s.renderer.info.memory.textures === baseline.textures);
      }
    }
    report.releaseStable = released.every(Boolean);
    report.baseline = baseline;
    s.destroy();
    return report;
  });
  await writeFile(`${out}/measurements.json`, JSON.stringify({ measurements, errors }, null, 2));
  for (const id of ["ruins", "street"]) {
    const m = measurements[id];
    check(m.physicalCount >= 3 && m.physicalDefines, `${id}: physical materials use physical shader definitions`);
    check(m.reliefPixels > 500, `${id}: surface normals visibly affect light response`);
    check(m.reflectionPixels > 500, `${id}: environment reflections affect rendered pixels`);
    check(m.localLightPixels > 500, `${id}: local lights illuminate the actual model`);
    check(m.dayPixels > 5000, `${id}: daylight and night remain distinct`);
    check(m.reducedMotion && m.pauseStable, `${id}: reduced motion and pause freeze the rendered scene`);
    check(m.noExtraShadows, `${id}: local lights add no shadow maps`);
  }
  check(measurements.releaseStable, "Repeated switches release local lighting, materials and reflection resources");
  check(!errors.length, `No browser or shader errors: ${errors.join("; ")}`);
  await writeFile(`${out}/verification.json`, JSON.stringify({ results, measurements, errors }, null, 2));
  console.log(`PASS: ${results.length} material checks`, measurements);
} finally {
  await browser.close();
}
