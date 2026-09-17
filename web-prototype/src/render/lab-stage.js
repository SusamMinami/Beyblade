import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createTopModel, disposeTopModel } from "./top-model.js";
import { applySurfaceFinish } from "./surface-finish.js";
import { loadoutVisualKey } from "./loadout-visual-key.js";
import { prepareScene } from "./prepare-scene.js";
import labAssetUrl from "../../../resources/test_lab/test_lab.glb?url";
import childhoodUrl from "../../../resources/battle_worlds/childhood_lab.glb?url";
import { windParameters } from "../core/lab-state.js";

export class LabStage {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#a6b4b7");
    this.scene.fog = new THREE.Fog("#a6b4b7", 13, 27);
    this.camera = new THREE.PerspectiveCamera(43, 9 / 16, 0.1, 40);
    this.camera.position.set(0.18, 4.10, 8.85);
    this.cameraTarget = new THREE.Vector3(0, 1.24, 0);
    this.camera.lookAt(this.cameraTarget);
    this.view = "front";
    this.elapsed = 0;
    this.rpm = 0;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.localClippingEnabled = true;
    container.append(this.renderer.domElement);
    const generator = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.environment = generator.fromScene(room, 0.025);
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = 0.8;
    room.dispose();
    generator.dispose();
    this.scene.add(new THREE.HemisphereLight(0xe9f6ff, 0x62716a, 0.9));
    this.ambientLight = this.scene.children.find(node=>node.isHemisphereLight);
    const key = new THREE.DirectionalLight(0xfff4df, 2.1);
    key.position.set(-3, 6, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -5, right: 5, top: 6, bottom: -4, near: 0.5, far: 18 });
    key.shadow.normalBias = 0.025;
    key.shadow.bias = -0.0001;
    this.scene.add(key);
    this.keyLight = key;
    const fill = new THREE.PointLight(0xa9e7ff, 8, 10, 2);
    fill.position.set(3, 3.6, 3);
    this.scene.add(fill);
    this.specimen = new THREE.Group();
    this.scene.add(this.specimen);
    this.rotor = new THREE.Group();
    this.specimen.add(this.rotor);
    this.restPosition = new THREE.Vector3();
    this.center = new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xe4f23e, depthTest: false }));
    this.center.renderOrder = 10;
    this.scan = new THREE.Mesh(new THREE.TorusGeometry(0.89, 0.008, 8, 96),
      new THREE.MeshBasicMaterial({ color: 0x4cffe5, transparent: true, opacity: 0.85 }));
    this.scan.rotation.x = Math.PI / 2;
    this.scan.visible = false;
    this.scene.add(this.scan);
    const shield = new THREE.Mesh(
      new THREE.CylinderGeometry(0.91, 0.91, 1.38, 96, 1, true),
      new THREE.MeshPhysicalMaterial({
        color: 0xb4e8ec, transparent: true, opacity: 0.075,
        roughness: 0.08, metalness: 0.2, side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    shield.position.y = 1.075;
    this.scene.add(shield);
    this.advancedShield = [shield];
    for (const height of [0.385, 1.77]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.91, 0.004, 6, 96),
        new THREE.MeshBasicMaterial({ color: 0xc3eeeb, transparent: true, opacity: 0.7 }));
      rim.rotation.x = Math.PI / 2;
      rim.position.y = height;
      this.scene.add(rim);
      this.advancedShield.push(rim);
    }
    this.screenCanvas = document.createElement("canvas");
    this.screenCanvas.width = 1200;
    this.screenCanvas.height = 600;
    this.screenTexture = new THREE.CanvasTexture(this.screenCanvas);
    this.screenTexture.colorSpace = THREE.SRGBColorSpace;
    this.screenTexture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const monitor = new THREE.Mesh(new THREE.PlaneGeometry(2.43, 1.22),
      new THREE.MeshBasicMaterial({ map: this.screenTexture, toneMapped: false }));
    monitor.position.set(0, 3.06, -0.613);
    this.scene.add(monitor);
    this.monitor = monitor;
    this.createWindField();
    this.active = false;
    this.roomSets = {};
    this.roomLoads = {};
    this.thumbnailCache = new Map();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.ready = Promise.resolve(this);
  }

  loadSet(room) {
    if (this.roomSets[room]) return Promise.resolve(this);
    if (this.roomLoads[room]) return this.roomLoads[room];
    this.roomLoads[room] = new GLTFLoader().loadAsync(room === "advanced" ? labAssetUrl : childhoodUrl).then(gltf => {
      gltf.scene.traverse((mesh) => {
        if (!mesh.isMesh) return;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const material = mesh.material;
        material.envMapIntensity = 1.05;
        if (mesh.geometry.attributes.color) material.vertexColors = true;
        if (material.metalness > 0.4) applySurfaceFinish(material, "machined", 0.75);
        if (material.name === "Honey oak") applySurfaceFinish(material, "wood", .45);
      });
      gltf.scene.visible = room === this.room;
      this.scene.add(gltf.scene);
      this.roomSets[room] = gltf.scene;
      if (room === this.room) {
        this.labSet = gltf.scene;
        this.setView(this.view);
      }
      return this;
    }).finally(() => {
      delete this.roomLoads[room];
    });
    return this.roomLoads[room];
  }

  setRoom(room) {
    this.room = room === "advanced" ? room : "childhood";
    Object.entries(this.roomSets ?? {}).forEach(([id,node])=>{node.visible=id===this.room;});
    this.labSet = this.roomSets?.[this.room];
    this.advancedShield.forEach(node=>{node.visible=this.room==="advanced";});
    this.keyLight.color.set(this.room==="childhood" ? 0xffdaa0 : 0xfff4df);
    this.keyLight.intensity=this.room==="childhood" ? 2.7 : 2.1;
    this.ambientLight.intensity=this.room==="childhood" ? .38 : .9;
    this.scene.environmentIntensity=this.room==="childhood" ? .38 : .8;
    this.scene.background.set(this.room==="childhood" ? "#b6bba5" : "#a6b4b7");
    this.setView(this.view);
    const selected = this.room;
    const token = this.prepareToken = (this.prepareToken ?? 0) + 1;
    const key = `${selected}:${this.specimenKey}:${this.quality}:${this.view}`;
    this.frameReady = this.preparedKey === key;
    this.ready = this.loadSet(selected).then(async () => {
      if (token !== this.prepareToken || !this.active || this.frameReady) return this;
      await prepareScene(this.renderer, this.scene, this.camera, {
        current: () => token === this.prepareToken && this.active,
        draw: () => {
          this.renderer.render(this.scene, this.camera);
          this.frameReady = true;
          this.preparedKey = key;
        },
      });
      return this;
    });
    return this.ready;
  }

  resize() {
    // This renderer also serves the showroom. An inactive lab must not resize
    // or draw over the canvas owned by the current page.
    if (!this.active) return;
    const { width, height } = this.container.getBoundingClientRect();
    if (!width || !height) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    if (this.frameReady) this.renderer.render(this.scene, this.camera);
  }

  setSpecimen(loadout, build) {
    this.build = build;
    this.center.position.fromArray(build.centerOfMass);
    const key = loadoutVisualKey(loadout);
    if (this.top && this.specimenKey === key) return;
    this.specimenKey = key;
    if (this.top) {
      this.rotor.remove(this.top);
      disposeTopModel(this.top);
    }
    this.top = createTopModel(loadout.build, loadout.colors, loadout.customizations);
    const bounds = new THREE.Box3().setFromObject(this.top);
    const size = bounds.getSize(new THREE.Vector3());
    const fit = Math.min(1.62 / Math.max(size.x, size.z), 1.20 / size.y);
    this.specimen.scale.setScalar(fit);
    this.specimen.position.set(0, 0.47 - bounds.min.y * fit, 0);
    this.restPosition.copy(this.specimen.position);
    this.rotor.add(this.top, this.center);
    this.center.position.fromArray(build.centerOfMass);
    this.build = build;
  }

  drawReadout({ title, metrics, status, note, progress = 0, running = false }) {
    const ctx = this.screenCanvas.getContext("2d");
    const paper = this.room === "childhood";
    ctx.fillStyle = paper ? "#eee9d7" : "#102e34";
    ctx.fillRect(0, 0, 1200, 600);
    ctx.strokeStyle = paper ? "#9b998b" : "#397778";
    ctx.lineWidth = 2;
    ctx.strokeRect(16, 16, 1168, 568);
    ctx.fillStyle = paper ? "#243c45" : "#79efdc";
    ctx.font = '600 51px Bahnschrift, "Microsoft YaHei", sans-serif';
    ctx.textAlign = "center";
    ctx.fillText(title, 600, 94);
    ctx.strokeStyle = "#305356";
    ctx.beginPath();
    ctx.moveTo(66, 126); ctx.lineTo(1134, 126);
    ctx.moveTo(600, 168); ctx.lineTo(600, 352);
    ctx.moveTo(66, 455); ctx.lineTo(1134, 455);
    ctx.stroke();
    metrics.forEach((metric, i) => {
      const x = i === 0 ? 315 : 885;
      ctx.fillStyle = paper ? "#354550" : "#a7d3d0";
      ctx.font = '33px "Microsoft YaHei", sans-serif';
      ctx.fillText(metric.label, x, 199);
      ctx.fillStyle = paper ? "#1e3745" : "#9ff5e6";
      ctx.font = "88px Bahnschrift, sans-serif";
      ctx.fillText(running ? "—" : metric.value.toFixed(metric.decimals), x, 302);
      ctx.fillStyle = paper ? "#51616a" : "#87b6b3";
      ctx.font = '28px "Microsoft YaHei", sans-serif';
      ctx.fillText(metric.unit, x, 357);
    });
    ctx.fillStyle = paper ? "#465b60" : "#91beba";
    ctx.font = '27px "Microsoft YaHei", sans-serif';
    ctx.fillText(note, 600, 420);
    ctx.fillStyle = paper ? "#ac3e2f" : "#7cefd9";
    ctx.font = '34px "Microsoft YaHei", sans-serif';
    ctx.fillText(status, 600, 525);
    ctx.fillStyle = paper ? "#227aa2" : "#7cefd9";
    ctx.fillRect(65, 561, 1070 * progress, 5);
    this.screenTexture.needsUpdate = true;
  }

  renderThumbnails(loadouts, canvases) {
    const keys = loadouts.map(loadoutVisualKey);
    // Bound storage to the current inventory (including identical loadouts).
    for (const key of this.thumbnailCache.keys()) {
      if (!keys.includes(key)) this.thumbnailCache.delete(key);
    }
    const missing = loadouts.filter((_, i) => !this.thumbnailCache.has(keys[i]));
    if (missing.length) this._renderMissingThumbnails(missing);
    canvases.forEach((canvas, i) => {
      canvas.width = 300;
      canvas.height = 200;
      canvas.getContext("2d").drawImage(this.thumbnailCache.get(keys[i]), 0, 0);
    });
  }

  _renderMissingThumbnails(loadouts) {
    const scene = new THREE.Scene();
    scene.environment = this.environment.texture;
    scene.environmentIntensity = 0.8;
    scene.background = new THREE.Color("#cad3d2");
    scene.add(new THREE.HemisphereLight(0xffffff, 0x516369, 1.3));
    const key = new THREE.DirectionalLight(0xffffff, 2);
    key.position.set(-2, 4, 3);
    scene.add(key);
    const camera = new THREE.PerspectiveCamera(34, 1.5, 0.1, 20);
    camera.position.set(0, 2.5, 3.4);
    camera.lookAt(0, 0, 0);
    const previousSize = this.renderer.getSize(new THREE.Vector2());
    const previousRatio = this.renderer.getPixelRatio();
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(300, 200, false);
    loadouts.forEach((loadout) => {
      const key = loadoutVisualKey(loadout);
      if (this.thumbnailCache.has(key)) return;
      const top = createTopModel(loadout.build, loadout.colors, loadout.customizations);
      const size = new THREE.Box3().setFromObject(top).getSize(new THREE.Vector3());
      top.scale.setScalar(2.15 / Math.max(size.x, size.y, size.z));
      scene.add(top);
      this.renderer.render(scene, camera);
      const canvas = document.createElement("canvas");
      canvas.width = 300;
      canvas.height = 200;
      canvas.getContext("2d").drawImage(this.renderer.domElement, 0, 0);
      this.thumbnailCache.set(key, canvas);
      scene.remove(top);
      disposeTopModel(top);
    });
    this.renderer.setPixelRatio(previousRatio);
    this.renderer.setSize(previousSize.x, previousSize.y, false);
  }

  setQuality(value) {
    this.quality = value;
    this.renderer.setPixelRatio(value === "performance" ? 1 : Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = value !== "performance";
  }

  setView(view, reducedMotion = false) {
    this.view = view;
    this.cameraInstant = reducedMotion;
    this.monitor.visible = view !== "top";
    const cut = view === "top" ? [new THREE.Plane(new THREE.Vector3(0, -1, 0), 1.82)] : [];
    this.labSet?.traverse((mesh) => {
      if (!mesh.isMesh) return;
      mesh.material.clippingPlanes = cut;
      mesh.material.clipShadows = true;
    });
  }

  createWindField() {
    this.windField = new THREE.Group();
    this.scene.add(this.windField);
    this.windArrows = [];
    for (let i = 0; i < 15; i++) {
      const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1),
        new THREE.Vector3((i % 5 - 2) * 0.38, 0.52, 0), 0.28, 0x23c8bd, 0.075, 0.045);
      arrow.userData.phase = Math.floor(i / 5) / 3;
      this.windField.add(arrow);
      this.windArrows.push(arrow);
    }
    this.tracePoints = [];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(64 * 3), 3));
    geometry.setDrawRange(0, 0);
    this.trace = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xe6b940, depthTest: false }));
    this.trace.renderOrder = 12;
    this.scene.add(this.trace);
  }

  clearTrace() {
    this.tracePoints.length = 0;
    this.trace.geometry.setDrawRange(0, 0);
  }

  update(delta, { running, progress, rotate, showCenter, reducedMotion, settings = {}, calibrating = false }) {
    this.elapsed += delta;
    const wind = windParameters(settings);
    const intensity = wind.speed / 12;
    const direction = THREE.MathUtils.degToRad(wind.direction);
    const spinTarget = running && !calibrating
      ? (reducedMotion ? 70 : 320) * (1 - intensity * 0.28)
      : rotate && !reducedMotion ? 1.7 : 0;
    this.rpm = THREE.MathUtils.damp(this.rpm, spinTarget, running ? 5 : 2.7, delta);
    this.rotor.rotation.y += delta * this.rpm * Math.PI / 30;
    const response = Math.min(1.3, 1 / Math.max(0.6, this.build?.stability ?? 1));
    const leanTarget = running && !calibrating ? intensity * 0.12 * response : 0;
    this.lean = THREE.MathUtils.damp(this.lean ?? 0, leanTarget, 4, delta);
    const sway = 1 + Math.sin(this.elapsed * 7.5) * (reducedMotion ? 0 : 0.18);
    this.specimen.rotation.set(-Math.cos(direction) * this.lean * sway, 0, -Math.sin(direction) * this.lean * sway);
    const drift = this.lean * 1.5;
    this.specimen.position.copy(this.restPosition).add(new THREE.Vector3(Math.sin(direction) * drift, 0, -Math.cos(direction) * drift));
    this.windField.visible = wind.speed > 0;
    this.windField.rotation.y = -direction;
    this.windArrows.forEach((arrow) => {
      const phase = reducedMotion ? arrow.userData.phase : (arrow.userData.phase + this.elapsed * (0.15 + intensity * 0.5)) % 1;
      arrow.position.z = 1.6 - phase * 3.2;
    });
    if (running && !calibrating) {
      this.tracePoints.push(new THREE.Vector3(this.specimen.position.x, 0.40, this.specimen.position.z));
      if (this.tracePoints.length > 64) this.tracePoints.shift();
      const positions = this.trace.geometry.attributes.position;
      this.tracePoints.forEach((point, index) => positions.setXYZ(index, point.x, point.y, point.z));
      positions.needsUpdate = true;
      this.trace.geometry.setDrawRange(0, this.tracePoints.length);
      this.trace.geometry.computeBoundingSphere();
    }
    const desiredPosition = this.view === "top" ? new THREE.Vector3(0, 6.7, 0.001) : new THREE.Vector3(0.18, 4.10, 8.85);
    const desiredTarget = this.view === "top" ? new THREE.Vector3(0, 0.68, 0) : new THREE.Vector3(0, 1.24, 0);
    const alpha = this.cameraInstant ? 1 : 1 - Math.exp(-delta * 8);
    this.camera.position.lerp(desiredPosition, alpha);
    this.cameraTarget.lerp(desiredTarget, alpha);
    this.camera.lookAt(this.cameraTarget);
    this.center.visible = showCenter;
    this.scan.visible = running;
    this.scan.position.y = 0.46 + (0.5 - Math.cos(progress * Math.PI * 4) * 0.5) * 1.21;
    if (this.frameReady) this.renderer.render(this.scene, this.camera);
    return { rpm: this.rpm, lean: THREE.MathUtils.radToDeg(this.lean), drift, angle: this.rotor.rotation.y };
  }
}
