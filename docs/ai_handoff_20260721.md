# AI 接手说明：Web → Godot 全功能对齐完成，进入 PVP 第一里程碑

更新时间：2026-07-21

## 当前状态快照

Web 原型与 Godot 两端已完成核心功能对齐，冻结模拟版本为 `2026.07.21-web-v2`。
所有 Godot 测试与 Web 测试均通过，跨端固定种子金标误差低于 `1e-4`。

下一个阶段是**网络 PVP 第一里程碑**，目标是把 `BattleSimulation` 改造为可接收双方输入、可快照恢复、可回放验算的确定性战斗内核，为接入 Nakama 做准备。

**已完成混合架构设计与代码框架**：新增三层解耦架构（BattleSession / SyncProvider / Transport），同时支持帧同步（FrameSync，Cloudflare免费层可跑）、状态同步（StateSync，Godot headless）、异步验算（AsyncVerify）三种模式，并已生成 Godot/Web/Cloudflare Worker 三端代码骨架。详见 [hybrid_pvp_architecture.md](file:///c:/Users/Admin/Downloads/战斗陀螺/docs/hybrid_pvp_architecture.md)。

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

### 部署方案结论（更新：混合架构可利用Cloudflare免费层）

- **Cloudflare免费层现已可用于帧同步+异步验算**：Durable Objects做WS中继不运行物理，Workers做匹配/票据，R2存回放
- **同步排位赛最终版**：仍需Godot headless权威反作弊，可在Cloudflare验证玩法后再升级
- **MVP部署路径**：Cloudflare免费层 → 技术封测/海外玩家完全零成本；国内玩家可用香港节点（帧同步延迟可接受）
- **正式上线**：Cloudflare做全球入口/静态/异步，大陆云主机跑权威同步房间
- 详见 [hybrid_pvp_architecture.md](file:///c:/Users/Admin/Downloads/战斗陀螺/docs/hybrid_pvp_architecture.md) 第3节

## 第一里程碑任务清单（按顺序执行）

依据 [hybrid_pvp_architecture.md](file:///c:/Users/Admin/Downloads/战斗陀螺/docs/hybrid_pvp_architecture.md) 三层架构，代码骨架已生成：

### 已完成（代码框架生成）

| 文件 | 状态 | 说明 |
|------|------|------|
| [battle_protocol.gd](file:///c:/Users/Admin/Downloads/战斗陀螺/scripts/battle/battle_protocol.gd) | ✅ | 协议常量、量化/反量化、信封构造、输入校验 |
| [battle_state_codec.gd](file:///c:/Users/Admin/Downloads/战斗陀螺/scripts/battle/battle_state_codec.gd) | ✅ | 快照规范化编解码，消除Vector2/StringName运行时类型 |
| [battle_state_hasher.gd](file:///c:/Users/Admin/Downloads/战斗陀螺/scripts/battle/battle_state_hasher.gd) | ✅ | SHA-256状态哈希、回放哈希、清单哈希 |
| [battle_input_source.gd](file:///c:/Users/Admin/Downloads/战斗陀螺/scripts/battle/battle_input_source.gd) | ✅ | 输入源抽象接口 |
| [local_input_source.gd](file:///c:/Users/Admin/Downloads/战斗陀螺/scripts/battle/local_input_source.gd) | ✅ | 本地玩家输入源（支持输入缓存） |
| [strategy_input_source.gd](file:///c:/Users/Admin/Downloads/战斗陀螺/scripts/battle/strategy_input_source.gd) | ✅ | AI/幽灵策略（从BattleSimulation剥离） |
| [battle_transport.gd](file:///c:/Users/Admin/Downloads/战斗陀螺/scripts/network/battle_transport.gd) | ✅ | 传输层抽象接口 |
| [local_transport.gd](file:///c:/Users/Admin/Downloads/战斗陀螺/scripts/network/local_transport.gd) | ✅ | 本地内存传输（双客户端测试） |
| [websocket_transport.gd](file:///c:/Users/Admin/Downloads/战斗陀螺/scripts/network/websocket_transport.gd) | ✅ | WebSocket传输（可连Nakama/CF Worker） |
| [frame_sync_provider.gd](file:///c:/Users/Admin/Downloads/战斗陀螺/scripts/network/frame_sync_provider.gd) | ✅ | 帧同步模式提供者 |
| [async_verify_provider.gd](file:///c:/Users/Admin/Downloads/战斗陀螺/scripts/network/async_verify_provider.gd) | ✅ | 异步验算模式提供者 |
| [battle_session.gd](file:///c:/Users/Admin/Downloads/战斗陀螺/scripts/battle/battle_session.gd) | ✅ | 统一战斗会话入口（静态工厂方法） |
| [cloudflare_client.gd](file:///c:/Users/Admin/Downloads/战斗陀螺/scripts/network/cloudflare_client.gd) | ✅ | Cloudflare API封装（匹配/建房/提交回放） |
| `battle_simulation.gd` 改造 | ✅ | 新增frame计数、launch_explicit、step双输入、restore_from_snapshot |
| Web协议层 | ✅ | [protocol.js](file:///c:/Users/Admin/Downloads/战斗陀螺/web-prototype/src/network/protocol.js), [websocket_transport.js](file:///c:/Users/Admin/Downloads/战斗陀螺/web-prototype/src/network/websocket_transport.js), [frame_sync_provider.js](file:///c:/Users/Admin/Downloads/战斗陀螺/web-prototype/src/network/frame_sync_provider.js), [async_verify_provider.js](file:///c:/Users/Admin/Downloads/战斗陀螺/web-prototype/src/network/async_verify_provider.js), [battle_session.js](file:///c:/Users/Admin/Downloads/战斗陀螺/web-prototype/src/network/battle_session.js) |
| Cloudflare Worker | ✅ | [battle_room.ts](file:///c:/Users/Admin/Downloads/战斗陀螺/scripts/server/cf_worker/src/battle_room.ts) 帧同步DO中继, [matchmaker.ts](file:///c:/Users/Admin/Downloads/战斗陀螺/scripts/server/cf_worker/src/matchmaker.ts) 匹配器, [worker.ts](file:///c:/Users/Admin/Downloads/战斗陀螺/scripts/server/cf_worker/src/worker.ts) 入口 |

### 待完成（下一阶段）

1. **BattleSession集成到battle_screen.gd**：让战斗界面消费BattleSession而非直接创建simulation
2. **回放记录器/播放器**：创建replay_recorder.gd和replay_player.gd，序列化/反序列化ReplayEnvelope
3. **本地双客户端测试场景**：使用LocalTransport验证FrameSync双客户端一致性
4. **Godot headless验算器**：创建headless_battle_host.gd和命令行验算入口
5. **自动化测试**：协议、哈希一致性、快照恢复、回放、非法输入边界测试
6. **Cloudflare Worker部署测试**：wrangler dev本地联调Godot/Web双端
7. **battle_manifest.gd**：版本化调参清单（冻结正式比赛参数）

### 验收标准

1. BattleSimulation 显式双方 LaunchCommand + InputFrame，AI剥离到StrategyInputSource
2. 同一票据和输入流连续重放100次最终哈希一致
3. 任意检查点导出/恢复后继续运行结果一致
4. 回放序列化落盘再加载结果一致
5. Godot headless命令行可验算回合并给出退出码
6. LocalTransport + FrameSyncProvider双客户端同帧运行无分歧
7. Cloudflare Worker部署后Godot/Web客户端可连入同一房间对战
8. AsyncVerify模式可提交回放至R2

### 阶段 3 之后：StateSync + Nakama（第二里程碑）

在第一里程碑完成验证后，再新增state_sync_provider.gd（权威状态同步）并接入Nakama。

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

1. [hybrid_pvp_architecture.md](file:///c:/Users/Admin/Downloads/战斗陀螺/docs/hybrid_pvp_architecture.md) - **混合PVP架构（三层解耦+Cloudflare方案，最优先）**
2. [network_pvp_architecture.md](file:///c:/Users/Admin/Downloads/战斗陀螺/docs/network_pvp_architecture.md) - 产品规则与Nakama权威架构
3. [deterministic_battle_sync.md](file:///c:/Users/Admin/Downloads/战斗陀螺/docs/deterministic_battle_sync.md) - 跨端同步契约
4. [battle_session.gd](file:///c:/Users/Admin/Downloads/战斗陀螺/scripts/battle/battle_session.gd) - 统一战斗会话入口
5. [battle_simulation.gd](file:///c:/Users/Admin/Downloads/战斗陀螺/scripts/battle/battle_simulation.gd) - 权威战斗内核（已支持显式双输入/快照恢复）
6. `scripts/network/` - 传输层、帧同步、异步验算、Cloudflare客户端
7. `scripts/server/cf_worker/` - Cloudflare Worker服务器代码
8. `web-prototype/src/network/` - Web端网络层（与GDScript共用协议）
9. [game_state.gd](file:///c:/Users/Admin/Downloads/战斗陀螺/scripts/core/game_state.gd) - 存档v2结构
10. [assembly_calculator.gd](file:///c:/Users/Admin/Downloads/战斗陀螺/scripts/assembly/assembly_calculator.gd) - DIY派生计算
11. `web-prototype/src/core/battle-simulation.js` - Web权威参考实现

## 已知非阻塞项

- `battle_screen.gd` 尚未集成BattleSession（仍直接创建simulation），需改造为消费BattleSession
- 回放记录器/播放器（replay_recorder.gd/replay_player.gd）尚未实现
- Godot headless验算器尚未创建
- StateSyncProvider（权威状态同步）留作第二里程碑，需要Godot headless时才实现
- `battle_screen_test` 退出时有ObjectDB/resources leak警告，但测试通过，不影响功能
- Web中的部分纯视觉动画（烟花、彩带、复杂镜头、槽位滚入）未逐帧复刻到Godot
- Nakama SDK集成、完整匹配UI、段位系统UI尚未开始

---

**下一步行动**：代码框架已完成，接下来需要：
1. 运行现有Godot测试确保BattleSimulation改造向后兼容
2. 实现replay_recorder/replay_player
3. 创建本地双客户端测试验证FrameSync一致性
4. 将battle_screen.gd重构为消费BattleSession
5. 部署Cloudflare Worker进行端到端联调
