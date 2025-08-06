template:
  id: prd-template-v2
  name: 产品需求文档
  version: 2.0
  output:
    format: markdown
    filename: docs/prd.md
    title: "{{project_name}} 产品需求文档 (PRD)"

workflow:
  mode: interactive
  elicitation: advanced-elicitation

sections:
  - id: goals-context
    title: 目标和背景上下文
    instruction: |
      询问项目简报文档是否可用。如果“没有”项目简报，强烈建议首先使用 project-brief-tmpl 创建一个（它提供了基本基础：问题陈述、目标用户、成功指标、MVP 范围、约束）。如果用户坚持在没有简报的情况下使用 PRD，请在“目标”部分收集此信息。如果存在项目简报，请审查并使用它来填充“目标”（一行期望结果的要点列表）和“背景上下文”（1-2 段简短的段落，说明它解决了什么以及为什么解决）这样我们就可以确定 PRD MVP 的范围。无论哪种方式，这对于确定需求都至关重要。包括更改日志表。
    sections:
      - id: goals
        title: 目标
        type: bullet-list
        instruction: PRD 成功后将实现的一行期望结果的要点列表 - 用户和项目期望
      - id: background
        title: 背景上下文
        type: paragraphs
        instruction: 1-2 个简短段落总结背景上下文，例如我们在简报中学到的内容，而不会与目标重复，它解决什么问题以及为什么解决问题，当前的形势或需求是什么
      - id: changelog
        title: 更改日志
        type: table
        columns: [日期, 版本, 描述, 作者]
        instruction: 跟踪文档版本和更改

  - id: requirements
    title: 要求
    instruction: 在两个子部分下起草功能性和非功能性要求列表
    elicit: true
    sections:
      - id: functional
        title: 功能性
        type: numbered-list
        prefix: FR
        instruction: 每个要求都将是带标识符（以 FR 开头）的要点 Markdown
        examples:
          - "FR6: 待办事项列表使用 AI 检测并警告潜在的重复待办事项，这些待办事项的措辞不同。"
      - id: non-functional
        title: 非功能性
        type: numbered-list
        prefix: NFR
        instruction: 每个要求都将是带标识符（以 NFR 开头）的要点 Markdown。
        examples:
          - "NFR1: AWS 服务使用应尽可能保持在免费套餐限制内。"

  - id: ui-goals
    title: 用户界面设计目标
    condition: PRD 有 UX/UI 要求
    instruction: |
      捕捉高层 UI/UX 愿景，以指导设计架构师并为故事创建提供信息。步骤：
      
      1. 根据项目上下文用有根据的猜测预填充所有子部分
      2. 向用户呈现完整的渲染部分
      3. 明确告知用户假设所在
      4. 针对不清楚/缺失的元素或需要更详细规范的区域提出有针对性的问题
      5. 这不是详细的 UI 规范 - 侧重于产品愿景和用户目标
    elicit: true
    choices:
      accessibility: [无, WCAG AA, WCAG AAA]
      platforms: [Web 响应式, 仅移动设备, 仅桌面, 跨平台]
    sections:
      - id: ux-vision
        title: 整体 UX 愿景
      - id: interaction-paradigms
        title: 关键交互范例
      - id: core-screens
        title: 核心屏幕和视图
        instruction: 从产品角度来看，交付 PRD 价值和目标所需的最关键屏幕或视图是什么？这旨在概念性高层驱动粗略的史诗或用户故事
        examples:
          - "登录屏幕"
          - "主仪表板"
          - "项目详情页"
          - "设置页面"
      - id: accessibility
        title: "可访问性：{无|WCAG AA|WCAG AAA|自定义要求}"
      - id: branding
        title: 品牌
        instruction: 必须包含的任何已知品牌元素或样式指南？
        examples:
          - "复制 20 世纪初黑白电影的外观和感觉，包括在页面或状态转换期间复制胶片损坏或投影仪故障的动画效果。"
          - "附件是我们公司品牌的完整调色板和令牌。"
      - id: target-platforms
        title: "目标设备和平台：{Web 响应式|仅移动设备|仅桌面|跨平台}"
        examples:
          - "Web 响应式，以及所有移动平台"
          - "仅 iPhone"
          - "ASCII Windows 桌面"

  - id: technical-assumptions
    title: 技术假设
    instruction: |
      收集将指导架构师的技术决策。步骤：
      
      1. 检查 .bmad-core/data/technical-preferences.yaml 或附加的技术偏好文件是否存在 - 使用它预填充选择
      2. 询问用户关于：语言、框架、入门模板、库、API、部署目标
      3. 对于未知项，根据项目目标和 MVP 范围提供指导
      4. 记录所有技术选择及理由（为什么此选择适合项目）
      5. 这些成为架构师的约束 - 要具体和完整
    elicit: true
    choices:
      repository: [Monorepo, Polyrepo]
      architecture: [单体, 微服务, 无服务器]
      testing: [仅单元测试, 单元测试 + 集成测试, 全面测试金字塔]
    sections:
      - id: repository-structure
        title: "存储库结构：{Monorepo|Polyrepo|多存储库}"
      - id: service-architecture
        title: 服务架构
        instruction: "关键决策 - 记录高层服务架构（例如，Monorepo 内的单体、微服务、无服务器功能）。"
      - id: testing-requirements
        title: 测试要求
        instruction: "关键决策 - 记录测试要求（仅单元测试、集成测试、端到端测试、手动测试、是否需要手动测试便捷方法）。"
      - id: additional-assumptions
        title: 额外技术假设和请求
        instruction: 在起草此文档的整个过程中，如果提出或发现任何其他适合架构师的技术假设，请在此处将其添加为额外的项目符号。

  - id: epic-list
    title: Epic 列表
    instruction: |
      呈现所有 Epic 的高层列表供用户批准。每个 Epic 都应有一个标题和一个简短（1 句话）的目标陈述。这允许用户在深入了解细节之前审查整体结构。
      
      关键：Epic 必须遵循敏捷最佳实践，按逻辑顺序排列：
      
      - 每个 Epic 都应交付一个重要的、端到端的、完全可部署的可测试功能增量
      - Epic 1 必须建立基础项目基础设施（应用程序设置、Git、CI/CD、核心服务），除非我们正在向现有应用程序添加新功能，同时还交付初始功能，即使像健康检查路由或简单金丝雀页面的显示一样简单 - 当我们为第一个 Epic 生成故事时请记住这一点！
      - 每个后续 Epic 都建立在先前 Epic 的功能之上，交付主要功能块，在部署时为用户或业务提供切实的价值
      - 并非每个项目都需要多个 Epic，一个 Epic 需要提供价值。例如，即使 UI 未完成且计划用于单独的 Epic，已完成的 API 也可以提供价值。
      - 倾向于使用更少的 Epic，但让用户知道您的理由并提供拆分它们的选项，如果它们看起来太大或侧重于不同的事物。
      - 跨领域关注点应贯穿 Epic 和故事，而不是最终故事。例如，将日志框架添加为 Epic 的最后一个故事，或在项目结束时添加为最终 Epic 或故事，这将是非常糟糕的，因为我们从一开始就不会有日志记录。
    elicit: true
    examples:
      - "Epic 1: 基础和核心基础设施：建立项目设置、身份验证和基本用户管理"
      - "Epic 2: 核心业务实体：使用 CRUD 操作创建和管理主要领域对象"
      - "Epic 3: 用户工作流和交互：启用关键用户旅程和业务流程"
      - "Epic 4: 报告和分析：为用户提供洞察和数据可视化"

  - id: epic-details
    title: Epic {{epic_number}} {{epic_title}}
    repeatable: true
    instruction: |
      在 Epic 列表获得批准后，将每个 Epic 的所有故事和验收标准作为一个完整的审查单元呈现。
      
      对于每个 Epic，提供扩展目标（2-3 句话，描述所有故事将实现的目标和价值）。
      
      关键故事排序要求：
      
      - 每个 Epic 中的故事必须按逻辑顺序排列
      - 除了项目基础的早期启用故事外，每个故事都应该是一个“垂直切片”，提供完整功能
      - 任何故事都不应依赖于后续故事或 Epic 的工作
      - 识别并注明任何直接的先决故事
      - 侧重于“什么”和“为什么”，而不是“如何”（将技术实现留给架构师），但要足够精确以支持故事到故事的逻辑顺序操作。
      - 确保每个故事都提供清晰的用户或业务价值，尽量避免启用者并将其构建到提供价值的故事中。
      - 根据 AI 代理执行调整故事大小：每个故事都必须由单个 AI 代理在一次集中会话中完成，而不会出现上下文溢出
      - 思考“初级开发人员工作 2-4 小时” - 故事必须小、专注且自包含
      - 如果一个故事看起来很复杂，请进一步分解它，只要它能提供垂直切片

    elicit: true
    template: "{{epic_goal}}"
    sections:
      - id: story
        title: 故事 {{epic_number}}.{{story_number}} {{story_title}}
        repeatable: true
        template: |
          作为 {{user_type}}，
          我希望 {{action}}，
          以便 {{benefit}}。
        sections:
          - id: acceptance-criteria
            title: 验收标准
            type: numbered-list
            item_template: "{{criterion_number}}: {{criteria}}"
            repeatable: true
            instruction: |
              定义清晰、全面且可测试的验收标准，这些标准：
              
              - 从功能角度精确定义“完成”的含义
              - 明确且可作为验证的基础
              - 包括 PRD 中的任何关键非功能性要求
              - 考虑后端/数据组件的本地可测试性
              - 在适用情况下指定 UI/UX 要求和框架合规性
              - 避免应在其他故事或 PRD 部分中处理的交叉关注点

  - id: checklist-results
    title: 清单结果报告
    instruction: 在运行清单和起草提示之前，建议输出完整的更新 PRD。如果输出，请与用户确认您将继续运行清单并生成报告。一旦用户确认，执行 pm-checklist 并在此部分填充结果。

  - id: next-steps
    title: 后续步骤
    sections:
      - id: ux-expert-prompt
        title: UX 专家提示
        instruction: 本节将包含 UX 专家的提示，使其简短明了，以启动使用此文档作为输入的创建架构模式。
      - id: architect-prompt
        title: 架构师提示
        instruction: 本节将包含架构师的提示，使其简短明了，以启动使用此文档作为输入的创建架构模式。