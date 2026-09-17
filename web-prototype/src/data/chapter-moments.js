import { CAMPAIGN_MISSIONS } from "./campaign.js";

// These are narrative replies, unlocked by existing chapter-completion facts.
export const CHAPTER_MOMENTS = Object.freeze([
  { missionId: "rival-arrives", speaker: "阿砾", title: "工具盒上的第二个位置", nextLabel: "前往修理铺",
    text: "阿砾把签过名的工具盒推回来：“给下一位帮你的人留个位置吧。”他指向街角亮着灯的修理铺。阿岑愿意看看这枚一直没有被扔掉的陀螺。" },
  { missionId: "choose-a-line", speaker: "阿岑", title: "带着自己的答案上场", nextLabel: "前往资格赛",
    text: "阿岑合上工具箱：“下次别急着问哪件更贵，先问你想让它怎么转。”推荐信夹着两张试盘记录。公开资格赛的厂牌栏，还等着你去填写。" },
  { missionId: "rival-rematch", speaker: "罗彻", title: "地图背面的旧约定", nextLabel: "前往旧赛场",
    text: "罗彻把旧地图翻过来，背面是你们小时候画的玩具盘：“别以为我忘了。”他先一步去了遗迹。守场人闻舟手里的旧赛册，也许能解释自制赛的过去。" },
  { missionId: "rival-without-badge", speaker: "闻舟", title: "把这一页带回去", nextLabel: "前往公开赛",
    text: "闻舟把旧赛册装进纸袋：“规则是让更多人站上来，不是让他们低下头。”罗彻在台阶下等你。下一站，你们要把自制陀螺的资格带回公开赛。" },
  { missionId: "our-names", speaker: "阿砾", title: "明天的第一场", nextLabel: "回看旅途纪念",
    text: "阿砾把工具盒摆在巷口，签名已经挤满了盖子：“冠军，明天你可别迟到。”罗彻蹲下来扶正玩具盘。这一次，没有人再问它属于哪个厂牌。" },
]);

export const chapterMoment = id => CHAPTER_MOMENTS.find(moment => moment.missionId === id);
export const unlockedChapterMoments = campaign => CHAPTER_MOMENTS.filter(moment =>
  campaign.completed.includes(moment.missionId));
export function chapterNextMission(id) {
  return CAMPAIGN_MISSIONS[CAMPAIGN_MISSIONS.findIndex(mission => mission.id === id) + 1] ?? null;
}
