template:
  id: market-research-template-v2
  name: 市场研究报告
  version: 2.0
  output:
    format: markdown
    filename: docs/market-research.md
    title: "市场研究报告：{{project_product_name}}"

workflow:
  mode: interactive
  elicitation: advanced-elicitation
  custom_elicitation:
    title: "市场研究启发式行动"
    options:
      - "通过敏感性分析扩展市场规模计算"
      - "深入研究特定客户细分"
      - "详细分析新兴市场趋势"
      - "将此市场与类似市场进行比较"
      - "压力测试市场假设"
      - "探索相邻市场机会"
      - "挑战市场定义和边界"
      - "生成战略场景（最佳/基础/最差情况）"
      - "要是我们早考虑 [X 市场因素]..."
      - "继续到下一部分"

sections:
  - id: executive-summary
    title: 执行摘要
    instruction: 提供关键发现、市场机会评估和战略建议的高层概述。在完成所有其他部分后最后编写本节。

  - id: research-objectives
    title: 研究目标与方法
    instruction: 此模板指导创建全面的市场研究报告。首先了解用户需要的市场洞察以及原因。根据研究目标，系统地完成每个部分，使用适当的分析框架。
    sections:
      - id: objectives
        title: 研究目标
        instruction: |
          列出本次市场研究的主要目标：
          - 本次研究将为哪些决策提供信息？
          - 哪些具体问题需要回答？
          - 本次研究的成功标准是什么？
      - id: methodology
        title: 研究方法
        instruction: |
          描述研究方法：
          - 使用的数据来源（主要/次要）
          - 应用的分析框架
          - 数据收集时间范围
          - 局限性和假设

  - id: market-overview
    title: 市场概览
    sections:
      - id: market-definition
        title: 市场定义
        instruction: |
          定义正在分析的市场：
          - 产品/服务类别
          - 地理范围
          - 包括的客户细分
          - 价值链位置
      - id: market-size-growth
        title: 市场规模与增长
        instruction: |
          通过明确的假设指导 TAM、SAM、SOM 计算。使用一种或多种方法：
          - 自上而下：从行业数据开始，缩小范围
          - 自下而上：从客户/单位经济构建
          - 价值理论：基于提供的价值与替代方案
        sections:
          - id: tam
            title: 总可寻址市场 (TAM)
            instruction: 计算并解释总市场机会
          - id: sam
            title: 可服务可寻址市场 (SAM)
            instruction: 定义您可以实际达到的 TAM 部分
          - id: som
            title: 可服务可获得市场 (SOM)
            instruction: 估计您可以实际捕获的部分
      - id: market-trends
        title: 市场趋势与驱动因素
        instruction: 使用 PESTEL 等适当框架分析影响市场的关键趋势
        sections:
          - id: key-trends
            title: 关键市场趋势
            instruction: |
              列出并解释 3-5 个主要趋势：
              - 趋势 1：描述和影响
              - 趋势 2：描述和影响
              - 等等。
          - id: growth-drivers
            title: 增长驱动因素
            instruction: 识别推动市场增长的主要因素
          - id: market-inhibitors
            title: 市场抑制因素
            instruction: 识别限制市场增长的因素

  - id: customer-analysis
    title: 客户分析
    sections:
      - id: segment-profiles
        title: 目标细分市场概况
        instruction: 为每个细分市场创建详细概况，包括人口统计/企业统计、心理统计、行为、需求和支付意愿
        repeatable: true
        sections:
          - id: segment
            title: "细分市场 {{segment_number}}：{{segment_name}}"
            template: |
              - **描述：** {{brief_overview}}
              - **规模：** {{number_of_customers_market_value}}
              - **特征：** {{key_demographics_firmographics}}
              - **需求和痛点：** {{primary_problems}}
              - **购买过程：** {{purchasing_decisions}}
              - **支付意愿：** {{price_sensitivity}}
      - id: jobs-to-be-done
        title: 待办工作分析 (Jobs-to-be-Done)
        instruction: 揭示客户真正想要完成什么
        sections:
          - id: functional-jobs
            title: 功能性工作
            instruction: 列出客户需要完成的实际任务和目标
          - id: emotional-jobs
            title: 情感性工作
            instruction: 描述客户寻求的感觉和认知
          - id: social-jobs
            title: 社交性工作
            instruction: 解释客户希望被他人如何看待

      - id: customer-journey
        title: 客户旅程映射
        instruction: 为主要细分市场映射端到端客户体验
        template: |
          对于主要客户细分：
          
          1. **认知：** {{discovery_process}}
          2. **考虑：** {{evaluation_criteria}}
          3. **购买：** {{decision_triggers}}
          4. **入职：** {{initial_expectations}}
          5. **使用：** {{interaction_patterns}}
          6. **倡导：** {{referral_behaviors}}

  - id: competitive-landscape
    title: 竞争格局
    sections:
      - id: market-structure
        title: 市场结构
        instruction: |
          描述整体竞争环境：
          - 竞争对手数量
          - 市场集中度
          - 竞争强度
      - id: major-players
        title: 主要参与者分析
        instruction: |
          对于排名前 3-5 的竞争对手：
          - 公司名称和简要描述
          - 市场份额估算
          - 主要优势和劣势
          - 目标客户重点
          - 定价策略
      - id: competitive-positioning
        title: 竞争定位
        instruction: |
          分析竞争对手的定位方式：
          - 价值主张
          - 差异化策略
          - 市场空白和机会

  - id: industry-analysis
    title: 行业分析
    sections:
      - id: porters-five-forces
        title: 波特五力分析
        instruction: 分析每种力量，并提供具体证据和影响
        sections:
          - id: supplier-power
            title: "供应商议价能力：{{power_level}}"
            template: "{{analysis_and_implications}}"
          - id: buyer-power
            title: "买方议价能力：{{power_level}}"
            template: "{{analysis_and_implications}}"
          - id: competitive-rivalry
            title: "竞争激烈程度：{{intensity_level}}"
            template: "{{analysis_and_implications}}"
          - id: threat-new-entry
            title: "新进入者威胁：{{threat_level}}"
            template: "{{analysis_and_implications}}"
          - id: threat-substitutes
            title: "替代品威胁：{{threat_level}}"
            template: "{{analysis_and_implications}}"
      - id: adoption-lifecycle
        title: 技术采用生命周期阶段
        instruction: |
          确定市场在采用曲线中的位置：
          - 当前阶段和证据
          - 对策略的影响
          - 预期进展时间表

  - id: opportunity-assessment
    title: 机会评估
    sections:
      - id: market-opportunities
        title: 市场机会
        instruction: 根据分析识别具体机会
        repeatable: true
        sections:
          - id: opportunity
            title: "机会 {{opportunity_number}}：{{name}}"
            template: |
              - **描述：** {{what_is_the_opportunity}}
              - **规模/潜力：** {{quantified_potential}}
              - **要求：** {{needed_to_capture}}
              - **风险：** {{key_challenges}}
      - id: strategic-recommendations
        title: 战略建议
        sections:
          - id: go-to-market
            title: 市场进入策略
            instruction: |
              推荐市场进入/扩张方法：
              - 目标细分市场优先级
              - 定位策略
              - 渠道策略
              - 合作机会
          - id: pricing-strategy
            title: 定价策略
            instruction: |
              基于支付意愿分析和竞争格局：
              - 推荐的定价模型
              - 价格点/范围
              - 价值指标
              - 竞争定位
          - id: risk-mitigation
            title: 风险缓解
            instruction: |
              关键风险和缓解策略：
              - 市场风险
              - 竞争风险
              - 执行风险
              - 监管/合规风险

  - id: appendices
    title: 附录
    sections:
      - id: data-sources
        title: A. 数据来源
        instruction: 列出研究中使用的所有来源
      - id: calculations
        title: B. 详细计算
        instruction: 包括任何复杂的计算或模型
      - id: additional-analysis
        title: C. 补充分析
        instruction: 任何未包含在正文中的补充分析