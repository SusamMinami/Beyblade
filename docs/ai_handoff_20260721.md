# AI 接手说明：Web → Godot 全功能对齐完成，进入 PVP 第一里程碑

更新时间：2026-07-21

## 当前状态快照

Web 原型与 Godot 两端已完成核心功能对齐，冻结模拟版本为 `2026.07.21-web-v2`。
所有 Godot 测试与 Web 测试均通过，跨端固定种子金标误差低于 `1e-4`。

下一个阶段是**网络 PVP 第一里程碑**，目标是把 `BattleSimulation` 改造为可接收双方输入、可快照恢复、可回放验算的确定性战斗内核，为接入 Nakama 做准备。

## 本轮（2026-07-21）已完成工作

### 1. Web → Godot 功能全量同步

Godot 端新增/升级功能：

| 模块 | 关键文件 | 完成内容 |
| --- | --- | --- |
| DIY 零件定制 | [part_customization.gd](file:///c:/Users/Admin/Downloads/战斗陀螺/scripts/assembly/part_customization.gd) | 材料倍率、尺寸、高度、轮廓、对称、归一化规则 |
| 组装计算器 | [assembly_calculator.gd](file:///c:/Users/Admin/Downloads/战斗陀螺/scripts/assembly/assembly_calculator.gd) | 平行轴惯量、DIY 参数应用、六参数计算 |
| 五件模型 | [five_part_top_model.gd](file:///c:/Users/Admin/Downloads/战斗陀螺/scripts/assembly/five_part_top_model.gd) | DIY 视觉表现、材料颜色/金属度、零件缩放、轮廓变体、高亮与损伤 |
| 组装界面 | [assembly_screen.gd](file:///c:/Users/Admin/Downloads/战斗陀螺/scripts/assembly/assembly_screen.gd) | 三出战槽、零件/材料购买所有权、点击部件进 DIY、教程引导、购买即装备 |
| DIY 界面 | [part_customize_screen.gd](file:///c:/Users/Admin/Downloads/战斗陀螺/scripts/assembly/part_customize_screen.gd) | 三视图、蓝/橙/红三色手柄、实时属性、对称切换、材料购买、保存/取消 |
| 存档系统 | [game_state.gd](file:///c:/Users/Admin/Downloads/战斗陀螺/scripts/core/game_state.gd) | v2 存档：3 loadouts、所有权、教程阶段、胜负奖励、旧存档兼容迁移 |
| 战斗模拟 | [battle_simulation.gd](file:///c:/Users/Admin/Downloads/战斗陀螺/scripts/battle/battle_simulation.gd) | 发射高度、imbalance、ring_out_risk、擦地损耗、风险状态、碰撞遥测、地形稳定性 |
| 战斗界面 | [battle_screen.gd](file:///c:/Users/Admin/Downloads/战斗陀螺/scripts/battle/battle_screen.gd) | 直接拖拽发射向量、高度滑杆、地图特征、教程跳过、DIY 模型传入、奖励落盘 |
| 地图选择 | [map_select_screen.gd](file:///c:/Users/Admin/Downloads/战斗陀螺/scripts/maps/map_select_screen.gd) | 前后卡片按钮、循环切换、OptionButton 兼容 |

### 2. 测试全量通过

Godot 端测试：
- `assembly_calculator_test` - 包含 DIY 和平行轴惯量验证
- `five_part_top_model_test` - 模型配置测试
- `battle_simulation_test` - 金标更新至 v2，含失衡/高度测试
- `battle_screen_test` - 教程状态恢复
- `collision_damage_test`
- `spin_mobility_test`
- `game_state_persistence_test` - 三槽/购买/DIY/所有权/迁移验证
- `arena_terrain_test`
- `map_select_screen_test`

Web 端测试：
- `npm test` 29/29 通过
- `npm run build` 成功

### 3. 文档更新

- [deterministic_battle_sync.md](file:///c:/Users/Admin/Downloads/战斗陀螺/docs/deterministic_battle_sync.md) - 更新跨端契约为 v2
- [network_pvp_architecture.md](file:///c:/Users/Admin/Downloads/战斗陀螺/docs/network_pvp_architecture.md) - PVP 架构完整方案已输出
- [README.md](file:///c:/Users/Admin/Downloads/战斗陀螺/README.md) - 项目状态更新

### 4. 场景更新

- [AssemblyScreen.tscn](file:///c:/Users/Admin/Downloads/战斗陀螺/scenes/assembly/AssemblyScreen.tscn)
- [PartCustomizeScreen.tscn](file:///c:/Users/Admin/Downloads/战斗陀螺/scenes/assembly/PartCustomizeScreen.tscn)
- [BattleScreen.tscn](file:///c:/Users/Admin/Downloads/战斗陀螺/scenes/battle/BattleScreen.tscn)
- [MapSelectScreen.tscn](file:///c:/Users/Admin/Downloads/战斗陀螺/scenes/maps/MapSelectScreen.tscn)

## 已确认的产品规则（冻结）

### 竞技系统
- **同步排位赛**：决定玩家的"段位"
- **异步积分赛**：决定同段位内的"排名/积分"
- 两种模式均采用**三局两胜制**
- 服务器匹配**同段位且积分接近**的对手
- 异步赛**赛前仅可见外观**，赛后才展示完整配置
- **首发中国地区**
- 游客限制：禁止进入排位赛；可参加积分赛体验，但**不获得/保存积分**

### 部署方案结论
- **Cloudflare 免费层不适合**：Workers 10ms CPU 限制、无法运行 Godot headless、中国网络需 Enterprise
- **MVP 推荐**：中国大陆 2C4G 云主机单节点部署 Nakama + CockroachDB + Godot headless
- Cloudflare 可用于静态资源/CDN/边缘入口，但不承担权威战斗

## 第一里程碑任务清单（按顺序执行）

依据 [network_pvp_architecture.md](file:///c:/Users/Admin/Downloads/战斗陀螺/docs/network_pvp_architecture.md) 第 9 节，验收标准为：

### 阶段 1：协议数据结构与输入源抽象

1. 创建 `scripts/battle/battle_manifest.gd` - 版本与调参清单
2. 创建 `scripts/battle/battle_protocol.gd` - 协议对象定义（LaunchCommand、InputFrame 等）
3. 创建 `scripts/battle/battle_input_source.gd` - 输入源接口
4. 创建 `scripts/battle/local_input_source.gd` - 本地玩家输入源
5. 创建 `scripts/battle/strategy_input_source.gd` - AI/兜底策略输入源（现有内置 AI 重构到此类）
6. 修改 `BattleSimulation.launch()` - 双方 LaunchCommand 完全显式传入
7. 修改 `BattleSimulation.step()` - 显式接收双方 InputFrame，不再内部生成 AI

**验收**：现有本地 AI 对战完全通过旧测试，行为不变。

### 阶段 2：快照、编码、哈希与回放

8. 创建 `scripts/battle/battle_state_codec.gd` - 快照规范化编码（无 Vector2/StringName 运行时类型）
9. 创建 `scripts/battle/battle_state_hasher.gd` - 状态哈希计算
10. 修改 `BattleSimulation` - 支持从任意检查点快照恢复
11. 创建 `scripts/battle/battle_replay_recorder.gd` - 输入与快照记录器
12. 创建 `scripts/battle/battle_replay_player.gd` - 回放播放器

**验收**：
- 同一票据和输入流连续重放 100 次，最终哈希完全一致
- 任意检查点导出并恢复后继续运行，结果与从第 0 帧运行一致
- 回放序列化落盘再加载，结果与内存回放一致

### 阶段 3：Headless 验算器

13. 创建 `scripts/server/headless_battle_host.gd` - headless 战斗宿主
14. 创建 `scripts/server/async_replay_verifier.gd` - 命令行回放验算入口
15. 编写命令行脚本可通过退出码表示：通过/非法/结果不一致

**验收**：Godot headless 可验算回放文件并给出正确退出码。

### 阶段 4：非法输入与边界测试

16. 新增自动化测试覆盖：
    - 非法零件 ID
    - 越界输入值
    - 错误 simulation_version
    - 重复 nonce
    - 篡改哈希
    - 双方输入来源切换

**验收**：所有非法情况有确定性错误处理，不崩溃。

### 阶段 5：双客户端观看（无真实网络）

17. 创建 `scripts/battle/network_input_source.gd` - 模拟网络输入源
18. 修改 `battle_screen.gd` - 消费 BattleSession 而非直接创建模拟
19. 创建两个本地客户端可通过模拟网络输入源观看同一权威状态

**验收**：双客户端表现一致，为后续接 Nakama 留接口。

## 关键代码边界（必须遵守）

1. **`BattleSimulation` 纯净性**：它只接收解析好的 `LaunchCommand` 和 `InputFrame`，不认识 AI、Nakama、UI 或网络。所有输入来源实现相同的 `BattleInputSource` 接口。
2. **奖励与结算服务器化**：本地 `GameState.apply_battle_result()` 后续只作为离线缓存；正式比赛奖励由 Nakama 结算，客户端不能直接加金币。
3. **调参冻结**：进入第一里程碑后，`battle_tuning` 参数不再随意修改；若需改物理，必须递增 `SIMULATION_VERSION`。
4. **测试先行**：每个协议改动先写失败测试，再实现，再验证金标。
5. **Windows PowerShell**：不要使用 `&&`，用 `;` 或分多条命令执行。

## 快速接手命令

### 运行 Godot 测试

```powershell
# 单个测试场景（Headless）
godot --headless --path . res://tests/battle/BattleSimulationTest.tscn
godot --headless --path . res://tests/core/GameStatePersistenceTest.tscn

# Web 测试
cd web-prototype
npm test
npm run build
```

### Git 配置（如未配置）

```powershell
git config user.name "陆瑞盛"
git config user.email "ruisheng.lu@hotmail.com"
```

## 建议先阅读的文件

1. [network_pvp_architecture.md](file:///c:/Users/Admin/Downloads/战斗陀螺/docs/network_pvp_architecture.md) - PVP 架构完整方案（最优先）
2. [deterministic_battle_sync.md](file:///c:/Users/Admin/Downloads/战斗陀螺/docs/deterministic_battle_sync.md) - 跨端同步契约
3. [battle_simulation.gd](file:///c:/Users/Admin/Downloads/战斗陀螺/scripts/battle/battle_simulation.gd) - 当前权威战斗内核
4. [game_state.gd](file:///c:/Users/Admin/Downloads/战斗陀螺/scripts/core/game_state.gd) - 存档 v2 结构
5. [assembly_calculator.gd](file:///c:/Users/Admin/Downloads/战斗陀螺/scripts/assembly/assembly_calculator.gd) - DIY 派生计算
6. `web-prototype/src/core/battle-simulation.js` - Web 权威参考实现

## 已知非阻塞项

- `battle_screen_test` 退出时有 ObjectDB/resources leak 警告，但测试通过，不影响功能
- Web 中的部分纯视觉动画（烟花、彩带、复杂镜头、槽位滚入）未逐帧复刻到 Godot
- Nakama SDK 集成、真实网络、匹配 UI 尚未开始（属于里程碑之后）

---

**下一步行动**：从第一里程碑阶段 1 开始，创建协议数据结构文件。
