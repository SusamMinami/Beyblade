import * as THREE from "three";

// Compile visible material variants in parallel without keeping live scene
// objects hostage. A user may change maps or replace a top while this runs.
// Temporary materials retain the programs until the real first draw acquires
// them; they never own geometry, textures or any game state.
export async function prepareScene(renderer, scene, camera, { target = null, current, draw }) {
  const materials = new Map();
  const proxies = new THREE.Group();
  scene.traverseVisible(object => {
    if (!object.material || !(object.isMesh || object.isLine || object.isPoints || object.isSprite)) return;
    const copyMaterial = material => {
      if (!materials.has(material)) {
        const copy = material.clone();
        copy.onBeforeCompile = material.onBeforeCompile;
        copy.customProgramCacheKey = material.customProgramCacheKey;
        materials.set(material, copy);
      }
      return materials.get(material);
    };
    const material = Array.isArray(object.material)
      ? object.material.map(copyMaterial) : copyMaterial(object.material);
    // Do not clone a Reflector: its constructor allocates another render target.
    const proxy = object.isMesh ? new THREE.Mesh(object.geometry, material)
      : object.isPoints ? new THREE.Points(object.geometry, material)
        : object.isSprite ? new THREE.Sprite(material) : new THREE.Line(object.geometry, material);
    proxy.receiveShadow = object.receiveShadow;
    proxies.add(proxy);
  });
  try {
    const previousTarget = renderer.getRenderTarget();
    let ready;
    try {
      renderer.setRenderTarget(target);
      ready = renderer.compileAsync(proxies, camera, scene);
    } finally {
      renderer.setRenderTarget(previousTarget);
    }
    await ready;
    if (current()) draw();
  } finally {
    materials.forEach(material => material.dispose());
  }
}
