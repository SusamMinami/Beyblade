import * as THREE from "three";
import {
  createTopModel,
  disposeTopModel,
  setActivePart,
  updateTopPartFocus,
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
    this.launchVectorRoot.add(
      this.launchVectorArrow,
      this.launchVectorHandle,
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
      this.launchVectorHandle,
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
          0.35 + ((distance - 1.2) / 3.2) * 0.65,
          0.35,
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
      Math.min(1.14 / projectedHeight, 1.88 / projectedWidth),
      0.92,
      1.52,
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

  _clearModels() {
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

  switchAssemblyLoadout(activeLoadoutIndex, activeSlot = null) {
    if (this.assemblyTops.length === 0) return;
    this.activeAssemblySlot = activeSlot;
    this.assemblyTops.forEach((top) => {
      let offset = top.userData.loadoutIndex - activeLoadoutIndex;
      if (offset > 1) offset -= this.assemblyTops.length;
      if (offset < -1) offset += this.assemblyTops.length;
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

  enterPartEditor(slot, centerOfMass, customization = null) {
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
    this.setAssemblyOrthographicView("front", true);
    this._positionDiyHandles();
  }

  exitPartEditor() {
    this.partEditorSlot = null;
    this.diyCustomization = null;
    this.diyHandleRoot.visible = false;
    this.assemblyView = "orbit";
    this.assemblyTops.forEach((top) => {
      top.visible = true;
    });
    this._removeCenterOfMassMarker();
    this.resetAssemblyView(true);
  }

  setAssemblyOrthographicView(view, immediate = false) {
    if (!this.partEditorSlot || !this.assemblyTop) return;
    this.assemblyView = view;
    const target = this.assemblyTarget;
    const positions = {
      front: new THREE.Vector3(0, 0.35, 5.7),
      top: new THREE.Vector3(0, 5.9, 0.01),
      side: new THREE.Vector3(5.7, 0.35, 0),
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
    this.mode = "map";
    this.launchVectorRoot.visible = false;
    this.partEditorSlot = null;
    this._setSceneColors("#f7f3e9", 0.018);
    this._clearModels();
    disposeGroup(this.arenaRoot);
    disposeGroup(this.launcherRoot);
    this.launcherRoot.visible = false;
    this.arenaRoot.add(createArenaModel(arena));
    this._setCamera([0, 9.8, 10.1], [0, -0.2, 0]);
  }

  prepareBattle(
    arena,
    playerSelection,
    enemySelection,
    playerColors,
    playerCustomizations = {},
  ) {
    this.mode = "battle";
    this.partEditorSlot = null;
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
    this.launchVectorRoot.visible = true;
    this.playerTop = createTopModel(
      playerSelection,
      playerColors,
      playerCustomizations,
    );
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
    const length = 1.2 + this.launcherParams.power * 3.2;
    this.launchVectorRoot.visible = true;
    this.launchVectorArrow.position.copy(anchor);
    this.launchVectorArrow.setDirection(direction);
    this.launchVectorArrow.setLength(length, 0.42, 0.24);
    this.launchVectorHandle.position
      .copy(anchor)
      .add(direction.multiplyScalar(length));
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
    this._updateEffects(delta);
    const cameraEase = Math.min(delta * 4.5, 1);
    this.camera.position.lerp(this.desiredCameraPosition, cameraEase);
    this.cameraTarget.lerp(this.desiredCameraTarget, cameraEase);
    this.camera.lookAt(this.cameraTarget);
    this.renderer.render(this.scene, this.camera);
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
    this.controlInfluenceRing.visible =
      phase === "running" && player.controlInfluence > 0.015;
    if (this.controlInfluenceRing.visible) {
      this.controlInfluenceRing.position.set(
        player.position.x,
        0.56,
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

  _updateRiskRing(player, phase) {
    const tiltRisk = THREE.MathUtils.smoothstep(player.tilt, 0.38, 0.9);
    const risk = Math.max(player.ringOutRisk ?? 0, tiltRisk);
    this.riskRing.visible = phase === "running" && risk > 0.22;
    if (!this.riskRing.visible) return;
    this.riskRing.position.set(player.position.x, 0.5, player.position.y);
    this.riskRing.scale.setScalar(0.9 + risk * 0.46);
    this.riskRing.material.opacity = 0.18 + risk * 0.62;
    this.riskRing.material.color.setHex(
      risk > 0.72 ? 0xff3e2f : 0xffb33d,
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
    this.container.classList.remove("is-heavy-impact");
    if (intensity > 0.58) {
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
    window.clearTimeout(this.impactClassTimer);
    this.resizeObserver.disconnect();
    this._clearModels();
    disposeGroup(this.arenaRoot);
    disposeGroup(this.launcherRoot);
    disposeGroup(this.effectRoot);
    this.renderer.dispose();
  }
}
