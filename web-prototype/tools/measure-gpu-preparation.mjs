import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

// Test-only instrumentation; no timing hooks or app API are shipped.
const label = process.argv[2] ?? "current";
const out = resolve("../.impeccable/review/gpu-preparation");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true, args: ["--disable-gpu-shader-disk-cache"],
});
const reports = [];
try {
  for (const cpuRate of (process.env.CPU_RATES ?? "1,4").split(",").map(Number)) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(() => {
      localStorage.setItem("spin-core-web-prototype-v2", JSON.stringify({
        version: 2, sound: false, tutorial: { completed: true, stage: "complete" },
        lab: { xp: 120 }, sceneTime: "night",
      }));
      window.gpuEvents = [];
      window.gpuCalls = {};
      window.gpuPhase = "startup";
      window.recordGpu = (kind, start, detail) => window.gpuEvents.push({
        phase: window.gpuPhase, kind, ms: performance.now() - start, detail,
      });
      new PerformanceObserver(list => list.getEntries().forEach(e => window.gpuEvents.push({
        phase: window.gpuPhase, kind: "longtask", ms: e.duration,
      }))).observe({ type: "longtask", buffered: true });
      for (const name of ["bufferData", "texImage2D", "texSubImage2D", "texStorage2D",
        "getProgramParameter", "getShaderParameter", "getActiveUniform", "getUniformLocation",
        "drawElements", "drawArrays", "finish"]) {
        const original = WebGL2RenderingContext.prototype[name];
        WebGL2RenderingContext.prototype[name] = function (...args) {
          const t = performance.now();
          try { return original.apply(this, args); }
          finally {
            const key = `${window.gpuPhase}:${name}`;
            const call = window.gpuCalls[key] ??= { count: 0, ms: 0 };
            call.count++;
            call.ms += performance.now() - t;
          }
        };
      }
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpuRate });
    await page.route(/\/src\/main\.js(\?.*)?$/, async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: (await response.text()).replace(
        'new BeybladeApp(document.querySelector("#app"));',
        'window.app = new BeybladeApp(document.querySelector("#app"));') });
    });
    await page.route(/\/src\/render\/(three|lab)-stage\.js(\?.*)?$/, async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: (await response.text())
        .replaceAll("new THREE.WebGLRenderer(", "profileRenderer(") + `
        function profileRenderer(options) {
          const renderer = new THREE.WebGLRenderer(options);
          const compile = renderer.compileAsync.bind(renderer);
          renderer.compileAsync = (...args) => {
            const t = performance.now();
            const ready = compile(...args);
            window.recordGpu("compile-submit", t);
            return ready.then(result => { window.recordGpu("compile-ready",t); return result; });
          };
          const render = renderer.render.bind(renderer);
          let depth = 0;
          renderer.render = (...args) => {
            const t = performance.now(); depth++;
            const before = new Set(renderer.info.programs.map(p => p.id));
            try { return render(...args); }
            finally {
              depth--;
              if (performance.now()-t > 1) window.recordGpu(
                depth ? "render-nested" : "render", t, {
                  added: renderer.info.programs.filter(p => !before.has(p.id)).map(p => p.cacheKey),
                });
            }
          };
          return renderer;
        }` });
    });
    await page.goto(`${process.env.LAB_TEST_URL ?? "http://127.0.0.1:5173"}/#assembly`);
    await page.waitForFunction(() => !!window.app);
    const phases = [];
    async function measure(name, command, ready) {
      const result = await page.evaluate(async ({ name, command, ready }) => {
        window.gpuPhase = name;
        const t = performance.now();
        new Function("app", command)(app);
        const syncMs = performance.now() - t;
        const stage = ready === "collection" ? app.showroomScreen.stage
          : ready === "lab" ? app.labScreen.stage : app.stage;
        if (ready === "arena") {
          if (!stage.arenaReady) await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(Error("Arena timeout")), 20000);
            const listener = e => {
              if (!["ready", "error"].includes(e.detail.state)) return;
              stage.container.removeEventListener("arenastatus", listener);
              clearTimeout(timer);
              e.detail.state === "ready" ? resolve() : reject(Error(e.detail.message));
            };
            stage.container.addEventListener("arenastatus", listener);
          });
        } else await stage.ready;
        const readyMs = performance.now() - t;
        stage.renderer.getContext().finish();
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return { name, syncMs, readyMs, visibleMs: performance.now() - t,
          programs: stage.renderer.info.programs.length,
          memory: { ...stage.renderer.info.memory } };
      }, { name, command, ready });
      phases.push(result);
      console.log(cpuRate, name, Math.round(result.visibleMs), "ms");
    }
    await measure("collection-first", 'app.goTo("collection")', "collection");
    await measure("lab-first", 'app.goTo("lab")', "lab");
    await measure("collection-return", 'app.goTo("collection")', "collection");
    await measure("standard-first", 'app.goTo("map")', "arena");
    // The 400ms settle interval is the existing carousel scroll debounce.
    await page.waitForTimeout(400);
    for (const id of ["metal", "street"]) {
      await measure(`${id}-first`, `app._selectArena("${id}");
        app._centerArenaCard(app.root.querySelector('.arena-card[data-arena="${id}"]'), "instant");`, "arena");
      // Explicit reading time: readiness is measured separately from speculation.
      await page.evaluate(() => { window.gpuPhase = "reading"; });
      await page.waitForTimeout(2500);
      await measure(`${id}-battle`, 'app.goTo("battle")', "arena");
      await measure(`${id}-return`, 'app.goTo("map")', "arena");
      await page.waitForTimeout(400);
    }
    const evidence = await page.evaluate(() => ({
      events: window.gpuEvents, calls: window.gpuCalls,
      parallelCompile: Boolean(app.stage.renderer.getContext().getExtension("KHR_parallel_shader_compile")),
    }));
    reports.push({ cpuRate, browser: browser.version(), phases, ...evidence, errors });
    await context.close();
  }
  await writeFile(`${out}/${label}.json`, JSON.stringify(reports, null, 2));
} finally { await browser.close(); }
