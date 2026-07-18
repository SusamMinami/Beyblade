const surface = (
  name,
  {
    friction = 1,
    spinDamping = 1,
    linearDrag = 1,
    bounce = 1,
    stability = 1,
    damage = 1,
    control = 1,
    noise = 0,
  } = {},
) =>
  Object.freeze({
    name,
    friction,
    spinDamping,
    linearDrag,
    bounce,
    stability,
    damage,
    control,
    noise,
  });

export const SURFACES = Object.freeze({
  standard: surface("标准地面"),
  metal: surface("低摩擦金属", {
    friction: 0.45,
    spinDamping: 0.72,
    linearDrag: 0.65,
    bounce: 1.15,
    stability: 0.92,
    damage: 1.08,
    control: 0.75,
    noise: 0.02,
  }),
  rubber: surface("高抓地橡胶", {
    friction: 1.35,
    spinDamping: 1.28,
    linearDrag: 1.22,
    bounce: 0.72,
    stability: 1.08,
    damage: 0.86,
    control: 1.2,
  }),
  brake: surface("边缘减速带", {
    friction: 1.55,
    spinDamping: 1.46,
    linearDrag: 1.45,
    bounce: 0.68,
    stability: 0.9,
    damage: 0.92,
    control: 1.08,
    noise: 0.035,
  }),
});

const arena = (config) => Object.freeze(config);

export const ARENAS = Object.freeze({
  standard: arena({
    id: "standard",
    number: "01",
    name: "标准碗形竞技场",
    shortName: "标准碗",
    tag: "均衡",
    description: "中等摩擦与柔和回中心力，适合验证基础移动、碰撞和停转。",
    accent: "#f1b84b",
    ringOutRadius: 7.2,
    wallRadius: 6.7,
    bowlForce: 0.86,
    surfaceAt: () => SURFACES.standard,
  }),
  metal: arena({
    id: "metal",
    number: "02",
    name: "金属高速竞技场",
    shortName: "高速金属",
    tag: "高速",
    description: "低摩擦、高回弹、长续航，碰撞后滑移与撞飞风险明显。",
    accent: "#8ed8e7",
    ringOutRadius: 7.45,
    wallRadius: 6.9,
    bowlForce: 0.68,
    surfaceAt: () => SURFACES.metal,
  }),
  composite: arena({
    id: "composite",
    number: "03",
    name: "复合材质竞技场",
    shortName: "复合材质",
    tag: "策略",
    description: "中央金属、外圈橡胶与边缘减速带组合，验证路线选择。",
    accent: "#ef6b4f",
    ringOutRadius: 7.3,
    wallRadius: 6.8,
    bowlForce: 0.78,
    surfaceAt: (radius) => {
      if (radius < 3.1) return SURFACES.metal;
      if (radius < 5.9) return SURFACES.rubber;
      return SURFACES.brake;
    },
  }),
});

export const ARENA_LIST = Object.freeze(Object.values(ARENAS));

export const getArena = (id) => ARENAS[id] ?? ARENAS.standard;
