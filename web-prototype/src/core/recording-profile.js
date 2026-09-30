import { PARTS } from "../data/parts.js";
import { CAMPAIGN_MISSIONS } from "../data/campaign.js";
import { LAUNCHER_PARTS } from "./launcher-state.js";
import { PART_MATERIAL_LIST } from "./part-customization.js";
import { DISPLAY_STAGES } from "./showroom-state.js";
import { STORAGE_VERSION, TUTORIAL_STAGE } from "./progression.js";

// The dev-only recording entry calls this before the usual save migrations.
// Use the actual catalog and progression fields; keep equipped builds, DIY,
// colors and real history. No invented battle results or measurement reports.
export function unlockRecordingProfile(saved = {}) {
  const source = saved && typeof saved === "object" ? saved : {};
  const maxStageLevel = Math.max(2, ...DISPLAY_STAGES.map(stage => stage.level));
  return {
    ...source,
    version: STORAGE_VERSION,
    coins: Math.max(9999, Number(source.coins) || 0),
    ownedPartIds: [...PARTS, ...LAUNCHER_PARTS].map(part => part.id),
    ownedMaterialIds: PART_MATERIAL_LIST.map(material => material.id),
    tutorial: {
      ...source.tutorial,
      completed: true,
      stage: TUTORIAL_STAGE.COMPLETE,
      firstRewardClaimed: true,
    },
    campaign: {
      ...source.campaign,
      completed: CAMPAIGN_MISSIONS.map(mission => mission.id),
    },
    lab: {
      ...source.lab,
      xp: Math.max(120 * (maxStageLevel - 1) ** 2, Number(source.lab?.xp) || 0),
      settings: { ...source.lab?.settings, followStory: false },
    },
    showroom: {
      ...source.showroom,
      owned: DISPLAY_STAGES.map(stage => stage.id),
      followStory: false,
    },
  };
}
