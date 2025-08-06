template:
  id: frontend-spec-template-v2
  name: UI/UX 规范
  version: 2.0
  output:
    format: markdown
    filename: docs/front-end-spec.md
    title: "{{project_name}} UI/UX 规范"

workflow:
  mode: interactive
  elicitation: advanced-elicitation

sections:
  - id: introduction
    title: 引言
    instruction: |
      审查提供的文档，包括项目简报、PRD 和任何用户研究，以收集上下文。在开始规范之前，重点了解用户需求、痛点和期望结果。
      
      建立文档的目的和范围。保持以下内容，但确保项目名称正确替换。
    content: |
      本文档定义了 {{project_name}} 用户界面的用户体验目标、信息架构、用户流程和视觉设计规范。它作为视觉设计和前端开发的基础，确保提供内聚且以用户为中心的体验。
    sections:
      - id: ux-goals-principles
        title: 整体 UX 目标和原则
        instruction: |
          与用户协作以建立和记录以下内容。如果尚未定义，请促进讨论以确定：
          
          1. 目标用户画像 - 启发细节或确认 PRD 中现有的画像
          2. 关键可用性目标 - 了解用户成功的样子
          3. 核心设计原则 - 建立 3-5 个指导原则
        elicit: true
        sections:
          - id: user-personas
            title: 目标用户画像
            template: "{{persona_descriptions}}"
            examples:
              - "**高级用户**：需要高级功能和效率的技术专业人员"
              - "**普通用户**：偶尔使用的用户，优先考虑易用性和清晰的指导"
              - "**管理员**：需要控制和监督功能的系统管理员"
          - id: usability-goals
            title: 可用性目标
            template: "{{usability_goals}}"
            examples:
              - "易学性：新用户可以在 5 分钟内完成核心任务"
              - "使用效率：高级用户可以通过最少的点击完成频繁任务"
              - "错误预防：对破坏性操作进行清晰的验证和确认"
              - "记忆性：不经常使用的用户可以返回而无需重新学习"
          - id: design-principles
            title: 设计原则
            template: "{{design_principles}}"
            type: numbered-list
            examples:
              - "**清晰优先于巧妙** - 优先考虑清晰的沟通而不是美学创新"
              - "**渐进式披露** - 仅在需要时显示需要的内容"
              - "**一致的模式** - 在整个应用程序中使用熟悉的 UI 模式"
              - "**即时反馈** - 每个操作都应有清晰、即时的响应"
              - "**默认可访问** - 从一开始就为所有用户进行设计"
      - id: changelog
        title: 更改日志
        type: table
        columns: [日期, 版本, 描述, 作者]
        instruction: 跟踪文档版本和更改

  - id: information-architecture
    title: 信息架构 (IA)
    instruction: |
      与用户协作创建全面的信息架构：
      
      1. 构建显示所有主要区域的站点地图或屏幕清单
      2. 定义导航结构（主、辅助、面包屑）
      3. 使用 Mermaid 图表进行可视化表示
      4. 考虑用户心理模型和预期分组
    elicit: true
    sections:
      - id: sitemap
        title: 站点地图 / 屏幕清单
        type: mermaid
        mermaid_type: graph
        template: "{{sitemap_diagram}}"
        examples:
          - |
            graph TD
                A[主页] --> B[仪表板]
                A --> C[产品]
                A --> D[帐户]
                B --> B1[分析]
                B --> B2[最近活动]
                C --> C1[浏览]
                C --> C2[搜索]
                C --> C3[产品详情]
                D --> D1[个人资料]
                D --> D2[设置]
                D --> D3[账单]
      - id: navigation-structure
        title: 导航结构
        template: |
          **主导航：** {{primary_nav_description}}
          
          **辅助导航：** {{secondary_nav_description}}
          
          **面包屑策略：** {{breadcrumb_strategy}}

  - id: user-flows
    title: 用户流程
    instruction: |
      对于 PRD 中识别的每个关键用户任务：
      
      1. 清晰定义用户目标
      2. 映射所有步骤，包括决策点
      3. 考虑边缘情况和错误状态
      4. 使用 Mermaid 流程图以提高清晰度
      5. 如果存在详细流程，链接到外部工具（Figma/Miro）
      
      为每个主要流程创建子部分。
    elicit: true
    repeatable: true
    sections:
      - id: flow
        title: "{{flow_name}}"
        template: |
          **用户目标：** {{flow_goal}}
          
          **入口点：** {{entry_points}}
          
          **成功标准：** {{success_criteria}}
        sections:
          - id: flow-diagram
            title: 流程图
            type: mermaid
            mermaid_type: graph
            template: "{{flow_diagram}}"
          - id: edge-cases
            title: "边缘情况和错误处理："
            type: bullet-list
            template: "- {{edge_case}}"
          - id: notes
            template: "**备注：** {{flow_notes}}"

  - id: wireframes-mockups
    title: 线框图和模型
    instruction: |
      明确详细的视觉设计将在何处创建（Figma、Sketch 等）以及如何引用它们。如果需要低保真线框图，请提供帮助构思关键屏幕的布局。
    elicit: true
    sections:
      - id: design-files
        template: "**主要设计文件：** {{design_tool_link}}"
      - id: key-screen-layouts
        title: 关键屏幕布局
        repeatable: true
        sections:
          - id: screen
            title: "{{screen_name}}"
            template: |
              **目的：** {{screen_purpose}}
              
              **关键元素：**
              - {{element_1}}
              - {{element_2}}
              - {{element_3}}
              
              **交互说明：** {{interaction_notes}}
              
              **设计文件参考：** {{specific_frame_link}}

  - id: component-library
    title: 组件库 / 设计系统
    instruction: |
      讨论是使用现有设计系统还是创建新设计系统。如果创建新的，请识别基础组件及其关键状态。请注意，详细技术规范属于前端架构。
    elicit: true
    sections:
      - id: design-system-approach
        template: "**设计系统方法：** {{design_system_approach}}"
      - id: core-components
        title: 核心组件
        repeatable: true
        sections:
          - id: component
            title: "{{component_name}}"
            template: |
              **目的：** {{component_purpose}}
              
              **变体：** {{component_variants}}
              
              **状态：** {{component_states}}
              
              **使用指南：** {{usage_guidelines}}

  - id: branding-style
    title: 品牌和样式指南
    instruction: 链接到现有样式指南或定义关键品牌元素。确保与公司品牌指南（如果存在）保持一致。
    elicit: true
    sections:
      - id: visual-identity
        title: 视觉识别
        template: "**品牌指南：** {{brand_guidelines_link}}"
      - id: color-palette
        title: 调色板
        type: table
        columns: ["颜色类型", "十六进制代码", "用途"]
        rows:
          - ["主色", "{{primary_color}}", "{{primary_usage}}"]
          - ["辅色", "{{secondary_color}}", "{{secondary_usage}}"]
          - ["强调色", "{{accent_color}}", "{{accent_usage}}"]
          - ["成功色", "{{success_color}}", "积极反馈，确认"]
          - ["警告色", "{{warning_color}}", "警告，重要通知"]
          - ["错误色", "{{error_color}}", "错误，破坏性操作"]
          - ["中性色", "{{neutral_colors}}", "文本，边框，背景"]
      - id: typography
        title: 排版
        sections:
          - id: font-families
            title: 字体家族
            template: |
              - **主字体：** {{primary_font}}
              - **辅字体：** {{secondary_font}}
              - **等宽字体：** {{mono_font}}
          - id: type-scale
            title: 类型比例
            type: table
            columns: ["元素", "大小", "粗细", "行高"]
            rows:
              - ["H1", "{{h1_size}}", "{{h1_weight}}", "{{h1_line}}"]
              - ["H2", "{{h2_size}}", "{{h2_weight}}", "{{h2_line}}"]
              - ["H3", "{{h3_size}}", "{{h3_weight}}", "{{h3_line}}"]
              - ["正文", "{{body_size}}", "{{body_weight}}", "{{body_line}}"]
              - ["小", "{{small_size}}", "{{small_weight}}", "{{small_line}}"]
      - id: iconography
        title: 图标系统
        template: |
          **图标库：** {{icon_library}}
          
          **使用指南：** {{icon_guidelines}}
      - id: spacing-layout
        title: 间距和布局
        template: |
          **网格系统：** {{grid_system}}
          
          **间距比例：** {{spacing_scale}}

  - id: accessibility
    title: 可访问性要求
    instruction: 根据目标合规级别和用户需求定义特定的可访问性要求。要全面但实用。
    elicit: true
    sections:
      - id: compliance-target
        title: 合规目标
        template: "**标准：** {{compliance_standard}}"
      - id: key-requirements
        title: 关键要求
        template: |
          **视觉：**
          - 颜色对比度：{{contrast_requirements}}
          - 焦点指示器：{{focus_requirements}}
          - 文本大小：{{text_requirements}}
          
          **交互：**
          - 键盘导航：{{keyboard_requirements}}
          - 屏幕阅读器支持：{{screen_reader_requirements}}
          - 触摸目标：{{touch_requirements}}
          
          **内容：**
          - 替代文本：{{alt_text_requirements}}
          - 标题结构：{{heading_requirements}}
          - 表单标签：{{form_requirements}}
      - id: testing-strategy
        title: 测试策略
        template: "{{accessibility_testing}}"

  - id: responsiveness
    title: 响应策略
    instruction: 定义不同设备尺寸的断点和适配策略。考虑技术限制和用户上下文。
    elicit: true
    sections:
      - id: breakpoints
        title: 断点
        type: table
        columns: ["断点", "最小宽度", "最大宽度", "目标设备"]
        rows:
          - ["移动", "{{mobile_min}}", "{{mobile_max}}", "{{mobile_devices}}"]
          - ["平板", "{{tablet_min}}", "{{tablet_max}}", "{{tablet_devices}}"]
          - ["桌面", "{{desktop_min}}", "{{desktop_max}}", "{{desktop_devices}}"]
          - ["宽屏", "{{wide_min}}", "-", "{{wide_devices}}"]
      - id: adaptation-patterns
        title: 适配模式
        template: |
          **布局更改：** {{layout_adaptations}}
          
          **导航更改：** {{nav_adaptations}}
          
          **内容优先级：** {{content_adaptations}}
          
          **交互更改：** {{interaction_adaptations}}

  - id: animation
    title: 动画和微交互
    instruction: 定义运动设计原则和关键交互。牢记性能和可访问性。
    elicit: true
    sections:
      - id: motion-principles
        title: 运动原则
        template: "{{motion_principles}}"
      - id: key-animations
        title: 关键动画
        repeatable: true
        template: "- **{{animation_name}}：** {{animation_description}} (持续时间：{{duration}}，缓动：{{easing}})"

  - id: performance
    title: 性能考虑
    instruction: 定义影响 UX 设计决策的性能目标和策略。
    sections:
      - id: performance-goals
        title: 性能目标
        template: |
          - **页面加载：** {{load_time_goal}}
          - **交互响应：** {{interaction_goal}}
          - **动画 FPS：** {{animation_goal}}
      - id: design-strategies
        title: 设计策略
        template: "{{performance_strategies}}"

  - id: next-steps
    title: 后续步骤
    instruction: |
      完成 UI/UX 规范后：
      
      1. 建议与利益相关者审查
      2. 建议在设计工具中创建/更新视觉设计
      3. 准备移交给设计架构师进行前端架构设计
      4. 注意任何悬而未决的问题或需要做出的决定
    sections:
      - id: immediate-actions
        title: 即时行动
        type: numbered-list
        template: "{{action}}"
      - id: design-handoff-checklist
        title: 设计交接清单
        type: checklist
        items:
          - "所有用户流程已文档化"
          - "组件清单完成"
          - "可访问性要求已定义"
          - "响应策略清晰"
          - "品牌指南已整合"
          - "性能目标已建立"

  - id: checklist-results
    title: 清单结果
    instruction: 如果存在 UI/UX 清单，请根据本文档运行它并在此处报告结果。