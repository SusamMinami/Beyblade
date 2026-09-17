import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const base = process.env.LAB_TEST_URL ?? "http://127.0.0.1:5173";
const checks = [];
const check = (ok, label) => { assert.ok(ok, label); checks.push(label); };
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(() => localStorage.setItem("spin-core-web-prototype-v2",
    JSON.stringify({ version: 2, sound: false, tutorial: { completed: true, stage: "complete" }, lab: { xp: 0 } })));
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route(/\/src\/main\.js(\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace(
      'new BeybladeApp(document.querySelector("#app"));',
      'window.app = new BeybladeApp(document.querySelector("#app"));') });
  });
  const glbs = [];
  page.on("request", request => { if (request.url().endsWith(".glb")) glbs.push(request.url().split("/").at(-1)); });
  await page.goto(`${base}/#collection`);
  await page.waitForFunction(() => window.app?.showroomScreen?.ready);
  check(glbs.length === 1 && glbs[0] === "holo.glb", "Collection requests only the equipped stage");
  check(await page.evaluate(() => Object.keys(app.labScreen.stage.roomSets).length === 0), "No background lab room loaded");
  await page.evaluate(() => {
    window.collectionTop = app.showroomScreen.stage.top;
    window.thumbnails = [...app.labScreen.stage.thumbnailCache.values()];
    app.goTo("lab");
  });
  await page.waitForFunction(() => window.app.labScreen.loaded);
  check(glbs.length === 2 && glbs[1] === "childhood_lab.glb", "Lab loads only the selected room on demand");
  check(await page.evaluate(() => thumbnails.every((canvas, i) =>
    canvas === [...app.labScreen.stage.thumbnailCache.values()][i])), "Lab and collection share thumbnail cache");
  await page.evaluate(() => {
    window.labTop = app.labScreen.stage.top;
    app.goTo("collection");
  });
  await page.waitForFunction(() => app.showroomScreen.stage.frameReady);
  check(await page.evaluate(() => app.showroomScreen.stage.top === collectionTop), "Unchanged showroom specimen survives navigation");
  await page.evaluate(() => app.goTo("lab"));
  await page.waitForFunction(() => app.labScreen.loaded);
  check(await page.evaluate(() => app.labScreen.stage.top === labTop), "Unchanged lab specimen survives navigation");
  check(glbs.length === 2, "Repeated entry issues no GLB requests");
  check(await page.evaluate(() => {
    const loadout = app.state.loadouts[app.state.activeLoadoutIndex];
    loadout.colors.ring = "#de3456";
    app.labScreen.refresh();
    return app.labScreen.stage.top !== labTop &&
      ![...app.labScreen.stage.thumbnailCache.values()].includes(thumbnails[0]) &&
      app.labScreen.stage.thumbnailCache.size <= app.state.loadouts.length;
  }), "In-place color edits invalidate specimen and thumbnail, with bounded cache");
  await page.evaluate(() => app.labScreen.stage.ready);
  check(await page.evaluate(() => {
    const top = app.labScreen.stage.top;
    const loadout = app.state.loadouts[app.state.activeLoadoutIndex];
    loadout.customizations[loadout.build.attackRing] = { size: 1.1, height: 1.05, shape: 0.3 };
    app.labScreen.refresh();
    return app.labScreen.stage.top !== top;
  }), "In-place DIY edits invalidate specimen");
  await page.evaluate(() => app.labScreen.stage.ready);

  // The locked-stage preview has its own asynchronous failure/retry state.
  await page.evaluate(() => { app.goTo("collection"); window.showroomSave = JSON.stringify(app.state.showroom); });
  await page.route("**/showroom/arena.glb", route => route.abort());
  await page.evaluate(() => app.showroomScreen.preview("arena"));
  await page.waitForFunction(() => document.querySelector(".collection-loading").textContent.includes("失败"));
  check(await page.evaluate(() => !app.showroomScreen.ready &&
    !document.querySelector('[data-collection="stages"]').disabled), "Failed preview leaves stage chooser usable for recovery");
  await page.unroute("**/showroom/arena.glb");
  await page.evaluate(() => app.showroomScreen.preview("arena"));
  await page.waitForFunction(() => app.showroomScreen.ready);
  check(await page.evaluate(() => JSON.stringify(app.state.showroom) === showroomSave &&
    app.showroomScreen.stage.sets.arena.visible), "Retry displays locked stage without changing equip or ownership");
  await page.evaluate(() => { app.goTo("lab"); app.goTo("collection"); });
  await page.waitForFunction(() => app.showroomScreen.stage.frameReady);
  check(await page.evaluate(() => app.showroomScreen.stage.stageId === "holo" &&
    !app.showroomScreen.stage.sets.arena.visible &&
    app.labScreen.stage.renderer.domElement.parentElement.className === "collection-scene" &&
    !app.labScreen.stage.active), "Leaving preview restores equip and shared canvas ownership");

  await page.evaluate(async () => {
    window.arenas = (await import("/src/data/arenas.js")).ARENAS;
    app.goTo("map");
    // Stage-only lifecycle probes avoid carousel's intentional scroll debounce.
    app.stage.showArena(arenas.metal);
  });
  await page.waitForFunction(() => app.stage.arenaReady);
  await page.evaluate(() => {
    window.atmosphere = app.stage.championshipAtmosphere;
    window.arenaModel = app.stage.arenaRoot.children.find(node => node !== app.stage.driveZoneModel);
    window.requestCountBeforeBattle = performance.getEntriesByType("resource").filter(e => e.name.includes(".glb")).length;
    const loadout = app.state.loadouts[0];
    app.stage.prepareBattle(arenas.metal, loadout.build, loadout.build, loadout.colors);
  });
  await page.waitForFunction(() => app.stage.arenaReady);
  check(await page.evaluate(() => app.stage.championshipAtmosphere === atmosphere &&
    app.stage.arenaRoot.children.includes(arenaModel) &&
    performance.getEntriesByType("resource").filter(e => e.name.includes(".glb")).length === requestCountBeforeBattle),
  "Preview to battle retains arena, lighting and loaded assets");
  check(await page.evaluate(() => {
    const previous = app.stage.playerTop;
    app.stage.playerTop.rotation.z = 1;
    app.stage.scenePulse = 1;
    app.stage.showArena(arenas.metal);
    const loadout = app.state.loadouts[0];
    app.stage.prepareBattle(arenas.metal, loadout.build, loadout.build, loadout.colors);
    return app.stage.playerTop !== previous && app.stage.scenePulse === 0 && !atmosphere.disposed;
  }), "A new round resets tops and pulse while retaining atmosphere");
  await page.waitForFunction(() => app.stage.arenaReady);

  let releaseStreet;
  const streetGate = new Promise(resolve => { releaseStreet = resolve; });
  let streetRequested;
  const requestStarted = new Promise(resolve => { streetRequested = resolve; });
  await page.route("**/battle_worlds/street.glb", async route => {
    streetRequested();
    await streetGate;
    await route.continue();
  });
  await page.evaluate(() => app.stage.showArena(arenas.street));
  await requestStarted;
  await page.evaluate(() => app.stage.showArena(arenas.ruins));
  await page.waitForFunction(() => app.stage.arenaReady);
  const lateResponse = page.waitForResponse(response => response.url().includes("/battle_worlds/street.glb"));
  releaseStreet();
  await lateResponse;
  await page.waitForTimeout(300); // Allow the deliberately late GLTF parser callback to settle.
  check(await page.evaluate(() => app.stage.activeArena.id === "ruins" &&
    app.stage.arenaReady && !app.stage.streetAtmosphere && !app.stage.championshipAtmosphere),
  "Late map response cannot replace the currently selected world");
  check(await page.evaluate(async () => {
    app.goTo("collection");
    const stage = app.stage;
    const compile = stage.renderer.compileAsync.bind(stage.renderer);
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    let started;
    const compiling = new Promise(resolve => { started = resolve; });
    stage.renderer.compileAsync = (...args) => {
      const actual = compile(...args);
      started();
      return actual.then(() => gate);
    };
    stage.showArena(arenas.composite);
    await compiling;
    stage.destroy();
    release();
    await Promise.allSettled([...stage.preparations]);
    return stage.preparations.size === 0;
  }), "Destroying a world during compilation settles without stale draw or renderer access");
  check(errors.length === 0, `No uncaught errors during async switches or destruction: ${errors.join("; ")}`);
  await writeFile("../.impeccable/review/loading/verification.json", JSON.stringify({ checks, errors }, null, 2));
  console.log(`PASS: ${checks.length} loading lifecycle checks`);
} finally {
  await browser.close();
}
