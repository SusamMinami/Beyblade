# 混合 PVP 架构：同步模式提案与实现状态

更新时间：2026-07-21

## 2026-09-16 实现核对

本文后三层架构与路线图属于设计提案；“可支持”不是已通过公网联调。
当前开发仍先做 Web，再移植 Godot。

| 项目 | 当前代码证据 | 尚未证明或缺失 |
| --- | --- | --- |
| 双输入、双方发射、帧计数 | 两端求解器均有对应入口 | 旧 AI 路径仍保留，不能称完全剥离 |
| 快照恢复 | Godot 有 `restore_from_snapshot()` | Web 尚无对应恢复接口 |
| 会话集成 | Godot `battle_screen.gd` 已接入 BattleSession | Web `main.js` 仍直接创建求解器 |
| 协议 | 三端 `protocol` 为二进制 v2、模拟标识 `2026.07.21-bin` | 与当前 Web v3 求解器的兼容未建立 |
| FrameSync / AsyncVerify | 两端 provider、transport、回放数据组装存在 | 代码存在不等于跨端/弱网/持久化重放验收完成 |
| 回放提交 | Worker HTTP 接口写入 R2 并返回 accepted | 无权威重演、积分结算或验算队列实现依据 |
| 独立播放器、headless 验算器、StateSync | 当前源码清单未见对应实现 | 仍待开发与验收 |

版本来源与共有契约见 [确定性同步](deterministic_battle_sync.md)。
现有接口与本地开发见 [Worker 指南](../scripts/server/cf_worker/README.md)。
产品与正式结算规则由 [network_pvp_architecture](network_pvp_architecture.md) 维护。
下文的乐观积分、抽验比例是备选提案，尚未替代“验算后正式结算”的产品方向。

## 1. 核心设计思想：三层解耦

现有架构把"权威服务器"作为单一前提，但这导致必须运行 Godot headless。
为了支持 **Web 接入**、**Cloudflare 免费层**、**渐进式部署**，我们将网络栈拆为三层：

