import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import championshipUrl from "../../../resources/battle_worlds/championship.glb?url";
import streetUrl from "../../../resources/battle_worlds/street.glb?url";
import ruinsUrl from "../../../resources/battle_worlds/floating_ruins.glb?url";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { applySurfaceFinish } from "./surface-finish.js";
import { addArenaArchitecture } from "./arena-details.js";
import { BattleEffects } from "./battle-effects.js";
import { StreetAtmosphere } from "./street-atmosphere.js";
import { ChampionshipAtmosphere } from "./championship-atmosphere.js";
import { prepareScene } from "./prepare-scene.js";
import { loadoutVisualKey } from "./loadout-visual-key.js";
import { createOutdoorEnvironment, normalizeSceneTime, resolveSceneTime } from "./scene-time.js";
import { createDriveZoneModel, updateDriveZoneModel } from "./drive-zone-model.js";
import {
  createTopModel,
  prepareTopModel,
  disposeTopModel,
  setActivePart,
  updateTopPartFocus,
  applyTopDamage,
} from "./top-model.js";

const LAUNCH_MIN_POWER = 0.35;
const LAUNCH_MIN_LENGTH = 1.85;
const LAUNCH_MAX_LENGTH = 4.4;

function disposeGroup(group) {
  group.traverse((child) => {
    if (!child.geometry) return;
    child.geometry?.dispose();
    if (Array.isArray(child.material)) {
      child.material.forEach((item) => item.dispose());
    } else {
      child.material?.dispose();
    }
  });
  group.clear();
}

function arenaHeightAt(arena, radius, angle = 0) {
  if (arena.groundHeight !== undefined) return arena.groundHeight;
  const normalized = THREE.MathUtils.clamp(radius / arena.wallRadius, 0, 1);
  if (arena.id === "metal") {
    return (
      -0.46 +
      normalized ** 1.5 * 0.76 +
      Math.sin(angle * 6 + normalized * 8) * normalized * 0.012
    );
  }
  if (arena.id === "composite") {
    if (normalized < 0.46) {
      return -0.52 + normalized ** 2 * 0.34;
    }
    if (normalized < 0.86) {
      return -0.448 + (normalized - 0.46) * 0.72;
    }
    return -0.16 + (normalized - 0.86) * 3.25;
  }
  return -0.5 + normalized ** 2 * 0.82;
}

function createBowlGeometry(arena) {
  const segments = 192;
  const rings = 64;
  const positions = [];
  const colors = [];
  const indices = [];
  const colorForRadius = (radius) => {
    if (arena.id === "metal") return new THREE.Color("#778b91");
    if (arena.id === "composite") {
      if (radius < 3.1) return new THREE.Color("#94a6ad");
      if (radius < 5.9) return new THREE.Color("#354a43");
      return new THREE.Color("#89453a");
    }
    return new THREE.Color("#637270");
  };

  for (let ring = 0; ring <= rings; ring += 1) {
    const radius = (arena.wallRadius * ring) / rings;
    for (let segment = 0; segment <= segments; segment += 1) {
      const angle = (Math.PI * 2 * segment) / segments;
      const height = arenaHeightAt(arena, radius, angle);
      positions.push(
        Math.cos(angle) * radius,
        height,
        Math.sin(angle) * radius,
      );
      const color = colorForRadius(radius);
      const variation = 0.94 + Math.sin(angle * 4 + ring) * 0.018;
      colors.push(color.r * variation, color.g * variation, color.b * variation);
    }
  }

  const row = segments + 1;
  for (let ring = 0; ring < rings; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const a = ring * row + segment;
      const b = a + row;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function addArenaTerrainDetails(group, arena) {
  const detailMaterial = new THREE.MeshStandardMaterial({
    color: arena.accent,
    emissive: arena.accent,
    emissiveIntensity: 0.08,
    metalness: arena.id === "metal" ? 0.92 : 0.38,
    roughness: arena.id === "metal" ? 0.16 : 0.62,
  });
  if (arena.id === "metal") {
    for (const radius of [1.35, 2.85, 4.4, 5.72]) {
      const speedRail = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.045, 7, 96),
        detailMaterial,
      );
      speedRail.rotation.x = Math.PI * 0.5;
      speedRail.position.y = arenaHeightAt(arena, radius) + 0.045;
      speedRail.castShadow = true;
      group.add(speedRail);
    }
    return;
  }
  if (arena.id === "composite") {
    const brakeMaterial = new THREE.MeshStandardMaterial({
      color: 0xb74336,
      metalness: 0.08,
      roughness: 0.92,
    });
    const brakeRadius = arena.wallRadius * 0.91;
    for (let index = 0; index < 20; index += 1) {
      const angle = (index / 20) * Math.PI * 2;
      const brake = new THREE.Mesh(
        new RoundedBoxGeometry(0.52, 0.06, 0.2, 2, 0.018),
        brakeMaterial,
      );
      brake.position.set(
        Math.cos(angle) * brakeRadius,
        arenaHeightAt(arena, brakeRadius, angle) + 0.018,
        Math.sin(angle) * brakeRadius,
      );
      brake.rotation.y = -angle;
      brake.castShadow = true;
      group.add(brake);
    }
    return;
  }

  const centerGuide = new THREE.Mesh(
    new THREE.CylinderGeometry(0.62, 0.72, 0.07, 48),
    detailMaterial,
  );
  centerGuide.position.y = arenaHeightAt(arena, 0) + 0.045;
  centerGuide.receiveShadow = true;
  group.add(centerGuide);
}

function createArenaModel(arena) {
  const group = new THREE.Group();
  const bowlMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    metalness: arena.id === "metal" ? 0.82 : 0.3,
    roughness: arena.id === "metal" ? 0.32 : 0.58,
  });
  applySurfaceFinish(bowlMaterial, "arena");
  const bowl = new THREE.Mesh(createBowlGeometry(arena), bowlMaterial);
  bowl.receiveShadow = true;
  group.add(bowl);

  const rimMaterial = new THREE.MeshPhysicalMaterial({
    color: arena.accent,
    metalness: 0.78,
    roughness: 0.24,
    emissive: arena.accent,
    emissiveIntensity: 0.12,
  });
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(arena.wallRadius + 0.12, 0.12, 20, 192),
    rimMaterial,
  );
  rim.rotation.x = Math.PI * 0.5;
  rim.position.y = arenaHeightAt(arena, arena.wallRadius) + 0.04;
  rim.castShadow = true;
  group.add(rim);

  const lineMaterial = new THREE.MeshBasicMaterial({
    color: arena.accent,
    transparent: true,
    opacity: 0.28,
  });
  const lineRadii =
    arena.id === "composite" ? [3.1, 5.9] : [2.25, 4.75];
  for (const radius of lineRadii) {
    const line = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.018, 5, 96),
      lineMaterial,
    );
    line.rotation.x = Math.PI * 0.5;
    line.position.y = arenaHeightAt(arena, radius) + 0.025;
    group.add(line);
  }

  const center = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 0.018, 32),
    rimMaterial,
  );
  center.position.y = arenaHeightAt(arena, 0) + 0.02;
  group.add(center);
  addArenaTerrainDetails(group, arena);
  addArenaArchitecture(group, arena, arenaHeightAt);
  return group;
}

function createPedestal() {
  const group = new THREE.Group();
  const baseMaterial = new THREE.MeshStandardMaterial({
    color: 0xf5f1e8,
    metalness: 0.08,
    roughness: 0.72,
  });
  const accentMaterial = new THREE.MeshBasicMaterial({
    color: 0x11151a,
    transparent: true,
    opacity: 0.86,
  });
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.86, 0.34, 64),
    baseMaterial,
  );
  base.position.y = -0.78;
  base.receiveShadow = true;
  group.add(base);
  const line = new THREE.Mesh(
    new THREE.TorusGeometry(1.62, 0.024, 6, 64),
    accentMaterial,
  );
  line.rotation.x = Math.PI * 0.5;
  line.position.y = -0.59;
  group.add(line);
  return group;
}

function createLauncherModel() {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x20282d,
    metalness: 0.62,
    roughness: 0.28,
    clearcoat: 0.5,
  });
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: 0xffd23f,
    metalness: 0.35,
    roughness: 0.32,
  });
  const body = new THREE.Mesh(
    new RoundedBoxGeometry(1.6, 0.34, 0.9, 3, 0.08),
    bodyMaterial,
  );
  body.castShadow = true;
  group.add(body);
  const rail = new THREE.Mesh(
    new RoundedBoxGeometry(0.24, 0.18, 2.2, 2, 0.035),
    accentMaterial,
  );
  rail.position.set(0, 0.25, -0.92);
  rail.castShadow = true;
  group.add(rail);
  const grip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.24, 1.15, 20),
    bodyMaterial,
  );
  grip.rotation.z = -0.28;
  grip.position.set(0.62, -0.62, 0.12);
  grip.castShadow = true;
  group.add(grip);
  const socket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.58, 0.52, 0.16, 40),
    accentMaterial,
  );
  socket.position.set(0, -0.22, -0.42);
  group.add(socket);
  return group;
}

