// Names, ownership and test results do not change the rendered geometry.
// Store a value snapshot: DIY editors mutate the loadout in place.
export function loadoutVisualKey(loadout) {
  return JSON.stringify([loadout.build, loadout.colors, loadout.customizations ?? {}]);
}
