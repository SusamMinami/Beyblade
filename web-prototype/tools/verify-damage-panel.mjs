import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const out = process.env.QA_OUTPUT_DIR ?? "../.impeccable/review/damage-panel";
await mkdir(out, { recursive: true });
const base = process.env.LAB_TEST_URL ?? "http://127.0.0.1:5173";
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let checks = 0;
const errors = [];
const check = (value, label) => { assert.ok(value, label); checks++; };
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 390, height: 640 }, { width: 1152, height: 800, dpr: 1.25 }]) {
    const name = viewport.dpr ? "desktop-dpi125" : viewport.height === 640 ? "short" : viewport.width === 390 ? "mobile" : "desktop";
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: viewport.dpr ?? 1, reducedMotion: "reduce" });
    await context.addInitScript(() => localStorage.setItem("spin-core-web-prototype-v2", JSON.stringify({ version: 2, coins: 700, sound: false, tutorial: { completed: true, stage: "complete", firstRewardClaimed: true } })));
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${base}/#journey`);
    await page.locator("#start-battle").click();
    await page.waitForFunction(() => !document.querySelector("#launch-button").disabled, null, { timeout: 30000 });
    check(!await page.locator("#battle-damage-panel").isVisible(), `${name}: hidden during launch`);
    await page.locator("#launch-button").click();
    await page.locator("#battle-damage-panel").waitFor({ timeout: 15000 });
    await page.locator("#pause-battle").click();
    await page.locator("#pause-resume").waitFor();
    // Native modal pause remains in place; inspect the non-modal live panel after resume.
    await page.locator("#pause-resume").click();
    check(await page.locator(".damage-part").count() === 5, `${name}: real five parts shown`);
    check(await page.locator(".damage-part [data-sector]").count() === 40, `${name}: eight directions per part`);
    await page.locator('[data-damage-actor="enemy"]').click();
    check(await page.locator('[data-damage-actor="enemy"]').getAttribute("aria-pressed") === "true", `${name}: opponent switching`);
    await page.locator('[data-damage-slot="tip"]').click();
    check(await page.locator('[data-damage-slot="tip"]').getAttribute("aria-pressed") === "true", `${name}: part selection`);
    await page.locator('[data-damage-actor="player"]').click();
    await page.locator('[data-damage-slot="attackRing"]').click();
    const layout = await page.evaluate(() => {
      const panel = document.querySelector("#battle-damage-panel").getBoundingClientRect();
      const zone = document.querySelector("#drive-zone-hud").getBoundingClientRect();
      const joystick = document.querySelector("#joystick").getBoundingClientRect();
      return { noOverflow: document.documentElement.scrollWidth <= innerWidth, separated: panel.top >= zone.bottom, joystickClear: panel.bottom <= joystick.top || panel.left >= joystick.right, inside: panel.right <= innerWidth && panel.left >= 0 };
    });
    check(layout.noOverflow && layout.inside, `${name}: no overflow or clipping`);
    check(layout.separated, `${name}: panel below supply HUD`);
    check(layout.joystickClear, `${name}: panel does not obscure joystick`);
    await page.locator(".game-shell").screenshot({ path: `${out}/live-${name}.png` });
    await page.locator(".damage-panel-disclosure > summary").click();
    check(!await page.locator(".damage-panel-body").isVisible(), `${name}: collapses to summary`);
    await page.locator(".game-shell").screenshot({ path: `${out}/collapsed-${name}.png` });
    await context.close();
  }
  // Controlled solver fixture: no debug state or injected damage API ships in the game.
  const page = await browser.newPage({ viewport: { width: 900, height: 1000 } });
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/__damage_panel_fixture", route => route.fulfill({ contentType: "text/html", body: '<meta charset="utf-8"><body style="margin:0;background:#182c34;font:14px sans-serif"><main class="game-shell" data-screen="battle" style="height:650px;position:relative"><h2 style="color:#dfebe7;padding:32px">受控方向损伤 · 真实求解器读数</h2><aside id="fixture" class="battle-damage-panel"></aside></main></body>' }));
  await page.goto(`${base}/__damage_panel_fixture`);
  const fixture = await page.evaluate(async () => {
    const link = document.createElement("link"); link.rel = "stylesheet"; link.href = "/src/ui/battle-damage-panel.css"; document.head.append(link);
    const { BattleDamagePanel } = await import("/src/ui/battle-damage-panel.js");
    const { calculateBuild } = await import("/src/core/assembly-calculator.js");
    const { DEFAULT_BUILD } = await import("/src/data/parts.js");
    const { ARENAS } = await import("/src/data/arenas.js");
    const { BattleSimulation } = await import("/src/core/battle-simulation.js");
    const { applyStructuralImpact } = await import("/src/core/top-structure.js");
    const build = calculateBuild(DEFAULT_BUILD);
    const simulation = new BattleSimulation({ playerBuild: build, enemyBuild: build, arena: ARENAS.standard });
    simulation.launch();
    const panel = new BattleDamagePanel(document.querySelector("#fixture"));
    panel.update(simulation);
    const pristine = document.querySelector(".damage-part-health").textContent;
    for (let i = 0; i < 7; i++) applyStructuralImpact(simulation.player, 24, 0);
    const before = JSON.stringify(simulation.player.structure);
    panel.update(simulation);
    const expected = simulation.player.structure.parts.find(part => part.slot === "attackRing");
    window.damageFixture = { panel, simulation, applyStructuralImpact, build };
    return { pristine, unchanged: before === JSON.stringify(simulation.player.structure), expectedHealth: Math.round(expected.health * 100), expectedWorst: Math.round(expected.worst * 100), massLost: expected.lostMass > 0 };
  });
  check(fixture.pristine === "100%" && fixture.unchanged, "fixture: pristine and no simulation mutation");
  check(await page.locator('[data-damage-slot="attackRing"] .damage-part-health').textContent() === `${fixture.expectedHealth}%`, "fixture: health exactly matches real solver");
  check((await page.locator(".damage-panel-local").textContent()).includes(`${fixture.expectedWorst}%`), "fixture: worst sector exactly matches real solver");
  check(fixture.massLost && (await page.locator(".damage-panel-consequence").textContent()).includes("无独立飞散碎片"), "fixture: equivalent mass loss explicitly distinguished from real fracture");
  check(await page.locator('[data-damage-slot="attackRing"] [data-band="critical"]').count() > 0, "fixture: damaged wedge changes color and outline");
  await page.locator("#fixture").screenshot({ path: `${out}/directed-damage.png` });
  await page.locator('[data-damage-actor="enemy"]').click();
  check(await page.locator('[data-damage-slot="attackRing"] .damage-part-health').textContent() === "100%", "fixture: enemy not borrowing player damage");
  const reset = await page.evaluate(() => {
    const f = window.damageFixture;
    const healthy = { ...f.simulation, player: { ...f.simulation.player, structure: structuredClone(f.simulation.enemy.structure) } };
    f.panel.update(healthy);
    const resetOK = f.panel.actor === "player" && document.querySelector('[data-damage-slot="attackRing"] .damage-part-health').textContent === "100%";
    f.panel.update({ phase: "finished" });
    return { resetOK, hidden: document.querySelector("#fixture").hidden };
  });
  check(reset.resetOK && reset.hidden, "fixture: new battle resets source and result hides panel");
  const keyboard = await page.evaluate(() => {
    const root = document.querySelector("#fixture");
    let downs = 0, ups = 0;
    const down = () => downs++, up = () => ups++;
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    const target = root.querySelector("button");
    target.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
    target.dispatchEvent(new KeyboardEvent("keyup", { key: "a", bubbles: true }));
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    return { downs, ups };
  });
  check(keyboard.downs === 0 && keyboard.ups === 1, "fixture: focused panel blocks steering but key release always reaches app");
  check(errors.length === 0, `No browser errors: ${errors.join("; ")}`);
  await writeFile(`${out}/browser.json`, JSON.stringify({ checks, errors, fixture }, null, 2));
  console.log(`PASS ${checks}: damage panel live layout, DPI, real solver fixture and lifecycle`);
} finally { await browser.close(); }
