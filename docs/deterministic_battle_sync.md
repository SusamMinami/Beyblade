# Web / Godot 确定性战斗同步

## 权威边界

`BattleSimulation` 是战斗规则的唯一权威。它负责：

- 固定 `1/60s` 步长推进。
- 玩家与 AI 的位置、速度、转速、耐久和倾角。
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

Web 与 Godot 共享：

- 15 个正式 `part_id` 及其参数。
- `AssemblyCalculator` 派生公式。
- 三张地图的 `wall_radius`、`ring_out_radius` 和 `bowl_force`。
- 复合地图 `3.1 / 5.9` 两个材质分区半径。
- AI、碰撞、移动衰减、胜负和计时公式。

`tests/battle/battle_simulation_test.gd` 使用 Web 生成的固定种子快照作为金标。
跨 JavaScript 与 GDScript 允许 `1e-4` 浮点误差，不允许结果、事件或胜负原因漂移。

## 后续异步 PVP

对局数据至少应包含：

```text
simulation_version
seed
arena_id
player_build_ids
enemy_build_ids
launch_parameters
frame_indexed_inputs
tuning_profile_id
final_snapshot_hash
```

客户端提交输入序列，验证端用相同版本规则重放。不要上传渲染节点变换作为结算依据。
