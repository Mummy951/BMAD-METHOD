template:
  id: architecture-template-v2
  name: 架构文档
  version: 2.0
  output:
    format: markdown
    filename: docs/architecture.md
    title: "{{project_name}} 架构文档"

workflow:
  mode: interactive
  elicitation: advanced-elicitation

sections:
  - id: introduction
    title: 引言
    instruction: |
      如果可用，请在开始前查看所有提供的相关文档以收集所有相关上下文。如果至少找不到 docs/prd.md，请询问用户哪些文档将作为架构的基础。
    sections:
      - id: intro-content
        content: |
          本文档概述了 {{project_name}} 的整体项目架构，包括后端系统、共享服务和非 UI 相关问题。其主要目标是作为 AI 驱动开发的主导架构蓝图，确保一致性并遵守所选择的模式和技术。
          
          **与前端架构的关系：**
          如果项目包含重要的用户界面，单独的前端架构文档将详细说明前端特定的设计，并且必须与本文档结合使用。本文档中记录的核心技术栈选择（参见“技术栈”）对整个项目（包括任何前端组件）都是确定的。
      - id: starter-template
        title: 入门模板或现有项目
        instruction: |
          在进一步进行架构设计之前，请检查项目是否基于入门模板或现有代码库：
          
          1. 审查 PRD 和头脑风暴简报，查找任何提及以下内容的信息：
          - 入门模板（例如，Create React App、Next.js、Vue CLI、Angular CLI 等）
          - 用作基础的现有项目或代码库
          - 样板项目或脚手架工具
          - 要克隆或改编的以前的项目
          
          2. 如果提及了入门模板或现有项目：
          - 要求用户通过以下方法之一提供访问权限：
            - 入门模板文档的链接
            - 上传/附加项目文件（适用于小型项目）
            - 共享项目存储库的链接（GitHub、GitLab 等）
          - 分析入门/现有项目以了解：
            - 预配置的技术栈和版本
            - 项目结构和组织模式
            - 内置脚本和工具
            - 现有架构模式和约定
            - 入门模板施加的任何限制或约束
            - 使用此分析来指导和调整您的架构决策
            
          3. 如果未提及入门模板但这是一个全新项目：
          - 根据技术栈偏好建议合适的入门模板
          - 解释其好处（更快的设置、最佳实践、社区支持）
          - 让用户决定是否使用
          
          4. 如果用户确认不使用入门模板：
          - 从头开始进行架构设计
          - 注意所有工具和配置都需要手动设置
          
          在继续进行架构设计之前，在此处记录该决定。如果没有，只需说“不适用”。
        elicit: true
      - id: changelog
        title: 更改日志
        type: table
        columns: [日期, 版本, 描述, 作者]
        instruction: 跟踪文档版本和更改

  - id: high-level-architecture
    title: 高层架构
    instruction: |
      本节包含多个小节，它们构成了架构的基础。一次性展示所有小节。
    elicit: true
    sections:
      - id: technical-summary
        title: 技术摘要
        instruction: |
          提供一个简短的段落（3-5 句话）概述：
          - 系统的整体架构风格
          - 关键组件及其关系
          - 主要技术选择
          - 正在使用的核心架构模式
          - 参考 PRD 目标以及此架构如何支持它们
      - id: high-level-overview
        title: 高层概述
        instruction: |
          根据 PRD 的技术假设部分，描述：
          
          1. 主要架构风格（例如，单体、微服务、无服务器、事件驱动）
          2. PRD 中的存储库结构决策（Monorepo/Polyrepo）
          3. PRD 中的服务架构决策
          4. 概念层面的主要用户交互流或数据流
          5. 关键架构决策及其原理
      - id: project-diagram
        title: 高层项目图
        type: mermaid
        mermaid_type: graph
        instruction: |
          创建 Mermaid 图表以可视化高层架构。考虑：
          - 系统边界
          - 主要组件/服务
          - 数据流方向
          - 外部集成
          - 用户入口点
          
      - id: architectural-patterns
        title: 架构和设计模式
        instruction: |
          列出将指导架构的关键高层模式。对于每种模式：
          
          1. 如果存在多种选项，请提供 2-3 种可行选项
          2. 提供明确的推荐和理由
          3. 在最终确定前征求用户确认
          4. 这些模式应与 PRD 的技术假设和项目目标保持一致
          
          要考虑的常见模式：
          - 架构风格模式（无服务器、事件驱动、微服务、CQRS、六边形）
          - 代码组织模式（依赖注入、仓库、模块、工厂）
          - 数据模式（事件溯源、Saga、每个服务一个数据库）
          - 通信模式（REST、GraphQL、消息队列、发布/订阅）
        template: "- **{{pattern_name}}：** {{pattern_description}} - _理由：_ {{rationale}}"
        examples:
          - "**无服务器架构：** 使用 AWS Lambda 进行计算 - _理由：_ 符合 PRD 对成本优化和自动伸缩的要求"
          - "**仓库模式：** 抽象数据访问逻辑 - _理由：_ 支持测试和未来数据库迁移的灵活性"
          - "**事件驱动通信：** 使用 SNS/SQS 进行服务解耦 - _理由：_ 支持异步处理和系统弹性"

  - id: tech-stack
    title: 技术栈
    instruction: |
      这是明确的技术选择部分。与用户协作以做出具体选择：
      
      1. 查看 PRD 技术假设以及 .bmad-core/data/technical-preferences.yaml 或附加技术偏好中的任何偏好
      2. 对于每个类别，提供 2-3 种可行选项，并附有优缺点
      3. 根据项目需求提出明确建议
      4. 获得用户的明确批准
      5. 记录确切的版本（避免“最新” - 固定特定版本）
      6. 此表是单一的事实来源 - 所有其他文档都必须引用这些选择
      
      要最终确定的关键决策 - 在显示表格之前，请确保您了解或询问用户 - 如果他们不确定任何内容，您可以提供建议和理由：
      
      - 入门模板（如果有）
      - 具有确切版本的语言和运行时
      - 框架和库/包
      - 云提供商和关键服务选择
      - 数据库和存储解决方案 - 如果不清楚，根据项目和云提供商的类型建议 SQL 或 NoSQL 或其他类型
      - 开发工具
      
      渲染表格后，确保用户了解此部分选择的重要性，还应查找与任何内容之间的差距或分歧，询问是否有任何不清楚为何列出的地方，并立即征求反馈 - 此声明和选项应在允许用户输入之前立即渲染并提示。
    elicit: true
    sections:
      - id: cloud-infrastructure
        title: 云基础设施
        template: |
          - **提供商：** {{cloud_provider}}
          - **关键服务：** {{core_services_list}}
          - **部署区域：** {{regions}}
      - id: technology-stack-table
        title: 技术栈表
        type: table
        columns: [类别, 技术, 版本, 用途, 理由]
        instruction: 使用所有相关技术填充技术栈表
        examples:
          - "| **语言** | TypeScript | 5.3.3 | 主要开发语言 | 强类型、出色的工具、团队专业知识 |"
          - "| **运行时** | Node.js | 20.11.0 | JavaScript 运行时 | LTS 版本、稳定性能、广泛生态系统 |"
          - "| **框架** | NestJS | 10.3.2 | 后端框架 | 企业就绪、良好依赖注入、符合团队模式 |"

  - id: data-models
    title: 数据模型
    instruction: |
      定义核心数据模型/实体：
      
      1. 审查 PRD 要求并确定关键业务实体
      2. 对于每个模型，解释其用途和关系
      3. 包括关键属性和数据类型
      4. 显示模型之间的关系
      5. 与用户讨论设计决策
      
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
          
          **关系：**
          - {{relationship_1}}
          - {{relationship_2}}

  - id: components
    title: 组件
    instruction: |
      根据上述架构模式、技术栈和数据模型：
      
      1. 识别主要逻辑组件/服务及其职责
      2. 考虑 PRD 中的存储库结构（monorepo/polyrepo）
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
      3. 包括错误处理路径
      4. 记录异步操作
      5. 根据需要创建高层和详细图
      
      关注澄清架构决策或复杂交互的工作流。
    elicit: true

  - id: rest-api-spec
    title: REST API 规范
    condition: 项目包含 REST API
    type: code
    language: yaml
    instruction: |
      如果项目包含 REST API：
      
      1. 创建 OpenAPI 3.0 规范
      2. 包含史诗/故事中的所有端点
      3. 根据数据模型定义请求/响应模式
      4. 记录身份验证要求
      5. 包含示例请求/响应
      
      使用 YAML 格式以提高可读性。如果无 REST API，跳过此节。
    elicit: true
    template: |
      openapi: 3.0.0
      info:
        title: {{api_title}}
        version: {{api_version}}
        description: {{api_description}}
      servers:
        - url: {{server_url}}
          description: {{server_description}}

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

  - id: source-tree
    title: 源代码树
    type: code
    language: plaintext
    instruction: |
      创建反映以下内容的项目文件夹结构：
      
      1. 所选的存储库结构（monorepo/polyrepo）
      2. 服务架构（monolith/microservices/serverless）
      3. 所选的技术栈和语言
      4. 上述组件组织
      5. 所选框架的最佳实践
      6. 清晰的职责分离
      
      根据项目需求调整结构。对于 monorepo，显示服务分离。对于无服务器，显示功能组织。包括特定于语言的约定。
    elicit: true
    examples:
      - |
        project-root/
        ├── packages/
        │   ├── api/                    # 后端 API 服务
        │   ├── web/                    # 前端应用程序
        │   ├── shared/                 # 共享工具/类型
        │   └── infrastructure/         # IaC 定义
        ├── scripts/                    # Monorepo 管理脚本
        └── package.json                # 带有工作区的根 package.json

  - id: infrastructure-deployment
    title: 基础设施和部署
    instruction: |
      定义部署架构和实践：
      
      1. 使用技术栈中选择的 IaC 工具
      2. 选择适合架构的部署策略
      3. 定义环境和推广流程
      4. 建立回滚程序
      5. 考虑安全性、监控和成本优化
      
      获取用户对部署偏好和 CI/CD 工具选择的输入。
    elicit: true
    sections:
      - id: infrastructure-as-code
        title: 基础设施即代码
        template: |
          - **工具：** {{iac_tool}} {{version}}
          - **位置：** `{{iac_directory}}`
          - **方法：** {{iac_approach}}
      - id: deployment-strategy
        title: 部署策略
        template: |
          - **策略：** {{deployment_strategy}}
          - **CI/CD 平台：** {{cicd_platform}}
          - **管道配置：** `{{pipeline_config_location}}`
      - id: environments
        title: 环境
        repeatable: true
        template: "- **{{env_name}}：** {{env_purpose}} - {{env_details}}"
      - id: promotion-flow
        title: 环境推广流程
        type: code
        language: text
        template: "{{promotion_flow_diagram}}"
      - id: rollback-strategy
        title: 回滚策略
        template: |
          - **主要方法：** {{rollback_method}}
          - **触发条件：** {{rollback_triggers}}
          - **恢复时间目标：** {{rto}}

  - id: error-handling-strategy
    title: 错误处理策略
    instruction: |
      定义全面的错误处理方法：
      
      1. 从技术栈中为语言/框架选择适当的模式
      2. 定义日志记录标准和工具
      3. 建立错误类别和处理规则
      4. 考虑可观察性和调试需求
      5. 确保安全性（日志中不包含敏感数据）
      
      本节指导 AI 和人类开发人员进行一致的错误处理。
    elicit: true
    sections:
      - id: general-approach
        title: 一般方法
        template: |
          - **错误模型：** {{error_model}}
          - **异常层次结构：** {{exception_structure}}
          - **错误传播：** {{propagation_rules}}
      - id: logging-standards
        title: 日志记录标准
        template: |
          - **库：** {{logging_library}} {{version}}
          - **格式：** {{log_format}}
          - **级别：** {{log_levels_definition}}
          - **所需上下文：**
            - 关联 ID：{{correlation_id_format}}
            - 服务上下文：{{service_context}}
            - 用户上下文：{{user_context_rules}}
      - id: error-patterns
        title: 错误处理模式
        sections:
          - id: external-api-errors
            title: 外部 API 错误
            template: |
              - **重试策略：** {{retry_strategy}}
              - **熔断器：** {{circuit_breaker_config}}
              - **超时配置：** {{timeout_settings}}
              - **错误转换：** {{error_mapping_rules}}
          - id: business-logic-errors
            title: 业务逻辑错误
            template: |
              - **自定义异常：** {{business_exception_types}}
              - **面向用户的错误：** {{user_error_format}}
              - **错误代码：** {{error_code_system}}
          - id: data-consistency
            title: 数据一致性
            template: |
              - **事务策略：** {{transaction_approach}}
              - **补偿逻辑：** {{compensation_patterns}}
              - **幂等性：** {{idempotency_approach}}

  - id: coding-standards
    title: 编码标准
    instruction: |
      这些标准对 AI 代理是强制性的。与用户协作，仅定义防止出现糟糕代码所需的关键规则。解释：
      
      1. 本节直接控制 AI 开发人员行为
      2. 保持最小化 - 假设 AI 了解一般最佳实践
      3. 关注项目特定的约定和陷阱
      4. 过度详细的标准会增加上下文并减慢开发速度
      5. 标准将提取到单独的文件中供开发代理使用
      
      对于每个标准，获得用户的明确确认是必要的。
    elicit: true
    sections:
      - id: core-standards
        title: 核心标准
        template: |
          - **语言和运行时：** {{languages_and_versions}}
          - **风格和 Linter：** {{linter_config}}
          - **测试组织：** {{test_file_convention}}
      - id: naming-conventions
        title: 命名约定
        type: table
        columns: [元素, 约定, 示例]
        instruction: 仅在偏离语言默认值时包含
      - id: critical-rules
        title: 关键规则
        instruction: |
          仅列出 AI 可能违反或项目特定要求的规则。示例：
          - “永远不要在生产代码中使用 console.log - 使用 logger”
          - “所有 API 响应都必须使用 ApiResponse 包装器类型”
          - “数据库查询必须使用仓库模式，永远不要直接使用 ORM”
          
          避免“使用 SOLID 原则”或“编写干净代码”等明显规则
        repeatable: true
        template: "- **{{rule_name}}：** {{rule_description}}"
      - id: language-specifics
        title: 语言特定指南
        condition: 需要关键的语言特定规则
        instruction: 仅在对防止 AI 错误至关重要时添加。大多数团队不需要本节。
        sections:
          - id: language-rules
            title: "{{language_name}} 特性"
            repeatable: true
            template: "- **{{rule_topic}}：** {{rule_detail}}"

  - id: test-strategy
    title: 测试策略和标准
    instruction: |
      与用户协作定义全面的测试策略：
      
      1. 使用技术栈中的测试框架
      2. 决定采用 TDD 还是测试后方法
      3. 定义测试组织和命名
      4. 建立覆盖率目标
      5. 确定集成测试基础设施
      6. 规划测试数据和外部依赖
      
      注意：基本信息在开发代理的编码标准中。此详细部分供 QA 代理和团队参考。
    elicit: true
    sections:
      - id: testing-philosophy
        title: 测试理念
        template: |
          - **方法：** {{test_approach}}
          - **覆盖率目标：** {{coverage_targets}}
          - **测试金字塔：** {{test_distribution}}
      - id: test-types
        title: 测试类型和组织
        sections:
          - id: unit-tests
            title: 单元测试
            template: |
              - **框架：** {{unit_test_framework}} {{version}}
              - **文件约定：** {{unit_test_naming}}
              - **位置：** {{unit_test_location}}
              - **模拟库：** {{mocking_library}}
              - **覆盖率要求：：** {{unit_coverage}}
              
              **AI 代理要求：**
              - 为所有公共方法生成测试
              - 覆盖边缘情况和错误条件
              - 遵循 AAA 模式（安排、执行、断言）
              - 模拟所有外部依赖
          - id: integration-tests
            title: 集成测试
            template: |
              - **范围：** {{integration_scope}}
              - **位置：** {{integration_test_location}}
              - **测试基础设施：**
                - **{{dependency_name}}：** {{test_approach}} ({{test_tool}})
            examples:
              - "**数据库：** 内存 H2 用于单元测试，Testcontainers PostgreSQL 用于集成"
              - "**消息队列：** 嵌入式 Kafka 用于测试"
              - "**外部 API：** WireMock 用于存根"
          - id: e2e-tests
            title: 端到端测试
            template: |
              - **框架：** {{e2e_framework}} {{version}}
              - **范围：** {{e2e_scope}}
              - **环境：** {{e2e_environment}}
              - **测试数据：** {{e2e_data_strategy}}
      - id: test-data-management
        title: 测试数据管理
        template: |
          - **策略：** {{test_data_approach}}
          - **夹具：** {{fixture_location}}
          - **工厂：** {{factory_pattern}}
          - **清理：** {{cleanup_strategy}}
      - id: continuous-testing
        title: 持续测试
        template: |
          - **CI 集成：** {{ci_test_stages}}
          - **性能测试：** {{perf_test_approach}}
          - **安全测试：** {{security_test_approach}}

  - id: security
    title: 安全
    instruction: |
      定义 AI 和人类开发人员的强制性安全要求：
      
      1. 关注特定于实现的规则
      2. 引用技术栈中的安全工具
      3. 定义常见场景的清晰模式
      4. 这些规则直接影响代码生成
      5. 与用户协作以确保完整性而不重复
    elicit: true
    sections:
      - id: input-validation
        title: 输入验证
        template: |
          - **验证库：** {{validation_library}}
          - **验证位置：** {{where_to_validate}}
          - **所需规则：**
            - 所有外部输入必须经过验证
            - 在处理前在 API 边界进行验证
            - 首选白名单方法而非黑名单
      - id: auth-authorization
        title: 身份验证和授权
        template: |
          - **身份验证方法：** {{auth_implementation}}
          - **会话管理：** {{session_approach}}
          - **所需模式：**
            - {{auth_pattern_1}}
            - {{auth_pattern_2}}
      - id: secrets-management
        title: 秘密管理
        template: |
          - **开发：** {{dev_secrets_approach}}
          - **生产：** {{prod_secrets_service}}
          - **代码要求：**
            - 永远不要硬编码秘密
            - 仅通过配置服务访问
            - 日志或错误消息中不包含秘密
      - id: api-security
        title: API 安全
        template: |
          - **速率限制：** {{rate_limit_implementation}}
          - **CORS 策略：** {{cors_configuration}}
          - **安全头：** {{required_headers}}
          - **HTTPS 强制：** {{https_approach}}
      - id: data-protection
        title: 数据保护
        template: |
          - **静态加密：** {{encryption_at_rest}}
          - **传输中加密：** {{encryption_in_transit}}
          - **PII 处理：** {{pii_rules}}
          - **日志限制：：** {{what_not_to_log}}
      - id: dependency-security
        title: 依赖安全
        template: |
          - **扫描工具：** {{dependency_scanner}}
          - **更新策略：** {{update_frequency}}
          - **批准流程：** {{new_dep_process}}
      - id: security-testing
        title: 安全测试
        template: |
          - **SAST 工具：** {{static_analysis}}
          - **DAST 工具：** {{dynamic_analysis}}
          - **渗透测试：** {{pentest_schedule}}

  - id: checklist-results
    title: 清单结果报告
    instruction: 在运行清单之前，请提供输出完整的架构文档。一旦用户确认，执行 architect-checklist 并在此处填充结果。

  - id: next-steps
    title: 后续步骤
    instruction: |
      完成架构后：
      
      1. 如果项目有 UI 组件：
      - 使用“前端架构模式”
      - 提供此文档作为输入
      
      2. 对于所有项目：
      - 与产品负责人审查
      - 开始使用开发代理实施故事
      - 使用 DevOps 代理设置基础设施
      
      3. 如果需要，为下一个代理提供特定提示
    sections:
      - id: architect-prompt
        title: 架构师提示
        condition: 项目有 UI 组件
        instruction: |
          创建一个简短的提示，将其交给架构师进行前端架构创建。包括：
          - 参考此架构文档
          - PRD 中的关键 UI 要求
          - 此处做出的任何前端特定决策
          - 请求详细的前端架构