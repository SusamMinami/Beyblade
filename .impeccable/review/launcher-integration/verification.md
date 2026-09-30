# 发射器接入验收 · 2026-09-24

适用范围：当前 Web 工作区。隔离 Chrome 存档，不修改玩家实际存档。
现有其他并行工作保留；下面仅列本次实际运行的检查。

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| `npm test` | 53 项通过 | [tests.log](tests.log) |
| `npm run build` | 通过；保留 Three.js 大分块提示 | [build.log](build.log) |
| 27 种发射器组合、真实负载与油膜 | 通过能量账本、旧基线、普通／量化发射、所有权及油膜隔离 | [physics.json](physics.json) |
| `npm run verify:launcher-outfit` | 24 项浏览器契约通过 | [browser.json](browser.json)、[日志](review-fixes-check.log) |
| `npm run verify:launcher` | 15 项通过 | [日志](launcher-check.log)、[报告](../launcher/verification.json) |
| 保养数值 | 13 项通过 | [maintenance-physics.log](maintenance-physics.log) |
| 保养实际操作／回收 | 通过 | [maintenance-check.log](maintenance-check.log) |
| `npm run verify:lab` | 27 项通过 | [lab-check.log](lab-check.log) |
| `npm run verify:worlds` | 31 项通过 | [检查范围与场景截图](../worlds/verification.md)；本次命令返回 `PASS: 31` |
| `npm run verify:gpu` | 21 项通过 | [报告](../gpu-preparation/verification.json) |
| Blender 重导入、齿比、27 组接口及动作节点 | 通过 | [日志](blender-check.log)、[几何报告](../../../docs/assets/launcher-performance/validation.json) |

独立 UI 审读列出 F1 跨模式草稿提示、F2 键盘焦点保持、F3 选中态焦点三项，
已加入实际 Tab／Enter、中心滴油和双向模式切换检查。
审读及修复复核保存在同目录 `finish-review.md` 与 `verdict.md`。
复核结果：F1／F2／F3 均为 resolved，`disposition: ship`；
该复核只对列出的三项修复评分，不扩大为未检查范围的认证。

截图：[桌面](desktop.png)、[手机](mobile.png)、[红黑换装](outfit-red.png)、
[手机选中焦点](mobile-focus.png)、[手机跨模式草稿](mobile-dirty.png)。
后两张分别展示零件近景及滚动到底部的草稿与保存区。
游戏没有新增网页图片资源；截图只是检查产物，模型由项目 Blender 脚本生成。

边界：机构是运动学联动，数值是有限能量近似；未模拟机械接触力、真实变形、
制造公差或弹簧回位。Godot 和外部网络权威服务未在本次迁移。
