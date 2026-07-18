import * as THREE from "three";

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

function createMaterials(colors) {
  const ringColor = new THREE.Color(colors.ring);
  const ringAccent = ringColor.clone().offsetHSL(0, 0.05, 0.18);
  const woodFinish = colors.finish === "wood";
  if (woodFinish) {
    return {
      polymer: material(ringColor, 0.02, 0.72),
      polymerAccent: material(ringAccent, 0.03, 0.64),
      core: material(colors.core, 0.02, 0.68),
      metal: material(0x8c633f, 0.02, 0.76),
      darkMetal: material(0x4d3524, 0.04, 0.72),
      rubber: material(0x33251b, 0.01, 0.88),
      shadow: material(0x6b4a31, 0.02, 0.82),
    };
  }
  return {
    polymer: material(ringColor, 0.14, 0.2, { clearcoat: 0.78 }),
    polymerAccent: material(ringAccent, 0.2, 0.16, { clearcoat: 0.88 }),
    core: material(colors.core, 0.42, 0.2, { clearcoat: 0.7 }),
    metal: material(METAL, 0.96, 0.16),
    darkMetal: material(DARK_METAL, 0.9, 0.25),
    rubber: material(RUBBER, 0.05, 0.82),
    shadow: material(0x263138, 0.48, 0.46),
  };
}

function outerRadius(angle, slot, id) {
  if (slot === "attackRing") {
    if (id === "attack_ring.smash_three") {
      const pulse = Math.max(0, Math.cos(angle * 3 - 0.28)) ** 4;
      return 0.91 + pulse * 0.3;
    }
    if (id === "attack_ring.stamina_arc") {
      return 1.01 + Math.cos(angle * 8) * 0.022;
    }
    const pulse = (0.5 + 0.5 * Math.cos(angle * 6)) ** 2;
    return 0.94 + pulse * 0.12;
  }
  if (id === "weight_disc.heavy_outer") {
    return 0.82 + Math.cos(angle * 8) * 0.018;
  }
  if (id === "weight_disc.eccentric") {
    return 0.74 + Math.cos(angle) * 0.075 + Math.cos(angle * 5) * 0.018;
  }
  return 0.74 + Math.cos(angle * 6) * 0.012;
}

