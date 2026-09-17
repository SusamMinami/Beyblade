import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

// Diagnostic instrumentation is injected into this isolated browser only.
// No debug API or altered save is shipped with the game.
const label = process.argv[2] ?? "current";
const out = resolve("../.impeccable/review/loading");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--disable-gpu-shader-disk-cache"],
});
const base = process.env.LAB_TEST_URL ?? "http://127.0.0.1:5173";
const reports = [];
try {
  for (const cpuRate of [1, 4]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(() => {
      localStorage.setItem("spin-core-web-prototype-v2", JSON.stringify({
        version: 2, sound: false, tutorial: { completed: true, stage: "complete" },
        lab: { xp: 120 }, sceneTime: "night",
      }));
      window.__loadingEvents = [];
      window.__loadingPhase = "startup";
      new PerformanceObserver(list => list.getEntries().forEach(e =>
        window.__loadingEvents.push({ phase: window.__loadingPhase, kind: "longtask", ms: e.duration })))
        .observe({ type: "longtask", buffered: true });
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", e => { errors.push(e.message); console.error("PAGE", e.message); });
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpuRate });
    await page.route(/\/src\/main\.js(\?.*)?$/, async route => {
      const response = await route.fetch();
      const body = (await response.text()).replace(
        'new BeybladeApp(document.querySelector("#app"));',
        'window.__loadingApp = new BeybladeApp(document.querySelector("#app"));');
      await route.fulfill({ response, body });
    });
    await page.route(/\/src\/render\/three-stage\.js(\?.*)?$/, async route => {
      const response = await route.fetch();
      const body = await response.text();
      await route.fulfill({ response, body: body + `
        const record = (kind, t, detail) => window.__loadingEvents.push({
          phase: window.__loadingPhase, kind, ms: performance.now()-t, detail });
        const load = GLTFLoader.prototype.loadAsync;
        GLTFLoader.prototype.loadAsync = async function(url, ...args) {
          const t = performance.now(); const result = await load.call(this,url,...args);
          record("gltf-fetch-parse",t,url); return result;
        };
        const pmrem = THREE.PMREMGenerator.prototype.fromScene;
        THREE.PMREMGenerator.prototype.fromScene = function(...args) {
          const t=performance.now(); const result=pmrem.apply(this,args); record("pmrem",t); return result;
        };
      ` });
    });
    const phases = [];
    await page.goto(`${base}/#assembly`);
    await page.waitForFunction(() => !!window.__loadingApp);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const measure = async (name, command, ready) => {
      // Existing map carousel commits after its scroll debounce. Start the
      // next action only once that previous user interaction has settled.
      await page.waitForTimeout(400);
      const result = await page.evaluate(async ({ name, command, ready }) => {
        const app = window.__loadingApp;
        window.__loadingPhase = name;
        const start = performance.now();
        const startEvents = window.__loadingEvents.length;
        const mark = performance.getEntriesByType("resource").length;
        // Test-only expression bodies are authored below, never external input.
        new Function("app", command)(app);
        const syncMs = performance.now() - start;
        if (ready === "arena") {
          if (!app.stage.arenaReady) await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error("Arena timeout")), 20000);
            const listener = e => {
              if (e.detail.state === "ready" || e.detail.state === "error") {
                clearTimeout(timer); app.stage.container.removeEventListener("arenastatus", listener);
                if (e.detail.state === "error") reject(new Error(e.detail.message)); else resolve();
              }
            };
            app.stage.container.addEventListener("arenastatus", listener);
          });
        } else if (ready === "collection") await app.showroomScreen.stage.ready;
        else if (ready === "lab") await app.labScreen.stage.ready;
        const readyMs = performance.now()-start;
        const stage = ready === "collection" ? app.showroomScreen.stage
          : ready === "lab" ? app.labScreen.stage : app.stage;
        const t = performance.now();
        if (ready === "collection") stage.update(0, false);
        else if (ready === "lab") app.labScreen.update(0);
        else stage.update(0, app.simulation);
        stage.renderer.getContext().finish();
        const frameMs = performance.now()-t;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const visibleMs = performance.now()-start;
        return { name, syncMs, readyMs, frameMs, visibleMs,
          arena: app.stage.activeArena?.id, selectedArena: app.selectedArena.id,
          events: window.__loadingEvents.slice(startEvents),
          resources: performance.getEntriesByType("resource").slice(mark)
            .filter(e => e.name.includes(".glb"))
            .map(e => ({ name: e.name.split("/").at(-1), ms: e.duration,
              transfer: e.transferSize, bytes: e.decodedBodySize })) };
      }, { name, command, ready });
      phases.push(result);
      console.log(cpuRate, name, Object.fromEntries(["syncMs","readyMs","frameMs","visibleMs"]
        .map(key => [key, Math.round(result[key])])));
    };
    await measure("collection-first", 'app.goTo("collection")', "collection");
    await measure("lab-first", 'app.goTo("lab")', "lab");
    await measure("collection-return", 'app.goTo("collection")', "collection");
    await measure("lab-return", 'app.goTo("lab")', "lab");
    await measure("standard-map", 'app.goTo("map")', "arena");
    const select = id => `app._selectArena("${id}"); app._centerArenaCard(
      app.root.querySelector('.arena-card[data-arena="${id}"]'), "instant");`;
    for (const id of ["metal", "street", "ruins"]) {
      await measure(`${id}-first`, select(id), "arena");
      await measure(`${id}-battle`, 'app.goTo("battle")', "arena");
      await measure(`${id}-return`, 'app.goTo("map")', "arena");
    }
    await measure("street-revisit", select("street"), "arena");
    await measure("metal-revisit", select("metal"), "arena");
    const environment = await page.evaluate(() => {
      const gl = window.__loadingApp.stage.renderer.getContext();
      const debug = gl.getExtension("WEBGL_debug_renderer_info");
      return {
        renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        parallelCompile: Boolean(gl.getExtension("KHR_parallel_shader_compile")),
        pixelRatio: devicePixelRatio,
      };
    });
    reports.push({ cpuRate, browser: browser.version(), environment, phases, errors });
    await context.close();
  }
  await writeFile(`${out}/${label}.json`, JSON.stringify(reports, null, 2));
  console.log(`Saved ${out}/${label}.json`);
} finally {
  await browser.close();
}
