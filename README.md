# 战斗陀螺

一款面向手机用户的 Godot 3D 物理对战小游戏。玩家可以组装自己的战斗陀螺，通过发射器参数和手机传感器影响战斗过程，在竞技场中通过撞击、失衡、停转或击飞对手取得胜利。

项目同步仓库：

```text
https://github.com/SusamMinami/Beyblade.git
```

## 当前项目状态

- 引擎：Godot 4.x
- 渲染：移动端优先，当前使用 `gl_compatibility`
- 物理：当前配置为 `Jolt Physics`
- 平台目标：Android / iOS 手机端优先
- 当前阶段：原型设计与基础工程搭建

## 游戏目标

本项目追求“物理可信”的战斗陀螺体验，而不是完全等同现实的工程级仿真。核心设计原则是：

- 玩家组装的每个部件都要真实影响战斗行为。
- 发射速度、高度、角度和方向会影响开局状态。
- 战斗中保留陀螺高速旋转、碰撞、失衡、摩擦衰减等关键物理反馈。
- 手机陀螺仪/加速度计只提供有限干预，避免变成直接遥控赛车。
- 多人对战优先保证公平、可同步、可复盘。

## 核心玩法

### 1. 陀螺组装

陀螺由多个部件组成，每个部件提供真实物理参数：

```text
攻击环 / 外圈
重量盘 / 配重层
中轴 / 连接件
底尖 / 驱动尖
附加模块 / 磁铁 / 橡胶 / 金属件
```

推荐参数：

```text
mass                 质量
center_of_mass       重心偏移
moment_of_inertia    转动惯量
friction             摩擦系数
restitution          弹性
durability           耐久
contact_area         接触面积
air_drag             空气阻力
angular_damping      角阻尼
stability            稳定性
attack_power         攻击倾向
```

设计要求：

- 重外圈提高续航和撞击动量，但降低启动响应。
- 低重心提高稳定性，但减少进攻倾角。
- 橡胶底尖提升移动控制和抓地，代价是转速衰减更快。
- 金属底尖续航强、摩擦低，但控制弱。
- 偏心配重可以制造强攻击轨迹，但更容易自我失衡。

### 2. 发射系统

发射不是单一力量值，而是由多个输入组成：

```text
发射器速度 -> 初始角速度
发射高度   -> 落地冲击和稳定性
发射角度   -> 初始倾斜和攻击性
发射方向   -> 初始移动方向
```

移动端交互建议：

- 拖拽或滑动决定发射器速度。
- 松手时机决定发射稳定性。
- 手机倾斜或屏幕手势决定发射角度。
- 发射高度使用短滑条或按压蓄力控制。

### 3. 战斗系统

胜利条件：

```text
Spin Out   对方停转
Ring Out   对方被撞出场地
Break      对方部件损坏或解体
```

战斗中需要持续追踪：

```text
spin_speed            当前转速
tilt_angle            倾斜角
linear_velocity       平移动量
angular_velocity      角速度
collision_impulse     碰撞冲量
part_damage           部件损伤
stability             当前稳定性
```

### 4. 手机传感器控制

传感器控制应设计成“微调轨迹”，而不是完全控制位移。

建议规则：

- 手机小幅倾斜时，对陀螺施加弱方向偏置。
- 倾斜越大，控制力越强，但失衡风险也增加。
- 不同底尖对传感器控制响应不同。
- 高转速时控制更迟钝，低转速时更容易被控制也更容易失衡。

## 推荐工程结构

```text
res://
  scenes/
    battle/
      BattleArena.tscn
      BeybladeBody.tscn
      BattleManager.tscn
    launcher/
      LauncherController.tscn
    assembly/
      AssemblyScreen.tscn
  scripts/
    battle/
      beyblade_body.gd
      battle_manager.gd
      arena_boundary.gd
    assembly/
      top_build_data.gd
      top_part_resource.gd
      assembly_calculator.gd
    input/
      gyro_input_controller.gd
      launch_input_controller.gd
    data/
      part_database.gd
  resources/
    parts/
      rings/
      weights/
      tips/
  art/
  audio/
  docs/
```

## 推荐脚本职责

| 脚本 | 职责 |
| --- | --- |
| `top_part_resource.gd` | 定义单个陀螺部件的物理参数 |
| `top_build_data.gd` | 保存玩家当前组装配置 |
| `assembly_calculator.gd` | 根据部件计算总质量、重心、惯量、摩擦等派生参数 |
| `beyblade_body.gd` | 战斗中的刚体、转速、倾斜、损伤和状态更新 |
| `launcher_controller.gd` | 发射器速度、高度、角度、方向计算 |
| `gyro_input_controller.gd` | 手机传感器输入滤波和控制力转换 |
| `battle_manager.gd` | 回合流程、胜负判定、计时和结算 |

