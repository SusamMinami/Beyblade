# Godot AI / MCP 安装说明

本文档用于说明如何让 AI 助手更好地操作 Godot 项目。目标是让 AI 可以读取 Godot 编辑器中的场景、节点、脚本、资源和错误信息，而不只是修改磁盘上的文本文件。

## 先选哪种方案

推荐优先级：

```text
1. Godot AI
2. Godot MCP
3. Godot MCP Pro
```

建议先从 `Godot AI` 或免费的 `Godot MCP` 开始。项目进入大量场景编辑、动画、运行时调试后，再考虑更完整的 Pro 类方案。

## 安装前提

需要准备：

- Godot 4.3 或更高版本，建议 4.4+。
- Git，当前项目已初始化 Git。
- 一个支持 MCP 的 AI 客户端。
- Windows PowerShell 或终端。
- 如果插件需要 Python 服务，安装 `uv`。
- 如果插件需要 Node.js 服务，安装 Node.js LTS。

安装插件前，先提交当前项目：

```powershell
git status
git add .
git commit -m "docs: prepare ai integration"
```

如果没有改动，`git commit` 会提示没有内容可提交，可以忽略。

## 方案 A：安装 Godot AI

`Godot AI` 是一个面向 MCP 客户端的 Godot 编辑器插件，通常可以让 AI 读取和操作场景、节点、脚本、材质、动画和项目设置。

### 1. 安装 uv

如果本机还没有 `uv`，在 PowerShell 执行：

```powershell
irm https://astral.sh/uv/install.ps1 | iex
```

安装后重开终端，验证：

```powershell
uv --version
```

### 2. 安装 Godot 插件

推荐方式：

1. 打开 Godot。
2. 打开本项目。
3. 进入 `AssetLib`。
4. 搜索 `Godot AI`。
5. 下载并安装插件。
6. 进入 `Project -> Project Settings -> Plugins`。
7. 启用 `Godot AI`。

如果 AssetLib 下载不稳定，可以从插件 GitHub 仓库下载源码，把插件目录复制到：

```text
res://addons/godot_ai/
```

然后重启 Godot 并启用插件。

### 3. 配置 AI 客户端

打开 Godot 后，插件通常会提供 MCP 客户端配置入口。选择当前使用的 AI 客户端，让插件生成配置。

配置完成后：

1. 重启 AI 客户端。
2. 保持 Godot 编辑器打开。
3. 打开项目。
4. 确认插件面板显示已连接。

### 4. 适合让我做的事

连接成功后，可以让我执行这类任务：

```text
读取当前场景树
创建地图场景
创建 RigidBody3D 陀螺节点
添加 CollisionShape3D
检查编辑器错误
调整节点属性
创建 Resource
给节点挂脚本
```

## 方案 B：安装 Godot MCP

`Godot MCP` 通常由 Godot 插件和本机 MCP 服务组成。有些版本使用 Node.js 的 `npx` 启动服务。

### 1. 安装 Node.js

安装 Node.js LTS：

```text
https://nodejs.org/
```

安装后验证：

```powershell
node --version
npm --version
```

### 2. 安装 Godot 插件

在 Godot 中：

1. 打开 `AssetLib`。
2. 搜索 `MCP` 或 `Godot MCP`。
3. 安装对应插件。
4. 进入 `Project -> Project Settings -> Plugins`。
5. 启用插件。
6. 重启项目。

### 3. 配置 MCP 服务

不同 AI 客户端配置位置不同，但结构通常类似：

```json
{
  "mcpServers": {
    "godot": {
      "command": "npx",
      "args": ["-y", "godot-mcp-server"]
    }
  }
}
```

配置后重启 AI 客户端和 Godot 项目。

## 方案 C：Godot MCP Pro

Pro 类方案通常提供更多工具，例如运行场景、读取运行时状态、调试输入、管理动画或复杂节点树。

建议使用场景：

- 地图编辑量很大。
- 需要 AI 直接创建复杂 3D 节点结构。
- 需要运行时调试和输入模拟。
- 项目已经有稳定 Git 提交流程。

注意：

- Pro 类方案可能是付费工具。
- 安装方式以插件官方文档为准。
- 需要确认它是否支持当前 Godot 版本。

## 安全和协作规则

必须遵守：

- 启用 MCP 插件前先确认 `git status` 干净。
- 插件可能直接修改并保存场景，修改前先提交。
- 不要把 GitHub token、iOS 证书、Android keystore、账号密码放进聊天或插件配置。
- 只在本机 `localhost` 使用 MCP 服务，不要暴露到公网。
- 初期建议在 `feature/ai-prototype` 分支测试。

推荐命令：

```powershell
git checkout -b feature/ai-prototype
```

如果插件修改结果不符合预期，可以通过 Git 查看差异：

```powershell
git status
git diff
```

## 我后续如何配合

如果暂时没有 MCP 插件，我可以继续通过文件系统完成：

- GDScript 编写。
- Resource 定义。
- 文档维护。
- Git 操作。
- 目录结构设计。

如果安装了 MCP 插件，请告诉我：

```text
已安装的插件名称
Godot 版本
插件面板是否显示连接成功
你希望我操作的场景名称
当前报错或截图
```

这样我可以更准确地处理场景、节点和物理配置。

