# AI 接手说明：五件式陀螺、战斗损伤与倾角地形

更新时间：2026-07-17

## 当前状态

项目是 Godot 4.7 竖屏 3D 战斗陀螺原型。当前已实现：

- 五件式 DIY 陀螺，共 15 个正式零件资源和 243 种组合。
- `PartDatabase + TopBuildData + AssemblyCalculator` 零件数据链路。
- 程序化五件式视觉模型，组装、实验室和战斗场景共用。
- 质量、重心、惯量、摩擦、回弹、控制、攻击与耐久派生。
- 基于真实接触冲量的战斗伤害。
- 分部件耐久、损伤方向、脱落表现和动态质心。
- 偏心损伤会增加摆动、降低控制并加快转速衰减。
- 三张地图的程序化倾角碰撞网格，重力会自然产生下坡加速和上坡减速。
- 地图材质会影响摩擦、自旋衰减、线性阻力、稳定与控制。

## 关键文件

### 零件与物理

```text
resources/parts/
scripts/data/part_database.gd
scripts/assembly/top_part_resource.gd
scripts/assembly/top_build_data.gd
scripts/assembly/assembly_calculator.gd
```

`TopBuildData` 是战斗运行时的完整派生结果。`GameState` 只保存稳定的
`part_id`，显示名称统一从 `PartDatabase` 查询。

### 战斗刚体

```text
scenes/battle/BeybladeBody.tscn
scripts/battle/beyblade_body.gd
```

`BeybladeBody` 保留五个独立部件耐久池。局部损伤会：

1. 按命中方向削减该部件的有效质量。
2. 重新计算刚体质量、质心和惯量。
3. 根据偏心量增加横向摆动和自旋衰减。
4. 部件耐久归零后触发脱落视觉，但只要总结构耐久未归零，陀螺仍可继续运行。

主要接口：

```gdscript
apply_build_data(build_data)
set_terrain_surface(surface)
apply_collision_damage(attacker, impulse, part_index, direction)
apply_part_damage(part_index, damage, direction)
get_part_integrity_ratio(part_index)
get_detached_part_count()
```

### 地图与倾角

```text
resources/maps/
resources/terrain_surfaces/
scripts/maps/arena_map_resource.gd
scripts/maps/arena_map_catalog.gd
scripts/maps/arena_terrain.gd
```

`ArenaMapResource` 提供碗深、曲率、方向坡度、坡向和网格精度。
`ArenaTerrain` 生成可见网格、`ConcavePolygonShape3D` 碰撞面和环形边界。
坡面运动由 Godot 重力和接触约束直接产生，不使用速度倍率模拟。

## 验证命令

```bash
godot --headless --path . --script res://tests/assembly/five_part_top_model_test.gd
godot --headless --path . --script res://tests/assembly/assembly_calculator_test.gd
godot --headless --path . --script res://tests/battle/collision_damage_test.gd
godot --headless --path . --script res://tests/maps/arena_terrain_test.gd
godot --headless --path . --scene res://scenes/battle/BattleScreen.tscn --quit-after 20
godot --headless --path . --quit-after 20
```

## 当前边界

- 战斗仍只有玩家陀螺，尚未实现敌方 AI 和完整 1v1。
- 复合地图当前具有独立起伏，但还未把多个材质区域拆成不同碰撞分区。
- 脱落使用五件式模型的位移表现，尚未生成独立飞散刚体。
- 地图坡度、损伤偏心和失速参数仍需真机手感调校。
