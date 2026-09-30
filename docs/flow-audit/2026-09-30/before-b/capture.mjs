import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { resolve, dirname, join } from "node:path";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

const out = dirname(fileURLToPath(import.meta.url));
const root = resolve(out, "../../../..");
const require = createRequire(join(root, "web-prototype/package.json"));
const { chromium } = require("playwright");
const { CAMPAIGN_MISSIONS } = await import("../../../../web-prototype/src/data/campaign.js");
const base = "http://127.0.0.1:5173";
const launcher = "C:\\Users\\Admin\\.trae-cn\\skills\\impeccable\\scripts\\impeccable.cmd";
const key = "spin-core-web-prototype-v2";
const first = CAMPAIGN_MISSIONS[0].id;
const seed = {
  version: 2, coins: 700, sound: false, arenaId: "standard",
  tutorial: { completed: true, stage: "complete", firstRewardClaimed: true },
  campaign: { completed: [first], mastered: [], journal: [] },
};
const write = (name, value) => writeFile(join(out, name), JSON.stringify(value, null, 2));
const mode = process.argv[2] ?? "survey";
await mkdir(out, { recursive: true });
const target = join(root, "web-prototype/src/main.js");
const sha = async () => createHash("sha256").update(await readFile(target)).digest("hex");

if (mode === "detector") {
  const run = spawnSync(`"${launcher}" detect --json web-prototype/src/main.js`, {
    cwd: root, shell: true, encoding: "utf8", timeout: 120000,
  });
  await writeFile(join(out, "detector.json"), run.stdout ?? "");
  await write("detector-run.json", {
    command: `${launcher} detect --json web-prototype/src/main.js`,
    cwd: root, exitCode: run.status, stderr: run.stderr,
    error: run.error?.message, targetSha256: await sha(), capturedAt: new Date().toISOString(),
  });
  console.log(JSON.stringify({ exitCode: run.status, stdout: run.stdout, stderr: run.stderr }));
  process.exit(run.status === 0 || run.status === 2 ? 0 : 1);
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const report = {
  assessment: "B", mode, base, capturedAt: new Date().toISOString(), browser: browser.version(),
  headless: true, userProfileUsed: false, sourceIntercepted: false,
  targetSha256Before: await sha(), seed, pages: [], actions: [], errors: [],
};
const pause = page => page.evaluate(() => new Promise(done =>
  requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(done)))));
