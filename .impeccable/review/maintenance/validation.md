# 保养首期验收

2026-09-24。范围：自由模型涂油/擦拭，传动效率、握持阈值、轴尖接地，
草稿存档、固定输入试验与下一场对战接入。

## 已通过

- `npm test`：最终本轮可见输出为 53 项，包含同期 Web v5 动力学测试。
- `npm run build`：生产构建通过；保留既有 Three.js 大包提示。
- `node tools/verify-maintenance-physics.mjs`：13 项因果检查，包括有限能量、
  过量反转、握持阈值、外壳无收益、正反面擦拭、数量上限、存档隔离、
  普通及显式发射、真实地面滑行。
- `node tools/verify-maintenance.mjs`：初轮 19 项；同期换装接入后的最终检查
  为 21 项，追加实际鼠标擦拭和组装页入口验证。记录在
  [current/verification.json](current/verification.json)；
  [当前浏览器输出](current-browser.log)。
- 三次退出后 GPU 计数均为 geometry 60 / texture 3。
- `verify:structure` 69、`verify:worlds` 31、`verify:lab` 27、
  `verify:showroom` 25；`verify:launcher`、`verify:gpu` 通过记录也已生成。
  这些是各自运行时工作区的结果，不代表覆盖随后发生的所有并行改动。
- [视觉复核](finish-review.md)：保养基线 `ship`。未能发现可创建子代理的工具，
  按技能降级契约在当前会话内替代复核；不宣称独立评审。

## 证据边界

本工作区同时有发射器换装、战斗动力学、场景美术等独立改动。
保养最终脚本已在换装合入后的代码上通过，保留原来基线截图，
追加的当前截图位于 `current/`。换装经济、部件升级和释放演示需要其自己的
专项验收；保养的通过结果不能替代这些验收。

保养数值使用游戏平衡单位和降阶接触模型。没有实物摩擦系数标定、
流体模拟、独立关节轴承、油污迁移或长期磨损。
Godot 与外部对局协议不在本次实现范围。
