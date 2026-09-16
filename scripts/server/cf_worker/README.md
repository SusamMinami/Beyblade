# Beyblade Battle Server (Cloudflare Worker)

基于 Cloudflare Workers + Durable Objects 的帧同步中继与 R2 回放上传原型。
文档与源码静态核对：2026-09-16；本次没有部署或公网联调。
Web / Godot / Worker 的协议声明相同，但求解器版本已有差异，不能据此宣称跨端对战已兼容。
见 [版本边界](../../../docs/deterministic_battle_sync.md)。

## 架构概览

```
Godot Client ─┐                          ┌─ Godot Client
              ├─ WebSocket ──> BattleRoom DO (帧同步中继)
Web Client ───┘                          └─ Web Client
                      │
                      ├── R2 (回放存储)
                      └── Matchmaker DO (匹配队列)
```

**帧同步模式**：Durable Object 中继输入、哈希及房间状态，不运行权威物理。
哈希交换用于发现状态分歧，不能独立证明结果合法或保证防作弊。

## 前置要求

- **Node.js/npm**：版本需符合安装锁文件中的工具要求；当前声明 `wrangler: ^3.60.0`。
  `^` 是版本范围，不是精确固定版本。
- **Cloudflare 账号**：实际计划、DO 存储类型、R2 开通条件及费用需在部署前核实，
  本指南不承诺无需绑卡或全栈免费。
- **Git**（可选）

## 快速部署（Windows）

本目录下提供了一键 PowerShell 部署脚本 `deploy.ps1`。

### 第一次部署：

```powershell
cd scripts/server/cf_worker
.\deploy.ps1 -Setup
```

脚本会自动：
1. 检查 Node.js/npm 是否安装
2. 执行 `npm install` 安装 wrangler 和 TypeScript
3. 执行 `wrangler login` 打开浏览器完成 Cloudflare 授权
4. 自动创建 R2 存储桶 `beyblade-replays`（如果不存在）

Setup 完成后，执行正式部署：

```powershell
.\deploy.ps1
```

成功后会输出类似：
```
=== Deployment successful! ===
Health check: GET https://beyblade-battle-server.<你的子域名>.workers.dev/api/health
```

脚本自己的成功提示仍打印旧 `/health`；源码当前只实现 `/api/health`。
Setup 中 R2 创建错误被重定向，不能仅凭其“ready”提示断言桶已创建，需核对实际结果。

### 本地开发调试

```powershell
.\deploy.ps1 -Dev          # 启动本地 dev server (默认 http://localhost:8787)
npm run typecheck          # 在另一个终端检查类型
```

部署后查看线上日志使用 `npx wrangler tail`。
现有 `-Dev -Tail` 分支调用 `wrangler dev --tail`，本次未验证该组合，不作为推荐命令。

## 手动部署（跨平台）

如果不使用 PowerShell 脚本，也可以手动操作：

```bash
cd scripts/server/cf_worker
npm install
npx wrangler login                # 首次登录
npx wrangler r2 bucket create beyblade-replays   # 创建 R2 桶
npx tsc --noEmit                  # 类型检查
npx wrangler deploy               # 部署
```

## API 端点

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/health` | 健康检查；`/health` 当前返回 404 |
| GET | `/` | 服务信息页 |
| POST | `/api/create-room` | 创建私有房间，返回 `room_id` 和 `ws_url` |
| POST | `/api/match/enqueue` | 加入公共匹配队列 |
| POST | `/api/match/cancel` | 离开队列 |
| GET | `/room/:id/ws` | WebSocket 帧同步端点（客户端用 `wss://` 连接）|
| POST | `/api/submit-replay` | 提交 JSON 并存入 R2；accepted 仅表示存储成功，不是验算通过 |
| GET | `/room/:id/status` | 查询房间状态 |

## WebSocket 协议

HTTP API 使用 JSON；WebSocket 主协议是 **二进制 v2**，模拟标识
`2026.07.21-bin`。字符串/JSON 兼容分支不能替代主协议。
编码和解码使用现有实现：

- [Worker protocol.ts](src/protocol.ts)
- [Godot battle_protocol.gd](../../battle/battle_protocol.gd)
- [Web protocol.js](../../../web-prototype/src/network/protocol.js)

主要编号包含 `HELLO`、`WELCOME`、`READY`、`LAUNCH`、`LAUNCH_BOTH`、
`INPUT`、`INPUT_BATCH`、`HASH_CHECK`、`ERROR`。
当前协议常量 `INPUT_BATCH_SIZE = 6`、`HASH_CHECK_INTERVAL = 60`；
不要继续沿用旧 JSON 文档中的每 3 帧/20 Hz 或方向 int16 说明。

## wrangler.toml 配置说明

