import * as THREE from "three";
import {
  createTopModel,
  disposeTopModel,
  setActivePart,
} from "./top-model.js";

function disposeGroup(group) {
  group.traverse((child) => {
    if (!child.isMesh) return;
    child.geometry?.dispose();
    if (Array.isArray(child.material)) {
      child.material.forEach((item) => item.dispose());
    } else {
      child.material?.dispose();
    }
  });
  group.clear();
}

function createBowlGeometry(arena) {
  const segments = 96;
  const rings = 24;
  const positions = [];
  const colors = [];
  const indices = [];
  const colorForRadius = (radius) => {
    if (arena.id === "metal") return new THREE.Color("#43535c");
    if (arena.id === "composite") {
      if (radius < 3.1) return new THREE.Color("#465861");
      if (radius < 5.9) return new THREE.Color("#263b37");
      return new THREE.Color("#4d302c");
    }
    return new THREE.Color("#30383a");
  };

  for (let ring = 0; ring <= rings; ring += 1) {
    const radius = (arena.wallRadius * ring) / rings;
    const normalized = radius / arena.wallRadius;
    const height = -0.5 + normalized ** 2 * 0.82;
    for (let segment = 0; segment <= segments; segment += 1) {
      const angle = (Math.PI * 2 * segment) / segments;
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
      indices.push(a, b, a + 1, b, b + 1, a + 1);
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

function createArenaModel(arena) {
  const group = new THREE.Group();
  const bowlMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    metalness: arena.id === "metal" ? 0.88 : 0.42,
    roughness: arena.id === "metal" ? 0.2 : 0.52,
    side: THREE.DoubleSide,
  });
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
    new THREE.TorusGeometry(arena.wallRadius + 0.12, 0.18, 12, 96),
    rimMaterial,
  );
  rim.rotation.x = Math.PI * 0.5;
  rim.position.y = 0.36;
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
    line.position.y = -0.48 + (radius / arena.wallRadius) ** 2 * 0.82 + 0.02;
    group.add(line);
  }

  const center = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 0.018, 32),
    rimMaterial,
  );
  center.position.y = -0.48;
  group.add(center);
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
    new THREE.BoxGeometry(1.6, 0.34, 0.9),
    bodyMaterial,
  );
  body.castShadow = true;
  group.add(body);
  const rail = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.18, 2.2),
    accentMaterial,
  );
  rail.position.set(0, 0.08, -0.92);
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
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
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
    this.effects = [];
    this.mode = "assembly";
    this.assemblyTop = null;
    this.assemblyTops = [];
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
    this.launcherParams = { height: 0.45, direction: 0, angle: 0 };

    this._addLights();
    this._bindPreviewControls();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  _addLights() {
    const hemisphere = new THREE.HemisphereLight(0xbde8e2, 0x101415, 1.45);
    this.scene.add(hemisphere);
    const key = new THREE.DirectionalLight(0xffffff, 3.4);
    key.position.set(5, 10, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -10;
    key.shadow.camera.right = 10;
    key.shadow.camera.top = 10;
    key.shadow.camera.bottom = -10;
    this.scene.add(key);
    const edge = new THREE.PointLight(0x45dfc0, 20, 18, 2);
    edge.position.set(-5, 2.5, -3);
    this.scene.add(edge);
  }

  _bindPreviewControls() {
    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointerdown", (event) => {
      if (this.mode !== "assembly") return;
      event.preventDefault();
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
      const hit = this._pickAssemblyPart(event.clientX, event.clientY);
      this.dragStartedOnModel = Boolean(hit);
      this.dragMode = "camera";
      if (hit) this.draggedSlot = hit.slot;
      canvas.setPointerCapture(event.pointerId);
      if (this.activePointers.size === 2) {
        this.dragMode = "pinch";
        this.pinchDistance = this._activePointerDistance();
      }
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!this.dragging || !this.assemblyTop || this.mode !== "assembly") {
        return;
      }
      const previous = this.activePointers.get(event.pointerId);
      if (!previous) return;
      this.activePointers.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
      if (this.activePointers.size >= 2) {
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
      const wasTap =
        this.dragMode === "camera" &&
        this.dragDistance < 8 &&
        this.activePointers.size === 1;
      const horizontalSwipe =
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
        if (this.mode !== "assembly") return;
        event.preventDefault();
        this._zoomAssembly(Math.exp(event.deltaY * 0.0012));
      },
      { passive: false },
    );
  }

  _pickAssemblyPart(clientX, clientY) {
    if (!this.assemblyTop) return null;
    const bounds = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((clientX - bounds.left) / bounds.width) * 2 - 1,
      -((clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObject(this.assemblyTop, true)[0];
    let current = hit?.object ?? null;
    while (current && current.parent !== this.assemblyTop) {
      current = current.parent;
    }
    return current?.name ? { slot: current.name } : null;
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
      Math.min(1.14 / projectedHeight, 1.88 / projectedWidth),
      0.92,
      1.52,
    );
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

  _clearModels() {
    for (const top of this.assemblyTops) disposeTopModel(top);
    if (this.playerTop) disposeTopModel(this.playerTop);
    if (this.enemyTop) disposeTopModel(this.enemyTop);
    this.assemblyTop = null;
    this.assemblyTops = [];
    this.playerTop = null;
    this.enemyTop = null;
    this.modelRoot.clear();
  }

  showAssembly(loadouts, activeLoadoutIndex, activeSlot) {
    this.mode = "assembly";
    this._setSceneColors("#f7f3e9", 0.018);
    this._clearModels();
    disposeGroup(this.arenaRoot);
    disposeGroup(this.launcherRoot);
    this.launcherRoot.visible = false;
    this.arenaRoot.add(createPedestal());
    loadouts.forEach((loadout, index) => {
      const top = createTopModel(loadout.build, loadout.colors);
      let offset = index - activeLoadoutIndex;
      if (offset > 1) offset -= loadouts.length;
      if (offset < -1) offset += loadouts.length;
      top.userData.carouselOffset = offset;
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
  }

  setAssemblyActive(activeSlot) {
    if (this.assemblyTop) setActivePart(this.assemblyTop, activeSlot);
  }

  showArena(arena) {
    this.mode = "map";
    this._setSceneColors("#f7f3e9", 0.018);
    this._clearModels();
    disposeGroup(this.arenaRoot);
    disposeGroup(this.launcherRoot);
    this.launcherRoot.visible = false;
    this.arenaRoot.add(createArenaModel(arena));
    this._setCamera([0, 9.8, 10.1], [0, -0.2, 0]);
  }

  prepareBattle(arena, playerSelection, enemySelection, playerColors) {
    this.mode = "battle";
    const battleBackgrounds = {
      standard: "#12396b",
      metal: "#071b26",
      composite: "#40211d",
    };
    this._setSceneColors(battleBackgrounds[arena.id] ?? "#11181b", 0.028);
    this._clearModels();
    disposeGroup(this.arenaRoot);
    disposeGroup(this.launcherRoot);
    this.arenaRoot.add(createArenaModel(arena));
    this.launcherRoot.add(createLauncherModel());
    this.launcherRoot.visible = true;
    this.playerTop = createTopModel(playerSelection, playerColors);
    this.enemyTop = createTopModel(enemySelection, {
      ring: "#ec5b45",
      core: "#dfe9e7",
    });
    this.playerTop.position.set(0, 0.08, 4.45);
    this.enemyTop.position.set(0, 0.08, -4.45);
    this.playerTop.scale.setScalar(0.92);
    this.enemyTop.scale.setScalar(0.92);
    this.modelRoot.add(this.playerTop, this.enemyTop);
    this.camera.fov = 42;
    this.camera.updateProjectionMatrix();
    this._setCamera([0, 5.4, 8.4], [0, -0.1, 2.1]);
    this.updateLauncherPreview(this.launcherParams);
  }

  updateLauncherPreview(params = {}) {
    Object.assign(this.launcherParams, params);
    if (this.mode !== "battle" || !this.playerTop) return;
    const { height, direction, angle } = this.launcherParams;
    const launchHeight = 0.72 + height * 1.45;
    this.launcherRoot.position.set(
      Math.sin(direction) * 0.85,
      launchHeight,
      3.85,
    );
    this.launcherRoot.rotation.set(angle, direction, 0);
    this.playerTop.position.set(
      this.launcherRoot.position.x - Math.sin(direction) * 0.45,
      launchHeight - 0.42,
      3.35,
    );
    this.playerTop.rotation.set(angle, direction, 0);
  }

  launchBattleVisual() {
    this.launcherRoot.visible = false;
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

  update(delta, simulation = null) {
    if (simulation && this.playerTop && this.enemyTop) {
      if (simulation.phase === "ready") {
        this.updateLauncherPreview(this.launcherParams);
      } else {
        this.launcherRoot.visible = false;
        this._applyTopState(this.playerTop, simulation.player, delta);
        this._applyTopState(this.enemyTop, simulation.enemy, delta);
        this._updateBattleCamera(simulation);
      }
      this._updateControlArrow(simulation.player, simulation.phase);
    } else {
      this.controlArrow.visible = false;
    }
    this._updateEffects(delta);
    const cameraEase = Math.min(delta * 4.5, 1);
    this.camera.position.lerp(this.desiredCameraPosition, cameraEase);
    this.cameraTarget.lerp(this.desiredCameraTarget, cameraEase);
    this.camera.lookAt(this.cameraTarget);
    this.renderer.render(this.scene, this.camera);
  }

  _applyTopState(model, state, delta) {
    model.position.set(state.position.x, 0.08, state.position.y);
    model.rotation.y += state.spin * delta * 0.32;
    const direction = Math.atan2(state.velocity.y, state.velocity.x);
    model.rotation.x = Math.cos(direction) * state.tilt;
    model.rotation.z = -Math.sin(direction) * state.tilt;
    model.scale.setScalar(0.92);
  }

  _updateBattleCamera(simulation) {
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
      player.x + radialX * 4.35,
      4.15,
      player.y + radialZ * 4.35,
    );
    this.desiredCameraTarget.set(
      player.x * 0.72 + enemy.x * 0.28,
      0.05,
      player.y * 0.72 + enemy.y * 0.28,
    );
  }

  _updateControlArrow(player, phase) {
    const input = player.controlInput ?? { x: 0, y: 0 };
    const magnitude = Math.hypot(input.x, input.y);
    this.controlArrow.visible = phase === "running" && magnitude > 0.05;
    if (!this.controlArrow.visible) return;
    this.controlArrow.position.set(
      player.position.x,
      1.15,
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

  spawnImpact(position, intensity) {
    const color = intensity > 0.58 ? 0xff6d4b : 0x72ead4;
    const impact = new THREE.Mesh(
      new THREE.RingGeometry(0.18, 0.27, 32),
      new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
      }),
    );
    impact.rotation.x = -Math.PI * 0.5;
    impact.position.set(position.x, 0.55, position.y);
    impact.userData.life = 0;
    this.effectRoot.add(impact);
    this.effects.push(impact);
  }

  _updateEffects(delta) {
    for (const effect of [...this.effects]) {
      effect.userData.life += delta;
      const progress = effect.userData.life / 0.38;
      effect.scale.setScalar(1 + progress * 5);
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

  resize() {
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this._fitAssemblyModel();
  }

  destroy() {
    this.resizeObserver.disconnect();
    this._clearModels();
    disposeGroup(this.arenaRoot);
    disposeGroup(this.launcherRoot);
    disposeGroup(this.effectRoot);
    this.renderer.dispose();
  }
}
