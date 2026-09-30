# 主页与实验室保养验证

对应 2026-09-24 用户的实验室复用、开场舞台与剧情升级要求。
执行于 Windows 本机 Chrome 隔离上下文，未修改玩家浏览器存档。

## 主线程运行结果

| 检查 | 结果 |
| --- | --- |
| `npm test` | 53 通过 |
| `npm run build` | 通过；保留既有 Three.js 大 chunk 提示 |
| `npm run verify:home` | 22 通过 |
| `npm run verify:maintenance` | 13 数值 + 21 浏览器检查通过 |
| `npm run verify:launcher-outfit` | 4 数值契约 / 27 组合 + 24 浏览器检查通过 |
| `npm run verify:lab` | 27 通过 |
| `npm run verify:showroom` | 25 通过 |
| `npm run verify:worlds` | 31 通过 |
| `npm run verify:flow` | 41 通过 |
| `npm run verify:gpu` | 21 通过 |
| `git diff --check` | 通过 |

最后一次换装回归已包含真实传动表面的键盘准星滴油断言。
浏览器因果检查保持鼠标涂抹/擦拭、触摸取消/双指误滴撤回、保存与战斗接入。

共享 LabStage 连续快速进入实验室、保养、陈列室后：
几何数量为 79 / 79 / 79，纹理为 4 / 4 / 4。
保养单独反复进入/退出后的 LabStage：几何 14 / 14 / 14，
纹理 3 / 3 / 3。两组场景驻留不同，绝对值不作横向比较。

`detector.json` 为本轮一次检查，只有未记录颜色的 advisory，
无主级缺陷；实际儿童房/精密房配色在 DESIGN 合并时记录。

## 证据

- `desktop.png`、`mobile.png`：精密实验室保养。
- `childhood-desktop.png`、`childhood-mobile.png`：童年书桌保养。
- `outfit-mobile.png`：同一实验室内切换发射器改装，世界尺度保持一致。
- `home-holo.png`、`home-arena.png`：复用现有两套舞台的主页。
- `keyboard-mobile.png`：实际传动表面的准星、油膜反馈、73% 效率与待保存状态。

图像为 9:16 游戏内容区域裁剪：桌面 1440×1000 视口内游戏区域564×1000；
手机390×844视口内游戏区域390×694，并非截断整页。
加载完成及减少动态效果后截图。真实移动设备、Safari/Godot 未在本轮验证。

独立静态复核见 `finish-review.md`；该轮提出的键盘定位问题已修复并
通过主线程回归。`verdict.md` 最终评分为 F1 resolved，disposition: ship，
该评分只覆盖所列修复，不代表独立运行了全项目测试。
