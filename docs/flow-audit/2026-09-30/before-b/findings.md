# Assessment B: Detector and Browser Evidence

Independent evidence-only assessment. Assessment A and parent synthesis were not
read. No overall redesign, heuristic scoring, or implementation is proposed here.

## Scope and Provenance

- Target: `web-prototype/src/main.js`, including the actual assembly, journey,
  and lab routes it coordinates.
- Existing server: `http://127.0.0.1:5173`. It was not started, restarted, or stopped.
- Chrome `154.0.8037.59`, installed executable from the existing verification
  scripts; Playwright from `web-prototype/node_modules`.
- Fresh, non-persistent, headless contexts; no user's profile or save accessed.
  Viewports: 390x844 and 1440x1000, device scale 1, reduced motion.
  These are browser viewport checks, not real-device or mobile OS certification.
- Fixture follows `tools/verify-flow.mjs`: completed training, 700 coins, first
  mission `first-echo` completed, empty battle journal. Existing normalization
  supplies actual inventory/loadouts; no sample equipment or physics injection.
- Read `AGENTS.md`, `docs/README.md`, Web README, current DESIGN, Impeccable
  Assessment B guidance, `verify-flow.mjs`, and `verify-assembly.mjs`.
- No source interception, application object exposure, or injected game-state
  mutation after fixture creation. Actions used DOM controls. Mutable preflight changed
  title and executed a script, then restored/removed both in the isolated page.
- 24 survey screenshots, 3 injected overlay screenshots, 12 confirmation
  screenshots. One survey and one bounded confirmation pass.

## Confirmed Findings

Counts: **0 P0, 2 P1, 3 P2**. These are five triaged issues, not 335 unique defects.

### B1 / P1: Default lab front view hides the actual test result

Both sizes, minimal room: complete a real weight test, then wait for the notice
to expire. One report and 30 XP are saved, but the visible screen has no mass or
inertia values. The only remaining text output is a clipped 1x1 `sr-only` node.
Switching to the overhead view reveals mass `1.22` and inertia `0.890`.
The result is not lost; it is undiscoverable in the default view without changing
camera or opening records.

- Sources: `src/render/lab-stage.js:305-308` hides the monitor in minimal room;
  `src/ui/lab-screen.js:443-449` shows HTML values only for overhead view;
  `src/ui/lab-screen.js:337-352` creates the actual values and accessible output.
- Evidence: `confirmation-report.json`, checks `minimal-room-readout`.
- Screenshots: `confirm-lab-front-result-mobile.png`,
  `confirm-lab-top-result-mobile.png`, and matching `-desktop.png`.
- This is missing visible feedback, not a failed test or incorrect calculation.

### B2 / P1: Mobile header navigation has five unnamed controls

At 390x844, all five phase labels are `display:none`; buttons have neither
`aria-label` nor title. Playwright's accessibility snapshot is a named navigation
containing five bare `button` entries. Each target is 32x22 CSS pixels and appears
as an indistinguishable dot. At 1440x1000 the same controls have names.
Lower-page task actions still work, so this is not an app-wide navigation lock.

- Sources: `src/main.js:232-237`; `src/styles.css:1479-1487`.
- Evidence: `confirmation-report.json`, `header-battle-action`, mobile `aria`
  and `phaseButtons`; `assembly-mobile.json`.
- Screenshots: `assembly-mobile.png`, `journey-mobile.png`,
  `confirm-header-mobile.png`.

### B3 / P2: Wind control intercepts the Help action

Both sizes: clicking the Help button's center opens wind controls, not Help.
A normal Playwright Help click times out with the wind button intercepting
pointer events. Keyboard focus plus Enter opens the correct Help dialog.
The visible upper part of the icon remains a possible pointer workaround;
the Help label itself is completely covered.

- Mobile Help rect: x343.22 y306.70 w33.53 h42. Wind: x289.89 y322.15
  w84.52 h29.25. Help center x359.98 y327.70 hits `[data-lab="wind"]`.
- Desktop Help rect: x933.75 y328.16 w48.38 h58.72. Wind starts at y356.
  Help center likewise hits Wind.
