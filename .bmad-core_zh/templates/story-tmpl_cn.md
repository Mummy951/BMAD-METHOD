template:
  id: story-template-v2
  name: 故事文档
  version: 2.0
  output:
    format: markdown
    filename: docs/stories/{{epic_num}}.{{story_num}}.{{story_title_short}}.md
    title: "故事 {{epic_num}}.{{story_num}}: {{story_title_short}}"

workflow:
  mode: interactive
  elicitation: advanced-elicitation

agent_config:
  editable_sections: 
    - 状态
    - 故事
    - 验收标准
    - 任务 / 子任务
    - 开发笔记
    - 测试
    - 更改日志

sections:
  - id: status
    title: 状态
    type: choice
    choices: [草稿, 已批准, 进行中, 审查, 完成]
    instruction: 选择故事的当前状态
    owner: scrum-master
    editors: [scrum-master, dev-agent]
    
  - id: story
    title: 故事
    type: template-text
    template: |
      **作为** {{role}}，
      **我想要** {{action}}，
      **以便** {{benefit}}
    instruction: 使用角色、动作和收益的标准格式定义用户故事
    elicit: true
    owner: scrum-master
    editors: [scrum-master]
    
  - id: acceptance-criteria
    title: 验收标准
    type: numbered-list
    instruction: 从 Epic 文件中复制验收标准编号列表
    elicit: true
    owner: scrum-master
    editors: [scrum-master]
    
  - id: tasks-subtasks
    title: 任务 / 子任务
    type: bullet-list
    instruction: |
      将故事分解为实现所需的特定任务和子任务。
      在相关处引用适用的验收标准编号。
    template: |
      - [ ] 任务 1 (AC: # 如果适用)
        - [ ] 子任务1.1...
      - [ ] 任务 2 (AC: # 如果适用)
        - [ ] 子任务 2.1...
      - [ ] 任务 3 (AC: # 如果适用)
        - [ ] 子任务 3.1...
    elicit: true
    owner: scrum-master
    editors: [scrum-master, dev-agent]
    
  - id: dev-notes
    title: 开发笔记
    instruction: |
      填充相关信息，仅限从 docs 文件夹中实际工件中提取的与此故事相关的信息：
      - 不要凭空捏造信息
      - 如果已知，添加与此故事相关的相关源代码树信息
      - 如果有与此故事相关的前一个故事的重要笔记，请将其包含在此处
      - 在本节中提供足够的信息，以便开发代理永远不需要阅读架构文档，这些笔记以及任务和子任务必须为开发代理提供理解信息所需的完整上下文，以最小的开销完成故事，满足所有验收标准并完成所有任务+子任务
    elicit: true
    owner: scrum-master
    editors: [scrum-master]
    sections:
      - id: testing-standards
        title: 测试
        instruction: |
          列出开发人员需要遵守的架构中相关的测试标准：
          - 测试文件位置
          - 测试标准
          - 要使用的测试框架和模式
          - 此故事的任何特定测试要求
        elicit: true
        owner: scrum-master
        editors: [scrum-master]
        
  - id: change-log
    title: 更改日志
    type: table
    columns: [日期, 版本, 描述, 作者]
    instruction: 跟踪此故事文档所做的更改
    owner: scrum-master
    editors: [scrum-master, dev-agent, qa-agent]
    
  - id: dev-agent-record
    title: 开发代理记录
    instruction: 本节由开发代理在实现期间填充
    owner: dev-agent
    editors: [dev-agent]
    sections:
      - id: agent-model
        title: 使用的代理模型
        template: "{{agent_model_name_version}}"
        instruction: 记录用于开发的特定 AI 代理模型和版本
        owner: dev-agent
        editors: [dev-agent]
        
      - id: debug-log-references
        title: 调试日志引用
        instruction: 引用开发期间生成的任何调试日志或跟踪
        owner: dev-agent
        editors: [dev-agent]
        
      - id: completion-notes
        title: 完成笔记列表
        instruction: 关于任务完成和遇到的任何问题的笔记
        owner: dev-agent
        editors: [dev-agent]
        
      - id: file-list
        title: 文件列表
        instruction: 列出故事实现期间创建、修改或影响的所有文件
        owner: dev-agent
        editors: [dev-agent]
        
  - id: qa-results
    title: QA 结果
    instruction: QA 代理对完成的故事实现进行 QA 审查的结果
    owner: qa-agent
    editors: [qa-agent]