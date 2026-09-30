import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const out = process.env.QA_OUTPUT_DIR ?? "../docs/flow-audit/2026-09-30/after";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const base = process.env.LAB_TEST_URL ?? "http://127.0.0.1:5173";
const key = "spin-core-web-prototype-v2";
const checks = [], errors = [];
const check = (value, label) => {
  checks.push({ label, pass: Boolean(value) });
  if (!value) console.error(`FAIL: ${label}`);
};
const trainee = { version: 2, coins: 180, sound: false,
  tutorial: { stage: "buy_first_part", completed: false, firstRewardClaimed: true } };
const trained = { version: 2, coins: 700, sound: false,
  tutorial: { stage: "complete", completed: true },
  campaign: { completed: ["first-echo"], journal: [] } };
async function open(fixture, hash = "assembly") {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await context.addInitScript(({ key, fixture }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(fixture));
  }, { key, fixture });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  await page.route(/\/src\/main\.js(\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace(
      'new BeybladeApp(document.querySelector("#app"));', 'window.app = new BeybladeApp(document.querySelector("#app"));') });
  });
  await page.goto(`${base}/#${hash}`);
  return page;
}
const saved = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
const ready = page => page.waitForFunction(() => window.app?.maintenanceScreen?.ready);
const capture = async (page, name) => {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path: `${out}/${name}.png` });
};
const hit = locator => locator.evaluate(el => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom <= innerHeight + 1 &&
    el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
});
const quota = (page, enabled) => page.evaluate(enabled => {
  if (enabled) {
    window.realSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new DOMException("QA quota", "QuotaExceededError"); };
  } else Storage.prototype.setItem = window.realSetItem;
}, enabled);

