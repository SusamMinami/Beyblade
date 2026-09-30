import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { resolve, dirname, join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
const out = dirname(fileURLToPath(import.meta.url));
const root = resolve(out, "../../../..");
const require = createRequire(join(root, "web-prototype/package.json"));
const { chromium } = require("playwright");
const { seed } = JSON.parse(await readFile(join(out, "survey-report.json"), "utf8"));
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const report = { purpose: "One bounded confirmation pass; no detector or app injection", checks: [], events: [] };
const save = (name, x) => writeFile(join(out, name), JSON.stringify(x, null, 2));
const capture = async (page, name) => {
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  await page.screenshot({ path: join(out, `${name}.png`) });
};
const inspect = (page, selectors) => page.evaluate(selectors => selectors.map(selector => {
  const el = document.querySelector(selector);
  if (!el) return { selector, missing: true };
  const r = el.getBoundingClientRect(), s = getComputedStyle(el);
  const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
  return {
    selector, text: el.textContent.trim(), innerText: el.innerText,
    ariaLabel: el.getAttribute("aria-label"), title: el.title,
    visible: el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }),
    rect: { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom, right: r.right },
    color: s.color, backgroundColor: s.backgroundColor, fontSize: s.fontSize,
    centerHit: hit ? { tag: hit.tagName, id: hit.id, data: { ...hit.dataset }, text: hit.innerText } : null,
  };
}), selectors);
try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
    const size = viewport.width === 390 ? "mobile" : "desktop";
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    await context.addInitScript(seed => {
      if (!localStorage.getItem("spin-core-web-prototype-v2")) {
        localStorage.setItem("spin-core-web-prototype-v2", JSON.stringify(seed));
      }
    }, seed);
    const page = await context.newPage();
    page.on("pageerror", e => report.events.push({ size, kind: "pageerror", text: e.message }));
    page.on("console", m => {
      if (["warning", "error"].includes(m.type())) report.events.push({ size, type: m.type(), text: m.text() });
    });
    try {
      await page.goto("http://127.0.0.1:5173/#assembly");
      await page.waitForTimeout(1500);
      const before = await page.evaluate(() => ({ url: location.href, screen: document.querySelector(".game-shell").dataset.screen }));
      const phaseButtons = await inspect(page, [".phase-nav", ...["assembly", "map", "lab", "collection"].map(x => `.phase[data-go="${x}"]`), '[data-phase-only="battle"]']);
      const aria = await page.locator(".phase-nav").ariaSnapshot();
      await page.locator('[data-phase-only="battle"]').click();
      await page.waitForTimeout(350);
      const after = await page.evaluate(() => ({ url: location.href, screen: document.querySelector(".game-shell").dataset.screen }));
      report.checks.push({ size, name: "header-battle-action", before, after, phaseButtons, aria });
      await capture(page, `confirm-header-${size}`);

      await page.goto("http://127.0.0.1:5173/#journey");
      await page.locator("#mission-select").waitFor();
      await page.locator(".journey-log > summary").click({ timeout: 4000 });
      const logOpen = await page.locator(".journey-log").evaluate(el => el.open);
      const scrollTop = await page.locator("#campaign-panel").evaluate(el => el.scrollTop);
      report.checks.push({ size, name: "journey-clipping-is-scrollable", logOpen, scrollTop });
      await capture(page, `confirm-journey-scrolled-${size}`);

      await page.goto("http://127.0.0.1:5173/#lab");
      await page.waitForFunction(() => document.querySelector('[data-lab="test"]')?.disabled === false);
      const geometry = await inspect(page, ['[data-lab="help"]', '[data-lab="help"] small', '[data-lab="wind"]', ".lab-title h1", ".lab-title p", ".lab-level small", '[data-lab="records"] small']);
      const helpBox = await page.locator('[data-lab="help"]').boundingBox();
      await page.mouse.click(helpBox.x + helpBox.width / 2, helpBox.y + helpBox.height / 2);
      const centerEffect = await page.evaluate(() => ({
        dialogOpen: document.querySelector(".lab-dialog").open,
        windOpen: !document.querySelector(".lab-wind-controls").hidden,
        windAriaExpanded: document.querySelector('[data-lab="wind"]').getAttribute("aria-expanded"),
      }));
      let defaultClick;
      try {
        await page.locator('[data-lab="help"]').click({ timeout: 1600 });
        defaultClick = { succeeded: true };
      } catch (e) { defaultClick = { succeeded: false, error: e.message }; }
      await capture(page, `confirm-help-center-${size}`);
      if (!(await page.locator(".lab-dialog").evaluate(el => el.open))) {
        await page.locator('[data-lab="help"]').focus();
        await page.keyboard.press("Enter");
      }
      const keyboardEffect = await page.locator(".lab-dialog").evaluate(el => ({ open: el.open, title: el.querySelector("h2").textContent }));
      await capture(page, `confirm-help-keyboard-${size}`);
      await page.keyboard.press("Escape");
      report.checks.push({ size, name: "lab-help-overlap", geometry, centerEffect, defaultClick, keyboardEffect });

      if (await page.locator('[data-lab="wind"]').getAttribute("aria-expanded") === "true") {
        await page.locator('[data-lab="wind"]').click();
      }
      await page.locator('[data-lab="test"]').click();
      await page.waitForTimeout(8600);
      const front = await inspect(page, [".lab-overhead-values", ".lab-accessible-readout", ".lab-notice"]);
      const saved = await page.evaluate(() => {
        const x = JSON.parse(localStorage.getItem("spin-core-web-prototype-v2"));
        return { room: x.lab.settings.room, xp: x.lab.xp, records: x.lab.records };
      });
      await capture(page, `confirm-lab-front-result-${size}`);
      await page.locator('[data-view="top"]').click();
      await page.waitForTimeout(300);
      const overhead = await inspect(page, [".lab-overhead-values"]);
      await capture(page, `confirm-lab-top-result-${size}`);
      report.checks.push({ size, name: "minimal-room-readout", front, overhead, saved });
      console.log(`Confirmed ${size}`);
    } catch (error) {
      report.checks.push({ size, name: "confirmation-error", error: error.message });
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
  await save("confirmation-report.json", report);
}

const overlay = JSON.parse(await readFile(join(out, "overlay-report.json"), "utf8"));
const summary = overlay.pages.map(page => {
  const rules = {};
  for (const event of page.events) {
    const match = event.text?.match(/^%c([a-z][a-z-]+)%c/);
    if (match) rules[match[1]] = (rules[match[1]] ?? 0) + 1;
  }
  const headline = page.events.find(e => e.text?.includes("[impeccable]"))?.text;
  return {
    page: page.name, headline,
    elementGroups: Number(headline?.match(/(\d+) anti-pattern/)?.[1] ?? 0),
    ruleOccurrences: Object.values(rules).reduce((a, b) => a + b, 0), rules,
  };
});
await save("detector-summary.json", {
  cli: { target: "web-prototype/src/main.js", findings: 0, rules: [], filesWithFindings: [] },
  browser: summary,
  countsExplanation: "detect.js printSummary counts element groups in its headline, then logs each finding in each group. Counts are not unique UX defects.",
  headlineSource: "detect.js lines 3487-3502",
});
console.log(JSON.stringify(summary, null, 2));
