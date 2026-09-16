# Web / Godot 确定性战斗同步

最后核对：2026-09-16。本文维护共有规则与版本差异，不宣称全端实时一致。

## 版本与兼容范围

| 范围 | 当前声明 | 来源 |
| --- | --- | --- |
| Web 战斗求解器 | `2026.09.16-web-v4` | [battle-simulation.js](../web-prototype/src/core/battle-simulation.js) |
| Godot 战斗求解器 | `2026.07.21-web-v2` | [battle_simulation.gd](../scripts/battle/battle_simulation.gd) |
| Web / Godot / Worker 网络层 | 协议 `2`，模拟标识 `2026.07.21-bin` | [JS](../web-prototype/src/network/protocol.js)、[GDScript](../scripts/battle/battle_protocol.gd)、[TS](../scripts/server/cf_worker/src/protocol.ts) |

Web v3 增加遗迹方形边界与障碍碰撞。v4 进一步加入五零件八扇区损伤、
实时质量/惯量/刚度、不可自行恢复的结构失衡、旋转外环接触反冲、轮换加速区与争夺 AI，
并修正微小摇杆输入被归一为全推力的问题。Godot 和网络层尚未迁移这些扩展。
网络层标识相同不代表双方求解器相同；不得仅改版本字符串就允许新增地图联网。
旧金标只覆盖其既有场景，不证明新地图、回放恢复或二进制联机兼容。

## 权威边界

`BattleSimulation` 是战斗规则的唯一权威。它负责：

- 固定 `1/60s` 步长推进。
- 玩家与 AI 的位置、速度、转速、耐久和倾角；Web v4 另包含旋转相位、各部位损伤、
  结构派生状态、供能区占用与累计数据。
- 地形修正、护圈反弹、碰撞冲量和伤害。
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

Godot `world.y` 由 `ArenaMapResource.get_height_at()` 加陀螺离地高度得到。

## 跨端契约

以下为两端共有的旧规则基线，新增场景、Web v4 接触/损伤/AI/供能不在此范围：

- 15 个正式 `part_id` 及其参数。
- `AssemblyCalculator` 派生公式。
- 三张地图的 `wall_radius`、`ring_out_radius` 和 `bowl_force`。
- 复合地图 `3.1 / 5.9` 两个材质分区半径。
- AI、碰撞、移动衰减、胜负和计时公式。
- 发射高度、失衡、擦地损耗、风险状态和碰撞遥测。
- DIY 尺寸、高度、轮廓、对称、材料倍率和平行轴惯量。

`tests/battle/battle_simulation_test.gd` 使用已有共有规则的固定种子快照作为金标。
跨 JavaScript 与 GDScript 允许 `1e-4` 浮点误差，不允许结果、事件或胜负原因漂移。

## 输入与恢复的实现状态

- 两端求解器已有显式双方发射、双方输入与帧计数；旧 AI 入口仍保留。
- Godot 已有 `restore_from_snapshot()` 及独立规范化编码/哈希模块。
- Web 求解器已有 `getSnapshot()`，尚未提供对应的快照恢复方法。
  `getSnapshot()` 返回当前运行对象；`snapshot()` 输出带局部损伤的可序列化报告，
  它不是可用于 v4 中途续算的完整恢复协议。
- Godot 战斗页已使用 `BattleSession`；Web 主游戏仍直接使用 `BattleSimulation`。
- 网络层存在异步回放数据组装，但独立播放器、命令行验算和跨端恢复一致性
  不应标为已验收。详见 [混合 PVP 架构](hybrid_pvp_architecture.md)。

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
launch_parameters
frame_indexed_inputs
tuning_profile_id
final_snapshot_hash
```

客户端提交输入序列，验证端用相同版本规则重放。不要上传渲染节点变换作为结算依据。
v4 详细边界与玩法验证见 [结构损伤与加速区](structural_battle_design.md)。
