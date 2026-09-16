const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
export const LAB_MODES = [
  { id: "mass", name: "重量测试", en: "WEIGHT", title: "重量 · 转动惯量" },
  { id: "center", name: "质心测试", en: "C.G. TEST", title: "质心 · 轴向偏心" },
  { id: "balance", name: "平衡测试", en: "BALANCE", title: "平衡 · 环境估算" },
];
export const WIND_OPTIONS = ["无风", "侧风", "强逆风"];
export const TERRAIN_OPTIONS = ["标准地面", "低摩擦金属", "高摩擦橡胶", "砂砾扰动"];
export const LAB_XP_PER_TEST = 30;
const nonNegative = (value) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
export const WIND_PRESETS = {
  "无风": { windSpeed: 0, windDirection: 0 },
  "侧风": { windSpeed: 4.3, windDirection: 90 },
  "强逆风": { windSpeed: 8, windDirection: 180 },
};

export function windParameters(settings = {}) {
  const preset = WIND_PRESETS[settings.wind] ?? WIND_PRESETS["无风"];
  const speed = Number.isFinite(settings.windSpeed) ? clamp(settings.windSpeed, 0, 12) : preset.windSpeed;
  const direction = Number.isFinite(settings.windDirection) ? ((settings.windDirection % 360) + 360) % 360 : preset.windDirection;
  return { speed, direction };
}

export function normalizeLabState(saved = {}) {
  return {
    xp: Math.floor(nonNegative(saved?.xp)),
    records: Array.isArray(saved?.records)
      ? saved.records.filter((r) => r && typeof r.id === "string" &&
          Number.isFinite(r.timestamp) && Array.isArray(r.metrics) &&
          r.metrics.every((m) => m && typeof m.label === "string" && Number.isFinite(m.value)))
        .slice(0, 40)
      : [],
    rewarded: Array.isArray(saved?.rewarded)
      ? saved.rewarded.filter((value) => typeof value === "string").slice(-1000)
      : [],
    calibratedAt: nonNegative(saved?.calibratedAt),
    settings: {
      room: saved?.settings?.room === "advanced" && nonNegative(saved?.xp) >= 120 ? "advanced" : "childhood",
      wind: WIND_OPTIONS.includes(saved?.settings?.wind) ? saved.settings.wind : "无风",
      windSpeed: windParameters(saved?.settings).speed,
      windDirection: windParameters(saved?.settings).direction,
      terrain: TERRAIN_OPTIONS.includes(saved?.settings?.terrain) ? saved.settings.terrain : "标准地面",
      autoRotate: saved?.settings?.autoRotate !== false,
      showCenter: saved?.settings?.showCenter === true,
      quality: saved?.settings?.quality === "performance" ? "performance" : "high",
    },
  };
}

export function labLevel(xp) {
  const level = Math.floor(Math.sqrt(xp / 120)) + 1;
  const floor = 120 * (level - 1) ** 2;
  const next = 120 * level ** 2;
  return { level, current: xp - floor, required: next - floor };
}

export function measureBuild(build, mode, settings) {
  if (mode === "center") {
    return [
      { label: "质心高度 Y", value: build.centerOfMass[1], unit: "规则单位", decimals: 4 },
      { label: "径向偏心", value: Math.hypot(build.centerOfMass[0], build.centerOfMass[2]), unit: "规则单位", decimals: 4 },
    ];
  }
  if (mode === "balance") {
    let stability = build.stability * 75;
    let control = build.controlResponse * 65;
    stability -= windParameters(settings).speed * 15 / 8;
    stability += { "砂砾扰动": -18, "低摩擦金属": -5, "高摩擦橡胶": 6 }[settings.terrain] ?? 0;
    control += { "低摩擦金属": -16, "高摩擦橡胶": 12 }[settings.terrain] ?? 0;
    return [
      { label: "稳定性估算", value: clamp(stability, 0, 100), unit: "/ 100", decimals: 0 },
      { label: "控制响应", value: clamp(control, 0, 100), unit: "/ 100", decimals: 0 },
    ];
  }
  return [
    { label: "总质量", value: build.totalMass, unit: "平衡单位", decimals: 2 },
    { label: "转动惯量", value: build.momentOfInertia, unit: "惯量单位", decimals: 3 },
  ];
}

export function completeLabTest(lab, build, loadout, mode, timestamp = Date.now()) {
  const metrics = measureBuild(build, mode, lab.settings);
  const fingerprint = JSON.stringify([
    mode, build.selection, build.customizations,
    ...(mode === "balance" ? [windParameters(lab.settings), lab.settings.terrain] : []),
  ]);
  const gained = lab.rewarded.includes(fingerprint) ? 0 : LAB_XP_PER_TEST;
  const record = {
    id: `${timestamp}-${lab.records.length}`,
    timestamp,
    name: loadout.name,
    mode,
    metrics,
    wind: lab.settings.wind,
    windSpeed: windParameters(lab.settings).speed,
    windDirection: windParameters(lab.settings).direction,
    terrain: lab.settings.terrain,
    selection: { ...build.selection },
  };
  return {
    gained,
    record,
    lab: {
      ...lab,
      xp: lab.xp + gained,
      records: [record, ...lab.records].slice(0, 40),
      rewarded: gained ? [...lab.rewarded, fingerprint].slice(-1000) : lab.rewarded,
    },
  };
}
