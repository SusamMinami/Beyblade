# 独立验收：部件结构面板（task-4 / panel-acceptance）

核对日期：2026-10-28。范围：Web 原型展示层面板、main.js 接线、单测与 verify 脚本。
只读核对；未改源码、存档、模型、权限；QA 输出仅写入本目录。

被验文件 SHA256（前 16 位，冻结于本次核对）
- src/ui/battle-damage-panel.js  D75C8872A92C666D
- src/ui/battle-damage-panel.css 7DC3037016B25DAB
- src/main.js                    165E7A36E0F3788D
- tests/battle-damage-panel.test.js EE30D89FE324B22E
- tools/verify-damage-panel.mjs  C040E8CADFB096C1
- tools/verify-battle-ui.mjs     36F7634F55E5B444
- package.json                   14F87DA4CC8DD1D4

## 实际运行结果（均在 web-prototype 下执行）

| 命令 | 结果 |
| --- | --- |
| `npm test` | PASS：7 文件 / 58 用例（含 battle-damage-panel 5 项） |
| `QA_OUTPUT_DIR=../.impeccable/review/damage-panel-validation npm run verify:damage-panel` | PASS 44，browser errors `[]`（charset 修复前后各跑一次，均 44 PASS） |
| `node tools/verify-structure.mjs`（cwd 置于本目录 structure-isolated-cwd） | PASS 69 |
| `QA_OUTPUT_DIR=.../battle-ui npm run verify:battle-ui` | PASS 20 |
| `QA_OUTPUT_DIR=.../worlds npm run verify:worlds` | PASS 31 |
| `npm run build` | 本次未运行（Lead 已两次遇 esbuild Temp 删除 Access denied；未改权限、未绕过）。生产构建在本轮仍未验收 |

verify:damage-panel 的 browser.json：`{"checks":44,"errors":[],"fixture":{"pristine":"100%","unchanged":true,"expectedHealth":72,"expectedWorst":100,"massLost":true}}`。

## 隔离结论

- `verify:worlds`（tools/verify-worlds.mjs:49）与 `verify:battle-ui`（:5）支持 `QA_OUTPUT_DIR`；后者为本轮刚补，hash 36F7634F…。
- `verify:structure`（tools/verify-structure.mjs:157-158）硬编码 `../.impeccable/review/structure`，但相对 process.cwd 解析；以 cwd 指入本 QA 目录后输出落在本目录内，未覆盖历史证据。
- git 已跟踪的 `.impeccable/review/structure`、`.impeccable/review/worlds` 在运行前后逐文件 SHA256 抽样一致，`git status` 无修改；无历史 QA 目录被写入。

## 静态核对（验收映射）

- 真实五部件八扇区：SLOTS（battle-damage-panel.js:3）与 assembly-calculator.js:56 的五件一致；
  top-structure.js:6/17 `STRUCTURE_SECTORS = 8`；工具断言 5 部件 / 40 扇区（verify-damage-panel.mjs:29-30）在 1440×1000、390×844、390×640、1152×800@1.25 全部通过。
- 平均完整度 vs 局部最重分离：js:17 `health: percent(part.health)`、`worst: max(sectors)`；tests:12-24 断言 90 / 80 / 4 号扇区。
- 不冒充真碎片：js:100 “等效掉块”、js:111 明确“尚无独立飞散碎片”；工具 :81 用真实 BattleSimulation + applyStructuralImpact 验证（72% / 100% / lostMass>0 且文案含“无独立飞散碎片”）。
- 双方隔离 / 新局重置 / 仅运行战斗显示：js:69 `hidden = !visible || phase !== "running"`；js:71-76 更换 simulation 实例即重置 actor/selected/structure；main.js:1857 每局 new BattleSimulation；main.js:2224 传 `screen === "battle"`；main.js:2054 结算同帧隐藏。工具 :84-94 通过。
- 布局：工具 :37-45 断言不溢出、面板在供能 HUD 之下、不遮挡摇杆；四视口通过。全局 `errors` 为空。
- 影响浮标遮挡修复：main.js:2280-2289 在开启状态下面板与 #top-influence 相交时加 `is-hidden`；badge 每帧先按 showInfluence 复位（2272），只在相交帧隐藏，逻辑自洽。
- fixture UTF-8：verify-damage-panel.mjs:55 已含 `<meta charset="utf-8">`（静态确认）。

## 发现

1. 中低：面板内松开转向键可能造成“卡键”持续转向（静态分析，未复现）。
   battle-damage-panel.js:63-65 在面板根节点 `stopPropagation` 掉 keydown/keyup；而 main.js:913-915 只在 window 的 keyup 里 `this.keys.delete(...)`，main.js:1983-1993 用该集合驱动转向。
   复现路径：在赛场按住 A/D/W/S（main.js:906 入集合）→ 用鼠标点面板部件按钮（焦点进入面板）→ 在面板内松开该键 → keyup 被面板拦截 → window 收不到 → 该方向持续满舵，直到窗口失焦（916）、可见性变化（917）、暂停 `_clearBattleInput`（1937）或本局结束。
   建议（由 Lead 决定）：keyup 不拦截，或面板获得焦点时调用 `_clearBattleInput()`。
   说明：本轮未复现——我自建的 probe 在到达该断言前被中断，且 dev server 已停止。
2. 轻微：battle-damage-panel.js:105 设置 `--damage` 自定义属性，样式表中无任何规则消费（仅使用 --damage-sound/light/worn/heavy/critical）。无功能影响。
3. 观察：面板 DOM 顺序（js:3）为核心锁扣→攻击环→配重盘→中轴→轴尖，与 PART_TYPE_META 编号（attackRing 01、coreLock 02；parts.js:10-15）不同。行按 slot 取用（js:50/95），不存在错配；仅为“分层”呈现顺序取舍，请与美术层次意图对齐。
4. 观察：暂停时面板仍可见（js:69 只在 phase !== "running" 时隐藏），但原生 `<dialog>` 模态（main.js:373、1957-1958）会挡住交互，与 docs/structural_battle_design.md:82 的描述一致。若验收把“暂停可达”理解为可操作，则此处不成立，请 Lead 明确口径。

## 未验证 / 中断

- 截图视觉复核未做：本会话模型路由不声明图像输入，我无法读取 PNG；布局结论来自脚本内的几何断言，不是我的目视判断。
- 我自建的独立 probe（probe/panel-probe.mjs）在暂停/结算段断言处被中断，未写出 probe.json：**中断，不计通过也不计失败**，其早前键盘段结果同样无留存证据。
- 我临时启动的 vite（127.0.0.1:5173）现已停止，端口拒绝连接；后续复跑需重新启动。
- `npm run build` 未由我执行。

## 结论

按本轮可运行证据：面板实现与验收项 **通过**（结构数据、平均/局部分离、等效掉块口径、双方隔离、新局重置、显示生命周期、四视口布局、无浏览器报错）；键盘卡键为待确认的中低危边界，附行号与建议修复。

