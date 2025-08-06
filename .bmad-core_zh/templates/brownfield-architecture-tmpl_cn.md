template:
  id: brownfield-architecture-template-v2
  name: 老项目增强架构
  version: 2.0
  output:
    format: markdown
    filename: docs/architecture.md
    title: "{{project_name}} 老项目增强架构"

workflow:
  mode: interactive
  elicitation: advanced-elicitation

sections:
  - id: introduction
    title: 引言
    instruction: |
      重要 - 需要范围和评估：
      
      本架构文档适用于对现有项目进行需要全面架构规划的“重大”增强。在继续之前：
      
      1. **验证复杂性**：确认此增强需要架构规划。对于简单的添加，建议：“对于不需要架构规划的简单更改，请考虑改用产品所有者使用 brownfield-create-epic 或 brownfield-create-story 任务。”
      
      2. **所需输入**：
         - 已完成的 brownfield-prd.md
         - 现有项目技术文档（来自 docs 文件夹或用户提供）
         - 访问现有项目结构（IDE 或上传的文件）
      
      3. **深入分析授权**：在提出任何架构建议之前，您“必须”对现有代码库、架构模式和技术限制进行彻底分析。每个建议都必须基于实际项目分析，而不是假设。
      
      4. **持续验证**：在整个过程中，与用户明确验证您的理解。对于每个架构决策，确认：“根据我对您现有系统的分析，我建议 [决策]，因为 [来自实际项目的证据]。这与您系统的实际情况是否一致？”
      
      如果缺少任何所需输入，请在继续之前请求它们。
    elicit: true
    sections:
      - id: intro-content
        content: |
          本文档概述了使用 {{enhancement_description}} 增强 {{project_name}} 的架构方法。其主要目标是作为 AI 驱动开发新功能的指导架构蓝图，同时确保与现有系统的无缝集成。
          
          **与现有架构的关系：**
          本文档通过定义新组件将如何与当前系统集成来补充现有项目架构。当新旧模式之间出现冲突时，本文档提供有关在实施增强功能时保持一致性的指导。
      - id: existing-project-analysis
        title: 现有项目分析
        instruction: |
          分析现有项目结构和架构：
          
          1. 审查 docs 文件夹中的现有文档
          2. 检查当前技术栈和版本
          3. 识别现有架构模式和约定
          4. 注意当前部署和基础设施设置
          5. 记录任何限制或局限性
          
          关键：在分析之后，明确验证您的发现：“根据我对您项目的分析，我已识别出您现有系统的以下内容：[关键发现]。在我继续提出架构建议之前，请确认这些观察结果是准确的。”
        elicit: true
        sections:
          - id: current-state
            title: 当前项目状态
            template: |
              - **主要用途：** {{existing_project_purpose}}
              - **当前技术栈：** {{existing_tech_summary}}
              - **架构风格：** {{existing_architecture_style}}
              - **部署方法：** {{existing_deployment_approach}}
          - id: available-docs
            title: 可用文档
            type: bullet-list
            template: "- {{existing_docs_summary}}"
          - id: constraints
            title: 已识别的约束
            type: bullet-list
            template: "- {{constraint}}"
      - id: changelog
        title: 更改日志
        type: table
        columns: [更改, 日期, 版本, 描述, 作者]
        instruction: 跟踪文档版本和更改

  - id: enhancement-scope
    title: 增强范围和集成策略
    instruction: |
      定义增强功能将如何与现有系统集成：
      
      1. 审查老项目 PRD 增强范围
      2. 识别与现有代码的集成点
      3. 定义新旧功能之间的边界
      4. 建立兼容性要求
      
      验证检查点：在提出集成策略之前，确认：“根据我的分析，我提出的集成方法考虑了 [特定现有系统特征]。这些集成点和边界尊重您当前的架构模式。此评估是否准确？”
    elicit: true
    sections:
      - id: enhancement-overview
        title: 增强概述
        template: |
          **增强类型：** {{enhancement_type}}
          **范围：** {{enhancement_scope}}
          **集成影响：** {{integration_impact_level}}
      - id: integration-approach
        title: 集成方法
        template: |
          **代码集成策略：** {{code_integration_approach}}
          **数据库集成：** {{database_integration_approach}}
          **API 集成：** {{api_integration_approach}}
          **UI 集成：** {{ui_integration_approach}}
      - id: compatibility-requirements
        title: 兼容性要求
        template: |
          - **现有 API 兼容性：** {{api_compatibility}}
          - **数据库模式兼容性：** {{db_compatibility}}
          - **UI/UX 一致性：** {{ui_compatibility}}
          - **性能影响：** {{performance_constraints}}

  - id: tech-stack-alignment
    title: 技术栈对齐
    instruction: |
      确保新组件与现有技术选择对齐：
      
      1. 使用现有技术栈作为基础
      2. 仅在绝对必要时引入新技术
      3. 以明确的理由证明任何新增内容的合理性
      4. 确保与现有依赖项的版本兼容性
    elicit: true
    sections:
      - id: existing-stack
        title: 现有技术栈
        type: table
        columns: [类别, 当前技术, 版本, 增强中使用情况, 备注]
        instruction: 记录必须维护或集成的当前技术栈
      - id: new-tech-additions
        title: 新增技术
        condition: 增强需要新技术
        type: table
        columns: [技术, 版本, 用途, 理由, 集成方法]
        instruction: 仅在增强需要新技术时包含

  - id: data-models
    title: 数据模型和模式更改
    instruction: |
      定义新数据模型以及它们如何与现有模式集成：
      
      1. 识别增强所需的新实体
      2. 定义与现有数据模型的关系
      3. 规划数据库模式更改（添加、修改）
      4. 确保向后兼容性
    elicit: true
    sections:
      - id: new-models
        title: 新数据模型
        repeatable: true
        sections:
          - id: model
            title: "{{model_name}}"
            template: |
              **用途：** {{model_purpose}}
              **集成：** {{integration_with_existing}}
              
              **关键属性：**
              - {{attribute_1}}：{{type_1}} - {{description_1}}
              - {{attribute_2}}：{{type_2}} - {{description_2}}
              
              **关系：**
              - **与现有：** {{existing_relationships}}
              - **与新增：** {{new_relationships}}
      - id: schema-integration
        title: 模式集成策略
        template: |
          **所需数据库更改：**
          - **新表：** {{new_tables_list}}
          - **修改的表：** {{modified_tables_list}}
          - **新索引：** {{new_indexes_list}}
          - **迁移策略：** {{migration_approach}}
          
          **向后兼容性：**
          - {{compatibility_measure_1}}
          - {{compatibility_measure_2}}

  - id: component-architecture
    title: 组件架构
    instruction: |
      定义新组件及其与现有架构的集成：
      
      1. 识别增强所需的新组件
      2. 定义与现有组件的接口
      3. 建立清晰的边界和职责
      4. 规划集成点和数据流
      
      强制验证：在提出组件架构之前，确认：“我提出的新组件遵循我在代码库中识别的现有架构模式：[特定模式]。集成接口尊重您当前的组件结构和通信模式。这是否与您项目的实际情况相符？”
    elicit: true
    sections:
      - id: new-components
        title: 新组件
        repeatable: true
        sections:
          - id: component
            title: "{{component_name}}"
            template: |
              **职责：** {{component_description}}
              **集成点：** {{integration_points}}
              
              **关键接口：**
              - {{interface_1}}
              - {{interface_2}}
              
              **依赖：**
              - **现有组件：** {{existing_dependencies}}
              - **新组件：** {{new_dependencies}}
              
              **技术栈：** {{component_tech_details}}
      - id: interaction-diagram
        title: 组件交互图
        type: mermaid
        mermaid_type: graph
        instruction: 创建 Mermaid 图表显示新组件如何与现有组件交互

  - id: api-design
    title: API 设计和集成
    condition: 增强需要 API 更改
    instruction: |
      定义新 API 端点和与现有 API 的集成：
      
      1. 规划增强所需的新 API 端点
      2. 确保与现有 API 模式的一致性
      3. 定义身份验证和授权集成
      4. 如果需要，规划版本控制策略
    elicit: true
    sections:
      - id: api-strategy
        title: API 集成策略
        template: |
          **API 集成策略：** {{api_integration_strategy}}
          **身份验证：** {{auth_integration}}
          **版本控制：** {{versioning_approach}}
      - id: new-endpoints
        title: 新 API 端点
        repeatable: true
        sections:
          - id: endpoint
            title: "{{endpoint_name}}"
            template: |
              - **方法：** {{http_method}}
              - **端点：** {{endpoint_path}}
              - **用途：** {{endpoint_purpose}}
              - **集成：** {{integration_with_existing}}
            sections:
              - id: request
                title: 请求
                type: code
                language: json
                template: "{{request_schema}}"
              - id: response
                title: 响应
                type: code
                language: json
                template: "{{response_schema}}"

  - id: external-api-integration
    title: 外部 API 集成
    condition: 增强需要新的外部 API
    instruction: 记录增强所需的新外部 API 集成
    repeatable: true
    sections:
      - id: external-api
        title: "{{api_name}} API"
        template: |
          - **用途：** {{api_purpose}}
          - **文档：** {{api_docs_url}}
          - **基本 URL：** {{api_base_url}}
          - **身份验证：** {{auth_method}}
          - **集成方法：** {{integration_approach}}
          
          **使用的关键端点：**
          - `{{method}} {{endpoint_path}}` - {{endpoint_purpose}}
          
          **错误处理：** {{error_handling_strategy}}

  - id: source-tree-integration
    title: 源代码树集成
    instruction: |
      定义新代码将如何与现有项目结构集成：
      
      1. 遵循现有项目组织模式
      2. 确定新文件/文件夹的放置位置
      3. 确保与现有命名约定的一致性
      4. 计划将对现有结构的干扰降至最低
    elicit: true
    sections:
      - id: existing-structure
        title: 现有项目结构
        type: code
        language: plaintext
        instruction: 记录当前结构的相关部分
        template: "{{existing_structure_relevant_parts}}"
      - id: new-file-organization
        title: 新文件组织
        type: code
        language: plaintext
        instruction: 仅显示现有结构的新增部分
        template: |
          {{project-root}}/
          ├── {{existing_structure_context}}
          │   ├── {{new_folder_1}}/           # {{purpose_1}}
          │   │   ├── {{new_file_1}}
          │   │   └── {{new_file_2}}
          │   ├── {{existing_folder}}/        # 带有新增内容的现有文件夹
          │   │   ├── {{existing_file}}       # 现有文件
          │   │   └── {{new_file_3}}          # 新增内容
          │   └── {{new_folder_2}}/           # {{purpose_2}}
      - id: integration-guidelines
        title: 集成指南
        template: |
          - **文件命名：** {{file_naming_consistency}}
          - **文件夹组织：** {{folder_organization_approach}}
          - **导入/导出模式：** {{import_export_consistency}}

  - id: infrastructure-deployment
    title: 基础设施和部署集成
    instruction: |
      定义增强功能将如何与现有基础设施一起部署：
      
      1. 使用现有部署管道和基础设施
      2. 识别所需的任何基础设施更改
      3. 规划部署策略以最小化风险
      4. 定义回滚程序
    elicit: true
    sections:
      - id: existing-infrastructure
        title: 现有基础设施
        template: |
          **当前部署：** {{existing_deployment_summary}}
          **基础设施工具：** {{existing_infrastructure_tools}}
          **环境：** {{existing_environments}}
      - id: enhancement-deployment
        title: 增强部署策略
        template: |
          **部署方法：** {{deployment_approach}}
          **基础设施更改：** {{infrastructure_changes}}
          **管道集成：** {{pipeline_integration}}
      - id: rollback-strategy
        title: 回滚策略
        template: |
          **回滚方法：** {{rollback_method}}
          **风险缓解：** {{risk_mitigation}}
          **监控：** {{monitoring_approach}}

  - id: coding-standards
    title: 编码标准和约定
    instruction: |
      确保新代码遵循现有项目约定：
      
      1. 从项目分析中记录现有编码标准
      2. 识别任何增强特定要求
      3. 确保与现有代码库模式的一致性
      4. 定义新代码组织的标准
    elicit: true
    sections:
      - id: existing-standards
        title: 现有标准合规性
        template: |
          **代码风格：** {{existing_code_style}}
          **Linting 规则：** {{existing_linting}}
          **测试模式：** {{existing_test_patterns}}
          **文档风格：** {{existing_doc_style}}
      - id: enhancement-standards
        title: 增强特定标准
        condition: 增强需要新模式
        repeatable: true
        template: "- **{{standard_name}}：** {{standard_description}}"
      - id: integration-rules
        title: 关键集成规则
        template: |
          - **现有 API 兼容性：** {{api_compatibility_rule}}
          - **数据库集成：** {{db_integration_rule}}
          - **错误处理：** {{error_handling_integration}}
          - **日志一致性：** {{logging_consistency}}

  - id: testing-strategy
    title: 测试策略
    instruction: |
      定义增强功能的测试方法：
      
      1. 与现有测试套件集成
      2. 确保现有功能保持不变
      3. 规划新功能的测试
      4. 定义集成测试方法
    elicit: true
    sections:
      - id: existing-test-integration
        title: 与现有测试集成
        template: |
          **现有测试框架：** {{existing_test_framework}}
          **测试组织：** {{existing_test_organization}}
          **覆盖率要求：** {{existing_coverage_requirements}}
      - id: new-testing
        title: 新测试要求
        sections:
          - id: unit-tests
            title: 新组件的单元测试
            template: |
              - **框架：** {{test_framework}}
              - **位置：** {{test_location}}
              - **覆盖目标：** {{coverage_target}}
              - **与现有集成：** {{test_integration}}
          - id: integration-tests
            title: 集成测试
            template: |
              - **范围：** {{integration_test_scope}}
              - **现有系统验证：** {{existing_system_verification}}
              - **新功能测试：** {{new_feature_testing}}
          - id: regression-tests
            title: 回归测试
            template: |
              - **现有功能验证：** {{regression_test_approach}}
              - **自动化回归套件：** {{automated_regression}}
              - **手动测试要求：** {{manual_testing_requirements}}

  - id: security-integration
    title: 安全集成
    instruction: |
      确保与现有系统保持安全一致性：
      
      1. 遵循现有安全模式和工具
      2. 确保新功能不会引入漏洞
      3. 保持现有安全态势
      4. 定义新组件的安全测试
    elicit: true
    sections:
      - id: existing-security
        title: 现有安全措施
        template: |
          **身份验证：** {{existing_auth}}
          **授权：** {{existing_authz}}
          **数据保护：** {{existing_data_protection}}
          **安全工具：** {{existing_security_tools}}
      - id: enhancement-security
        title: 增强安全要求
        template: |
          **新安全措施：** {{new_security_measures}}
          **集成点：** {{security_integration_points}}
          **合规性要求：** {{compliance_requirements}}
      - id: security-testing
        title: 安全测试
        template: |
          **现有安全测试：** {{existing_security_tests}}
          **新安全测试要求：** {{new_security_tests}}
          **渗透测试：** {{pentest_requirements}}

  - id: checklist-results
    title: 清单结果报告
    instruction: 执行架构师清单并在此处填充结果，重点关注老项目特定验证

  - id: next-steps
    title: 后续步骤
    instruction: |
      完成老项目架构后：
      
      1. 审查与现有系统的集成点
      2. 开始使用开发代理实施故事
      3. 设置部署管道集成
      4. 规划回滚和监控程序
    sections:
      - id: story-manager-handoff
        title: 故事经理交接
        instruction: |
          为故事经理创建一个简短的提示，以处理此老项目增强功能。包括：
          - 参考此架构文档
          - 与用户验证的关键集成要求
          - 基于实际项目分析的现有系统约束
          - 第一个要实施的故事以及清晰的集成检查点
          - 强调在整个实施过程中保持现有系统完整性
      - id: developer-handoff
        title: 开发人员交接
        instruction: |
          为开始实施的开发人员创建一个简短的提示。包括：
          - 参考此架构以及从实际项目分析的现有编码标准
          - 与用户验证的现有代码库集成要求
          - 基于真实项目约束的关键技术决策
          - 具有特定验证步骤的现有系统兼容性要求
          - 清晰的实施顺序，以最大程度地降低对现有功能的风险