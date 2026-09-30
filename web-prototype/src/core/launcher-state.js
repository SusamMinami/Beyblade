// All quantities are game-balance units. IDs match the authored Blender assets.
export const LAUNCHER_VERSION = "launcher-v1";
export const LAUNCHER_SLOTS = { rack: "齿条", transmission: "传动芯组", coupler: "连接头" };
export const LAUNCHER_PARTS = [
  { id: "launcher.rack.r01", slot: "rack", code: "R01", name: "循衡", price: 0,
    mass: 1, flex: 1, note: "连续背梁，抽拉负担与刚性均衡。" },
  { id: "launcher.rack.r02", slot: "rack", code: "R02", name: "轻羽", price: 140,
    mass: .58, flex: 2.8, note: "起拉更轻快；高载挠曲和回弹储能更多。" },
  { id: "launcher.rack.r03", slot: "rack", code: "R03", name: "刚脊", price: 180,
    mass: 1.5, flex: .3, note: "金属背脊抗挠；往复质量更大。" },
  { id: "launcher.transmission.t01", slot: "transmission", code: "T01", name: "恒比", price: 0,
    ratio: 1, inertia: .04, note: "32 : 32，转速与输出扭矩均衡。" },
  { id: "launcher.transmission.t02", slot: "transmission", code: "T02", name: "超越", price: 220,
    ratio: 36 / 28, inertia: .032, note: "36 : 28，提高同抽速的转速上限；更费力。" },
  { id: "launcher.transmission.t03", slot: "transmission", code: "T03", name: "厚积", price: 220,
    ratio: 28 / 36, inertia: .053, note: "28 : 36，高载更省力；转速上限较低。" },
  { id: "launcher.coupler.c01", slot: "coupler", code: "C01", name: "直联", price: 0,
    inertia: .04, drag: .01, releaseMs: 160, alignment: 1, note: "单支承、标准退出行程。" },
  { id: "launcher.coupler.c02", slot: "coupler", code: "C02", name: "瞬脱", price: 160,
    inertia: .022, drag: .004, releaseMs: 95, alignment: 1.65, note: "退出更快、转子更轻；偏载支承较弱。" },
  { id: "launcher.coupler.c03", slot: "coupler", code: "C03", name: "定轴", price: 200,
    inertia: .07, drag: .018, releaseMs: 210, alignment: .4, note: "双支承抑制偏载；阻力与惯量增加。" },
];
export const DEFAULT_LAUNCHER_BUILD = Object.fromEntries(
  LAUNCHER_PARTS.filter(p => p.price === 0).map(p => [p.slot, p.id]));
export const DEFAULT_LAUNCHER_COLORS = {
  shell: "#eee9dc", accent: "#1761c4", grip: "#202733",
};
export const getLauncherPart = id => LAUNCHER_PARTS.find(p => p.id === id);
export function normalizeLauncher(raw, owned) {
  const build = {};
  for (const slot of Object.keys(LAUNCHER_SLOTS)) {
    const part = getLauncherPart(raw?.build?.[slot]);
    build[slot] = part?.slot === slot && (!owned || owned.includes(part.id))
      ? part.id : DEFAULT_LAUNCHER_BUILD[slot];
  }
  const colors = {};
  for (const [zone, fallback] of Object.entries(DEFAULT_LAUNCHER_COLORS))
    colors[zone] = /^#[0-9a-f]{6}$/i.test(raw?.colors?.[zone]) ? raw.colors[zone].toLowerCase() : fallback;
  return { version: LAUNCHER_VERSION, build, colors };
}
export const launcherKey = raw => JSON.stringify(normalizeLauncher(raw));

// Retain oil on the removed part, but only mounted parts influence a launch.
// Legacy unqualified samples belong to the original reference equipment.
export function activeLauncherOil(samples = [], raw) {
  const config = normalizeLauncher(raw);
  const codes = Object.values(config.build).map(id => getLauncherPart(id).code);
  return samples.filter(s => {
    const code = s.mesh.match(/(?:^|_)([RTC]0[123])(?:_|$)/)?.[1];
    if (code) return codes.includes(code);
    if (s.zone !== "transmission") return true;
    return Object.entries(DEFAULT_LAUNCHER_BUILD).every(([slot, id]) => config.build[slot] === id);
  });
}
