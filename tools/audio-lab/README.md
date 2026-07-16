# Tone.js 音效实验室

用于试听、调整和导出《战斗陀螺》的程序化音效。工具不会参与 Godot
运行时，也不会进入游戏导出包。

## 启动

```powershell
cd tools/audio-lab
npm install
npm run dev
```

打开终端显示的本地地址。页面支持：

- 调整机械力度、金属亮度和输出音量。
- 单独试听或导出 WAV。
- 将第一批 10 个音效导出为 ZIP。

## 输出规格

- 48 kHz、16-bit PCM、双声道 WAV。
- 文件峰值限制在 -0.7 dBFS 以下。
- `spin_loop_fast.wav` 使用 4 ms 余弦边缘淡化，导入 Godot 后需启用循环。

默认参数生成的版本位于：

```text
res://audio/generated/batch_01/
```

修改配方后执行 `npm run build`，确保生产构建仍能通过。
