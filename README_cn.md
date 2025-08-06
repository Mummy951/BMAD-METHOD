# BMad-Method: 通用AI代理框架

[![Version](https://img.shields.io/npm/v/bmad-method?color=blue&label=version)](https://www.npmjs.com/package/bmad-method)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org)
[![Discord](https://img.shields.io/badge/Discord-Join%20Community-7289da?logo=discord&logoColor=white)](https://discord.gg/gk8jAdXWmj)

基于代理的敏捷驱动开发基础，被称为敏捷AI驱动开发的突破方法，但远不止于此。通过专业化的AI专业知识转换任何领域：软件开发、娱乐、创意写作、商业策略到个人健康等。

**[在YouTube上订阅BMadCode](https://www.youtube.com/@BMadCode?sub_confirmation=1)**

**[加入我们的Discord社区](https://discord.gg/gk8jAdXWmj)** - 一个不断增长的AI爱好者社区！获取帮助、分享想法、探索AI代理和框架、在技术项目上合作、享受爱好并互相帮助成功。无论您是在BMad上遇到困难、构建自己的代理，还是只想聊聊AI的最新动态——我们都在这里为您服务！**某些移动设备和VPN在加入Discord时可能会遇到问题，这是Discord的问题——如果邀请链接不起作用，请尝试使用您自己的网络或其他网络，或非VPN网络。**

⭐ **如果您觉得这个项目有帮助或有用，请在右上角给它一个星标！** 这有助于其他人发现BMad-Method，并且您会收到更新通知！

## 概述

**BMad方法的两个关键创新：**

**1. 代理规划：** 专门的代理（分析师、项目经理、架构师）与您合作创建详细、一致的PRD和架构文档。通过高级提示工程和人在回路的优化，这些规划代理产生的综合规范远远超出通用AI任务生成。

**2. 上下文工程化开发：** Scrum Master代理随后将这些详细计划转换为超详细的开发故事，其中包含Dev代理所需的一切——完整的上下文、实现细节和直接嵌入在故事文件中的架构指导。

这种两阶段方法消除了AI辅助开发中的**规划不一致**和**上下文丢失**这两大问题。您的Dev代理打开一个故事文件时，能够完全理解要构建什么、如何构建以及为什么构建。

**📖 [在用户指南中查看完整工作流程](bmad-core/user-guide.md)** - 规划阶段、开发周期和所有代理角色

## 快速导航

### 理解BMad工作流程

**在深入之前，请查看这些关键的工作流程图，解释BMad如何工作：**

1. **[规划工作流程（Web UI）](bmad-core/user-guide.md#the-planning-workflow-web-ui)** - 如何创建PRD和架构文档
2. **[核心开发周期（IDE）](bmad-core/user-guide.md#the-core-development-cycle-ide)** - SM、Dev和QA代理如何通过故事文件协作

> ⚠️ **这些图表解释了90%的BMad方法代理敏捷流程混淆** - 理解PRD+架构创建以及SM/Dev/QA工作流程和代理如何通过故事文件传递笔记是至关重要的——这也解释了为什么这不是任务管理器或简单的任务运行器！

### 您想做什么？

- **[安装并使用全栈敏捷AI团队构建软件](#quick-start)** → 快速开始说明
- **[学习如何使用BMad](bmad-core/user-guide.md)** → 完整的用户指南和演练
- **[查看可用的AI代理](/bmad-core/agents))** → 您团队的专业角色
- **[探索非技术用途](#-beyond-software-development---expansion-packs)** → 创意写作、商业、健康、教育
- **[创建我自己的AI代理](#creating-your-own-expansion-pack)** → 为您的领域构建代理
- **[浏览现成的扩展包](expansion-packs/)** → 游戏开发、DevOps、基础设施，并从想法和示例中获得灵感
- **[理解架构](docs/core-architecture.md)** → 技术深度解析
- **[加入社区](https://discord.gg/gk8jAdXWmj)** → 获取帮助和分享想法

## 重要：保持您的BMad安装更新

**轻松保持最新！** 如果您已经在项目中安装了BMad-Method，只需运行：

```bash
npx bmad-method install
# 或者
git pull
npm run install:bmad
```

这将：

- ✅ 自动检测您现有的v4安装
- ✅ 仅更新已更改的文件并添加新文件
- ✅ 为您所做的任何自定义修改创建`.bak`备份文件
- ✅ 保留您项目的特定配置

这使得您可以轻松从最新的改进、错误修复和新代理中受益，而不会丢失您的自定义设置！

## 快速开始

### 一条命令完成所有操作（IDE安装）

**只需运行以下命令之一：**

```bash
npx bmad-method install
# 或者如果您已经安装了BMad：
git pull
npm run install:bmad
```

这一条命令处理：

- **新安装** - 在您的项目中设置BMad
- **升级** - 自动更新现有安装
- **扩展包** - 安装您添加到package.json中的任何扩展包

> **就是这样！** 无论您是第一次安装、升级还是添加扩展包——这些命令都能完成所有操作。

**先决条件**：需要[Node.js](https://nodejs.org) v20+

### 最快开始：Web UI全栈团队为您服务（2分钟）

1. **获取包**：保存或克隆[全栈团队文件](dist/teams/team-fullstack.txt)或选择其他团队
2. **创建AI代理**：创建一个新的Gemini Gem或CustomGPT
3. **上传和配置**：上传文件并设置指令："您的关键操作说明已附加，请勿破坏角色"
4. **开始构思和规划**：开始聊天！输入`*help`查看可用命令或选择像`*analyst`这样的代理开始创建简报。
5. **关键**：随时在Web中与BMad Orchestrator对话（#bmad-orchestrator命令）并询问它关于这一切如何工作的问题！
6. **何时转移到IDE**：一旦您有了PRD、架构、可选的UX和简报——是时候切换到IDE来分片您的文档并开始实现实际代码了！详见[用户指南](bmad-core/user-guide.md)

### 替代方案：克隆和构建

```bash
git clone https://github.com/bmadcode/bmad-method.git
npm run install:bmad # 构建并安装所有内容到目标文件夹
```

## 🌟 超越软件开发 - 扩展包

BMad的自然语言框架适用于任何领域。扩展包为创意写作、商业策略、健康与健康、教育等提供专业化的AI代理。扩展包还可以使用特定功能扩展核心BMad-Method，这些功能并非对所有情况都通用。[查看扩展包指南](docs/expansion-packs.md)并学习创建您自己的扩展包！

## 代码库扁平化工具

BMad-Method包含一个强大的代码库扁平化工具，旨在为AI模型消费准备您的项目文件。该工具将您的整个代码库聚合到单个XML文件中，使您能够轻松与AI助手共享项目上下文以进行分析、调试或开发辅助。

### 功能

- **AI优化输出**：生成专为AI模型消费设计的干净XML格式
- **智能过滤**：自动遵循`.gitignore`模式排除不必要的文件
- **二进制文件检测**：智能识别并排除二进制文件，专注于源代码
- **进度跟踪**：实时进度指示器和全面的完成统计
- **灵活输出**：可自定义的输出文件位置和命名

### 用法

```bash
# 基本用法 - 在当前目录创建flattened-codebase.xml
npx bmad-method flatten

# 指定自定义输入目录
npx bmad-method flatten --input /path/to/source/directory
npx bmad-method flatten -i /path/to/source/directory

# 指定自定义输出文件
npx bmad-method flatten --output my-project.xml
npx bmad-method flatten -o /path/to/output/codebase.xml

# 组合输入和输出选项
npx bmad-method flatten --input /path/to/source --output /path/to/output/codebase.xml
```

### 示例输出

该工具将显示进度并提供全面摘要：

```
📊 完成摘要：
✅ 成功处理156个文件到flattened-codebase.xml
📁 输出文件：/path/to/your/project/flattened-codebase.xml
📏 源代码总大小：2.3 MB
📄 生成的XML大小：2.1 MB
📝 代码总行数：15,847
🔢 估计令牌数：542,891
📊 文件分解：142个文本文件，14个二进制文件，0个错误
```

生成的XML文件以结构化格式包含您项目的所有源代码，AI模型可以轻松解析和理解，非常适合代码审查、架构讨论或获取AI辅助您的BMad-Method项目。

## 文档和资源

### 必备指南

- 📖 **[用户指南](bmad-core/user-guide.md)** - 从项目启动到完成的完整演练
- 🏗️ **[核心架构](docs/core-architecture.md)** - 技术深度解析和系统设计
- 🚀 **[扩展包指南](docs/expansion-packs.md)** - 将BMad扩展到软件开发以外的任何领域

## 支持

- 💬 [Discord社区](https://discord.gg/gk8jAdXWmj)
- 🐛 [问题跟踪器](https://github.com/bmadcode/bmad-method/issues)
- 💬 [讨论区](https://github.com/bmadcode/bmad-method/discussions)

## 贡献

**我们对贡献感到兴奋，欢迎您的想法、改进和扩展包！** 🎉

📋 **[阅读CONTRIBUTING.md](CONTRIBUTING.md)** - 完整的贡献指南，包括指导原则、流程和要求

## 许可证

MIT许可证 - 详见[LICENSE](LICENSE)。

[![贡献者](https://contrib.rocks/image?repo=bmadcode/bmad-method)](https://github.com/bmadcode/bmad-method/graphs/contributors)

<sub>为AI辅助开发社区用❤️构建</sub>