## MVP 范围

第一阶段只做能验证手感的最小闭环：

- 1 个 3D 竞技场。
- 2 个可战斗陀螺。
- 3 个外圈、3 个重量盘、3 个底尖。
- 本地 1v1 或玩家 vs AI。
- 可调发射速度、角度、高度。
- 基础手机倾斜控制。
- 三种胜利条件：停转、撞飞、损坏。

暂不优先做：

- 大量部件收集。
- 复杂养成。
- 排位系统。
- 完整联网匹配。
- 商业化系统。

## Git 同步

### 首次绑定远程仓库

如果本地目录还没有初始化 Git：

```powershell
git init
git branch -M main
git remote add origin https://github.com/SusamMinami/Beyblade.git
git status
```

首次提交：

```powershell
git add .
git commit -m "docs: add project overview"
git push -u origin main
```

如果远程仓库已有内容，先拉取：

```powershell
git pull origin main --allow-unrelated-histories
```

如发生冲突，优先保留 Godot 场景、资源和脚本的人工修改，不要直接覆盖。

### 日常协作流程

```powershell
git pull
git status
git add .
git commit -m "feat: describe change"
git push
```

推荐分支命名：

```text
feature/assembly-system
feature/launch-controller
feature/battle-physics
fix/gyro-input-drift
docs/project-brief
```

## Godot 与 Git

Godot 本身对版本控制比较友好，场景、资源和脚本大多是文本文件。Godot 编辑器也支持通过版本控制插件在编辑器内操作 Git。

推荐方案：

- 主要 Git 操作用命令行或 GitHub Desktop，方便排查冲突。
- Godot 内置版本控制入口可用于查看改动。
- 如果团队成员更习惯编辑器内提交，可以安装官方 `godot-git-plugin`。
- 大型二进制资源，例如高分辨率贴图、音频、模型，后续建议接入 Git LFS。

当前项目已有：

```text
.gitignore
.gitattributes
```

`.godot/` 是本地缓存目录，不应提交。

## AI 协作建议

为了让我更有效地操作 Godot 项目，建议保持以下工作方式。

### 最适合 AI 处理的任务

- 设计工程目录、脚本职责和数据结构。
- 编写 GDScript 逻辑、资源类和工具脚本。
- 生成测试场景、调试面板和原型 UI。
- 分析物理参数是否自洽。
- 编写 README、设计文档、任务拆分和协作规范。
- 排查 Git、资源路径、脚本引用和项目配置问题。

### 需要你或 Godot 编辑器配合的任务

- 拖拽搭建复杂 3D 场景。
- 调整碰撞体、刚体形状、材质和灯光的最终视觉效果。
- 手机真机传感器测试。
- 触屏手感调参。
- 多人网络延迟和同步验证。

### 推荐的 AI + Godot 工作流

1. 在 Godot 中创建或打开场景。
2. 把明确目标告诉 AI，例如“创建陀螺部件 Resource 数据结构”。
3. AI 修改脚本、资源或文档。
4. 在 Godot 中运行场景，复制报错或截图反馈。
5. AI 根据报错继续修复。
6. 每完成一个小功能就提交一次 Git。

### 可选：Godot AI / MCP 插件

如果希望 AI 直接读取和操作 Godot 编辑器中的场景、节点、材质和运行状态，可以考虑安装 Godot 的 MCP 类插件，例如：

- `Godot AI`
- `Godot MCP`
- `Godot MCP Pro`

这类插件通常会在本机启动一个 MCP 服务，让 AI 客户端通过工具接口访问 Godot 编辑器。它们适合：

- 让 AI 查看当前场景树。
- 自动创建节点。
- 修改节点属性。
- 读取编辑器错误。
- 生成或调整 UI/材质/动画。

注意事项：

- 必须配合 Git 使用，因为部分 MCP 插件会直接保存文件。
- 初期建议只在原型分支启用。
- 重要场景修改前先提交一次 Git。
- 不要把密钥、发布证书或账号令牌交给插件或聊天上下文。

## 开发约定

- 脚本命名使用 `snake_case.gd`。
- 资源类命名使用清晰业务名，例如 `TopPartResource`。
- 一个脚本只负责一个明确系统。
- 物理参数优先放在 `Resource` 或数据表中，不要散落在场景节点上。
- 重要调参值使用 `@export` 暴露给 Godot 编辑器。
- 修改物理行为时同步更新文档中的参数含义。

## 近期任务建议

1. 创建基础目录结构。
2. 实现 `TopPartResource`。
3. 实现 `TopBuildData` 和组装属性计算。
4. 创建一个简单 `BeybladeBody.tscn`。
5. 实现发射参数到刚体初始速度的转换。
6. 搭建测试竞技场。
7. 加入基础转速衰减、倾斜失衡和停转判定。
8. 接入手机传感器输入。

