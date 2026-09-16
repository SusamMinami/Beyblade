import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { CAMPAIGN_MISSIONS } from "../src/data/campaign.js";
import { canPlayMission, nextMission, normalizeCampaign, settleMission } from "../src/core/campaign-state.js";
import { DEFAULT_BUILD, getPart } from "../src/data/parts.js";
import { ARENAS } from "../src/data/arenas.js";
import { calculateBuild } from "../src/core/assembly-calculator.js";
import { BattleSimulation } from "../src/core/battle-simulation.js";

let checks = 0;
const check = (value, label) => { assert.ok(value, label); checks++; };
const first = CAMPAIGN_MISSIONS[0].id;
let campaign = normalizeCampaign();
const input = (id, winner = "player", battleId = crypto.randomUUID()) => ({
  missionId: id, battleId, result: { winner, reason: "spin_out", time: 22 },
  durabilityRatio: .8, loadout: { name: "主力", build: DEFAULT_BUILD },
});
check(nextMission(campaign).id === first, "Legacy save starts at the first mission");
check(normalizeCampaign({ completed: [CAMPAIGN_MISSIONS[2].id] }).completed.length === 0, "Save migration does not skip prerequisites");
check(normalizeCampaign({ journal: [null, { missionId: first }], completed: null }).journal.length === 0, "Malformed new fields are bounded safely");
check(!canPlayMission(campaign, "missing"), "Unknown mission cannot launch");
check(!settleMission(campaign, input(CAMPAIGN_MISSIONS[2].id)).ok, "Locked mission cannot settle");
const loss = settleMission(campaign, input(first, "enemy", "first-loss"));
check(loss.cleared && loss.firstClear, "Intro can progress through a loss");
check(loss.campaign.mastered.length === 0, "Loss does not master the win challenge");
check(!settleMission(loss.campaign, input(first, "enemy", "first-loss")).ok, "Duplicate result is rejected");
campaign = loss.campaign;
const bossLoss = settleMission(campaign, input(CAMPAIGN_MISSIONS[1].id, "enemy"));
check(!bossLoss.cleared && bossLoss.campaign.completed.length === 1, "Rival loss preserves the current objective");
check(bossLoss.campaign.journal.length === 2, "Loss remains in the journey log");
for (const mission of CAMPAIGN_MISSIONS) {
  check(Boolean(ARENAS[mission.arenaId]) && Object.entries(mission.enemyBuild).every(([slot, id]) => getPart(id)?.type === slot), `${mission.id} uses canonical arena and parts`);
  const simulation = new BattleSimulation({
    playerBuild: calculateBuild(DEFAULT_BUILD), enemyBuild: calculateBuild(mission.enemyBuild),
    arena: ARENAS[mission.arenaId], seed: mission.seed,
  });
  simulation.launch();
  for (let i = 0; i < 4600 && !simulation.result; i++) simulation.step(1 / 60);
  check(Boolean(simulation.result) && Number.isFinite(simulation.result.time), `${mission.id} reaches a real solver result`);
  const result = settleMission(campaign, input(mission.id));
  check(result.ok && result.cleared, `${mission.id} settlement advances/retains progression`);
  campaign = result.campaign;
}
check(nextMission(campaign) === null && campaign.completed.length === 10, "Final mission completes campaign");
const replay = settleMission(campaign, input(first));
check(!replay.firstClear && replay.campaign.completed.length === 10, "Replay never duplicates a memento");
for (let i = 0; i < 50; i++) campaign = settleMission(campaign, input(first)).campaign;
check(campaign.journal.length === 40, "Journal is bounded to 40 results");
check(JSON.stringify(normalizeCampaign(campaign)) === JSON.stringify(campaign), "Campaign round-trips through storage");

