# 文档整理记录

日期：2026-09-30。范围：项目自身 Markdown，包括根目录、`docs/`、Web 指南、
设计约定、隐藏评审目录、Worker 与音效工具说明。第三方插件、依赖、
缓存和构建产物不纳入删除范围。

依据当前工作区源码、配置与既有验证记录核对；已有未提交实现保留。
当前文档入口是 [README](README.md)，当前流程工作是
[游戏流程](game_flow_optimization.md)。不再维护按轮次串联的待办入口。

## 已删除的九份文档

删除前迁出仍有效的约定；不留下只有转跳内容的空壳文档。
下表旧路径仅用于记录去向，不是有效链接。

| 删除文件 | 原问题 | 有效信息去向 |
| --- | --- | --- |
| `docs/ai_handoff_20260716.md` | 7 月规则/入口/后续建议已被新版覆盖 | [同步契约](deterministic_battle_sync.md)、[v6](physics_v6_implementation.md) |
| `docs/ai_handoff_20260719.md` | 重复描述组装、经济与教学，旧版全量对齐结论失效 | [Web 指南](../web-prototype/README.md)、[流程](game_flow_optimization.md) |
| `docs/ai_handoff_20260721.md` | PVP 默认排期、旧协议、未接会话等已过时 | [PVP](network_pvp_architecture.md)，保留已确认产品方向 |
| `docs/documentation_audit_20260916.md` | 旧盘点数量与待办不能表示现状 | 本记录；维护约定进入文档导航 |
| `docs/game_flow_round2.md` | 轮次文档导致同一流程分散维护 | [流程](game_flow_optimization.md)，保留训练/对比/回信契约及历史证据链接 |
| `docs/hybrid_pvp_architecture.md` | 与产品架构重复，缺失恢复 API 的说法已失效，旧 JSON 设计易被误用 | [PVP](network_pvp_architecture.md)，统一实现矩阵、三层职责与接入次序 |
| `docs/godot_ai_mcp_setup.md` | 泛化候选安装稿与已包含且启用的插件不符 | [本地插件 README](../addons/godot_ai/README.md)、根 README |
| `docs/collision_damage_test_handoff.md` | 将旧总耐久表现当成当前原生战斗 | [v6 分层](physics_v6_implementation.md#godot-的实现分层)，保留 Jolt 实验职责与检查入口 |
| `docs/test_lab/showroom-direction.md` | 升降、锁定预览和风场规则已在正式规范完整维护 | [Web DESIGN](../web-prototype/DESIGN.md)、[AGENTS](../AGENTS.md) |

## 当前指南的处理

| 文档 | 处理与职责 |
| --- | --- |
| 根 README | 压缩为启动、能力矩阵、玩法原则和工程入口；删除过期 MVP、重复 Git/MCP 教程及旧版本断言 |
| `docs/README.md`、`AGENTS.md` | 更新当前导航、删除去向与维护方式；保留 Web 优先和专项检查要求 |
| Web README / PRODUCT / DESIGN | 操作、产品约束、视觉分别维护；修复已删除文档的链接，流程改动随实现同步 |
| `game_flow_optimization.md` | 合并前两轮与当前检查，明确行为契约、已修复项、待实现项 |
| `campaign_direction.md` | 保留完整五章十战与人物设计；区分最初诊断、现有成长和后续扩展 |
| `home_lab_integration.md` | 保留当前统一组装、共享场景、剧情 XP 下限与草稿契约 |
| `launcher_runtime.md` | 当前售价、三槽换装、能量链、保存与释放机构的唯一运行说明 |
| `maintenance_lubrication_design.md` | 当前效果与未来机构研究分开；已否定的开盖障碍不能作为实现要求 |
| `deterministic_battle_sync.md`、`physics_v6_implementation.md` | 当前规则、版本和原生接入；与旧网络格式明确分开 |
| `structural_battle_design.md` | 保留结构模型公式与 v4 证据，修正“Web 没有恢复”的过期断言 |
| `network_pvp_architecture.md` | 合并长期产品与混合同步提案，删除失效 JSON 发包/云容量承诺 |
| `scripts/server/cf_worker/README.md` | 保留端点与本地开发；注明 v6 Provider 拒绝旧协议；未做部署 |
| `test_lab/README.md` / `DESIGN.md` | Godot 精密实验室与共享资产；纠正 Web 默认房间，不扩散原生局部约束 |
| `battle_worlds.md`、`top_part_physics_baseline.md` | 保留模型重建/碰撞、15 件零件/单位的独有技术资料 |
| `tools/audio-lab/README.md` | 独立音效工具启动与导出规格，继续有效 |
| `store-five/2026-09-30/README.md` | 最新商店五图与素材来源，保留并补入导航；不等同已上架 |

## 保留的历史证据

- `physics_simulation_review_20260923.md`、`physics_v5_implementation.md`：
  原受控实验、修复依据与版本转折有独立价值；不是当前缺陷清单。
- `launcher_modularity.md`、`launcher_performance_parts.md`：
  保存 Blender 模块、齿数/接口、重建脚本、原始结构图；运行状态以 launcher_runtime 为准。
- `scene_loading_performance.md`：保存测量条件、前后原始记录和资源生命周期，
  单次历史测量不冒充当前性能。
- `.impeccable/review/`：保留截图、验收范围和测试日志的解释文件，
  避免删掉证据说明却留下无法理解的 PNG/JSON。只有失效链接随本次迁移修正，
  不改写旧 verdict 为本次结果。
- `.impeccable/*-direction.md` 与 Web surface brief：保留局部视觉依据；
  与现有实现冲突时，以用户确认的当前方向和 PRODUCT/DESIGN 为准。

文档“旧”不单按日期判断：已被替代的重复说明删除，仍含独有模型/实验依据的记录保留，
不复制全文到新“归档”目录制造另一套旧文档。

## 验证

已检查保留 Markdown 的本地文件链接、标题锚点及删除文件引用；
扫描结果见[链接检查](flow-audit/2026-09-30/markdown-links.json)。
`git diff --check` 通过。游戏测试、构建、浏览器结果与前后图见
[本轮验证](flow-audit/2026-09-30/verification.md)，不借用历史测试数量。

较大的内容收敛：根 README 从457行减至约73行；
PVP架构合并混合同步提案，保养说明从432行减至160行。
保养保留有限能量、摩擦、未来双转子等独有研究，删除已否定的开盖门槛及
“当前仍无释放机构”等过期描述。发射器两份模型文档保留资产重建与几何依据，
当前操作/数值统一指向运行时说明。