export class ThreeStage {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#090d0f");
    this.scene.fog = new THREE.FogExp2("#090d0f", 0.035);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 900);
    this.sceneTime = "auto";
    this.scenePeriod = resolveSceneTime(this.sceneTime);
    this.outdoorEnvironments = {};
    this.camera.position.set(0, 3, 7);
    this.cameraTarget = new THREE.Vector3(0, 0, 0);
    this.desiredCameraPosition = this.camera.position.clone();
    this.desiredCameraTarget = this.cameraTarget.clone();

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.append(this.renderer.domElement);
    const environment = new RoomEnvironment();
    const generator = new THREE.PMREMGenerator(this.renderer);
    this.environmentTarget = generator.fromScene(environment, 0.04);
    this.scene.environment = this.environmentTarget.texture;
    this.scene.environmentIntensity = 0.75;
    environment.dispose();
    generator.dispose();

    const renderTarget = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      samples: Math.min(4, this.renderer.capabilities.maxSamples),
    });
    this.composer = new EffectComposer(this.renderer, renderTarget);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.22, 0.3, 1.35);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.battleEffects = new BattleEffects(this.scene);
    this.visualTime = 0;
    this.activeArena = null;
    this.arenaReady = false;
    this.arenaLoadToken = 0;
    this.preparationToken = 0;
    this.preparations = new Set();
    this.scenePulse = 0;
    this.energyMaterials = [];
    this.streetAtmosphere = null;
    this.championshipAtmosphere = null;

    this.arenaRoot = new THREE.Group();
    this.modelRoot = new THREE.Group();
    this.launcherRoot = new THREE.Group();
    this.effectRoot = new THREE.Group();
    this.scene.add(
      this.arenaRoot,
      this.modelRoot,
      this.launcherRoot,
      this.effectRoot,
    );
    this.controlArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(),
      1,
      0x37a8ff,
      0.32,
      0.18,
    );
    this.controlArrow.visible = false;
    this.effectRoot.add(this.controlArrow);
    this.launchVectorRoot = new THREE.Group();
    this.launchVectorArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(),
      3.2,
      0xffd23f,
      0.42,
      0.24,
    );
    this.launchVectorArrow.line.material.depthTest = false;
    this.launchVectorArrow.line.material.transparent = true;
    this.launchVectorArrow.line.material.opacity = 0.92;
    this.launchVectorArrow.line.renderOrder = 15;
    this.launchVectorArrow.cone.material.depthTest = false;
    this.launchVectorArrow.cone.material.transparent = true;
    this.launchVectorArrow.cone.material.opacity = 0.96;
    this.launchVectorArrow.cone.renderOrder = 15;
    this.launchVectorHandle = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 20, 12),
      new THREE.MeshBasicMaterial({
        color: 0xffd23f,
        transparent: true,
        opacity: 0.92,
        depthTest: false,
      }),
    );
    this.launchVectorHandle.renderOrder = 16;
    this.launchVectorHandleHalo = new THREE.Mesh(
      new THREE.TorusGeometry(0.31, 0.026, 8, 36),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.72,
        depthTest: false,
      }),
    );
    this.launchVectorHandleHalo.renderOrder = 16;
    this.launchVectorHitTarget = new THREE.Mesh(
      new THREE.SphereGeometry(0.52, 12, 8),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.launchVectorHitTarget.renderOrder = 17;
    this.launchVectorRoot.add(
      this.launchVectorArrow,
      this.launchVectorHandle,
      this.launchVectorHandleHalo,
      this.launchVectorHitTarget,
    );
    this.launchVectorRoot.visible = false;
    this.effectRoot.add(this.launchVectorRoot);
    this.controlInfluenceRing = new THREE.Mesh(
      new THREE.RingGeometry(0.72, 0.79, 48),
      new THREE.MeshBasicMaterial({
        color: 0x37a8ff,
        transparent: true,
        opacity: 0,
        depthTest: false,
      }),
    );
    this.controlInfluenceRing.rotation.x = -Math.PI * 0.5;
    this.controlInfluenceRing.renderOrder = 12;
    this.controlInfluenceRing.visible = false;
    this.riskRing = new THREE.Mesh(
      new THREE.RingGeometry(0.84, 0.94, 48),
      new THREE.MeshBasicMaterial({
        color: 0xffb33d,
        transparent: true,
        opacity: 0,
        depthTest: false,
      }),
    );
    this.riskRing.rotation.x = -Math.PI * 0.5;
    this.riskRing.renderOrder = 11;
    this.riskRing.visible = false;
    this.effectRoot.add(this.controlInfluenceRing, this.riskRing);
    this.diyHandleRoot = new THREE.Group();
    this.diyHandleRoot.visible = false;
    const createDiyHandle = (property, color, geometry) => {
      const handle = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          color,
          depthTest: false,
          transparent: true,
          opacity: 0.96,
        }),
      );
      handle.userData.diyProperty = property;
      handle.renderOrder = 24;
      this.diyHandleRoot.add(handle);
      return handle;
    };
    this.diyHandles = {
      size: createDiyHandle(
        "size",
        0x238cff,
        new THREE.SphereGeometry(0.13, 18, 12),
      ),
      height: createDiyHandle(
        "height",
        0xf2a126,
        new THREE.ConeGeometry(0.14, 0.28, 4),
      ),
      shape: createDiyHandle(
        "shape",
        0xf45b2a,
        new THREE.OctahedronGeometry(0.15),
      ),
    };
    this.effectRoot.add(this.diyHandleRoot);
    this.effects = [];
    this.mode = "assembly";
    this.partEditorSlot = null;
    this.assemblyView = "orbit";
    this.activeAssemblySlot = null;
    this.assemblyTop = null;
    this.assemblyTops = [];
    this.assemblyFitScale = 1;
    this.carouselTransition = false;
    this.partSwap = null;
    this.diyCustomization = null;
    this.diyDrag = null;
    this.diyChangeFrame = null;
    this.playerTop = null;
    this.enemyTop = null;
    this.dragging = false;
    this.dragMode = null;
    this.dragDistance = 0;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.dragStartedOnModel = false;
    this.lastPointerX = 0;
    this.lastPointerY = 0;
    this.activePointers = new Map();
    this.pinchDistance = 0;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.assemblyOrbit = {
      yaw: 0,
      pitch: 0.36,
      radius: 5.85,
    };
    this.assemblyTarget = new THREE.Vector3(0, 0.02, 0);
    this.defaultAssemblyTarget = this.assemblyTarget.clone();
    this.launcherParams = {
      height: 0.45,
      direction: 0,
      angle: 0,
      power: 0.86,
    };
    this.lastAssemblyInteraction = performance.now();
    this.reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    this.centerOfMassMarker = null;

    this._addLights();
    this._bindPreviewControls();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  _addLights() {
    const hemisphere = new THREE.HemisphereLight(0xeaf7ff, 0x403c32, 0.8);
    this.ambientLight=hemisphere;
    this.scene.add(hemisphere);
    const key = new THREE.DirectionalLight(0xfff3dd, 2.5);
    key.position.set(3, 10, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -10;
    key.shadow.camera.right = 10;
    key.shadow.camera.top = 10;
    key.shadow.camera.bottom = -10;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 35;
    key.shadow.normalBias = 0.018;
    key.shadow.bias = -0.0001;
    this.keyLight = key;
    this.scene.add(key);
    const edge = new THREE.DirectionalLight(0x87dbe8, 1.3);
    edge.position.set(-5, 4, -5);
    this.edgeLight = edge;
    this.scene.add(edge);
    this.spotlights = [0, 1].map((index) => {
      const light = new THREE.SpotLight(index ? 0x9cdcf2 : 0xffe0ac,
        160, 30, Math.PI / 5, 0.7, 2);
      light.position.set(index ? -5.8 : 5.8, 6.5, -5.8);
      light.target.position.set(index ? 2 : -2, -0.3, 0);
      this.scene.add(light, light.target);
      return light;
    });
  }

  _bindPreviewControls() {
    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointerdown", (event) => {
      if (this.mode === "battle" && this.launcherRoot.visible) {
        this._startLaunchDrag(event);
        return;
      }
      if (this.mode !== "assembly") return;
      if (this.partEditorSlot && this._startDiyDrag(event)) return;
      event.preventDefault();
      this._markAssemblyInteraction();
      this.activePointers.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
      this.dragging = true;
      this.lastPointerX = event.clientX;
      this.lastPointerY = event.clientY;
      this.dragStartX = event.clientX;
      this.dragStartY = event.clientY;
      this.dragDistance = 0;
      this.draggedSlot = null;
      const hit = this._pickAssemblyPart(event.clientX, event.clientY);
      this.dragStartedOnModel = Boolean(hit);
      this.dragMode = this.partEditorSlot ? "locked" : "camera";
      if (hit) this.draggedSlot = hit.slot;
      canvas.setPointerCapture(event.pointerId);
      if (this.activePointers.size === 2 && !this.partEditorSlot) {
        this.dragMode = "pinch";
        this.pinchDistance = this._activePointerDistance();
      }
    });
    canvas.addEventListener("pointermove", (event) => {
      if (
        this.mode === "battle" &&
        (this.dragMode === "launch-vector" ||
          this.dragMode === "launch-model")
      ) {
        this._moveLaunchDrag(event);
        return;
      }
      if (this.dragMode === "diy-handle") {
        this._moveDiyDrag(event);
        return;
      }
      if (!this.dragging || !this.assemblyTop || this.mode !== "assembly") {
        return;
      }
      const previous = this.activePointers.get(event.pointerId);
      if (!previous) return;
      this.activePointers.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
      if (this.activePointers.size >= 2 && !this.partEditorSlot) {
        const distance = this._activePointerDistance();
        if (this.pinchDistance > 0) {
          this._zoomAssembly(this.pinchDistance / distance);
        }
        this.pinchDistance = distance;
        this.dragMode = "pinch";
        return;
      }
      const deltaX = event.clientX - this.lastPointerX;
      const deltaY = event.clientY - this.lastPointerY;
      this.dragDistance += Math.hypot(deltaX, deltaY);
      if (this.dragMode === "camera") {
        this._markAssemblyInteraction();
        this.assemblyOrbit.yaw -= deltaX * 0.007;
        this.assemblyOrbit.pitch = THREE.MathUtils.clamp(
          this.assemblyOrbit.pitch + deltaY * 0.006,
          0.08,
          1.08,
        );
        this._applyAssemblyCamera();
      }
      this.lastPointerX = event.clientX;
      this.lastPointerY = event.clientY;
    });
    const release = (event) => {
      if (
        this.dragMode === "launch-vector" ||
        this.dragMode === "launch-model"
      ) {
        this._finishLaunchDrag(event);
        return;
      }
      if (this.dragMode === "diy-handle") {
        this._finishDiyDrag(event);
        return;
      }
      const wasTap =
        this.dragMode === "camera" &&
        this.dragDistance < 8 &&
        this.activePointers.size === 1;
      const horizontalSwipe =
        !this.partEditorSlot &&
        !this.dragStartedOnModel &&
        this.dragDistance >= 70 &&
        Math.abs(event.clientX - this.dragStartX) >
          Math.abs(event.clientY - this.dragStartY) * 1.25;
      const direction =
        event.clientX - this.dragStartX < 0 ? "next" : "previous";
      const slot = this.draggedSlot;
      this.activePointers.delete(event.pointerId);
      this.dragging = this.activePointers.size > 0;
      this.pinchDistance =
        this.activePointers.size >= 2 ? this._activePointerDistance() : 0;
      if (!this.dragging) {
        this.dragMode = null;
        this.draggedSlot = null;
        this.dragStartedOnModel = false;
      }
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      if (wasTap) {
        this.container.dispatchEvent(
          new CustomEvent(slot ? "partselect" : "assemblyclear", {
            detail: slot ? { slot } : {},
          }),
        );
      } else if (horizontalSwipe) {
        this.container.dispatchEvent(
          new CustomEvent("topswipe", { detail: { direction } }),
        );
      }
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
    canvas.addEventListener(
      "wheel",
      (event) => {
        if (this.mode !== "assembly" || this.partEditorSlot) return;
        event.preventDefault();
        this._markAssemblyInteraction();
        this._zoomAssembly(Math.exp(event.deltaY * 0.0012));
      },
      { passive: false },
    );
  }

  _startDiyDrag(event) {
    const hits = this._raycastObject(
      this.diyHandleRoot,
      event.clientX,
      event.clientY,
    );
    const property = hits?.object?.userData?.diyProperty;
    if (!property || !this.diyCustomization) return false;
    event.preventDefault();
    this.dragging = true;
    this.dragMode = "diy-handle";
    this.diyDrag = {
      property,
      startX: event.clientX,
      startY: event.clientY,
      startValue: this.diyCustomization[property],
      view: this.assemblyView,
    };
    this.renderer.domElement.setPointerCapture(event.pointerId);
    return true;
  }

  _moveDiyDrag(event) {
    if (!this.diyDrag || !this.diyCustomization) return;
    const deltaX = event.clientX - this.diyDrag.startX;
    const deltaY = event.clientY - this.diyDrag.startY;
    const { property, startValue, view } = this.diyDrag;
    let value = startValue;
    if (property === "size") {
      value = THREE.MathUtils.clamp(
        startValue + deltaX * 0.0026,
        0.78,
        1.24,
      );
    } else if (property === "height") {
      value = THREE.MathUtils.clamp(
        startValue - deltaY * 0.0032,
        0.72,
        1.35,
      );
    } else {
      const delta =
        view === "top"
          ? -deltaY
          : view === "side"
            ? deltaX
            : -deltaX;
      value = THREE.MathUtils.clamp(
        startValue + delta * 0.48,
        0,
        100,
      );
    }
    this.diyCustomization[property] = value;
    this._emitDiyChange(property, value);
  }

  _finishDiyDrag(event) {
    const canvas = this.renderer.domElement;
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    this.dragging = false;
    this.dragMode = null;
    this.diyDrag = null;
  }

  _emitDiyChange(property, value) {
    this.pendingDiyChange = { property, value };
    if (this.diyChangeFrame !== null) return;
    this.diyChangeFrame = requestAnimationFrame(() => {
      this.diyChangeFrame = null;
      const detail = this.pendingDiyChange;
      this.pendingDiyChange = null;
      if (!detail) return;
      this.container.dispatchEvent(
        new CustomEvent("diychange", { detail }),
      );
    });
  }

  _startLaunchDrag(event) {
    event.preventDefault();
    const canvas = this.renderer.domElement;
    const handleHit = this._raycastObject(
      this.launchVectorHitTarget,
      event.clientX,
      event.clientY,
    );
    const modelHit =
      this._raycastObject(
        this.launcherRoot,
        event.clientX,
        event.clientY,
      ) ||
      this._raycastObject(
        this.playerTop,
        event.clientX,
        event.clientY,
      );
    if (!handleHit && !modelHit) return;
    this.dragging = true;
    this.dragMode = handleHit ? "launch-vector" : "launch-model";
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  }

  _moveLaunchDrag(event) {
    if (!this.dragging) return;
    if (this.dragMode === "launch-vector") {
      const anchor = this._launchVectorAnchor();
      const plane = new THREE.Plane(
        new THREE.Vector3(0, 1, 0),
        -anchor.y,
      );
      const point = this._rayPlanePoint(
        event.clientX,
        event.clientY,
        plane,
      );
      if (point) {
        const vector = point.sub(anchor);
        const distance = Math.hypot(vector.x, vector.z);
        this.launcherParams.direction = THREE.MathUtils.clamp(
          Math.atan2(vector.x, -vector.z),
          -Math.PI / 3,
          Math.PI / 3,
        );
        this.launcherParams.power = THREE.MathUtils.clamp(
          LAUNCH_MIN_POWER +
            ((distance - LAUNCH_MIN_LENGTH) /
              (LAUNCH_MAX_LENGTH - LAUNCH_MIN_LENGTH)) *
              (1 - LAUNCH_MIN_POWER),
          LAUNCH_MIN_POWER,
          1,
        );
      }
    } else {
      const deltaX = event.clientX - this.lastPointerX;
      const deltaY = event.clientY - this.lastPointerY;
      this.launcherParams.direction = THREE.MathUtils.clamp(
        this.launcherParams.direction + deltaX * 0.006,
        -Math.PI / 3,
        Math.PI / 3,
      );
      this.launcherParams.angle = THREE.MathUtils.clamp(
        this.launcherParams.angle + deltaY * 0.0045,
        -0.35,
        0.35,
      );
    }
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
    this.updateLauncherPreview(this.launcherParams);
    this._emitLaunchChange();
  }

  _finishLaunchDrag(event) {
    const canvas = this.renderer.domElement;
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    this.dragging = false;
    this.dragMode = null;
  }

  _emitLaunchChange() {
    this.container.dispatchEvent(
      new CustomEvent("launchchange", {
        detail: { ...this.launcherParams },
      }),
    );
  }

  _setPointerFromClient(clientX, clientY) {
    const bounds = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((clientX - bounds.left) / bounds.width) * 2 - 1,
      -((clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  _raycastObject(object, clientX, clientY) {
    if (!object) return null;
    this._setPointerFromClient(clientX, clientY);
    return this.raycaster.intersectObject(object, true)[0] ?? null;
  }

  _rayPlanePoint(clientX, clientY, plane) {
    this._setPointerFromClient(clientX, clientY);
    return this.raycaster.ray.intersectPlane(
      plane,
      new THREE.Vector3(),
    );
  }

  _pickAssemblyPart(clientX, clientY) {
    if (!this.assemblyTop) return null;
    const bounds = this.renderer.domElement.getBoundingClientRect();
    this._setPointerFromClient(clientX, clientY);
    const intersections = this.raycaster.intersectObject(
      this.assemblyTop,
      true,
    );
    const hitSlots = new Set();
    for (const hit of intersections) {
      let current = hit.object;
      while (current && current.parent !== this.assemblyTop) {
        current = current.parent;
      }
      if (current?.name) hitSlots.add(current.name);
    }
    if (hitSlots.size === 0) return null;
    const candidates = Object.entries(
      this.assemblyTop.userData.partGroups ?? {},
    )
      .filter(([slot]) => !this.partEditorSlot || slot === this.partEditorSlot)
      .map(([slot, group]) => {
        const center = new THREE.Box3()
          .setFromObject(group)
          .getCenter(new THREE.Vector3())
          .project(this.camera);
        const screenX = bounds.left + ((center.x + 1) * 0.5) * bounds.width;
        const screenY = bounds.top + ((1 - center.y) * 0.5) * bounds.height;
        return {
          slot,
          distance:
            Math.abs(screenY - clientY) * 2.2 +
            Math.abs(screenX - clientX) * 0.35,
        };
      })
      .sort((left, right) => left.distance - right.distance);
    const closest = candidates[0];
    if (!closest) return null;
    return { slot: closest.slot };
  }

  _markAssemblyInteraction() {
    this.lastAssemblyInteraction = performance.now();
  }

  _activePointerDistance() {
    const points = [...this.activePointers.values()];
    if (points.length < 2) return 0;
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  }

  _zoomAssembly(multiplier) {
    this.assemblyOrbit.radius = THREE.MathUtils.clamp(
      this.assemblyOrbit.radius * multiplier,
      3.8,
      8.4,
    );
    this._applyAssemblyCamera();
  }

  _applyAssemblyCamera(immediate = false) {
    const { yaw, pitch, radius } = this.assemblyOrbit;
    const horizontalRadius = Math.cos(pitch) * radius;
    const position = new THREE.Vector3(
      Math.sin(yaw) * horizontalRadius,
      Math.sin(pitch) * radius + this.assemblyTarget.y,
      Math.cos(yaw) * horizontalRadius,
    ).add(new THREE.Vector3(this.assemblyTarget.x, 0, this.assemblyTarget.z));
    this.desiredCameraPosition.copy(position);
    this.desiredCameraTarget.copy(this.assemblyTarget);
    if (immediate) {
      this.camera.position.copy(position);
      this.cameraTarget.copy(this.assemblyTarget);
    }
  }

  resetAssemblyView(immediate = false) {
    if (this.partEditorSlot) {
      this.setAssemblyOrthographicView("front", immediate);
      return;
    }
    this.assemblyView = "orbit";
    this.assemblyOrbit = {
      yaw: 0,
      pitch: 0.36,
      radius: 5.85,
    };
    if (this.assemblyTop) this.assemblyTop.rotation.set(0, 0, 0);
    this._applyAssemblyCamera(immediate);
    this._fitAssemblyModel();
  }

  _fitAssemblyModel() {
    if (!this.assemblyTop || this.mode !== "assembly") return;
    this.assemblyTop.scale.setScalar(1);
    const bounds = new THREE.Box3().setFromObject(this.assemblyTop);
    const fitCamera = this.camera.clone();
    const fitPitch = 0.36;
    const fitRadius = 5.85;
    fitCamera.position.set(
      0,
      Math.sin(fitPitch) * fitRadius + this.assemblyTarget.y,
      Math.cos(fitPitch) * fitRadius,
    );
    fitCamera.lookAt(this.assemblyTarget);
    fitCamera.updateMatrixWorld();
    fitCamera.updateProjectionMatrix();
    const projected = [];
    for (const x of [bounds.min.x, bounds.max.x]) {
      for (const y of [bounds.min.y, bounds.max.y]) {
        for (const z of [bounds.min.z, bounds.max.z]) {
          projected.push(new THREE.Vector3(x, y, z).project(fitCamera));
        }
      }
    }
    const projectedWidth =
      Math.max(...projected.map((point) => point.x)) -
      Math.min(...projected.map((point) => point.x));
    const projectedHeight =
      Math.max(...projected.map((point) => point.y)) -
      Math.min(...projected.map((point) => point.y));
    const scale = THREE.MathUtils.clamp(
      Math.min(1.34 / projectedHeight, 1.42 / projectedWidth),
      0.58,
      1.58,
    );
    this.assemblyFitScale = scale;
    this.assemblyTop.scale.setScalar(scale);
    this._layoutAssemblyTops(scale);
  }

  _layoutAssemblyTops(activeScale = this.assemblyTop?.scale.x ?? 1) {
    this.assemblyTops.forEach((top) => {
      const offset = top.userData.carouselOffset ?? 0;
      if (offset === 0) {
        top.position.set(0, 0.12, 0);
        top.scale.setScalar(activeScale);
        return;
      }
      top.position.set(offset * 2.05, -0.18, 0.55);
      top.scale.setScalar(activeScale * 0.58);
      top.traverse((child) => {
        if (!child.isMesh) return;
        child.material.transparent = true;
        child.material.opacity = 0.22;
        child.material.depthWrite = false;
      });
    });
  }

  _clearModels({ keepArena = false } = {}) {
    this.battlePreparationLease?.dispose();
    this.battlePreparationLease = null;
    if (!keepArena) {
      this.cancelBattleWarmup();
      this.streetAtmosphere?.dispose();
      this.streetAtmosphere = null;
      this.championshipAtmosphere?.dispose();
      this.championshipAtmosphere = null;
      this.mountedArenaId = null;
    }
    this.battleEffects.reset();
    for (const effect of this.effects) {
      effect.geometry.dispose();
      effect.material.dispose();
      effect.removeFromParent();
    }
    this.effects = [];
    this.diyHandleRoot.visible = false;
    this._removeCenterOfMassMarker();
    for (const top of this.assemblyTops) disposeTopModel(top);
    if (this.playerTop) disposeTopModel(this.playerTop);
    if (this.enemyTop) disposeTopModel(this.enemyTop);
    this.assemblyTop = null;
    this.assemblyTops = [];
    this.playerTop = null;
    this.enemyTop = null;
    this.modelRoot.clear();
  }

  showAssembly(
    loadouts,
    activeLoadoutIndex,
    activeSlot,
    { preserveCamera = false } = {},
  ) {
    this.mode = "assembly";
    this.preparationToken++;
    this.arenaLoadToken++;
    this.energyMaterials = [];
    this.activeArena = null;
    this._configureLighting("assembly");
    this.activeAssemblySlot = activeSlot ?? null;
    this.launchVectorRoot.visible = false;
    if (!preserveCamera) {
      this.assemblyTarget.copy(this.defaultAssemblyTarget);
      this.assemblyOrbit.radius = activeSlot ? 4.45 : 5.85;
    }
    this._markAssemblyInteraction();
    this._setSceneColors("#f7f3e9", 0.018);
    this._clearModels();
    disposeGroup(this.arenaRoot);
    disposeGroup(this.launcherRoot);
    this.launcherRoot.visible = false;
    this.arenaRoot.add(createPedestal());
    loadouts.forEach((loadout, index) => {
      const top = createTopModel(
        loadout.build,
        loadout.colors,
        loadout.customizations,
      );
      let offset = index - activeLoadoutIndex;
      if (offset > 1) offset -= loadouts.length;
      if (offset < -1) offset += loadouts.length;
      top.userData.carouselOffset = offset;
      top.userData.loadoutIndex = index;
      if (offset === 0) {
        this.assemblyTop = top;
        setActivePart(top, activeSlot ?? null);
      } else {
        setActivePart(top, null);
      }
      this.assemblyTops.push(top);
      this.modelRoot.add(top);
    });
    this.camera.fov = 34;
    this.camera.updateProjectionMatrix();
    this._applyAssemblyCamera();
    this._fitAssemblyModel();
    this._alignPedestal();
    if (activeSlot) {
      this.focusAssemblyPart(activeSlot, !preserveCamera);
    }
  }

  setAssemblyActive(activeSlot) {
    if (activeSlot) {
      this.focusAssemblyPart(activeSlot);
    } else {
      this.clearAssemblyFocus();
    }
  }

  focusAssemblyPart(activeSlot, immediate = false) {
    if (!this.assemblyTop) return;
    this.activeAssemblySlot = activeSlot;
    const group = this.assemblyTop.userData.partGroups?.[activeSlot];
    if (!group) return;
    setActivePart(this.assemblyTop, activeSlot, immediate);
    this.assemblyTarget.set(0, group.userData.baseY + 0.04, 0);
    this.assemblyOrbit.radius = activeSlot === "tip" ? 4.05 : 4.4;
    this.assemblyOrbit.pitch =
      activeSlot === "attackRing" || activeSlot === "coreLock"
        ? 0.28
        : 0.38;
    this._applyAssemblyCamera(immediate);
    this._markAssemblyInteraction();
  }

  clearAssemblyFocus(immediate = false) {
    if (!this.assemblyTop) return;
    this.activeAssemblySlot = null;
    setActivePart(this.assemblyTop, null, immediate);
    this.assemblyTarget.copy(this.defaultAssemblyTarget);
    this.assemblyOrbit.radius = 5.85;
    this.assemblyOrbit.pitch = 0.36;
    this._applyAssemblyCamera(immediate);
    this._markAssemblyInteraction();
  }

  switchAssemblyLoadout(
    activeLoadoutIndex,
    activeSlot = null,
    direction = "next",
  ) {
    if (this.assemblyTops.length === 0) return;
    this.activeAssemblySlot = activeSlot;
    this.assemblyTops.forEach((top) => {
      const previousOffset = top.userData.carouselOffset ?? 0;
      let offset = top.userData.loadoutIndex - activeLoadoutIndex;
      if (offset > 1) offset -= this.assemblyTops.length;
      if (offset < -1) offset += this.assemblyTops.length;
      const wrappedAcross = Math.abs(offset - previousOffset) > 1;
      if (wrappedAcross) {
        const stagingOffset = direction === "next" ? 1.42 : -1.42;
        top.position.set(stagingOffset * 2.05, -0.18, 0.55);
        top.scale.setScalar(this.assemblyFitScale * 0.5);
        top.rotation.z = -stagingOffset * 0.2;
        top.traverse((child) => {
          if (!child.isMesh) return;
          child.material.transparent = true;
          child.material.opacity = 0;
          child.material.depthWrite = false;
        });
      }
      top.userData.carouselOffset = offset;
      top.userData.carouselTargetPosition = new THREE.Vector3(
        offset * 2.05,
        offset === 0 ? 0.12 : -0.18,
        offset === 0 ? 0 : 0.55,
      );
      top.userData.carouselTargetScale =
        this.assemblyFitScale * (offset === 0 ? 1 : 0.58);
      top.userData.carouselTargetOpacity = offset === 0 ? 1 : 0.22;
      top.userData.carouselTargetRotation =
        offset === 0 ? 0 : -offset * 0.2;
      if (offset === 0) {
        this.assemblyTop = top;
        setActivePart(top, activeSlot, false);
      } else {
        setActivePart(top, null, false);
      }
    });
    this.carouselTransition = true;
    this.clearAssemblyFocus();
    this._markAssemblyInteraction();
  }

  replaceAssemblyPart(loadouts, activeLoadoutIndex, slot) {
    const group = this.assemblyTop?.userData.partGroups?.[slot];
    if (!group || this.reducedMotion) {
      this.showAssembly(
        loadouts,
        activeLoadoutIndex,
        slot,
        { preserveCamera: true },
      );
      return;
    }
    this.partSwap = {
      phase: "out",
      elapsed: 0,
      duration: 0.13,
      loadouts,
      activeLoadoutIndex,
      slot,
      group,
      startY: group.position.y,
      startScale: group.scale.clone(),
      startRotationZ: group.rotation.z,
    };
    this._markAssemblyInteraction();
  }

  enterPartEditor(
    slot,
    centerOfMass,
    customization = null,
    immediate = false,
  ) {
    this.partEditorSlot = slot;
    this.assemblyView = "front";
    this.diyCustomization = customization
      ? { ...customization }
      : null;
    this.assemblyTops.forEach((top) => {
      top.visible = top === this.assemblyTop;
    });
    if (this.assemblyTop) {
      setActivePart(this.assemblyTop, slot);
      this._showCenterOfMass(centerOfMass);
    }
    this.setAssemblyOrthographicView("front", immediate);
    this._positionDiyHandles();
  }

  exitPartEditor(immediate = false) {
    this.partEditorSlot = null;
    this.diyCustomization = null;
    this.diyHandleRoot.visible = false;
    this.assemblyView = "orbit";
    this.assemblyTops.forEach((top) => {
      top.visible = true;
    });
    this._removeCenterOfMassMarker();
    this.resetAssemblyView(immediate);
  }

  setAssemblyOrthographicView(view, immediate = false) {
    if (!this.partEditorSlot || !this.assemblyTop) return;
    this.assemblyView = view;
    const target = this.assemblyTarget;
    const positions = {
      front: new THREE.Vector3(target.x, target.y + 0.2, 5.7),
      top: new THREE.Vector3(target.x, target.y + 5.9, 0.01),
      side: new THREE.Vector3(5.7, target.y + 0.2, target.z),
    };
    const position = positions[view] ?? positions.front;
    this.desiredCameraPosition.copy(position);
    this.desiredCameraTarget.copy(target);
    if (immediate) {
      this.camera.position.copy(position);
      this.cameraTarget.copy(target);
      this.camera.lookAt(target);
    }
    this._positionDiyHandles();
  }

  _positionDiyHandles() {
    const group =
      this.assemblyTop?.userData.partGroups?.[this.partEditorSlot];
    if (!group || !this.diyCustomization) {
      this.diyHandleRoot.visible = false;
      return;
    }
    const bounds = new THREE.Box3().setFromObject(group);
    const center = bounds.getCenter(new THREE.Vector3());
    const padding = 0.08;
    const { size, height, shape } = this.diyHandles;
    if (this.assemblyView === "side") {
      size.position.set(center.x, center.y, bounds.min.z - padding);
      shape.position.set(center.x, center.y, bounds.max.z + padding);
    } else {
      size.position.set(bounds.max.x + padding, center.y, center.z);
      shape.position.set(bounds.min.x - padding, center.y, center.z);
    }
    height.position.set(center.x, bounds.max.y + padding, center.z);
    height.visible = this.assemblyView !== "top";
    shape.visible = true;
    size.visible = true;
    this.diyHandleRoot.visible = true;
  }

  updateCenterOfMass(centerOfMass) {
    if (!this.partEditorSlot || !this.assemblyTop) return;
    this._showCenterOfMass(centerOfMass);
  }

  _showCenterOfMass(centerOfMass = [0, 0, 0]) {
    this._removeCenterOfMassMarker();
    const marker = new THREE.Group();
    const markerMaterial = new THREE.MeshBasicMaterial({
      color: 0xff4f2e,
      depthTest: false,
      transparent: true,
      opacity: 0.95,
    });
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 18, 12),
      markerMaterial,
    );
    core.renderOrder = 20;
    marker.add(core);
    for (const rotation of [
      [Math.PI * 0.5, 0, 0],
      [0, Math.PI * 0.5, 0],
      [0, 0, Math.PI * 0.5],
    ]) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.14, 0.012, 6, 28),
        markerMaterial,
      );
      ring.rotation.set(...rotation);
      ring.renderOrder = 20;
      marker.add(ring);
    }
    marker.position.set(
      centerOfMass[0] * 3.2,
      centerOfMass[1] * 3.2,
      centerOfMass[2] * 3.2,
    );
    marker.userData.isCenterOfMassMarker = true;
    this.centerOfMassMarker = marker;
    this.assemblyTop.add(marker);
  }

  _removeCenterOfMassMarker() {
    if (!this.centerOfMassMarker) return;
    disposeGroup(this.centerOfMassMarker);
    this.centerOfMassMarker.removeFromParent();
    this.centerOfMassMarker = null;
  }

  showArena(arena) {
    if (this.battleWarmup?.arenaId !== arena.id) this.cancelBattleWarmup();
    const keepArena = this.mountedArenaId === arena.id;
    this.preparationToken++;
    this.scenePeriod = resolveSceneTime(this.sceneTime);
    this.mode = "map";
    this.activeArena = arena;
    this._configureLighting("map");
    this.launchVectorRoot.visible = false;
    this.partEditorSlot = null;
    this._setSceneColors("#c8cecd", 0.012);
    this._clearModels({ keepArena });
    if (!keepArena) disposeGroup(this.arenaRoot);
    disposeGroup(this.launcherRoot);
    this.launcherRoot.visible = false;
    this._mountArena(arena);
    this.camera.fov = 38;
    this.camera.updateProjectionMatrix();
    this._fitArenaCamera();
  }

  prepareBattle(
    arena,
    playerSelection,
    enemySelection,
    playerColors,
    playerCustomizations = {},
    enemyIdentity = { colors: { ring: "#ec5b45", core: "#dfe9e7" }, customizations: {} },
  ) {
    const key = this._battleVisualKey(arena, playerSelection, enemySelection,
      playerColors, playerCustomizations, enemyIdentity);
    const warmed = this.battleWarmup?.key === key && this.battleWarmup.ready
      ? this.battleWarmup : null;
    if (warmed) this.battleWarmup = null;
    else this.cancelBattleWarmup();
    const keepArena = this.mountedArenaId === arena.id;
    this.preparationToken++;
    this.mode = "battle";
    this.finishElapsed = 0;
    this.scenePeriod = resolveSceneTime(this.sceneTime);
    this.activeArena = arena;
    this._configureLighting("battle");
    this.partEditorSlot = null;
    const battleBackgrounds = {
      standard: "#252d30",
      metal: "#202c31",
      composite: "#302c29",
    };
    this._setSceneColors(battleBackgrounds[arena.id] ?? "#11181b", 0.028);
    this._clearModels({ keepArena });
    if (!keepArena) disposeGroup(this.arenaRoot);
    disposeGroup(this.launcherRoot);
    this._mountArena(arena);
    this.launcherRoot.add(warmed?.launcher ?? createLauncherModel());
    this.launcherRoot.visible = true;
    this.launchVectorRoot.visible = true;
    this.playerTop = warmed?.player ?? createTopModel(
      playerSelection,
      playerColors,
      playerCustomizations,
    );
    this.enemyTop = warmed?.enemy ?? createTopModel(enemySelection, enemyIdentity.colors, enemyIdentity.customizations);
    // Keep speculative shader references until the first live battle draw.
    this.battlePreparationLease?.dispose();
    this.battlePreparationLease = warmed?.lease;
    this.playerTop.scale.setScalar(0.92);
    this.enemyTop.scale.setScalar(0.92);
    this.playerTop.position.set(0, this._topHeight(this.playerTop, 0, 4.45), 4.45);
    this.enemyTop.position.set(0, this._topHeight(this.enemyTop, 0, -4.45), -4.45);
    this.modelRoot.add(this.playerTop, this.enemyTop);
    this.camera.fov = 42;
    this.camera.updateProjectionMatrix();
    this._frameBattle();
    this.updateLauncherPreview(this.launcherParams);
  }

  _battleVisualKey(arena, player, enemy, colors, customizations, identity) {
    return `${arena.id}:${resolveSceneTime(this.sceneTime)}:${
      loadoutVisualKey({ build: player, colors, customizations })}:${
      loadoutVisualKey({ build: enemy, colors: identity.colors, customizations: identity.customizations })}`;
  }

  queueBattleWarmup(arena, player, enemy, colors, customizations, identity) {
    const key = this._battleVisualKey(arena, player, enemy, colors, customizations, identity);
    if (this.battleWarmup?.key === key) return;
    this.cancelBattleWarmup();
    this.battleWarmup = {
      key, arenaId: arena.id,
      selection: structuredClone({ player, enemy, colors, customizations, identity }),
    };
    this._scheduleBattleWarmup();
  }

  cancelBattleWarmup() {
    const job = this.battleWarmup;
    this.battleWarmup = null;
    if (!job) return;
    clearTimeout(job.timer);
    if (job.idle != null) window.cancelIdleCallback?.(job.idle);
    // Running compilation owns these objects until its final poll. It observes
    // cancellation before every subsequent batch or resource upload.
    if (!job.task) this._disposeBattleWarmup(job);
  }

  _disposeBattleWarmup(job) {
    job.lease?.dispose();
    if (job.player) disposeTopModel(job.player);
    if (job.enemy) disposeTopModel(job.enemy);
    if (job.launcher) disposeGroup(job.launcher);
  }

  _scheduleBattleWarmup() {
    const job = this.battleWarmup;
    if (!job || job.task || job.timer || job.idle != null || job.ready || !this.arenaReady || this.mode !== "map") return;
    // Wait for the carousel and the first preview frame. Speculation is optional
    // on renderers without parallel compilation.
    if (!this.renderer.extensions.has("KHR_parallel_shader_compile")) return;
    job.timer = window.setTimeout(() => {
      job.timer = null;
      const start = () => {
        job.idle = null;
        if (document.hidden || this.battleWarmup !== job || this.mode !== "map") return;
        const task = this._warmBattle(job).catch(error => {
          console.warn("Next battle preparation skipped", error);
          if (this.battleWarmup === job) this.battleWarmup = null;
        }).finally(() => {
          if (!job.ready && this.battleWarmup === job) this.battleWarmup = null;
          if (this.battleWarmup !== job) this._disposeBattleWarmup(job);
          this.preparations.delete(task);
          job.task = null;
        });
        job.task = task;
        this.preparations.add(task);
      };
      if (window.requestIdleCallback) job.idle = window.requestIdleCallback(start, { timeout: 1200 });
      else start();
    }, 600);
  }

  async _warmBattle(job) {
    const current = () => this.battleWarmup === job && this.mode === "map" &&
      this.arenaReady && !document.hidden;
    // Serialize with a canceled predecessor; rapid selection retains at most
    // one live set of speculative models and one pending request.
    await Promise.allSettled([...this.preparations]);
    if (!current()) return;
    const { player, enemy, colors, customizations, identity } = job.selection;
    job.player = await prepareTopModel(player, colors, customizations, current);
    if (!current()) return;
    job.enemy = await prepareTopModel(enemy, identity.colors, identity.customizations, current);
    if (!current()) return;
    job.launcher = createLauncherModel();
    const objects = [job.player, job.enemy, job.launcher];
    // Ordinary maps switch from direct rendering to the composer's linear
    // target for battle. Compile their arena variants during reading time too.
    if (!this.bloom.enabled) objects.push(this.arenaRoot);
    const controls = this.launchVectorRoot.clone(true);
    controls.visible = true;
    objects.push(controls);
    job.lease = await prepareScene(this.renderer, this.scene, this.camera, {
      objects, target: this.composer.readBuffer, current, retain: true,
    });
    if (current() && job.lease) job.ready = true;
    else if (this.battleWarmup === job) this.battleWarmup = null;
  }

  _mountArena(arena) {
    const status=(state,message="")=>this.container.dispatchEvent(new CustomEvent("arenastatus",{detail:{state,message}}));
    if (this.mountedArenaId === arena.id) {
      // Preview -> match -> preview retains the GLB, reflection targets and
      // compiled materials. Only round-local models and zone colors reset.
      disposeGroup(this.driveZoneModel);
      this.driveZoneModel.removeFromParent();
      this.driveZoneModel = createDriveZoneModel(arena, (x, z) =>
        arenaHeightAt(arena, Math.hypot(x, z), Math.atan2(z, x)));
      this.arenaRoot.add(this.driveZoneModel);
      this.scenePulse = 0;
      this._applySceneTime();
      if (this.arenaLoaded) this._prepareArena();
      else status("loading", "正在准备场景…");
      return;
    }
    const token=++this.arenaLoadToken;
    this.mountedArenaId = arena.id;
    this.preparedMapPeriod = null;
    this.driveZoneModel = createDriveZoneModel(arena, (x, z) =>
      arenaHeightAt(arena, Math.hypot(x, z), Math.atan2(z, x)));
    this.arenaRoot.add(this.driveZoneModel);
    this.energyMaterials=[];
    this.arenaReady=false;
    this.arenaLoaded=false;
    this.scenePulse=0;
    this._applySceneTime();
    if (!arena.scene) {
      this.arenaRoot.add(createArenaModel(arena));
      this.arenaLoaded=true;
      this._prepareArena();
      return;
    }
    status("loading","正在准备场景…");
    const urls={championship:championshipUrl,street:streetUrl,floating_ruins:ruinsUrl};
    new GLTFLoader().loadAsync(urls[arena.scene]).then(gltf=>{
      if (token!==this.arenaLoadToken) {disposeGroup(gltf.scene);return;}
      gltf.scene.traverse(mesh=>{
        if (!mesh.isMesh) return;
        mesh.castShadow=!mesh.material.transparent;
        mesh.receiveShadow=true;
        mesh.material.envMapIntensity=.6;
        if (mesh.material.metalness>.4) applySurfaceFinish(mesh.material,"machined",.32);
        if (/Slate|stone|asphalt|brick/i.test(mesh.material.name)) applySurfaceFinish(mesh.material,"stone",.7);
        if (mesh.material.name.startsWith("Energy") || mesh.material.name.startsWith("Crystal")) {
          this.energyMaterials.push({material:mesh.material,color:mesh.material.emissive.clone(),strength:mesh.material.emissiveIntensity});
        }
      });
      this.arenaRoot.add(gltf.scene);
      if (arena.id === "street") {
        this.streetAtmosphere = new StreetAtmosphere(this.scene, gltf.scene, {
          renderer: this.renderer,
          reflectionSize: this.container.clientWidth < 480 ? 512 : 768,
          exclude: [this.effectRoot],
          period: this.scenePeriod,
        });
      }
      if (arena.id === "metal") {
        this.championshipAtmosphere = new ChampionshipAtmosphere(this.scene, gltf.scene, {
          period: this.scenePeriod,
        });
      }
      this.arenaLoaded=true;
      this._prepareArena();
    }).catch(error=>{
      if (token!==this.arenaLoadToken) return;
      this.mountedArenaId = null;
      console.error("Arena asset failed",arena.scene,error);
      status("error","场景载入失败，请重新选择场地或刷新。");
    });
  }

  _prepareArena() {
    const token = ++this.preparationToken;
    const current = () => token === this.preparationToken;
    const status = (state, message = "") => this.container.dispatchEvent(
      new CustomEvent("arenastatus", { detail: { state, message } }));
    // Returning to an already drawn preview uses the same live arena materials.
    // There are no new top/launcher variants to prepare in this direction.
    if (this.mode === "map" && this.preparedMapPeriod === this.scenePeriod) {
      this.arenaReady = true;
      status("ready");
      this._scheduleBattleWarmup();
      return;
    }
    this.arenaReady = false;
    status("loading", "正在准备场景画面…");
    // Let navigation finish mounting the launcher's actual loadouts before
    // compiling, and allow the loading indicator to paint.
    const task = new Promise(resolve => requestAnimationFrame(resolve)).then(async () => {
      if (!current()) return;
      if (this.mode === "battle" && this.battlePreparationLease) {
        this._renderFrame(0);
      } else {
        await prepareScene(this.renderer, this.scene, this.camera, {
          target: this.bloom.enabled ? this.composer.readBuffer : null,
          current,
          draw: () => this._renderFrame(0),
        });
      }
      if (!current()) return;
      this.arenaReady = true;
      this.battlePreparationLease?.dispose();
      this.battlePreparationLease = null;
      if (this.mode === "map") this.preparedMapPeriod = this.scenePeriod;
      status("ready");
      this._scheduleBattleWarmup();
    }).catch(error => {
      if (!current()) return;
      this.mountedArenaId = null;
      console.error("Arena preparation failed", error);
      status("error", "场景准备失败，请重新选择场地或刷新。");
    }).finally(() => this.preparations.delete(task));
    this.preparations.add(task);
  }

  setSceneTime(value) {
    this.cancelBattleWarmup();
    this.sceneTime = normalizeSceneTime(value);
    // Re-resolve on scene entry; an automatic clock never changes mid-match.
    if (this.mode !== "map") return;
    this.scenePeriod = resolveSceneTime(this.sceneTime);
    this._applySceneTime();
    if (this.arenaLoaded) this._prepareArena();
  }

  _applySceneTime() {
    const arena = this.activeArena;
    if (!arena) return;
    this._configureLighting(this.mode);
    const day = this.scenePeriod === "day";
    const street = arena.id === "street";
    const ruins = arena.id === "ruins";
    const championship = arena.id === "metal";
    this.container.dataset.scenePeriod = this.scenePeriod;
    if (day || street || ruins) {
      this.outdoorEnvironments[this.scenePeriod] ??=
        createOutdoorEnvironment(this.renderer, this.scenePeriod);
      this.scene.environment = this.outdoorEnvironments[this.scenePeriod].texture;
    }
    const background = day ? (street ? "#bed5d9" : ruins ? "#afc9dc" : "#bdcdd1")
      : street ? "#142635" : ruins ? "#25394d" : arena.scene ? "#0c1c25"
        : this.mode === "map" ? "#c8cecd" : "#252d30";
    this._setSceneColors(background, street ? (day ? .0028 : .0038) : ruins ? .025 : .012);
    if (arena.scene || day) {
      this.keyLight.color.set(day ? 0xffebca : street ? 0xaac6e5 : 0xc9e6ff);
      this.keyLight.position.set(...(street ? (day ? [-45, 95, 55] : [-40, 90, 35]) : [-8, 12, 6]));
      this.keyLight.intensity = day ? 2.5 : street ? .85 : 2.1;
      this.ambientLight.intensity = day ? 1.15 : street ? .38 : .5;
      this.ambientLight.color.set(day ? 0xcce9f5 : 0xeaf7ff);
      this.ambientLight.groundColor.set(day ? 0x9e9579 : 0x403c32);
      this.scene.environmentIntensity = day ? .72 : street ? .6 : .36;
    }
    if (street || day) {
      this.edgeLight.intensity = day ? .25 : .28;
      this.renderer.toneMappingExposure = day ? .95 : 1;
      this.bloom.enabled = true;
      this.bloom.strength = day ? .10 : .18;
      this.bloom.threshold = day ? 1.8 : 1.4;
    }
    if (street) {
      const shadow = this.keyLight.shadow.camera;
      shadow.left = shadow.bottom = -36;
      shadow.right = shadow.top = 36;
      shadow.far = 260;
      shadow.updateProjectionMatrix();
    }
    if (championship) {
      this._setSceneColors(day ? "#9cbbc8" : "#0c1c25", day ? .004 : .017);
      this.keyLight.intensity = day ? 2.35 : 1.45;
      this.ambientLight.intensity = day ? .95 : .48;
      this.edgeLight.intensity = day ? .4 : .9;
      this.scene.environmentIntensity = day ? .7 : .5;
      this.renderer.toneMappingExposure = day ? .98 : 1.02;
      this.bloom.enabled = true;
      this.bloom.strength = day ? .12 : .26;
      this.bloom.threshold = day ? 1.65 : 1.35;
    }
    this.spotlights.forEach(light => { light.visible = !street && !championship && !day; });
    this.streetAtmosphere?.setPeriod(this.scenePeriod);
    this.championshipAtmosphere?.setPeriod(this.scenePeriod);
  }

  _frameBattle() {
    if (!this.activeArena) return;
    const halfFov=Math.atan(Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2))*Math.min(this.camera.aspect,1));
    const distance=(this.activeArena.wallRadius+1.5)/Math.sin(halfFov);
    this._setCamera([0,distance*.62,distance*.78],[0,0,-.7]);
  }

  updateLauncherPreview(params = {}) {
    Object.assign(this.launcherParams, params);
    if (this.mode !== "battle" || !this.playerTop) return;
    const { height, direction, angle } = this.launcherParams;
    const topHeight = this._topHeight(this.playerTop, 0, 4.45, Math.abs(angle));
    const launcherHeight = topHeight + 0.56 + height * 0.22;
    this.launcherRoot.position.set(
      0,
      launcherHeight,
      4.92,
    );
    this.launcherRoot.rotation.set(angle, direction, 0);
    this.playerTop.position.set(0, topHeight, 4.45);
    this.playerTop.rotation.set(angle, direction, 0);
    this._updateLaunchVectorPreview();
  }

  launchBattleVisual() {
    this.launcherRoot.visible = false;
    this.launchVectorRoot.visible = false;
  }

  _launchVectorAnchor() {
    if (!this.playerTop) return new THREE.Vector3();
    return this.playerTop.position
      .clone()
      .add(new THREE.Vector3(0, 0.48, 0));
  }

  _updateLaunchVectorPreview() {
    if (!this.playerTop || !this.launcherRoot.visible) {
      this.launchVectorRoot.visible = false;
      return;
    }
    const anchor = this._launchVectorAnchor();
    const direction = new THREE.Vector3(
      Math.sin(this.launcherParams.direction),
      0,
      -Math.cos(this.launcherParams.direction),
    ).normalize();
    const normalizedPower =
      (this.launcherParams.power - LAUNCH_MIN_POWER) /
      (1 - LAUNCH_MIN_POWER);
    const length = THREE.MathUtils.lerp(
      LAUNCH_MIN_LENGTH,
      LAUNCH_MAX_LENGTH,
      THREE.MathUtils.clamp(normalizedPower, 0, 1),
    );
    this.launchVectorRoot.visible = true;
    this.launchVectorArrow.position.copy(anchor);
    this.launchVectorArrow.setDirection(direction);
    this.launchVectorArrow.setLength(length, 0.42, 0.24);
    this.launchVectorHandle.position
      .copy(anchor)
      .add(direction.multiplyScalar(length));
    this.launchVectorHandleHalo.position.copy(this.launchVectorHandle.position);
    this.launchVectorHandleHalo.lookAt(this.camera.position);
    this.launchVectorHitTarget.position.copy(this.launchVectorHandle.position);
  }

  getPlayerScreenPosition() {
    if (!this.playerTop) return null;
    const projected = this.playerTop.position.clone().project(this.camera);
    const bounds = this.renderer.domElement.getBoundingClientRect();
    return {
      x: ((projected.x + 1) * 0.5) * bounds.width,
      y: ((1 - projected.y) * 0.5) * bounds.height,
      width: bounds.width,
      height: bounds.height,
    };
  }

  update(delta, simulation = null, paused = false) {
    const battleDelta = paused ? 0 : delta;
    if (simulation && this.playerTop && this.enemyTop) {
      updateDriveZoneModel(this.driveZoneModel, simulation);
      if (simulation.phase === "finished") {
        this.finishElapsed += battleDelta;
      }
      if (simulation.phase === "ready") {
        this.updateLauncherPreview(this.launcherParams);
      } else {
        this.launcherRoot.visible = false;
        this._applyTopState(this.playerTop, simulation.player, battleDelta);
        this._applyTopState(this.enemyTop, simulation.enemy, battleDelta);
        if (simulation.phase === "finished") {
          const won = simulation.result.winner === "player";
          const winner = won ? this.playerTop : this.enemyTop;
          const loser = won ? this.enemyTop : this.playerTop;
          const state = won ? simulation.player : simulation.enemy;
          winner.rotation.y = state.spinPhase + this.finishElapsed * (this.reducedMotion ? .4 : 2.6);
          loser.rotation.z += Math.min(this.finishElapsed * 1.8, .85);
        }
        this._updateBattleCamera(simulation);
      }
      this._updateControlArrow(simulation.player, simulation.phase);
      this._updateRiskRing(simulation.player, simulation.phase);
    } else {
      this.controlArrow.visible = false;
      this.controlInfluenceRing.visible = false;
      this.riskRing.visible = false;
    }
    if (this.mode === "assembly" && this.assemblyTop) {
      updateTopPartFocus(this.assemblyTop, delta);
      this._updateAssemblyCarousel(delta);
      this._updatePartSwap(delta);
      this._updateAssemblyIdle(delta);
    }
    this._updateEffects(battleDelta);
    this.visualTime += battleDelta;
    this.streetAtmosphere?.update(battleDelta, this.reducedMotion);
    this.scenePulse *= Math.exp(-battleDelta*3.8);
    this.championshipAtmosphere?.update(battleDelta, this.reducedMotion, this.scenePulse);
    const warning=simulation?.phase==="running" &&
      [simulation.player,simulation.enemy].some(top=>top.spinRiskState==="critical" || top.ringRiskState==="critical");
    this.energyMaterials.forEach(({material,color,strength})=>{
      material.emissive.copy(color);
      if (!this.reducedMotion && (warning || this.scenePulse>.06)) {
        material.emissive.lerp(new THREE.Color(warning ? 0xff4934 : 0xffad45),warning ? .72 : this.scenePulse);
      }
      const periodStrength = this.activeArena?.id === "metal" && this.scenePeriod === "day" ? .28 : 1;
      material.emissiveIntensity=strength*periodStrength*(1+(this.reducedMotion ? 0 : this.scenePulse*.8+Math.sin(this.visualTime*.8)*.08));
    });
    this.battleEffects.update(battleDelta, [this.playerTop, this.enemyTop],
      this.mode === "battle" && simulation?.phase === "running", this.reducedMotion);
    if (!this.reducedMotion && this.mode !== "assembly") {
      const sweep = this.arenaRoot.children[0]?.userData.sweep;
      if (sweep) sweep.rotation.z = this.visualTime * 0.28;
      this.spotlights.forEach((light, index) => {
        light.target.position.x = Math.sin(this.visualTime * 0.24 + index * Math.PI) * 2.8;
        light.target.position.z = Math.cos(this.visualTime * 0.18 + index * Math.PI) * 2;
      });
    }
    const cameraEase = Math.min(delta * 4.5, 1);
    this.camera.position.lerp(this.desiredCameraPosition, cameraEase);
    this.cameraTarget.lerp(this.desiredCameraTarget, cameraEase);
    this.camera.lookAt(this.cameraTarget);
    if (this.mode !== "assembly" && !this.arenaReady) return;
    this._renderFrame(delta);
  }

  _renderFrame(delta) {
    if (this.bloom.enabled) {
      this.composer.render(delta);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  _updateAssemblyCarousel(delta) {
    if (!this.carouselTransition) return;
    const ease = Math.min(delta * 10, 1);
    let settled = true;
    this.assemblyTops.forEach((top) => {
      const targetPosition = top.userData.carouselTargetPosition;
      if (!targetPosition) return;
      top.position.lerp(targetPosition, ease);
      const targetScale = top.userData.carouselTargetScale;
      const nextScale = THREE.MathUtils.lerp(
        top.scale.x,
        targetScale,
        ease,
      );
      top.scale.setScalar(nextScale);
      top.rotation.z = THREE.MathUtils.lerp(
        top.rotation.z,
        top.userData.carouselTargetRotation,
        ease,
      );
      top.rotation.y += delta * (top.userData.carouselOffset === 0 ? 1.4 : 0.5);
      const targetOpacity = top.userData.carouselTargetOpacity;
      top.traverse((child) => {
        if (!child.isMesh) return;
        child.material.transparent = targetOpacity < 0.999;
        child.material.opacity +=
          (targetOpacity - child.material.opacity) * ease;
        child.material.depthWrite =
          targetOpacity >= 0.999 && child.material.opacity >= 0.985;
      });
      if (
        top.position.distanceTo(targetPosition) > 0.01 ||
        Math.abs(top.scale.x - targetScale) > 0.01
      ) {
        settled = false;
      }
    });
    if (settled) this.carouselTransition = false;
  }

  _updateAssemblyIdle(delta) {
    if (
      this.reducedMotion ||
      this.dragging ||
      this.partEditorSlot ||
      this.activeAssemblySlot ||
      this.carouselTransition
    ) {
      return;
    }
    const idleSeconds =
      (performance.now() - this.lastAssemblyInteraction) / 1000;
    if (idleSeconds < 0.8) return;
    this.assemblyTop.rotation.y += delta * 0.18;
    const phase = performance.now() * 0.00035;
    const basePosition = this._assemblyCameraPosition();
    basePosition.x += Math.sin(phase) * 0.12;
    basePosition.y += Math.cos(phase * 0.83) * 0.06;
    this.desiredCameraPosition.copy(basePosition);
    this.desiredCameraTarget.copy(this.assemblyTarget);
  }

  _updatePartSwap(delta) {
    if (!this.partSwap) return;
    const swap = this.partSwap;
    swap.elapsed += delta;
    const progress = THREE.MathUtils.clamp(
      swap.elapsed / swap.duration,
      0,
      1,
    );
    const eased = progress * progress * (3 - 2 * progress);

    if (swap.phase === "out") {
      swap.group.position.y = swap.startY + eased * 0.42;
      swap.group.rotation.z = swap.startRotationZ + eased * 0.12;
      swap.group.scale.copy(swap.startScale).multiplyScalar(1 - eased * 0.22);
      swap.group.traverse((child) => {
        if (!child.isMesh) return;
        child.material.transparent = true;
        child.material.opacity = Math.max(1 - eased, 0);
        child.material.depthWrite = false;
      });
      if (progress < 1) return;

      this.showAssembly(
        swap.loadouts,
        swap.activeLoadoutIndex,
        swap.slot,
        { preserveCamera: true },
      );
      const nextGroup = this.assemblyTop.userData.partGroups[swap.slot];
      const targetScale =
        nextGroup.userData.focusTargetScale?.clone() ??
        nextGroup.scale.clone();
      const targetY =
        nextGroup.userData.focusTargetY ?? nextGroup.position.y;
      nextGroup.position.y = targetY + 0.42;
      nextGroup.scale.copy(targetScale).multiplyScalar(0.78);
      nextGroup.rotation.z = 0.12;
      nextGroup.traverse((child) => {
        if (!child.isMesh) return;
        child.material.transparent = true;
        child.material.opacity = 0;
        child.material.depthWrite = false;
      });
      this.partSwap = {
        phase: "in",
        elapsed: 0,
        duration: 0.16,
        slot: swap.slot,
        group: nextGroup,
        targetY,
        targetScale,
      };
      return;
    }

    swap.group.position.y =
      swap.targetY + (1 - eased) * 0.42;
    swap.group.rotation.z = (1 - eased) * 0.12;
    swap.group.scale
      .copy(swap.targetScale)
      .multiplyScalar(0.78 + eased * 0.22);
    swap.group.traverse((child) => {
      if (!child.isMesh) return;
      child.material.transparent = progress < 1;
      child.material.opacity = eased;
      child.material.depthWrite = progress >= 1;
    });
    if (progress >= 1) {
      setActivePart(this.assemblyTop, swap.slot, true);
      this.partSwap = null;
    }
  }

  _assemblyCameraPosition() {
    const { yaw, pitch, radius } = this.assemblyOrbit;
    const horizontalRadius = Math.cos(pitch) * radius;
    return new THREE.Vector3(
      Math.sin(yaw) * horizontalRadius + this.assemblyTarget.x,
      Math.sin(pitch) * radius + this.assemblyTarget.y,
      Math.cos(yaw) * horizontalRadius + this.assemblyTarget.z,
    );
  }

  _applyTopState(model, state, delta) {
    model.userData.spinRatio=THREE.MathUtils.clamp(state.spin/state.build.maxSpinSpeed,0,1);
    model.position.set(state.position.x,
      this._topHeight(model, state.position.x, state.position.y, state.tilt),
      state.position.y);
    model.rotation.y = state.spinPhase;
    applyTopDamage(model, state.structure);
    const direction = Math.atan2(state.velocity.y, state.velocity.x);
    model.rotation.x = Math.cos(direction) * state.tilt;
    model.rotation.z = -Math.sin(direction) * state.tilt;
    model.scale.setScalar(0.92);
  }

  _updateBattleCamera(simulation) {
    if (simulation.phase === "finished") {
      const winner = simulation[simulation.result.winner].position;
      this.desiredCameraPosition.set(winner.x * .55 + 6.5, 10.5, winner.y * .55 + 9);
      this.desiredCameraTarget.set(winner.x * .55, -.2, winner.y * .55);
      return;
    }
    if (this.activeArena?.scene) {
      this._frameBattle();
      if (!this.reducedMotion) {
        const strength=this.scenePulse*.09;
        this.desiredCameraPosition.x+=Math.sin(this.visualTime*47)*strength;
        this.desiredCameraPosition.y+=Math.cos(this.visualTime*39)*strength;
      }
      return;
    }
    const player = simulation.player.position;
    const enemy = simulation.enemy.position;
    let radialX = player.x;
    let radialZ = player.y;
    let radialLength = Math.hypot(radialX, radialZ);
    if (radialLength < 0.6) {
      radialX = player.x - enemy.x;
      radialZ = player.y - enemy.y;
      radialLength = Math.max(Math.hypot(radialX, radialZ), 0.001);
    }
    radialX /= radialLength;
    radialZ /= radialLength;
    this.desiredCameraPosition.set(
      player.x * 0.7 + enemy.x * 0.3 + radialX * 7.2,
      7.4,
      player.y * 0.7 + enemy.y * 0.3 + radialZ * 7.2,
    );
    this.desiredCameraTarget.set(
      player.x * 0.6 + enemy.x * 0.4,
      0.1,
      player.y * 0.6 + enemy.y * 0.4,
    );
  }

  finishBattleVisual(simulation) {
    const loser = simulation.result.winner === "player" ? simulation.enemy : simulation.player;
    this.spawnImpact(loser.position, 1);
  }

  _updateControlArrow(player, phase) {
    const input = player.controlInput ?? { x: 0, y: 0 };
    const magnitude = Math.hypot(input.x, input.y);
    this.controlArrow.visible = phase === "running" && magnitude > 0.05;
    this.controlInfluenceRing.visible =
      phase === "running" && player.controlInfluence > 0.015;
    if (this.controlInfluenceRing.visible) {
      this.controlInfluenceRing.position.set(
        player.position.x,
        this.playerTop.position.y + 0.18,
        player.position.y,
      );
      this.controlInfluenceRing.scale.setScalar(
        0.86 + player.controlInfluence * 0.42,
      );
      this.controlInfluenceRing.material.opacity =
        0.24 + player.controlInfluence * 0.56;
    }
    if (!this.controlArrow.visible) return;
    this.controlArrow.position.set(
      player.position.x,
      this.playerTop.position.y + 0.9,
      player.position.y,
    );
    this.controlArrow.setDirection(
      new THREE.Vector3(input.x, 0, input.y).normalize(),
    );
    this.controlArrow.setLength(
      0.65 + player.controlInfluence * 1.8,
      0.32,
      0.18,
    );
  }

  _updateRiskRing(player, phase) {
    const tiltRisk = THREE.MathUtils.smoothstep(player.tilt, 0.38, 0.9);
    const risk = Math.max(player.ringOutRisk ?? 0, tiltRisk);
    this.riskRing.visible = phase === "running" && risk > 0.22;
    if (!this.riskRing.visible) return;
    this.riskRing.position.set(player.position.x, this.playerTop.position.y + 0.12, player.position.y);
    this.riskRing.scale.setScalar(0.9 + risk * 0.46);
    this.riskRing.material.opacity = 0.18 + risk * 0.62;
    this.riskRing.material.color.setHex(
      risk > 0.72 ? 0xff3e2f : 0xffb33d,
    );
  }

  spawnImpact(position, intensity) {
    if (this.mode !== "battle" || !this.activeArena) return;
    this.scenePulse=Math.max(this.scenePulse,Math.min(1,intensity));
    if (this.effects.length >= 24) {
      const oldest=this.effects.shift();
      oldest.geometry.dispose(); oldest.material.dispose(); oldest.removeFromParent();
    }
    const color = intensity > 0.58 ? 0xff6d4b : 0x72ead4;
    const impact = new THREE.Mesh(
      new THREE.RingGeometry(0.18, 0.27, 32),
      new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    impact.rotation.x = -Math.PI * 0.5;
    impact.position.set(position.x, this._groundHeight(position.x, position.y) + 0.38, position.y);
    this.battleEffects.impact(impact.position, intensity, this.reducedMotion);
    impact.userData.life = 0;
    this.effectRoot.add(impact);
    this.effects.push(impact);
    this.container.classList.remove("is-heavy-impact");
    if (intensity > 0.58 && !this.reducedMotion) {
      void this.container.offsetWidth;
      this.container.classList.add("is-heavy-impact");
      window.clearTimeout(this.impactClassTimer);
      this.impactClassTimer = window.setTimeout(() => {
        this.container.classList.remove("is-heavy-impact");
      }, 240);
    }
  }

  _updateEffects(delta) {
    for (const effect of [...this.effects]) {
      effect.userData.life += delta;
      const progress = effect.userData.life / 0.38;
      effect.scale.setScalar(this.reducedMotion ? 1 : 1 + progress * 5);
      effect.material.opacity = Math.max(1 - progress, 0);
      if (progress >= 1) {
        effect.geometry.dispose();
        effect.material.dispose();
        effect.removeFromParent();
        this.effects.splice(this.effects.indexOf(effect), 1);
      }
    }
  }

  _setCamera(position, target) {
    this.desiredCameraPosition.set(...position);
    this.desiredCameraTarget.set(...target);
  }

  _setSceneColors(background, fogDensity) {
    this.scene.background = new THREE.Color(background);
    this.scene.fog = new THREE.FogExp2(background, fogDensity);
  }

  _groundHeight(x, z) {
    return this.activeArena
      ? arenaHeightAt(this.activeArena, Math.hypot(x, z), Math.atan2(z, x))
      : 0;
  }

  _topHeight(model, x, z, tilt = 0) {
    const offset = model.userData.contactOffset * model.scale.y;
    model.userData.groundHeight = this._groundHeight(x, z);
    return model.userData.groundHeight + offset * Math.cos(tilt) + 0.012;
  }

  _configureLighting(mode) {
    const showsArena = mode !== "assembly";
    const extent = showsArena ? 10 : 3.5;
    const shadow = this.keyLight.shadow.camera;
    shadow.left = shadow.bottom = -extent;
    shadow.right = shadow.top = extent;
    shadow.far = 35;
    shadow.updateProjectionMatrix();
    this.spotlights.forEach((light) => { light.visible = showsArena; });
    this.keyLight.color.setHex(0xfff3dd);
    this.keyLight.position.set(3,10,5);
    this.keyLight.intensity=2.5;
    this.scene.environment = this.environmentTarget.texture;
    this.ambientLight.color.setHex(0xeaf7ff);
    this.ambientLight.groundColor.setHex(0x403c32);
    this.ambientLight.intensity=.8;
    this.edgeLight.intensity=1.3;
    this.bloom.enabled = mode === "battle";
    this.bloom.strength = .22;
    this.bloom.threshold = 1.35;
    this.scene.environmentIntensity =
      mode === "assembly" ? 0.9 : mode === "map" ? 0.54 : 0.7;
    this.renderer.toneMappingExposure =
      mode === "map" ? 0.84 : mode === "battle" ? 1.12 : 1;
  }

  _alignPedestal() {
    const pedestal = this.arenaRoot.children[0];
    if (!pedestal || !this.assemblyTop || this.mode !== "assembly") return;
    const bottom = this.assemblyTop.position.y
      - this.assemblyTop.userData.contactOffset * this.assemblyTop.scale.y;
    pedestal.position.y = bottom + 0.59;
  }

  _fitArenaCamera() {
    if (!this.activeArena || this.mode !== "map") return;
    const halfFov = Math.atan(Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))
      * Math.min(this.camera.aspect, 1));
    const distance = (this.activeArena.wallRadius + 1.4) / Math.sin(halfFov) * 1.06;
    this._setCamera([0, distance * 0.73, distance * 0.68], [0, -0.25, 0]);
  }

  resize() {
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    this._fitAssemblyModel();
    this._alignPedestal();
    this._fitArenaCamera();
    if (this.mode==="battle") this._frameBattle();
  }

  destroy() {
    this.arenaLoadToken++;
    this.preparationToken++;
    this.cancelBattleWarmup();
    this.battlePreparationLease?.dispose();
    window.clearTimeout(this.impactClassTimer);
    this.resizeObserver.disconnect();
    this._clearModels();
    disposeGroup(this.arenaRoot);
    disposeGroup(this.launcherRoot);
    disposeGroup(this.effectRoot);
    this.battleEffects.dispose();
    this.environmentTarget.dispose();
    Object.values(this.outdoorEnvironments).forEach(target => target.dispose());
    this.composer.passes.forEach((pass) => pass.dispose?.());
    this.composer.dispose();
    this.keyLight.shadow.dispose();
    window.cancelAnimationFrame(this.diyChangeFrame);
    // Three's async compiler polls renderer material properties until complete.
    // Keep that registry alive even if the scene is destroyed during a load.
    Promise.allSettled([...this.preparations]).then(() => this.renderer.dispose());
  }
}