function radialRingGeometry(innerRadius, height, segments, slot, id) {
  const positions = [];
  const halfHeight = height * 0.5;
  const point = (angle, radius, y) => [
    Math.cos(angle) * radius,
    y,
    Math.sin(angle) * radius,
  ];
  const triangle = (a, b, c) => positions.push(...a, ...b, ...c);
  const quad = (a, b, c, d) => {
    triangle(a, b, c);
    triangle(a, c, d);
  };

  for (let index = 0; index < segments; index += 1) {
    const angleA = (Math.PI * 2 * index) / segments;
    const angleB = (Math.PI * 2 * (index + 1)) / segments;
    const outerA = outerRadius(angleA, slot, id);
    const outerB = outerRadius(angleB, slot, id);
    const innerBottomA = point(angleA, innerRadius, -halfHeight);
    const innerBottomB = point(angleB, innerRadius, -halfHeight);
    const outerBottomA = point(angleA, outerA, -halfHeight);
    const outerBottomB = point(angleB, outerB, -halfHeight);
    const innerTopA = point(angleA, innerRadius, halfHeight);
    const innerTopB = point(angleB, innerRadius, halfHeight);
    const outerTopA = point(angleA, outerA, halfHeight);
    const outerTopB = point(angleB, outerB, halfHeight);

    quad(innerTopA, innerTopB, outerTopB, outerTopA);
    quad(innerBottomA, outerBottomA, outerBottomB, innerBottomB);
    quad(outerBottomA, outerTopA, outerTopB, outerBottomB);
    quad(innerBottomB, innerTopB, innerTopA, innerBottomA);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function mesh(geometry, meshMaterial) {
  const instance = new THREE.Mesh(geometry, meshMaterial);
  instance.castShadow = true;
  instance.receiveShadow = true;
  return instance;
}

function cylinder(topRadius, bottomRadius, height, segments = 36) {
  return new THREE.CylinderGeometry(
    topRadius,
    bottomRadius,
    height,
    segments,
    2,
  );
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

function buildAttackRing(id, materials) {
  const group = new THREE.Group();
  group.add(
    mesh(
      radialRingGeometry(0.5, 0.22, 96, "attackRing", id),
      materials.polymer,
    ),
  );

  const lobeCount =
    id === "attack_ring.smash_three"
      ? 3
      : id === "attack_ring.stamina_arc"
        ? 8
        : 6;
  const contactSize =
    id === "attack_ring.smash_three"
      ? [0.44, 0.1, 0.18]
      : [0.26, 0.08, 0.14];
  addRadialDetails(
    group,
    lobeCount,
    id === "attack_ring.smash_three" ? 1.02 : 0.94,
    0.08,
    new THREE.BoxGeometry(...contactSize),
    materials.metal,
    id === "attack_ring.smash_three" ? 0.12 : 0,
  );

  const bezel = mesh(
    new THREE.TorusGeometry(0.59, 0.065, 12, 64),
    materials.darkMetal,
  );
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

function buildCoreLock(id, materials) {
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
  const cap = mesh(cylinder(0.28, 0.31, 0.085, 20), materials.darkMetal);
  cap.position.y = offsetY + height * 0.52;
  cap.rotation.y = Math.PI / 16;
  group.add(cap);
  const emblem = mesh(
    cylinder(0.165, 0.165, 0.03, 32),
    materials.polymerAccent,
  );
  emblem.position.y = offsetY + height * 0.78;
  group.add(emblem);
  addRadialDetails(
    group,
    id === "core_lock.reinforced" ? 6 : 3,
    0.31,
    offsetY + 0.015,
    new THREE.BoxGeometry(0.15, 0.075, 0.08),
    materials.metal,
  );
  return group;
}

function buildWeightDisc(id, materials) {
  const group = new THREE.Group();
  const offset = id === "weight_disc.eccentric" ? 0.065 : 0;
  const disc = mesh(
    radialRingGeometry(0.29, 0.14, 80, "weightDisc", id),
    materials.metal,
  );
  disc.position.x = offset;
  group.add(disc);
  const hub = mesh(cylinder(0.34, 0.34, 0.165), materials.darkMetal);
  hub.position.x = offset;
  group.add(hub);
  const insetGroup = new THREE.Group();
  insetGroup.position.x = offset;
  addRadialDetails(
    insetGroup,
    id === "weight_disc.heavy_outer" ? 8 : 6,
    0.58,
    0.085,
    cylinder(0.05, 0.05, 0.025, 16),
    materials.shadow,
  );
  group.add(insetGroup);
  return group;
}

function buildDriverShaft(id, materials) {
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
  addRadialDetails(
    group,
    6,
    radius,
    offsetY,
    new THREE.BoxGeometry(0.04, height * 0.58, 0.055),
    materials.metal,
  );
  return group;
}

function buildTip(id, materials) {
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
  return group;
}

export function createTopModel(
  selection,
  colors = { ring: "#23c8b2", core: "#efbd3c" },
) {
  const materials = createMaterials(colors);
  const top = new THREE.Group();
  top.userData.materials = Object.values(materials);
  top.userData.partGroups = {};

  const builders = {
    attackRing: () => buildAttackRing(selection.attackRing, materials),
    coreLock: () => buildCoreLock(selection.coreLock, materials),
    weightDisc: () => buildWeightDisc(selection.weightDisc, materials),
    driverShaft: () => buildDriverShaft(selection.driverShaft, materials),
    tip: () => buildTip(selection.tip, materials),
  };

  Object.entries(builders).forEach(([slot, builder]) => {
    const partGroup = builder();
    partGroup.name = slot;
    partGroup.position.y = SLOT_Y[slot];
    partGroup.userData.baseY = SLOT_Y[slot];
    partGroup.traverse((child) => {
      if (!child.isMesh) return;
      child.material = child.material.clone();
      top.userData.materials.push(child.material);
    });
    top.userData.partGroups[slot] = partGroup;
    top.add(partGroup);
  });
  return top;
}

export function setActivePart(top, activeSlot = null) {
  Object.entries(top.userData.partGroups ?? {}).forEach(([slot, group]) => {
    const active = slot === activeSlot;
    const muted = Boolean(activeSlot) && !active;
    group.position.y = group.userData.baseY + (active ? 0.12 : 0);
    group.scale.setScalar(active ? 1.055 : 1);
    group.traverse((child) => {
      if (!child.isMesh) return;
      child.material.transparent = muted;
      child.material.opacity = muted ? 0.2 : 1;
      child.material.depthWrite = !muted;
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
