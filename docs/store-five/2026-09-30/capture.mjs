// Capture current Web UI in a disposable Chrome context. Does not edit game files.
import { chromium } from "../../../web-prototype/node_modules/playwright/index.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const folder = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(folder, "raw");
const worldsOnly = process.argv.includes("--worlds-only");
await mkdir(out, { recursive: true });
const base = process.env.LAB_TEST_URL || "http://127.0.0.1:5173";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
});
const context = await browser.newContext({
  viewport: { width: 540, height: 960 }, deviceScaleFactor: 2,
  locale: "zh-CN", colorScheme: "light",
});
const errors = [];
const manifest = {
  capturedAt: new Date().toISOString(), base,
  viewport: { width: 540, height: 960, deviceScaleFactor: 2 },
  source: "Current local Web prototype; actual UI and renderer",
  isolation: "Disposable browser context; tutorial completed, canonical starter equipment, 1000 local fixture coins; no user save access",
  captures: [], errors,
};
await context.addInitScript(() => {
  if (!localStorage.getItem("spin-core-web-prototype-v2")) {
    localStorage.setItem("spin-core-web-prototype-v2", JSON.stringify({
      version: 2, coins: 1000, sound: false,
      tutorial: { completed: true, stage: "complete", firstRewardClaimed: true },
      lab: { settings: { room: "minimal", followStory: false } },
      arenaId: "metal",
    }));
  }
});
const page = await context.newPage();
page.setDefaultTimeout(30000);
page.on("pageerror", e => errors.push(e.message));
await page.route(/\/src\/main\.js(\?.*)?$/, async route => {
  const response = await route.fetch();
  const source = await response.text();
  const entry = 'new BeybladeApp(document.querySelector("#app"));';
  if (!source.includes(entry)) throw Error("Capture adapter no longer matches main.js");
  await route.fulfill({ response, body: source.replace(entry, `window.app = ${entry}`) });
});
const frames = async () => page.evaluate(() => new Promise(resolve =>
  requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
async function shot(name, description) {
  await frames();
  await page.locator(".game-shell").screenshot({ path: path.join(out, `${name}.png`) });
  manifest.captures.push({
    file: `raw/${name}.png`, description,
    ...(await page.evaluate(() => ({
      route: location.hash, screen: app.screen, mode: app.workshopMode,
      arena: document.querySelector(".game-shell")?.dataset.arena || app.state.arenaId,
      loadout: app.state.loadouts[app.state.activeLoadoutIndex],
      battleTime: app.screen === "battle" ? app.simulation?.time : undefined,
      impact: window.capturedImpact || undefined,
    }))),
  });
  console.log(`CAPTURE ${name}`);
}
const readyTop = () => page.waitForFunction(() => app.stage.borrowedLab && app.workshopMode === "top");
const readyTools = () => page.waitForFunction(() => app.maintenanceScreen?.ready);
try {
  if (worldsOnly) {
    for (const arena of ["street", "ruins"]) {
      await page.goto(`${base}/?store-capture=${arena}#map`);
      await page.locator(`.arena-card[data-arena="${arena}"]`).click();
      await page.waitForFunction(id => document.querySelector(".game-shell")?.dataset.arena === id &&
        document.querySelector("#three-stage")?.dataset.assetState === "ready", arena);
      const time = page.locator("select").filter({ has: page.locator('option[value="day"]') });
      if (await time.count()) await time.first().selectOption("day");
      await page.locator("#start-battle").click();
      await page.waitForFunction(() => !document.querySelector("#launch-button")?.disabled);
      await page.evaluate(() => {
        const tick = app._tick.bind(app);
        app._tick = function (t) {
          if (window.captureFrozen) return;
          tick(t);
          if (this.simulation?.time >= .85) {
            this._updateHud();
            window.captureFrozen = true;
          }
        };
      });
      await page.locator("#launch-button").click();
      await page.waitForFunction(() => window.captureFrozen);
      await shot(`05-${arena}`, "Real daytime arena in running gameplay; animation clock frozen at 0.85 s");
    }
  } else {
  await page.goto(`${base}/#assembly`);
  await readyTop();
  await page.waitForTimeout(1400);
  await shot("02-assembly-overview", "Current three-loadout assembly overview; canonical starter parts");
  const hit = await page.evaluate(() => {
    const s = app.stage, r = s.renderer.domElement.getBoundingClientRect();
    for (let y = r.y + r.height * .3; y < r.y + r.height * .64; y += 5)
      for (let x = r.x + r.width * .25; x < r.x + r.width * .75; x += 5)
        if (s._pickAssemblyPart(x, y)?.slot === "attackRing") return { x, y };
    return null;
  });
  if (!hit) throw Error("Attack ring is not reachable");
  await page.mouse.click(hit.x, hit.y);
  await page.waitForFunction(() => app.activeSlot === "attackRing");
  await page.waitForTimeout(900);
  await shot("02-assembly", "Attack ring selected through real model hit testing; three real variants visible");
  await page.locator("#variant-list .variant.is-active").click();
  await page.waitForFunction(() => Boolean(app.diyDraft));
  await page.waitForTimeout(800);
  await shot("02-diy", "Current equipped attack ring in the actual DIY editor");
  await page.evaluate(() => app._closePartEditor(false));

  await page.locator('[data-workshop="outfit"]').click();
  await readyTools();
  await page.waitForTimeout(1200);
  await shot("03-launcher", "Actual exploded launcher with three canonical performance slots");
  await page.locator('[data-maintenance="red"]').click();
  await page.waitForTimeout(400);
  await shot("03-launcher-red", "Built-in free red/black color preset, unsaved draft");

  await page.locator('[data-workshop="care"]').click();
  await readyTools();
  await page.locator('[data-focus="transmission"]').click();
  await page.waitForTimeout(900);
  const contact = await page.evaluate(() => {
    const s = app.maintenanceScreen.stage, r = s.canvas.getBoundingClientRect();
    const candidates = [];
    for (let y = r.y + r.height * .28; y < r.y + r.height * .58; y += 5)
      for (let x = r.x + r.width * .22; x < r.x + r.width * .78; x += 5)
        if (s.hit(x, y)?.zone === "transmission") candidates.push({ x, y });
    return candidates[Math.floor(candidates.length / 2)] || null;
  });
  if (!contact) throw Error("Transmission surface is not reachable");
  await page.mouse.move(contact.x, contact.y);
  await page.mouse.down();
  await page.mouse.move(contact.x + 8, contact.y + 6, { steps: 5 });
  await page.mouse.up();
  await page.mouse.move(contact.x + 3, contact.y + 2);
  await page.waitForTimeout(400);
  await shot("04-maintenance", "Real pointer stroke on the transmission; rendered oil film and current effect readings");
  await page.locator('[data-maintenance="trial"]').click();
  await page.waitForTimeout(450);
  await shot("04-maintenance-trial", "Actual fixed-input comparison after the oil stroke");

  await page.goto(`${base}/#journey`);
  await page.locator("#mission-select").waitFor();
  await page.waitForFunction(() => document.querySelector("#three-stage")?.dataset.assetState === "ready");
  await page.waitForTimeout(1000);
  await shot("05-journey", "First authored story mission, actual dialogue, opponent and street map");
  if (await page.locator(".journey-story > summary").count()) {
    await page.locator(".journey-story > summary").click();
    await shot("05-journey-story", "Expanded first mission dialogue and actual goal");
  }

  await page.goto(`${base}/#map`);
  await page.locator('.arena-card[data-arena="metal"]').click();
  await page.waitForFunction(() => document.querySelector(".game-shell")?.dataset.arena === "metal" &&
    document.querySelector("#three-stage")?.dataset.assetState === "ready");
  const sceneTime = page.locator("select").filter({ has: page.locator('option[value="night"]') });
  if (await sceneTime.count()) await sceneTime.first().selectOption("night");
  await page.waitForTimeout(1000);
  await shot("05-worlds", "Five real arena choices, championship preview");
  await page.locator("#start-battle").click();
  await page.waitForFunction(() => !document.querySelector("#launch-button")?.disabled);
  await page.waitForTimeout(900);
  await shot("01-launch", "Actual launch preparation and current mechanical launcher");
  await page.evaluate(() => {
    window.captureFrozen = false;
    window.freezeAt = null;
    const events = app._processEvents.bind(app);
    app._processEvents = function () {
      for (const e of this.simulation.events) {
        if (e.type === "collision" && !window.capturedImpact) {
          window.capturedImpact = JSON.parse(JSON.stringify(e));
          window.freezeAt = performance.now() + 65;
        }
      }
      events();
    };
    const tick = app._tick.bind(app);
    app._tick = function (time) {
      if (window.captureFrozen) return;
      tick(time);
      if (window.freezeAt && time >= window.freezeAt) {
        this._updateHud();
        window.captureFrozen = true;
      }
    };
  });
  await page.locator("#launch-button").click();
  await page.waitForFunction(() => app.simulation?.phase === "running");
  await page.waitForFunction(() => window.captureFrozen || app.simulation?.phase === "finished", null, { timeout: 90000 });
  if (!await page.evaluate(() => window.captureFrozen)) throw Error("No natural top-to-top collision captured");
  await shot("01-battle", "Natural solver collision; animation clock frozen 65 ms after contact, with no changes to physics, geometry or effects");
  }
} finally {
  await writeFile(path.join(folder, worldsOnly ? "worlds-manifest.json" : "capture-manifest.json"),
    JSON.stringify(manifest, null, 2));
  await browser.close();
}