```text
┌─────────────────────────────────────────────────────────────┐
│                    BattleSession（战斗会话）                 │
│  统一生命周期：准备 → 发射 → 战斗 → 结算 → 退出             │
│  消费 InputFrame，产出 StateSnapshot，不关心输入从哪来       │
├─────────────────────────────────────────────────────────────┤
│                    SyncProvider（同步模式提供者）            │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│  │ FrameSync    │ │ StateSync    │ │ AsyncVerify          │ │
│  │ 帧同步中继    │ │ 权威状态同步  │ │ 异步本地+延迟验算     │ │
│  │ (锁步/中继)   │ │ (服务器权威)  │ │ (客户端模拟+服务器验) │ │
│  └──────────────┘ └──────────────┘ └──────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                   Transport（传输层）                        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│  │ LocalTransport│ │WebSocketTransport│ │ WebRTCTransport  │ │
│  │ 本地内存      │ │ WS (Nakama/CF) │ │ P2P (可选)         │ │
│  └──────────────┘ └──────────────┘ └──────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**关键收益**：
- 同一套 `BattleSession` 代码支持本地 AI、异步积分、同步排位、回放观看
- 同步模式可以热切换：开发期用帧同步快速验证，正式期切换到状态同步反作弊
- 传输层完全可插拔：Nakama、Cloudflare Workers、自建 WebSocket、甚至本地内存
- Web 客户端和 Godot 客户端使用**完全相同的协议**和同步逻辑

## 2. 三种同步模式详解

### 模式 A：FrameSync（帧同步 / 锁步中继）

**适用场景**：
- Cloudflare 免费层同步排位 MVP
- 本地双人对战测试
- 好友约战（可接受弱反作弊）

**工作原理**：
1. 所有客户端运行**完全相同**的确定性 `BattleSimulation`
2. 中继服务器（Cloudflare Durable Object / Nakama / 本地内存）只做：
   - 收集双方 InputFrame
   - 按帧号打包转发
   - 不运行物理、不计算碰撞
3. 客户端等待双方输入到达后再推进模拟（锁步），或做本地预测+回滚修正
4. 每 30/60 帧交换一次状态哈希，不一致时触发慢速同步或分歧上报

**Cloudflare 可行性**：作为技术封测候选，需核实账号计划和压测。
当前 BattleRoom 还持久化房间状态；不能按“仅内存、每消息必低于某耗时”估算成本。
Worker 请求、DO 请求/时长及存储有不同计费口径，不能只看 HTTP 请求数。

### 模式 B：StateSync（权威状态同步）

**适用场景**：
- 正式排位赛（有 Godot headless 服务器时）
- 需要强反作弊的场景

**工作原理**：
1. Godot headless 运行权威 `BattleSimulation`
2. 客户端只发送输入，接收服务器下发的 `StateSnapshot`
3. 客户端做插值渲染和短时输入预测
4. 服务器每 15-20Hz 广播快照，输入按 20Hz 上报

**Cloudflare 免费层可行性**：❌ 不可直接运行
- 需要持续 60Hz Godot 物理进程
- 可后续升级到付费 Containers 或自建服务器

### 模式 C：AsyncVerify（异步本地 + 延迟验算）

**适用场景**：
- 异步积分赛（主要模式）
- Cloudflare 可承接回放上传；完整验算仍需独立实现和资源评估

**工作原理**：
1. 挑战者客户端本地运行完整战斗（防守方用幽灵 AI）
2. 客户端记录完整 `ReplayEnvelope`（输入流 + 关键检查点哈希）
3. 提交后 Cloudflare Workers：
   - 立即做**轻量校验**（输入范围、nonce、哈希格式、时间戳）
   - 通过后"乐观更新"积分（前端可立即看到结果）
   - 将回放写入 R2 入队，等待**延迟验算**
4. 验算 Worker（或外部 Godot headless 爬虫）批量处理队列：
   - 如果验算哈希一致 → 确认结果
   - 如果不一致 → 标记异常，回滚积分，加入风控
   - 初期可以只抽验 10%，高排名对局/被举报对局全验

**实现边界**：当前只有回放数据组装和 R2 上传，不包含上述完整验算/积分流程。
客户端哈希不能独立证明结果可信；正式结算仍需遵循产品文档的权威验算目标。
验算计算量、队列产品资格和套餐额度均待核实。

## 3. Cloudflare 部署提案

### 3.1 架构拓扑

```text
┌─────────────────────────────────────────────────────────────────┐
│                         Cloudflare (免费层)                     │
│                                                                 │
│  ┌─────────────┐    ┌─────────────────┐    ┌─────────────┐      │
│  │   Worker    │◄──►│ Durable Object  │◄──►│     R2      │      │
│  │ (API网关)   │    │ (房间/匹配中继) │    │ (回放存储)  │      │
│  │             │    │  - FrameSync    │    │             │      │
│  │ - 登录鉴权  │    │  - 输入转发     │    │ - ReplayEnv │      │
│  │ - 匹配队列  │    │  - 房间状态     │    │ - GhostData │      │
│  │ - 票据发放  │    │  - 哈希校验     │    │ - 验算队列  │      │
│  │ - 积分结算  │    │                 │    │             │      │
│  │ - 排行榜    │    └─────────────────┘    └─────────────┘      │
│  │ - D1/Cache  │                                               │
│  └─────────────┘    ┌─────────────────┐                         │
│       ▲             │  D1 SQLite      │                         │
│       │             │ (账号/存档/积分)│                         │
│       │             └─────────────────┘                         │
│       │                                                         │
└───────┼─────────────────────────────────────────────────────────┘
        │
    WebSocket / HTTPS
        │
   ┌────┴────┐
   │ 客户端  │  Godot / Web (Three.js)
   └─────────┘
