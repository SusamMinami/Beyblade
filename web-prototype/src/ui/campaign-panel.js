import { CAMPAIGN_CHAPTERS, CAMPAIGN_MISSIONS, getMission } from "../data/campaign.js";
import { canPlayMission, nextMission } from "../core/campaign-state.js";
import { getPart } from "../data/parts.js";
import { getArena } from "../data/arenas.js";
import "./campaign.css";
import { opponentIdentity } from "../data/opponent-identities.js";
import { PART_MATERIALS } from "../core/part-customization.js";
import { renderBuildComparison } from "./build-comparison.js";
import { unlockedChapterMoments } from "../data/chapter-moments.js";

const html = (value) => String(value).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function renderCampaign(app) {
  const { campaign } = app.state;
  const mission = getMission(app.viewMissionId) ?? nextMission(campaign) ?? CAMPAIGN_MISSIONS.at(-1);
  app.viewMissionId = mission.id;
  const chapter = CAMPAIGN_CHAPTERS.find((item) => item.id === mission.chapter);
  const index = CAMPAIGN_MISSIONS.indexOf(mission);
  const playable = canPlayMission(campaign, mission.id);
  const completed = campaign.completed.includes(mission.id);
  const part = getPart(mission.suggestion);
  const owned = app.state.ownedPartIds.includes(part.id);
  const unlocked = campaign.completed.length === CAMPAIGN_MISSIONS.length;
  const loadout = app.state.loadouts[app.state.activeLoadoutIndex];
  const journal = [...campaign.journal].reverse();
  const tutorialReady = app.state.tutorial.completed;
  const identity = opponentIdentity(mission);
  const ringDIY = identity.customizations[mission.enemyBuild.attackRing];
  const moments = unlockedChapterMoments(campaign);

  app.root.querySelector("#campaign-panel").innerHTML = `
    <div class="journey-heading"><h1>回声远征</h1><span>${campaign.completed.length} / 10 旅途纪念</span></div>
    ${unlocked ? '<p class="journey-ending">远征完成。明天，老地方。已通关章节仍可重打，补齐选做挑战。</p>' : ""}
    <label class="journey-select">旅程
      <select id="mission-select" aria-label="选择远征任务">
        ${CAMPAIGN_MISSIONS.map((item, i) => `<option value="${item.id}" ${item.id === mission.id ? "selected" : ""}>${i + 1}. ${item.title} · ${campaign.completed.includes(item.id) ? "已完成" : canPlayMission(campaign, item.id) ? "可挑战" : "未开放"}</option>`).join("")}
      </select>
    </label>
    <p class="journey-place">第 ${Math.floor(index / 2) + 1} 章 · ${chapter.name} / ${getArena(mission.arenaId).shortName}</p>
    <h2>${mission.title}</h2>
    <div class="journey-opponent"><strong>${mission.opponent}</strong><span>${mission.topName} · ${mission.role}</span></div>
    <div class="journey-objective"><b>${completed ? "已完成" : "本局目标"}</b><span>${mission.objectiveLabel}</span></div>
    <div class="journey-prep"><span>出战：${html(loadout.name)}</span><button class="journey-link" data-go="assembly">改装</button><button class="journey-link" data-go="lab">测试</button><button class="journey-link" data-go="collection">换陀螺</button></div>
    <p class="journey-challenge">${campaign.mastered.includes(mission.id) ? "挑战已达成" : "选做挑战"}：${mission.challenge.label}（不阻塞主线）</p>
    ${!playable ? `<p class="journey-lock">先完成「${CAMPAIGN_MISSIONS[index - 1].title}」才能出战。现在仅预览。</p>` : ""}
    ${!tutorialReady ? '<p class="journey-lock">先完成新手训练，或点击下方跳过引导，再开始远征。</p><button class="journey-link" data-journey-action="tutorial">继续新手训练</button><button class="journey-link" data-journey-action="skip">跳过引导，开始远征</button>' : ""}
    <details class="journey-story">
      <summary>约战缘由 · ${mission.opponent}</summary>
      <p>${chapter.stakes}</p>
      <p>${mission.intro}</p>
      <p class="journey-identity">${identity.description}</p>
      <blockquote>${mission.quote}</blockquote>
    </details>
    <details class="journey-intel">
      <summary>对手情报与改装建议</summary>
      <p>${mission.tactic}</p>
      <p>加速区轮换开放，对手会主动抢位。将对手撞出亮区可独享补转；局部破损会持续影响平衡。</p>
      <p>对手外环 DIY：${PART_MATERIALS[ringDIY.material].name} · 尺寸 ${ringDIY.size.toFixed(2)}× · 厚度 ${ringDIY.height.toFixed(2)}× · ${ringDIY.symmetry} 向轮廓。</p>
      <p>可考虑：${part.name} · ${owned ? "已拥有" : `${part.price} 金币 / ${app.state.coins >= part.price ? "当前可购买" : `还差 ${part.price - app.state.coins} 金币`}`}。这不是出战要求。</p>
      <p class="journey-parts">对手零件：${Object.values(mission.enemyBuild).map((id) => getPart(id).name).join("、")}。</p>
    </details>
    <details class="comparison-disclosure journey-comparison">
      <summary>这次配置与上次出战相比</summary>
      ${renderBuildComparison(app.state.battleNotes[loadout.id], loadout)}
    </details>
    <details class="journey-moments">
      <summary>同行人的回信 · ${moments.length} / 5</summary>
      ${moments.length ? moments.map(moment => `<article><h3>${moment.speaker} · ${moment.title}</h3><p>${moment.text}</p></article>`).join("") :
        "<p>完成一章后，同行人的回应会留在这里。先从眼前这场约战开始。</p>"}
    </details>
    <details class="journey-log">
      <summary>旅途纪念与战历 · ${campaign.journal.length} 场记录</summary>
      <p>首次完成获得纪念；胜利 120 / 失败 40 金币，无额外首通金币。</p>
      ${campaign.completed.length ? `<ul>${campaign.completed.map((id) => `<li>${getMission(id).memory}</li>`).join("")}</ul>` : "<p>还没有旅途纪念。第一场胜负均可，先让它转起来。</p>"}
      ${journal.length ? `<ol>${journal.map((entry) => {
        const encounter = getMission(entry.missionId);
        return `<li><b>${html(entry.loadoutName)} 对 ${encounter.opponent} · ${entry.winner === "player" ? "胜" : entry.winner === "draw" ? "平" : "负"}</b><span>${getArena(encounter.arenaId).shortName} · ${entry.time.toFixed(1)} 秒</span><small>${Object.values(entry.build).map((id) => getPart(id)?.name ?? "").join(" / ")}</small></li>`;
      }).join("")}</ol>` : "<p>完成的主线对战会记录在这里，保留最近 40 场。</p>"}
    </details>
  `;
  const button = app.root.querySelector("#start-battle");
  button.disabled = !playable || !tutorialReady;
  button.textContent = !tutorialReady ? "先完成或跳过引导" : !playable ? "完成前置任务后开放" :
    `${completed ? "再战" : "挑战"}${mission.opponent} →`;
}
