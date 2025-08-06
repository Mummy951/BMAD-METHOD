# 安装选项:
## 完整版:
名称: 完整的BMad核心
描述: 复制整个.bmad-core文件夹，包含所有代理、模板和工具
动作: 复制文件夹
来源: bmad-core
## 单个代理:
名称: 单个代理
描述: 选择并安装单个代理及其依赖项
动作: 复制代理
# IDE配置:
## Cursor:
名称: Cursor
规则目录: .cursor/rules/
格式: 多文件
命令后缀: .mdc
说明: |
  # 在Cursor中使用BMad代理:
  # 1. 按Ctrl+L (Mac上为Cmd+L) 打开聊天
  # 2. 输入@代理名称 (例如，"@dev", "@pm", "@architect")
  # 3. 代理将根据该身份进行对话
## Claude Code:
名称: Claude Code
规则目录: .claude/commands/BMad/
格式: 多文件
命令后缀: .md
说明: |
  # 在Claude Code中使用BMad代理:
  # 1. 输入/代理名称 (例如，"/dev", "/pm", "/architect")
  # 2. Claude将切换到该代理的角色
## Windsurf:
名称: Windsurf
规则目录: .windsurf/rules/
格式: 多文件
命令后缀: .md
说明: |
  # 在Windsurf中使用BMad代理:
  # 1. 输入@代理名称 (例如，"@dev", "@pm")
  # 2. Windsurf将采用该代理的身份
## Trae:
名称: Trae
规则目录: .trae/rules/
格式: 多文件
命令后缀: .md
说明: |
  # 在Trae中使用BMad代理:
  # 1. 输入@代理名称 (例如，"@dev", "@pm", "@architect")
  # 2. Trae将采用该代理的身份
## Roo Code:
名称: Roo Code
格式: 自定义模式
文件: .roomodes
说明: |
  # 在Roo Code中使用BMad代理:
  # 1. 打开模式选择器 (通常在状态栏)
  # 2. 选择任何bmad-{agent}模式 (例如，"bmad-dev", "bmad-pm")
  # 3. AI将采用该代理的完整个性和能力
## Cline:
名称: Cline
规则目录: .clinerules/
格式: 多文件
命令后缀: .md
说明: |
  # 在Cline中使用BMad代理:
  # 1. 在VS Code中打开Cline聊天面板
  # 2. 输入@代理名称 (例如，"@dev", "@pm", "@architect")
  # 3. 代理将采用该身份进行对话
  # 4. 规则存储在项目中的.clinerules/目录中
## Gemini:
名称: Gemini CLI
规则目录: .gemini/bmad-method/
格式: 单文件
命令后缀: .md
说明: |
  # 在Gemini CLI中使用BMad代理:
  # 1. 安装程序会在您的项目中创建一个.gemini/bmad-method/目录。
  # 2. 它将所有代理文件连接到一个GEMINI.md文件中。
  # 3. 只需在提示中提及代理 (例如，"作为 *dev, ...")。
  # 4. Gemini CLI将自动拥有该代理的上下文。
## Github Copilot:
名称: Github Copilot
规则目录: .github/chatmodes/
格式: 多文件
命令后缀: .md
说明: |
  # 在Github Copilot中使用BMad代理:
  # 1. 安装程序会在您的项目中创建一个.github/chatmodes/目录
  # 2. 打开聊天视图 (Mac上为`⌃⌘I`，Windows/Linux上为`Ctrl+Alt+I`) 并从聊天模式选择器中选择**Agent**。
  # 3. 代理将采用该身份进行对话
  # 4. 需要VS Code 1.101+，并在设置中`chat.agent.enabled: true`
  # 5. 代理文件存储在.github/chatmodes/
  # 6. 使用`*help`查看可用命令和代理