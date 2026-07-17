# AI 接手说明：五件式陀螺与第一批音效

更新时间：2026-07-16

## 当前状态

项目是 Godot 4.7 竖屏 3D 战斗陀螺原型。当前分支在 `main`，远端为：

```text
https://github.com/SusamMinami/Beyblade.git
```

本次提交前的主要新增内容：

- 五件式 DIY 陀螺结构：攻击环、核心锁扣、金属配重盘、驱动中轴、轴尖。
- 每个 DIY 位置 3 种变体，共 `3^5 = 243` 种组合。
- 高质量程序化基准陀螺模型，替换旧的圆柱体 + 方块叶片预览。
- 组装页、测试实验室和战斗视觉模型共用同一个五件式模型。
- Tone.js 音效实验室和第一批 10 个 Godot WAV 音效。
- 自动化冒烟测试：验证五件式模型、15 个变体和五位置 UI。
- 15 个正式 `TopPartResource`、稳定 `part_id` 与 `PartDatabase`。
- `TopBuildData` 和 `AssemblyCalculator` 自动合成战斗物理参数。
- `BeybladeBody` 已应用质量、重心、惯量、材质、转速、控制、攻击和耐久。

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
```

攻击环和配重盘使用 `SurfaceTool` 程序化生成真实轮廓，不只是缩放圆柱。当前仍是原型级程序化模型，后续可替换为 Blender 导出的 GLB，但建议保留同样的五节点结构。

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

当前保存五个稳定 ID：

```gdscript
selected_attack_ring_id
selected_core_lock_id
selected_weight_disc_id
selected_driver_shaft_id
selected_tip_id
```

`set_build()` 接收五个 `part_id`，显示名称统一从 `PartDatabase` 查询。

### 零件数据库与属性计算

```text
resources/parts/
scripts/data/part_database.gd
scripts/assembly/top_build_data.gd
scripts/assembly/assembly_calculator.gd
```

数据库包含五类共 15 个 `.tres`。`AssemblyCalculator` 会合成总质量、重心、
转动惯量、摩擦、回弹、转速衰减、稳定性、控制响应、攻击力和耐久，并生成
启动转速、发射冲量和控制力。

### 测试实验室

```text
scenes/assembly/TestLabScreen.tscn
scripts/assembly/test_lab_screen.gd
```

测试实验室现在也实例化 `FivePartTopModel`，并基于五件式配置估算：

- 质心位置。
- 稳定性。
- 控制响应。

这些估算仍是启发式规则，不是最终物理模拟。

### 战斗视觉模型

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

这样视觉复杂度不会直接拖慢物理。注意：视觉模型位置上移了 `0.2`，用于对齐旧碰撞体底面。

`BeybladeBody._integrate_forces()` 会聚合与其他 `BeybladeBody` 的接触冲量，
使用攻击者的 `attack_power` 计算伤害并扣除当前耐久。低冲量接触不会造成
伤害，连续接触受短冷却保护；耐久归零会触发 `durability_depleted` 信号。

### 零件资源格式

```text
scripts/assembly/top_part_resource.gd
```

`PartType` 已扩展为：

```gdscript
ATTACK_RING
CORE_LOCK
WEIGHT_DISC
DRIVER_SHAFT
TIP
```

字段也扩展到：

```text
mass
center_of_mass_offset
moment_of_inertia
friction
restitution
contact_area
spin_damping_multiplier
stability
control_response
attack_power
durability
```

下一步建议创建 15 个正式 `TopPartResource`，让战斗物理读取这些参数。

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

```powershell
cd tools/audio-lab
npm install
npm run dev
```

构建验证：

```powershell
npm run build
npm audit --audit-level=high
```

注意：`tools/audio-lab/.gdignore` 用于避免 Godot 扫描 Node 依赖；`.gitignore` 已排除 `node_modules/` 与 `dist/`。

## 验证命令

Godot 路径：

```text
C:\Users\Admin\Downloads\Godot_v4.7-stable_win64.exe\Godot_v4.7-stable_win64_console.exe
```

推荐验证：

```powershell
$godot = 'C:\Users\Admin\Downloads\Godot_v4.7-stable_win64.exe\Godot_v4.7-stable_win64_console.exe'

& $godot --headless --path . --script res://tests/assembly/five_part_top_model_test.gd
& $godot --headless --path . --script res://tests/assembly/assembly_calculator_test.gd
& $godot --headless --path . --script res://tests/battle/collision_damage_test.gd
& $godot --headless --path . --scene res://scenes/assembly/AssemblyScreen.tscn --quit-after 10
& $godot --headless --path . --scene res://scenes/assembly/TestLabScreen.tscn --quit-after 10
& $godot --headless --path . --scene res://scenes/battle/BattleScreen.tscn --quit-after 20
& $godot --headless --path . --quit-after 20
```

已通过的检查：

- `five_part_top_model_test.gd` 输出 `PASS: five_part_top_model_test`
- `assembly_calculator_test.gd` 输出 `PASS: assembly_calculator_test`
- `collision_damage_test.gd` 输出 `PASS: collision_damage_test`
- 组装页启动无脚本错误
- 测试实验室启动无脚本错误
- 战斗场景启动无脚本错误
- 主入口启动无脚本错误
- `tools/audio-lab` 的 `npm run build` 通过
- `npm audit --audit-level=high` 无高危漏洞

## 当前边界

- 五件式模型是程序化基准模型，不是最终美术资产。
- 地图资源仍未真正影响战斗物理。
- 敌方陀螺、AI、撞飞与完整胜负管理仍是后续工作。
- 音效只接入了组装 UI 选择声；战斗发射、碰撞和旋转音效尚未绑定事件。
- 碰撞伤害和击破状态已实现，但部件级损坏与解体表现尚未实现。

## 推荐下一步

1. 实现第二个陀螺和基础 AI，形成可验证的 1v1。
2. 实现击破、停转和撞飞的统一胜负管理。
3. 接入 `spin_loop_fast.wav`，按 `spin_speed` 动态控制音高和音量。
4. 接入发射、轻/重碰撞、失衡刮擦、停转和奖励音效。
5. 将地图和地形资源接入战斗物理。
6. 用 Godot 编辑器或真机检查五件式模型在竖屏下的实际观感，再决定是否进入 Blender/GLB 美术资产流程。
