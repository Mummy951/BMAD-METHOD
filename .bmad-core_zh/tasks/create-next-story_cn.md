# 创建下一个故事任务

## 目的

根据项目进度和 Epic 定义识别下一个逻辑故事，然后使用“故事模板”准备一个全面、独立和可操作的故事文件。此任务确保故事包含所有必要的技术上下文、要求和验收标准，使其能够由开发代理高效实施，而无需额外研究或查找其自身上下文。

## 顺序任务执行（当前任务完成前请勿继续）

### 0. 加载核心配置和检查工作流

- 从项目根目录加载 `.bmad-core/core-config.yaml`
- 如果文件不存在，请“暂停”并通知用户：“未找到 core-config.yaml。故事创建需要此文件。您可以选择：1) 从 GITHUB bmad-core/core-config.yaml 复制并为您的项目配置，或 2) 针对您的项目运行 BMad 安装程序以自动升级和添加文件。请在继续之前添加和配置 core-config.yaml。”
- 提取关键配置：`devStoryLocation`、`prd.*`、`architecture.*`、`workflow.*`

### 1. 识别要准备的下一个故事

#### 1.1 定位 Epic 文件并审查现有故事

- 根据配置中的 `prdSharded`，定位 Epic 文件（分片位置/模式或单一 PRD 部分）
- 如果 `devStoryLocation` 包含故事文件，加载最高 `{epicNum}.{storyNum}.story.md` 文件
- **如果存在最高故事：**
  - 验证状态是否为“完成”。如果不是，请提醒用户：“警报：发现未完成的故事！文件：{lastEpicNum}.{lastStoryNum}.story.md 状态：[当前状态] 您应该首先修复此故事，但您是否愿意接受风险并覆盖以在草稿中创建下一个故事？”
  - 如果继续，选择当前 Epic 中的下一个顺序故事
  - 如果 Epic 已完成，请提示用户：“Epic {epicNum} 完成：Epic {epicNum} 中的所有故事均已完成。您想：1) 从故事 1 开始 Epic {epicNum + 1} 2) 选择要处理的特定故事 3) 取消故事创建”
  - **关键**：永远不要自动跳到另一个 Epic。用户“必须”明确指示要创建哪个故事。
- **如果不存在故事文件：** 下一个故事始终是 1.1（第一个 Epic 的第一个故事）
- 向用户宣布已识别的故事：“已识别要准备的下一个故事：{epicNum}.{storyNum} - {故事标题}”

### 2. 收集故事要求和先前故事上下文

- 从已识别的 Epic 文件中提取故事要求
- 如果存在先前故事，审查开发代理记录部分以获取：
  - 完成笔记和调试日志引用
  - 实施偏差和技术决策
  - 遇到的挑战和吸取的教训
- 提取与当前故事准备相关的见解

### 3. 收集架构上下文

#### 3.1 确定架构读取策略

- **如果 `architectureVersion: >= v4` 且 `architectureSharded: true`**：读取 `{architectureShardedLocation}/index.md`，然后遵循下面结构化读取顺序
- **否则**：对类似部分使用单一 `architectureFile`

#### 3.2 根据故事类型读取架构文档

**对于所有故事：** tech-stack.md、unified-project-structure.md、coding-standards.md、testing-strategy.md

**对于后端/API 故事，额外包括：** data-models.md、database-schema.md、backend-architecture.md、rest-api-spec.md、external-apis.md

**对于前端/UI 故事，额外包括：** frontend-architecture.md、components.md、core-workflows.md、data-models.md

**对于全栈故事：** 读取上面列出的后端和前端部分

#### 3.3 提取故事特定的技术细节

仅提取与实施当前故事直接相关的信息。不要在源文档中发明新的库、模式或标准。

提取：

- 故事将使用的特定数据模型、模式或结构
- 故事必须实现或使用的 API 端点
- 故事中 UI 元素的组件规范
- 新代码的文件路径和命名约定
- 故事功能特定的测试要求
- 影响故事的安全或性能考虑

始终引用源文档：`[来源：architecture/{filename}.md#{section}]`

### 4. 验证项目结构对齐

- 将故事要求与 `docs/architecture/unified-project-structure.md` 中的项目结构指南进行交叉引用
- 确保文件路径、组件位置或模块名称与定义结构对齐
- 在故事草稿的“项目结构说明”部分中记录任何结构冲突

### 5. 使用完整上下文填充故事模板

- 使用故事模板创建新的故事文件：`{devStoryLocation}/{epicNum}.{storyNum}.story.md`
- 填写基本故事信息：标题、状态（草稿）、故事陈述、Epic 中的验收标准
- **`开发笔记` 部分（关键）：**
  - 关键：本节“必须”只包含从架构文档中提取的信息。绝不能发明或假设技术细节。
  - 包含第 2-3 步中的所有相关技术细节，按类别组织：
    - **先前故事见解**：先前故事中的关键经验教训
    - **数据模型**：特定模式、验证规则、关系 [带来源参考]
    - **API 规范**：端点详细信息、请求/响应格式、身份验证要求 [带来源参考]
    - **组件规范**：UI 组件详细信息、属性、状态管理 [带来源参考]
    - **文件位置**：根据项目结构应创建新代码的精确路径
    - **测试要求**：来自 testing-strategy.md 的特定测试用例或策略
    - **技术约束**：版本要求、性能考虑、安全规则
  - 每个技术细节“必须”包含其来源参考：`[来源：architecture/{filename}.md#{section}]`
  - 如果在架构文档中找不到某个类别的信息，请明确说明：“架构文档中未找到具体指导”
- **`任务 / 子任务` 部分：**
  - 仅根据：Epic 要求、故事 AC、审查的架构信息生成详细、顺序的技术任务列表
  - 每个任务必须引用相关架构文档
  - 根据测试策略将单元测试作为明确的子任务包含
  - 在适用时将任务链接到 AC（例如，`任务 1 (AC: 1, 3)`）
- 添加关于在第 4 步中发现的项目结构对齐或差异的注释

### 6. 故事草稿完成和审查

- 审查所有部分的完整性和准确性
- 验证所有来源引用是否包含在技术细节中
- 确保任务与 Epic 要求和架构约束对齐
- 将状态更新为“草稿”并保存故事文件
- 执行 `.bmad-core/tasks/execute-checklist` `.bmad-core/checklists/story-draft-checklist`
- 向用户提供摘要，包括：
  - 创建的故事：`{devStoryLocation}/{epicNum}.{storyNum}.story.md`
  - 状态：草稿
  - 架构文档中包含的关键技术组件
  - Epic 和架构之间记录的任何偏差或冲突
  - 清单结果
  - 后续步骤：对于复杂故事，建议用户仔细审查故事草稿，并可选择让产品负责人运行任务 `.bmad-core/tasks/validate-next-story`