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
- 当前阶段：可运行的确定性 1v1 MVP

Godot 战斗规则由 `scripts/battle/battle_simulation.gd` 以固定 `1/60s`
步长计算，Jolt 刚体保留用于部件物理、碰撞实验和表现验证。胜负、AI、转速、
耐久、地形和奖励不依赖渲染帧率，可与 Web 原型使用同一组种子和输入做快照对照。

## Web 验证原型

`web-prototype/` 提供独立的 HTML / Three.js / Tone.js 版本，用于快速验证五件式组装、
地图地形、发射、1v1 AI、操控、碰撞和动态音效。Web 与 Godot 版本共享相同的 15 个
基准零件参数，并统一采用 `9:16` 竖屏、白色涂鸦准备界面、地图主题战斗界面、
近景跟随镜头和转速耦合移动规则。两端已有固定种子金标快照测试，允许 `1e-4`
以内的跨运行时浮点误差。

Godot 当前已同步：

- 双陀螺 1v1、地图对应 AI 配置和固定步长规则。
- 发射力度、方向、入场倾角与实时操控。
- Spin Out、Ring Out、Break 和 75 秒计时判定。
- 三张地图的护圈、出界半径、回中心力与复合材质分区。
- 双方 HUD、结算、暂停、声音开关和四项实时调参。
- 零件、颜色、地图、赏金、声音和调参结果的本地存档。

```powershell
cd web-prototype
npm install
npm run dev
```

## 游戏目标

本项目追求“物理可信”的战斗陀螺体验，而不是完全等同现实的工程级仿真。核心设计原则是：

- 玩家组装的每个部件都要真实影响战斗行为。
- 发射速度、高度、角度和方向会影响开局状态。
- 战斗中保留陀螺高速旋转、碰撞、失衡、摩擦衰减等关键物理反馈。
- 手机陀螺仪/加速度计只提供有限干预，避免变成直接遥控赛车。
- 多人对战优先保证公平、可同步、可复盘。

## 屏幕方向

项目采用竖屏优先设计。

原因：

- 陀螺设计、零件定制、地图选择、测试实验室和商店界面都更适合竖屏信息流。
- 手机用户可以单手握持，另一只手进行发射或摇杆操作。
- 战斗界面可以采用上方 3D 视野、下方摇杆和按钮的布局。
- 发射后镜头跟随陀螺，可以缓解竖屏横向视野较窄的问题。

风险：

- 竖屏会减少竞技场横向可见区域。
- 多人混战或大型地图可能需要更强的镜头缩放、雷达或边缘提示。
- 电脑端仍需要保留键盘控制，避免依赖手机陀螺仪。

当前结论：MVP 先固定竖屏，后续如战斗视野不足，再考虑横屏战斗模式或可切换方向。

## 核心玩法

### 1. 陀螺组装

陀螺采用五件式 DIY 结构，每个位置都提供独立造型与物理职责：

```text
攻击环       接触轮廓、攻击方向、外缘惯量
核心锁扣     结构耐久、上层固定、重心高度
金属配重盘   总质量、转动惯量、偏心程度
驱动中轴     整体高度、倾角响应、轴向稳定
轴尖         接地摩擦、续航能力、移动倾向
```

当前基准原型为每个位置提供 3 种零件，共支持 `3^5 = 243` 种组合。

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

### 5. 多地图与地形物理

项目需要支持多张竞技地图。地图不只是视觉皮肤，而是会直接影响陀螺的运动、碰撞、转速衰减和稳定性。

地图示例：

```text
标准碗形竞技场     中等摩擦，适合基础对战
金属高速竞技场     低摩擦，高续航，撞飞风险更高
橡胶阻尼竞技场     高摩擦，移动控制强，转速衰减快
砂砾破坏竞技场     不稳定摩擦，容易失衡和损伤底尖
冰面偏移竞技场     极低摩擦，轨迹难控制，碰撞后滑移明显
复合材质竞技场     中央金属区 + 外圈橡胶区 + 边缘减速区
```

每种地形材质应提供独立物理参数：

```text
surface_friction         表面摩擦
spin_damping_multiplier  转速衰减倍率
linear_drag_multiplier   平移阻力倍率
bounce_multiplier        弹性倍率
stability_modifier       稳定性修正
damage_multiplier        损伤倍率
control_modifier         手机控制响应修正
noise_strength           表面不平整扰动
```

复合地图可以由多个地形区域组成。陀螺每帧根据接地点所在区域读取对应材质，再影响当前物理计算。

推荐规则：

- 中央区域适合高速缠斗，外圈区域可以提高撞飞或减速风险。
- 材质变化应影响底尖表现，橡胶尖在高摩擦地形更强，金属尖在低摩擦地形更强。
- 地形只改变物理环境，不应直接替代陀螺部件本身的价值。
- 复合材质边界需要平滑过渡，避免陀螺在区域交界处产生突兀跳变。

## 推荐工程结构

```text
res://
  scenes/
    battle/
      BattleArena.tscn
      BeybladeBody.tscn
      BattleManager.tscn
    maps/
      StandardBowlArena.tscn
      MetalSpeedArena.tscn
      CompositeArena.tscn
    launcher/
      LauncherController.tscn
    assembly/
      AssemblyScreen.tscn
  scripts/
    battle/
      beyblade_body.gd
      battle_manager.gd
      arena_boundary.gd
      terrain_surface_area.gd
      terrain_physics_resolver.gd
    maps/
      arena_map_resource.gd
      terrain_surface_resource.gd
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
    maps/
    terrain_surfaces/
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
| `battle_simulation.gd` | 固定步长 1v1 规则、AI、碰撞、胜负和快照 |
| `battle_screen.gd` | 输入、HUD、音效、镜头和规则状态的三维表现 |
| `arena_map_resource.gd` | 定义地图名称、场景路径、默认材质、边界和玩法标签 |
| `terrain_surface_resource.gd` | 定义单个地形材质对摩擦、衰减、稳定性和损伤的影响 |
| `terrain_surface_area.gd` | 挂在地图区域节点上，标记该区域使用哪种地形材质 |
| `terrain_physics_resolver.gd` | 根据陀螺接地点采样地形材质，并计算最终物理修正 |

## MVP 范围

第一阶段只做能验证手感的最小闭环：

- 1 个 3D 竞技场。
- 至少 2 种地形材质：标准地面、低摩擦金属地面。
- 2 个可战斗陀螺。
- 五个 DIY 位置各 3 个零件，共 15 个基准零件。
- 本地 1v1 或玩家 vs AI。
- 可调发射速度、角度、高度。
- 基础手机倾斜控制。
- 三种胜利条件：停转、撞飞、损坏。

第二阶段再扩展：

- 3 到 5 张地图。
- 复合材质竞技场。
- 地形与底尖类型的克制关系。
- 地图随机扰动，例如震动区、减速区、弹跳边缘。

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

详细安装方式见：[Godot AI / MCP 安装说明](file:///c:/Users/Admin/Downloads/战斗陀螺/docs/godot_ai_mcp_setup.md)。

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

1. 在 Android / iOS 真机验证触控、帧率和音频延迟。
2. 接入陀螺仪与加速度计，并只映射为有限方向偏置。
3. 记录每帧玩家输入，增加战斗回放与跨设备校验。
4. 将确定性快照升级为异步 PVP 对局数据协议。
5. 继续调校三张地图和不同零件组合的胜率分布。