try {
  const page = await open(trainee);
  await page.locator("#tutorial-action").click();
  for (const size of [[390, 844], [320, 568], [1440, 1000]]) {
    await page.setViewportSize({ width: size[0], height: size[1] });
    await capture(page, `parts-${size[0]}`);
    for (const card of await page.locator("#variant-list .variant").all()) {
      check(await hit(card), `${size}: entire card center reaches its own control`);
      check(await card.locator("b").evaluate(el => {
        const r = el.getBoundingClientRect();
        return el.closest("button").contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      }), `${size}: card label is not intercepted by footer`);
    }
    check(await hit(page.locator("#go-map")), `${size}: preparation button reachable`);
    const nav = await page.locator(".phase").evaluateAll(buttons => buttons.every(el => {
      const r = el.getBoundingClientRect();
      return el.getAttribute("aria-label") && getComputedStyle(el.querySelector("span")).display !== "none" &&
        r.width >= 44 && r.height >= 44;
    }));
    check(nav, `${size}: all navigation items have visible names and 44px targets`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-workshop="outfit"]').click(); await ready(page);
  await page.locator('[data-launcher-part="launcher.rack.r03"]').click(); await ready(page);
  await page.locator('[data-maintenance="save"]').click();
  check((await saved(page)).tutorial.stage === "buy_first_part", "Saving an unowned preview never advances teaching");
  await quota(page, true);
  await page.locator('[data-maintenance="equip"]').click();
  check(await page.evaluate(() => app.state.coins === 180 && app.maintenanceScreen.launcherDraft.build.rack.endsWith("r01")),
    "Failed purchase keeps balance and draft equipment");
  await quota(page, false);
  await page.locator('[data-maintenance="equip"]').click();
  check((await saved(page)).coins === 0 && (await saved(page)).tutorial.stage === "buy_first_part",
    "180-coin purchase owns R03 but does not advance before Save");
  await page.locator('[data-maintenance="cancel"]').click();
  check((await saved(page)).tutorial.stage === "buy_first_part", "Cancel retains ownership without claiming an equipped upgrade");
  await page.locator('[data-workshop="outfit"]').click(); await ready(page);
  await page.locator('[data-launcher-part="launcher.rack.r03"]').click(); await ready(page);
  await page.locator('[data-maintenance="equip"]').click();
  await quota(page, true);
  await page.locator('[data-maintenance="save"]').click();
  check(await page.evaluate(() => app.state.tutorial.stage === "buy_first_part" &&
    app.state.launcher.build.rack.endsWith("r01") && app.maintenanceScreen.launcherDraft.build.rack.endsWith("r03")),
    "Failed Save rolls back teaching and live equipment, retaining draft");
  await quota(page, false);
  await page.locator('[data-maintenance="save"]').click();
  check((await saved(page)).tutorial.stage === "second_battle" &&
    (await saved(page)).launcher.build.rack.endsWith("r03"), "Successful Save advances zero-balance trainee");
  check((await page.locator('[data-maintenance="continue"]').textContent()).includes("训练"), "Saved tool offers the next training directly");
  await capture(page, "launcher-upgrade-mobile");
  await page.locator('[data-maintenance="continue"]').click();
  await page.waitForFunction(() => !document.querySelector("#launch-button")?.disabled);
  check(new URL(page.url()).hash === "#battle", "Tool returns directly to second training");
  await page.locator("#pause-battle").click();
  check((await page.locator("#tutorial-copy").textContent()).includes("R03"), "Training explains the actual launcher upgrade");
  await page.reload();
  check((await page.locator("#tutorial-copy").textContent()).includes("R03"), "Launcher training copy survives reload");

  const oldSave = await saved(page);
  oldSave.tutorial.stage = "buy_first_part";
  const migrated = await open(oldSave);
  check(await migrated.evaluate(() => app.state.tutorial.stage === "second_battle"), "Existing equipped-but-stuck save is recovered");
  await migrated.context().close();
  await page.context().close();

  const journey = await open(trained, "journey");
  await journey.locator("#mission-select").selectOption("first-echo");
  await journey.locator('.journey-prep [data-go="assembly"]').click();
  for (const mode of ["outfit", "care"]) {
    await journey.locator(`[data-workshop="${mode}"]`).click(); await ready(journey);
    for (const size of [[390, 844], [320, 568], [1440, 1000]]) {
      await journey.setViewportSize({ width: size[0], height: size[1] });
      await capture(journey, `${mode}-${size[0]}`);
      check(await hit(journey.locator('[data-maintenance="save"]')), `${mode}/${size}: Save reachable`);
      check(await hit(journey.locator('[data-maintenance="continue"]')), `${mode}/${size}: return reachable`);
    }
    if (mode === "outfit") {
      await journey.locator('[data-maintenance="red"]').click();
      check((await journey.locator(".maintenance-draft").textContent()).includes("离开组装"), "Unsaved draft explains leaving behavior");
    }
    await journey.locator('[data-maintenance="continue"]').click();
    check(await journey.locator("#mission-select").inputValue() === "first-echo", `${mode}: correct replay target retained`);
    await journey.locator('.journey-prep [data-go="assembly"]').click();
  }
  check((await saved(journey)).launcher?.colors.accent !== "#b83722" &&
    await journey.evaluate(() => app.state.launcher.colors.accent !== "#b83722"), "Returning without Save discards color draft");
  await journey.locator('[data-phase-only="battle"]').click();
  check(new URL(journey.url()).hash === "#journey" && await journey.locator("#mission-select").inputValue() === "first-echo",
    "Header battle action returns to the same preparation target");
  await journey.locator('.journey-prep [data-go="lab"]').click();
  await journey.waitForFunction(() => !document.querySelector(".lab-start")?.disabled);
  for (const size of [[390, 844], [320, 568], [1440, 1000]]) {
    await journey.setViewportSize({ width: size[0], height: size[1] });
    await capture(journey, `lab-${size[0]}`);
    check(await journey.locator(".lab-utilities").evaluate(el => {
      const values = document.querySelector(".lab-overhead-values").getBoundingClientRect();
      return [...el.querySelectorAll("small")].every(label => {
        const r = label.getBoundingClientRect();
        return r.left >= values.right || r.bottom <= values.top || r.top >= values.bottom;
      });
    }), `${size}: measured values do not overlap utility labels`);
    check(await hit(journey.locator('[data-lab="help"]')), `${size}: Help is not covered by Wind`);
    await journey.locator('[data-lab="help"]').click();
    check(await journey.locator(".lab-dialog").evaluate(el => el.open), `${size}: Help opens by pointer`);
    await journey.locator('[data-lab="close"]').click();
    check(await journey.locator(".lab-overhead-values").isVisible(), `${size}: front view exposes real values`);
  }
  await journey.locator('[data-lab="test"]').click();
  await journey.waitForFunction(() => document.querySelector(".lab-start b")?.textContent === "再次测试");
  await journey.waitForFunction(() => document.querySelector(".lab-notice").hidden);
  check(await journey.locator(".lab-overhead-values").isVisible() &&
    (await journey.locator(".lab-overhead-values").textContent()).includes("1.22"), "Test values remain visible after notice expires");
  check((await saved(journey)).lab.records.length === 1 && (await saved(journey)).lab.xp === 30,
    "Readout changes preserve canonical report and XP");
  await journey.locator('[data-view="top"]').click();
  await journey.locator('[data-view="front"]').click();
  check(await journey.locator(".lab-overhead-values").isVisible(), "Returning camera to front retains minimal-room values");
  await journey.locator('[data-lab="battle"]').click();
  check(await journey.locator("#mission-select").inputValue() === "first-echo", "Testing returns to same replay");
  check(errors.length === 0, `No browser exceptions: ${errors.join("; ")}`);
  const failures = checks.filter(item => !item.pass);
  await writeFile(`${out}/verification.json`, JSON.stringify({ checks, errors, status: failures.length ? "FAIL" : "PASS" }, null, 2));
  assert.equal(failures.length, 0, failures.map(item => item.label).join("\n"));
  console.log(`PASS ${checks.length}: flow continuity checks`);
} finally { await browser.close(); }
