# Markdown 整理记录 · 2026-09-16

范围：原有 23 份项目 Markdown（含 4 份隐藏目录评审），排除依赖、构建产物、
Git 元数据与第三方插件。本次新增本记录和 [文档导航](README.md)，不删除历史文件。
核对依据为本地源码、配置、测试脚本和原交付记录；不是游戏、联网或云部署重新验收。

## 关键结论与已处理项

| 问题 | 实现依据 | 处理 |
| --- | --- | --- |
| 根 README 声称两端全量对齐，默认下一步 PVP | Web v3 / Godot v2 / 网络 bin 三种声明并存 | 更新当前状态与开发入口；早期 MVP 章节标为背景 |
| Web README 导向旧交接，仍有“三张地图” | `src/data/arenas.js` 五张地图，两个 lab 房间 | 改为当前索引、五地图与童年书桌入口 |
| 参数基线把惯量写成简单求和 | 两端 AssemblyCalculator 均有平行轴项 | 补 DIY 前处理和 X/Z 偏移公式 |
| Godot 实验室规范容易被用于 Web | Godot 2.4 秒扫描；Web 5.2 秒测试及独立成长系统 | 标明端与场景范围，不把 Godot 限制扩散到 Web |
| 旧待办称 Godot 尚未接入 BattleSession | `battle_screen.gd` 已创建/消费 session | 在当前架构状态中纠正，旧交接标为历史 |
| 架构文档把播放器和验算目标打勾为完成 | 当前独立播放器、headless 验算器未见实现 | 改为待验收目标，区分代码存在与运行验收 |
| Worker 指南仍教 JSON WebSocket、旧签名和 `/health` | 三端二进制协议 v2；HTTP 路由为 `/api/health` | 修正文档格式、接口签名、链接、配置日期和健康路径 |
| 上传 accepted 被混同于权威验算 | Worker 只将 JSON 写入 R2 | 明确上传、验算、正式结算的区别 |
| 多处宣称云端完全免费、固定容量和时延 | 本地代码不能证明账号资格或公网容量 | 撤下主要承诺，旧部署背景标待核实并链接官方资料 |
| MCP 安装示例未锁定真实插件 | 文档没有官方仓库、固定版本与连接记录 | 标待核实，撤下未经证实的 npm 启动配置 |
| 项目 Markdown 含本机绝对链接 | 换目录后会失效 | 改为相对链接 |

## 原有文件逐项处置

