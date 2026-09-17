# Web 流程验收 · 2026-09-17

本次只修改任务准备、结算建议和中断恢复。没有修改物理求解器、场景模型、
所有权、价格、奖励或 Godot。使用独立 Chrome 上下文，无用户存档写入。

| 检查 | 结果 |
| --- | --- |
| `npm test` | 29 PASS |
| `npm run build` | PASS；保留 Three.js 887.91 kB 分包警告 |
| `npm run verify:flow` | 41 PASS |
| `npm run verify:campaign` | 65 PASS |
| `npm run verify:lab` | 27 PASS |
| `npm run verify:showroom` | 25 PASS |
| `npm run verify:battle-ui` | 20 PASS |
| `git diff --check` | PASS |

流程检查覆盖旧任务重打目标在改装/实验室/陈列室间传递与刷新恢复、
未开放关卡不能创建准备目标、自由模式清除目标、待发返回、
失焦冻结计时、摇杆捕获释放、重新输入、Escape 继续、退出不结算、
真实主线比赛的建议与奖励、结果改装返回原任务、奖励去重。
另以全新存档验证首场训练的 180 金币、首次购买引导与刷新去重。
损伤建议的边界检查确保使用玩家本人的部位数据，而非对手的败因字段。

`verify-lab` 原先使用全局 `dialog`，新增原生暂停弹窗后出现 strict mode
选择器歧义。改为 `.lab-view dialog` 后通过。
`verify-battle-ui` 使用新的“继续对局”按钮，并展开约战缘由验证角色说明。

截图：desktop/mobile 为任务页；result-desktop/result-mobile 为真实首关重打结算；
pause-desktop/pause-mobile 为暂停；lab-mobile/collection-mobile 为保留阿砾约战目标的准备页。
桌面 1440×1000，手机浏览器 390×844，减少动态模式。截图前等待双帧确保尺寸稳定，
八张最终截图均已打开确认。完成新手补验时设置 `FLOW_CAPTURE=0`，没有追加视觉迭代。
其他回归脚本产生的旧专题截图已还原，以免覆盖那些历史验收的视觉证据。

设计检测仅执行一次：无机械问题；四项颜色 advisory，
其中 `#bfe4ff`、`#145888`、`#e6f2f7` 沿用当前 campaign.css；
`#234d5e` 用于建议文字。无新增或替换的运行时图片资源。

独立视觉验收由通用代理替代环境中缺席的专用 finish reviewer，
结论见同目录 finish-review.md。上述功能结果由主线程执行，
不等同于独立视觉审查证明，也不证明人类玩家留存、难度或真机性能。
