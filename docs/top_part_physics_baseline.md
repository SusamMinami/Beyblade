# 五件式陀螺物理参数基线

## 单位

`TopPartResource` 使用 SI 单位，避免把显示分数与物理量混在一起：

| 字段 | 单位 | 含义 |
| --- | --- | --- |
| `mass` | kg | 零件质量 |
| `center_of_mass_offset` | m | 零件质心相对组合原点的位置 |
| `moment_of_inertia` | kg·m² | 绕竖直自旋轴的惯量 |
| `transverse_moment_of_inertia` | kg·m² | 绕横向轴的惯量 |
| `contact_area` | m² | 正常直立时轴尖与场地的近似接触面积 |
| `upper_stack_height_offset` | m | 中轴带来的上层堆叠高度变化 |

现有战斗碰撞体半径为 `0.55` Godot 单位，远大于真实约 `35 mm`
半径。`BeybladeBody` 因此使用相似换算：

```text
长度缩放 = 0.55 / 0.035
质量缩放 = 1.4 / 0.0416
惯量缩放 = 质量缩放 × 长度缩放²
```

这样可以保留现有场景尺度，同时让不同组合之间的质量、质心和惯量比例
来自真实参数。

## 组合规则

- 总质量为五个零件质量之和。
- 总质心为各零件质心按质量加权的平均值。
- 三轴惯量使用各零件自身惯量，并通过平行轴定理平移到总质心。
- 地面摩擦和接触面积来自轴尖；当前单碰撞体的回弹系数来自攻击环。
- 衰减、稳定、控制和攻击系数使用按部位职责设置权重的几何平均。
- 耐久以最弱结构件为基础，并用总质量对瞬时碰撞加速度做小幅修正。

## 初始平衡依据

- 现代竞技陀螺的主攻击层常约 `30–37 g`，连接件约 `6–7 g`，轴尖约
  `2–3 g`。本项目把主攻击层拆为攻击环、核心锁扣和配重盘，因此三者
  合计约 `34.7–41.8 g`。
- 质量远离自旋轴会提高轴向惯量和角动量，通常改善抗扰与续航，但降低
  启动和方向响应。
- 低中轴降低总质心和横向受击杠杆；高中轴增强倾压和高位接触，也更易
  失稳或刮地。
- 窄金属尖接触面积小、抓地弱、损耗低；橡胶尖抓地与控制较强，但材料
  形变增加能耗；宽平尖把自旋更强地耦合为平移动作，攻击性高而续航差。
- 偏心盘通过横向质心偏移制造周期性扰动，不会凭空增加能量，因此同时
  提高攻击轨迹和自损耗。

初始数据用于建立可解释的差异，不代表最终竞技平衡。后续应通过固定
发射条件的回归场景记录停转时间、最大倾角、平均速度和碰撞冲量，再调
整无量纲乘数，不应随意改动物理单位。

## 参考资料

- Godot `RigidBody3D` 文档：
  <https://docs.godotengine.org/en/stable/classes/class_rigidbody3d.html>
- World Beyblade Organization 的 Metal Fight 部件说明：
  <http://wiki.worldbeyblade.org/index.php?title=Metal_Fight_Beyblade>
- World Beyblade Organization 的轴尖尺寸与表现记录：
  <http://wiki.worldbeyblade.org/index.php?title=List_of_Bottoms>
- Beyblade X 部件重量样本：
  <https://www.beybase.com/bx-15-leon-claw-beyblade-review/>
- 现代 Blade、Ratchet、Bit 重量与性能样本：
  <https://beyblade.gobamm.com/>
