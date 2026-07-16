# AI 接手说明：五件式陀螺、物理快照与碰撞损伤

更新时间：2026-07-17

## 当前状态

项目是 Godot 4.7 竖屏 3D 战斗陀螺原型。当前分支在 `main`，远端为：

```text
https://github.com/SusamMinami/Beyblade.git
```

本轮提交后的主要新增内容：

- 五件式 DIY 陀螺结构：攻击环、核心锁扣、金属配重盘、驱动中轴、轴尖。
- 每个 DIY 位置 3 种变体，共 `3^5 = 243` 种组合。
- 15 个正式 `TopPartResource` 资源，使用稳定 ID 和 SI 单位物理参数。
- `TopBuildData`、`AssemblyCalculator` 和 `TopBattleSnapshot` 已接入战斗。
- `BeybladeBody` 会读取装配快照，应用质量、惯量、摩擦、回弹、控制、攻击和耐久。
- 竖直自旋只衰减 Y 分量，不再覆盖 X/Z 角速度，允许碰撞后倾斜、刮擦和摆振。
- 基于 `attack_power` 与部件 `durability` 的碰撞损伤、部件破坏、性能衰减和视觉反馈已实现。
- Tone.js 音效实验室和第一批 10 个 Godot WAV 音效已保留。

最新损伤系统按用户要求尚未运行完整 Godot 测试。明日接手请优先看：

```text
docs/collision_damage_test_handoff.md
```

## 关键文件

### 五件式模型

```text
scenes/assembly/FivePartTopModel.tscn
scripts/assembly/five_part_top_model.gd
```

`FivePartTopModel` 是可复用视觉模型。它暴露 5 个独立节点：

```text
AttackRingRoot
CoreLockRoot
WeightDiscRoot
DriverShaftRoot
TipRoot
```

主要接口：

```gdscript
configure(attack_ring, core_lock, weight_disc, driver_shaft, tip, ring_color, core_color)
get_customizable_part_count()
get_part_nodes()
get_part_anchor_positions()
set_active_part(part_index)
set_part_damage_state(part_index, integrity_ratio, is_broken)
reset_damage_visuals()
flash_part_damage(part_index)
```

攻击环和配重盘使用 `SurfaceTool` 程序化生成真实轮廓。当前仍是原型级程序化模型，
后续可替换为 Blender 导出的 GLB，但建议保留同样的五节点结构，方便损伤反馈按部件
驱动。

### 组装界面

```text
scenes/assembly/AssemblyScreen.tscn
scripts/assembly/assembly_screen.gd
```

交互逻辑：

- 底部五个标签选择 DIY 位置。
- 当前位置通过 `OptionButton` 选择 3 种零件。
- 点击模型层会切换当前编辑位置；再次点击同一层会切换下一个变体。
- UI 选择音效使用 `res://audio/generated/batch_01/ui_select.wav`。

### 全局状态

```text
scripts/core/game_state.gd
```

当前同时保存显示名和稳定 ID：

```gdscript
selected_attack_ring
selected_core_lock
selected_weight_disc
selected_driver_shaft
selected_tip
selected_attack_ring_id
selected_core_lock_id
selected_weight_disc_id
selected_driver_shaft_id
selected_tip_id
```

`set_build()` 仍接收 5 个显示名，同时通过 `TopPartCatalog` 解析为稳定 ID。
战斗侧应优先使用：

```gdscript
GameState.get_selected_build()
GameState.get_battle_snapshot()
```

这样可以避免以后改中文显示名时破坏存档或装配逻辑。

### 零件资源与物理快照

```text
scripts/assembly/top_part_resource.gd
scripts/assembly/top_build_data.gd
scripts/assembly/top_battle_snapshot.gd
scripts/assembly/assembly_calculator.gd
scripts/assembly/top_part_catalog.gd
resources/parts/
docs/top_part_physics_baseline.md
```

`resources/parts/` 下按五个槽位各有 3 个资源：

```text
attack_rings/
core_locks/
weight_discs/
driver_shafts/
tips/
```

物理字段使用 SI 单位：

```text
mass: kg
center_of_mass_offset: m
moment_of_inertia: kg*m^2
transverse_moment_of_inertia: kg*m^2
contact_area: m^2
upper_stack_height_offset: m
```

`AssemblyCalculator` 会计算：

- 总质量。
- 质量加权质心。
- 三轴惯量，含平行轴定理。
- 轴尖摩擦和接触面积。
- 攻击环回弹。
- 自旋衰减、稳定、控制、攻击、总耐久和五个部件各自耐久。

当前战斗碰撞体仍沿用旧场景尺度，`BeybladeBody` 内部把真实质量和惯量缩放到
现有 Godot 尺寸。不要直接把 `.tres` 里的 kg 或 m 改成场景单位。

后续新增零件时必须同时：

- 放入 `resources/parts/<slot>/`。
- 设置唯一 `part_id`。
- 在 `TopPartCatalog.PART_PATHS` 中登记路径。
- 保持 `part_type` 与所在槽位一致。

### 测试实验室

```text
scenes/assembly/TestLabScreen.tscn
scripts/assembly/test_lab_screen.gd
```

测试实验室现在使用 `TopBattleSnapshot` 显示：

- 总质量。
- 质心高度。
- 惯量。
- 稳定性。
- 控制响应。

它已经不再使用旧的纯显示名启发式估算。

### 战斗主体