```

### 3.2 费用与容量评估（待重新核实）

旧版“完全免费、每日约 15,000 局、DO 无请求限制”等估算没有当前账号或压测依据，
不再作为容量承诺。检查 Worker、DO 类型与迁移、存储、WebSocket 消息/时长、
队列和验算主机的完整成本。官方核对入口统一在
[Worker 指南](../scripts/server/cf_worker/README.md)，不在多个文档复制套餐数字。

**注意**：Cloudflare 免费层不含中国网络。面向中国玩家需要：
- 方案1：Cloudflare 做海外/全球入口，香港候选节点需在目标运营商网络实测 RTT 与抖动
- 方案2：国内节点（自建/阿里云/腾讯云）处理中国玩家，Cloudflare 做海外备份
- 方案3：首发技术测试先允许高延迟，验证玩法后再上国内节点

### 3.3 分阶段部署路线

| 阶段 | 部署方案 | 同步模式 | 成本 |
|------|---------|---------|------|
| **M1: 本地开发** | 无服务器，LocalTransport | FrameSync + Local AI | 免费 |
| **M2: 技术封测** | Cloudflare 候选计划 | 回放上传 + FrameSync 中继 | 按实际套餐与压测核算 |
| **M3: 小规模公测** | CF + 验算主机 | 同上 + Godot批量验算 | 待核算 |
| **M4: 正式上线** | CF(静态/API) + 云主机(权威房间) | StateSync排位 + AsyncVerify积分 | 待核算 |
| **M5: 大规模** | 多区域集群 | 全模式 | 按规模 |

## 4. 统一核心接口设计

### 4.1 原 JSON 概念模型（历史设计）

下面保留设计时的消息含义，**不可作为当前发包格式**。
实际三端已使用二进制 v2，消息编号、字节布局和输入批大小以源文件为准。
原 JSON 信封：

```json
{
  "type": "message_type",
  "seq": 123,
  "ack": 120,
  "data": { ... }
}
```

**核心消息类型**（帧同步/状态同步/异步通用）：

| 方向 | Type | 说明 |
|------|------|------|
| C→S | `hello` | 握手，带票据、协议版本、simulation_version |
| S→C | `welcome` | 握手成功，分配slot、同步时钟 |
| C→S | `ready` | 加载完成，准备开始 |
| S→C | `launch_window` | 发射窗口打开，带时间窗 |
| C→S | `launch` | 提交 LaunchCommand |
| S→C | `launch_both` | 下发双方发射参数（帧同步模式） |
| C→S | `input` | InputFrame（批量） |
| S→C | `input_batch` | 帧同步：转发双方输入批次 |
| S→C | `snapshot` | 状态同步：下发权威快照 |
| S→C | `event` | 战斗事件（碰撞、风险、结束） |
| S→C | `hash_check` | 哈希校验请求/响应 |
| C→S | `replay_submit` | 异步模式：提交完整回放 |
| S→C | `result` | 本局/系列赛结果 |

### 4.2 SyncProvider 状态机

所有同步模式实现相同的状态机接口：

```text
INIT → CONNECTING → READY → LAUNCH_WINDOW → RUNNING → FINISHED → CLOSED
               ↑            ↓              ↑         ↓
               └── 断线重连 ──┴──────────────┴─────────┘
```

### 4.3 确定性输入量化

下表是旧 JSON 提案；例如方向 `int16` 已与当前二进制 `int8` 不同。
接入时使用三端协议实现，不照抄此表。当前 `INPUT_BATCH_SIZE` 为 6。

所有浮点输入进入协议前必须量化为整数，避免跨平台浮点差异：

| 参数 | 量化方式 | 范围 | 精度 |
|------|---------|------|------|
| power (launch) | uint8: (v-0.35)/0.65*255 | 0-255 | ~0.0025 |
| height (launch) | uint8: v*255 | 0-255 | ~0.004 |
| direction (launch) | int16: degrees*10 | -1800~1800 | 0.1° |
| angle (launch) | int8: v*127 | -127~127 | ~0.008 |
| control_x/y | int8: v*127 | -127~127 | ~0.008 |
| flags | uint8 bitmask | 0-255 | 布尔集合 |

## 5. 与现有 BattleSimulation 的集成

### 5.1 BattleSimulation 改造点

以下是原改造目标，已完成的部分见文首状态表；不要重复创建现有接口：

1. `launch()` 改为接收显式的双方 `LaunchCommand`，不再内部生成敌方发射
2. `step()` 改为接收双方 `InputFrame`（或解量化后的 Vector2），不再调用 `_get_enemy_control()`
3. 新增 `restore_from_snapshot(snapshot_dict)` 方法
4. 新增 `get_normalized_snapshot()` 返回无运行时类型的纯数据字典
5. 新增 `compute_state_hash()` 返回规范化 SHA-256 哈希
6. AI/幽灵策略从 BattleSimulation 中剥离到 `StrategyInputSource`

### 5.2 BattleSession 统一接口

```gdscript
class_name BattleSession
extends RefCounted

signal phase_changed(new_phase: StringName)
signal state_updated(snapshot: Dictionary)
signal event_occurred(event: Dictionary)
signal battle_finished(result: Dictionary)
signal error_occurred(code: int, message: String)

