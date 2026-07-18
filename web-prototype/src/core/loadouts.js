import { DEFAULT_BUILD, getPart } from "../data/parts.js";

export const LOADOUT_COUNT = 3;

const DEFAULT_COLORS = Object.freeze([
  { ring: "#27c9b3", core: "#efbd3c" },
  { ring: "#f45b2a", core: "#2d78da" },
  { ring: "#7567d9", core: "#e8d5a1" },
]);

const LOADOUT_NAMES = Object.freeze(["主力", "突击", "续航"]);

function normalizeBuild(build = {}) {
  const normalized = { ...DEFAULT_BUILD };
  for (const [slot, partId] of Object.entries(build)) {
    const part = getPart(partId);
    if (part?.type === slot) normalized[slot] = partId;
  }
  return normalized;
}

function normalizeColors(colors = {}, fallback) {
  return {
    ring: colors.ring ?? fallback.ring,
    core: colors.core ?? fallback.core,
  };
}

export function createDefaultLoadouts(build = DEFAULT_BUILD, colors = {}) {
  return Array.from({ length: LOADOUT_COUNT }, (_, index) => ({
    id: `loadout-${index + 1}`,
    name: LOADOUT_NAMES[index],
    build: normalizeBuild(index === 0 ? build : DEFAULT_BUILD),
    colors: normalizeColors(
      index === 0 ? colors : DEFAULT_COLORS[index],
      DEFAULT_COLORS[index],
    ),
  }));
}

export function migrateLoadouts(saved = {}) {
  const fallback = createDefaultLoadouts(saved.build, saved.colors);
  const loadouts = fallback.map((item, index) => {
    const savedLoadout = saved.loadouts?.[index];
    if (!savedLoadout) return item;
    return {
      ...item,
      name: savedLoadout.name || item.name,
      build: normalizeBuild(savedLoadout.build),
      colors: normalizeColors(savedLoadout.colors, item.colors),
    };
  });
  const activeLoadoutIndex = Math.min(
    Math.max(Math.floor(Number(saved.activeLoadoutIndex) || 0), 0),
    loadouts.length - 1,
  );
  return { loadouts, activeLoadoutIndex };
}
