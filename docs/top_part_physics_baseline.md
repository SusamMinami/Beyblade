# 五件式陀螺参数基线

最后核对：2026-09-24。适用于 Web / Godot 的共有零件与组合计算。
两端 v6 运行时物理已对齐，见 [第三轮实现](physics_v6_implementation.md)；
Web 测量评分界面尚未移植 Godot，正式 15 件参数不变。

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

- 先应用每个零件的 DIY 尺寸、高度、轮廓和材料参数，再进行组合计算。
- 总质量为五个改造后零件质量之和。
- 总质心为各零件质心按质量加权的平均值。
- 轴向惯量包含平行轴项：
  `Σ(I_i + m_i × ((x_i − COM_x)² + (z_i − COM_z)²))`，
  其中 `I_i`、`m_i` 和质心位置均为改造后的值，自旋轴为 Y。
- 摩擦主要来自轴尖，攻击环和配重盘少量参与。
- 回弹主要来自攻击环，配重盘和轴尖少量参与。
- 稳定、控制、攻击、耐久按部位职责加权。
- 最大转速随惯量增加而降低。
- 发射前向动量随总质量增加而上升。
- 偏心质心会扣稳定性，并在战斗模拟中产生周期性扰动。

两端 v6 使用本体旋转相位映射重心／弯曲方向，驱动接地和轴姿态响应。
`spinDecayPerSecond` 保留为组合参数，运行时据此计算损耗扭矩并除以实时惯量，
不再直接每秒减去同一个角速度值。尖端有效摩擦力矩半径为平衡近似；
`contact_area` 和横向惯量未升级为真实接触几何或完整刚体参数。
支点至质心高度由五件安装锚点、局部质心、剩余质量和实际轴尖底部派生；
组装卡片的局部质心口径保留，不因显示锚点而改变旧派生基准。

Web 的续航、耐久评分改为固定条件的自由转时及等载荷最重扇区损伤；
评分条件包含基础发射器和无保养，界面可查看。其余三项仍为属性换算，
不应把 Web 评分称为已与 Godot 对齐。

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

这些值对应无 DIY 的标准组合，是两端测试依赖的基线。改动先在 Web 验证；
若尚未迁移 Godot，必须记录差异，恢复跨端兼容前同步两端测试。

## 设计依据

- 重外圈提高质量、惯量和撞击动量，但降低控制和启动转速。
- 低重心提高稳定性，但降低进攻倾角。
- 橡胶尖控制强，代价是转速衰减更快。
- 金属尖续航强、摩擦低，代价是控制弱。
- 扁平尖制造更强横移与攻击性，稳定和续航偏弱。
- 偏心配重强化突击轨迹，同时显著增加失衡和自损耗。

## 修改规则

### 两端 v6 的运行时结构层（始于 Web v4）

组装计算器与无损基准保持不变。战斗另创建五个零件各八扇区的损伤状态；
碰撞和障碍物载荷受材料耐久、厚径比、凸翼与杠杆高度影响。破损会派生有效质量、
重心、惯量、刚度、稳定性和额外转速阻力；不会反写玩家的永久零件库存。
HUD 的完整度是零件平均损伤的加权值，局部最重损伤另行显示，两者不能互代。

加速区提供有限扭矩，补转量与当前惯量相关，不能修复结构或重新启动已停转陀螺。
质量和长度仍为游戏平衡单位。Web HUD 使用“转速”；Godot HUD 将角速度按
`ω × 60 / 2π` 换算为 RPM，该换算不等于实物参数已经标定。
规则、近似边界与验收见 [结构损伤与加速区](structural_battle_design.md)。
本层已移植 Godot；材料参数不代表经过真实试样测定的工程强度。

修改零件参数时必须同时检查：

```text
tests/assembly/assembly_calculator_test.gd
web-prototype/tests/assembly-calculator.test.js
tests/battle/battle_simulation_test.gd
web-prototype/tests/battle-simulation.test.js
```

如果影响 `BattleSimulation` 金标快照，应重新生成并审查快照，而不是直接放宽容差。
