# Beyblade Battle Server (Cloudflare Worker)

基于 Cloudflare Workers + Durable Objects 的零成本帧同步中继与异步回放服务器，支持 Godot 客户端与 Web 客户端共享同一后端。

## 架构概览

```
Godot Client ─┐                          ┌─ Godot Client
              ├─ WebSocket ──> BattleRoom DO (帧同步中继)
Web Client ───┘                          └─ Web Client
                      │
                      ├── R2 (回放存储)
                      └── Matchmaker DO (匹配队列)
```

**帧同步模式**：Durable Object 仅转发输入批次，双方客户端各自运行确定性物理，每 60 帧哈希校验防作弊。服务器不运行物理，可在免费层承载大量对局。

## 前置要求

- **Node.js**：推荐 20.x（兼容 wrangler@3）。Node 22+ 可使用 wrangler@4，但目前脚本固定 wrangler@3 以保证兼容性。
- **Cloudflare 账号**：免费注册，无需绑卡即可使用 Workers/Durable Objects/R2。
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
Health check: GET https://beyblade-battle-server.<你的子域名>.workers.dev/health
```

### 本地开发调试

```powershell
.\deploy.ps1 -Dev          # 启动本地 dev server (默认 http://localhost:8787)
.\deploy.ps1 -Dev -Tail    # 启动并实时查看日志
```

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
| GET | `/health` | 健康检查 |
| GET | `/` | 服务信息页 |
| POST | `/api/create-room` | 创建私有房间，返回 `room_id` 和 `ws_url` |
| POST | `/api/match/enqueue` | 加入公共匹配队列 |
| POST | `/api/match/cancel` | 离开队列 |
| GET | `/room/:id/ws` | WebSocket 帧同步端点（客户端用 `wss://` 连接）|
| POST | `/api/submit-replay` | 提交异步回放（JSON），存入 R2 |
| GET | `/room/:id/status` | 查询房间状态 |

## WebSocket 协议

所有消息均为 JSON 信封格式：

```json
{ "type": "<消息类型>", "data": { ... }, "seq": <序列号> }
```

消息类型（详见 [src/protocol.ts](src/protocol.ts) 和 Godot 端 [battle_protocol.gd](../../../scripts/battle/battle_protocol.gd)）：
- `ready`：玩家准备就绪
- `launch`：发射指令（量化后的 power/height/direction/angle）
- `input_batch`：帧输入批次（每 3 帧一批，20Hz 发送）
- `state_hash`：状态哈希校验（每 60 帧一次）
- `opponent_disconnect`：对手断线
- `error`：错误消息

## wrangler.toml 配置说明

```toml
name = "beyblade-battle-server"           # Worker 名称，决定子域名前缀
main = "src/worker.ts"                    # 入口文件
compatibility_date = "2025-01-29"         # 兼容性日期，需 >= 2024-06 以支持 DO + WebSocket
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
ROOM_IDLE_TIMEOUT_SEC = 60                # 房间空闲 60s 自动清理
BATCH_FRAMES = 3                          # 每 3 帧一批输入
DESYNC_CHECK_INTERVAL = 60                # 每 60 帧校验一次哈希

[[r2_buckets]]                            # R2 回放存储桶
binding = "REPLAYS"
bucket_name = "beyblade-replays"
```

### 免费层限制（Cloudflare Free）

| 资源 | 免费额度 | 本项目预估 |
|------|---------|-----------|
| Workers 请求 | 100,000 次/天 | 每局约 600-2000 请求，足够数百局/天 |
| Durable Objects | 无显式请求上限；单次 CPU 限 50ms（DO 的 fetch 上下文）| 每次转发约 1-3ms，远低于限制 |
| R2 存储 | 10 GB | 每局回放约 5-20KB，可存数十万局 |
| R2 Class A 操作 | 1,000,000 次/月 | 每局 1 次写入，可支撑数万局/月 |
| R2 Class B 操作 | 10,000,000 次/月 | 读取回放时使用 |
| WebSocket | 通过 DO 原生支持，无额外费用 | 帧同步中继使用 |

### 注意事项

1. **中国大陆访问**：免费层走 Cloudflare 全球网络。同步排位赛对延迟敏感（<100ms 体验最佳），大陆玩家可能需要香港/亚太线路或国内服务器。异步积分赛对延迟不敏感，免费层完全可用。
2. **wrangler 版本**：本项目固定 `wrangler@^3.60.0`（兼容 Node 18/20）。如需使用 wrangler@4，请先升级到 Node 22+。
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
var ws_transport := WebSocketTransport.new()
var session := BattleSession.create_frame_sync_battle(
    player_build,
    arena_map,
    20260718,
    ws_transport
)
# battle_screen 通过 set_battle_session(session) 注入
battle_screen.set_battle_session(session)
ws_transport.connect_to_url("wss://beyblade-battle-server.<你的子域名>.workers.dev/room/room_xxx/ws")
```

### Web 端

```javascript
import { BattleSession } from './network/battle_session.js';
import { WebSocketTransport } from './network/websocket_transport.js';

const transport = new WebSocketTransport();
const session = BattleSession.createFrameSyncBattle(playerBuild, arenaMap, 20260718, transport);
session.connect('battle_finished', (result) => { /* 显示结算 */ });
transport.connect('wss://beyblade-battle-server.<你的子域名>.workers.dev/room/room_xxx/ws');
```

## 反作弊说明

帧同步中继模式为了适配免费层，不在服务器运行物理，但通过以下手段保证公平：
1. **输入量化**：所有输入使用 int8/int16 量化传输，不存在浮点歧义
2. **确定性物理**：固定 1/60s 步长，种子化随机数
3. **哈希校验**：每 60 帧双方交换状态 SHA-256 哈希，不一致即检测到 desync/作弊
4. **回放审计**：对局完成后完整回放可提交到 R2，服务端可用 Godot headless 批量审计高段位对局（需付费 Worker 或自建服务器）

后续如需更强反作弊（排位赛），可切换到 StateSync 模式（服务端权威物理），但需要付费 Cloudflare Workers Unbound 或自建服务器。
