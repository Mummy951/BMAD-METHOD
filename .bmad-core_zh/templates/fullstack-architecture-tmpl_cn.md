template:
  id: fullstack-architecture-template-v2
  name: 全栈架构文档
  version: 2.0
  output:
    format: markdown
    filename: docs/architecture.md
    title: "{{project_name}} 全栈架构文档"

workflow:
  mode: interactive
  elicitation: advanced-elicitation

sections:
  - id: introduction
    title: 引言
    instruction: |
      如果可用，请在开始前查看所有提供的相关文档以收集所有相关上下文。至少，您应该可以访问 docs/prd.md 和 docs/front-end-spec.md。如果无法找到或未提供您需要的任何文档，请向用户索取。此模板创建一个统一的架构，涵盖后端和前端问题，以指导 AI 驱动的全栈开发。
    elicit: true
    content: |
      本文档概述了 {{project_name}} 的完整全栈架构，包括后端系统、前端实现及其集成。它作为 AI 驱动开发的单一事实来源，确保整个技术栈的一致性。
      
      这种统一的方法结合了传统上独立的后端和前端架构文档，简化了这些问题日益交织的现代全栈应用程序的开发过程。
    sections:
      - id: starter-template
        title: 入门模板或现有项目
        instruction: |
          在进行架构设计之前，请检查项目是否基于任何入门模板或现有代码库：
          
          1. 审查 PRD 和其他文档中是否提及：
          - 全栈入门模板（例如，T3 Stack、MEAN/MERN 入门、Django + React 模板）
          - Monorepo 模板（例如，Nx、Turborepo 入门）
          - 平台特定入门（例如，Vercel 模板、AWS Amplify 入门）
          - 正在扩展或克隆的现有项目
          
          2. 如果提及了入门模板或现有项目：
          - 要求用户提供访问权限（链接、存储库或文件）
          - 分析以了解预配置的选择和约束
          - 注意任何已做出的架构决策
          - 确定可以修改什么以及必须保留什么
          
          3. 如果没有提及入门，但这是一个全新项目：
          - 根据技术偏好建议合适的全栈入门
          - 考虑平台特定选项（Vercel、AWS 等）
          - 让用户决定是否使用
          
          4. 记录决策和它施加的任何约束
          
          如果没有，请说明“不适用 - 全新项目”
      - id: changelog
        title: 更改日志
        type: table
        columns: [日期, 版本, 描述, 作者]
        instruction: 跟踪文档版本和更改

  - id: high-level-architecture
    title: 高层架构
    instruction: 本节包含多个小节，它们构成了基础。一次性呈现所有小节，然后就完整的部分征求反馈。
    elicit: true
    sections:
      - id: technical-summary
        title: 技术摘要
        instruction: |
          提供全面的概述（4-6 句话），涵盖：
          - 整体架构风格和部署方法
          - 前端框架和后端技术选择
          - 前端和后端之间的关键集成点
          - 基础设施平台和服务
          - 此架构如何实现 PRD 目标
      - id: platform-infrastructure
        title: 平台和基础设施选择
        instruction: |
          根据 PRD 要求和技术假设，提出平台建议：
          
          1. 考虑常见模式（并非详尽列表，请根据您自己的最佳判断并根据需要搜索网络以了解新兴趋势）：
          - **Vercel + Supabase**：适用于 Next.js 的快速开发，内置身份验证/存储
          - **AWS 全栈**：适用于企业级规模，使用 Lambda、API Gateway、S3、Cognito
          - **Azure**：适用于 .NET 生态系统或企业 Microsoft 环境
          - **Google Cloud**：适用于 ML/AI 重型应用程序或 Google 生态系统集成
          
          2. 呈现 2-3 个可行选项，并附有明确的优缺点
          3. 提出建议并说明理由
          4. 获得用户的明确确认
          
          记录选择和将使用的关键服务。
        template: |
          **平台：** {{selected_platform}}
          **关键服务：** {{core_services_list}}
          **部署主机和区域：** {{regions}}
      - id: repository-structure
        title: 存储库结构
        instruction: |
          根据 PRD 要求和平台选择定义存储库方法，说明您的理由，或者如果不确定，请向用户提问：
          
          1. 对于现代全栈应用程序，通常首选 monorepo
          2. 考虑工具（Nx、Turborepo、Lerna、npm workspaces）
          3. 定义包/应用程序边界
          4. 规划前端和后端之间的共享代码
        template: |
          **结构：** {{repo_structure_choice}}
          **Monorepo 工具：** {{monorepo_tool_if_applicable}}
          **包组织：** {{package_strategy}}
      - id: architecture-diagram
        title: 高层架构图
        type: mermaid
        mermaid_type: graph
        instruction: |
          创建 Mermaid 图表显示完整的系统架构，包括：
          - 用户入口点（Web、移动）
          - 前端应用程序部署
          - API 层（REST/GraphQL）
          - 后端服务
          - 数据库和存储
          - 外部集成
          - CDN 和缓存层
          
          使用适当的图表类型以提高清晰度。
      - id: architectural-patterns
        title: 架构模式
        instruction: |
          列出将指导前端和后端开发的模式。包括以下模式：
          - 整体架构（例如，Jamstack、无服务器、微服务）
          - 前端模式（例如，基于组件的、状态管理）
          - 后端模式（例如，仓库、CQRS、事件驱动）
          - 集成模式（例如，BFF、API 网关）
          
          对于每种模式，提供建议和理由。
        repeatable: true
        template: "- **{{pattern_name}}：** {{pattern_description}} - _理由：_ {{rationale}}"
        examples:
          - "**Jamstack 架构：** 使用无服务器 API 的静态站点生成 - _理由：_ 内容密集型应用程序的最佳性能和可伸缩性"
          - "**基于组件的 UI：** 可重用 React 组件与 TypeScript - _理由：_ 大型代码库的可维护性和类型安全"
          - "**仓库模式：** 抽象数据访问逻辑 - _理由：_ 支持测试和未来数据库迁移的灵活性"
          - "**API 网关模式：** 所有 API 调用的单一入口点 - _理由：_ 集中式身份验证、速率限制和监控"

  - id: tech-stack
    title: 技术栈
    instruction: |
      这是整个项目的明确技术选择。与用户协作以最终确定所有选择。此表是单一事实来源 - 所有开发都必须使用这些确切的版本。
      
      涵盖的关键领域：
      - 前端和后端语言/框架
      - 数据库和缓存
      - 身份验证和授权
      - API 方法
      - 前端和后端测试工具
      - 构建和部署工具
      - 监控和日志记录
      
      渲染后，立即征求反馈。
    elicit: true
    sections:
      - id: tech-stack-table
        title: 技术栈表
        type: table
        columns: [类别, 技术, 版本, 用途, 理由]
        rows:
          - ["前端语言", "{{fe_language}}", "{{version}}", "{{purpose}}", "{{why_chosen}}"]
          - ["前端框架", "{{fe_framework}}", "{{version}}", "{{purpose}}", "{{why_chosen}}"]
          - ["UI 组件库", "{{ui_library}}", "{{version}}", "{{purpose}}", "{{why_chosen}}"]
          - ["状态管理", "{{state_mgmt}}", "{{version}}", "{{purpose}}", "{{why_chosen}}"]
          - ["后端语言", "{{be_language}}", "{{version}}", "{{purpose}}", "{{why_chosen}}"]
          - ["后端框架", "{{be_framework}}", "{{version}}", "{{purpose}}", "{{why_chosen}}"]
          - ["API 风格", "{{api_style}}", "{{version}}", "{{purpose}}", "{{why_chosen}}"]
          - ["数据库", "{{database}}", "{{version}}", "{{purpose}}", "{{why_chosen}}"]
          - ["缓存", "{{cache}}", "{{version}}", "{{purpose}}", "{{why_chosen}}"]
          - ["文件存储", "{{storage}}", "{{version}}", "{{purpose}}", "{{why_chosen}}"]
          - ["身份验证", "{{auth}}", "{{version}}", "{{purpose}}", "{{why_chosen}}"]
          - ["前端测试", "{{fe_test}}", "{{version}}", "{{purpose}}", "{{why_chosen}}"]
          - ["后端测试", "{{be_test}}", "{{version}}", "{{purpose}}", "{{why_chosen}}"]
          - ["端到端测试", "{{e2e_test}}", "{{version}}", "{{purpose}}", "{{why_chosen}}"]
          - ["构建工具", "{{build_tool}}", "{{version}}", "{{purpose}}", "{{why_chosen}}"]
          - ["打包工具", "{{bundler}}", "{{version}}", "{{purpose}}", "{{why_chosen}}"]
          - ["IaC 工具", "{{iac_tool}}", "{{version}}", "{{purpose}}", "{{why_chosen}}"]
          - ["CI/CD", "{{cicd}}", "{{version}}", "{{purpose}}", "{{why_chosen}}"]
          - ["监控", "{{monitoring}}", "{{version}}", "{{purpose}}", "{{why_chosen}}"]
          - ["日志记录", "{{logging}}", "{{version}}", "{{purpose}}", "{{why_chosen}}"]
          - ["CSS 框架", "{{css_framework}}", "{{version}}", "{{purpose}}", "{{why_chosen}}"]

  - id: data-models
    title: 数据模型
    instruction: |
      定义将在前端和后端之间共享的核心数据模型/实体：
      
      1. 审查 PRD 要求并确定关键业务实体
      2. 对于每个模型，解释其用途和关系
      3. 包括关键属性和数据类型
      4. 显示模型之间的关系
      5. 创建可共享的 TypeScript 接口
      6. 与用户讨论设计决策
      
      在转到数据库模式之前创建清晰的概念模型。
    elicit: true
    repeatable: true
    sections:
      - id: model
        title: "{{model_name}}"
        template: |
          **用途：** {{model_purpose}}
          
          **关键属性：**
          - {{attribute_1}}：{{type_1}} - {{description_1}}
          - {{attribute_2}}：{{type_2}} - {{description_2}}
        sections:
          - id: typescript-interface
            title: TypeScript 接口
            type: code
            language: typescript
            template: "{{model_interface}}"
          - id: relationships
            title: 关系
            type: bullet-list
            template: "- {{relationship}}"

  - id: api-spec
    title: API 规范
    instruction: |
      根据技术栈中选择的 API 风格：
      
      1. 如果是 REST API，创建 OpenAPI 3.0 规范
      2. 如果是 GraphQL，提供 GraphQL 模式
      3. 如果是 tRPC，显示路由器定义
      4. 包含史诗/故事中的所有端点
      5. 根据数据模型定义请求/响应模式
      6. 记录身份验证要求
      7. 包含示例请求/响应
      
      使用适合所选 API 风格的格式。如果没有 API（例如，静态站点），请跳过本节。
    elicit: true
    sections:
      - id: rest-api
        title: REST API 规范
        condition: API 风格是 REST
        type: code
        language: yaml
        template: |
          openapi: 3.0.0
          info:
            title: {{api_title}}
            version: {{api_version}}
            description: {{api_description}}
          servers:
            - url: {{server_url}}
              description: {{server_description}}
      - id: graphql-api
        title: GraphQL 模式
        condition: API 风格是 GraphQL
        type: code
        language: graphql
        template: "{{graphql_schema}}"
      - id: trpc-api
        title: tRPC 路由器定义
        condition: API 风格是 tRPC
        type: code
        language: typescript
        template: "{{trpc_routers}}"

  - id: components
    title: 组件
    instruction: |
      根据上述架构模式、技术栈和数据模型：
      
      1. 识别全栈中的主要逻辑组件/服务及其职责
      2. 考虑前端和后端组件
      3. 定义组件之间清晰的边界和接口
      4. 对于每个组件，指定：
      - 主要职责
      - 公开的关键接口/API
      - 对其他组件的依赖
      - 基于技术栈选择的技术细节
      
      5. 在有帮助的情况下创建组件图
    elicit: true
    sections:
      - id: component-list
        repeatable: true
        title: "{{component_name}}"
        template: |
          **职责：** {{component_description}}
          
          **关键接口：**
          - {{interface_1}}
          - {{interface_2}}
          
          **依赖：** {{dependencies}}
          
          **技术栈：** {{component_tech_details}}
      - id: component-diagrams
        title: 组件图
        type: mermaid
        instruction: |
          创建 Mermaid 图表以可视化组件关系。选项：
          - C4 容器图（高层视图）
          - 组件图（详细内部结构）
          - 序列图（复杂交互）
          选择最合适的以提高清晰度

  - id: external-apis
    title: 外部 API
    condition: 项目需要外部 API 集成
    instruction: |
      对于每个外部服务集成：
      
      1. 根据 PRD 要求和组件设计确定所需的 API
      2. 如果文档 URL 未知，请询问用户具体信息
      3. 记录身份验证方法和安全注意事项
      4. 列出将使用的特定端点
      5. 注意任何速率限制或使用限制
      
      如果不需要外部 API，请明确说明并跳到下一节。
    elicit: true
    repeatable: true
    sections:
      - id: api
        title: "{{api_name}} API"
        template: |
          - **用途：** {{api_purpose}}
          - **文档：** {{api_docs_url}}
          - **基本 URL(s)：** {{api_base_url}}
          - **身份验证：** {{auth_method}}
          - **速率限制：** {{rate_limits}}
          
          **使用的关键端点：**
          - `{{method}} {{endpoint_path}}` - {{endpoint_purpose}}
          
          **集成说明：** {{integration_considerations}}

  - id: core-workflows
    title: 核心工作流
    type: mermaid
    mermaid_type: sequence
    instruction: |
      使用序列图说明关键系统工作流：
      
      1. 确定 PRD 中的关键用户旅程
      2. 显示组件交互，包括外部 API
      3. 包括前端和后端流程
      4. 包括错误处理路径
      5. 记录异步操作
      6. 根据需要创建高层和详细图
      
      关注澄清架构决策或复杂交互的工作流。
    elicit: true

  - id: database-schema
    title: 数据库模式
    instruction: |
      将概念数据模型转换为具体的数据库模式：
      
      1. 使用技术栈中选择的数据库类型
      2. 使用适当的表示法创建模式定义
      3. 包括索引、约束和关系
      4. 考虑性能和可伸缩性
      5. 对于 NoSQL，显示文档结构
      
      以适合数据库类型的格式（SQL DDL、JSON 模式等）呈现模式。
    elicit: true

  - id: frontend-architecture
    title: 前端架构
    instruction: 定义前端特定的架构细节。在每个子部分之后，注意用户是否希望在继续之前进行优化。
    elicit: true
    sections:
      - id: component-architecture
        title: 组件架构
        instruction: 定义基于所选框架的组件组织和模式。
        sections:
          - id: component-organization
            title: 组件组织
            type: code
            language: text
            template: "{{component_structure}}"
          - id: component-template
            title: 组件模板
            type: code
            language: typescript
            template: "{{component_template}}"
      - id: state-management
        title: 状态管理架构
        instruction: 详细说明基于所选解决方案的状态管理方法。
        sections:
          - id: state-structure
            title: 状态结构
            type: code
            language: typescript
            template: "{{state_structure}}"
          - id: state-patterns
            title: 状态管理模式
            type: bullet-list
            template: "- {{pattern}}"
      - id: routing-architecture
        title: 路由架构
        instruction: 根据框架选择定义路由结构。
        sections:
          - id: route-organization
            title: 路由组织
            type: code
            language: text
            template: "{{route_structure}}"
          - id: protected-routes
            title: 受保护路由模式
            type: code
            language: typescript
            template: "{{protected_route_example}}"
      - id: frontend-services
        title: 前端服务层
        instruction: 定义前端如何与后端通信。
        sections:
          - id: api-client-setup
            title: API 客户端设置
            type: code
            language: typescript
            template: "{{api_client_setup}}"
          - id: service-example
            title: 服务示例
            type: code
            language: typescript
            template: "{{service_example}}"

  - id: backend-architecture
    title: 后端架构
    instruction: 定义后端特定的架构细节。考虑无服务器与传统服务器方法。
    elicit: true
    sections:
      - id: service-architecture
        title: 服务架构
        instruction: 根据平台选择定义服务组织。
        sections:
          - id: serverless-architecture
            condition: 选择无服务器架构
            sections:
              - id: function-organization
                title: 功能组织
                type: code
                language: text
                template: "{{function_structure}}"
              - id: function-template
                title: 功能模板
                type: code
                language: typescript
                template: "{{function_template}}"
          - id: traditional-server
            condition: 选择传统服务器架构
            sections:
              - id: controller-organization
                title: 控制器/路由组织
                type: code
                language: text
                template: "{{controller_structure}}"
              - id: controller-template
                title: 控制器模板
                type: code
                language: typescript
                template: "{{controller_template}}"
      - id: database-architecture
        title: 数据库架构
        instruction: 定义数据库模式和访问模式。
        sections:
          - id: schema-design
            title: 模式设计
            type: code
            language: sql
            template: "{{database_schema}}"
          - id: data-access-layer
            title: 数据访问层
            type: code
            language: typescript
            template: "{{repository_pattern}}"
      - id: auth-architecture
        title: 身份验证和授权
        instruction: 定义身份验证实现细节。
        sections:
          - id: auth-flow
            title: 身份验证流程
            type: mermaid
            mermaid_type: sequence
            template: "{{auth_flow_diagram}}"
          - id: auth-middleware
            title: 中间件/守卫
            type: code
            language: typescript
            template: "{{auth_middleware}}"

  - id: unified-project-structure
    title: 统一项目结构
    instruction: 创建一个同时包含前端和后端的 monorepo 结构。根据所选工具和框架进行调整。
    elicit: true
    type: code
    language: plaintext
    examples:
    - |
      {{project-name}}/
      ├── .github/                    # CI/CD workflows
      │   └── workflows/
      │       ├── ci.yaml
      │       └── deploy.yaml
      ├── apps/                       # Application packages
      │   ├── web/                    # Frontend application
      │   │   ├── src/
      │   │   │   ├── components/     # UI components
      │   │   │   ├── pages/          # Page components/routes
      │   │   │   ├── hooks/          # Custom React hooks
      │   │   │   ├── services/       # API client services
      │   │   │   ├── stores/         # State management
      │   │   │   ├── styles/         # Global styles/themes
      │   │   │   └── utils/          # Frontend utilities
      │   │   ├── public/             # Static assets
      │   │   ├── tests/              # Frontend tests
      │   │   └── package.json
      │   └── api/                    # Backend application
      │       ├── src/
      │       │   ├── routes/         # API routes/controllers
      │       │   ├── services/       # Business logic
      │       │   ├── models/         # Data models
      │       │   ├── middleware/     # Express/API middleware
      │       │   ├── utils/          # Backend utilities
      │       │   └── {{serverless_or_server_entry}}
      │       ├── tests/              # Backend tests
      │       └── package.json
      ├── packages/                   # Shared packages
      │   ├── shared/                 # Shared types/utilities
      │   │   ├── src/
      │   │   │   ├── types/          # TypeScript interfaces
      │   │   │   ├── constants/      # Shared constants
      │   │   │   └── utils/          # Shared utilities
      │   │   └── package.json
      │   ├── ui/                     # Shared UI components
      │   │   ├── src/
      │   │   └── package.json
      │   └── config/                 # Shared configuration
      │       ├── eslint/
      │       ├── typescript/
      │       └── jest/
      ├── infrastructure/             # IaC definitions
      │   └── {{iac_structure}}
      ├── scripts/                    # Build/deploy scripts
      ├── docs/                       # Documentation
      │   ├── prd.md
      │   ├── front-end-spec.md
      │   └── fullstack-architecture.md
      ├── .env.example                # Environment template
      ├── package.json                # Root package.json
      ├── {{monorepo_config}}         # Monorepo configuration
      └── README.md
 
  - id: development-workflow
    title: 开发工作流
    instruction: 定义全栈应用程序的开发设置和工作流。
    elicit: true
    sections:
      - id: local-setup
        title: 本地开发设置
        sections:
          - id: prerequisites
            title: 先决条件
            type: code
            language: bash
            template: "{{prerequisites_commands}}"
          - id: initial-setup
            title: 初始设置
            type: code
            language: bash
            template: "{{setup_commands}}"
          - id: dev-commands
            title: 开发命令
            type: code
            language: bash
            template: |
              # 启动所有服务
              {{start_all_command}}
              
              # 仅启动前端
              {{start_frontend_command}}
              
              # 仅启动后端
              {{start_backend_command}}
              
              # 运行测试
              {{test_commands}}
      - id: environment-config
        title: 环境配置
        sections:
          - id: env-vars
            title: 所需环境变量
            type: code
            language: bash
            template: |
              # 前端 (.env.local)
              {{frontend_env_vars}}
              
              # 后端 (.env)
              {{backend_env_vars}}
              
              # 共享
              {{shared_env_vars}}
 
  - id: deployment-architecture
    title: 部署架构
    instruction: 根据平台选择定义部署策略。
    elicit: true
    sections:
      - id: deployment-strategy
        title: 部署策略
        template: |
          **前端部署：**
          - **平台：** {{frontend_deploy_platform}}
          - **构建命令：** {{frontend_build_command}}
          - **输出目录：** {{frontend_output_dir}}
          - **CDN/边缘：** {{cdn_strategy}}
          
          **后端部署：**
          - **平台：** {{backend_deploy_platform}}
          - **构建命令：** {{backend_build_command}}
          - **部署方法：** {{deployment_method}}
      - id: cicd-pipeline
        title: CI/CD 管道
        type: code
        language: yaml
        template: "{{cicd_pipeline_config}}"
      - id: environments
        title: 环境
        type: table
        columns: [环境, 前端 URL, 后端 URL, 用途]
        rows:
          - ["开发", "{{dev_fe_url}}", "{{dev_be_url}}", "本地开发"]
          - ["暂存", "{{staging_fe_url}}", "{{staging_be_url}}", "预生产测试"]
          - ["生产", "{{prod_fe_url}}", "{{prod_be_url}}", "生产环境"]
 
  - id: security-performance
    title: 安全和性能
    instruction: 定义全栈应用程序的安全和性能考虑事项。
    elicit: true
    sections:
      - id: security-requirements
        title: 安全要求
        template: |
          **前端安全：**
          - CSP 头部：{{csp_policy}}
          - XSS 防御：{{xss_strategy}}
          - 安全存储：{{storage_strategy}}
          
          **后端安全：**
          - 输入验证：{{validation_approach}}
          - 速率限制：{{rate_limit_config}}
          - CORS 策略：{{cors_config}}
          
          **身份验证安全：**
          - 令牌存储：{{token_strategy}}
          - 会话管理：{{session_approach}}
          - 密码策略：{{password_requirements}}
      - id: performance-optimization
        title: 性能优化
        template: |
          **前端性能：**
          - 包大小目标：{{bundle_size}}
          - 加载策略：{{loading_approach}}
          - 缓存策略：{{fe_cache_strategy}}
          
          **后端性能：**
          - 响应时间目标：{{response_target}}
          - 数据库优化：{{db_optimization}}
          - 缓存策略：{{be_cache_strategy}}
 
  - id: testing-strategy
    title: 测试策略
    instruction: 定义全栈应用程序的综合测试方法。
    elicit: true
    sections:
      - id: testing-pyramid
        title: 测试金字塔
        type: code
        language: text
        template: |
                  E2E 测试
                 /        \
            集成测试
               /            \
          前端单元  后端单元
      - id: test-organization
        title: 测试组织
        sections:
          - id: frontend-tests
            title: 前端测试
            type: code
            language: text
            template: "{{frontend_test_structure}}"
          - id: backend-tests
            title: 后端测试
            type: code
            language: text
            template: "{{backend_test_structure}}"
          - id: e2e-tests
            title: 端到端测试
            type: code
            language: text
            template: "{{e2e_test_structure}}"
      - id: test-examples
        title: 测试示例
        sections:
          - id: frontend-test
            title: 前端组件测试
            type: code
            language: typescript
            template: "{{frontend_test_example}}"
          - id: backend-test
            title: 后端 API 测试
            type: code
            language: typescript
            template: "{{backend_test_example}}"
          - id: e2e-test
            title: 端到端测试
            type: code
            language: typescript
            template: "{{e2e_test_example}}"
 
  - id: coding-standards
    title: 编码标准
    instruction: 为 AI 代理定义最少但关键的标准。只关注防止常见错误的特定于项目的规则。这些将由开发代理使用。
    elicit: true
    sections:
      - id: critical-rules
        title: 关键全栈规则
        repeatable: true
        template: "- **{{rule_name}}：** {{rule_description}}"
        examples:
          - "**类型共享：** 始终在 packages/shared 中定义类型并从那里导入"
          - "**API 调用：** 永远不要直接进行 HTTP 调用 - 使用服务层"
          - "**环境变量：** 仅通过配置对象访问，永远不要直接处理 process.env"
          - "**错误处理：** 所有 API 路由必须使用标准错误处理程序"
          - "**状态更新：** 永远不要直接修改状态 - 使用适当的状态管理模式"
      - id: naming-conventions
        title: 命名约定
        type: table
        columns: [元素, 前端, 后端, 示例]
        rows:
          - ["组件", "PascalCase", "-", "`UserProfile.tsx`"]
          - ["Hooks", "camelCase with 'use'", "-", "`useAuth.ts`"]
          - ["API 路由", "-", "kebab-case", "`/api/user-profile`"]
          - ["数据库表", "-", "snake_case", "`user_profiles`"]
 
  - id: error-handling
    title: 错误处理策略
    instruction: 定义前端和后端统一的错误处理。
    elicit: true
    sections:
      - id: error-flow
        title: 错误流程
        type: mermaid
        mermaid_type: sequence
        template: "{{error_flow_diagram}}"
      - id: error-format
        title: 错误响应格式
        type: code
        language: typescript
        template: |
          interface ApiError {
            error: {
              code: string;
              message: string;
              details?: Record<string, any>;
              timestamp: string;
              requestId: string;
            };
          }
      - id: frontend-error-handling
        title: 前端错误处理
        type: code
        language: typescript
        template: "{{frontend_error_handler}}"
      - id: backend-error-handling
        title: 后端错误处理
        type: code
        language: typescript
        template: "{{backend_error_handler}}"
 
  - id: monitoring
    title: 监控和可观察性
    instruction: 定义全栈应用程序的监控策略。
    elicit: true
    sections:
      - id: monitoring-stack
        title: 监控栈
        template: |
          - **前端监控：** {{frontend_monitoring}}
          - **后端监控：** {{backend_monitoring}}
          - **错误追踪：** {{error_tracking}}
          - **性能监控：** {{perf_monitoring}}
      - id: key-metrics
        title: 关键指标
        template: |
          **前端指标：**
          - 核心 Web 指标
          - JavaScript 错误
          - API 响应时间
          - 用户交互
          
          **后端指标：**
          - 请求速率
          - 错误速率
          - 响应时间
          - 数据库查询性能
 
  - id: checklist-results
    title: 清单结果报告
    instruction: 在运行清单之前，请提供输出完整的架构文档。一旦用户确认，执行 architect-checklist 并在此处填充结果。