```text
scenes/battle/BeybladeBody.tscn
scripts/battle/beyblade_body.gd
```

战斗中的 `RigidBody3D` 仍使用简单圆柱碰撞体，视觉上挂载 `VisualModel`：

```text
BeybladeBody
  CollisionShape3D
  VisualModel -> FivePartTopModel
```

`BeybladeBody` 新增信号：

```gdscript
part_damaged(part_index, part_id, damage_amount, integrity_ratio)
part_broken(part_index, part_id)
```

碰撞伤害输入：

- 相对速度。
- 约化质量。
- 接触自旋速度。
- 攻击方 `attack_power`。
- 环境伤害倍率。

伤害传导规则：

```text
目标部件：82%
核心锁扣：12%
金属配重盘：6%
```

命中目标不使用随机数，直立、倾斜、倒伏状态各有固定部件序列，便于回放和
异步 PVP 方向的确定性调试。

部件损坏后的性能衰减：

- 攻击环和配重盘影响 `attack_power`。
- 轴尖和中轴影响控制力。
- 配重盘、中轴、核心锁扣影响横向稳定。
- 所有部件损坏都会提高自旋衰减，轴尖影响最大。
- 部件归零触发 `Break`，当前单人战斗把自身 `Break` 视为失败。

`BeybladeBody.tscn` 已接入：

```text
collision_light.wav
collision_heavy.wav
part_break.wav
```

### 战斗界面

```text
scenes/battle/BattleScreen.tscn
scripts/battle/battle_screen.gd
```

HUD 当前显示：

- 状态。
- 转速。
- 整体结构百分比。
- 最弱部件。
- 金币。

自身部件破坏会进入 `Break` 结算，重置后恢复全部部件耐久和视觉状态。

## 音效

### Godot 音效资产

```text
audio/generated/batch_01/
```

包含 10 个 WAV：

```text
launcher_pull_release.wav
spin_loop_fast.wav
collision_light.wav
collision_heavy.wav
wobble_scrape.wav
spin_out.wav
ring_out.wav
part_break.wav
ui_select.wav
reward.wav
```

规格：

- 48 kHz
- 16-bit PCM WAV
- stereo
- `spin_loop_fast.wav` 已启用 Godot 正向循环导入

### Tone.js 工具

```text
tools/audio-lab/
```

启动：

```bash
cd tools/audio-lab
npm install
npm run dev
```

构建验证：

```bash
npm run build
npm audit --audit-level=high
```

注意：`tools/audio-lab/.gdignore` 用于避免 Godot 扫描 Node 依赖；`.gitignore`
已排除 `node_modules/` 与 `dist/`。

## Godot 安装

当前 macOS Godot 路径：

```text
应用：~/Applications/Godot.app
命令：~/bin/godot
版本：4.7.stable.official.5b4e0cb0f
```

旧的临时 `/tmp/beyblade-godot-4.7` 已删除。后续命令直接使用 `godot` 或
`~/bin/godot`。

## 验证命令

推荐验证：

```bash
godot --headless --path . --script res://tests/assembly/five_part_top_model_test.gd
godot --headless --path . --script res://tests/assembly/assembly_calculator_test.gd
godot --headless --path . --scene res://scenes/assembly/AssemblyScreen.tscn --quit-after 10
godot --headless --path . --scene res://scenes/assembly/TestLabScreen.tscn --quit-after 10
godot --headless --path . --scene res://scenes/battle/BattleScreen.tscn --quit-after 20
godot --headless --path . --quit-after 20
```

历史上已通过的检查：

- `five_part_top_model_test.gd` 输出 `PASS: five_part_top_model_test`。
- 组装页启动无脚本错误。
- 测试实验室启动无脚本错误。
- 战斗场景启动无脚本错误。
- 主入口启动无脚本错误。
- `tools/audio-lab` 的 `npm run build` 通过。
- `npm audit --audit-level=high` 无高危漏洞。

本轮 2026-07-17 功能开发按要求未运行 Godot 测试，只做静态检查。明日接手
请优先执行 `docs/collision_damage_test_handoff.md` 中的自动化和手动测试清单。

## 当前边界

- 五件式模型是程序化基准模型，不是最终美术资产。
- 地图资源仍未真正影响战斗物理。
- 敌方陀螺、AI、正式胜负规则和异步 PVP 数据流仍是后续工作。
- 碰撞损伤已实现，但数值未经过实机场景回归，可能需要调 `collision_damage_scale`。
- 战斗已接入轻撞、重撞和部件破坏音效；发射、循环旋转、刮擦、出界和奖励音效仍待绑定。
- 目前单人战斗只处理自身 `Break` 失败，没有完整敌我双方结算。

## 推荐下一步

1. 按 `docs/collision_damage_test_handoff.md` 跑完损伤系统测试。
2. 更新 `tests/assembly/assembly_calculator_test.gd`，补齐部件耐久、伤害分配、性能衰减和重置断言。
3. 做两个 `BeybladeBody` 的碰撞回归场景，确认高攻击方造成更多伤害且结果确定。
4. 根据普通配置 7 到 12 次有效重击触发 `Break` 的目标，调 `collision_damage_scale`。
5. 接入 `spin_loop_fast.wav`、`wobble_scrape.wav`、`spin_out.wav` 和 `ring_out.wav`。
6. 用 Godot 编辑器或真机检查五件式模型在竖屏下的实际观感，再决定是否进入 Blender/GLB 美术资产流程。
