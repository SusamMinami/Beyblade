const identities = {
  gravel: { ring: "#da923b", core: "#278b9b", metal: "#b4a58e", emblem: 6,
    description: "蜂蜜橙六瓣环 · 蓝绿石芯", ringDIY: { size: 0.9, height: 1.08, shape: 18, symmetry: 6, material: "polymer" } },
  obsidian: { ring: "#49355f", core: "#ee644c", metal: "#9da7ba", emblem: 3,
    description: "紫黑刃冠 · 朱红三爪印", ringDIY: { size: 1.08, height: 0.9, shape: 76, symmetry: 3, material: "stock" } },
  rivet: { ring: "#268c86", core: "#efa34f", metal: "#b88c58", emblem: 4,
    description: "青绿低冠 · 黄铜四枚铆钉", ringDIY: { size: 0.94, height: 1.18, shape: 30, symmetry: 4, material: "alloy" } },
  gauge: { ring: "#c4d6e6", core: "#30549c", metal: "#e1e7ec", emblem: 6,
    description: "冰白宽盘 · 钴蓝六向刻度", ringDIY: { size: 1.19, height: 1.12, shape: 48, symmetry: 6, material: "alloy" } },
  annual: { ring: "#74a76f", core: "#d4ac64", metal: "#9c8b65", emblem: 2,
    description: "苔绿圆弧 · 古铜双环", ringDIY: { size: 1.1, height: 0.78, shape: 10, symmetry: 6, material: "stock" } },
};

export function opponentIdentity(mission, arenaId = "standard") {
  const key = mission?.opponent === "阿砾" ? "gravel"
    : mission?.opponent === "罗彻" ? "obsidian"
      : mission?.opponent === "阿岑" ? "rivet"
        : mission?.opponent === "韩峥" ? "gauge"
          : mission ? "annual"
            : ({ street: "gravel", ruins: "annual", metal: "obsidian", composite: "gauge" }[arenaId] ?? "rivet");
  const profile = identities[key];
  const ringDIY = { ...profile.ringDIY };
  if (mission?.id === "rival-rematch") Object.assign(ringDIY, { size: 1.18, height: 1.04, shape: 92, material: "alloy" });
  if (mission?.id === "rival-without-badge") Object.assign(ringDIY, { size: 1.02, height: 1.15, shape: 54 });
  if (mission?.id === "our-names") Object.assign(ringDIY, { size: 1.12, height: 1.04, shape: 24, symmetry: 6 });
  const customizations = mission ? { [mission.enemyBuild.attackRing]: ringDIY } : {};
  return {
    key, description: profile.description,
    colors: { ring: profile.ring, core: profile.core, metal: profile.metal, emblem: profile.emblem },
    customizations,
  };
}
