# Web / Godot 确定性战斗同步

最后核对：2026-09-24。本文维护共有规则与版本差异，不宣称全端实时一致。

## 版本与兼容范围

| 范围 | 当前声明 | 来源 |
| --- | --- | --- |
| Web 战斗求解器 | `2026.09.24-shared-v6+launcher-v1` | [battle-simulation.js](../web-prototype/src/core/battle-simulation.js) |
| Godot 战斗求解器 | `2026.09.24-shared-v6+launcher-v1` | [v6_simulation.gd](../scripts/battle/v6_simulation.gd) |
| Web / Godot / Worker 网络层 | 协议 `2`，模拟标识 `2026.07.21-bin` | [JS](../web-prototype/src/network/protocol.js)、[GDScript](../scripts/battle/battle_protocol.gd)、[TS](../scripts/server/cf_worker/src/protocol.ts) |

Web v3 增加遗迹方形边界与障碍碰撞。v4 进一步加入五零件八扇区损伤、
实时质量/惯量/刚度、不可自行恢复的结构失衡、旋转外环接触反冲、轮换加速区与争夺 AI，
并修正微小摇杆输入被归一为全推力的问题。Godot 已在 v6 移植这些扩展，网络层未升级。
网络层标识相同不代表双方求解器相同；不得仅改版本字符串就允许新增地图联网。
旧金标只覆盖其既有场景，不证明新地图、回放恢复或二进制联机兼容。

v5 增加相机边界输入、统一发射预览、方向性轴状态、惯量扭矩耗散、尖端滑移、
法向／切向接触、接触阶段及同帧／超时平局。详细计算与验证见
[前两轮实现](physics_v5_implementation.md)。同期 `launcher-v1` 作为独立组合版本后缀。
两端的 FrameSyncProvider / AsyncVerifyProvider 会拒绝当前求解器，避免用旧二进制
协议或旧哈希字段提交 v6 状态。主游戏本地对战正常使用新规则。

v6 统一地面高度／法线、连续低边沿、开放边缘下落、实际装配支点高度、
120Hz 接触子步和完整 JSON 恢复。九组真实跨端对局及恢复对照通过；
实现与原生美术／界面边界见 [第三轮说明](physics_v6_implementation.md)。

v5 显式敌方发射方向按完整 180° 局部旋转，区别于旧版只镜像 Y；
输入记录应保存相机转换后的世界指令。平局为 `winner: "draw"`，同帧失败
`reason: "draw"` 并带双方 `eliminations`；超时平局保留 `reason: "time"`。
该语义尚未加入旧网络协议。30/60/120Hz 的固定输入批次检查已通过，
但主循环仍最多计入每帧 0.05 秒，低帧率下模拟慢于墙钟。

## 权威边界

`BattleSimulation` 是战斗规则的唯一权威。它负责：

- 固定 `1/60s` 规则步长，每步两个 `1/120s` 接触子步。
- 玩家与 AI 的位置、速度、转速、耐久和倾角；两端包含旋转相位、各部位损伤、
  结构派生状态、供能区占用与累计数据。
- 地面法线、低边沿、开放边缘下落、碰撞冲量和伤害。
- Spin Out、Ring Out、Break 和 75 秒计时判定。
- 固定种子 AI 与可序列化快照。

Three.js 和 Godot 3D 节点只消费模拟状态。渲染、音频、镜头和粒子不能反向修改
战斗结果。Godot 的 `BeybladeBody` 保留为部件损伤与 Jolt 物理实验载体，不作为
确定性对战的结算权威。

## 坐标映射

规则层使用二维坐标：

```text
simulation.position.x -> Godot world.x
simulation.position.y -> Godot world.z
```

Godot `world.y` 由共享地面高度（下落时为冻结支点高度减下落距离）、
轴方向和实际轴尖至模型原点的距离得到。

## 跨端契约

以下为 v6 两端共有的规则：

- 15 个正式 `part_id` 及其参数。
- `AssemblyCalculator` 派生公式。
- 五张地图的边界、采样高度、低边沿、表面参数和遗迹障碍。
- 复合地图 `3.1 / 5.9` 两个材质分区半径。
- AI、碰撞、移动衰减、胜负和计时公式。
- 发射高度、失衡、擦地损耗、风险状态和碰撞遥测。
- DIY 尺寸、高度、轮廓、对称、材料倍率和平行轴惯量。
- 轴状态、尖端接触、五部件损伤、供能争夺与双方 AI。
- 发射器有限能量及保养效果；原生 UI／库存互迁不属于此规则契约。

`npm run verify:physics-v6` 从真实 Web 数据导出共享目录和九组对局金标，
`tests/battle/physics_v6_parity.gd` 独立执行 GDScript 发射、输入与恢复，并对比完整检查点。
随后 `node tools/verify-native-recovery.mjs`（在 `web-prototype/`）读取原生导出的
中途状态并由 Web 续算，检查反向恢复。
跨 JavaScript 与 GDScript 允许 `1e-4` 数值误差，不允许结果、事件或胜负原因漂移。
本轮最大实际误差约 `3.1e-13`，不据此保证所有平台位级相同。
规则内部使用双精度标量，Vector2／Vector3 仅供原生场景边界使用。

## 输入与恢复的实现状态

- 两端支持显式双方发射、双方输入、固定帧计数与 AI。
- Web `exportState()`／`restoreState()` 和 Godot `export_state()`／`restore_state()`
  使用完整无损状态；必须校验相同规则、地图与装配上下文。校验失败不修改当前对局。
- `getSnapshot()`／`snapshot()` 是显示或诊断格式；旧网络编码／哈希模块不能用于 v6 恢复。
  Godot 旧方法名 `restore_from_snapshot()` 仅转发完整格式，拒绝旧快照。
- Godot `BattleSession` 自动记录本地回放；Web `battle-replay.js` 提供相同 JSON
  记录／播放工具。跨端恢复与固定输入验算已通过，未提供玩家回放库或联机权威服务。
- Godot 战斗页使用 `BattleSession`；Web 主游戏使用 `BattleSimulation` 配合固定时钟。
  PVP 架构提案不代表联网功能已交付，见 [PVP 架构与接入缺口](network_pvp_architecture.md)。

规则改动先在 Web 实现并验证，记录版本和未迁移范围。移植 Godot 或启用跨端联机前，
同步参数、规则、地图数据与金标，重新验证相同输入及快照恢复。

## 后续异步 PVP

对局数据至少应包含：

```text
simulation_version
seed
arena_id
player_build_ids
enemy_build_ids
player_and_enemy_customizations
launcher_and_maintenance_state
launch_parameters
frame_indexed_inputs
tuning_profile_id
final_snapshot_hash
```

客户端提交输入序列，验证端用相同版本规则重放。不要上传渲染节点变换作为结算依据。
v4 详细边界与玩法验证见 [结构损伤与加速区](structural_battle_design.md)。
