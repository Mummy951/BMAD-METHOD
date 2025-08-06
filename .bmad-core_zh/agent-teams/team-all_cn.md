bundle:
  name: 团队全员
  icon: 👥
  description: 包括所有核心系统代理。
agents:
  - bmad-orchestrator
  - '*'
workflows:
  - brownfield-fullstack.yaml
  - brownfield-service.yaml
  - brownfield-ui.yaml
  - greenfield-fullstack.yaml
  - greenfield-service.yaml
  - greenfield-ui.yaml