const out = resolve("../.impeccable/review/campaign");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true,
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
const key = "spin-core-web-prototype-v2";
await context.addInitScript((key) => {
  if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({
    version: 2, arenaId: "composite", coins: 700, sound: false,
    tutorial: { completed: true, stage: "complete", firstRewardClaimed: true },
  }));
}, key);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const base = process.env.LAB_TEST_URL ?? "http://127.0.0.1:5173";
const state = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key);
const capture = async (name) => {
  await page.locator(".game-shell").screenshot({ path: `${out}/${name}.png` });
};
try {
  await page.goto(`${base}/#journey`);
  await page.locator("#mission-select").waitFor();
  await page.waitForFunction(() => document.querySelector("#three-stage")?.dataset.assetState === "ready");
  check(await page.locator("#mission-select option").count() === 10, "Ten authored missions are reachable");
  check(await page.locator(".game-shell").getAttribute("data-arena") === "street", "Story starts on the authored street map");
  await capture("desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await capture("mobile");
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Mobile has no horizontal overflow");
  await page.selectOption("#mission-select", CAMPAIGN_MISSIONS[9].id);
  check(await page.locator("#start-battle").isDisabled(), "Future mission preview cannot launch");
  check((await state()).arenaId === "composite" && !(await state()).campaign, "Preview does not write progress or free arena preference");
  await capture("locked-mobile");
  await page.locator('.journey-modes [data-map-mode="free"]').click();
  check(await page.locator(".game-shell").getAttribute("data-arena") === "composite", "Free mode restores its original arena");
  check(await page.locator(".arena-card").count() === 5, "Free arena list remains available");
  await page.locator('.journey-modes [data-map-mode="story"]').click();
  await page.selectOption("#mission-select", first);
  await page.locator("#start-battle").click();
  await page.waitForFunction(() => !document.querySelector("#launch-button")?.disabled);
  check(await page.locator("#enemy-name").textContent() === "阿砾", "Battle HUD names the authored opponent");
  check(await page.locator("#campaign-brief").isVisible(), "Launch describes opponent and actual objective");
  await capture("launch-mobile");
  await page.locator("#launch-button").click();
  // Real RAF/solver battle. No mocked result, DOM mutations or exposed app instance.
  await page.locator("#result-card:not(.is-hidden)").waitFor({ timeout: 100000 });
  check((await state()).campaign.completed.includes(first), "Real finished battle settles the intro");
  const after = await state();
  check(after.campaign.journal.length === 1, "One battle produces one journal entry");
  check([740, 820].includes(after.coins), "Only canonical loss/win bounty is paid");
  check(after.campaign.journal[0].build.attackRing === DEFAULT_BUILD.attackRing, "Actual player's build is recorded");
  await capture("result-mobile");
  await page.locator("#result-restart").click();
  check(await page.locator("#mission-select").inputValue() === CAMPAIGN_MISSIONS[1].id, "Continue selects the next named rival");
  await page.reload();
  check(await page.locator("#mission-select").inputValue() === CAMPAIGN_MISSIONS[1].id, "Reload restores campaign progress");
  check((await state()).coins === after.coins, "Reload does not re-grant reward");
  await page.selectOption("#mission-select", first);
  await page.locator("#start-battle").click();
  await page.waitForFunction(() => !document.querySelector("#launch-button")?.disabled);
  await page.locator("#launch-button").click();
  await page.goto(`${base}/#journey`);
  check((await state()).campaign.journal.length === 1, "Abandoning a battle does not create a result");
  await page.goto(`${base}/#collection`);
  await page.waitForFunction(() => document.querySelector(".game-shell")?.dataset.screen === "collection" &&
    document.querySelector("[data-show-loadout]")?.disabled === false);
  await capture("collection-mobile");
  await page.locator('[data-collection="journey"]').click();
  check(new URL(page.url()).hash === "#journey", "Collection entry reaches the journey");
  check(errors.length === 0, `No browser errors: ${errors.join("; ")}`);

  const fresh = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const newPage = await fresh.newPage();
  await newPage.goto(`${base}/#journey`);
  check(await newPage.locator("#start-battle").isDisabled(), "Fresh tutorial is not confused with campaign");
  await newPage.locator('[data-journey-action="skip"]').click();
  check(await newPage.locator("#start-battle").isEnabled(), "Explicit skip opens campaign without a hidden gate");
  await fresh.close();
  console.log(`PASS: ${checks} campaign content, solver, state, browser and persistence checks. Captures: ${out}`);
} finally {
  await browser.close();
}
