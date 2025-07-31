# BMad Method 分析开源项目的步骤

## 概述

BMad Method 是一个专门用于 AI 驱动的敏捷开发框架，提供了强大的项目分析能力。本指南将详细介绍如何使用 BMad Method 来分析指定的开源项目代码。

## 1. 安装和设置

### 全局安装 BMad Method

```bash
# 全局安装
npx bmad-method install

# 或者在项目目录中安装
cd /path/to/your/target/project
npx bmad-method install --full
```

### 检查安装状态

```bash
# 查看安装状态
npx bmad-method status

# 查看可用的扩展包
npx bmad-method list:expansions
```

## 2. 使用代码扁平化功能

BMad 提供了强大的代码扁平化工具，可以将整个项目转换为 AI 友好的 XML 格式：

```bash
# 基本用法 - 在当前目录创建 flattened-codebase.xml
npx bmad-method flatten

# 指定输入目录
npx bmad-method flatten --input /path/to/opensource/project

# 指定输出文件
npx bmad-method flatten --output project-analysis.xml

# 组合使用
npx bmad-method flatten --input /path/to/target/project --output /path/to/target/project/target-project.xml
```

### 扁平化工具特性

- **AI 优化输出**：生成专为 AI 模型消费设计的清洁 XML 格式
- **智能过滤**：自动遵循 `.gitignore` 模式排除不必要的文件
- **二进制文件检测**：智能识别并排除二进制文件，专注于源代码
- **进度跟踪**：实时进度指示器和全面的完成统计
- **灵活输出**：可自定义输出文件位置和命名

## 3. 项目分析方法

### 方法 A: 使用 Gemini Web（推荐用于大型项目）

**适用于**：大型代码库、单体仓库或复杂系统分析

1. **访问 Gemini Web**：前往 gemini.google.com
2. **上传项目**：
   - 直接粘贴 GitHub 仓库 URL
   - 或上传生成的 `project-analysis.xml` 文件
3. **加载分析师代理**：上传 `dist/agents/analyst.txt`
4. **运行文档化命令**：输入 `*document-project`

**优势**：
- 1M+ 令牌上下文窗口
- 可以分析整个代码库
- 成本效益高

### 方法 B: 使用本地 IDE 配置

**适用于**：较小项目或需要交互式分析

1. **在目标项目中配置 BMad 代理**
2. **使用 IDE 集成**：
   - Cursor: 按 `Ctrl+L`，输入 `@analyst`
   - VS Code: 配置相应的代理
3. **执行分析任务**

## 4. 分析工作流程

### 自动化项目分析步骤

分析师代理会执行以下结构化分析：

1. **项目结构发现**
   - 检查根目录结构
   - 识别主要文件夹和组织模式
   - 分析项目层次结构

2. **技术栈识别**
   - 查找配置文件：`package.json`, `requirements.txt`, `Cargo.toml`, `pom.xml` 等
   - 识别编程语言和框架
   - 分析依赖关系

3. **构建系统分析**
   - 找到构建脚本和配置
   - 分析 CI/CD 配置
   - 检查部署策略

4. **现有文档审查**
   - 检查 README 文件
   - 分析 docs 文件夹内容
   - 评估文档完整性

5. **代码模式分析**
   - 采样关键文件
   - 了解编码模式和架构方法
   - 识别设计模式

## 5. 棕地项目分析（现有项目）

### 选项 1: PRD 优先方法（推荐用于大型代码库）

```bash
# 1. 上传项目到 Gemini Web
# 2. 创建 PRD：@pm → *create-doc brownfield-prd
# 3. 聚焦文档化：@analyst → *document-project
```

**特点**：
- 分析师会询问焦点（如果没有提供 PRD）
- 选择"单文档"格式用于 Web UI
- 使用 PRD 仅文档化相关区域
- 避免用未使用代码膨胀文档

### 选项 2: 文档优先方法（适用于较小项目）

```bash
# 1. 上传项目到 Gemini Web
# 2. 文档化所有内容：@analyst → *document-project
# 3. 然后创建 PRD：@pm → *create-doc brownfield-prd
```

## 6. 配置 IDE 集成

### Cursor 配置

```yaml
# .cursor/rules/bmad-architect.mdc
name: '🏗️ Architect'
roleDefinition: You are an Architect specializing in architect tasks and responsibilities.
whenToUse: Use for Architect tasks
customInstructions: CRITICAL Read the full YAML from .bmad-core/agents/architect.md
```

### 使用方法

1. 按 `Ctrl+L`（Mac 上是 `Cmd+L`）打开聊天
2. 输入 `@architect`（或其他代理名称）
3. 代理将采用该角色进行对话

## 7. 实际使用示例

### 分析大型开源项目

```bash
# 1. 克隆目标项目
git clone https://github.com/target/project.git
cd project

# 2. 扁平化项目
npx bmad-method flatten -o project-analysis.xml

# 3. 上传到 Gemini Web 并加载团队配置
# 使用 team-fullstack 或 team-all 获得多角色分析

# 4. 执行系统化分析
# @analyst → *document-project
# @architect → *create-full-stack-architecture
# @pm → *create-doc brownfield-prd
```

### 分析特定功能模块

```bash
# 聚焦特定目录
npx bmad-method flatten --input ./src/payment-module --output payment-analysis.xml

# 在 Gemini Web 中：
# "分析这个支付模块的架构和实现模式"
```

## 8. 最佳实践

### 成本效益的文档创建工作流

1. **使用 Web UI**：在 Web 界面中创建大型文档以提高成本效益
2. **复制最终输出**：将完整的 markdown 保存到项目中
3. **标准命名**：保存为 `docs/prd.md` 和 `docs/architecture.md`
4. **切换到 IDE**：使用 IDE 代理进行开发和较小文档

### 文档分片

对于大型文档，可以使用分片功能：

```bash
# 在 IDE 中分片文档
@po shard docs/prd.md
@po shard docs/architecture.md
```

### 团队协作模式

- **使用 Gemini 进行大局规划** - team-fullstack 包提供协作专业知识
- **使用 bmad-master 进行文档组织** - 分片创建可管理的块
- **严格遵循 SM → Dev 循环** - 确保系统性进展
- **保持对话聚焦** - 每次对话一个代理，一个任务

## 9. 故障排除

### "AI 不理解我的代码库"

**解决方案**：使用更具体的路径重新运行 `document-project`

### "生成的计划不符合我们的模式"

**解决方案**：在规划阶段之前，用你的特定约定更新生成的文档

### "小改动的样板代码太多"

**解决方案**：使用 `create-brownfield-story` 而不是完整工作流

## 10. 决策树

```
你有大型代码库或单体仓库吗？
├─ 是 → PRD 优先方法
│   └─ 创建 PRD → 仅文档化受影响区域
└─ 否 → 代码库对你来说熟悉吗？
    ├─ 是 → PRD 优先方法
    └─ 否 → 文档优先方法

这是影响多个系统的重大增强吗？
├─ 是 → 完整棕地工作流
└─ 否 → 这比简单的错误修复更复杂吗？
    ├─ 是 → brownfield-create-epic
    └─ 否 → brownfield-create-story
```

## 结论

BMad Method 为分析现有系统提供了结构和安全性。关键是通过文档提供全面的上下文，使用考虑集成要求的专门模板，并遵循尊重现有约束同时实现进展的工作流。

**记住**：**先文档化，仔细规划，安全集成**