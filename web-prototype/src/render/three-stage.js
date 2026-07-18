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
    this.effectRoot = new THREE.Group();
    this.scene.add(this.arenaRoot, this.modelRoot, this.effectRoot);
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
    this.playerTop = null;
    this.enemyTop = null;
    this.dragging = false;
    this.lastPointerX = 0;

    this._addLights();
    this._bindPreviewDrag();
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

  _bindPreviewDrag() {
    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointerdown", (event) => {
      if (this.mode !== "assembly") return;
      this.dragging = true;
      this.lastPointerX = event.clientX;
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!this.dragging || !this.assemblyTop) return;
      this.assemblyTop.rotation.y += (event.clientX - this.lastPointerX) * 0.012;
      this.lastPointerX = event.clientX;
    });
    canvas.addEventListener("pointerup", (event) => {
      this.dragging = false;
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    });
  }

  _clearModels() {
    if (this.assemblyTop) disposeTopModel(this.assemblyTop);
    if (this.playerTop) disposeTopModel(this.playerTop);
    if (this.enemyTop) disposeTopModel(this.enemyTop);
    this.assemblyTop = null;
    this.playerTop = null;
    this.enemyTop = null;
    this.modelRoot.clear();
  }

  showAssembly(selection, colors, activeSlot) {
    this.mode = "assembly";
    this._setSceneColors("#f7f3e9", 0.018);
    this._clearModels();
    disposeGroup(this.arenaRoot);
    this.arenaRoot.add(createPedestal());
    this.assemblyTop = createTopModel(selection, colors);
    this.assemblyTop.scale.setScalar(1.68);
    this.assemblyTop.position.y = 0.12;
    setActivePart(this.assemblyTop, activeSlot);
    this.modelRoot.add(this.assemblyTop);
    this.camera.fov = 34;
    this.camera.updateProjectionMatrix();
    this._setCamera([0, 2.0, 5.15], [0, 0.02, 0]);
  }

  setAssemblyActive(activeSlot) {
    if (this.assemblyTop) setActivePart(this.assemblyTop, activeSlot);
  }

  showArena(arena) {
    this.mode = "map";
    this._setSceneColors("#f7f3e9", 0.018);
    this._clearModels();
    disposeGroup(this.arenaRoot);
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
    this.arenaRoot.add(createArenaModel(arena));
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
  }

  update(delta, simulation = null) {
    if (this.mode === "assembly" && this.assemblyTop && !this.dragging) {
      this.assemblyTop.rotation.y += delta * 0.38;
    }
    if (simulation && this.playerTop && this.enemyTop) {
      this._applyTopState(this.playerTop, simulation.player, delta);
      this._applyTopState(this.enemyTop, simulation.enemy, delta);
      this._updateBattleCamera(simulation);
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
  }

  destroy() {
    this.resizeObserver.disconnect();
    this._clearModels();
    disposeGroup(this.arenaRoot);
    disposeGroup(this.effectRoot);
    this.renderer.dispose();
  }
}
