# 第三轮共享物理 v6 验证

任务开始于 2026-09-24；最终日志的本机时间跨至 2026-09-25。
版本：`2026.09.24-shared-v6+launcher-v1`。
实现说明：[physics_v6_implementation.md](../../../docs/physics_v6_implementation.md)。

## 结论

共享求解器、Godot 原生本地战斗及双向完整 JSON 恢复已通过本轮验证。
检查使用真实 Web 与 GDScript 实现，Godot 未调用 JS 求解器。
数值对齐不代表全端美术、库存、剧情或联网产品均已移植。

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| Web Vitest | 6 文件、53 项通过 | [web-tests.log](web-tests.log) |
| Web v6 数值、模型支点及恢复 | 71 项通过、导出 9 组金标 | [numeric.json](numeric.json) |
| Godot 基础公式对照 | 3,140 个数值比较；最大误差 `2.27e-13` | [godot-helpers.json](godot-helpers.json) |
| Godot 独立对局、Web→Godot 恢复 | 9 组、68,165 个数值比较；最大误差 `3.11e-13` | [godot-parity.json](godot-parity.json) |
| Godot→Web 恢复续算 | 9 组、6,035 个数值比较；最大误差 `2.57e-13` | [web-native-recovery.json](web-native-recovery.json) |
| Godot 场景检查 | 无窗口 88 项；实际渲染含截图 92 项通过 | [godot-scene-v6.json](godot-scene-v6.json)、[godot-render.json](godot-render.json) |
| Web 姿态、音频、平局与界面 | 27 项通过，浏览器错误 0 | [web/browser.json](web/browser.json) |
| Web 战斗世界／障碍／检查视角 | 31 项通过 | [worlds-check.log](worlds-check.log) |
| Web 结构因果与实际任务 AI | 69 项通过 | [web-structure.log](web-structure.log) |
| 保养数值与操作 | 数值 13 项、浏览器 21 项通过 | [数值日志](web-maintenance-numeric.log)、[操作记录](maintenance/verification.json) |
| 发射器兼容 | 4 项性能契约、27 种组合；浏览器 24 项通过 | [性能日志](web-launcher-numeric.log)、[操作记录](launcher/browser.json) |
| Web 训练／成长／章节流程 | 57 项通过 | [web-growth.log](web-growth.log) |
| 生产构建 | 成功；保留 Three.js 大块提示 | [web-build.log](web-build.log) |

另已通过原有 Godot 测试：`assembly_calculator_test`、`five_part_top_model_test`、
`battle_simulation_test`、`battle_screen_test`、`arena_terrain_test`、`map_select_screen_test`、
`game_state_persistence_test`、`competitive_system_test`、`spin_mobility_test`、
`collision_damage_test`。后两项为独立 Jolt 实验回归，不作为跨端求解器的证据。
对应日志均在本目录；检查日志未遗留脚本错误，不能只靠进程退出码判断成功。

## 覆盖范围

- 五场地、左旋 DIY／不同发射器／油量、同时停转、掉落、迎面碰撞共九组。
  比较检查点的完整状态，包括结果、事件顺序、结构扇区、接触历史和供能统计。
- Web 检查保持贴靠、障碍接触、供能切换和下落中的完整恢复；
  两端均检查版本错误及缺失旋转相位／速度／惯量、错误扇区类型等数据的原子拒绝。
- 原生 30／60／120Hz 调用产生同一完整状态；本地回放通过 JSON 往返后续算一致。
- 五张原生场地正常推进，供能圈沿坡面生成，遗迹四个障碍与方形边界接入；
  不保留旧高护墙。Jolt 刚体沿真实三角网格向碗内加速的回归也通过。
- 三种轴尖 × 三种 DIY 高度与真实模型包围盒对齐；检查固定倾角自旋一周、
  相机四个方向输入、松手、暂停恢复、失焦、平局经济和旧网络 Provider 拒绝。

## 实际渲染复核

环境：Windows、Godot 4.7 stable、OpenGL Compatibility、RTX 4080；原生窗口 720×1280。
Web 使用本机 Chrome、Playwright 隔离上下文和隔离存档，开发服务端口 5184。

- [Godot 标准场](godot-standardrunning.png)：双陀螺、供能圈、转速、操控区。
- [Godot 遗迹](godot-ruinsrunning.png)：程序场地、真实障碍布局。
- [Godot 平局](godot-draw.png)、[开放边缘下落](godot-ringout.png)。
- [Web 桌面](web/running-desktop.png)、[Web 手机](web/running-mobile.png)。
- 本轮 Web 场地截图在 [worlds](worlds/)，保养及发射器复核分别在
  [maintenance](maintenance/) 与 [launcher](launcher/)。

原生沿用已有界面与程序模型；这些截图**不代表 Web 美术高保真移植已完成**。
最后复核调整操控提示框宽度，避免与右侧操作按钮叠在一起。
自动检查及截图复核不代替玩家对滑移、碰撞强弱和供能争夺的主观试玩。

## 复现

在 `web-prototype/`：

```powershell
npm test
npm run build
npm run verify:physics-v6
```

在根目录，用本机 Godot 可执行程序（将 `godot` 换成实际路径）：

```powershell
godot --headless --path . --script tests/battle/physics_v6_helpers.gd
godot --headless --path . --script tests/battle/physics_v6_parity.gd
godot --headless --path . --script tests/battle/physics_v6_scene.gd
godot --path . --resolution 720x1280 --script tests/battle/physics_v6_scene.gd -- --capture
godot --headless --path . tests/core/GameStatePersistenceTest.tscn
```

随后在 `web-prototype/` 运行 `node tools/verify-native-recovery.mjs`，它消费原生测试
实际导出的 `native-recovery.json`，不能跳过前面的 Godot 对照步骤。
`v6_catalog.json` 与 `v6_fixtures.json` 在 `resources/physics/`，来自正式 Web 数据。

浏览器检查需先启动开发服务，设置 `LAB_TEST_URL`；`QA_OUTPUT_DIR` 可将截图归档到本目录。
本次关闭 HMR 避免并行开发导致页面重载，同时保留文件监听使服务端编译缓存及时失效。
最初关闭监听曾导致旧脚本残留，已重启并重新通过全部相关浏览器检查。

## 未覆盖的承诺

- 尚未移植 Godot 完整 Blender 场景／材质／灯光、发射器动画、保养和换装工作台，
  未提供 Web 与原生库存存档互迁。
- Worker、旧二进制协议、联网权威结算尚未升级；v6 Provider 明确拒绝连接旧规则流程。
- 仍为降阶轴响应与离散接触子步，没有扫掠 CCD 或全三维机械能守恒证明。
- 超过每帧 `0.05s` 的墙钟时间不追赶；低于约 20FPS 会慢动作。
- 当前日志记录对应的工作区内容；并行开发产生的后续变化需要按影响范围重新检查。
  本轮主要源码与金标的 SHA-256 见 [source-hashes.json](source-hashes.json)。
