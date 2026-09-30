import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const label = process.argv[2] ?? "current";
const arenaIds = process.argv[3]?.split(",") ?? ["ruins", "street"];
const out = resolve(process.env.WORLD_CAPTURE_DIR ?? "../.impeccable/review/world-materials", label);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const base = process.env.LAB_TEST_URL ?? "http://127.0.0.1:5173";
const errors = [];
const metrics = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(() => localStorage.setItem("spin-core-web-prototype-v2",
    JSON.stringify({ version: 2, sound: false, tutorial: { completed: true, stage: "complete" },
      sceneTime: "night" })));
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  // Expose the renderer only in this isolated QA page, never in production.
  await page.route(/\/src\/main\.js(\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace(
      'new BeybladeApp(document.querySelector("#app"));',
      'window.artApp = new BeybladeApp(document.querySelector("#app"));') });
  });
  await page.goto(`${base}/#map`);
  for (const id of arenaIds) {
    await page.locator(`.arena-card[data-arena="${id}"]`).click();
    await page.waitForFunction(id => window.artApp?.stage.arenaReady &&
      window.artApp.stage.activeArena.id === id, id);
    for (const period of ["night", "day"]) {
      await page.locator("#scene-time").selectOption(period);
      await page.waitForFunction(() => window.artApp.stage.arenaReady);
      await page.locator("#start-battle").click();
      await page.waitForFunction(() => !document.querySelector("#launch-button")?.disabled);
      for (const [size, viewport] of [
        ["desktop", { width: 1440, height: 1000 }], ["mobile", { width: 390, height: 844 }],
      ]) {
        await page.setViewportSize(viewport);
        await page.evaluate(async () => {
          const s = window.artApp.stage;
          s.camera.position.copy(s.desiredCameraPosition);
          s.cameraTarget.copy(s.desiredCameraTarget);
          s.update(0);
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        });
        await page.locator(".game-shell").screenshot({ path: `${out}/${id}-${period}-${size}.png` });
      }
      metrics.push(await page.evaluate(({ id, period }) => {
        const s = window.artApp.stage;
        const materials = new Map();
        s.arenaRoot.traverse(mesh => {
          if (mesh.isMesh) materials.set(mesh.material.uuid, {
            name: mesh.material.name, type: mesh.material.type,
            roughness: mesh.material.roughness, metalness: mesh.material.metalness,
            finish: mesh.material.userData, env: mesh.material.envMapIntensity,
          });
        });
        s.renderer.info.autoReset = false;
        s.renderer.info.reset();
        s.update(0);
        const render = { ...s.renderer.info.render };
        s.renderer.info.autoReset = true;
        return { id, period, render, materials: [...materials.values()] };
      }, { id, period }));
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(`${base}/#map`);
      await page.waitForFunction(() => window.artApp.stage.arenaReady);
    }
  }
  await writeFile(`${out}/captures.json`, JSON.stringify({ metrics, errors }, null, 2));
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(`Captured ${metrics.length * 2} real UI views: ${out}`);
} finally {
  await browser.close();
}