```toml
name = "beyblade-battle-server"           # Worker 名称，决定子域名前缀
main = "src/worker.ts"                    # 入口文件
compatibility_date = "2026-06-01"         # 当前仓库配置
compatibility_flags = ["nodejs_compat"]   # Node.js 兼容（未来可能使用 Buffer/crypto）

[[durable_objects.bindings]]              # 战斗房间 Durable Object
name = "BATTLE_ROOM"
class_name = "BattleRoom"

[[durable_objects.bindings]]              # 匹配器 Durable Object
name = "MATCHMAKER"
class_name = "Matchmaker"

[[migrations]]                            # 首次部署的 DO 迁移
tag = "v1"
new_classes = ["BattleRoom", "Matchmaker"]

[vars]                                    # 环境变量（可在 dashboard 中覆盖）
ENVIRONMENT = "production"
PROTOCOL_VERSION = 2
SIMULATION_VERSION = "2026.07.21-bin"
ROOM_IDLE_TIMEOUT_SEC = 60                # 房间空闲 60s 自动清理
BATCH_FRAMES = 3                          # 每 3 帧一批输入
DESYNC_CHECK_INTERVAL = 60                # 每 60 帧校验一次哈希

[[r2_buckets]]                            # R2 回放存储桶
binding = "REPLAYS"
bucket_name = "beyblade-replays"
```

上述 `[vars]` 是配置内容，不能当成已被代码消费的运行时开关。
例如 `BATCH_FRAMES = 3` 与协议常量 `INPUT_BATCH_SIZE = 6` 不同；
实际编码和发送应核对源码。完整配置以 [wrangler.toml](wrangler.toml) 为准。

### 套餐与容量（待核实）

旧版免费配额与每日局数估算已移除：没有实际账号计划和消息/存储压测支撑。
部署前核实以下官方资料；本次整理未联网确认其最新数字：

- [Workers 定价](https://developers.cloudflare.com/workers/platform/pricing/)
- [Durable Objects 定价](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- [Durable Objects 迁移](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/)
- [R2 定价](https://developers.cloudflare.com/r2/pricing/)

当前迁移使用 `new_classes`，不能据此假定已经采用免费计划所需的 DO 类型。
已有远端迁移需要按实际部署历史处理，不直接改旧 tag。

### 注意事项

1. **中国大陆访问**：公网线路、DNS、域名和移动网络质量需实测；不能以“异步”推导服务必然可达。
2. **wrangler 版本**：依赖范围见 package.json，实际安装版本见 package-lock.json；升级需单独验证。
3. **API Token 权限**：如果不想用 OAuth 登录，可以在 Cloudflare Dashboard 创建 API Token，权限需要：
   - Workers Routes:Edit
   - Workers Scripts:Edit
   - Durable Objects:Edit
   - R2 Storage:Edit
   然后通过 `$env:CLOUDFLARE_API_TOKEN="你的token"` 设置环境变量。
4. **Durable Object 迁移**：首次部署后 `[[migrations]]` 段不要删除，否则 DO 类无法绑定。后续新增 DO 类时添加新的 migration tag。

## 客户端接入示例

### Godot 端

```gdscript
const BattleSession = preload("res://scripts/battle/battle_session.gd")
var ws_transport := WebSocketTransport.new()
var session := BattleSession.create_frame_sync_battle(
    player_build,
    enemy_build,
    arena_map,
    20260718,
    ws_transport,
    0
)
# battle_screen 通过 set_battle_session(session) 注入
battle_screen.set_battle_session(session)
session.connect_to_room("wss://beyblade-battle-server.<你的子域名>.workers.dev/room/room_xxx/ws")
```

### Web 端（API 形状示例，不是完整联调脚本）

```javascript
import { BattleSession } from './network/battle_session.js';
import { WebSocketTransport } from './network/websocket_transport.js';

// sim 是已按同一版本、双方配置、地图和 seed 创建的 BattleSimulation。
const transport = new WebSocketTransport(roomWsUrl);
const session = BattleSession.createFrameSyncBattle(sim, transport, 0);
session.on('finish', (result) => { /* 显示结算 */ });
transport.connect();
```

Godot 的会话脚本没有 `class_name BattleSession`，调用方需先 preload 该脚本。
两端示例只说明当前签名；还需要处理握手、slot、ready、发射、轮询与断开。
当前 Web 求解器、Godot 求解器和网络标识未统一，不把此示例视为跨端验收结果。

## 反作弊说明

帧同步中继不运行服务器物理，现有输入和哈希机制有以下边界：
1. **输入量化**：所有输入使用 int8/int16 量化传输，不存在浮点歧义
2. **确定性物理**：固定 1/60s 步长，种子化随机数
3. **哈希交换**：用于报告分歧，分歧不等同于作弊；本次未验证两端哈希算法一致性。
4. **回放审计**：当前 R2 上传不执行重演，headless 审计属于待实现方案。

正式排位的目标是 StateSync 与服务端权威物理。普通付费 Worker 不会因此获得
运行 Godot 进程的能力，需要另行选择支持该运行时的宿主。
