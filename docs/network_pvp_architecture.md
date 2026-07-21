# 网络 PVP 架构设计

更新时间：2026-07-21

## 1. 已确认的产品方向

- 积分赛：异步 PVP，防守方由“输入录像 + 确定性策略接管”的混合幽灵控制。
- 排位赛：同步 PVP，从第一阶段就按公网移动网络设计。
- 排位赛决定段位；积分赛决定玩家在当前段位内的积分和排名。
- 两种正式比赛均采用三局两胜，取得两胜后立即结束系列赛。
- 积分赛只匹配同段位且积分接近的对手，优先提供积分略高的挑战目标。
- 积分赛结束前只展示对手外观，结束后才展示完整零件和 DIY 配置。
- 首发地区为中国；游客可体验积分赛，但不获得积分，也不能参加排位赛。
- 后端：Nakama 负责账号、匹配、排行和赛季；Godot headless 负责权威战斗。
- 第一里程碑：先完成协议、双人输入、回放、哈希和无界面验算，不先堆匹配 UI。

这两种模式必须共用同一个权威 `BattleSimulation`、同一套版本化配置和同一种
回放格式。模式差异只体现在输入来源、时间约束和结算流程。

## 2. 当前基础与主要缺口

现有项目已经具备适合联网改造的基础：

- `BattleSimulation` 使用固定 `1/60s` 步长。
- 规则层与 Godot 3D 表现已分离。
- 种子、零件 ID、地图参数和战斗快照已有雏形。
- Web 与 Godot 曾建立固定种子金标测试。

进入网络开发前必须先解决以下问题：

截至 2026-07-21，Web 的失衡、DIY、平行轴惯量、三出战槽、所有权、材料和教程
存档已经迁入 Godot，并重新建立了跨端金标。进入联网阶段还剩以下缺口：

1. `step()` 只接受玩家输入，敌方仍由内置 AI 生成输入。
2. `launch()` 的敌方发射参数仍由种子隐式生成。
3. 快照只能导出，不能从快照恢复；没有帧编号、输入记录器或回放播放器。
4. 快照包含 `Vector2`、`StringName` 等运行时类型，还没有跨平台规范化编码和哈希。
5. 种子固定、奖励和金币仍由本地客户端结算，不能用于正式 PVP。
6. 玩家可修改 `battle_tuning`，正式比赛必须改为服务器指定的冻结配置。

因此，第一步不是直接连接网络，而是把规则层改造成可由任意输入源驱动、可记录、
可恢复、可在 headless 进程中验算的战斗内核。

## 3. 总体架构

```text
Godot 客户端
  ├─ 本地输入、预测、插值、3D 表现
  ├─ Nakama SDK：登录、资料、匹配、排行
  └─ 战斗连接：带签名票据加入 Godot 权威房间

Nakama 控制平面
  ├─ 账号与会话
  ├─ 玩家库存、出战配置和赛季资料
  ├─ 异步对手池、积分榜和同步匹配队列
  ├─ 对局票据、幂等结算和风控
  └─ 分配 Godot 战斗实例

Godot headless 战斗平面
  ├─ 同步房间：60 Hz 权威模拟
  ├─ 异步验算：按回放离线重演
  ├─ 快照、状态哈希和战斗事件
  └─ 向 Nakama 提交签名结果

CockroachDB（正式）/ PostgreSQL（开发）/ 对象存储
  ├─ Nakama 账号、库存、积分和赛季数据
  └─ 压缩回放、审计记录和异常对局证据
```

不采用 P2P 或纯客户端锁步作为正式排位方案。GDScript 浮点在不同设备上存在长期
漂移风险，P2P 也无法可靠阻止篡改输入、属性和结算。客户端可以预测表现，但服务器
始终拥有最终状态和最终结果。

## 4. 权威边界

### 客户端可以决定

- 当前触控或传感器输入。
- 本地镜头、音效、粒子和动画。
- 非比赛设置，例如声音和画质。
- 对服务器快照做插值，以及对自己陀螺做短时预测。

### 服务器必须决定

