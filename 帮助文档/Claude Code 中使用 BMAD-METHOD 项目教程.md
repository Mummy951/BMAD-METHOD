# Claude Code 中使用 BMAD-METHOD 项目教程

## 简介

BMAD-METHOD (Breakthrough Method of Agile AI-driven Development) 是一个通用 AI 代理框架，专为敏捷 AI 驱动的软件开发而设计。它提供了一套结构化的代理、任务、模板和工作流，可以在 IDE（如 VS Code、Cursor）或 Web 界面（如 Claude、Gemini）中使用。

本教程将指导您如何在 Claude Code 中安装、配置和使用 BMAD-METHOD 项目。

## BMAD-METHOD 核心组件

### 代理 (Agents)
BMAD-METHOD 包含多个专门的 AI 代理，每个代理都针对特定的敏捷开发角色：
- **Product Manager (PM)**: 负责 PRD 创建、功能优先级排序和产品策略
- **Architect**: 负责系统设计、技术选型、API 设计和基础设施规划
- **Developer (Dev)**: 负责代码实现、调试和重构
- **UX Expert**: 负责 UI/UX 设计、线框图、原型和前端规范
- **Scrum Master (SM)**: 负责故事创建、史诗管理和敏捷流程指导
- **QA**: 负责高级代码评审、重构、测试计划和质量保证

### 任务 (Tasks)
任务是可执行的工作流，用于完成特定的开发任务。例如：
- `create-doc`: 根据模板创建文档
- `create-next-story`: 创建下一个用户故事
- `shard-doc`: 将大型文档分片

### 模板 (Templates)
模板定义了文档的结构和内容。例如：
- `prd-tmpl`: 产品需求文档模板
- `architecture-tmpl`: 架构文档模板
- `story-tmpl`: 用户故事模板

## Claude Code 配置要求

在 Claude Code 中，BMAD-METHOD 代理通过以下方式配置：
- **规则目录**: `.claude/commands/BMad/`
- **格式**: 多文件
- **命令后缀**: `.md`
- **使用方式**: 输入 `/代理名称` (例如，`/dev`, `/pm`, `/architect`)

## 安装和配置步骤

### 1. 安装 BMAD-METHOD

首先，您需要在您的项目中安装 BMAD-METHOD：

```bash
# 使用 npx 安装 BMAD-METHOD
npx bmad-method install
```

安装程序将引导您完成安装过程，包括：
- 选择安装类型（完整安装、单个代理安装等）
- 选择要安装的扩展包
- 配置 IDE 集成

### 2. 配置 Claude Code

在安装过程中，安装程序会自动为 Claude Code 配置 BMAD-METHOD 代理。配置文件将被放置在 `.claude/commands/BMad/` 目录中。

如果您需要手动配置，可以按照以下步骤操作：

1. 在您的项目根目录中创建 `.claude/commands/BMad/` 目录
2. 将 BMAD-METHOD 代理文件复制到该目录中
3. 确保每个代理文件的扩展名为 `.md`

### 3. 验证安装

安装完成后，您可以在 Claude Code 中验证 BMAD-METHOD 是否正确配置：

1. 打开 Claude Code
2. 输入 `/help` 查看可用命令
3. 您应该能看到 BMAD-METHOD 代理命令列表

## 使用示例

### 1. 使用 Product Manager 代理创建 PRD

```claude
/pm 创建一个任务管理应用的 PRD
```

### 2. 使用 Architect 代理设计系统架构

```claude
/architect 根据 PRD 设计系统架构
```

### 3. 使用 Developer 代理实现功能

```claude
/dev 实现用户认证功能
```

### 4. 使用 Scrum Master 代理创建用户故事

```claude
/sm 从 PRD 中创建用户故事
```

## 查看可用的 Agent

BMAD-METHOD 提供了多种方式来查看当前可用的 Agent：

### 1. 使用安装程序命令

您可以使用 BMAD-METHOD 安装程序的 list-agents 命令来查看所有可用的 Agent：

```bash
# 列出所有可用的 Agent
npx bmad-method list-agents
```

此命令将显示所有可用 Agent 的列表，包括它们的 ID 和简要描述。

### 2. 查看 Agent 目录

您也可以直接查看项目中的 Agent 文件来了解可用的 Agent：

```bash
# 查看 bmad-core 中的 Agent
ls bmad-core/agents/

# 或者查看项目根目录中的 .bmad-core 文件夹
ls .bmad-core/agents/
```

每个 Agent 都有一个对应的 `.md` 文件，文件名（不包括扩展名）就是 Agent 的 ID。

### 3. 在 Claude Code 中查看

在 Claude Code 中，您可以使用 `/help` 命令来查看所有可用的 BMAD-METHOD 命令，包括 Agent 命令：

```claude
/help
```

这将显示所有可用的命令列表，您可以从中找到 BMAD-METHOD 提供的 Agent 命令。

## 取消激活模式

当您在 Claude Code 中激活了 BMAD-METHOD 的某个 Agent 后，有几种方式可以退出当前的 Agent 模式：

### 1. 使用 exit 命令

每个 BMAD-METHOD Agent 都提供了一个 `exit` 命令，用于优雅地退出当前的 Agent 模式：

```claude
/pm 创建一个任务管理应用的 PRD
# 在 PM Agent 模式下工作...

# 退出 PM Agent 模式
*exit
```

注意：在 Claude Code 中，您需要使用 `*` 前缀来执行 Agent 的命令，所以退出命令是 `*exit` 而不是 `exit`。

### 2. 切换到其他 Agent

您可以直接切换到另一个 BMAD-METHOD Agent，这将自动退出当前的 Agent 模式：

```claude
/pm 创建一个任务管理应用的 PRD
# 在 PM Agent 模式下工作...

# 切换到 Architect Agent
/architect 设计系统架构
```

### 3. Claude Code 中的其他退出方式

在 Claude Code 中，您还可以使用以下方式退出当前的 Agent 模式：

1. **清除对话历史**：通过 Claude Code 的界面选项清除对话历史，这将重置所有 Agent 状态
2. **重新开始对话**：开始一个新的对话窗口，这将退出所有 Agent 模式

## 最佳实践

### 1. 代理选择
- 根据任务类型选择合适的代理
- 在复杂任务中，可以按顺序使用多个代理

### 2. 上下文管理
- 保持相关文件在 Claude Code 的上下文中
- 避免过多无关文件影响代理性能

### 3. 迭代开发
- 使用小的、专注的任务
- 定期提交代码更改

### 4. 文档维护
- 保持 PRD 和架构文档的更新
- 使用分片功能管理大型文档

## 故障排除

### 1. 代理命令不可用
- 确保 BMAD-METHOD 已正确安装
- 检查 `.claude/commands/BMad/` 目录是否存在
- 重启 Claude Code

### 2. 代理响应不准确
- 确保提供足够的上下文信息
- 使用更具体的指令
- 检查相关文档是否完整

### 3. 安装问题
- 确保 Node.js 版本 >= 20.0.0
- 检查网络连接
- 查看安装日志获取更多信息

## 结论

BMAD-METHOD 为 AI 辅助的软件开发提供了强大的框架。通过在 Claude Code 中正确配置和使用 BMAD-METHOD 代理，您可以显著提高开发效率和代码质量。

记住：BMAD-METHOD 旨在增强您的开发流程，而不是替代您的专业知识。将其用作加速项目的强大工具，同时保持对设计决策和实现细节的控制。