- Sources: `src/ui/lab-screen.js:70-78`; `src/ui/lab.css:67-71,172-175`.
- Detector corroboration: lab `text-occlusion`, Help text 100% covered.
- Evidence: `confirmation-report.json`, `lab-help-overlap`, including exact
  interception timeout, geometry, wrong-action result, and keyboard recovery.
- Screenshots: `confirm-help-center-mobile.png`,
  `confirm-help-keyboard-mobile.png`, and matching desktop captures.

### B4 / P2: Header Battle button has no action

The desktop header presents Battle like its neighboring route buttons. Clicking
`[data-phase-only="battle"]` leaves both URL and active screen at assembly, with
no explanation. Mobile has the same no-op, additionally unnamed as described B2.
The bottom journey CTA and actual launch preparation work.

- Sources: `src/main.js:237` supplies `data-phase-only`, while route delegation
  in `src/main.js:550-557` handles only `data-go`. No handler for the former.
- Evidence: `confirmation-report.json`, `header-battle-action`, before/after.
- Screenshots: `confirm-header-desktop.png`, `confirm-header-mobile.png`.

### B5 / P2: Functional text remains too small or low contrast

In the minimal lab, title and utility labels retain near-white ink over the
light room. Utility labels and XP are 7.41px at 390x844, 10.6875px at desktop;
the title's readability relies on its shadow. The live detector reports seven
lab contrast occurrences, 2.1-2.2:1 against the CSS fallback `#a2b1b2`.
Those ratios are not measured canvas-composited contrast: the actual minimal
room is lighter (`#f7f3e9`). Screenshots corroborate the readability concern.
The assembly/journey primary CTA independently has white text on `#238cff`,
reported 3.4:1; this is not a warning against using the pinned blue itself.

- Sources: `src/ui/lab.css:48-49,62,68-71`; childhood-only correction at 189-194;
  `src/render/lab-stage.js:151`; `src/styles.css:1919-1923`.
- Evidence: `confirmation-report.json`, lab `geometry`; `overlay-report.json`.
- Screenshots: `lab-mobile.png`, `lab-desktop.png`, `assembly-mobile.png`,
  `journey-mobile.png`.

## CLI Detector

Executed exactly once from repository root:

```text
C:\Users\Admin\.trae-cn\skills\impeccable\scripts\impeccable.cmd detect --json web-prototype/src/main.js
```

Exit **0**, stdout **[]**, empty stderr: **0 findings, no rules or file locations
with findings, no CLI false positives**. Scope is one JS file, not all imported
CSS or live UI. Files: `detector.json`, `detector-run.json`.

## Live Detector

Mutable title/script execution preflight succeeded (`injection-preflight.json`).
Started `live-server --background` in this diagnostic directory, received PID
11044 and port 8400, and injected `http://localhost:8400/detect.js` into three
fresh headless tabs: assembly, journey, lab. Waited three seconds each.
All injections executed and emitted Impeccable console findings. No browser
presentation tool was exposed; **no human-visible browser tab is claimed**.

| Route, 390x844 | Headline Element Groups | Rule Occurrences |
| --- | ---: | ---: |
| assembly | 98 | 109 |
| journey | 75 | 86 |
| lab | 113 | 140 |
| Total, not deduplicated | 286 | 335 |

The detector headline counts element groups, not individual rule occurrences.
Verified in served `detect.js:3487-3502`: it prints `allFindings.length`, then
logs each finding for each element. The SPA mounts hidden routes too; totals
are neither visible-only nor unique defects.

| Rule | Assembly | Journey | Lab |
| --- | ---: | ---: | ---: |
| undersized-ui-text | 72 | 55 | 78 |
| low-contrast | 5 | 5 | 7 |
| clipped-overflow-container | 4 | 4 | 3 |
| dark-glow | 5 | 5 | 7 |
| layout-transition | 3 | 3 | 3 |
| radial-spotlight-glow | 1 | 1 | 0 |
| gpt-thin-border-wide-shadow | 5 | 3 | 4 |
| text-overflow | 3 | 3 | 0 |
| tiny-text | 2 | 1 | 2 |
| wide-tracking | 1 | 1 | 1 |
| ai-color-palette | 2 | 0 | 27 |
| kicker-above-heading | 1 | 1 | 1 |
| side-tab | 1 | 1 | 1 |
| radial-halo | 1 | 1 | 1 |
| repeating-stripes-gradient | 1 | 0 | 0 |
| codex-grid-background | 1 | 1 | 1 |
| text-occlusion | 1 | 1 | 1 |
| nested-cards | 0 | 0 | 3 |

