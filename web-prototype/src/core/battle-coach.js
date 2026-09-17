import { PART_TYPE_META } from "../data/parts.js";

// Advice uses the player's measured condition, never the loser's result metadata.
export function battleCoach(result, player) {
  const damaged = [...player.structure.parts].sort((a, b) => b.worst - a.worst)[0];
  const lost = result.winner !== "player";
  if (lost && result.reason === "ring_out") {
    return { slot: null, text: "下一局先把轨迹留在场内：靠近边缘时松开外向操控，向内侧回拉，再争夺亮区。" };
  }
  if (damaged?.worst >= 0.35 && (player.structure.imbalance > 0.2 || player.structure.failed || damaged.worst >= 0.65)) {
    const name = PART_TYPE_META[damaged.slot].name;
    return { slot: damaged.slot, text: `你的${name}最重局部损伤 ${Math.round(damaged.worst * 100)}%。先检查该部位的材料与对称性，再去测试室比较平衡；补转不能修复破损。` };
  }
  if (lost && player.stats.zoneSeconds < result.time * 0.12) {
    return { slot: null, text: `本局占区 ${player.stats.zoneSeconds.toFixed(1)} 秒。下一局跟随亮起的 A/B/C 区转移，在场内侧抢位补转，避免只在外圈等待。` };
  }
  if (lost) {
    return { slot: "tip", text: "本局已经参与争区。下一次可从轴尖的摩擦与续航取舍入手，用相同测试条件比较，再回到这场约战。" };
  }
  return { slot: null, text: "这套配置已赢下本局。可以保留配置继续旅程，展开战报查看占区和损伤，作为下一次调整的基准。" };
}
