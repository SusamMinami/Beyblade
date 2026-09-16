import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const out = "../.impeccable/review/structure";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true,
});
const base = process.env.LAB_TEST_URL ?? "http://127.0.0.1:5173";
let checks = 0;
const check = (condition, label) => { assert.ok(condition, label); checks++; };
const errors = [];
let currentPage;
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const name = viewport.width === 390 ? "mobile" : "desktop";
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    await context.addInitScript(() => {
      localStorage.setItem("spin-core-web-prototype-v2", JSON.stringify({
        version: 2, coins: 700, sound: false,
        tutorial: { completed: true, stage: "complete", firstRewardClaimed: true },
      }));
    });
    const page = await context.newPage();
    currentPage = page;
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${base}/#journey`);
    await page.locator("#mission-select").waitFor();
    check((await page.locator(".journey-identity").textContent()).includes("六瓣"), `${name}: authored identity is visible`);
    await page.locator("#start-battle").click();
    await page.waitForFunction(() => !document.querySelector("#launch-button").disabled, { timeout: 15000 });
    await page.locator(".game-shell").screenshot({ path: `${out}/launch-${name}.png` });
    await page.locator("#launch-button").click();
    await page.locator("#launch-controls").waitFor({ state: "hidden", timeout: 15000 });
    await page.keyboard.down("a");
    await page.waitForFunction(() => Number(document.querySelector("#battle-time").textContent) > .5, null, { timeout: 15000 });
    await page.keyboard.up("a");
    await page.locator("#pause-battle").click();
    check(await page.locator("#drive-zone-hud").isVisible(), `${name}: live zone status is visible`);
    check((await page.locator("#player-status").textContent()).includes("结构") ||
      (await page.locator("#player-status").textContent()).includes("受损"), `${name}: structural telemetry is visible`);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: no horizontal overflow`);
    const layout = await page.evaluate(() => {
      const zone = document.querySelector("#drive-zone-hud").getBoundingClientRect();
      const header = document.querySelector(".battle-topbar").getBoundingClientRect();
      return { zone: { top: zone.top, bottom: zone.bottom }, header: { bottom: header.bottom } };
    });
    check(layout.zone.top >= layout.header.bottom, `${name}: zone HUD does not cover fighter HUD`);
    const pausedTime = await page.locator("#battle-time").textContent();
    await page.locator(".game-shell").screenshot({ path: `${out}/${name}.png` });
    check(await page.locator("#battle-time").textContent() === pausedTime, `${name}: capture respects pause`);
    await page.locator("#pause-battle").click();
    await page.locator("#result-card:not(.is-hidden)").waitFor({ timeout: 100000 });
    check((await page.locator("#result-cause").textContent()).length > 15, `${name}: actual finishing cause is reported`);
    check((await page.locator("#result-telemetry").textContent()).includes("占区"), `${name}: zone contribution appears in report`);
    await page.locator(".game-shell").screenshot({ path: `${out}/result-${name}.png` });
    check(await page.locator("#result-restart").isVisible(), `${name}: replay/continue remains reachable`);
    await context.close();
  }
  // Diagnostic fixtures use the real model builder and damage solver. They are
  // capture-only evidence, not scenes/screens added to the game.
  const specimen = await browser.newPage({ viewport: { width: 1440, height: 680 } });
  await specimen.route("**/__structure_fixture", (route) => route.fulfill({
    contentType: "text/html",
    body: '<body style="margin:0;background:#182c34"><main style="color:#eaf3ec;font:18px sans-serif"></main></body>',
  }));
  await specimen.goto(`${base}/__structure_fixture`);
  await specimen.evaluate(async () => {
    const THREE = await import("/node_modules/three/build/three.module.js");
    const { RoomEnvironment } = await import("/node_modules/three/examples/jsm/environments/RoomEnvironment.js");
    const { createTopModel, applyTopDamage } = await import("/src/render/top-model.js");
    const { CAMPAIGN_MISSIONS } = await import("/src/data/campaign.js");
    const { opponentIdentity } = await import("/src/data/opponent-identities.js");
    const { calculateBuild } = await import("/src/core/assembly-calculator.js");
    const { BattleSimulation } = await import("/src/core/battle-simulation.js");
    const { applyStructuralImpact } = await import("/src/core/top-structure.js");
    const { DEFAULT_BUILD } = await import("/src/data/parts.js");
    const { ARENAS } = await import("/src/data/arenas.js");
    const root = document.querySelector("main");
    document.body.style.margin = "0";
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(1440, 580);
    renderer.setPixelRatio(1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#182c34");
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
    scene.add(new THREE.HemisphereLight("#e8ffff", "#193233", 2));
    const camera = new THREE.PerspectiveCamera(32, 1440 / 580, .1, 100);
    camera.position.set(0, 12, 14);
    camera.lookAt(0, 0, 0);
    const indices = [0, 1, 2, 4, 6];
    for (let i = 0; i < indices.length; i++) {
      const mission = CAMPAIGN_MISSIONS[indices[i]];
      const identity = opponentIdentity(mission);
      const model = createTopModel(mission.enemyBuild, identity.colors, identity.customizations);
      model.position.set((i - 2) * 3.4, 0, -1);
      scene.add(model);
    }
    const labels = document.createElement("div");
    labels.style.cssText = "display:flex;justify-content:space-around;padding:20px;gap:20px";
    labels.textContent = "模型检查｜石子号　　　　　　　 黑曜·试作　　　　　　铆钉　　　　　　　　量规　　　　　　　　年轮";
    root.append(labels, renderer.domElement);
    renderer.render(scene, camera);
    window.fixtureRenderer = { renderer, scene, camera, createTopModel, applyTopDamage, calculateBuild, BattleSimulation, applyStructuralImpact, DEFAULT_BUILD, ARENAS };
  });
  await specimen.screenshot({ path: `${out}/opponents.png` });
  const damageGeometry = await specimen.evaluate(() => {
    const f = window.fixtureRenderer;
    const build = f.calculateBuild(f.DEFAULT_BUILD);
    const sim = new f.BattleSimulation({ playerBuild: build, enemyBuild: build, arena: f.ARENAS.standard });
    sim.launch();
    for (let i = 0; i < 7; i++) f.applyStructuralImpact(sim.player, 24, 0);
    while (f.scene.children.length > 1) f.scene.remove(f.scene.children.at(-1));
    const pristine = f.createTopModel(f.DEFAULT_BUILD);
    const damaged = f.createTopModel(f.DEFAULT_BUILD);
    pristine.position.x = -2.3;
    damaged.position.x = 2.3;
    f.applyTopDamage(damaged, sim.player.structure);
    f.scene.add(pristine, damaged);
    f.camera.position.set(0, 7, 8);
    f.camera.lookAt(0, 0, 0);
    f.renderer.render(f.scene, f.camera);
    document.querySelector("main div").textContent = "定向损伤检查｜左：完好　　右：同一外环方位连续受撞后，出现局部压瘪与掉块的等效形变";
    return sim.player.structure.parts[0].worst > .5 && damaged.userData.damageRevision === sim.player.structure.revision;
  });
  check(damageGeometry, "Real localized damage changes the model geometry");
  await specimen.screenshot({ path: `${out}/damage.png` });
  await specimen.close();
  check(errors.length === 0, `No runtime errors: ${errors.join("; ")}`);
  await writeFile(`${out}/browser.json`, JSON.stringify({ checks, errors }, null, 2));
  console.log(`PASS ${checks}: battle controls, pause, structure/zone HUD and result captures`);
} catch (error) {
  console.error("Browser diagnostics", errors, await currentPage?.evaluate(() => ({
    route: location.hash, time: document.querySelector("#battle-time")?.textContent,
    screen: document.querySelector(".game-shell")?.dataset.screen,
    launch: document.querySelector("#launch-controls")?.className,
    result: document.querySelector("#result-copy")?.textContent,
  })).catch(() => null));
  throw error;
} finally {
  await browser.close();
}
