# 街头与浮空遗迹材质补全

日期：2026-09-22。范围：Web 运行时材质与灯光；参考本轮用户提供的遗迹/街头设计图。
保留已有 GLB、战斗物理、街头生活比例、地图边界、配置、库存与成长。

## 交付

- 遗迹：湿石板、风化石材、铜绿/裸铜差异、晶体亮面、门内符文、局部青紫照明。
- 街头：沥青颗粒与孔隙、干湿变化、塑料盘面磨损与亮边、蓝色卡扣、透明护圈，
  以及陶土/釉面/金属/木材/布料的表面细节。
- 修正 Three r178 材质未显式绑定 `envMap` 时，独立反光强度不生效的问题。
  日夜环境显式绑定；盘面仍使用独立柔光探针。物理材质保留正确 shader defines。
- 以世界坐标程序化着色实现，无额外图片下载、GLB 面数或阴影目标。
  遗迹新增五点光、两面光；街头仍为一个积水反射目标。

[场景局部前后对比](comparison.png)；[完整旧画面](before/)；[完整最终画面](final/)。
八张最终图覆盖街头/遗迹、日/夜、1440×1000 桌面和 390×844 手机视口。
最终检查修正了首轮过密的沥青高光、重复划痕干涉纹和遗迹过浓白天雾。
这是现有粗模上的材质补全，不宣称达到示意图的建筑密度或摄影级真实感。

## 验证

| 检查 | 结果 |
| --- | --- |
| `npm test` | 29 PASS |
| `npm run build` | PASS，既有 Three.js 890 kB chunk 提示 |
| `npm run verify:materials` | 16 PASS |
| `npm run verify:worlds` | 31 PASS |
| `node tools/verify-street.mjs` | 33 PASS |
| `npm run verify:gpu` | 21 PASS |
| `npm run verify:loading` | 17 PASS |
| impeccable detector（四个变更渲染模块） | `[]` |

材质测试在独立 renderer 中分别移除法线凹凸、环境反射和局部光源，与完整画面
比较 RGB 差异大于 6 的像素，不只检查材质属性是否存在：

| 像素变化 | 遗迹 | 街头 |
| --- | ---: | ---: |
| 凹凸法线 | 694 | 9,719 |
| 环境反射 | 2,135 | 53,106 |
| 局部光源 | 46,202 | 218,294 |

取样目标为 360×640。暂停/减少动态效果后画面稳定；两轮遗迹/街头退出后，
几何与纹理回到同一基线（49 geometry、19 texture）。这验证 Three.js 资源计数，
不等于精确驱动显存测量。原街头测试仍确认实际模型进入积水反射目标，
日夜持久化、真实发射、尺度、五图切换及资源释放全部通过。
详见 [材质验证](verification.json)、各 `.log` 与 [回归截图](regression/)。
历史评审目录已还原，本轮截图单独归档。

## 性能取舍

沿用 `measure-scene-loading.mjs`，Windows/Chrome/RTX 4080、DPR 1，
固定路径、单次采样、400 ms 短停留。采样期间没有并行运行其他浏览器验收。
以下为操作至 ready、实际绘制、`gl.finish()` 和两次 RAF 的总耗时：

| 路径 | 修改前 | 修改后 |
| --- | ---: | ---: |
| 首进街头 | 1,066 ms | 1,733 ms |
| 街头预览→战斗 | 936 ms | 898 ms |
| 街头战斗→地图 | 34 ms | 45 ms |
| 首进遗迹 | 267 ms | 779 ms |
| 遗迹预览→战斗 | 414 ms | 633 ms |
| 遗迹战斗→地图 | 34 ms | 32 ms |
| 再次进入街头 | 259 ms | 243 ms |

新增着色器与灯光使首次准备更贵，本轮不宣称性能加速。
4 倍 CPU 限速且驱动缓存已热时，街头再进入 382→471 ms，遗迹开战
298→397 ms。CPU 限速不等于低端手机 GPU，也未进行实体手机认证。
预热与取消的 21 项检查仍通过；短停留采样不代表充分阅读预热后的开战延迟。
原始数据：[修改前](loading-before.json)、[修改后](loading-after.json)。

## 复查

本轮本地服务器使用 `http://127.0.0.1:5175`，因为 5173 已由另一个项目占用。
命令支持 `LAB_TEST_URL`；未修改项目默认端口。

```powershell
cd web-prototype
$env:LAB_TEST_URL = "http://127.0.0.1:5175"
npm run verify:materials
node tools/capture-world-materials.mjs current
```

最终源码为 `world-surface.js`、`ruins-atmosphere.js`、`street-atmosphere.js`、
`three-stage.js`；没有新增生产调试 API。未提交、推送或移植 Godot。
