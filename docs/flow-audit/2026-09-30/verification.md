# 文档整理与流程修复验证

日期：2026-09-30。目标：当前 Web 原型；保留既有物理、价格、库存、经验与美术。
当前设计与后续任务见[流程说明](../../game_flow_optimization.md)，删除去向见
[文档整理记录](../../documentation_audit.md)。

## 已完成的修复

1. `tutorialAfterEquip` 统一陀螺/实验室商店与发射器保存后的教学推进。
   只认实际装备的已拥有付费件，发射器保存失败回滚教学与装备、保留草稿。
   已保存升级却卡在购买阶段的旧档可恢复。第二战文案显示实际发射器型号。
2. 发射器和保养固定底栏补齐返回同一约战/训练，保存留当前工具。
   未保存状态说明离开后放弃；已完成购买保留。
3. 陀螺三卡与底栏分行；手机顶部保留可见中文导航与44px目标，
   顶部“对战”接上真实准备路径。蓝色主按钮使用深色文字。
4. 极简实验室近景与俯视显示实际配置读数，通知消失后仍可查看。
   工具改成2×2布局，帮助不再被风场拦截，短屏读数避开工具标签。
   极简房间标题、经验及工具使用深色文字，工具和经验至少12px。

不新增独立换装页、平行库存或存档格式，不移植此次 Web UI 至 Godot，
不部署网络服务，不修改战斗平衡。

## 验证结果

均在 `web-prototype/` 执行。Chrome 隔离上下文，不使用玩家存档；
服务器为既有 `http://127.0.0.1:5173`，保持运行。
截图和输出使用 `QA_OUTPUT_DIR` 指向本目录，旧交付截图未覆盖。

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| `npm test` | 53 通过 / 6 文件 | [日志](unit.log) |
| `npm run build` | 通过 | [日志](build.log) |
| `npm run verify:continuity` | 69 通过 | [明细](after/verification.json)、[日志](continuity.log) |
| `npm run verify:growth` | 57 通过；两场真实教学、改装、弃赛与章节回信 | [日志](growth.log) |
| `npm run verify:flow` | 41 通过；约战、刷新、锁定、暂停与真实结算 | [日志](flow.log) |
| `npm run verify:assembly` | 20 通过；草稿、房间、原 DIY、渲染器归还 | [日志](assembly.log) |
| `npm run verify:lab` | 27 通过；报告、经验、设置、商店与导出 | [日志](lab.log) |
| `npm run verify:maintenance` | 13 数值 + 21 浏览器通过 | [日志](maintenance.log)、[浏览器明细](regression/maintenance/verification.json) |
| `npm run verify:launcher-outfit` | 4 性能契约/27 组合 + 24 浏览器通过 | [日志](launcher.log) |
| `npm run verify:showroom` | 25 通过 | [日志](showroom.log) |
| `npm run verify:worlds` | 31 通过 | [日志](worlds.log) |

构建保留现有 Three.js 约890kB分块提示，没有构建错误。
实验室第一次批量运行在切换环境后等待完成超时；独立复跑27项通过，
未复现为确定产品故障。验证脚本补充失败截图/状态输出，并修正超时参数位置。
早期短屏命中检查早于重排，等待两帧并截图后再检查，最终三尺寸全部通过。

新增连续性脚本专门覆盖：180币买R03归零、未拥有预览保存、购买失败、
购买后撤回、再次装备、保存失败、保存成功、刷新、旧档恢复、返回第二训练、
约战重打目标、草稿放弃、帮助指针操作及真实读数持续可见。
该脚本不伪造一次战斗胜利；两场教学和剧情真实结算分别由 growth/flow 覆盖。

## 前后对比

- [实验室默认读数与帮助布局](comparison-lab.png)：
  [修复前](before-b/confirm-lab-front-result-mobile.png) / [修复后](after/lab-390.png)。
- [零件卡片与底栏](comparison-parts.png)：
  [修复前](before-a/15-zero-budget-and-card-overlap-mobile.png) / [修复后](after/parts-390.png)。
  两张使用不同训练阶段/余额，只比较布局，不作为数值变化证据。
- 工具：[手机发射器](after/outfit-390.png)、[短屏保养](after/care-320.png)、
  [短屏实验室](after/lab-320.png)、[桌面组装](after/parts-1440.png)。

双独立评估：A `8e376cb8-227a-486e-b2be-16502b375b0c`；
B `07b63b9e-603b-4b68-b081-b230ad15722b`。A 完成后才合并 B。
[评估快照](../../../.impeccable/critique/2026-09-30T14-16-09Z__web-prototype-src-main-js.md)
为修复前24/40，不是修复后重新评分。
[B 完整证据](before-b/findings.md)记录 CLI 0 条和浏览器335次规则提示；
后者包含隐藏SPA、重复项与排除项，不等于335个缺陷。

视觉按390×844、320×568、1440×1000成组检查；收敛短屏标签间距后确认一次。
未宣称实体手机/Safari性能、200%文字缩放完整可用、人类学习效率、
全难度通关、所有未来系统或 Godot UI 移植完成。
