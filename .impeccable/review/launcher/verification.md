# 发射器建模交付 · 2026-09-23

已在 Blender 5.2 制作并接入 Web 战斗准备。综合两张用户参考图：
蓝白分体壳、握柄防滑纹、T 拉柄与齿条；烟灰透明盖、可见齿轮、弹簧、
金属紧固件与底部卡口。193 个源部件，运行时七个材质网格，
27,560 三角面、770,460 字节。模型不包含参考图片贴图。

- [Blender 产品渲染](blender-product.png)
- [Web 近景](web-closeup.png)（仅检查脚本临时拉近镜头）
- [正常发射准备](battle-desktop.png)、[手机发射准备](battle-mobile.png)
- [街头](street-game.png)、[冠军场](championship-game.png)、[遗迹](ruins-game.png)
- [可编辑源文件](../../../tools/art_source/launcher.blend)
- [可重建生成器](../../../tools/build_launcher.py)

## 已验证

| 检查 | 结果 |
| --- | --- |
| `npm test` | 29 项通过 |
| `npm run build` | 通过；保留既有 Three.js 分块体积提示 |
| `npm run verify:launcher` | 15 项通过，详见 [数据](verification.json) |
| `npm run verify:worlds` | 31 项通过 |
| `npm run verify:loading` | 17 项通过，详见 [数据](loading-verification.json) |
| `npm run verify:gpu` | 21 项通过，详见 [数据](gpu-verification.json) |
| `git diff --check` | 通过 |

发射器专项验证实际 GLB、材质与预算、三个方向/倾角组合下的卡口对齐、
鼠标拖动发射箭头、手机布局、确认发射后清理、重复进出资源回收、失败重试
和延迟下载退出。三轮释放后的 GPU 计数均为 62 几何/7 纹理；预热取消后
均为 60 几何/22 纹理。这些是相应测试场景的总计数，不是模型独占数。

新增模型沿用现有下一场预热。测试证明预热完成后直接复用、不再编译，
未做本轮端到端耗时或真机帧率比较。手机截图为 Chrome 视口模拟。

GPU 检查原先固定切换到白天，白天运行时不会真的切换环境；本次修正为
切换到相反时段。加载检查仅统计场景 GLB 是否重复请求，允许发射器首次
按需下载。所有检查使用隔离存档。

## 边界

齿条、齿轮和弹簧是静态建模部件，尚未增加独立拉动/旋转动画。透明盖为
轻量 alpha 薄壳，无额外折射绘制。实际发射器已替换；场景背景的小发射器
装饰和 Godot 未迁移。沿用现有物理、装备、所有权与价格。

本次只追加发射器相关实现；工作区原有街头/遗迹材质改动保留。