Full raw console and source locations are in `overlay-report.json`; normalized
counts are in `detector-summary.json` and `aggregate.json`. Live findings do not
include application source-line mappings. Relevant source files were traced
manually: `src/main.js`, `src/styles.css`, `src/ui/lab.css`,
`src/ui/lab-screen.js`, and `src/ui/campaign-panel.js`.

## False Positives and Limits

- **Two of three `text-occlusion` reports excluded**: assembly's current-room
  label is inside the closed room disclosure; journey's story paragraph is
  inside the closed story disclosure. These are not blocked visible text.
  The third, lab Help, is reproduced and retained as B3.
- Six `text-overflow` logs repeat 99px/247px/315px spans in the shared live
  status region. The source deliberately puts them in `.sr-only`, styled as a
  clipped 1x1 region (`main.js:326-331`, `styles.css:2715-2724`).
  Do not report these as horizontal document overflow.
- Undersized/kicker/layout/glow logs include inactive battle HUD, result, DIY,
  and closed disclosure content. Examples include `YOU`, `BATTLE COMPLETE`,
  and symmetry labels during assembly/lab. No blanket visible-defect count is
  claimed for these raw logs.
- Initial center-hit scanning flagged journey disclosures below the sheet's
  clip. Normal clicking scrolls the sheet and opens the journal: scrollTop
  185 mobile, 74 desktop. `confirm-journey-scrolled-*.png` and
  `confirmation-report.json` exclude this as blocked navigation.
- Palette, glow, shadows, grid, and nested-card advisories are not evidence to
  replace the pinned assembly/lab world. No claim that all are defects or all
  are false; user-pinned visual language takes precedence.
- Overlay labels create extra overflow in the injected captures (for example
  overlay-lab is 514px wide despite a 390px viewport). Baseline documents remain
  exactly 390/1440px wide. Do not attribute overlay overflow to application CSS.
- The lab detector contrast ratios use CSS ancestry, not the WebGL background.
  Actual rendered contrast was not pixel-sampled.

## Passing Flow Evidence

The survey completed 26 action scenarios without a failed action:
comparison open/close; outfit/care entry and Save; return to top; assembly to
journey; replay preparation through assembly/lab with refresh and correct
`first-echo` return; real launch preparation/cancel; locked mission launch
disabled; actual lab test saving one report/30 XP; records and Escape; lab
to free battle. All six baseline documents have no horizontal overflow.

No JavaScript page errors, console errors, failed requests, or HTTP >=400
responses in the survey or injected tabs. Warnings are retained:
20 AudioContext gesture warnings and 16 Three.js PMREM sample-limit warnings
in the survey; 6 and 2 respectively in the three injected tabs.
These did not block the checked actions. Confirmation also recorded no page
or console errors. No full battle settlement, fresh-player training, Safari,
real-device performance, unit suite, or build is claimed.

## Files and Cleanup

- Main results: this file, `survey-report.json`, `confirmation-report.json`.
- Reproduction: `capture.mjs` (`detector`, `survey`, `overlay <owned-port>`),
  `confirm.mjs`. Scripts are diagnostic artifacts only.
- Every named screenshot has same-name DOM/geometry JSON for survey/overlay;
  confirmation screenshots use the consolidated confirmation JSON.
- `cleanup.json`: owned live-server stopped via
  `live-server stop --keep-inject` from its isolated working directory.
  PID 11044 absent; port 8400 ECONNREFUSED; original port 5173 HTTP 200.
  All owned Chrome contexts were closed.
- `src/main.js` SHA256 unchanged across detector, survey, overlay, and cleanup:
  `59d026247f62d84ad88fc9525bb6161a4c97f38325cbe9f33ec6dbc71bea07ac`.
- No application code, HTML, styles, user's save, or existing server changed.
  All authored files/captures are under this `before-b/` directory.
