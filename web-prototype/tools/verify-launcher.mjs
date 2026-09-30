import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const out = "../.impeccable/review/launcher";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const base = process.env.LAB_TEST_URL ?? "http://127.0.0.1:5173";
const checks = [], errors = [], memories = [];
const check = (ok, name) => { assert.ok(ok, name); checks.push(name); };
async function open() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(() => localStorage.setItem("spin-core-web-prototype-v2",
    JSON.stringify({ version: 2, sound: false, tutorial: { completed: true, stage: "complete" } })));
  const page = await context.newPage();
  page.on("pageerror", e => errors.push(e.message));
  await page.route(/\/src\/main\.js(\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace(
      'new BeybladeApp(document.querySelector("#app"));',
      'window.app = new BeybladeApp(document.querySelector("#app"));') });
  });
  return { page, context };
}
const ready = page => page.waitForFunction(() => window.app?.stage?.arenaReady, null, { timeout: 30000 });
try {
  const { page, context } = await open();
  await page.goto(`${base}/#map`);
  await ready(page);
  await page.evaluate(() => {
    app.stage.cancelBattleWarmup();
    window.beforeLaunchState = JSON.stringify(app.state);
    app.goTo("battle");
  });
  await ready(page);
  const model = await page.evaluate(() => {
    const root = app.stage.launcherRoot.children[0];
    const meshes = [];
    root.traverse(o => {
      if (o.isMesh) meshes.push({ name: o.material.name,
        metalness: o.material.metalness, roughness: o.material.roughness,
        opacity: o.material.opacity, depthWrite: o.material.depthWrite,
        triangles: (o.geometry.index?.count ?? o.geometry.attributes.position.count)/3 });
    });
    return { name: root.name, meshes, crown: app.stage.launcherCrownHeight };
  });
  check(model.name === "GearDriveLauncher", "Actual battle mounts the Blender GLB");
  check(model.meshes.length >= 45 && model.meshes.length <= 65, "Articulated assembly preserves independent gears, fork, cam and dogs");
  check(model.meshes.find(m => m.name.includes("Steel")).metalness > .8 &&
    model.meshes.find(m => m.name.includes("TPE")).roughness > .8 &&
    model.meshes.find(m => m.name.includes("Ivory")).metalness === 0,
  "Steel, rubber and moulded plastic retain distinct PBR responses");
  const cover = model.meshes.find(m => m.name.includes("Smoked_PC"));
  check(cover.opacity < .3 && !cover.depthWrite, "Inspection lid reveals internal geometry without opaque depth occlusion");
  check(model.crown > .2 && model.crown < 1.5, "Attachment is measured from the real equipped crown");
  const manifest = JSON.parse(await readFile("../resources/launcher/performance/parts.json", "utf8"));
  check(manifest.assembly.runtime.bytes < 2000000 && manifest.assembly.runtime.triangles < 75000,
    "Articulated launcher stays within 2 MB / 75k triangle budget");

  await page.locator(".game-shell").screenshot({ path: `${out}/battle-desktop.png` });
  const alignment = await page.evaluate(async () => {
    const THREE = await import("/node_modules/three/build/three.module.js");
    const s = app.stage, distances = [];
    for (const [direction,angle,height] of [[0,0,0],[-1.1,.42,1],[1.1,-.42,.45]]) {
      s.updateLauncherPreview({ direction,angle,height });
      s.launcherRoot.updateMatrixWorld(true);
      const mount = s.launcherRoot.children[0].userData.topMount.clone();
      s.launcherRoot.localToWorld(mount);
      const crown = new THREE.Vector3(0,s.launcherCrownHeight+.012+height*.022,0)
        .applyQuaternion(s.playerTop.quaternion).add(s.playerTop.position);
      distances.push(mount.distanceTo(crown));
    }
    s.updateLauncherPreview(app.launchParams);
    return distances;
  });
  check(alignment.every(d => d < 1e-6), "Socket follows crown at both direction and tilt extremes");

  const handle = await page.evaluate(() => {
    const s = app.stage, p = s.launchVectorHandle.position.clone().project(s.camera);
    const r = s.renderer.domElement.getBoundingClientRect();
    return { x:r.x+(p.x+1)*.5*r.width, y:r.y+(1-p.y)*.5*r.height,
      power:app.launchParams.power, direction:app.launchParams.direction };
  });
  await page.mouse.move(handle.x, handle.y);
  await page.mouse.down();
  await page.mouse.move(handle.x+42, handle.y+15, { steps: 8 });
  await page.mouse.up();
  check(await page.evaluate(before => Math.abs(app.launchParams.direction-before.direction) > .01 ||
    Math.abs(app.launchParams.power-before.power) > .01, handle),
  "Dragging the real arrow still changes launch direction/power");

  // Isolate only the new asset for high-resolution Web material inspection.
  await page.evaluate(() => {
    const s = app.stage;
    window.savedCamera = { position:s.camera.position.clone(), target:s.desiredCameraTarget.clone(),
      desired:s.desiredCameraPosition.clone(), fov:s.camera.fov };
    s.cancelBattleWarmup();
    const p = s.launcherRoot.position;
    s.camera.position.set(p.x+4,p.y+6.8,p.z+7.8);
    s.desiredCameraPosition.copy(s.camera.position);
    s.desiredCameraTarget.set(p.x+.4,p.y,p.z+.4);
    s.cameraTarget.copy(s.desiredCameraTarget);
    s.camera.lookAt(s.cameraTarget);
  });
  await page.locator(".game-shell").screenshot({ path: `${out}/web-closeup.png` });
  await page.evaluate(() => {
    const s = app.stage;
    s.camera.position.copy(savedCamera.position);
    s.desiredCameraPosition.copy(savedCamera.desired);
    s.desiredCameraTarget.copy(savedCamera.target);
    s.cameraTarget.copy(savedCamera.target);
    s.camera.lookAt(savedCamera.target);
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".game-shell").screenshot({ path: `${out}/battle-mobile.png` });
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    "Mobile launch screen has no horizontal overflow");
  await page.locator("#launch-button").click();
  await page.waitForFunction(() => app.simulation.phase === "running");
  check(await page.evaluate(() => !app.stage.launcherRoot.visible && !app.stage.launchVectorRoot.visible),
    "Launch releases the equipped top and clears the launcher/aiming arrow");
  await page.locator(".game-shell").screenshot({ path: `${out}/released-mobile.png` });

  await page.setViewportSize({ width: 1440, height: 1000 });
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => app.goTo("map"));
    await ready(page);
    await page.evaluate(() => { app.stage.cancelBattleWarmup(); app.goTo("battle"); });
    await ready(page);
    await page.evaluate(() => { app.goTo("map"); app.stage.cancelBattleWarmup(); });
    await ready(page);
    await page.evaluate(async () => {
      app.stage.cancelBattleWarmup();
      await Promise.allSettled([...app.stage.preparations]);
      app.stage._renderFrame(0);
    });
    memories.push(await page.evaluate(() => ({ ...app.stage.renderer.info.memory })));
  }
  console.log("Released GPU resources", JSON.stringify(memories));
  check(memories.every(m => m.geometries === memories[0].geometries && m.textures === memories[0].textures),
    "Repeated battle entry/exit releases launcher GPU allocations");
  await context.close();

  // A separate cache proves that neither a failed nor late GLB can silently
  // enable launch, or repopulate a scene that the player has already left.
  const failure = await open();
  await failure.page.route(/\/launcher-performance\.glb(\?.*)?$/, route =>
    route.request().resourceType() === "fetch" ? route.abort() : route.continue());
  await failure.page.goto(`${base}/#map`);
  await ready(failure.page);
  await failure.page.evaluate(() => app.goTo("battle"));
  await failure.page.waitForFunction(() => document.querySelector("#three-stage").dataset.assetState === "error");
  check(await failure.page.locator("#launch-button").isDisabled(), "Missing launcher blocks launch with the existing asset error");
  await failure.page.unroute(/\/launcher-performance\.glb(\?.*)?$/);
  await failure.page.evaluate(() => { app.goTo("map"); app.stage.cancelBattleWarmup(); app.goTo("battle"); });
  await ready(failure.page);
  check(await failure.page.evaluate(() => app.stage.launcherRoot.children[0]?.name === "GearDriveLauncher"),
    "Failed GLB requests are retried on re-entry");
  await failure.context.close();

  const late = await open();
  let unblock, arrived;
  const gate = new Promise(resolve => { unblock = resolve; });
  const requested = new Promise(resolve => { arrived = resolve; });
  await late.page.route(/\/launcher-performance\.glb(\?.*)?$/, async route => {
    // Vite's ?import&url JS module must load; delay only the binary fetch.
    if (route.request().resourceType() !== "fetch") return route.continue();
    arrived();
    await gate;
    await route.continue();
  });
  await late.page.goto(`${base}/#map`);
  await ready(late.page);
  await late.page.evaluate(() => { app.stage.cancelBattleWarmup(); app.goTo("battle"); });
  await requested;
  await late.page.evaluate(() => {
    window.pendingLauncher = app.stage.launcherLoadTask;
    app.goTo("map");
    app.stage.cancelBattleWarmup();
  });
  unblock();
  await late.page.evaluate(() => pendingLauncher);
  check(await late.page.evaluate(() => app.stage.mode === "map" && app.stage.launcherRoot.children.length === 0),
    "Leaving during download discards the stale launcher");
  await late.context.close();
  check(errors.length === 0, `No page exceptions: ${errors.join("; ")}`);
  await writeFile(`${out}/verification.json`, JSON.stringify({ checks, model, manifest, alignment, memories, errors }, null, 2));
  console.log(`PASS: ${checks.length} launcher checks`);
} finally {
  await browser.close();
}
