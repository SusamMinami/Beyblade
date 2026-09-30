# 碰撞诊断测试跟进

上轮场景验收遗留的单测失败已修复。当前全量 **31/31 通过**，构建通过。

## 范围

修改 [battle-simulation.test.js](../../../web-prototype/tests/battle-simulation.test.js#L65) 中的碰撞诊断用例，新增未接触边界用例。没有修改游戏源码、战斗规则、部件数据或场景美术，也没有调整依赖或测试配置。

被测路径为 `BattleSimulation.step` → `_resolveCollision` → `_applyCollisionImbalance` / `_collisionTopState` / `_createCollisionTelemetry`，使用真实实现与固定输入。

## 缺陷分析

旧用例在发射后只设置 `tilt=0.12/0.08`，没有同步 `tiltVector`。现有模型按向量表示倾斜，碰撞把受力方向加到向量上，然后从向量长度计算标量倾角。旧用例的标量与向量互相矛盾，稳定复现 `tiltDelta=-0.046875`。

此外，“任意碰撞都会增大倾角”的断言不适合当前模型：撞击方向与原有倾斜相反时，可以抵消部分倾斜，同时增加结构损伤与失衡。检查了实际发射初始化、碰撞响应、轴更新和诊断差值实现，没有在本次范围内证实求解器缺陷。

修复使用现有 `launchExplicit` 初始化完整姿态，保留正负方向检查，而非将失败断言简单删掉。日志回调复制碰撞瞬间的实际状态，避免把之后的轴运动/失衡恢复混入碰撞诊断。

## 用例

| 用例 | 检查内容 |
| --- | --- |
| 撞击加重原有倾斜 | 双方倾角增大；转速降低、失衡及损伤增加 |
| 反向撞击抵消部分倾斜 | 双方倾角减小；仍验证转速损失、失衡和损伤 |
| 未接触 | 不产生碰撞事件、诊断日志、碰撞记录或伤害 |

前两项同时检查双方标量倾角与向量长度一致，记录的碰撞后数值等于日志回调采样到的实际状态，差值等于“后值−前值”，日志与事件指向同一诊断记录。原有一项改为两个方向场景，再新增一项未接触场景，测试总数由 29 增至 31。

## 验证

| 阶段 | 命令 | 结果 |
| --- | --- | --- |
| 修改前复现 | `timeout 120s npm test -- tests/battle-simulation.test.js` | `historical-test-failed`，7 通过、1 失败，[日志](tests-followup/baseline.log) |
| 第一轮生成后验证 | 同上 | `all-pass`，10/10；无需第二轮修复，[日志](tests-followup/round1.log) |
| 全量回归 | `timeout 300s npm test` | `all-pass`，5 文件、31/31，[日志](tests-followup/full-test.log) |
| 语法 | `node --check tests/battle-simulation.test.js` | 通过 |
| 构建 | `npm run build` | 通过；保留 Three 主包大于 500 kB 的提示，[日志](tests-followup/build.log) |
| 改动格式 | `git diff --check` | 通过 |

以上 timeout 由 Git Bash 提供。测试运行于当前 `web-prototype` npm 包，Vitest 3.2.7 / Node 24.16.0。未请求覆盖率，因此未新增覆盖率依赖或统计。此次只改测试，未重复执行上轮已通过的浏览器美术验收。

`bits-unit-test-gen` 六步流程已执行。准备脚本建立临时目录，但 utree 安装返回 `unsupported OS (cygwin)`；最终 `utree flush` 已调用，因可执行文件不存在返回 127。该工具限制不影响本地测试运行，本文件及原始日志作为本地报告。
