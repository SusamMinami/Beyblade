# 碰撞损伤系统测试交接

## 本次实现

- `TopBattleSnapshot` 保存五个部件各自的耐久上限。
- `BeybladeBody` 根据相对速度、约化质量、接触自旋速度和攻击方
  `attack_power` 计算碰撞伤害。
- 伤害按目标部件 82%、核心锁扣 12%、金属配重盘 6% 传导。
- 直立、倾斜和倒伏状态使用固定部件命中序列，避免随机结果。
- 攻击环、配重、中轴和轴尖损坏会分别降低攻击、稳定、控制或续航。
- 任意部件耐久归零都会触发 `Break`，停止主动控制并播放破坏音效。
- 五件式模型提供受损、严重损坏和破坏三档视觉反馈。
- 当前单人战斗场景把自身部件破坏按失败处理。

## Godot 安装

```text
应用：~/Applications/Godot.app
命令：~/bin/godot
版本：4.7.stable.official.5b4e0cb0f
```

## 明日自动化测试

1. 执行项目导入，确认没有 GDScript 和场景解析错误。
2. 执行现有 `five_part_top_model_test.gd`。
3. 执行现有 `assembly_calculator_test.gd`，增加以下断言：
   - 快照包含五个正数部件耐久。
   - 高耐久零件的部件耐久大于低耐久零件。
   - `apply_collision_damage()` 按 82/12/6 比例扣减。
   - 攻击环损坏后 `attack_power` 下降。
   - 轴尖损坏后控制力下降、转速衰减增大。
   - 配重或中轴损坏后摆振强度增加。
   - 部件耐久归零后只触发一次 `part_broken`。
   - `reset_top()` 恢复全部耐久、性能和视觉状态。
4. 创建两个 `BeybladeBody` 的碰撞测试：
   - 高 `attack_power` 攻击者造成更多伤害。
   - 相同质量和速度下结果保持确定性。
   - 碰撞冷却期间不会重复扣血。
5. 冒烟启动组装页、测试实验室、战斗场景和主入口。

## 明日手动检查

1. 高速撞墙时攻击环受损，普通落地不应产生明显伤害。
2. 轻伤显示橙色覆盖，重伤显示红色覆盖，破坏后对应层明显脱位。
3. 受损后确认移动控制、稳定性和停转时间有可感知差异。
4. 轻撞、重撞和部件破坏分别播放正确音效。
5. HUD 正确显示整体结构、最弱部件和 `Break` 结算。
6. 重置回合后耐久、模型位置、覆盖材质和声音状态恢复。

## 初始调参入口

`BeybladeBody` 暴露以下参数：

```text
collision_damage_scale
environment_damage_multiplier
minimum_damage_speed
collision_damage_cooldown
maximum_collision_damage
spin_contact_speed_scale
```

先保持当前值完成验证，再根据平均破坏所需的有效碰撞次数调节
`collision_damage_scale`。建议基准为普通配置需要 7 到 12 次有效重击才触发
`Break`，撞墙伤害应明显低于同速度的敌方攻击。