const contextFor = async viewport => {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  await context.addInitScript(({ key, seed }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(seed));
  }, { key, seed });
  return context;
};
const attach = (page, name) => {
  const events = [];
  page.on("pageerror", error => events.push({ kind: "pageerror", text: error.message }));
  page.on("console", message => events.push({
    kind: "console", type: message.type(), text: message.text(), location: message.location(),
  }));
  page.on("requestfailed", request => events.push({
    kind: "requestfailed", url: request.url(), failure: request.failure(),
  }));
  page.on("response", response => {
    if (response.status() >= 400) events.push({ kind: "http", url: response.url(), status: response.status() });
  });
  report.pages.push({ name, events });
  return events;
};
async function ready(page, route) {
  if (route === "lab") await page.waitForFunction(() =>
    document.querySelector('[data-lab="test"]')?.disabled === false, null, { timeout: 45000 });
  else if (route === "assembly") {
    await page.locator("#three-stage canvas").waitFor({ timeout: 45000 });
    await page.waitForTimeout(1200);
  } else {
    await page.locator("#mission-select").waitFor({ timeout: 45000 });
    await page.waitForFunction(() =>
      document.querySelector("#three-stage")?.dataset.assetState === "ready", null, { timeout: 45000 });
  }
  await pause(page);
}
async function snapshot(page, name) {
  await pause(page);
  const data = await page.evaluate(() => {
    const rect = el => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    };
    const path = el => !el ? null : `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${el.className && typeof el.className === "string" ? `.${el.className.trim().replace(/\s+/g, ".")}` : ""}`;
    const controls = [...document.querySelectorAll("button,select,input,summary,a[href],[role=button]")].map(el => {
      const r = rect(el), style = getComputedStyle(el);
      const cssVisible = el.checkVisibility ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) : style.display !== "none";
      if (!cssVisible || r.width < 1 || r.height < 1) return null;
      const inViewport = r.right > 0 && r.bottom > 0 && r.x < innerWidth && r.y < innerHeight;
      const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
      const top = document.elementFromPoint(cx, cy);
      const hit = top === el || el.contains(top);
      return {
        selector: path(el), text: (el.innerText || el.getAttribute("aria-label") || el.value || "").trim(),
        data: { ...el.dataset }, ariaLabel: el.getAttribute("aria-label"),
        rect: r, inViewport, hitAtCenter: hit, centerCoveredBy: hit ? null : path(top),
        disabled: Boolean(el.disabled), pointerEvents: style.pointerEvents,
        fontSize: style.fontSize, tabIndex: el.tabIndex,
      };
    }).filter(Boolean);
    return {
      url: location.href, title: document.title,
      viewport: { width: innerWidth, height: innerHeight },
      documentSize: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
      shell: document.querySelector(".game-shell") ? rect(document.querySelector(".game-shell")) : null,
      text: document.body.innerText,
      controls,
      scrollContainers: [...document.querySelectorAll("*")].filter(el => {
        const r = el.getBoundingClientRect(), s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && /auto|scroll/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1;
      }).map(el => ({ selector: path(el), rect: rect(el), scrollTop: el.scrollTop, clientHeight: el.clientHeight, scrollHeight: el.scrollHeight })),
    };
  });
  await write(`${name}.json`, data);
  await page.screenshot({ path: join(out, `${name}.png`), fullPage: true });
  console.log(`Captured ${name}`);
  return data;
}
async function action(page, label, fn) {
  const beforeUrl = page.url();
  try {
    const result = await fn();
    report.actions.push({ label, beforeUrl, afterUrl: page.url(), status: "completed", result });
    console.log(`Action completed: ${label}`);
    return true;
  } catch (error) {
    report.actions.push({ label, beforeUrl, afterUrl: page.url(), status: "failed", error: error.message });
    console.log(`Action failed: ${label}: ${error.message.slice(0, 400)}`);
    return false;
  }
}
const click = (page, selector) => page.locator(selector).click({ timeout: 3500 });
try {
  if (mode === "survey") {
    for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
      const size = viewport.width === 390 ? "mobile" : "desktop";
      for (const route of ["assembly", "journey", "lab"]) {
        const context = await contextFor(viewport);
        const page = await context.newPage();
        attach(page, `${route}-${size}`);
        try {
          await page.goto(`${base}/#${route}`);
          await ready(page, route);
          await snapshot(page, `${route}-${size}`);
          if (!report.preflight) {
            report.preflight = await page.evaluate(() => {
              const originalTitle = document.title;
              document.title = "Assessment B injection preflight";
              const script = document.createElement("script");
              script.id = "assessment-b-injection-preflight";
              script.textContent = "window.__assessmentBInjected = 'executed';";
              document.head.appendChild(script);
              const evidence = {
                titleMutation: document.title === "Assessment B injection preflight",
                scriptPresent: Boolean(document.getElementById(script.id)),
                scriptExecuted: window.__assessmentBInjected === "executed",
                originalTitle,
              };
              document.title = originalTitle;
              script.remove();
              delete window.__assessmentBInjected;
              return evidence;
            });
            await write("injection-preflight.json", report.preflight);
          }
          if (route === "assembly") {
            await action(page, `${size}: assembly comparison opens`, async () => {
              await click(page, "#assembly-comparison > summary");
              await snapshot(page, `assembly-comparison-${size}`);
              return page.locator("#assembly-comparison").evaluate(el => el.open);
            });
            await action(page, `${size}: assembly comparison closes`, () => click(page, "#assembly-comparison > summary"));
            for (const tool of ["outfit", "care"]) {
              await action(page, `${size}: assembly ${tool} and save reachable`, async () => {
                await click(page, `[data-workshop="${tool}"]`);
                await page.locator('[data-maintenance="save"]').waitFor({ timeout: 30000 });
                await page.waitForTimeout(1500);
                await snapshot(page, `assembly-${tool}-${size}`);
                await click(page, '[data-maintenance="save"]');
                return { url: page.url(), saveText: await page.locator('[data-maintenance="save"]').innerText() };
              });
            }
            await action(page, `${size}: return top assembly`, () => click(page, '[data-workshop="top"]'));
            await action(page, `${size}: assembly CTA opens journey`, async () => {
              await click(page, "#go-map");
              await ready(page, "journey");
              return { url: page.url(), mission: await page.locator("#mission-select").inputValue() };
            });
          }
          if (route === "journey") {
            await page.selectOption("#mission-select", first);
            await pause(page);
            for (const destination of ["assembly", "lab"]) {
              const ok = await action(page, `${size}: replay preparation to ${destination} and back after reload`, async () => {
                await click(page, `.journey-prep [data-go="${destination}"]`);
                await ready(page, destination);
                await page.reload();
                await ready(page, destination);
                const back = destination === "assembly" ? "#go-map" : '[data-lab="battle"]';
                const label = await page.locator(back).innerText();
                await snapshot(page, `replay-${destination}-${size}`);
                await click(page, back);
                await ready(page, "journey");
                return { returnLabel: label, missionAfterReturn: await page.locator("#mission-select").inputValue(), expectedMission: first };
              });
              if (!ok) { await page.goto(`${base}/#journey`); await ready(page, "journey"); }
            }
            await action(page, `${size}: journey launch preparation and cancel`, async () => {
              await page.selectOption("#mission-select", first);
              await click(page, "#start-battle");
              await page.waitForFunction(() => document.querySelector("#launch-button")?.disabled === false, null, { timeout: 45000 });
              await snapshot(page, `launch-ready-${size}`);
              await click(page, "#pause-battle");
              await ready(page, "journey");
              return { returnedTo: page.url(), mission: await page.locator("#mission-select").inputValue() };
            });
            await action(page, `${size}: locked mission preview`, async () => {
              await page.selectOption("#mission-select", CAMPAIGN_MISSIONS.at(-1).id);
              await snapshot(page, `journey-locked-${size}`);
              return { startDisabled: await page.locator("#start-battle").isDisabled(), lockText: await page.locator(".journey-lock").innerText() };
            });
          }
          if (route === "lab") {
            await action(page, `${size}: complete real lab test`, async () => {
              await click(page, '[data-lab="test"]');
              await page.waitForTimeout(6500);
              await snapshot(page, `lab-tested-${size}`);
              return page.evaluate(key => {
                const lab = JSON.parse(localStorage.getItem(key)).lab;
                return { records: lab.records?.length, xp: lab.xp };
              }, key);
            });
            await action(page, `${size}: lab records open and Escape closes`, async () => {
              await click(page, '[data-lab="records"]');
              await snapshot(page, `lab-records-${size}`);
              await page.keyboard.press("Escape");
              return { dialogStillOpen: await page.locator(".lab-dialog").evaluate(el => el.open) };
            });
            await action(page, `${size}: lab battle navigation`, async () => {
              await click(page, '[data-lab="battle"]');
              return { url: page.url() };
            });
          }
        } catch (error) {
          report.errors.push({ route, size, error: error.message });
        } finally { await context.close(); }
      }
    }
  } else if (mode === "overlay") {
    const port = Number(process.argv[3]);
    if (!port) throw new Error("Explicit owned live-server port is required");
    report.liveServerPort = port;
    report.humanVisibleTab = false;
    report.presentationReason = "Headless isolated Chrome, no browser presentation tool exposed";
    for (const route of ["assembly", "journey", "lab"]) {
      const context = await contextFor({ width: 390, height: 844 });
      const page = await context.newPage();
      const events = attach(page, `overlay-${route}`);
      try {
        await page.goto(`${base}/#${route}`);
        await ready(page, route);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.addScriptTag({ url: `http://localhost:${port}/detect.js` });
        await page.waitForTimeout(3000);
        const scripts = await page.evaluate(() => [...document.scripts].map(s => s.src).filter(s => s.includes("detect.js")));
        await snapshot(page, `overlay-${route}-mobile`);
        report.actions.push({
          route, scriptInjected: scripts.length === 1, scripts,
          detectorConsole: events.filter(e => /impeccable/i.test(e.text ?? "")),
        });
      } catch (error) { report.errors.push({ route, error: error.message }); }
      finally { await context.close(); }
    }
  } else {
    throw new Error(`Unknown capture mode: ${mode}`);
  }
} finally {
  await browser.close();
  report.targetSha256After = await sha();
  report.appSourceUnchanged = report.targetSha256Before === report.targetSha256After;
  await write(`${mode}-report.json`, report);
  console.log(JSON.stringify({
    mode, actionCount: report.actions.length,
    failedActions: report.actions.filter(a => a.status === "failed").map(a => a.label),
    errors: report.errors, preflight: report.preflight, appSourceUnchanged: report.appSourceUnchanged,
  }, null, 2));
}
