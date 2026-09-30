# 文档导航与维护

最后核对：2026-09-24。当前优先开发 **Web 原型**；共享物理 v6 已完成 Godot 本地战斗接入。

## 接手顺序

1. [协作约定](../AGENTS.md)：开发顺序、数据边界和检查要求。
2. [Web 使用与开发指南](../web-prototype/README.md)：启动、路由、功能和存档。
3. 按任务阅读下表中的专题；只有追溯旧决策时才读历史交接。

用户的新指令优先于旧文档。代码用于核实已实现行为；设计草案不能证明功能已完成。
发现代码与有效约定不一致时，应记录差异，不自动把任意一方改成另一方。

## 按任务查找

| 任务 | 主文档 | 用途与边界 |
| --- | --- | --- |
| 项目概览 | [根 README](../README.md) | 项目定位、入口；后半部分保留早期设计背景 |
| Web 开发与运行 | [Web README](../web-prototype/README.md) | 当前操作、存档、检查命令 |
| Web 视觉与交互 | [Web DESIGN](../web-prototype/DESIGN.md) | 当前配色、布局、动态、减少动态效果 |
| 任务、宿敌与成长故事 | [回声远征](campaign_direction.md) | 原任务线诊断、五章十战、人物关系、实现边界与后续提案 |
| 游戏流程、约战准备与暂停 | [流程优化](game_flow_optimization.md) | 流程诊断、返回原任务、结算建议和中断恢复；后续提案单列 |
| 新手训练、改装对比与章节回应 | [第二轮流程优化](game_flow_round2.md) | 分阶段操作提示、真实参赛配置快照、章节回信及验证边界 |
| 战斗场景与模型 | [battle_worlds](battle_worlds.md) | Blender 源文件、导出、地图与碰撞 |
| 发射器换装、释放与数值 | [Web 运行时](launcher_runtime.md) | 当前入口、九件混搭、金币／草稿边界、自由换色、机构联动、有限能量与验证 |
| 发射器模块与换色设计 | [模块拆分研究](launcher_modularity.md) | 八模块源模型与配色区域；历史设计依据 |
| 发射器性能部件设计 | [首批九款部件](launcher_performance_parts.md) | 齿条、芯组、连接头模型与共用接口；可复用爆炸结构与历史取舍 |
| 发射器与陀螺保养 | [保养实现与后续研究](maintenance_lubrication_design.md) | Web 已接入直接涂抹/擦拭、传动润滑、握柄打滑、轴尖抓地及固定输入对照；内部活动件后续补齐 |
| 原组装、场景成长与共享实验室 | [主页与实验室整合](home_lab_integration.md) | 同页换装与保养、极简起步与分章升级、既有 XP 门槛、手动偏好、共享场景与草稿边界 |
| 场景加载与切换性能 | [加载诊断与优化](scene_loading_performance.md) | 首帧测量、按需加载、缓存边界与验证结果 |
| 展览厅原始方向 | [showroom-direction](test_lab/showroom-direction.md) | 参考方向与升降约束；实现细节以 Web DESIGN 为准 |
| 数值与单位 | [参数基线](top_part_physics_baseline.md) | 15 个零件、DIY、平行轴惯量、游戏平衡单位 |
| 物理反馈与 Web v5 | [前两轮实现](physics_v5_implementation.md) | 相机输入、姿态、平局、测量评分、惯量耗散、接地与旋转接触；原检查见 [诊断](physics_simulation_review_20260923.md) |
| 共享物理 v6 与 Godot 移植 | [第三轮实现](physics_v6_implementation.md) | 连续地形／低边沿、实际支点高度、接触子步、完整恢复、原生场景与手感；附移植边界 |
| 结构损伤、加速区与对手形象 | [Web v4 战斗设计](structural_battle_design.md) | 局部受损、失衡停转、轮换供能、AI 争夺及近似边界 |
| 跨端模拟 | [确定性同步](deterministic_battle_sync.md) | 版本差异、共有契约与移植验收 |
| Godot 实验室 | [资产与运行](test_lab/README.md)、[视觉规范](test_lab/DESIGN.md) | 保留的 Godot 精密实验室，不约束 Web 新功能 |
| Godot 局部损伤 | [碰撞测试交接](collision_damage_test_handoff.md) | Jolt 实验与正式求解器的职责边界 |
| 音效制作 | [audio-lab](../tools/audio-lab/README.md) | 独立 Tone.js 工具、WAV 导出 |
| PVP 产品与权威结算 | [network_pvp_architecture](network_pvp_architecture.md) | 长期设计；产品未决项仍需定案 |
| PVP 模式与迁移 | [hybrid_pvp_architecture](hybrid_pvp_architecture.md) | 三层架构提案、当前代码状态、待验收项 |
| Worker 本地开发 | [服务 README](../scripts/server/cf_worker/README.md) | 当前端点、二进制协议、部署限制 |
| Godot 编辑器接入 | [MCP 说明](godot_ai_mcp_setup.md) | 可选背景；未锁定插件，不是可直接执行的安装方案 |

