# 五件式陀螺参数基线

更新时间：2026-07-19

## 当前口径

正式资源现在只保留 `PartDatabase` 引用的 15 个零件：

```text
resources/parts/attack_rings/*.tres
resources/parts/core_locks/*.tres
resources/parts/weight_discs/*.tres
resources/parts/driver_shafts/*.tres
resources/parts/tips/*.tres
```

旧的 `TopPartCatalog` 和旧制单位资源已经删除。后续不要再维护两套零件数据。

当前数值是 Web / Godot 共用的原型平衡单位，不再宣称为严格 SI 单位。这样做是为了让
确定性二维规则、Godot 竖屏场景尺度和 15 件零件差异保持一致。

## 字段含义

| 字段 | 当前口径 | 含义 |
| --- | --- | --- |
| `mass` | 平衡质量单位 | 影响碰撞冲量、控制加速度和启动动量 |
| `center_of_mass_offset` | 规则空间偏移 | 影响稳定性和偏心扰动 |
| `moment_of_inertia` | 轴向惯量单位 | 影响最大转速和续航表现 |
| `transverse_moment_of_inertia` | 预留 | 当前正式合成主要使用轴向惯量 |
| `friction` | 0 到约 1.5 | 与地形共同影响平移阻力 |
| `restitution` | 0 到 1 | 碰撞回弹倾向 |
| `contact_area` | 相对接触面积 | 主要用于零件差异展示和后续扩展 |
| `spin_damping_multiplier` | 无量纲倍率 | 影响转速衰减 |
| `stability` | 无量纲倍率 | 影响倾角、偏心惩罚和续航 |
| `control_response` | 无量纲倍率 | 影响摇杆或传感器控制响应 |
| `attack_power` | 无量纲倍率 | 影响碰撞伤害和 AI 进攻倾向 |
| `durability` | 结构耐久单位 | 影响 Break 所需伤害 |

## 组合规则

`AssemblyCalculator` 同步存在于：

```text
scripts/assembly/assembly_calculator.gd
web-prototype/src/core/assembly-calculator.js
```

核心规则：

- 总质量为五个零件质量之和。
- 总质心为各零件质心按质量加权的平均值。
- 轴向惯量为五个零件惯量之和。
- 摩擦主要来自轴尖，攻击环和配重盘少量参与。
- 回弹主要来自攻击环，配重盘和轴尖少量参与。
- 稳定、控制、攻击、耐久按部位职责加权。
- 最大转速随惯量增加而降低。
- 发射前向动量随总质量增加而上升。
- 偏心质心会扣稳定性，并在战斗模拟中产生周期性扰动。

## 正式基准

标准组合：

```text
attack_ring.balance_six
core_lock.standard
weight_disc.standard
driver_shaft.standard
tip.rubber_balance
```

派生基准约为：

```text
total_mass = 1.22
moment_of_inertia = 0.89
max_spin_speed = 65
launch_forward_impulse = 4.5
```

这些值是 Web 金标和 Godot 金标共同依赖的稳定基线。修改它们前必须同步两端测试。

## 设计依据

- 重外圈提高质量、惯量和撞击动量，但降低控制和启动转速。
- 低重心提高稳定性，但降低进攻倾角。
- 橡胶尖控制强，代价是转速衰减更快。
- 金属尖续航强、摩擦低，代价是控制弱。
- 扁平尖制造更强横移与攻击性，稳定和续航偏弱。
- 偏心配重强化突击轨迹，同时显著增加失衡和自损耗。

## 修改规则

修改零件参数时必须同时检查：

```text
tests/assembly/assembly_calculator_test.gd
web-prototype/tests/assembly-calculator.test.js
tests/battle/battle_simulation_test.gd
web-prototype/tests/battle-simulation.test.js
```

如果影响 `BattleSimulation` 金标快照，应重新生成并审查快照，而不是直接放宽容差。
