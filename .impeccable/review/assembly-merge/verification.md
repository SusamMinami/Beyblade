# 原组装界面合并验证

2026-09-24，Web 工作区。只记录本次合并的检查；其他并行改动不由本报告认证。

## 已实现

- `#assembly` 保留原三陀螺切换、五件换装、DIY 与原有纸色／黑字／蓝色控件。
- 发射器和保养成为原组装页中的模式。旧 `#launcher`、`#maintenance` 链接映射到
  `#assembly`，不创建独立页面。保存留在当前模式；撤回恢复陀螺组装。
- 内部模式与房间切换保留草稿；离开组装丢弃未保存草稿。购买、所有权、
  预览／装备边界与保养局部坐标仍沿用既有模型。
- 初始极简底座由实验室共享。第一章完成后推荐童年书桌，第二章完成后使用
  已有 120 XP 下限规则推荐精密实验室。手动场景选择关闭随剧情升级，可以随时选回极简。
- ThreeStage 借用 LabStage 的真实场景及缓存，离开后恢复场景原点与测试对象；
  两者以及陈列室共用一个 WebGLRenderer。

## 本次检查

| 检查 | 结果 |
| --- | --- |
| `npm test` | 53 通过 |
| `npm run build` | 通过；已有约 890 kB Three.js 分包提示 |
| `verify:assembly` | 20 项通过 |
| `verify:launcher-outfit` | 27 组合数值、24 浏览器项通过 |
| `verify:maintenance` | 13 数值、21 浏览器项通过 |
| `verify:home` | 22 项通过 |
| `verify:lab` / `verify:showroom` | 27 / 25 项通过 |
| `verify:worlds` / `verify:launcher` | 31 / 15 项通过 |
| `verify:gpu` / `verify:loading` | 21 / 17 项通过 |
| `verify:flow` | 41 项通过 |

新增组装检查覆盖：原模型点选与 DIY、陀螺切换、同页草稿保留、场景升级与
手动偏好、失败写入回滚、保存后刷新、小屏保存可达、快速跨入口导航、
共享场景／画布归属与返回测试室后对象恢复。`verification.json` 为其逐项结果。
其他运行日志见本目录 `*.log`，换装与保养的明细仍保留在各自检查目录。

## 视觉证据与边界

本目录最终截图：`top-desktop.png`、`diy-desktop.png`、`launcher-desktop.png`、
`launcher-mobile.png`、`care-mobile.png`、`care-small.png`、
`childhood-launcher.png`、`advanced-top.png`、`room-mobile.png`。
桌面 1440×1000、移动 390×844、短屏 320×568。短屏压缩工具栏，控制台可滚动，
场景和保存动作固定。截图等待尺寸调整后的实际绘制；早期黑帧已替换。

单次设计检测的 7 个建议仅涉及原组装已有的蓝色与 3px 圆角未登记进旧 DESIGN，
见 `detector.json`；无需为了沿用旧工作台文档而更换用户要求保留的视觉样式。

独立终审见 [finish-review.md](finish-review.md)。评审要求修复精密房间中的操作提示
对比度，以及新增蓝色选中／保存控件的小号白字。已在一次修复中完成：

- 非极简场景的原位置提示使用紧凑纸色底与深色字，对比度 7.45:1。
- 新增选中／保存控件保留原蓝色，改用深色字，对比度 5.46:1。

修复后重新通过构建和 20 项 `verify:assembly`，重拍并逐张检查全部九张截图；
日志为 `review-fix-build.log`、`review-fix-assembly.log`。
[复评](verdict.md) 的结论为 **ship**，范围仅限两项已评分修复；
九张截图有效，未观察到修复引起的退步。初审和复评由独立通用子代理代替
未安装的专用评审角色完成；原评审没有续接工具，复评使用新代理只评分原问题。
没有追加第二次检测器或重新展开视觉缺陷搜索。

当前入口、场景规则和草稿边界已同步至 Web README、PRODUCT、DESIGN 及其 sidecar、
组装 surface brief，以及 `docs/home_lab_integration.md`、`launcher_runtime.md`、
`maintenance_lubrication_design.md` 和文档索引。旧工作台记录保留为阶段证据。
本次不声称统一组装界面已移植 Godot，也未进行真实设备性能验收。
