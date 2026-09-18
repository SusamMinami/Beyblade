import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { normalizePartCustomization } from "../core/part-customization.js";
import { applySurfaceFinish, cloneSurfaceMaterial } from "./surface-finish.js";

const SLOT_Y = Object.freeze({
  attackRing: 0.24,
  coreLock: 0.42,
  weightDisc: 0.02,
  driverShaft: -0.22,
  tip: -0.56,
});

const METAL = 0xb7c0c2;
const DARK_METAL = 0x192126;
const RUBBER = 0x090d0f;

function material(color, metalness, roughness, extras = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness,
    roughness,
    clearcoat: extras.clearcoat ?? 0,
    clearcoatRoughness: 0.18,
    emissive: extras.emissive ?? 0x000000,
    emissiveIntensity: extras.emissiveIntensity ?? 0,
  });
}

function createMaterials(colors, materialType = "stock") {
  const ringColor = new THREE.Color(colors.ring);
  const ringAccent = ringColor.clone().offsetHSL(0, 0.05, 0.18);
  const woodFinish = colors.finish === "wood";
  let materials;
  if (woodFinish) {
    materials = {
      polymer: material(ringColor, 0.02, 0.72),
      polymerAccent: material(ringAccent, 0.03, 0.64),
      core: material(colors.core, 0.02, 0.68),
      metal: material(0x8c633f, 0.02, 0.76),
      darkMetal: material(0x4d3524, 0.04, 0.72),
      rubber: material(0x33251b, 0.01, 0.88),
      shadow: material(0x6b4a31, 0.02, 0.82),
    };
  } else {
    materials = {
      polymer: material(ringColor, 0.14, 0.2, { clearcoat: 0.78 }),
      polymerAccent: material(ringAccent, 0.2, 0.16, { clearcoat: 0.88 }),
      core: material(colors.core, 0.42, 0.2, { clearcoat: 0.7 }),
      metal: material(colors.metal ?? METAL, 0.96, 0.16),
      darkMetal: material(DARK_METAL, 0.9, 0.25),
      rubber: material(RUBBER, 0.05, 0.82),
      shadow: material(0x263138, 0.48, 0.46),
    };
  }

  for (const [name, item] of Object.entries(materials)) {
    if (materialType === "polymer") {
      item.metalness *= 0.35;
      item.roughness = Math.max(item.roughness, 0.48);
      item.clearcoat = Math.max(item.clearcoat, 0.45);
    } else if (materialType === "alloy") {
      item.metalness = Math.max(item.metalness, 0.78);
      item.roughness = Math.min(item.roughness, 0.24);
      item.color.lerp(new THREE.Color(0xb9c4c8), 0.2);
    } else if (materialType === "carbon") {
      item.metalness = Math.min(item.metalness, 0.35);
      item.roughness = Math.max(item.roughness, 0.52);
      item.color.multiplyScalar(0.48);
    } else if (materialType === "rubber") {
      item.metalness = Math.min(item.metalness, 0.08);
      item.roughness = Math.max(item.roughness, 0.78);
      item.color.multiplyScalar(0.72);
    }
    const finish = woodFinish ? "wood"
      : materialType === "carbon" ? "carbon"
        : materialType === "rubber" || name === "rubber" ? "rubber"
          : item.metalness > 0.65 ? "machined" : "polymer";
    applySurfaceFinish(item, finish);
    item.needsUpdate = true;
  }
  return materials;
}

function outerRadius(angle, slot, id, customization) {
  let radius;
  if (slot === "attackRing") {
    if (id === "attack_ring.smash_three") {
      const pulse = Math.max(0, Math.cos(angle * 3 - 0.28)) ** 4;
      radius = 0.91 + pulse * 0.3;
    } else if (id === "attack_ring.stamina_arc") {
      radius = 1.01 + Math.cos(angle * 8) * 0.022;
    } else {
      const pulse = (0.5 + 0.5 * Math.cos(angle * 6)) ** 2;
      radius = 0.94 + pulse * 0.12;
    }
  } else if (id === "weight_disc.heavy_outer") {
    radius = 0.82 + Math.cos(angle * 8) * 0.018;
  } else if (id === "weight_disc.eccentric") {
    radius = 0.74 + Math.cos(angle) * 0.075 + Math.cos(angle * 5) * 0.018;
  } else {
    radius = 0.74 + Math.cos(angle * 6) * 0.012;
  }

  const shapeStrength = customization.shape / 100;
  if (shapeStrength <= 0) return radius;
  const customPulse =
    Math.max(0, Math.cos(angle * customization.symmetry)) **
    (2.4 + shapeStrength * 2.6);
  return radius + customPulse * 0.18 * shapeStrength;
}

