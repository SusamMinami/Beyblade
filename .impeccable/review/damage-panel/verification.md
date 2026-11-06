# 部件结构面板与 Blender MCP — 本轮交付

核对日期：2026-10-28。范围仅 Web 原型展示层与用户级 MCP 安装；未改求解器、库存、经济、网络或项目模型资产，未提交／发布。

## 已改

- 五部件 × 八本体方向的实时损伤读图，自己／对手切换、零件选中与真实配置名。
- 平均完整度与最重局部损伤分列，显示已有等效掉块及结构失衡，不声称已有独立碎片。
- 折叠摘要、键盘焦点、短屏滚动、结算即时隐藏；控制影响浮标与面板相交时隐藏，摇杆读数保留。
- 主入口按原 HUD 节流驱动，结构 revision 未变时不重绘内容。
- 增加单测与 `verify:damage-panel`；原 `verify:battle-ui` 新增 QA_OUTPUT_DIR 隔离能力。

## Lead 已测

- `npm test`：7 文件、58 项通过（新增 5 项）。
- `npm run verify:damage-panel`：最终 45 项通过，包含 1440×1000、390×844、390×640、1152×800@1.25。
  新增最后一项回归：面板 keydown 不触发转向，keyup 必须到达 window，避免从赛场按住转向再点面板后卡键。
- 独立 verifier：单测 58、面板 44（键盘修复前）、`verify:structure` 69、`verify:battle-ui` 20、`verify:worlds` 31 均通过。
  其报告见 [panel-acceptance](../damage-panel-validation/panel-acceptance.md)。独立发现的卡键问题已由 Lead 修复并用最终第45项浏览器回归覆盖。
  verifier 自建暂停／结算 probe 中断，不算通过或失败；现有正式 battle-ui 20 项已完成。
  最终截图与 [browser.json](../damage-panel-final/browser.json) 位于 [damage-panel-final](../damage-panel-final/)。
- `git diff --check`：通过。
- `npm run build`：**未通过**。重试两次，均在 vite esbuild-transpile 的 Windows Temp 临时文件删除阶段报 Access is denied。
  没有修改 Windows 文件权限、升级依赖或通过更换临时目录绕过；不宣称生产构建已验收。

## 模型能力

现有 Web 陀螺是程序化五件结构，不是 GLB。部件可独立展开／脱开，但内部按材质合并；损伤只有顶点压瘪、变色、粗糙化。
缺口、内断面、对应飞散碎块均未实现。下一步应将八方向与封闭碎块对应，逐级表现 lostMass，保留原确定性物理，碎块先仅为有预算的视觉对象。
详见 [当前专题](../../../docs/structural_battle_design.md#部件状态面板与模型破碎边界2026-10-28)。

## Blender MCP

- 沿用本机 Blender 5.2 与已装官方 add-on 1.0.3；未覆盖 Blender 或另装竞争第三方插件。
- 从 Blender Lab 官方 1.0.3 发布安装独立服务端与 Python 3.11 venv，生成依赖 lock。
- 用户 home Cordis patch 已写入并用 safe_load 回读校验；使用 `python -m blmcp`、loopback 9876。
- 独立 MCP 客户端 initialize/list_tools 成功（26 工具），get_objects_summary 返回 Camera/Cube/Light，isError=false。
- 当前会话的 Blender MCP 原生只读工具也成功读取干净场景及未保存／未改动状态。
- 持久 patch 尚未在重启后的 DSH 会话验收；没有擅自重启 DSH。Blender 必须运行并启动桥接，不保存自动启动偏好。
- 官方明确警告：可执行任意 Python，非安全沙箱，仅监听回环，不暴露公网。

## 证据来源

本目录截图由 Playwright + Chrome 从本机实际 Web 原型生成，不使用参考图冒充成品。
`directed-damage.png` 使用同一真实 BattleSimulation 与 applyStructuralImpact 的受控连续定向载荷；不是自然对局统计。
游戏截图包括展开／折叠的桌面、手机、短屏及 DPI 画面。
独立验证结果位于相邻 [damage-panel-validation](../damage-panel-validation/)；最终结果以该次报告为准。
