# 冠军竞技场交付记录

## 实现范围

Web 冠军场继续使用 `metal` ID 和半径 6.9 的原盘面；本次美术不修改物理、
装备或存档结构。增加分段检修甲板、螺栓、散热槽、阶梯设备组、桁架灯塔、
吊挂记分屏和电源模块。Blender 源文件保持物件可编辑；运行时按材质合并。

六路真实聚光灯与灯头同步转动，透明几何光锥显示空气中的光线；
两圈分段灯轨反向流动。局部光会实际照亮金属表面，盘面和边框使用带清漆
的物理材质与细磨纹。白天降低装饰灯强度，夜间强化冷色局部照明。

## 主线程验证

| 检查 | 结果 |
| --- | --- |
| `npm test` | 29 passed |
| `npm run verify:structure` | 69 passed |
| `npm run verify:worlds` | 31 passed |
| `npm run verify:campaign` | 65 passed |
| `npm run verify:battle-ui` | 20 passed |
| `npm run verify:lab` | 27 passed |
| `npm run verify:showroom` | 25 passed |
| `node tools/verify-street.mjs` | 33 passed |
| `npm run verify:championship` | 24 passed |
| `node tools/verify-battle-motion.mjs` | 普通模式 855 ms；减少动态效果 0 ms |
| `npm run build` | passed；保留 Three.js 约 888 kB 的既有分块体积提示 |

专项原始结果见 [verification.json](verification.json)。夜间动态导致 1,739 个
取样像素变化；关闭光锥后比较聚光灯开关，2,121 个取样像素发生变化，
用于验证光源确实作用于表面。暂停、减少动态效果、页面隐藏、白天降光、
材质类型和两次重复进出的 GPU 资源稳定性均通过。退出冠军场恢复通用灯光。

六路新聚光灯均不生成独立阴影图。当前地图预览测得 70 次提交、533,926 个
提交三角形，含主方向灯阴影和后处理；不是单份模型面数或手机性能认证。
模型约 6.66 MB。渲染模块设计检测输出 `[]`。

## 独立视觉审阅

Disposition: **ship**。专用 finish-reviewer 不可用，使用全新、无会话继承的
通用子代理替代。审阅者独立打开以下全部截图：

- [白天桌面](day-desktop.png)、[夜晚桌面](night-desktop.png)：1440×1000
  视口中的 564×1000 竖屏游戏区域。
- [白天手机](day-mobile.png)、[夜晚手机](night-mobile.png)：390×844 发射界面。
- [白天战斗](day-running-mobile.png)、[夜晚战斗](night-running-mobile.png)：390×844。

Material findings: 无本次范围内必须修正的问题。确认了分段板、紧固件、
冷却槽、桁架及多层围挡的可见细节；石墨、缎面金属、抛光边条与发光线
保持区分。盘边、陀螺、A/B/C 标记和手机关键操作区清楚。

Accepted choices: 保留浅碗及青色/石墨色场景；阶梯为设备组。
白天光锥更弱，夜晚局部照明更明显；黄色活动区优先于装饰光，
透明围挡不遮挡战斗。发射按钮与战斗摇杆均在可视区域。

Limitations: 静态审阅只证明所列发射/战斗截图的可见结果，不独立认证
运动、物理、地图预览、性能或其他修改。运行时检查来自主线程。
手机为 Chrome 视口模拟，Godot 与外部服务未迁移。