## 运行与检查

在仓库根目录的终端启动：

```powershell
cd web-prototype
npm ci
npm run dev
```

在另一个终端进入 `web-prototype/` 执行 `npm test` 和 `npm run build`。
按修改范围补充浏览器检查：

| 修改范围 | 命令 |
| --- | --- |
| 原组装、工具模式、场景切换与草稿 | `npm run verify:assembly` |
| 实验室、报告、经验、商店 | `npm run verify:lab` |
| 陈列室、升降、舞台、风场 | `npm run verify:showroom` |
| 开场、剧情场景升级、组装共享实验室 | `npm run verify:home` |
| 战斗场景、障碍碰撞、近景交互 | `npm run verify:worlds` |
| 发射器模型、卡口定位、下载与资源回收 | `npm run verify:launcher`、`npm run verify:gpu` |
| 发射器换装、所有权、释放与性能 | `npm run verify:launcher-outfit`、`npm run verify:maintenance` |
| 直接模型保养、油膜存档与发射/抓地 | `npm run verify:maintenance`（数值与隔离浏览器） |
| 街头/遗迹材质、反光与局部照明 | `npm run verify:materials` |
| 冠军场模型、移动灯光、日夜与资源释放 | `npm run verify:championship` |
| 场景加载、缓存与异步切换 | `npm run verify:loading`、`npm run measure:loading -- <记录名>` |
| 下一场材质预热与首次 GPU 准备 | `npm run verify:gpu`、`npm run measure:gpu -- <记录名>` |
| 街头比例、日夜、积水反射与环境资源 | `node tools/verify-street.mjs` |
| 故事任务、过关结算、战历与远征入口 | `npm run verify:campaign` |
| 跨页面约战准备、暂停退出与结算建议 | `npm run verify:flow` |
| 两场新手训练、改装参照与章节回信 | `npm run verify:growth` |
| 结构损伤、供能、AI 与战斗反馈 | `npm run verify:structure`、`npm run verify:battle-ui` |
| 物理姿态、发射预览、音频隔离与平局 | `npm test`、`npm run verify:physics` |
| 共享 v6 地形、支点、恢复及跨端金标 | `npm run verify:physics-v6`，随后 Godot 运行 `tests/battle/physics_v6_parity.gd`、`physics_v6_scene.gd` |

浏览器检查需要开发服务器和 Chrome，使用隔离存档。`verify:structure` 为纯数值检查，无需浏览器。
上述脚本均支持 `CHROME_PATH` 与 `LAB_TEST_URL`，后者填写源地址（默认
`http://127.0.0.1:5173`，不带 `#lab` 等路由）。
旧检查报告是对应交付时的证据，不代表当前工作区已重新通过检查。

## 历史记录

- [20260716 交接](ai_handoff_20260716.md)：早期确定性同步，正文更新至 7 月 19 日。
- [20260719 交接](ai_handoff_20260719.md)：Web 直接操作、经济和 DIY，正文更新至 7 月 21 日。
- [20260721 交接](ai_handoff_20260721.md)：当时的跨端对齐与 PVP 规划。
- [Godot 实验室评审](../.impeccable/review/finish-review.md)、
  [Web 实验室评审](../.impeccable/review/web/finish-review.md)、
  [舞台评审](../.impeccable/review/showroom/finish-review.md)、
  [场景检查](../.impeccable/review/worlds/verification.md)：阶段证据，保留原结论与适用范围。

这些文件原位保留，避免破坏旧引用。历史交接里的“下一步”“全部完成”仅代表当时判断。
本次逐文件盘点见 [文档整理记录](documentation_audit_20260916.md)。

## 后续维护方式

- 启动与操作写 Web README；视觉规则写 Web DESIGN；模型与碰撞写 battle_worlds；
  数值写参数基线；版本兼容写确定性同步。其他入口用链接引用，不复制整段说明。
- 活跃专题注明适用端、核对日期；区分“已实现”“设计目标”“未验证”。
- 发生规则或协议变更时同时记录版本边界。Web 与 Godot 未对齐时明确列出差异，
  不通过只改版本字符串宣称兼容。
- 一次性交付结果放评审记录，不持续追加到旧交接。默认接手无需读取全部历史。
- 项目内 Markdown 链接使用相对路径；本机软件路径仅作示例。
- 外部插件、云套餐、配额和费用必须注明核实日期与官方来源；未核实就标待核实。