- 可使用的零件、材料、DIY 参数和地图。
- 比赛调参、种子、双方出生位置和开局帧。
- 每帧采用的双方输入。
- 碰撞、伤害、胜负、积分、奖励和排行榜变化。
- 断线、超时、弃权、重复提交和异常输入处理。

本地 `GameState` 后续只作为缓存与离线设置容器。库存、金币、积分和正式出战配置
以 Nakama 为准，客户端不能直接增加奖励。

## 5. 统一战斗协议

协议对象先使用可读 JSON 完成开发和金标测试，稳定后可换成 MessagePack 或紧凑
二进制；对象含义和哈希前规范化规则保持不变。

### `BattleManifest`

```text
protocol_version
simulation_version
content_manifest_hash
tuning_profile_id
fixed_step_hz
```

`simulation_version` 发布后不可原地修改。规则变更必须生成新版本，旧回放继续使用
旧版验证器，直到对应赛季的申诉和审计窗口结束。

### `BuildSnapshot`

```text
owner_id
loadout_id
part_ids[5]
customizations_by_part_id
cosmetic_ids
build_hash
```

服务器根据版本化零件清单重新计算派生属性，不能接受客户端上传的质量、惯量、
攻击力或耐久等计算结果。

积分赛开始前，客户端只获得：

```text
PublicAppearanceSnapshot
signed_derived_battle_stats
sealed_build_hash
```

不下发零件 ID、材料 ID 和 DIY 明细。系列赛结算后，客户端才可请求完整
`BuildSnapshot`。需要承认：本地异步模拟必须拥有足够的派生战斗参数，因此这只能
阻止正常玩家在 UI 中提前查看，不能对已经逆向客户端的攻击者提供绝对保密。若未来
要求密码学意义上的保密，只能把交互模拟搬到服务器实时执行。

### `BattleTicket`

```text
match_id
mode
region
seed
arena_id
player_slots
build_snapshots
issued_at
expires_at
nonce
signature
```

### `LaunchCommand`

双方都显式提交：

```text
slot
power_q
height_q
direction_q
angle_q
```

所有连续输入进入协议前量化为整数，避免 JSON 浮点表示和设备噪声造成无意义差异。

### `InputFrame`

```text
frame
slot
sequence
control_x_q
control_y_q
flags
```

服务器固定以 60 Hz 推进。客户端可按 20 Hz 发送输入批次，每个输入覆盖三个模拟帧；
服务端状态快照初期按 15 至 20 Hz 广播。实际频率通过弱网测试调整，不写死在 UI。

### `BattleStateSnapshot`

```text
frame
phase
双方位置、速度、转速、耐久、倾角和失衡
result
state_hash
```

### `ReplayEnvelope`

```text
manifest
ticket_without_secret
双方 BuildSnapshot
双方 LaunchCommand
按帧排序的 InputFrame
检查点快照
final_state_hash
server_result
```

规范化哈希使用稳定字段顺序、整数化数值和明确的 UTF-8 编码。禁止直接对 Godot
`Dictionary` 的输出文本求哈希。

## 6. 异步积分赛

### 段位内积分与排名

- 每个段位维护独立积分榜，跨段位积分不直接比较。
- 服务器只提供同段位、积分接近且通常略高于挑战者的防守幽灵。
- 每张挑战票据绑定同一对手版本和三局两胜所需的全部种子；先取得两胜即结束。
- 推荐首版结算：挑战成功后，挑战者积分更新为
  `max(原积分 + 基础增量, 对手积分 + 1)`，确保成功挑战后排名超过目标。
- 挑战失败不增加积分；防守方积分不直接扣除，但会因挑战者超越而自然下移。
- 必须限制同一对手重复挑战、每日有效挑战次数，并按赛季软重置，避免刷分和无限膨胀。
- 游客使用相同匹配与战斗流程，但票据带 `unrated_guest` 标记，不写积分榜或赛季奖励。

### 防守幽灵发布

1. 玩家选择一个已验证的出战配置、发射参数和兜底策略。
2. 玩家在标准化训练场录制一段输入录像。
3. 每个录像采样同时记录轻量情境标签，例如距离档位、相对方向、所在半径区间、
转速区间和危险等级。
4. 服务器验证配置所有权、录像长度和输入范围，生成不可变的 `DefenseGhostVersion`。
5. 后续修改配置或策略会生成新版本，已经发出的挑战继续绑定旧版本。