func configure(mode: StringName, ticket: Dictionary, transport: BattleTransport) -> void
func connect_to_room() -> void
func submit_ready() -> void
func submit_launch(command: Dictionary) -> void
func submit_input(control: Vector2, flags: int) -> void
func poll(delta: float) -> void  # 每帧调用，驱动内部模拟/插值
func get_render_snapshot() -> Dictionary  # 返回插值后的渲染状态
func disconnect() -> void
```

## 6. Web 端接入方案

Web 端（Three.js 原型）和 Godot 端**共享协议、量化规则、同步状态机**，区别仅在于：

| 组件 | Godot | Web |
|------|-------|-----|
| BattleSimulation | GDScript | JavaScript（现有） |
| Transport | GDScript WebSocketClient | 原生 WebSocket API |
| SyncProvider | GDScript | JavaScript（共用逻辑） |
| 渲染 | Node3D + MeshInstance | Three.js |
| 音频 | AudioStreamPlayer | Tone.js |

**代码复用策略**：
- 协议常量和量化函数在两端各自实现但保持一致（由测试保证）
- 后续可将核心协议和同步逻辑编译为 WASM 共享
- 当前三端分别实现二进制 v2；兼容性必须用共同输入、字节样本和金标测试验证

## 7. 反作弊与风控渐进策略

不同部署阶段采用不同强度的反作弊：

| 阶段 | 反作弊手段 |
|------|-----------|
| M2 技术封测 | 版本锁定、哈希链、输入范围校验、服务器不跑物理 |
| M3 小规模 | 增加抽验（10%回放用 Godot headless 验算）、举报全验、异常模式检测 |
| M4 正式 | 同步排位切换为 StateSync（Godot权威），异步保留AsyncVerify+抽验 |

**核心洞察**：陀螺对战单局时长 <75秒，回放极小（约5-20KB），抽验成本极低。
即使不实时跑服务器权威，事后验算+积分回滚+封禁足以威慑大部分作弊。

## 8. 目标文件结构（不是现有文件清单）

实际 Worker 文件直接位于 `src/battle_room.ts`、`src/matchmaker.ts`；
下列 `durable_objects/`、`storage/` 等目录属于原规划。

```text
scripts/
  battle/
    battle_simulation.gd            # [修改] 支持显式双方输入、快照恢复、哈希
    battle_session.gd               # [新增] 统一战斗会话，屏蔽同步模式差异
    battle_protocol.gd              # [新增] 消息类型、量化、协议常量
    battle_state_codec.gd           # [新增] 快照规范化编解码
    battle_state_hasher.gd          # [新增] 状态哈希计算
    battle_input_source.gd          # [新增] 输入源接口
    local_input_source.gd           # [新增] 本地玩家输入
    strategy_input_source.gd        # [新增] AI/幽灵策略（从simulation剥离）
    replay_recorder.gd              # [新增] 输入与快照记录
    replay_player.gd                # [新增] 回放播放器
  network/
    battle_transport.gd             # [新增] 传输层接口
    local_transport.gd              # [新增] 本地内存传输（测试/单机双人）
    websocket_transport.gd          # [新增] WebSocket客户端（可连Nakama/CF）
    frame_sync_provider.gd          # [新增] 帧同步中继模式
    state_sync_provider.gd          # [新增] 权威状态同步模式（预留）
    async_verify_provider.gd        # [新增] 异步验算模式
    cloudflare_client.gd            # [新增] Cloudflare API封装（匹配/登录/提交）
  server/                           # 服务器端代码（Godot headless / CF Workers）
    headless_battle_host.gd         # 权威战斗宿主
    async_replay_verifier.gd        # 回放验算命令行入口
    cf_worker/                      # Cloudflare Worker 代码（TypeScript）
      src/
        worker.ts                   # 入口：路由、API
        durable_objects/
          battle_room.ts            # 帧同步房间DO
          matchmaker.ts             # 匹配队列DO
        storage/
          replay_bucket.ts          # R2 回放封装
          d1_client.ts              # D1 数据访问
        protocol.ts                 # 协议常量（与GDScript/JS对齐）
        quantize.ts                 # 量化/反量化（与客户端一致）
web-prototype/src/
  network/
    battle_session.js               # Web端战斗会话（与GD接口对齐）
    websocket_transport.js          # Web端WS传输
    frame_sync_provider.js          # Web端帧同步
    async_verify_provider.js        # Web端异步提交
    protocol.js                     # Web端协议/量化（与GDScript测试对齐）
```

## 9. 第一里程碑修订版

以下为**待验收目标**，不再用完成勾选表示未证实的结果：

1. 双方显式输入与发射在同版本规则下得到一致状态。
2. 两端快照恢复、规范化编码与哈希一致。
3. LocalTransport 双客户端同帧无分歧。
4. 回放序列化、落盘、重新读取与重演一致。
5. 命令行验算器对通过、非法输入、结果不一致返回明确退出码。
6. Web / Godot 使用相同协议和求解器版本通过 Worker 双客户端联调。
7. 明确区分回放上传成功、验算完成和正式结算。
8. StateSync / Nakama 留作后续阶段。

当前完成程度以文首代码核对为准；本次文档整理没有执行网络运行时验收。
