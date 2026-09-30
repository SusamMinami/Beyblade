## verdict

- **F1: resolved.** [mobile-dirty.png](mobile-dirty.png) is a scrolled footer capture showing both equipment-unsaved and maintenance-unsaved labels beside Save; [outfit-red.png](outfit-red.png) shows the equipment-only dirty state. [refresh()](../../../web-prototype/src/ui/maintenance-screen.js#L277-L281) combines both drafts independently of mode and labels preview separately. The supplied contracts confirm both mode-switch directions, center oil application, and saving both drafts without equipping the locked preview.
- **F2: resolved.** [mobile-focus.png](mobile-focus.png) shows the transmission close-up with focus retained on selected T02 after preview. Slot and part buttons are built once, refreshed in place, and guarded with `aria-disabled` during loading instead of losing focus through native disabling or replacement. Equipping transfers focus to the selected part. The supplied keyboard contracts confirm slot activation, asynchronous preview, trial, and Save via Tab/Enter.
- **F3: resolved.** [desktop.png](desktop.png) and [mobile.png](mobile.png) visibly distinguish the focused selected mode; [mobile-focus.png](mobile-focus.png) distinguishes focused selected T02 from the selected slot. [maintenance.css](../../../web-prototype/src/ui/maintenance.css#L42-L49) provides an outer 2px outline with a 2px paper gap, and hover/active rules exclude selected buttons.

## remaining

clear. No batch-introduced regressions identified in the supplied evidence and target files.

All five required captures were opened and validated, including the explicitly scrolled footer. Capture timestamps span 2026-09-24 18:55:23-18:55:31. [browser.json](browser.json) and [review-fixes-check.log](review-fixes-check.log) record 24 passing browser contracts and no browser exceptions; these are supplied results, not checks rerun by this reviewer.

Fresh independent evidence-only Verdict Pass under the supplied contract; no implementation edits, browser, or detector. Ship applies only to the scored F1-F3 fixes, not the whole surface.

disposition: ship
