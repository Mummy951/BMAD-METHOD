template:
  id: frontend-architecture-template-v2
  name: 前端架构文档
  version: 2.0
  output:
    format: markdown
    filename: docs/ui-architecture.md
    title: "{{project_name}} 前端架构文档"

workflow:
  mode: interactive
  elicitation: advanced-elicitation

sections:
  - id: template-framework-selection
    title: 模板和框架选择
    instruction: |
      审查提供的文档，包括 PRD、UX-UI 规范和主架构文档。重点提取 AI 前端工具和开发人员代理所需的技术实施细节。如果无法找到或未提供这些文档，请向用户索取。
      
      在进行前端架构设计之前，请检查项目是否使用前端入门模板或现有代码库：
      
      1. 审查 PRD、主架构文档和头脑风暴简报，查找以下提及：
         - 前端入门模板（例如，Create React App、Next.js、Vite、Vue CLI、Angular CLI 等）
         - UI 工具包或组件库入门
         - 用作基础的现有前端项目
         - 管理仪表板模板或其他专业入门
         - 设计系统实施
      
      2. 如果提及了前端入门模板或现有项目：
         - 要求用户通过以下方法之一提供访问权限：
           - 入门模板文档的链接
           - 上传/附加项目文件（适用于小型项目）
           - 共享项目存储库的链接
         - 分析入门/现有项目以了解：
           - 预安装的依赖项和版本
           - 文件夹结构和文件组织
           - 内置组件和实用程序
           - 样式方法（CSS 模块、styled-components、Tailwind 等）
           - 状态管理设置（如果有）
           - 路由配置
           - 测试设置和模式
           - 构建和开发脚本
         - 使用此分析确保您的前端架构与入门模式对齐
      
      3. 如果没有提及前端入门，但这是一个新的 UI，请确保我们知道 UI 语言和框架是什么：
         - 根据框架选择，建议合适的入门：
           - React：Create React App、Next.js、Vite + React
           - Vue：Vue CLI、Nuxt.js、Vite + Vue
           - Angular：Angular CLI
           - 或建议流行的 UI 模板（如果适用）
         - 解释前端开发的具体好处
      
      4. 如果用户确认不使用入门模板：
         - 注意所有工具、捆绑和配置都需要手动设置
         - 从头开始进行前端架构设计
      
      在继续之前，记录入门模板决策和它施加的任何约束。
    sections:
      - id: changelog
        title: 更改日志
        type: table
        columns: [日期, 版本, 描述, 作者]
        instruction: 跟踪文档版本和更改

  - id: frontend-tech-stack
    title: 前端技术栈
    instruction: 从主架构的“技术栈表”中提取。本节必须与主架构文档保持同步。
    elicit: true
    sections:
      - id: tech-stack-table
        title: 技术栈表
        type: table
        columns: [类别, 技术, 版本, 用途, 理由]
        instruction: 根据所选框架和项目要求填写适当的技术选择。
        rows:
          - ["框架", "{{framework}}", "{{version}}", "{{purpose}}", "{{why_chosen}}"]
          - ["UI 库", "{{ui_library}}", "{{version}}", "{{purpose}}", "{{why_chosen}}"]
          - ["状态管理", "{{state_management}}", "{{version}}", "{{purpose}}", "{{why_chosen}}"]
          - ["路由", "{{routing_library}}", "{{version}}", "{{purpose}}", "{{why_chosen}}"]
          - ["构建工具", "{{build_tool}}", "{{version}}", "{{purpose}}", "{{why_chosen}}"]
          - ["样式", "{{styling_solution}}", "{{version}}", "{{purpose}}", "{{why_chosen}}"]
          - ["测试", "{{test_framework}}", "{{version}}", "{{purpose}}", "{{why_chosen}}"]
          - ["组件库", "{{component_lib}}", "{{version}}", "{{purpose}}", "{{why_chosen}}"]
          - ["表单处理", "{{form_library}}", "{{version}}", "{{purpose}}", "{{why_chosen}}"]
          - ["动画", "{{animation_lib}}", "{{version}}", "{{purpose}}", "{{why_chosen}}"]
          - ["开发工具", "{{dev_tools}}", "{{version}}", "{{purpose}}", "{{why_chosen}}"]

  - id: project-structure
    title: 项目结构
    instruction: 根据所选框架定义 AI 工具的确切目录结构。明确说明每种类型的文件放置在哪里。生成遵循框架最佳实践和约定的结构。
    elicit: true
    type: code
    language: plaintext

  - id: component-standards
    title: 组件标准
    instruction: 根据所选框架定义组件创建的确切模式。
    elicit: true
    sections:
      - id: component-template
        title: 组件模板
        instruction: 生成一个遵循框架最佳实践的最小但完整的组件模板。包括 TypeScript 类型、正确的导入和基本结构。
        type: code
        language: typescript
      - id: naming-conventions
        title: 命名约定
        instruction: 为组件、文件、服务、状态管理和其他架构元素提供特定于所选框架的命名约定。

  - id: state-management
    title: 状态管理
    instruction: 根据所选框架定义状态管理模式。
    elicit: true
    sections:
      - id: store-structure
        title: 存储结构
        instruction: 为所选框架和选定的状态管理解决方案生成适当的状态管理目录结构。
        type: code
        language: plaintext
      - id: state-template
        title: 状态管理模板
        instruction: 提供一个遵循框架推荐模式的基本状态管理模板/示例。包括 TypeScript 类型和设置、更新、清除状态等常见操作。
        type: code
        language: typescript

  - id: api-integration
    title: API 集成
    instruction: 根据所选框架定义 API 服务模式。
    elicit: true
    sections:
      - id: service-template
        title: 服务模板
        instruction: 提供一个遵循框架约定的 API 服务模板。包括正确的 TypeScript 类型、错误处理和异步模式。
        type: code
        language: typescript
      - id: api-client-config
        title: API 客户端配置
        instruction: 展示如何为所选框架配置 HTTP 客户端，包括身份验证拦截器/中间件和错误处理。
        type: code
        language: typescript

  - id: routing
    title: 路由
    instruction: 根据所选框架定义路由结构和模式。
    elicit: true
    sections:
      - id: route-configuration
        title: 路由配置
        instruction: 提供适合所选框架的路由配置。包括受保护的路由模式、适用的延迟加载和身份验证守卫/中间件。
        type: code
        language: typescript

  - id: styling-guidelines
    title: 样式指南
    instruction: 根据所选框架定义样式方法。
    elicit: true
    sections:
      - id: styling-approach
        title: 样式方法
        instruction: 描述适合所选框架的样式方法（CSS 模块、Styled Components、Tailwind 等）并提供基本模式。
      - id: global-theme
        title: 全局主题变量
        instruction: 提供一个适用于所有框架的 CSS 自定义属性（CSS 变量）主题系统。包括颜色、间距、排版、阴影和深色模式支持。
        type: code
        language: css

  - id: testing-requirements
    title: 测试要求
    instruction: 根据所选框架定义最少的测试要求。
    elicit: true
    sections:
      - id: component-test-template
        title: 组件测试模板
        instruction: 提供一个使用框架推荐测试库的基本组件测试模板。包括渲染测试、用户交互测试和模拟的示例。
        type: code
        language: typescript
      - id: testing-best-practices
        title: 测试最佳实践
        type: numbered-list
        items:
          - "**单元测试**：隔离测试单个组件"
          - "**集成测试**：测试组件交互"
          - "**端到端测试**：测试关键用户流（使用 Cypress/Playwright）"
          - "**覆盖率目标**：目标 80% 代码覆盖率"
          - "**测试结构**：安排-执行-断言模式"
          - "**模拟外部依赖**：API 调用、路由、状态管理"

  - id: environment-configuration
    title: 环境配置
    instruction: 列出基于所选框架所需的环变量。显示适当的格式和命名约定。
    elicit: true

  - id: frontend-developer-standards
    title: 前端开发人员标准
    sections:
      - id: critical-coding-rules
        title: 关键编码规则
        instruction: 列出防止常见 AI 错误的必要规则，包括通用规则和框架特定规则。
        elicit: true
      - id: quick-reference
        title: 快速参考
        instruction: |
          创建特定于框架的备忘单，包括：
          - 常用命令（开发服务器、构建、测试）
          - 关键导入模式
          - 文件命名约定
          - 项目特定模式和实用程序