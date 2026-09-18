import * as THREE from "three";

const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));

function copyMaterial(material) {
  const copy = material.isShaderMaterial
    ? new material.constructor().copy({ ...material, uniforms: {} }) : material.clone();
  // Preparation never changes uniforms; keep existing textures, especially
  // Reflector's target, instead of cloning textures it does not own.
  if (material.isShaderMaterial) copy.uniforms = material.uniforms;
  // PhysicalMaterial.copy() supplies its own defines. Some imported finishes
  // deliberately retain Standard's defines; compiling a different set doubles
  // the work on their first real draw.
  if (material.defines) copy.defines = { ...material.defines };
  copy.onBeforeCompile = material.onBeforeCompile;
  copy.customProgramCacheKey = material.customProgramCacheKey;
  return copy;
}

function proxyFor(object, material) {
  // Preserve instancing and geometry attributes. Never invoke Reflector.clone:
  // its constructor allocates another target and its render hook draws a scene.
  const proxy = object.isInstancedMesh ? new THREE.InstancedMesh(object.geometry, material, 0)
    : object.isMesh ? new THREE.Mesh(object.geometry, material)
      : object.isPoints ? new THREE.Points(object.geometry, material)
        : object.isSprite ? new THREE.Sprite(material) : new THREE.Line(object.geometry, material);
  if (object.isInstancedMesh) {
    proxy.count = object.count;
    proxy.instanceMatrix = object.instanceMatrix;
    proxy.instanceColor = object.instanceColor;
  }
  proxy.receiveShadow = object.receiveShadow;
  proxy.matrixAutoUpdate = false;
  proxy.matrix.copy(object.matrixWorld);
  proxy.frustumCulled = false;
  return proxy;
}

// Public renderer APIs only. A zero-area scissor allows resource acquisition
// without changing the visible frame, including direct-to-canvas variants.
function withPreparationTarget(renderer, target, run) {
  const saved = {
    target: renderer.getRenderTarget(), face: renderer.getActiveCubeFace(),
    mip: renderer.getActiveMipmapLevel(), scissor: renderer.getScissor(new THREE.Vector4()),
    scissorTest: renderer.getScissorTest(), autoClear: renderer.autoClear,
    shadowAuto: renderer.shadowMap.autoUpdate, shadowNeeds: renderer.shadowMap.needsUpdate,
  };
  try {
    renderer.setRenderTarget(target);
    renderer.setScissor(0, 0, 0, 0);
    renderer.setScissorTest(true);
    renderer.autoClear = false;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = false;
    return run();
  } finally {
    renderer.autoClear = saved.autoClear;
    renderer.shadowMap.autoUpdate = saved.shadowAuto;
    renderer.shadowMap.needsUpdate = saved.shadowNeeds;
    renderer.setRenderTarget(saved.target, saved.face, saved.mip);
    renderer.setScissor(saved.scissor);
    renderer.setScissorTest(saved.scissorTest);
  }
}

// Cloned materials retain programs across cancellation. Geometry and textures
// belong to the caller; a retained lease is released after the first real draw
// or when a speculative battle is discarded.
export async function prepareScene(renderer, scene, camera, {
  target = null, current, draw = () => {}, objects = scene, retain = false,
} = {}) {
  const materials = new Set();
  const copies = new Map();
  const pending = [];
  const groups = new Map();
  const staging = new THREE.Scene();
  staging.environment = scene.environment;
  staging.environmentIntensity = scene.environmentIntensity;
  staging.fog = scene.fog;
  scene.traverseVisible(object => {
    if (!object.isLight || !object.layers.test(camera.layers)) return;
    const light = object.clone();
    if (object.shadow) light.shadow = object.shadow;
    staging.add(light);
  });
  const collect = object => {
    if (!object.material || !(object.isMesh || object.isLine || object.isPoints || object.isSprite)) return;
    const sources = Array.isArray(object.material) ? object.material : [object.material];
    sources.forEach(source => {
      if (!source.visible) return;
      const sides = source.transparent && source.side === THREE.DoubleSide && !source.forceSinglePass
        ? [THREE.BackSide, THREE.FrontSide] : [source.side];
      for (const side of sides) {
        if (!copies.has(source)) copies.set(source, new Map());
        if (!copies.get(source).has(side)) {
          const material = copyMaterial(source);
          material.side = side;
          materials.add(material);
          copies.get(source).set(side, material);
        }
        const material = copies.get(source).get(side);
        const planes = renderer.localClippingEnabled ? material.clippingPlanes ?? [] : [];
        const key = `${planes.length}:${material.clipIntersection}`;
        if (!groups.has(key)) groups.set(key, { planes, intersection: material.clipIntersection, proxies: [] });
        groups.get(key).proxies.push(proxyFor(object, material));
      }
    });
  };
  for (const root of Array.isArray(objects) ? objects : [objects]) {
    root.updateWorldMatrix(true, true);
    root.traverseVisible(collect);
  }
  // compileAsync does not initialize local clipping in Three r178. Prime that
  // state per plane-count group with a no-pixel draw before compiling.
  const primerGeometry = new THREE.BufferGeometry();
  primerGeometry.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0], 3));
  primerGeometry.setDrawRange(0, 0);
  const primerMaterial = new THREE.RawShaderMaterial({
    vertexShader: "void main() { gl_Position = vec4(0.0); }",
    fragmentShader: "precision mediump float; void main() { gl_FragColor = vec4(0.0); }",
  });
  const primer = new THREE.Mesh(primerGeometry, primerMaterial);
  primer.frustumCulled = false;
  const primerScene = new THREE.Scene();
  primerScene.add(primer);
  let handedOff = false;
  const release = () => materials.forEach(material => material.dispose());
  try {
    for (const { planes, intersection, proxies } of groups.values()) {
      let start = performance.now();
      for (let offset = 0; offset < proxies.length; offset += 12) {
        if (!current()) return;
        const batch = new THREE.Group();
        batch.add(...proxies.slice(offset, offset + 12));
        withPreparationTarget(renderer, target, () => {
          primerMaterial.clippingPlanes = planes;
          primerMaterial.clipIntersection = intersection;
          renderer.render(primerScene, camera);
          pending.push(renderer.compileAsync(batch, camera, scene));
        });
        if (performance.now() - start >= 4 && offset + 12 < proxies.length) {
          await nextFrame();
          start = performance.now();
        }
      }
    }
    await Promise.all(pending);
    // Upload and acquire programs in short batches while the loading UI stays
    // responsive. No gl.finish or synchronous GPU fence in the product path.
    for (const { proxies } of groups.values()) {
      let start = performance.now();
      for (let offset = 0; offset < proxies.length; offset += 12) {
        if (!current()) return;
        const batch = proxies.slice(offset, offset + 12);
        staging.add(...batch);
        withPreparationTarget(renderer, target, () => renderer.render(staging, camera));
        staging.remove(...batch);
        if (performance.now() - start >= 4) {
          await nextFrame();
          start = performance.now();
        }
      }
    }
    if (!current()) return;
    draw();
    handedOff = retain;
    if (retain) return { dispose: release };
  } finally {
    // Even canceled compilation must finish polling before its clones dispose.
    await Promise.allSettled(pending);
    primerGeometry.dispose();
    primerMaterial.dispose();
    if (!handedOff) release();
  }
}
