import * as THREE from "three";
import { createTopModel, disposeTopModel } from "./top-model.js";
import { MAX_MESH_OIL_SAMPLES } from "../core/maintenance-state.js";
import layout from "../../../resources/launcher/performance/parts.json";
import { createLauncherModel, createLauncherPart, disposeLauncherModel, prepareLauncherMaterials,
  captureLauncherPose, paintLauncher, poseLauncher, launcherMotion } from "./launcher-model.js";
import { getLauncherPart } from "../core/launcher-state.js";

function oilMaterial(material) {
  const m = material.clone();
  const prior = material.onBeforeCompile;
  const priorKey = material.customProgramCacheKey();
  const centers = Array.from({ length: MAX_MESH_OIL_SAMPLES }, () => new THREE.Vector4());
  const normals = Array.from({ length: MAX_MESH_OIL_SAMPLES }, () => new THREE.Vector4());
  m.userData.oilUniforms = { centers, normals, count: { value: 0 } };
  m.onBeforeCompile = shader => {
    prior.call(m, shader);
    shader.uniforms.oilCenters = { value: centers };
    shader.uniforms.oilNormals = { value: normals };
    shader.uniforms.oilCount = m.userData.oilUniforms.count;
    shader.vertexShader = `varying vec3 vOilPosition; varying vec3 vOilNormal;\n${shader.vertexShader}`
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        vOilPosition = position; vOilNormal = normal;`);
    shader.fragmentShader = `varying vec3 vOilPosition; varying vec3 vOilNormal;
      uniform vec4 oilCenters[${MAX_MESH_OIL_SAMPLES}];
      uniform vec4 oilNormals[${MAX_MESH_OIL_SAMPLES}];
      uniform int oilCount;\n${shader.fragmentShader}`
      .replace("#include <color_fragment>", `#include <color_fragment>
        float oilFilm = 0.0;
        for (int i = 0; i < ${MAX_MESH_OIL_SAMPLES}; i++) {
          if (i >= oilCount) break;
          float d = distance(vOilPosition, oilCenters[i].xyz) / oilCenters[i].w;
          float face = smoothstep(0.25, 0.65, dot(normalize(vOilNormal), oilNormals[i].xyz));
          oilFilm = max(oilFilm, (1.0 - smoothstep(0.3, 1.0, d)) * oilNormals[i].w * face);
        }
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.65, 0.32, 0.045), oilFilm * 0.48);`)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.065, oilFilm);`);
  };
  m.customProgramCacheKey = () => `${priorKey}:maintenance-oil-v1`;
  return m;
}

export class MaintenanceStage {
  constructor(base, host, callbacks, settings) {
    this.base = base;
    this.host = host;
    this.callbacks = callbacks;
    this.renderer = base.renderer;
    this.canvas = this.renderer.domElement;
    // Borrow the actual lab room, lighting and renderer. Only the exploded
    // subject belongs to this screen; room assets stay cached in LabStage.
    base.active = false;
    base.prepareToken = (base.prepareToken ?? 0) + 1;
    this.previousView = base.view;
    this.hiddenObjects = [base.specimen, base.scan, base.windField, base.trace, base.monitor, ...base.advancedShield];
    this.visibility = this.hiddenObjects.map(node => node.visible);
    host.append(this.canvas);
    this.scene = base.scene;
    this.camera = new THREE.PerspectiveCamera(43, 1, .05, 40);
    this.workpiece = new THREE.Group();
    this.scene.add(this.workpiece);
    base.setQuality(settings.quality);
    base.setView("front", true);
    this.room = settings.room;
    this.raycaster = new THREE.Raycaster();
    this.target = new THREE.Vector3();
    this.yaw = .35; this.pitch = .5; this.radius = 9;
    this.pointers = new Map();
    this.token = 0;
    this.tool = "oil";
    this.alive = true;
    this.abort = new AbortController();
    this.bind();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.resize();
  }

