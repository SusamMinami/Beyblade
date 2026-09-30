import { normalizePartCustomization } from "./part-customization.js";

// Mounted model anchors shared with rendering. COM offsets remain part-local.
export const SLOT_Y = Object.freeze({
  attackRing: .24, coreLock: .42, weightDisc: .02, driverShaft: -.22, tip: -.56,
});
export const BATTLE_MODEL_SCALE = .92;

export function assemblySupport(build, runtimeParts = null) {
  const tipHeight = normalizePartCustomization(build.customizations[build.selection.tip]).height;
  const tipBottom = build.selection.tip === "tip.metal_stamina" ? -.21625
    : build.selection.tip === "tip.flat_attack" ? -.1275 : -.2028;
  const contactOffset = -(SLOT_Y.tip + tipBottom * tipHeight);
  let mass = 0, moment = 0;
  const anchors = Object.values(SLOT_Y);
  build.parts.forEach((part, index) => {
    const remaining = part.mass - (runtimeParts?.[index]?.lostMass ?? 0);
    mass += remaining;
    moment += remaining * (anchors[index] + part.center[1]);
  });
  return { contactOffset, supportHeight: Math.max(.05,
    (contactOffset + moment / mass) * BATTLE_MODEL_SCALE) };
}
