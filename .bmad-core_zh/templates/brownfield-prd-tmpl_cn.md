template:
  id: brownfield-prd-template-v2
  name: 老项目增强 PRD
  version: 2.0
  output:
    format: markdown
    filename: docs/prd.md
    title: "{{project_name}} 老项目增强 PRD"

workflow:
  mode: interactive
  elicitation: advanced-elicitation

sections:
  - id: intro-analysis
    title: 项目分析和上下文介绍
    instruction: |
      重要 - 需要范围评估：
      
      此 PRD 适用于对现有项目进行需要全面规划和多个故事的“重大”增强。在继续之前：
      
      1. **评估增强复杂性**：如果这是一个可以在 1-2 个重点开发会话中完成的简单功能添加或错误修复，请“停止”并建议：“对于更简单的更改，请考虑改用产品所有者使用 brownfield-create-epic 或 brownfield-create-story 任务。此完整的 PRD 流程是为需要架构规划和多个协调故事的实质性增强而设计的。”
      
      2. **项目上下文**：确定我们是在已加载项目的 IDE 中工作，还是用户需要提供项目信息。如果项目文件可用，请分析 docs 文件夹中的现有文档。如果现有文档不足，请建议首先运行 document-project 任务。
      
      3. **深入评估要求**：在提出任何建议之前，您“必须”彻底分析现有项目结构、模式和约束。每个建议都必须基于实际项目分析，而不是假设。
      
      收集有关现有项目的全面信息。本节必须在继续要求之前完成。
      
      关键：在整个分析过程中，明确与用户确认您的理解。对于您对现有项目做出的每个假设，请询问：“根据我的分析，我理解 [假设]。这是否正确？”
      
      在用户验证您对现有系统的理解之前，请勿进行任何建议。
    sections:
      - id: existing-project-overview
        title: 现有项目概述
        instruction: 检查是否已执行 document-project 分析。如果已执行，则引用该输出，而不是重新分析。
        sections:
          - id: analysis-source
            title: 分析来源
            instruction: |
              指示以下之一：
              - document-project 输出可在以下位置获得：{{path}}
              - 基于 IDE 的全新分析
              - 用户提供的信息
          - id: current-state
            title: 当前项目状态
            instruction: |
              - 如果存在 document-project 输出：从“高层架构”和“技术摘要”部分提取摘要
              - 否则：简要描述项目当前的功能及其主要用途
      - id: documentation-analysis
        title: 可用文档分析
        instruction: |
          如果运行了 document-project：
          - 注意：“document-project 分析可用 - 使用现有技术文档”
          - 列出 document-project 创建的关键文档
          - 跳过下面的缺失文档检查
          
          否则，检查现有文档：
        sections:
          - id: available-docs
            title: 可用文档
            type: checklist
            items:
              - 技术栈文档 [[LLM: 如果来自 document-project，请检查 ✓]]
              - 源代码树/架构 [[LLM: 如果来自 document-project，请检查 ✓]]
              - 编码标准 [[LLM: 如果来自 document-project，可能部分]]
              - API 文档 [[LLM: 如果来自 document-project，请检查 ✓]]
              - 外部 API 文档 [[LLM: 如果来自 document-project，请检查 ✓]]
              - UX/UI 指南 [[LLM: 可能不在 document-project 中]]
              - 技术债务文档 [[LLM: 如果来自 document-project，请检查 ✓]]
              - "其他：{{other_docs}}"
            instruction: |
              - 如果已运行 document-project：“使用来自 document-project 输出的现有项目分析。”
              - 如果缺少关键文档且没有 document-project：“我建议首先运行 document-project 任务...”
      - id: enhancement-scope
        title: 增强范围定义
        instruction: 与用户协作以明确定义此增强的类型。这对于范围界定和方法至关重要。
        sections:
          - id: enhancement-type
            title: 增强类型
            type: checklist
            instruction: 与用户确定适用项
            items:
              - 新功能添加
              - 主要功能修改
              - 与新系统集成
              - 性能/可伸缩性改进
              - UI/UX 大修
              - 技术栈升级
              - 错误修复和稳定性改进
              - "其他：{{other_type}}"
          - id: enhancement-description
            title: 增强描述
            instruction: 2-3 句话描述用户想要添加或更改的内容
          - id: impact-assessment
            title: 影响评估
            type: checklist
            instruction: 评估对现有代码库的影响范围
            items:
              - 最小影响（独立添加）
              - 中等影响（一些现有代码更改）
              - 重大影响（实质性现有代码更改）
              - 主要影响（需要架构更改）
      - id: goals-context
        title: 目标和背景上下文
        sections:
          - id: goals
            title: 目标
            type: bullet-list
            instruction: 如果成功，此增强将实现的一行期望结果的要点列表
          - id: background
            title: 背景上下文
            type: paragraphs
            instruction: 1-2 个简短段落总结背景上下文，例如我们在简报中学到的内容，而不会与目标重复，它解决什么问题以及为什么解决问题，当前的形势或需求是什么
      - id: changelog
        title: 更改日志
        type: table
        columns: [更改, 日期, 版本, 描述, 作者]

  - id: requirements
    title: 要求
    instruction: |
      根据您对现有项目的验证理解起草功能性和非功能性要求。在提出要求之前，请确认：“这些要求是基于我对您现有系统的理解。请仔细审查并确认它们与您项目的实际情况一致。”
    elicit: true
    sections:
      - id: functional
        title: 功能性
        type: numbered-list
        prefix: FR
        instruction: 每个要求都将是带标识符（以 FR 开头）的要点 Markdown
        examples:
          - "FR1: 现有待办事项列表将与新的 AI 重复检测服务集成，而不会破坏现有功能。"
      - id: non-functional
        title: 非功能性
        type: numbered-list
        prefix: NFR
        instruction: 每个要求都将是带标识符（以 NFR 开头）的要点 Markdown。包括现有系统的约束
        examples:
          - "NFR1: 增强功能必须保持现有性能特性，并且内存使用量不得超过现有内存使用量的 20%。"
      - id: compatibility
        title: 兼容性要求
        instruction: 对老项目至关重要 - 什么必须保持兼容
        type: numbered-list
        prefix: CR
        template: "{{requirement}}：{{description}}"
        items:
          - id: cr1
            template: "CR1: {{existing_api_compatibility}}"
          - id: cr2
            template: "CR2: {{database_schema_compatibility}}"
          - id: cr3
            template: "CR3: {{ui_ux_consistency}}"
          - id: cr4
            template: "CR4: {{integration_compatibility}}"

  - id: ui-enhancement-goals
    title: 用户界面增强目标
    condition: 增强包括 UI 更改
    instruction: 对于 UI 更改，捕获它们将如何与现有 UI 模式和设计系统集成
    sections:
      - id: existing-ui-integration
        title: 与现有 UI 集成
        instruction: 描述新 UI 元素将如何与现有设计模式、样式指南和组件库结合
      - id: modified-screens
        title: 修改/新增屏幕和视图
        instruction: 仅列出将要修改或添加的屏幕/视图
      - id: ui-consistency
        title: UI 一致性要求
        instruction: 保持与现有应用程序的视觉和交互一致性的具体要求

  - id: technical-constraints
    title: 技术约束和集成要求
    instruction: 本节取代单独的架构文档。从现有项目分析中收集详细的技术约束。
    sections:
      - id: existing-tech-stack
        title: 现有技术栈
        instruction: |
          如果 document-project 输出可用：
          - 从高层架构部分的“实际技术栈”表中提取
          - 包括版本号和任何已注意到的约束
          
          否则，记录当前技术栈：
        template: |
          **语言**：{{languages}}
          **框架**：{{frameworks}}
          **数据库**：{{database}}
          **基础设施**：{{infrastructure}}
          **外部依赖**：{{external_dependencies}}
      - id: integration-approach
        title: 集成方法
        instruction: 定义增强功能将如何与现有架构集成
        template: |
          **数据库集成策略**：{{database_integration}}
          **API 集成策略**：{{api_integration}}
          **前端集成策略**：{{frontend_integration}}
          **测试集成策略**：{{testing_integration}}
      - id: code-organization
        title: 代码组织和标准
        instruction: 基于现有项目分析，定义新代码将如何适应现有模式
        template: |
          **文件结构方法**：{{file_structure}}
          **命名约定**：{{naming_conventions}}
          **编码标准**：{{coding_standards}}
          **文档标准**：{{documentation_standards}}
      - id: deployment-operations
        title: 部署和操作
        instruction: 增强功能如何适应现有部署管道
        template: |
          **构建过程集成**：{{build_integration}}
          **部署策略**：{{deployment_strategy}}
          **监控和日志**：{{monitoring_logging}}
          **配置管理**：{{config_management}}
      - id: risk-assessment
        title: 风险评估和缓解
        instruction: |
          如果 document-project 输出可用：
          - 参考“技术债务和已知问题”部分
          - 包括可能影响增强功能的“变通方法和陷阱”
          - 注意“关键技术债务”中识别的任何约束
          
          构建包含现有已知问题的风险评估：
        template: |
          **技术风险**：{{technical_risks}}
          **集成风险**：{{integration_risks}}
          **部署风险**：{{deployment_risks}}
          **缓解策略**：{{mitigation_strategies}}

  - id: epic-structure
    title: Epic 和故事结构
    instruction: |
      对于老项目，除非用户明确要求多个不相关的增强功能，否则偏向于单个全面的 Epic。在呈现 Epic 结构之前，请确认：“根据我对您现有项目的分析，我认为此增强功能应构建为 [单个 Epic/多个 Epic]，因为 [基于实际项目分析的理由]。这是否与您对所需工作的理解一致？”
    elicit: true
    sections:
      - id: epic-approach
        title: Epic 方法
        instruction: 解释 Epic 结构的原理 - 通常老项目使用单个 Epic，除非有多个不相关的功能
        template: "**Epic 结构决策**：{{epic_decision}} 及理由"

  - id: epic-details
    title: "Epic 1: {{enhancement_title}}"
    instruction: |
      全面 Epic，提供老项目增强功能，同时保持现有功能
      
      老项目关键故事排序：
      - 故事必须确保现有功能保持不变
      - 每个故事都应包含现有功能仍然有效的验证
      - 故事应按顺序排列，以最大程度地降低对现有系统的风险
      - 每个故事都应包括回滚考虑
      - 专注于增量集成，而不是一次性大改
      - 根据现有代码库上下文中的 AI 代理执行调整故事大小
      - 强制：呈现完整的故事序列并询问：“此故事序列旨在最大程度地降低您现有系统的风险。此顺序根据您项目的架构和约束是否合理？”
      - 故事必须具有逻辑顺序，并明确标识依赖关系
      - 每个故事都必须提供价值，同时保持系统完整性
    template: |
      **Epic 目标**：{{epic_goal}}
      
      **集成要求**：{{integration_requirements}}
    sections:
      - id: story
        title: "故事 1.{{story_number}} {{story_title}}"
        repeatable: true
        template: |
          作为 {{user_type}}，
          我希望 {{action}}，
          以便 {{benefit}}。
        sections:
          - id: acceptance-criteria
            title: 验收标准
            type: numbered-list
            instruction: 定义包含新功能和现有系统完整性的标准
            item_template: "{{criterion_number}}: {{criteria}}"
          - id: integration-verification
            title: 集成验证
            instruction: 确保现有功能保持不变的特定验证步骤
            type: numbered-list
            prefix: IV
            items:
              - template: "IV1: {{existing_functionality_verification}}"
              - template: "IV2: {{integration_point_verification}}"
              - template: "IV3: {{performance_impact_verification}}"