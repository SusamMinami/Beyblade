export const PART_MATERIALS = Object.freeze({
  stock: Object.freeze({
    id: "stock",
    name: "原装材料",
    price: 0,
    description: "保留基础零件的重量、硬度与表面特性。",
    density: 1,
    friction: 1,
    restitution: 1,
    damping: 1,
    stability: 1,
    control: 1,
    attack: 1,
    durability: 1,
  }),
  polymer: Object.freeze({
    id: "polymer",
    name: "轻质聚合物",
    price: 160,
    description: "更轻、更灵活，控制提升，但抗冲击能力下降。",
    density: 0.78,
    friction: 1.04,
    restitution: 0.92,
    damping: 0.94,
    stability: 1.02,
    control: 1.08,
    attack: 0.9,
    durability: 0.84,
  }),
  alloy: Object.freeze({
    id: "alloy",
    name: "高密度合金",
    price: 360,
    description: "增加撞击动量和耐久，同时提高启动与控制负担。",
    density: 1.2,
    friction: 0.96,
    restitution: 1.1,
    damping: 1.05,
    stability: 0.98,
    control: 0.9,
    attack: 1.1,
    durability: 1.2,
  }),
  carbon: Object.freeze({
    id: "carbon",
    name: "碳纤维复材",
    price: 420,
    description: "低重量与高结构强度兼顾，续航和稳定性较好。",
    density: 0.7,
    friction: 0.92,
    restitution: 0.96,
    damping: 0.88,
    stability: 1.06,
    control: 1.04,
    attack: 0.96,
    durability: 1.06,
  }),
  rubber: Object.freeze({
    id: "rubber",
    name: "高抓地橡胶",
    price: 260,
    description: "提升抓地与操控，吸收回弹，但会加快转速损耗。",
    density: 0.94,
    friction: 1.24,
    restitution: 0.72,
    damping: 1.24,
    stability: 1.04,
    control: 1.12,
    attack: 0.9,
    durability: 0.96,
  }),
});

export const PART_MATERIAL_LIST = Object.freeze(
  Object.values(PART_MATERIALS),
);

export const SYMMETRY_OPTIONS = Object.freeze([2, 3, 4, 6]);

export const DEFAULT_PART_CUSTOMIZATION = Object.freeze({
  shape: 0,
  size: 1,
  height: 1,
  material: "stock",
  symmetry: 2,
});

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export function normalizePartCustomization(value = {}) {
  const symmetry = Number(value.symmetry);
  const material = PART_MATERIALS[value.material]
    ? value.material
    : DEFAULT_PART_CUSTOMIZATION.material;
  return {
    shape: clamp(Number(value.shape) || 0, 0, 100),
    size: clamp(Number(value.size) || 1, 0.78, 1.24),
    height: clamp(Number(value.height) || 1, 0.72, 1.35),
    material,
    symmetry: SYMMETRY_OPTIONS.includes(symmetry)
      ? symmetry
      : DEFAULT_PART_CUSTOMIZATION.symmetry,
  };
}

export function normalizeCustomizationMap(value = {}) {
  const result = {};
  for (const [partId, customization] of Object.entries(value ?? {})) {
    if (!partId || !customization || typeof customization !== "object") {
      continue;
    }
    result[partId] = normalizePartCustomization(customization);
  }
  return result;
}

export function isDefaultCustomization(value = {}) {
  const normalized = normalizePartCustomization(value);
  return (
    normalized.shape === DEFAULT_PART_CUSTOMIZATION.shape &&
    normalized.size === DEFAULT_PART_CUSTOMIZATION.size &&
    normalized.height === DEFAULT_PART_CUSTOMIZATION.height &&
    normalized.material === DEFAULT_PART_CUSTOMIZATION.material &&
    normalized.symmetry === DEFAULT_PART_CUSTOMIZATION.symmetry
  );
}

export function applyPartCustomization(part, value) {
  if (!value || isDefaultCustomization(value)) return part;

  const customization = normalizePartCustomization(value);
  const material = PART_MATERIALS[customization.material];
  const volumeScale =
    customization.size ** 2 * customization.height;
  const massScale = volumeScale * material.density;
  const shapeStrength = customization.shape / 100;
  const symmetryBalance = {
    2: 0.94,
    3: 0.97,
    4: 1.01,
    6: 1.05,
  }[customization.symmetry];
  const symmetryAttack = {
    2: 1.08,
    3: 1.06,
    4: 1.01,
    6: 0.96,
  }[customization.symmetry];
  const heightStability = clamp(
    1 - Math.max(customization.height - 1, 0) * 0.34,
    0.82,
    1,
  );
  const lowProfileStability = clamp(
    1 + Math.max(1 - customization.height, 0) * 0.2,
    1,
    1.08,
  );

  return Object.freeze({
    ...part,
    mass: part.mass * massScale,
    center: Object.freeze([
      part.center[0],
      part.center[1] * customization.height +
        (customization.height - 1) * 0.045,
      part.center[2],
    ]),
    inertia:
      part.inertia * massScale * customization.size ** 2,
    friction: part.friction * material.friction,
    restitution: clamp(part.restitution * material.restitution, 0, 1),
    contactArea:
      part.contactArea *
      customization.size ** 2 *
      (1 + shapeStrength * 0.16),
    damping: part.damping * material.damping,
    stability:
      part.stability *
      material.stability *
      heightStability *
      lowProfileStability *
      (1 + (symmetryBalance - 1) * shapeStrength),
    control:
      part.control *
      material.control *
      clamp(1 / Math.sqrt(massScale), 0.82, 1.15),
    attack:
      part.attack *
      material.attack *
      (1 + (symmetryAttack - 1) * shapeStrength) *
      (1 + shapeStrength * 0.08),
    durability:
      part.durability *
      material.durability *
      volumeScale ** 0.28,
    customization: Object.freeze(customization),
  });
}
