import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const out = "../.impeccable/review/gpu-preparation";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const checks = [], errors = [];
const check = (ok, name) => { assert.ok(ok, name); checks.push(name); };
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(() => localStorage.setItem("spin-core-web-prototype-v2",
    JSON.stringify({ version: 2, sound: false, tutorial: { completed: true, stage: "complete" }, lab: { xp: 120 } })));
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", msg => { if (msg.type() === "error") errors.push(msg.text()); });
  await page.route(/\/src\/main\.js(\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace(
      'new BeybladeApp(document.querySelector("#app"));',
      'window.app = new BeybladeApp(document.querySelector("#app"));') });
  });
  const base = process.env.LAB_TEST_URL ?? "http://127.0.0.1:5173";
  await page.goto(`${base}/#map`);
  const warm = () => page.waitForFunction(() => app.stage.battleWarmup?.ready, null, { timeout: 20000 });
  const ready = () => page.waitForFunction(() => app.stage.arenaReady);
  await ready();
  await page.evaluate(() => {
    app.stage.cancelBattleWarmup();
    window.savedState = JSON.stringify(app.state);
    app._queueBattleWarmup();
    window.job = app.stage.battleWarmup;
  });
  check(await page.evaluate(() => !job.player && !job.enemy && !job.ready),
    "Preview is usable before the optional delayed warmup creates models");
  await warm();
  check(await page.evaluate(() => JSON.stringify(app.state) === savedState && !app.simulation),
    "Speculation does not modify save, ownership, loadout or simulation");
  check(await page.evaluate(() => job === app.stage.battleWarmup && job.player && job.enemy &&
    job.lease && !app.stage.modelRoot.children.includes(job.player)),
    "Only one actual matchup is held off screen with a retained program lease");
  check(await page.evaluate(() => {
    const p = app._battleSelections(null);
    return JSON.stringify(job.selection.player) === JSON.stringify(p.playerSelection) &&
      JSON.stringify(job.selection.identity) === JSON.stringify(p.identity);
  }), "Warmup uses the canonical free battle loadout and opponent appearance");
  await page.evaluate(() => {
    window.warmPlayer = job.player;
    window.warmEnemy = job.enemy;
    window.compileCalls = 0;
    const renderer = app.stage.renderer;
    window.originalCompile = renderer.compileAsync.bind(renderer);
    renderer.compileAsync = (...args) => { compileCalls++; return originalCompile(...args); };
    app.goTo("battle");
  });
  await ready();
  check(await page.evaluate(() => app.stage.playerTop === warmPlayer && app.stage.enemyTop === warmEnemy),
    "Starting the matching battle adopts the prepared models");
  check(await page.evaluate(() => compileCalls === 0 && !app.stage.battleWarmup &&
    !app.stage.battlePreparationLease && app.simulation.phase === "ready"),
    "Warm battle draws directly and releases its lease after the first frame");
  await page.evaluate(() => {
    app.stage.renderer.compileAsync = originalCompile;
    app.goTo("map");
  });
  await warm();
  check(await page.evaluate(() => app.stage.battleWarmup.player !== warmPlayer &&
    app.stage.battleWarmup.enemy !== warmEnemy),
    "Next round constructs pristine models rather than retaining damaged battle tops");
  await page.evaluate(() => {
    window.previousJob = app.stage.battleWarmup;
    window.disposedOld = false;
    previousJob.player.children[0].children.find(n => n.geometry).geometry
      .addEventListener("dispose", () => { window.disposedOld = true; });
    app.state.colors.ring = "#ab421d";
    app._queueBattleWarmup();
  });
  check(await page.evaluate(() => app.stage.battleWarmup.key !== previousJob.key && disposedOld),
    "Changed paint invalidates and disposes the old speculative model immediately");
  await page.evaluate(() => app.goTo("battle"));
  await ready();
  check(await page.evaluate(() => app.stage.playerTop !== previousJob.player && app.simulation.phase === "ready"),
    "Immediate start during warmup falls back to the normal loading path");

  await page.evaluate(() => {
    app.goTo("journey");
    window.savedState = JSON.stringify(app.state);
  });
  await warm();
  check(await page.evaluate(async () => {
    const { getMission } = await import("/src/data/campaign.js");
    const p = app._battleSelections(getMission(app.viewMissionId));
    return app.stage.battleWarmup.arenaId === app.selectedArena.id &&
      JSON.stringify(app.stage.battleWarmup.selection.identity) === JSON.stringify(p.identity) &&
      JSON.stringify(app.stage.battleWarmup.selection.enemy) === JSON.stringify(p.enemySelection);
  }), "Story preparation uses the selected chapter's arena and opponent identity");
  check(await page.evaluate(() => JSON.stringify(app.state) === savedState),
    "Reading a chapter and warming it does not advance campaign state");
  const locked = await page.evaluate(async () => {
    const { CAMPAIGN_MISSIONS } = await import("/src/data/campaign.js");
    app.viewMissionId = CAMPAIGN_MISSIONS.at(-1).id;
    app._setMapMode("story");
    return !app.stage.battleWarmup;
  });
  check(locked, "Locked chapters do not allocate a speculative battle");

  await page.evaluate(async () => {
    app.goTo("map");
    app._selectArena("street");
    app._centerArenaCard(app.root.querySelector('.arena-card[data-arena="street"]'), "instant");
  });
  await warm();
  await page.evaluate(() => {
    window.oldKey = app.stage.battleWarmup.key;
    app.stage.setSceneTime("day");
    app._queueBattleWarmup();
  });
  check(await page.evaluate(() => app.stage.battleWarmup.key !== oldKey && !app.stage.battleWarmup.ready),
    "Day/night changes invalidate the prepared environment variant");
  await warm();
  await page.evaluate(() => app.goTo("battle"));
  await ready();
  for (const [name, viewport] of [
    ["desktop", { width: 1440, height: 1000 }], ["mobile", { width: 390, height: 844 }],
  ]) {
    await page.setViewportSize(viewport);
    await page.locator(".game-shell").screenshot({ path: `${out}/street-${name}.png` });
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `${name}: no horizontal overflow after a warmed battle starts`);
  }

  // Gate actual compilation so cancellation and lease cleanup are deterministic.
  await page.evaluate(async () => {
    app.goTo("map");
    app.stage.cancelBattleWarmup();
    await Promise.allSettled([...app.stage.preparations]);
    const renderer = app.stage.renderer;
    window.originalCompile = renderer.compileAsync.bind(renderer);
    window.gate = new Promise(resolve => { window.releaseGate = resolve; });
    window.compileStarted = false;
    renderer.compileAsync = (...args) => {
      window.compileStarted = true;
      return originalCompile(...args).then(() => gate);
    };
    app._queueBattleWarmup();
  });
  await page.waitForFunction(() => window.compileStarted);
  await page.evaluate(() => {
    window.canceledJob = app.stage.battleWarmup;
    app.goTo("collection");
    window.remaining = [...app.stage.preparations];
    app.stage.renderer.compileAsync = originalCompile;
    releaseGate();
  });
  await page.evaluate(() => Promise.allSettled(remaining));
  check(await page.evaluate(() => !app.stage.battleWarmup && app.stage.preparations.size === 0 &&
    !canceledJob.ready), "Leaving during compilation cancels uploads and settles all jobs");
  await page.waitForFunction(() => app.showroomScreen.ready);
  check(await page.evaluate(() => app.labScreen.stage.renderer.domElement.parentElement.className === "collection-scene"),
    "Background preparation cannot replace the shared collection canvas");

  // No monotonic geometry/texture growth across repeated ready/cancel cycles.
  await page.evaluate(() => app.goTo("map"));
  await warm();
  const memories = [];
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => app.stage.cancelBattleWarmup());
    memories.push(await page.evaluate(() => ({ ...app.stage.renderer.info.memory })));
    if (i < 2) {
      await page.evaluate(() => app._queueBattleWarmup());
      await warm();
    }
  }
  check(memories.every(m => m.geometries === memories[0].geometries && m.textures === memories[0].textures),
    "Repeated speculative preparation releases all additional geometry and textures");
  await page.evaluate(() => {
    window.originalHas = app.stage.renderer.extensions.has.bind(app.stage.renderer.extensions);
    app.stage.renderer.extensions.has = name => name === "KHR_parallel_shader_compile" ? false : originalHas(name);
    app._queueBattleWarmup();
  });
  check(await page.evaluate(() => !app.stage.battleWarmup.timer && !app.stage.battleWarmup.player),
    "Renderers without parallel shader compilation skip optional speculation");
  await page.evaluate(() => {
    app.stage.renderer.extensions.has = originalHas;
    app.stage.cancelBattleWarmup();
    app._queueBattleWarmup();
    app.goTo("collection");
    app.stage.destroy();
  });
  await page.evaluate(() => Promise.allSettled([...app.stage.preparations]));
  check(await page.evaluate(() => !app.stage.battleWarmup), "Destroy cancels pending delayed work");
  check(errors.length === 0, `No page or WebGL errors: ${errors.join("; ")}`);
  await writeFile(`${out}/verification.json`, JSON.stringify({ checks, memories, errors }, null, 2));
  console.log(`PASS: ${checks.length} GPU preparation checks`);
} finally { await browser.close(); }
