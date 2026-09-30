import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { applyWorldSurface, physicalSurface } from "./world-surface.js";

// Anchors match the authored intact crystal columns and portal in
// tools/build_battle_worlds.py. No blockers or decorative collision geometry.
export class RuinsAtmosphere {
  constructor(scene, model, { period = "night" } = {}) {
    if (!THREE.UniformsLib.LTC_FLOAT_1) RectAreaLightUniformsLib.init();
    this.root = new THREE.Group();
    this.root.name = "Ruins material lighting";
    this.luminaires = [];
    this.disposed = false;
    this.scene = scene;
    const replacements = new Map();
    const seen = this.materials = new Set();
    model.traverse(mesh => {
      if (!mesh.isMesh) return;
      let material = mesh.material;
      if (/^Slate|^Crystal/.test(material.name)) {
        if (!replacements.has(material)) replacements.set(material,
          physicalSurface(material, { clearcoat: .5, clearcoatRoughness: .2 }));
        mesh.material = replacements.get(material);
        material = mesh.material;
      }
      if (seen.has(material)) return;
      seen.add(material);
      material.envMapIntensity = .95;
      if (/^Slate/.test(material.name)) {
        material.metalness = 0;
        applyWorldSurface(material, "slate");
      } else if (/stone/i.test(material.name)) {
        material.metalness = 0;
        applyWorldSurface(material, "stone");
      } else if (/bronze/i.test(material.name)) {
        material.metalness = .88;
        material.envMapIntensity = 1.35;
        applyWorldSurface(material, "bronze");
      } else if (/^Crystal/.test(material.name)) {
        this.crystal = material;
        material.clearcoat = .85;
        material.envMapIntensity = 1.25;
        applyWorldSurface(material, "crystal");
      } else if (/^Energy/.test(material.name)) {
        this.rune = material;
      } else if (/Graphite/.test(material.name)) {
        applyWorldSurface(material, "metal");
      } else if (/oak/.test(material.name)) {
        applyWorldSurface(material, "wood");
      }
    });
    replacements.forEach((replacement, original) => original.dispose());
    const add = (light, position, base, source, target) => {
      light.position.set(...position);
      if (target) light.lookAt(...target);
      light.name = `Ruins ${source} reflection light`;
      this.root.add(light);
      this.luminaires.push({ light, base, source });
    };
    for (const x of [-6.7, 6.7]) {
      for (const [z, y] of [[-6.7, 3.65], [6.7, 2.35]]) {
        add(new THREE.PointLight(0xae70ff, 1, 6, 2), [x, y, z], 16, "crystal");
      }
    }
    add(new THREE.RectAreaLight(0x9a63ef, 1, 1.12, 2.8),
      [0, 2.1, -9.14], 4.5, "crystal", [0, .2, -3]);
    add(new THREE.PointLight(0x6adce8, 1, 3.5, 2), [0, .55, 0], 2.6, "rune");
    // One broad sky opening shapes the wet slate and bronze highlights.
    add(new THREE.RectAreaLight(0xbed6f1, 1, 9, 4),
      [-4, 7, -6], 1.25, "sky", [0, -.3, 1]);
    scene.add(this.root);
    this.setPeriod(period);
  }

  setPeriod(period) {
    this.period = period === "day" ? "day" : "night";
    // Three uses scene.environmentIntensity when material.envMap is null.
    // Explicit binding enables each finish's authored reflection intensity.
    this.materials.forEach(material => {
      material.envMap = this.scene.environment;
      material.needsUpdate = true;
    });
    this.update();
  }

  update() {
    if (this.disposed) return;
    const day = this.period === "day";
    this.luminaires.forEach(({ light, base, source }) => {
      // Follow the existing pausable battle-energy material, including its
      // impact/warning tint; this adds no independent animation clock.
      const material = this[source];
      if (material) light.color.copy(material.emissive);
      light.intensity = base * (day ? source === "sky" ? 1.8 : .22 : 1);
    });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.luminaires.forEach(({ light }) => light.dispose());
    this.root.clear();
    this.luminaires = [];
    // Model materials belong to ThreeStage; no extra reflection render target.
    this.materials.clear();
    this.scene = null;
    this.crystal = this.rune = null;
  }
}
