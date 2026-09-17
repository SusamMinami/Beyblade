import { compareBuilds } from "../core/growth-state.js";

const html = value => String(value).replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function renderBuildComparison(previous, current) {
  const comparison = compareBuilds(previous, current);
  if (!comparison) return '<p>还没有这枚陀螺的出战记录。完成一场比赛后，这里会留下改装前后的参照。</p>';
  return `<p>${comparison.changes.length ? comparison.changes.map(html).join("<br>") : "零件与 DIY 和上次出战一致，可以先尝试改变操作路线。"}</p>
    <table class="build-comparison"><caption>同一出战槽 · 理论评分（0–100）</caption>
      <thead><tr><th scope="col">属性</th><th scope="col">上次</th><th scope="col">当前</th><th scope="col">变化</th></tr></thead>
      <tbody>${comparison.ratings.map(row => `<tr><th scope="row">${row.name}</th><td>${row.before}</td><td>${row.after}</td><td>${row.delta > 0 ? "+" : ""}${row.delta}</td></tr>`).join("")}</tbody>
    </table><p class="comparison-note">同一计算模型下的配置取舍，不代表实战必胜；地图、发射和操控也会影响结果。</p>`;
}

export function buildChangeSummary(previous, current) {
  const comparison = compareBuilds(previous, current);
  if (!comparison) return "完成一场比赛，就能留下这枚陀螺的对照记录。";
  if (!comparison.changes.length) return "当前配置与上次出战一致，先试着改变操作路线。";
  return comparison.ratings.filter(row => row.delta).map(row =>
    `${row.name} ${row.delta > 0 ? "+" : ""}${row.delta}`).join(" · ") || "配置已改变，五项评分四舍五入后相同。";
}
