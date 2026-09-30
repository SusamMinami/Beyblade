## verdict

1. resolved: F1, keyboard targeting and synchronized reticle/label/instructions. The valid 390x694 game-shell capture [keyboard-mobile.png](keyboard-mobile.png) visibly places the reticle on the transmission, with transmission-contact feedback, 73% efficiency and an unsaved maintenance draft. `maintenance-stage.js` updates the ray-hit reticle with selected-slot filtering and uses its coordinates for Enter; the accessible label and README describe the same reticle-based action.

Supporting evidence: `verify-launcher-outfit.mjs:117-121` focuses transmission, presses Enter and asserts a transmission-zone oil sample. Supplied [launcher.log](launcher.log) records PASS for 24 browser contracts and 4 numerical performance contracts across 27 combinations; [build.log](build.log) records a successful build. The reported direct diagnostic (`hit.zone` transmission, one sample after Enter) is supplied evidence, not independently reproduced.

Scope: ship covers the single scored fix from [finish-review.md](finish-review.md), not the whole surface. Review used screenshots, code and supplied logs only; no browser execution, test rerun or detector rerun. The unchanged `desktop.png`, `mobile.png` and `outfit-mobile.png` were inspected only for comparison.

## remaining

clear. No fix-introduced regressions observed in the reviewed evidence.

disposition: ship
