# Web v4 结构战斗验收

2026-09-16。仅 Web；Godot 与网络协议未移植。

## 已执行

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| `npm test` | 29 通过 | [tests.log](tests.log) |
| `npm run verify:structure` | 69 通过 | [physics.json](physics.json)、[physics.log](physics.log) |
| `npm run verify:worlds` | 31 通过 | [worlds.log](worlds.log) |
| `npm run verify:campaign` | 65 通过 | [campaign.log](campaign.log) |
| `npm run verify:battle-ui` | 20 通过 | [browser.json](browser.json)、[browser.log](browser.log) |
| `node tools/verify-battle-motion.mjs` | 普通终结展示延迟约 859ms，减少动态为 0ms | [motion.json](motion.json) |
| `npm run build` | 通过，已有 Three.js 大分块提示 | [build.log](build.log) |
| `git diff --check` | 通过 | 本次终端检查 |
| Impeccable detect | 0 个主要问题、8 个配色建议 | [detector.json](detector.json) |

浏览器验证使用本地开发服务器、隔离存档和已安装 Chrome。物理检查只使用现有零件
计算器和正式求解器；部分极限案例明确固定位置或重复载荷，不伪称自然对局频率。
模型对照页为工具临时创建，使用真实 `createTopModel` 与 `applyStructuralImpact`。

## 截图来源与范围

所有 PNG 为本次 Playwright 对本地源码的截图，非生成图、不在产品中作为素材发布。

- [desktop.png](desktop.png)、[mobile.png](mobile.png)：真实对战暂停时的加速区和顶栏。
- [launch-desktop.png](launch-desktop.png)、[launch-mobile.png](launch-mobile.png)：真实发射准备。
- [result-desktop.png](result-desktop.png)、[result-mobile.png](result-mobile.png)：真实求解器结算。
- [opponents.png](opponents.png)：五名对手的实际配置模型对照，诊断布景。
- [damage.png](damage.png)：相同配置完好/单侧连续受撞后的局部形变，诊断布景。

桌面浏览器视口为 1440×1000，截图裁到 564×1000 游戏壳；
手机为 390×844。均已打开检查，非真机性能认证。

## 玩法证据与边界

默认配置挂机的十场任务中，抢区 AI 胜九场。双方抢区样本出现 21 次有效接触；
这个样本证明争夺有交锋，不代表最优策略与商业级全配置平衡。
通过实际载荷函数造成重损后，即使持续固定在供能区，仍发生结构性停转。

材料耐久、厚径比与轮廓集中度影响局部抗损；永久失衡不能自动恢复。
微小摇杆输入已不再被放大为全推力。额外外环反冲遵循平动能量从旋转能量扣除，
测试覆盖其线动量及机械能边界。

这是游戏单位下的确定性降阶结构模型。没有有限元、真实断裂标定、独立碎片碰撞、
永久装备磨损或跨端恢复协议。损伤模型的完整说明见
[结构战斗设计](../../../docs/structural_battle_design.md)。

## 独立视觉复核

最终结论：**SHIP，仅上述八张截图的静态范围**。由独立默认子代理代替当前环境
未提供的命名 Impeccable reviewer，未继承实现会话，未修改代码。

没有要求修复、重建或重拍的实质视觉问题。确认五款配色/轮廓可区分、单侧形变可见、
A 区与 B/C 层次清晰、移动端结算没有可见裁切，操作按钮可达。配色建议判断为
局部刻意变化，主要文本色对达到 4.5:1。

该结论没有独立验证物理、重损实战、双方争夺态、展开后的滚动、胜利动效或触控。
表中的动态时序和数值检查是主代理执行的证据，不扩张为独立视觉复核认证。
当前结构说明中的 67 个本地文档链接已检查有效。