  async load(kind, loadout, launcher) {
    const token = ++this.token;
    this.cancelGesture(true);
    this.clearModel();
    this.kind = kind;
    this.focus = null;
    this.yaw = .08;
    this.pitch = .28;
    try {
      const ready = this.base.setRoom(this.room);
      this.hiddenObjects.forEach(node => { node.visible = false; });
      await ready;
      if (!this.alive || token !== this.token) return;
      this.hiddenObjects.forEach(node => { node.visible = false; });
      let model;
      if (kind === "launcher") {
        model = await createLauncherModel(launcher);
        if (!this.alive || token !== this.token) { disposeLauncherModel(model); return; }
        poseLauncher(model, { explode: .7 });
      } else {
        model = createTopModel(loadout.build, loadout.colors, loadout.customizations);
        Object.entries(model.userData.partGroups).forEach(([slot, group]) => {
          const positions = { coreLock: 1.8, attackRing: 1, weightDisc: .15, driverShaft: -.65, tip: -1.5 };
          group.position.y = positions[slot];
          group.userData.slotId = slot;
          // Present the contact face directly; no need to find a hidden underside.
          if (slot === "tip") group.rotation.x = -Math.PI * .65;
          group.children.forEach((mesh, i) => { mesh.name = `${slot}-${i}`; });
        });
      }
      this.model = model;
      this.collectMeshes();
      this.workpiece.scale.setScalar(1);
      this.workpiece.position.set(0, 0, 0);
      this.workpiece.add(model);
      this.workpiece.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      const scale = Math.min(2.8 / size.x, 2.2 / size.y, 2.6 / size.z);
      const center = bounds.getCenter(new THREE.Vector3());
      this.workpiece.scale.setScalar(scale);
      this.workpiece.position.set(-center.x * scale, .52 - bounds.min.y * scale, -center.z * scale);
      this.frame();
      this.callbacks.loaded();
    } catch (error) {
      if (this.alive && token === this.token) this.callbacks.error(error);
    }
  }

  collectMeshes() {
    this.meshes = [];
    this.model.traverse(o => {
      if (!o.isMesh) return;
      if (!o.material.userData.oilUniforms) {
        const previous = o.material;
        o.material = oilMaterial(previous);
        previous.dispose();
      }
      o.geometry.computeBoundingBox();
      this.meshes.push(o);
    });
  }

