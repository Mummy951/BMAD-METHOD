# BMad 文档模板规范

## 概述

BMad 文档模板以 YAML 格式定义，用于驱动交互式文档生成和代理交互。模板将结构定义与内容生成分离，使其既适用于人类，也适用于 LLM 代理。

## 模板结构

```yaml
template:
  id: template-identifier
  name: 人类可读模板名称
  version: 1.0
  output:
    format: markdown
    filename: default-path/to/{{filename}}.md
    title: "{{variable}} 文档标题"

workflow:
  mode: interactive
  elicitation: advanced-elicitation

sections:
  - id: section-id
    title: 章节标题
    instruction: |
      LLM 如何处理此章节的详细说明
    # ... 其他章节属性
```

## 核心字段

### 模板元数据

- **id**：模板的唯一标识符
- **name**：在 UI 中显示的人类可读名称
- **version**：用于跟踪更改的模板版本
- **output.format**：文档模板的默认“markdown”
- **output.filename**：默认输出文件路径（可包含变量）
- **output.title**：文档标题（在 markdown 中成为 H1）

### 工作流配置

- **workflow.mode**：默认交互模式（“interactive”或“yolo”）
- **workflow.elicitation**：要使用的启发任务（“advanced-elicitation”）

## 章节属性

### 必填字段

- **id**：唯一的章节标识符
- **title**：章节标题文本
- **instruction**：LLM 处理此章节的详细指南

### 可选字段

#### 内容控制

- **type**：结构化章节的内容类型提示
- **template**：章节内容的固定模板文本
- **item_template**：章节中可重复项的模板
- **prefix**：编号项的前缀（例如，“FR”，“NFR”）

#### 行为标志

- **elicit**：布尔值 - 章节渲染后应用启发
- **repeatable**：布尔值 - 章节可重复多次
- **condition**：字符串 - 包含章节的条件（例如，“具有 UI 需求”）

#### 代理权限

- **owner**：字符串 - 最初创建/填充此章节的代理角色
- **editors**：数组 - 允许修改此章节的代理角色列表
- **readonly**：布尔值 - 章节在初始创建后无法修改

#### 内容指导

- **examples**：示例内容数组（不包含在输出中）
- **choices**：包含常见决策选项的对象
- **placeholder**：默认占位符文本

#### 结构

- **sections**：嵌套子章节的数组

## 支持的类型

### 内容类型

- **bullet-list**：无序列表项
- **numbered-list**：带可选前缀的有序列表
- **paragraphs**：自由格式段落文本
- **table**：结构化表格数据
- **code-block**：代码或配置块
- **template-text**：带变量替换的固定模板
- **mermaid**：带指定类型和详细信息的 Mermaid 图表

### 特殊类型

- **repeatable-container**：多个实例的容器
- **conditional-block**：根据条件显示的内容
- **choice-selector**：向用户呈现选择

## 高级功能

### 变量替换

在标题、模板和内容中使用 `{{variable_name}}`：

```yaml
title: "史诗 {{epic_number}} {{epic_title}}"
template: "作为 {{user_type}}，我想要 {{action}}，以便 {{benefit}}。"
```

### 条件章节

```yaml
- id: ui-section
  title: 用户界面设计
  condition: 项目具有 UX/UI 需求
  instruction: 仅在项目具有 UI 组件时包含
```

### 选择集成

```yaml
choices:
  architecture: [单体, 微服务, 无服务器]
  testing: [仅单元, 单元 + 集成, 完整金字塔]
```

### Mermaid 图表

```yaml
- id: system-architecture
  title: 系统架构图
  type: mermaid
  instruction: 创建一个显示关键组件和数据流的系统架构图
  mermaid_type: flowchart
  details: |
    显示以下组件：
    - 用户界面层
    - API 网关
    - 核心服务
    - 数据库层
    - 外部集成
```

**支持的 mermaid_type 值：**

**核心图表类型：**

- `flowchart` - 流程图和过程图
- `sequenceDiagram` - 交互序列图
- `classDiagram` - 类关系图 (UML)
- `stateDiagram` - 状态转换图
- `erDiagram` - 实体关系图
- `gantt` - 甘特图（时间线）
- `pie` - 饼图（数据可视化）

