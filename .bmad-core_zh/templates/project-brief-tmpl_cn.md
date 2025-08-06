template:
  id: project-brief-template-v2
  name: 项目简报
  version: 2.0
  output:
    format: markdown
    filename: docs/brief.md
    title: "项目简报：{{project_name}}"

workflow:
  mode: interactive
  elicitation: advanced-elicitation
  custom_elicitation:
    title: "项目简报启发式行动"
    options:
      - "用更具体的细节扩展章节"
      - "对照类似成功的项目进行验证"
      - "用边缘情况压力测试假设"
      - "探索替代解决方案方法"
      - "分析资源/约束权衡"
      - "生成风险缓解策略"
      - "从 MVP 极简主义视图挑战范围"
      - "头脑风暴创意功能可能性"
      - "要是我们有 [资源/能力/时间]..."
      - "继续到下一部分"

sections:
  - id: introduction
    instruction: |
      此模板指导创建全面的项目简报，作为产品开发的基础输入。
      
      首先询问用户他们喜欢哪种模式：
      
      1. **交互模式** - 协作完成每个部分
      2. **YOLO 模式** - 生成完整草稿进行审查和完善
      
      在开始之前，了解可用的输入（头脑风暴结果、市场研究、竞争分析、初始想法）并收集项目上下文。

  - id: executive-summary
    title: 执行摘要
    instruction: |
      创建简洁的概述，捕捉项目精髓。包括：
      - 1-2 句话的产品概念
      - 正在解决的主要问题
      - 目标市场识别
      - 关键价值主张
    template: "{{executive_summary_content}}"

  - id: problem-statement
    title: 问题陈述
    instruction: |
      清晰且有证据地阐明问题。解决：
      - 当前状态和痛点
      - 问题的影响（如果可能量化）
      - 为什么现有解决方案不足
      - 现在解决此问题的紧迫性和重要性
    template: "{{detailed_problem_description}}"

  - id: proposed-solution
    title: 建议的解决方案
    instruction: |
      高层描述解决方案方法。包括：
      - 核心概念和方法
      - 与现有解决方案的关键差异点
      - 为什么此解决方案会成功而其他方案不会
      - 产品的高层愿景
    template: "{{solution_description}}"

  - id: target-users
    title: 目标用户
    instruction: |
      具体定义和描述目标用户。对于每个用户细分，包括：
      - 人口/公司统计概况
      - 当前行为和工作流程
      - 特定需求和痛点
      - 他们试图实现的目标
    sections:
      - id: primary-segment
        title: "主要用户细分：{{segment_name}}"
        template: "{{primary_user_description}}"
      - id: secondary-segment
        title: "次要用户细分：{{segment_name}}"
        condition: 有次要用户细分
        template: "{{secondary_user_description}}"

  - id: goals-metrics
    title: 目标和成功指标
    instruction: 建立明确的目标和衡量成功的标准。使目标 SMART（具体的、可衡量的、可实现的、相关的、有时间限制的）
    sections:
      - id: business-objectives
        title: 业务目标
        type: bullet-list
        template: "- {{objective_with_metric}}"
      - id: user-success-metrics
        title: 用户成功指标
        type: bullet-list
        template: "- {{user_metric}}"
      - id: kpis
        title: 关键绩效指标 (KPI)
        type: bullet-list
        template: "- {{kpi}}：{{definition_and_target}}"

  - id: mvp-scope
    title: MVP 范围
    instruction: 明确定义最小可行产品。具体说明哪些包含哪些不包含。帮助用户区分必须有的和可有可无的。
    sections:
      - id: core-features
        title: 核心功能（必须有）
        type: bullet-list
        template: "- **{{feature}}：** {{description_and_rationale}}"
      - id: out-of-scope
        title: MVP 范围之外
        type: bullet-list
        template: "- {{feature_or_capability}}"
      - id: mvp-success-criteria
        title: MVP 成功标准
        template: "{{mvp_success_definition}}"

  - id: post-mvp-vision
    title: MVP 后愿景
    instruction: 概述长期产品方向，但不承诺具体细节
    sections:
      - id: phase-2-features
        title: 阶段 2 功能
        template: "{{next_priority_features}}"
      - id: long-term-vision
        title: 长期愿景
        template: "{{one_two_year_vision}}"
      - id: expansion-opportunities
        title: 扩展机会
        template: "{{potential_expansions}}"

  - id: technical-considerations
    title: 技术考虑
    instruction: 记录已知的技术约束和偏好。请注意，这些是初步想法，并非最终决定。
    sections:
      - id: platform-requirements
        title: 平台要求
        template: |
          - **目标平台：** {{platforms}}
          - **浏览器/操作系统支持：** {{specific_requirements}}
          - **性能要求：** {{performance_specs}}
      - id: technology-preferences
        title: 技术偏好
        template: |
          - **前端：** {{frontend_preferences}}
          - **后端：** {{backend_preferences}}
          - **数据库：** {{database_preferences}}
          - **托管/基础设施：** {{infrastructure_preferences}}
      - id: architecture-considerations
        title: 架构考虑
        template: |
          - **存储库结构：** {{repo_thoughts}}
          - **服务架构：** {{service_thoughts}}
          - **集成要求：** {{integration_needs}}
          - **安全/合规性：** {{security_requirements}}

  - id: constraints-assumptions
    title: 约束和假设
    instruction: 清楚说明限制和假设，以设定切合实际的期望
    sections:
      - id: constraints
        title: 约束
        template: |
          - **预算：** {{budget_info}}
          - **时间线：** {{timeline_info}}
          - **资源：** {{resource_info}}
          - **技术：** {{technical_constraints}}
      - id: key-assumptions
        title: 关键假设
        type: bullet-list
        template: "- {{assumption}}"

  - id: risks-questions
    title: 风险和未决问题
    instruction: 主动识别未知因素和潜在挑战
    sections:
      - id: key-risks
        title: 关键风险
        type: bullet-list
        template: "- **{{risk}}：** {{description_and_impact}}"
      - id: open-questions
        title: 未决问题
        type: bullet-list
        template: "- {{question}}"
      - id: research-areas
        title: 需要进一步研究的领域
        type: bullet-list
        template: "- {{research_topic}}"

  - id: appendices
    title: 附录
    sections:
      - id: research-summary
        title: A. 研究摘要
        condition: 有研究结果
        instruction: |
          如果适用，总结以下关键发现：
          - 市场研究
          - 竞争分析
          - 用户访谈
          - 技术可行性研究
      - id: stakeholder-input
        title: B. 利益相关者输入
        condition: 有利益相关者反馈
        template: "{{stakeholder_feedback}}"
      - id: references
        title: C. 参考资料
        template: "{{relevant_links_and_docs}}"

  - id: next-steps
    title: 后续步骤
    sections:
      - id: immediate-actions
        title: 即时行动
        type: numbered-list
        template: "{{action_item}}"
      - id: pm-handoff
        title: 产品经理交接
        content: |
          此项目简报提供了 {{project_name}} 的完整上下文。请在“PRD 生成模式”下开始，彻底审查简报，以便与用户逐节创建 PRD，根据模板指示，询问任何必要的澄清或提出改进建议。