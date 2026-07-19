# AI 接手说明：确定性 1v1 战斗同步

更新时间：2026-07-19

## 当前状态

项目是 Godot 4.7 竖屏 3D 战斗陀螺原型。当前已从 Web 原型同步到 Godot 的核心闭环：

- 五件式 DIY 陀螺，共 15 个正式零件资源和 243 种组合。
- `PartDatabase + TopBuildData + AssemblyCalculator` 零件数据链路。
- Web / Godot 对齐的 `BattleSimulation` 固定 `1/60s` 确定性 1v1 规则层。
- 玩家与 AI 双陀螺、地图对应 AI 配置、发射力度 / 方向 / 入场倾角。
- Spin Out、Ring Out、Break 和 75 秒计时判定。
- 三张地图的护圈半径、出界半径、回中心力和复合材质分区。
- 程序化五件式视觉模型，组装、实验室和战斗场景共用。
- `BeybladeBody` 保留 Jolt 刚体、分部件损伤和动态质心实验，不再作为 1v1 结算权威。
- 双方 HUD、结算面板、暂停、声音开关、发射音效、旋转音效和四项实时调参。
- 零件、颜色、地图、赏金、声音和调参结果本地保存。

## 权威边界

`scripts/battle/battle_simulation.gd` 是战斗结果的唯一权威。它只依赖：

- `TopBuildData`
- `ArenaMapResource`
- 固定 seed
- 发射参数
- 每帧玩家输入
- 调参倍率

Godot 场景、Jolt 刚体、音效、镜头和模型动画只消费模拟快照。不要把视觉节点位置、
刚体速度或碰撞回调反向写回 `BattleSimulation`。

详细契约见：

```text
docs/deterministic_battle_sync.md
```

## 关键文件

### 零件与组装

```text
resources/parts/
scripts/data/part_database.gd
scripts/assembly/top_part_resource.gd
scripts/assembly/top_build_data.gd
scripts/assembly/assembly_calculator.gd
```

只保留正式 15 个零件资源。旧的 `TopPartCatalog` 和旧制单位资源已删除，后续不要再恢复双数据源。

### 确定性战斗

```text
scripts/battle/battle_simulation.gd
tests/battle/battle_simulation_test.gd
```

`battle_simulation_test.gd` 包含 Web 金标快照。跨 JavaScript 与 GDScript 允许 `1e-4`
浮点误差，但胜负、事件、地图材质和快照结构不能漂移。

### Godot 战斗表现

```text
scenes/battle/BattleScreen.tscn
scripts/battle/battle_screen.gd
tests/battle/battle_screen_test.gd
```

`BattleScreen` 负责输入、HUD、镜头、音效、调参和把模拟状态同步到两个 `BeybladeBody` 表现节点。

### 地图与材质

```text
resources/maps/
resources/terrain_surfaces/
scripts/maps/arena_map_resource.gd
scripts/maps/arena_terrain.gd
tests/maps/arena_terrain_test.gd
```

复合地图使用中央金属、中圈橡胶、边缘减速带三个规则材质，并通过顶点颜色显示分区。

### 存档

```text
scripts/core/game_state.gd
tests/core/GameStatePersistenceTest.tscn
tests/core/game_state_persistence_test.gd
```

正式存档路径为 `user://game_state.cfg`。`project.godot` 已把用户目录改为 ASCII 的
`Beyblade`，避免 Windows 下中文项目名导致 `user://` 写入不稳定。测试使用 `.godot/`
临时文件，避免工具沙箱限制系统用户目录写入。

## 验证命令

当前本机 Godot 可执行文件：

```powershell
C:\Users\Admin\Downloads\Godot_v4.7-stable_win64.exe\Godot_v4.7-stable_win64.exe
```

建议验证：

```powershell
godot --headless --path . --script tests/assembly/assembly_calculator_test.gd
godot --headless --path . --script tests/assembly/five_part_top_model_test.gd
godot --headless --path . --script tests/maps/arena_terrain_test.gd
godot --headless --path . --script tests/maps/map_select_screen_test.gd
godot --headless --path . --script tests/battle/spin_mobility_test.gd
godot --headless --path . --script tests/battle/collision_damage_test.gd
godot --headless --path . --script tests/battle/battle_simulation_test.gd
godot --headless --path . --script tests/battle/battle_screen_test.gd
godot --headless --path . --scene tests/core/GameStatePersistenceTest.tscn
```

Web 验证：

```powershell
cd web-prototype
npm test
npm run build
```

## 下一步

1. 真机验证触控、音频延迟、竖屏视野和性能。
2. 接入手机陀螺仪 / 加速度计，并映射为有限方向偏置。
3. 记录每帧输入，生成可复盘的 `frame_indexed_inputs`。
4. 给 `BattleSimulation` 增加版本号和最终快照哈希，准备异步 PVP。
5. 用固定输入批量跑组合胜率，继续调地图和零件平衡。