function radialRingGeometry(
  innerRadius,
  height,
  segments,
  slot,
  id,
  customization,
) {
  const positions = [];
  const uvs = [];
  const indices = [];
  const halfHeight = height * 0.5;
  const bevel = Math.min(height * 0.22, 0.045);
  // Closed radial section: inner wall, top chamfers, outer wall, bottom.
  const profile = [
    [0, bevel, -halfHeight],
    [0, 0, -halfHeight + bevel],
    [0, 0, halfHeight - bevel],
    [0, bevel, halfHeight],
    [1, -bevel, halfHeight],
    [1, 0, halfHeight - bevel],
    [1, 0, -halfHeight + bevel],
    [1, -bevel, -halfHeight],
    [0, bevel, -halfHeight],
  ];
  const row = segments + 1;
  for (let layer = 0; layer < profile.length; layer += 1) {
    const [outer, inset, y] = profile[layer];
    for (let index = 0; index <= segments; index += 1) {
      const angle = (Math.PI * 2 * (index % segments)) / segments;
      const radius = (outer ? outerRadius(angle, slot, id, customization) : innerRadius) + inset;
      positions.push(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      uvs.push(index / segments, layer / (profile.length - 1));
      if (layer < profile.length - 1 && index < segments) {
        const a = layer * row + index;
        const b = a + row;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const normals = geometry.getAttribute("normal");
  for (let layer = 0; layer < profile.length; layer += 1) {
    const a = layer * row;
    const b = a + segments;
    const normal = new THREE.Vector3().fromBufferAttribute(normals, a)
      .add(new THREE.Vector3().fromBufferAttribute(normals, b)).normalize();
    normals.setXYZ(a, normal.x, normal.y, normal.z);
    normals.setXYZ(b, normal.x, normal.y, normal.z);
  }
  geometry.computeBoundingSphere();
  return geometry;
}

function mesh(geometry, meshMaterial) {
  const instance = new THREE.Mesh(geometry, meshMaterial);
  instance.castShadow = true;
  instance.receiveShadow = true;
  return instance;
}

function cylinder(topRadius, bottomRadius, height, segments = 64) {
  const bevel = Math.min(height * 0.15, topRadius * 0.12, bottomRadius * 0.12, 0.025);
  return new THREE.LatheGeometry([
    new THREE.Vector2(0, -height / 2),
    new THREE.Vector2(bottomRadius - bevel, -height / 2),
    new THREE.Vector2(bottomRadius, -height / 2 + bevel),
    new THREE.Vector2(topRadius, height / 2 - bevel),
    new THREE.Vector2(topRadius - bevel, height / 2),
    new THREE.Vector2(0, height / 2),
  ], segments);
}

function addTrim(parent, radius, y, thickness, trimMaterial) {
  const trim = mesh(new THREE.TorusGeometry(radius, thickness, 10, 96), trimMaterial);
  trim.rotation.x = Math.PI / 2;
  trim.position.y = y;
  parent.add(trim);
}

function bladeGeometry(length, width, height) {
  const shape = new THREE.Shape();
  shape.moveTo(-length * 0.5, -width * 0.4);
  shape.lineTo(length * 0.28, -width * 0.58);
  shape.lineTo(length * 0.5, -width * 0.12);
  shape.lineTo(length * 0.32, width * 0.38);
  shape.lineTo(-length * 0.34, width * 0.5);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height - 0.018, steps: 1, bevelEnabled: true,
    bevelSegments: 3, bevelSize: 0.009, bevelThickness: 0.009,
    curveSegments: 1,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, -height / 2 + 0.009, 0);
  return geometry;
}

function addBolts(parent, count, radius, y, materials) {
  addRadialDetails(parent, count, radius, y,
    cylinder(0.036, 0.041, 0.028, 6), materials.metal);
  addRadialDetails(parent, count, radius, y + 0.015,
    new THREE.BoxGeometry(0.037, 0.002, 0.009), materials.darkMetal);
}

// Bake repeated fittings by material without losing the five selectable parts.
function compactPart(group) {
  group.updateMatrixWorld(true);
  const batches = new Map();
  const originals = new Set();
  group.traverse((child) => {
    if (!child.isMesh) return;
    const geometry = child.geometry.index
      ? child.geometry.toNonIndexed() : child.geometry.clone();
    geometry.applyMatrix4(child.matrixWorld);
    const batch = batches.get(child.material) ?? [];
    batch.push(geometry);
    batches.set(child.material, batch);
    originals.add(child.geometry);
  });
  group.clear();
  for (const [partMaterial, geometries] of batches) {
    const geometry = mergeGeometries(geometries, false);
    if (!geometry) throw new Error("Incompatible top detail geometry");
    group.add(mesh(geometry, partMaterial));
    geometries.forEach((item) => item.dispose());
  }
  originals.forEach((item) => item.dispose());
}

function addRadialDetails(
  parent,
  count,
  radius,
  y,
  geometry,
  detailMaterial,
  rotationOffset = 0,
) {
  for (let index = 0; index < count; index += 1) {
    const angle = (Math.PI * 2 * index) / count + rotationOffset;
    const detail = mesh(geometry, detailMaterial);
    detail.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    detail.rotation.y = -angle;
    parent.add(detail);
  }
}

function buildAttackRing(id, materials, customization) {
  const group = new THREE.Group();
  group.add(
    mesh(
      radialRingGeometry(
        0.5,
        0.22,
        160,
        "attackRing",
        id,
        customization,
      ),
      materials.polymer,
    ),
  );

  const lobeCount = customization.shape > 0
    ? customization.symmetry
    : id === "attack_ring.smash_three"
      ? 3
      : id === "attack_ring.stamina_arc"
        ? 8
        : 6;
  const shapeStrength = customization.shape / 100;
  const contactSize =
    id === "attack_ring.smash_three"
      ? [0.44 + shapeStrength * 0.12, 0.1, 0.18]
      : [0.26 + shapeStrength * 0.12, 0.08, 0.14];
  addRadialDetails(
    group,
    lobeCount,
    id === "attack_ring.smash_three" ? 1.02 : 0.94,
    0.08,
    bladeGeometry(contactSize[0], contactSize[2], contactSize[1]),
    materials.metal,
    id === "attack_ring.smash_three" ? 0.12 : 0,
  );
  addRadialDetails(group, lobeCount, 0.79, 0.155,
    bladeGeometry(0.3, 0.16, 0.075), materials.polymerAccent, 0.12);
  addRadialDetails(group, lobeCount, 0.84, -0.11,
    bladeGeometry(0.23, 0.17, 0.07), materials.darkMetal, -0.1);

  const bezel = mesh(
    new THREE.TorusGeometry(0.59, 0.045, 16, 128),
    materials.darkMetal,
  );
  addBolts(group, lobeCount, 0.73, 0.203, materials);
  addTrim(group, 0.515, 0.07, 0.015, materials.metal);
  bezel.rotation.x = Math.PI * 0.5;
  bezel.position.y = 0.12;
  group.add(bezel);
  addRadialDetails(
    group,
    lobeCount,
    0.66,
    0.145,
    cylinder(0.035, 0.035, 0.026, 16),
    materials.darkMetal,
  );
  return group;
}

function buildCoreLock(id, materials, customization) {
  const group = new THREE.Group();
  let radius = 0.37;
  let height = 0.18;
  let offsetY = 0;
  if (id === "core_lock.low_center") {
    radius = 0.41;
    height = 0.14;
    offsetY = -0.025;
  } else if (id === "core_lock.reinforced") {
    radius = 0.4;
    height = 0.22;
  }

  const body = mesh(
    cylinder(radius, radius * 0.92, height),
    materials.core,
  );
  body.position.y = offsetY;
  group.add(body);
  const cap = mesh(cylinder(0.28, 0.31, 0.085, 48), materials.darkMetal);
  cap.position.y = offsetY + height * 0.52;
  cap.rotation.y = Math.PI / 16;
  group.add(cap);
  const emblem = mesh(
    cylinder(0.165, 0.165, 0.03, 32),
    materials.polymerAccent,
  );
  emblem.position.y = offsetY + height * 0.78;
  group.add(emblem);
  addTrim(group, 0.185, offsetY + height * 0.78, 0.013, materials.metal);
  addTrim(group, radius * 0.98, offsetY + height * 0.32, 0.012, materials.polymerAccent);
  addRadialDetails(group, 3, 0.085, offsetY + height * 0.88,
    bladeGeometry(0.115, 0.038, 0.023), materials.metal, 0.35);
  addBolts(group, 3, 0.237, offsetY + height * 0.52 + 0.047, materials);
  addRadialDetails(
    group,
    customization.shape > 0
      ? customization.symmetry
      : id === "core_lock.reinforced"
        ? 6
        : 3,
    0.31,
    offsetY + 0.015,
    new THREE.BoxGeometry(0.15, 0.075, 0.08),
    materials.metal,
  );
  return group;
}

function buildWeightDisc(id, materials, customization) {
  const group = new THREE.Group();
  const offset = id === "weight_disc.eccentric" ? 0.065 : 0;
  const disc = mesh(
    radialRingGeometry(
      0.29,
      0.14,
      128,
      "weightDisc",
      id,
      customization,
    ),
    materials.metal,
  );
  disc.position.x = offset;
  group.add(disc);
  const hub = mesh(cylinder(0.34, 0.34, 0.165), materials.darkMetal);
  hub.position.x = offset;
  group.add(hub);
  for (const radius of [0.38, 0.44, 0.69]) {
    addTrim(group, radius, 0.073, 0.008, materials.darkMetal);
  }
  addTrim(group, 0.335, 0.062, 0.014, materials.metal);
  const insetGroup = new THREE.Group();
  insetGroup.position.x = offset;
  addRadialDetails(
    insetGroup,
    customization.shape > 0
      ? customization.symmetry
      : id === "weight_disc.heavy_outer"
        ? 8
        : 6,
    0.58,
    0.085,
    cylinder(0.05, 0.05, 0.025, 16),
    materials.shadow,
  );
  group.add(insetGroup);
  return group;
}

function buildDriverShaft(id, materials, customization) {
  const group = new THREE.Group();
  let height = 0.4;
  let radius = 0.17;
  let offsetY = 0;
  if (id === "driver_shaft.low_stable") {
    height = 0.32;
    radius = 0.21;
    offsetY = 0.035;
  } else if (id === "driver_shaft.high_attack") {
    height = 0.5;
    radius = 0.145;
    offsetY = -0.045;
  }

  const body = mesh(
    cylinder(radius, radius * 0.92, height),
    materials.shadow,
  );
  body.position.y = offsetY;
  group.add(body);
  const upper = mesh(cylinder(0.285, 0.245, 0.1), materials.core);
  upper.position.y = offsetY + height * 0.38;
  group.add(upper);
  const lower = mesh(
    cylinder(radius * 1.12, radius, 0.08),
    materials.darkMetal,
  );
  lower.position.y = offsetY - height * 0.42;
  group.add(lower);
  for (let index = 0; index < 4; index += 1) {
    addTrim(group, radius * 1.03, offsetY - height * 0.25 + index * height * 0.14,
      0.012, index % 2 ? materials.darkMetal : materials.metal);
  }
  addTrim(group, 0.255, offsetY + height * 0.38, 0.015, materials.polymerAccent);
  addRadialDetails(
    group,
    customization.shape > 0 ? customization.symmetry : 6,
    radius,
    offsetY,
    new THREE.BoxGeometry(0.04, height * 0.58, 0.055),
    materials.metal,
  );
  return group;
}

function buildTip(id, materials, customization) {
  const group = new THREE.Group();
  if (id === "tip.metal_stamina") {
    const housing = mesh(cylinder(0.17, 0.07, 0.22), materials.darkMetal);
    housing.position.y = 0.03;
    group.add(housing);
    const point = mesh(
      new THREE.SphereGeometry(0.075, 28, 14),
      materials.metal,
    );
    point.scale.y = 1.35;
    point.position.y = -0.115;
    group.add(point);
  } else if (id === "tip.flat_attack") {
    const housing = mesh(cylinder(0.22, 0.18, 0.18), materials.rubber);
    housing.position.y = 0.02;
    group.add(housing);
    const contact = mesh(cylinder(0.19, 0.19, 0.065), materials.core);
    contact.position.y = -0.095;
    group.add(contact);
  } else {
    const housing = mesh(cylinder(0.2, 0.095, 0.22), materials.core);
    housing.position.y = 0.025;
    group.add(housing);
    const contact = mesh(
      new THREE.SphereGeometry(0.115, 28, 14),
      materials.rubber,
    );
    contact.scale.y = 0.72;
    contact.position.y = -0.12;
    group.add(contact);
  }
  if (customization.shape > 0) {
    addRadialDetails(
      group,
      customization.symmetry,
      0.18,
      0.02,
      new THREE.BoxGeometry(
        0.035 + customization.shape * 0.00045,
        0.13,
        0.045,
      ),
      materials.shadow,
    );
  }
  addTrim(group, id === "tip.flat_attack" ? 0.197 : 0.16, 0.07, 0.015, materials.metal);
  return group;
}

function* buildTopSteps(
  selection,
  colors = { ring: "#23c8b2", core: "#efbd3c" },
  customizations = {},
) {
  const top = new THREE.Group();
  top.userData.materials = [];
  top.userData.partGroups = {};

  const builders = {
    attackRing: buildAttackRing,
    coreLock: buildCoreLock,
    weightDisc: buildWeightDisc,
    driverShaft: buildDriverShaft,
    tip: buildTip,
  };

  let complete = false;
  try {
    for (const [slot, builder] of Object.entries(builders)) {
      const partId = selection[slot];
      const customization = normalizePartCustomization(customizations[partId]);
      const materials = createMaterials(colors, customization.material);
      top.userData.materials.push(...Object.values(materials));
      const partGroup = builder(partId, materials, customization);
      if (slot === "coreLock" && colors.emblem) {
        // Small authored insignia: actual geometry, never a texture placeholder.
        const count = colors.emblem;
        addRadialDetails(partGroup, count, 0.13, 0.205,
          bladeGeometry(count === 2 ? 0.23 : 0.1, 0.038, 0.027), materials.core);
      }
      compactPart(partGroup);
      partGroup.name = slot;
      partGroup.position.y = SLOT_Y[slot];
      partGroup.userData.baseY = SLOT_Y[slot];
      partGroup.userData.baseScale = new THREE.Vector3(
        customization.size,
        customization.height,
        customization.size,
      );
      partGroup.scale.copy(partGroup.userData.baseScale);
      partGroup.traverse((child) => {
        if (!child.isMesh) return;
        child.material = cloneSurfaceMaterial(child.material);
        top.userData.materials.push(child.material);
      });
      top.userData.partGroups[slot] = partGroup;
      top.add(partGroup);
      yield;
    }
    top.updateMatrixWorld(true);
    top.userData.contactOffset = -new THREE.Box3().setFromObject(top).min.y;
    complete = true;
    return top;
  } finally {
    if (!complete) disposeTopModel(top);
  }
}

export function createTopModel(...args) {
  const steps = buildTopSteps(...args);
  let step;
  do { step = steps.next(); } while (!step.done);
  return step.value;
}

// Optional next-battle work yields between the same five builders used by the
// synchronous path. Cancellation disposes even a partially constructed top.
export async function prepareTopModel(selection, colors, customizations, current) {
  const steps = buildTopSteps(selection, colors, customizations);
  try {
    while (current()) {
      const step = steps.next();
      if (step.done) return step.value;
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
    return null;
  } finally {
    steps.return();
  }
}

export function setActivePart(top, activeSlot = null, immediate = true) {
  Object.entries(top.userData.partGroups ?? {}).forEach(([slot, group]) => {
    const active = slot === activeSlot;
    const muted = Boolean(activeSlot) && !active;
    const factor = active ? 1.055 : 1;
    const baseScale = group.userData.baseScale ?? new THREE.Vector3(1, 1, 1);
    group.userData.focusTargetY =
      group.userData.baseY + (active ? 0.12 : 0);
    group.userData.focusTargetScale = new THREE.Vector3(
      baseScale.x * factor,
      baseScale.y * factor,
      baseScale.z * factor,
    );
    group.userData.focusTargetOpacity = muted ? 0.2 : 1;
    if (immediate) {
      group.position.y = group.userData.focusTargetY;
      group.scale.copy(group.userData.focusTargetScale);
    }
    group.traverse((child) => {
      if (!child.isMesh) return;
      child.material.transparent = muted || !immediate;
      if (immediate) {
        child.material.opacity = group.userData.focusTargetOpacity;
      }
      child.material.depthWrite = !muted && immediate;
      child.material.needsUpdate = true;
    });
  });
}

export function updateTopPartFocus(top, delta) {
  const ease = Math.min(delta * 11, 1);
  Object.values(top.userData.partGroups ?? {}).forEach((group) => {
    const targetScale = group.userData.focusTargetScale;
    const targetY = group.userData.focusTargetY;
    const targetOpacity = group.userData.focusTargetOpacity;
    if (!targetScale || targetY === undefined || targetOpacity === undefined) {
      return;
    }
    group.position.y += (targetY - group.position.y) * ease;
    group.scale.lerp(targetScale, ease);
    group.traverse((child) => {
      if (!child.isMesh) return;
      child.material.transparent =
        targetOpacity < 0.999 || child.material.opacity < 0.999;
      child.material.opacity +=
        (targetOpacity - child.material.opacity) * ease;
      child.material.depthWrite =
        targetOpacity >= 0.999 && child.material.opacity >= 0.985;
      child.material.needsUpdate = true;
    });
  });
}

export function disposeTopModel(top) {
  top.traverse((child) => {
    if (child.isMesh) child.geometry.dispose();
  });
  for (const item of top.userData.materials ?? []) item.dispose();
}

export function applyTopDamage(top, structure) {
  if (!structure || top.userData.damageRevision === structure.revision) return;
  top.userData.damageRevision = structure.revision;
  for (const part of structure.parts) {
    const group = top.userData.partGroups[part.slot];
    if (!group) continue;
    group.traverse((child) => {
      if (!child.isMesh) return;
      const position = child.geometry.getAttribute("position");
      const original = child.userData.undamagedPositions ??= position.array.slice();
      const baseColor = child.userData.undamagedColor ??= child.material.color.clone();
      child.material.color.copy(baseColor).lerp(new THREE.Color("#413329"), part.worst * 0.32);
      child.material.roughness = Math.max(child.material.roughness, part.worst * 0.8);
      for (let i = 0; i < position.count; i++) {
        const x = original[i * 3], y = original[i * 3 + 1], z = original[i * 3 + 2];
        const angle = (Math.atan2(z, x) + Math.PI * 2) % (Math.PI * 2);
        const at = angle / (Math.PI * 2) * part.sectors.length;
        const low = Math.floor(at), mix = at - low;
        const damage = part.sectors[low] * (1 - mix) + part.sectors[(low + 1) % part.sectors.length] * mix;
        const dent = 1 - damage ** 1.4 * 0.3;
        position.setXYZ(i, x * dent, y - damage ** 2 * 0.1 * Math.hypot(x, z), z * dent);
      }
      position.needsUpdate = true;
      child.geometry.computeVertexNormals();
      child.geometry.computeBoundingSphere();
    });
  }
}