**高级图表类型：**

- `journey` - 用户旅程图
- `mindmap` - 思维导图（头脑风暴）
- `timeline` - 时间线图（按时间顺序的事件）
- `quadrantChart` - 象限图（数据分类）
- `xyChart` - XY 图表（条形图、折线图）
- `sankey` - 桑基图（流可视化）

**专业类型：**

- `c4Context` - C4 上下文图（实验性）
- `requirement` - 需求图
- `packet` - 网络数据包图
- `block` - 块图
- `kanban` - 看板

### 代理权限示例

```yaml
- id: story-details
  title: 故事
  owner: scrum-master
  editors: [scrum-master]
  readonly: false
  sections:
    - id: dev-notes
      title: 开发说明
      owner: dev-agent
      editors: [dev-agent]
      readonly: false
      instruction: 实施说明和技术细节
    - id: qa-results
      title: QA 结果
      owner: qa-agent
      editors: [qa-agent]
      readonly: true
      instruction: 质量保证测试结果
```

### 可重复章节

```yaml
- id: epic-details
  title: 史诗 {{epic_number}} {{epic_title}}
  repeatable: true
  sections:
    - id: story
      title: 故事 {{epic_number}}.{{story_number}} {{story_title}}
      repeatable: true
      sections:
        - id: criteria
          title: 验收标准
          type: numbered-list
          item_template: "{{criterion_number}}: {{criteria}}"
          repeatable: true
```

### 包含代码块的示例

````yaml
examples:
  - "FR6: 系统必须在 2 秒内验证用户身份"
  - |
    ```mermaid
    sequenceDiagram
        participant User
        participant API
        participant DB
        User->>API: POST /login
        API->>DB: Validate credentials
        DB-->>API: User data
        API-->>User: JWT token
    ```
  - |
    **架构决策记录**

    **决策**：使用 PostgreSQL 作为主数据库
    **理由**：需要 ACID 合规性和 JSON 支持
    **后果**：需要数据库管理专业知识
````

## 章节层次结构

模板定义了从第一个 H2 开始的完整文档结构 - 每个级别都是下一个 H#：

```yaml
sections:
  - id: overview
    title: 项目概述
    sections:
      - id: goals
        title: 目标
      - id: scope
        title: 范围
        sections:
          - id: in-scope
            title: 范围内
          - id: out-scope
            title: 范围外
```

## 处理流程

1. **解析模板**：加载和验证 YAML 结构
2. **初始化工作流**：设置交互模式和启发
3. **处理章节**：按顺序处理每个章节：
   - 检查条件
   - 应用指令
   - 生成内容
   - 处理选择和变量
   - 如果指定，应用启发
   - 处理嵌套章节
4. **生成输出**：创建干净的 markdown 文档

## 最佳实践

### 模板设计

- 保持指令清晰明确
- 为复杂内容使用示例
- 逻辑地组织章节结构
- 包含 LLM 所需的所有必要指导

### 内容指令

- 明确预期格式
- 包括决策的理由
- 指定交互模式
- 需要时引用其他文档

### 变量命名

- 使用描述性变量名称
- 遵循一致的命名约定
- 文档化预期的变量值

### 示例用法

- 为复杂章节提供具体示例
- 包含简单和复杂的情况
- 使用实际项目场景
- 在有帮助时包含代码块和图表

## 验证

模板应验证：

- 有效的 YAML 语法
- 必填字段存在
- 一致的章节 ID
- 正确的嵌套结构
- 有效的变量引用

## 从旧版迁移

从 markdown+frontmatter 模板转换时：

1. 将嵌入的 `[[LLM:]]` 指令提取到 `instruction` 字段
2. 将 `<<REPEAT>>` 块转换为 `repeatable: true` 章节
3. 将 `^^CONDITIONS^^` 提取到 `condition` 字段
4. 将 `@{examples}` 移动到 `examples` 数组
5. 将 `{{placeholders}}` 转换为正确的变量语法

本规范确保模板既可人类阅读又可机器处理，同时保持复杂文档生成所需的灵活性。