### 挑战与验算

1. Nakama 根据段位、积分、近期对手和配置强度返回防守幽灵及一次性挑战票据。
2. 客户端本地运行战斗并记录挑战者输入；本地结果只用于即时表现。
3. 防守控制器逐帧检查录像情境是否仍适用。
4. 情境匹配时采用录像输入；偏离阈值、录像结束或录像缺帧时，由确定性策略接管。
5. 客户端提交压缩回放、最终哈希和票据 nonce。
6. Godot headless 从第 0 帧重演，只有服务端结果可触发积分和奖励。
7. 完成三局两胜或任一方先取得两胜后，Nakama 使用 `series_id + nonce` 幂等结算，
重复提交不会重复发奖或加分。

混合控制器本身属于 `simulation_version` 的一部分。情境分桶、接管阈值和策略参数
必须确定性执行，不能使用服务器当前时间或未记录的随机数。

## 7. 同步排位赛

排位赛只对已注册账号开放，采用三局两胜。它修改段位进度与隐藏匹配分，不直接修改
当前段位内的积分榜积分。升段后进入新段位积分榜的起始积分区间；降段时同理重置，
防止不同段位积分被错误比较。

### 房间流程

1. 两名玩家进入 Nakama 的分区匹配队列。
2. 匹配成功后锁定双方配置和 `simulation_version`。
3. 分配一个 Godot headless 房间，Nakama 签发短期加入票据。
4. 双方连接、校时、加载资源并发送 `ready`。
5. 服务器下发种子、开局帧和双方发射窗口。
6. 服务器按 60 Hz 权威推进，并接收带目标帧和序号的量化输入。
7. 客户端缓存约 100 至 150 ms 的远端快照做插值；本地陀螺可短时预测后校正。
8. 每小局结束后房间保留系列状态；任一方取得两胜后冻结最终结果并提交 Nakama。

### 延迟与断线原则

- 输入到达过晚时，服务器使用上一有效输入或归零，规则必须全局一致。
- 第一版不做完整回滚。当前状态量很小，权威快照加插值更容易验证和运维。
- 短时断线允许在限定窗口内重连并补发快照。
- 超过窗口后按已确认的产品规则判负、AI 接管或无效局；正式实现前需定案。
- 匹配按地区和延迟分桶，不能只按段位匹配。
- 服务器持续记录 RTT、抖动、丢包、迟到输入和校正幅度，作为排位质量与风控数据。

## 8. 推荐代码边界

```text
scripts/
  battle/
    battle_simulation.gd
    battle_manifest.gd
    battle_protocol.gd
    battle_state_codec.gd
    battle_state_hasher.gd
    battle_replay_recorder.gd
    battle_replay_player.gd
    battle_input_source.gd
    local_input_source.gd
    strategy_input_source.gd
    ghost_input_source.gd
    network_input_source.gd
  network/
    nakama_session.gd
    matchmaking_service.gd
    battle_ticket_service.gd
    authoritative_battle_client.gd
  server/
    headless_battle_host.gd
    async_replay_verifier.gd
```

`BattleSimulation` 只接收双方已经解析好的 `LaunchCommand` 和 `InputFrame`，不认识
AI、Nakama、UI 或网络连接。AI、混合幽灵、本地触控和网络对手都实现相同的
`BattleInputSource` 接口。

`battle_screen.gd` 不再自行创建敌方配置、固定种子或发放奖励，而是消费一个
`BattleSession`。这样本地 AI、异步积分、同步排位和回放观看可以复用同一场景。

## 9. 第一里程碑验收标准

1. Web 新规则与 Godot 规则重新对齐，冻结首个网络 `simulation_version`。
2. `BattleSimulation.step()` 可显式接收双方输入，双方发射参数也完全显式。
3. 同一票据和输入流连续重放 100 次，最终规范化哈希完全一致。
4. 在任意检查点导出并恢复后继续运行，最终结果与从第 0 帧运行一致。
5. 回放文件经过序列化、落盘和重新加载后，结果与内存回放一致。
6. Godot headless 可通过命令行验算回放，并用退出码表示通过、非法或结果不一致。
7. 非法零件、越界输入、错误版本、重复 nonce 和篡改哈希都有自动化测试。
8. 两个本地客户端可通过模拟网络输入源观看同一权威状态，为后续接 Nakama 留接口。