| 文件 | 分类 | 本次处理与后续维护 |
| --- | --- | --- |
| [AGENTS.md](../AGENTS.md) | 活跃约定 | 增加索引入口和 worlds 检查；保持简短，不复制产品说明 |
| [README.md](../README.md) | 概览，含早期背景 | 修正状态与下一步；保留原设计以便追溯，日后可按需拆出早期设计章节 |
| [web-prototype/README.md](../web-prototype/README.md) | 活跃操作指南 | 更新入口、房间、地图、检查；新功能说明优先写这里 |
| [web-prototype/DESIGN.md](../web-prototype/DESIGN.md) | 活跃 Web 视觉规范 | 现有内容匹配本轮场景方向，保留；其中测试计数是历史记录 |
| [battle_worlds.md](battle_worlds.md) | 活跃美术/碰撞指南 | 保留，作为 Blender 源文件与地图碰撞主说明 |
| [top_part_physics_baseline.md](top_part_physics_baseline.md) | 活跃共有数值基线 | 修正惯量，明确 Web 先行与跨端验收边界 |
| [deterministic_battle_sync.md](deterministic_battle_sync.md) | 活跃兼容契约 | 新增版本矩阵、恢复接口与会话差异；每次移植更新 |
| [test_lab/README.md](test_lab/README.md) | Godot 专题 | 加适用端与历史验证标识；共享资产说明继续有效 |
| [test_lab/DESIGN.md](test_lab/DESIGN.md) | Godot 局部规范 | 加适用范围；不把禁止商店/历史功能套用到 Web |
| [test_lab/showroom-direction.md](test_lab/showroom-direction.md) | 原方向简报 | 保留意图，细节转向 Web DESIGN；修正减少动态效果描述 |
| [collision_damage_test_handoff.md](collision_damage_test_handoff.md) | Godot/Jolt 专题 | 保留职责边界，修正强制两端同时开发的旧说法 |
| [network_pvp_architecture.md](network_pvp_architecture.md) | 产品与长期架构 | 更新实现缺口；正式结算、产品待定项由此维护 |
| [hybrid_pvp_architecture.md](hybrid_pvp_architecture.md) | 同步模式提案 | 加代码状态表，撤下虚假完成勾选；旧 JSON 模型明确标历史 |
| [服务 README](../scripts/server/cf_worker/README.md) | 本地操作指南，部署待验证 | 修正端点、协议、签名和配置；需联调后才能成为部署验收依据 |
| [godot_ai_mcp_setup.md](godot_ai_mcp_setup.md) | 待核实参考 | 使用前选定真实插件并验证，当前无需默认阅读 |
| [audio-lab README](../tools/audio-lab/README.md) | 独立工具指南 | 启动脚本、48 kHz、PCM 导出及循环淡化与源码相符，保留 |
| [ai_handoff_20260716.md](ai_handoff_20260716.md) | 历史 | 加归档说明，保留原判断和测试记录 |
| [ai_handoff_20260719.md](ai_handoff_20260719.md) | 历史 | 取消“最新入口”链，限定“全量同步”为 7 月范围 |
| [ai_handoff_20260721.md](ai_handoff_20260721.md) | 历史 | 醒目标注已过时待办、版本与部署假设，修复绝对链接 |
| [.impeccable/review/finish-review.md](../.impeccable/review/finish-review.md) | Godot 评审证据 | 保留 fix → ship 过程，不能把中间 verdict 当当前结论 |
| [.impeccable/review/web/finish-review.md](../.impeccable/review/web/finish-review.md) | Web lab 评审证据 | 保留；其中旧会话工具可用性不约束新会话 |
| [.impeccable/review/showroom/finish-review.md](../.impeccable/review/showroom/finish-review.md) | 舞台评审证据 | 保留；不替代最新灯光/近景交互规范 |
| [.impeccable/review/worlds/verification.md](../.impeccable/review/worlds/verification.md) | 场景验收证据 | 保留 2026-09-16 原结果及 F1–F4 限定范围 |

## 仍需后续任务验证

- PVP：先解决求解器版本与接口差异，再进行双客户端、回放恢复、权威验算和公网测试。
  不按旧里程碑自动重复实现已存在的 Godot 会话。
- Worker：部署脚本仍输出旧健康路径，R2 Setup 的成功提示不足以证明桶已建立；
  当前配置 `BATCH_FRAMES = 3` 与协议常量 6 不同。这次只如实更新文档，没有修改代码。
- 云套餐/配额/中国移动网络质量：未联网复核，不提供当前免费容量保证。
- MCP：没有锁定插件；只有需要操作 Godot 编辑器时再补完整安装依据。
- 文档篇幅：根 README 的早期设计、混合架构的旧概念模型可日后独立归档；
  目前已加范围说明和直达入口，不要求接手时通读。

## 本次校验

- 整理后的 25 份 Markdown 共检查 145 个本地链接目标，全部存在；未留本机 `file://` 链接。
- `git diff --check` 通过。
- 启动/验证命令与 package.json、浏览器脚本环境变量已核对；版本、惯量和会话状态已对照源码。
- 本次只修改 Markdown，没有重新运行游戏单测、构建、浏览器或公网联调；
  文档中的旧交付通过数量均保留为历史证据。

后续维护规则统一放在 [文档导航](README.md)；本记录作为一次性整理证据，不作为新待办总表。