  async swapLauncher(config) {
    const token = ++this.token;
    this.cancelGesture(true); this.motionTime = 0;
    const slot = Object.keys(config.build).find(s => config.build[s] !== this.model.userData.config.build[s]);
    if (!slot) { paintLauncher(this.model, config.colors); this.callbacks.loaded(); return; }
    try {
      const next = await createLauncherPart(config.build[slot]);
      if (!this.alive || token !== this.token || this.kind !== "launcher") { disposeLauncherModel(next); return; }
      prepareLauncherMaterials(next); captureLauncherPose(next);
      const old = this.model.userData.slots[slot];
      this.swap = { slot, old, next, config, elapsed: 0, inserted: false };
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) this.advanceSwap(1);
    } catch (error) { if (this.alive && token === this.token) this.callbacks.error(error); }
  }

  advanceSwap(dt) {
    const s = this.swap;
    if (!s) return;
    s.elapsed += dt;
    if (s.elapsed >= .2 && !s.inserted) {
      s.old.parent.add(s.next); disposeLauncherModel(s.old);
      this.model.userData.slots[s.slot] = s.next;
      this.model.userData.config = s.config;
      paintLauncher(this.model, s.config.colors);
      this.collectMeshes(); s.inserted = true;
    }
    poseLauncher(this.model, { explode: .7 });
    const node = s.inserted ? s.next : s.old;
    const amount = s.inserted ? Math.max(0, 1 - (s.elapsed - .2) / .24) : s.elapsed / .2;
    node.position.addScaledVector(new THREE.Vector3(...layout.inspection.moduleExplode[s.slot]).normalize(), amount * .7);
    if (s.elapsed >= .44) { this.swap = null; this.callbacks.loaded(); }
  }

  frame(focus = this.focus) {
    if (!this.model) return;
    this.focus = focus;
    let subject = this.model;
    if (focus) {
      subject = this.model.userData.slots?.[focus] ?? subject;
      if (this.kind !== "launcher") this.model.traverse(o => {
        if (o.userData.slotId === focus && !o.isMesh) subject = o;
      });
    }
    this.workpiece.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(subject);
    box.getCenter(this.target);
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const right = new THREE.Vector3(cy, 0, -sy);
    const up = new THREE.Vector3(-sy * sp, cp, -cy * sp);
    const forward = new THREE.Vector3(sy * cp, sp, cy * cp);
    const tangent = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const available = this.usableFraction ?? .4;
    let distance = .7;
    subject.traverse(mesh => {
      if (!mesh.isMesh) return;
      const bounds = mesh.geometry.boundingBox;
      for (const x of [bounds.min.x, bounds.max.x])
        for (const y of [bounds.min.y, bounds.max.y])
          for (const z of [bounds.min.z, bounds.max.z]) {
            const v = new THREE.Vector3(x, y, z).applyMatrix4(mesh.matrixWorld).sub(this.target);
            distance = Math.max(distance, Math.abs(v.dot(right)) / (tangent * this.camera.aspect) + v.dot(forward),
              Math.abs(v.dot(up)) / (tangent * available) + v.dot(forward));
          }
    });
    this.radius = distance * 1.08;
    this.fitRadius = this.radius;
    this.orbit();
  }

  orbit() {
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * Math.cos(this.pitch) * this.radius,
      this.target.y + Math.sin(this.pitch) * this.radius,
      this.target.z + Math.cos(this.yaw) * Math.cos(this.pitch) * this.radius);
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
    if (this.canvas.matches(":focus-visible")) this.updateReticle();
  }

  resize() {
    if (!this.alive) return;
    const { width, height } = this.host.getBoundingClientRect();
    if (!width || !height) return;
    const root = this.callbacks.controls;
    const rect = this.host.getBoundingClientRect();
    const top = root.querySelector(".maintenance-focus").getBoundingClientRect().bottom - rect.top + 8;
    const bottom = root.querySelector(".maintenance-console").getBoundingClientRect().top - rect.top - 12;
    this.inspectionCenter = (top + bottom) / 2;
    this.host.querySelector(".maintenance-cross").style.top = `${this.inspectionCenter - 9}px`;
    this.usableFraction = Math.max(.08, (bottom - top) / height);
    this.camera.aspect = width / height;
    this.camera.setViewOffset(width, height, 0, height / 2 - (top + bottom) / 2, width, height);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.frame();
  }

  hit(x, y) {
    if (!this.model) return null;
    const r = this.canvas.getBoundingClientRect();
    this.scene.updateMatrixWorld(true);
    this.raycaster.setFromCamera(new THREE.Vector2(
      (x - r.x) / r.width * 2 - 1, 1 - (y - r.y) / r.height * 2), this.camera);
    const hit = this.raycaster.intersectObjects(this.meshes, false)[0];
    if (!hit) return null;
    const mesh = hit.object;
    const p = mesh.worldToLocal(hit.point.clone());
    let group = mesh;
    while (group.parent && !group.userData.slotId) group = group.parent;
    const slot = group.userData.slotId;
    let zone = "exterior";
    if (this.kind === "launcher") {
      const role = mesh.userData.surfaceRole ?? "";
      if (/gear|bearing_working|rack_guide_and_teeth/.test(role)) zone = "transmission";
      if (slot === "grip" && mesh.userData.paintZone === "grip") zone = "support";
      if (slot === "pull_handle" && mesh.userData.paintZone === "grip") zone = "pull";
    } else if (slot === "tip") {
      // Meshes are compacted in part space. Use the whole tip's contact height.
      const local = group.worldToLocal(hit.point.clone());
      const minY = Math.min(...group.children.filter(o => o.isMesh).map(o => o.geometry.boundingBox.min.y));
      const maxY = Math.max(...group.children.filter(o => o.isMesh).map(o => o.geometry.boundingBox.max.y));
      if (local.y <= minY + (maxY - minY) * .35) zone = "tip";
    }
    return { mesh: mesh.name, p: p.toArray(), n: hit.face.normal.toArray(),
      radius: this.kind === "launcher" ? .13 : .075, zone, slot };
  }

  updateReticle() {
    const r = this.canvas.getBoundingClientRect();
    const center = { x: r.x + r.width / 2, y: r.y + this.inspectionCenter };
    const accepts = p => {
      const hit = this.hit(p.x, p.y);
      return hit && (!this.focus || hit.slot === this.focus);
    };
    let aim = center;
    // An exploded group's center can be empty air. Snap the visible keyboard
    // reticle to the nearest ray-hit on the focused part, never paint a proxy.
    if (!accepts(center)) {
      search: for (let radius = 8; radius <= Math.min(r.width, r.height * this.usableFraction) * .4; radius += 8) {
        for (let i = 0; i < 12; i++) {
          const p = { x: center.x + Math.cos(i * Math.PI / 6) * radius,
            y: center.y + Math.sin(i * Math.PI / 6) * radius };
          if (accepts(p)) { aim = p; break search; }
        }
      }
    }
    this.keyboardAim = aim;
    const cross = this.host.querySelector(".maintenance-cross");
    cross.style.left = `${aim.x - r.x - 9}px`;
    cross.style.top = `${aim.y - r.y - 9}px`;
  }

  setOil(samples) {
    if (!this.meshes) return;
    for (const mesh of this.meshes) {
      const oil = samples.filter(s => s.mesh === mesh.name).slice(0, MAX_MESH_OIL_SAMPLES);
      const u = mesh.material.userData.oilUniforms;
      u.count.value = oil.length;
      oil.forEach((s, i) => {
        u.centers[i].set(...s.p, s.radius);
        u.normals[i].set(...s.n, Math.sqrt(s.amount));
      });
    }
  }

  setTool(tool) { this.cancelGesture(false); this.tool = tool; this.canvas.style.cursor = tool === "orbit" ? "grab" : "crosshair"; }

  cancelGesture(rollback) {
    if (this.stroke) this.callbacks.end(rollback);
    this.stroke = false;
    for (const id of this.pointers.keys()) if (this.canvas.hasPointerCapture(id)) this.canvas.releasePointerCapture(id);
    this.pointers.clear();
    this.gesture = null;
  }

  bind() {
    const on = (target, event, callback, opts = {}) =>
      target.addEventListener(event, callback, { ...opts, signal: this.abort.signal });
    on(this.canvas, "pointerdown", e => {
      if (e.button !== 0 && e.button !== 2) return;
      e.preventDefault();
      this.canvas.focus();
      this.motionTime = 0;
      this.clickStart = { x: e.clientX, y: e.clientY };
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.canvas.setPointerCapture(e.pointerId);
      if (this.pointers.size > 1) {
        if (this.stroke) this.callbacks.end(true);
        this.stroke = false; this.gesture = "pinch"; this.pinch = this.pointerDistance();
        return;
      }
      this.gesture = this.tool === "orbit" || this.tool === "select" || e.button === 2 ? "orbit" : "paint";
      if (this.gesture === "paint") {
        this.callbacks.begin(); this.stroke = true;
        this.applyAt(e.clientX, e.clientY);
      }
    });
    on(this.canvas, "pointermove", e => {
      const old = this.pointers.get(e.pointerId);
      if (!old) return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const dx = e.clientX - old.x, dy = e.clientY - old.y;
      if (this.gesture === "pinch" && this.pointers.size > 1) {
        const next = this.pointerDistance();
        this.radius = THREE.MathUtils.clamp(this.radius * this.pinch / Math.max(next, 1), .9, 40);
        this.pinch = next;
        this.yaw -= dx * .003; this.pitch = THREE.MathUtils.clamp(this.pitch + dy * .003, -1.4, 1.4);
        this.orbit();
      } else if (this.gesture === "orbit") {
        this.yaw -= dx * .008; this.pitch = THREE.MathUtils.clamp(this.pitch + dy * .008, -1.4, 1.4);
        this.orbit();
      } else if (this.gesture === "paint" && this.stroke) {
        const steps = Math.min(32, Math.ceil(Math.hypot(dx, dy) / 6));
        for (let i = 1; i <= steps; i++) this.applyAt(old.x + dx * i / steps, old.y + dy * i / steps);
      }
    });
    on(this.canvas, "pointerup", e => {
      if (this.tool === "select" && this.pointers.size === 1 && this.clickStart &&
        Math.hypot(e.clientX - this.clickStart.x, e.clientY - this.clickStart.y) < 5)
        this.callbacks.select?.(this.hit(e.clientX, e.clientY)?.slot);
      this.pointers.delete(e.pointerId);
      if (this.stroke) this.callbacks.end(false);
      this.stroke = false; this.gesture = null;
      if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
    });
    on(this.canvas, "pointercancel", () => this.cancelGesture(true));
    on(this.canvas, "lostpointercapture", e => {
      if (this.pointers.has(e.pointerId)) this.cancelGesture(true);
    });
    on(window, "blur", () => this.cancelGesture(true));
    on(document, "visibilitychange", () => { if (document.hidden) this.cancelGesture(true); });
    on(this.canvas, "contextmenu", e => e.preventDefault());
    on(this.canvas, "wheel", e => {
      e.preventDefault();
      this.radius = THREE.MathUtils.clamp(this.radius * Math.exp(e.deltaY * .001), .9, 40); this.orbit();
    }, { passive: false });
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute("aria-label", "保养模型；方向键环绕，加减号缩放，Enter 在准星处滴油或擦拭");
    on(this.canvas, "focus", () => this.updateReticle());
    on(this.canvas, "keydown", e => {
      if (e.key === "Enter" && this.tool !== "orbit" && this.tool !== "select") {
        e.preventDefault();
        this.updateReticle();
        this.callbacks.begin();
        this.applyAt(this.keyboardAim.x, this.keyboardAim.y);
        this.callbacks.end(false);
        return;
      } else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        this.yaw += e.key === "ArrowLeft" ? -.15 : e.key === "ArrowRight" ? .15 : 0;
        this.pitch = THREE.MathUtils.clamp(this.pitch + (e.key === "ArrowUp" ? .15 : e.key === "ArrowDown" ? -.15 : 0), -1.4, 1.4);
      } else if (e.key === "+" || e.key === "=") this.radius *= .9;
      else if (e.key === "-") this.radius *= 1.1;
      else return;
      this.orbit();
    });
  }

  pointerDistance() {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 1;
  }
  applyAt(x, y) { const hit = this.hit(x, y); if (hit) this.callbacks.paint(hit, this.tool === "wipe"); }

  play() {
    this.cancelGesture(false);
    this.motionTime = 0.001;
  }

  update(dt) {
    if (this.swap && !document.hidden) this.advanceSwap(dt);
    if (this.motionTime > 0 && this.kind === "launcher" && !document.hidden) {
      this.motionTime += dt;
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const ms = getLauncherPart(this.model.userData.config.build.coupler).releaseMs;
      const motion = launcherMotion(reduced ? 1 : this.motionTime / 3, ms);
      poseLauncher(this.model, { explode: .7, ...motion });
      if (motion.done && this.motionTime > (reduced ? .3 : 2.5)) {
        this.motionTime = 0;
        poseLauncher(this.model, { explode: .7 });
      }
    }
    this.renderer.render(this.scene, this.camera);
  }

  clearModel() {
    if (this.swap && !this.swap.inserted) disposeLauncherModel(this.swap.next);
    this.swap = null;
    if (!this.model) return;
    if (this.model.userData.partGroups) disposeTopModel(this.model);
    this.model.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    this.model.removeFromParent();
    this.model = null; this.meshes = []; this.moving = [];
  }

  dispose() {
    this.alive = false; this.token++;
    this.cancelGesture(true); this.abort.abort(); this.observer.disconnect();
    this.clearModel();
    this.workpiece.removeFromParent();
    this.hiddenObjects.forEach((node, i) => { node.visible = this.visibility[i]; });
    this.base.setView(this.previousView, true);
    this.base.container.append(this.canvas);
    this.canvas.style.cursor = "";
    this.canvas.removeAttribute("aria-label");
  }
}
