import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.LAB_TEST_URL || "http://127.0.0.1:5173";
const normalKey = "spin-core-web-prototype-v2";
const recordingKey = "spin-core-web-recording-v2";
const original = JSON.stringify({
  version: 2, coins: 321, sound: false,
  colors: { ring: "#123456", core: "#abcdef" },
  tutorial: { completed: true, stage: "complete", firstRewardClaimed: true },
  lab: { xp: 30, settings: { room: "childhood", followStory: false } },
  showroom: { owned: ["holo"], equipped: "holo", followStory: false },
});
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
});
try {
  const context = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  await context.addInitScript(({ normalKey, original }) => {
    if (!localStorage.getItem(normalKey)) localStorage.setItem(normalKey, original);
  }, { normalKey, original });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route(/\/src\/main\.js(\?.*)?$/, async route => {
    const response = await route.fetch();
    const source = await response.text();
    const entry = 'new BeybladeApp(document.querySelector("#app"));';
    assert.ok(source.includes(entry), "main entry matches test adapter");
    await route.fulfill({ response, body: source.replace(entry, `window.app = ${entry}`) });
  });

  await page.goto(`${base}/?recording=1#assembly`);
  await page.waitForFunction(() => window.app?.stage?.borrowedLab);
  const state = await page.evaluate(async () => {
    const { PARTS } = await import("/src/data/parts.js");
    const { LAUNCHER_PARTS } = await import("/src/core/launcher-state.js");
    const { PART_MATERIAL_LIST } = await import("/src/core/part-customization.js");
    const { CAMPAIGN_MISSIONS } = await import("/src/data/campaign.js");
    const { canPlayMission } = await import("/src/core/campaign-state.js");
    const { DISPLAY_STAGES, equipDisplayStage } = await import("/src/core/showroom-state.js");
    return {
      parts: PARTS.length, launcherParts: LAUNCHER_PARTS.length,
      allParts: [...PARTS, ...LAUNCHER_PARTS].every(p => app.state.ownedPartIds.includes(p.id)),
      materials: PART_MATERIAL_LIST.length,
      allMaterials: PART_MATERIAL_LIST.every(m => app.state.ownedMaterialIds.includes(m.id)),
      missions: CAMPAIGN_MISSIONS.length,
      allMissions: CAMPAIGN_MISSIONS.every(m => canPlayMission(app.state.campaign, m.id)),
      allStages: DISPLAY_STAGES.every(s => app.state.showroom.owned.includes(s.id) &&
        equipDisplayStage(app.state.showroom, s.id, app.state.lab.xp).ok),
      xp: app.state.lab.xp, room: app.state.lab.settings.room,
      equippedStage: app.state.showroom.equipped, colors: app.state.colors,
      tutorial: app.state.tutorial.completed,
      journal: app.state.campaign.journal.length, reports: app.state.lab.records.length,
    };
  });
  for (const key of ["allParts", "allMaterials", "allMissions", "allStages", "tutorial"])
    assert.equal(state[key], true, key);
  assert.ok(state.xp >= 120);
  assert.equal(state.room, "childhood");
  assert.equal(state.equippedStage, "holo");
  assert.deepEqual(state.colors, { ring: "#123456", core: "#abcdef" });
  assert.equal(state.journal, 0, "does not fabricate battle history");
  assert.equal(state.reports, 0, "does not fabricate lab reports");
  assert.equal(await page.evaluate(key => localStorage.getItem(key), normalKey), original);

  // A previously paid launcher part can be equipped through the real interface.
  await page.locator('[data-workshop="outfit"]').click();
  await page.waitForFunction(() => app.maintenanceScreen?.ready);
  await page.locator('[data-launcher-part="launcher.rack.r02"]').click();
  assert.equal(await page.locator('[data-maintenance="equip"]').textContent(), "装入草稿");
  await page.locator('[data-maintenance="equip"]').click();
  await page.locator('[data-maintenance="save"]').click();
  await page.waitForFunction(() => app.state.launcher.build.rack === "launcher.rack.r02");
  const recorded = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), recordingKey);
  assert.equal(recorded.launcher.build.rack, "launcher.rack.r02");
  assert.equal(recorded.coins, 9999, "owned equipment does not charge coins");
  assert.equal(await page.evaluate(key => localStorage.getItem(key), normalKey), original);

  await page.reload();
  await page.waitForFunction(() => window.app?.stage?.borrowedLab);
  assert.equal(await page.evaluate(() => app.state.launcher.build.rack), "launcher.rack.r02");
  assert.ok(page.url().includes("?recording=1"));
  await page.evaluate(() => app.goTo("journey"));
  await page.locator("#mission-select").waitFor();
  assert.equal(await page.locator("#mission-select option").count(), state.missions);
  assert.equal(await page.locator(".journey-lock").count(), 0);
  assert.equal(await page.locator("#start-battle").isDisabled(), false);

  // The same browser origin still uses the original normal save without the flag.
  await page.goto(`${base}/#assembly`);
  await page.waitForFunction(() => window.app?.stage?.borrowedLab);
  assert.equal(await page.evaluate(() => app.state.coins), 321);
  assert.equal(await page.evaluate(() => app.state.campaign.completed.length), 0);
  assert.equal(await page.evaluate(() => app.state.ownedMaterialIds.length), 1);
  assert.equal(await page.evaluate(() => app.state.launcher.build.rack), "launcher.rack.r01");
  assert.equal(await page.evaluate(key => localStorage.getItem(key), normalKey), original);
  assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).launcher.build.rack, recordingKey),
    "launcher.rack.r02");
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ ok: true, ...state, persistence: true, normalSaveUnchanged: true,
    pageErrors: errors }, null, 2));
} finally {
  await browser.close();
}
