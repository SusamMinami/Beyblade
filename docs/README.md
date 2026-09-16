# 文档导航与维护

最后核对：2026-09-16。当前开发目标是 **Web 原型**，验收后再移植 Godot。

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
| 战斗场景与模型 | [battle_worlds](battle_worlds.md) | Blender 源文件、导出、地图与碰撞 |
| 展览厅原始方向 | [showroom-direction](test_lab/showroom-direction.md) | 参考方向与升降约束；实现细节以 Web DESIGN 为准 |
| 数值与单位 | [参数基线](top_part_physics_baseline.md) | 15 个零件、DIY、平行轴惯量、游戏平衡单位 |
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
| 实验室、报告、经验、商店 | `npm run verify:lab` |
| 陈列室、升降、舞台、风场 | `npm run verify:showroom` |
| 战斗场景、障碍碰撞、近景交互 | `npm run verify:worlds` |
| 冠军场模型、移动灯光、日夜与资源释放 | `npm run verify:championship` |
| 街头比例、日夜、积水反射与环境资源 | `node tools/verify-street.mjs` |
| 故事任务、过关结算、战历与远征入口 | `npm run verify:campaign` |
| 结构损伤、供能、AI 与战斗反馈 | `npm run verify:structure`、`npm run verify:battle-ui` |

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
