disposition: fix

按降级角色在当前线程完成独立收尾审读；未启动浏览器、未重跑检测或修改实现代码。未提供 QUALITY BAR 卡；本次为指定的 code-led 窄扩展，无 approved comp。主文件已读，main.js 仅审读相关接线；未展开无关页面、完整求解器及 Blender 源模型。

## persistence

pass：`web-prototype/PRODUCT.md`、`DESIGN.md` 和指定 surface brief 均存在；纸色、石墨文字、蓝色选择、黄色保存及中文系统字体与既有保养工作台一致。FORM 明确限定为继承界面的局部扩展、不启用概念比赛或 seed；不将其认作新视觉世界的创作交付。

已逐张打开 [desktop.png](desktop.png)（1440×1000）、[mobile.png](mobile.png)（390×844）、[outfit-red.png](outfit-red.png)（1440×1000）。三张均显示目标页面顶部、实际模型及对应状态，无损坏或空白渲染；手机上下暗色区域是既有 9:16 游戏壳外的留白。证据包标明为第二轮检查后的截图，文件时间为 2026-09-24 10:40:55 至 10:41:02。

[browser.json](browser.json) 记录 16 项契约通过、无浏览器异常；[physics.json](physics.json) 包含 27 种组合及能量约束检查。它们是提供的验证结果，不是本审查重新执行的结果；浏览器脚本未覆盖键盘焦点或跨模式脏状态。六条 detector 结果均为现有调色板 advisory，不构成新增材料缺陷。

## fidelity

| 元素／承诺 | 状态 | 证据与边界 |
| --- | --- | --- |
| TYPE / OWN-WORLD | match | 中文系统字体、紧凑字号层级及等宽数字沿用 Operate 工作台；不是另造展示字体。 |
| MATERIAL / OWN-WORLD | match | 三张截图均为实际爆炸模型，金属、深色结构与涂装区域可区分；`launcher-model.js:42-85` 加载独立 GLB 部件并应用表面处理，没有用 CSS 假装实体机构。 |
| GROUND / OWN-WORLD | match | 画面为既有暖纸色和工具台浅灰纸色；`maintenance.css:8,23,63` 与 `maintenance-stage.js:65` 分别使用 `#f7f3e9`、`#efede4`，未换成另一套底色。 |
| 模型可见性 / FIRST VIEWPORT | match | 八模块整机展开居中，未被操作区遮挡；手机全貌较小，命名近景按钮和 `frame()` 提供针对实际部件的放大路径。截图只证明全貌，不宣称已目视验收所有近景。 |
| 手机滚动 / FIRST VIEWPORT | adaptation | 手机首屏止于性能读数，试拉和保存下移；为保留九部件选择、颜色及既有 9:16 壳的功能性重排。`maintenance.css:19-21,58,63,110` 保留纵向滚动和模型最小高度；`verify-launcher-outfit.mjs:101-111` 实际点击了屏下保存并检查无横向溢出。未证明真人触摸滚动手感。 |
| 三槽九件、换色、预览与购买 | match | 原有 progression 提供价格、金币和所有权；预览独立于 `launcherDraft`，保存只提交经所有权校验的草稿。截图金币来自脚本明确设置的隔离测试存档，不是新增样例经济。 |
| 性能与机构 / THESIS | match | `launcher-physics.js:25-59` 将传动、弹性、释放损失与残留能放在有限输入预算内；`poseLauncher()` 使用实际齿比和机构位移。所供浏览器报告验证拨叉、凸轮、三爪及输入轮运动，静态截图本身不证明联动。 |
| 战斗接入 | match | `main.js:1695,1754-1766` 将同一保存配置交给模型和模拟；`:1793-1807` 等待释放后启动模拟，`:1586-1587` 导航时取消释放。首次训练保留基准发射器。 |
| 草稿状态 / STORY、THESIS | contradicted | 换色后切到保养，或涂油后切到换装，状态可能显示“与已保存一致”，但保存仍同时提交装备与油膜，见 F1。实际保存边界正确，不等于状态文案正确。 |
| 文字操作的键盘等价路径 | contradicted | 槽位／型号操作重建按钮并丢失焦点；已选蓝色按钮的焦点轮廓也不可区分，见 F2、F3。 |
| FORM | adaptation | 依指定 surface brief 复用既有工作台；新增换装保留自动展开、实际表面与可逆草稿，不引入另一视觉世界或开盖门槛。 |

## ceiling

未提供独立 QUALITY BAR 卡，不能宣称达到该卡的上限。继承世界所需的实体层次、爆炸结构、局部换色和数字层级已使用；没有需要追加的装饰性框架或展示字体。新增部件沿拆装向量退出／插入，减少动态时跳至完成态。剩余门槛是状态真实性与键盘操作，不是增加视觉特效。

## material_fixes

1. **F1 / P2 / STORY、Truth：统一草稿脏状态。** [maintenance-screen.js:257-274](../../../web-prototype/src/ui/maintenance-screen.js#L257-L274) 分别只比较油膜或装备，切换模式会隐藏另一种未保存修改；但 [:339-345](../../../web-prototype/src/ui/maintenance-screen.js#L339-L345) 同时保存两者。复现路径：点击“红黑配色”后切到“发射器”，即可误报“与已保存一致”。应合并装备、颜色、油膜的 dirty 判断，同时独立标记“仅预览”；验证双向切换后提示仍准确，保存／放弃含义不变。
2. **F2 / P2 / Floor、键盘等价：保留槽位和型号操作后的焦点。** [maintenance-screen.js:185-211](../../../web-prototype/src/ui/maintenance-screen.js#L185-L211) 在选择后调用 `refreshOutfit()`，以 `innerHTML` 删除并重建当前焦点按钮，载入结束又刷新一次，且无焦点恢复。应保留节点，或按原槽位／型号在异步完成后恢复焦点；验证仅用 Tab、Enter 连续切槽、预览、购买／装入、试拉与保存时，不丢失操作位置。
3. **F3 / P2 / Floor、可见焦点：让已选态仍有可辨识的焦点。** [maintenance.css:45-55](../../../web-prototype/src/ui/maintenance.css#L45-L55) 的 `#1759ad` 轮廓以 `-2px` 内缩，落在同色已选按钮背景和边框上；键盘进入当前“换装”／槽位／型号时没有可见差别。改用纸色间隔的外轮廓或对比色内轮廓，并检查选中、未选中和滚动边缘三种状态。

## keep

保留真实八模块自动展开、三槽九件、局部替换不重载外壳、原有金币与所有权、预览绝不装备、免费换色、有限能量与实际释放联动，以及当前纸色／石墨／蓝／黄和纵向可滚动布局。
