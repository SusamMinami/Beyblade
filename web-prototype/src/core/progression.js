import { DEFAULT_BUILD, getPart, PARTS } from "../data/parts.js";

export const STORAGE_VERSION = 2;

export const TUTORIAL_STAGE = Object.freeze({
  FIRST_BATTLE: "first_battle",
  BUY_FIRST_PART: "buy_first_part",
  SECOND_BATTLE: "second_battle",
  COMPLETE: "complete",
});

export const BATTLE_REWARDS = Object.freeze({
  FIRST_BATTLE: 180,
  WIN: 120,
  LOSS: 40,
});

export const INITIAL_OWNED_PART_IDS = Object.freeze(
  Object.values(DEFAULT_BUILD),
);

const VALID_PART_IDS = new Set(PARTS.map((part) => part.id));
const VALID_TUTORIAL_STAGES = new Set(Object.values(TUTORIAL_STAGE));

export function createTutorialState() {
  return {
    stage: TUTORIAL_STAGE.FIRST_BATTLE,
    completed: false,
    firstRewardClaimed: false,
  };
}

export function migrateProgression(saved = {}) {
  const ownedPartIds = new Set(INITIAL_OWNED_PART_IDS);
  for (const partId of saved.ownedPartIds ?? []) {
    if (VALID_PART_IDS.has(partId)) ownedPartIds.add(partId);
  }
  for (const partId of Object.values(saved.build ?? {})) {
    if (VALID_PART_IDS.has(partId)) ownedPartIds.add(partId);
  }
  for (const loadout of saved.loadouts ?? []) {
    for (const partId of Object.values(loadout.build ?? {})) {
      if (VALID_PART_IDS.has(partId)) ownedPartIds.add(partId);
    }
  }

  const savedTutorial = saved.tutorial ?? {};
  const tutorial =
    saved.version === STORAGE_VERSION
      ? {
          stage: VALID_TUTORIAL_STAGES.has(savedTutorial.stage)
            ? savedTutorial.stage
            : TUTORIAL_STAGE.FIRST_BATTLE,
          completed: Boolean(savedTutorial.completed),
          firstRewardClaimed: Boolean(savedTutorial.firstRewardClaimed),
        }
      : createTutorialState();

  if (tutorial.completed) tutorial.stage = TUTORIAL_STAGE.COMPLETE;

  return {
    version: STORAGE_VERSION,
    coins: Math.max(0, Math.floor(Number(saved.coins) || 0)),
    ownedPartIds: [...ownedPartIds],
    tutorial,
  };
}

export function getPartAccess(part, progression) {
  const owned = progression.ownedPartIds.includes(part.id);
  return {
    owned,
    affordable: !owned && progression.coins >= part.price,
    missingCoins: owned
      ? 0
      : Math.max(0, part.price - progression.coins),
  };
}

export function purchasePart(progression, partId) {
  const part = getPart(partId);
  if (!part) return { ok: false, reason: "unknown_part" };

  const access = getPartAccess(part, progression);
  if (access.owned) return { ok: false, reason: "already_owned" };
  if (!access.affordable) {
    return {
      ok: false,
      reason: "insufficient_coins",
      missingCoins: access.missingCoins,
    };
  }

  return {
    ok: true,
    progression: {
      ...progression,
      coins: progression.coins - part.price,
      ownedPartIds: [...progression.ownedPartIds, part.id],
    },
  };
}

export function getBattleReward({ won, tutorial }) {
  if (
    tutorial.stage === TUTORIAL_STAGE.FIRST_BATTLE &&
    !tutorial.firstRewardClaimed
  ) {
    return BATTLE_REWARDS.FIRST_BATTLE;
  }
  return won ? BATTLE_REWARDS.WIN : BATTLE_REWARDS.LOSS;
}
