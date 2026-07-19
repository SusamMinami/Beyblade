# 碰撞损伤系统测试交接

更新时间：2026-07-19

## 当前定位

项目现在有两层战斗逻辑：

- `BattleSimulation`：确定性 1v1 规则权威，负责胜负、AI、碰撞冲量、总耐久和快照。
- `BeybladeBody`：Godot / Jolt 表现与实验载体，负责分部件损伤、动态质心、破损视觉和碰撞音效。

后续不要把 `BeybladeBody` 的刚体碰撞结果作为联网或异步 PVP 的结算依据。
它仍然很重要，但职责是验证手感、受损表现和未来可能的局部破坏效果。

## 已实现内容

- `TopBattleSnapshot` 保存五个部件各自的耐久上限。
- `BeybladeBody` 根据相对速度、约化质量、接触自旋速度和攻击方 `attack_power` 计算碰撞伤害。
- 伤害会分配到具体部件，并改变有效质量、质心、惯量、攻击、控制和转速衰减。
- 直立、倾斜和倒伏状态使用固定部件命中序列，避免随机结果。
- 部件耐久归零后会触发脱落视觉，但在当前确定性 1v1 中 Break 由 `BattleSimulation` 的总耐久归零判定。
- 五件式模型提供轻伤、重伤和破损三档视觉反馈。
- `BattleScreen` 会把确定性模拟中的总耐久比例同步到两个 `BeybladeBody` 表现节点。

## 相关测试

```text
tests/battle/collision_damage_test.gd
tests/battle/spin_mobility_test.gd
tests/battle/battle_simulation_test.gd
tests/battle/battle_screen_test.gd
```

`collision_damage_test.gd` 继续覆盖 Jolt 实体碰撞和部件损伤：

- 轻微接触不扣耐久。
- 高攻击配置造成更多伤害。
- 耐久不会低于 0。
- 单侧部件损伤会改变质心。
- 部件脱落后 `BeybladeBody` 仍可继续存在。
- `reset_top()` 会恢复耐久、质量、质心和视觉状态。
- 两个 `BeybladeBody` 的真实物理碰撞会自动结算伤害。

`battle_simulation_test.gd` 覆盖确定性规则：

- 固定 seed 和输入得到 Web 金标快照。
- 有效碰撞扣除双方总耐久。
- 普通出射先被护圈反弹，不立即 Ring Out。
- 低转速削弱平移速度和操控影响。
- Spin Out、Ring Out、Break 三类结果可判定。

## 调参边界

`BeybladeBody` 暴露的损伤和移动参数只能影响 Jolt 表现层。若要改变正式 1v1 结果，应改：

```text
scripts/battle/battle_simulation.gd
tests/battle/battle_simulation_test.gd
web-prototype/src/core/battle-simulation.js
web-prototype/tests/battle-simulation.test.js
```

修改正式规则时必须同步 Web 与 Godot 两端，并更新金标快照。

## 手动检查建议

1. 在战斗场景中确认两个陀螺的模型、转速、耐久和结算显示随模拟变化。
2. 在 Jolt 测试或实验场景中确认局部损伤仍能改变质心和视觉。
3. 轻撞、重撞、发射、旋转、胜利和失败音效是否区分清楚。
4. 重置回合后模拟状态、模型姿态、HUD、音频和调参面板都恢复一致。