完成这些标准后，再分别进入异步积分赛 MVP 和同步房间 MVP，返工风险最低。

## 10. 低成本部署与 Cloudflare

### Cloudflare 能做什么

- Workers Free 提供每日 100,000 请求，但单次调用只有 10 ms CPU，适合轻量 API、
  票据签名、Webhook 和静态配置，不适合持续运行 Godot 60 Hz 权威模拟。
- SQLite Durable Objects 在免费计划可用，适合原型期房间协调和 WebSocket 状态，
  但仍受 Workers CPU/内存限制，不能直接运行 GDScript 或 Godot headless。
- Cloudflare Containers 可以运行容器，但终端用户只能通过 Worker 以 HTTP/WebSocket
  访问，目前不能直接向容器发起原生 TCP/UDP；不应作为首版 Godot 实时服务器前提。
- Cloudflare 中国网络不是普通免费套餐：官方要求 Enterprise、单独购买 China
  Network、有效 ICP 和京东云内容审核，因此不符合本项目“尽可能低成本”的首发目标。

官方参考：

- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/durable-objects/platform/limits/
- https://developers.cloudflare.com/containers/platform-details/architecture/
- https://developers.cloudflare.com/china-network/get-started/

### 推荐的最低成本路径

1. 本地开发期：Docker Compose 免费运行 Nakama、PostgreSQL 和 Godot headless。
2. 中国小规模技术封测：可暂用 PostgreSQL 降低资源占用，但它不作为正式生产基线。
3. 中国正式测试：使用一台中国大陆 `2 vCPU / 4 GB` 起步云主机，共置 Nakama、
   单节点 CockroachDB 和 Godot headless；压测后再决定是否升到 `4 vCPU / 8 GB`。
4. 公测前：数据库与战斗进程再拆机，优先保证战斗节点 CPU 和网络抖动。
5. Cloudflare 免费层只用于海外静态站、下载页或非关键 API 实验，不代理中国实时战斗。

大陆公网部署域名通常需要 ICP 备案。若暂时没有备案，可用香港节点做技术封测，但
大陆移动网络延迟和跨境线路波动不适合作为正式同步排位质量基线。

## 11. 后续仍需确认的产品规则

- 段位名称、升降段阈值、隐藏匹配分公式和赛季周期。
- 积分基础增量、每日挑战票数量、同一对手冷却和防守幽灵更新频率。
- 三局中的地图是全程固定、服务端轮换，还是双方禁选。
- 排位断线重连窗口、主动退出处罚和服务器故障时的无效局规则。
- 中国首发目标最大 RTT，以及首轮封测使用大陆备案节点还是香港临时节点。

## 12. 协作方式

### 我负责

- 维护协议、架构文档和版本迁移说明。
- 重构确定性规则层、回放、哈希、headless 验算器与自动化测试。
- 接入 Nakama SDK、服务端运行时代码、Docker 开发环境和本地压测工具。
- 根据日志定位不同步、迟到输入、断线恢复和结算问题。
- 每个阶段给出可运行验收路径，并保持 Git 提交边界清晰。

### 你需要配合

- 对第 10 节的产品规则做选择，尤其是断线与计分规则。
- 提供最终部署目标：本地服务器、云主机或容器平台，以及预计首发地区。
- 创建云账号、域名和证书；密钥只写入本机 `.env` 或平台 Secret，不发到聊天中。
- 使用至少两台手机完成真实 Wi-Fi、4G/5G、切后台和断网重连测试。
- 反馈时提供设备型号、系统版本、网络类型、对局 ID、复现步骤和日志。
- 在规则和手感阶段确认版本冻结点，避免协议开发期间继续无版本地修改物理公式。

推荐协作节奏是：我完成一个可自动验收的纵向切片，你在真机执行明确测试清单；
确认后冻结对应协议版本并提交，再进入下一切片。
