# Web 物理反馈 v5 验证记录

2026-09-24。实现与自动回归完成，人类手感试玩尚未进行。
规则版本：`2026.09.23-web-v5+launcher-v1`。
范围及公式见 [实现说明](../../../docs/physics_v5_implementation.md)。

## 检查结果

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| `npm test` | 53 项通过，含新增 22 项物理回归 | [日志](logs/numerical-final.log) |
| `npm run build` | 成功 | [日志](logs/build-final.log) |
| `npm run verify:structure` | 69 项通过 | [日志](logs/structure-final.log)、[数值记录](regression/structure/physics.json) |
| `npm run verify:physics` | 27 项通过，浏览器异常 0 | [日志](logs/physics-browser-final.log)、[结果](browser.json) |
| `npm run verify:battle-ui` | 20 项通过，浏览器异常 0 | [日志](logs/battle-ui-final.log)、[结果](regression/structure/browser.json) |
| `npm run verify:campaign` | 65 项通过 | [日志](logs/campaign-final.log) |
| `npm run verify:flow` | 41 项通过 | [日志](logs/flow.log)、[结果](regression/flow/verification.json) |
| `npm run verify:growth` | 57 项通过；最终评分入口调整后重跑 | [日志](logs/growth-final.log)、[结果](regression/growth/verification.json) |
| `npm run verify:lab` | 27 项通过 | [日志](logs/lab.log) |
| `npm run verify:showroom` | 25 项通过 | [日志](logs/showroom.log) |
| `npm run verify:worlds` | 本次会话 31 项通过 | [场景截图目录](regression/worlds/)；原终端输出未单独归档 |
| `node tools/verify-maintenance-physics.mjs` | 13 项通过 | [日志与数值](logs/maintenance-physics-final.log) |
| Impeccable 定向静态检查 | 无主问题，5 条既有配色提示 | [检测结果](logs/detector.json) |
| 修改范围 `git diff --check` | 通过 | 终端检查 |

构建保留 Three.js 分块超过 500 kB 的提示，不影响构建成功；
本次结果不代表重新测量了所有首屏加载目标。

## 方法和版本边界

- Windows、安装版 Chrome、Playwright；桌面视口 1440×1000，手机视口
  390×844。截图截取实际游戏容器，沿用其竖向构图，不拉伸到视口宽度。
- 浏览器使用独立存档，不消费用户金币或改动用户进度。为避免同期编辑触发
  Vite HMR 中断对局，在临时源码副本的 `127.0.0.1:5178` 上验证。
- [源码 SHA-256](source-sha256.json) 记录交付源码与最终验证副本。
  本任务涉及的物理、音频、战斗渲染、主界面、陈列室及版本适配源码一致。
  同期保养页面的 `maintenance-screen.js`、`maintenance.css` 后续另有修改；
  本报告不把它们的最新界面状态列为已完成浏览器验收。
- 完整流程按真实 RAF 与求解器推进。专项脚本仅在浏览器响应中暴露测试引用，
  注入音频异常、同时停转初态及新手状态；产品源码没有新增测试入口。
  它验证异常边界和裁决链，不代表自然对战中平局的出现概率。
- 评分条件从陈列室真实按钮、改装页“性能实测与出战对比”入口展开；
  校验实测内容、视口边界、Escape 关闭和焦点返回。
- 能量检查覆盖隔离接触的平动与轴向自旋，角动量检查采用相同边界。
  轴响应仍是降阶模型，不能把通过测试解释为完整三维机械能守恒。
- 30/60/120Hz 验证固定输入与固定物理步的批次一致性；不保证低帧率设备
  上相同墙钟手势等价。实际主循环仍有帧时长上限。

## 可见结果

| 状态 | 桌面 | 手机 |
| --- | --- | --- |
| 实时战斗与供能 | [截图](running-desktop.png) | [截图](running-mobile.png) |
| 暂停与恢复 | [截图](paused-desktop.png) | [截图](paused-mobile.png) |
| 平局原因、零赏金与重赛 | [截图](draw-desktop.png) | [截图](draw-mobile.png) |
| 改装实测与条件展开 | [截图](assembly-desktop.png) | [截图](assembly-mobile.png) |
| 陈列室评分说明 | [截图](measurements-desktop.png) | [截图](measurements-mobile.png) |

代表画面人工检查了文本换行、按钮可达、背景遮罩及展开后的操作区。
修正了首场训练平局隐藏重赛、淘汰原因误用胜利文案、零赏金仍显示到账，
以及测量说明被旧版隐藏性能面板包住的问题。
战斗 UI 检查的独立模型夹具补上了 Three.js import map。

保留现有战斗配色：供能淡黄、争夺暖红及结构状态青灰。
检测器的 5 条 advisory 均为这些既有颜色未登记在调色板中的提示；
没有为本次物理反馈更换界面风格。完成一次检测和集中画面确认后停止修饰。

## 后续验收

自动检查通过后，人类仍需短时试玩轻推方向、金属尖滑移、受撞摆动与争区手感，
再决定参数微调。Godot、Worker 和旧二进制协议未迁移，旧网络 Provider 明确拒绝
新规则。第三轮地形法线、边缘支撑、真实装配高度、CCD、完整状态恢复回放，
以及新伤闪光和完整接触音色分层均未列为本次已实现内容。
