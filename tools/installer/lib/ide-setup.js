/**
 * IDE设置 - 负责处理不同IDE的安装和配置
 *
 * 此模块扩展了BaseIdeSetup，为各种IDE（如Cursor, Claude Code, Windsurf, Trae, Roo, Cline, Gemini, Github Copilot）
 * 提供专门的设置逻辑。它根据传入的IDE类型调用相应的设置函数，
 * 处理代理规则的生成、文件写入以及IDE特定的配置调整，
 * 确保BMad代理能够正确集成并按预期运行。
 */

const path = require("path");
const fs = require("fs-extra");
const yaml = require("js-yaml");
const chalk = require("chalk");
const inquirer = require("inquirer");
const fileManager = require("./file-manager");
const configLoader = require("./config-loader");
const { extractYamlFromAgent } = require("../../lib/yaml-utils");
const BaseIdeSetup = require("./ide-base-setup");
const resourceLocator = require("./resource-locator");

class IdeSetup extends BaseIdeSetup {
  constructor() {
    super();
    this.ideAgentConfig = null;
  }

  async loadIdeAgentConfig() {
    if (this.ideAgentConfig) return this.ideAgentConfig;
    
    try {
      const configPath = path.join(__dirname, '..', 'config', 'ide-agent-config.yaml');
      const configContent = await fs.readFile(configPath, 'utf8');
      this.ideAgentConfig = yaml.load(configContent);
      return this.ideAgentConfig;
    } catch (error) {
      console.warn('加载IDE代理配置失败，使用默认配置');
      return {
        'roo-permissions': {},
        'cline-order': {}
      };
    }
  }

  async setup(ide, installDir, selectedAgent = null, spinner = null, preConfiguredSettings = null) {
    const ideConfig = await configLoader.getIdeConfiguration(ide);

    if (!ideConfig) {
      console.log(chalk.yellow(`\n${ide}没有可用的配置`));
      return false;
    }

    switch (ide) {
      case "cursor":
        return this.setupCursor(installDir, selectedAgent);
      case "claude-code":
        return this.setupClaudeCode(installDir, selectedAgent);
      case "windsurf":
        return this.setupWindsurf(installDir, selectedAgent);
      case "trae":
        return this.setupTrae(installDir, selectedAgent);
      case "roo":
        return this.setupRoo(installDir, selectedAgent);
      case "cline":
        return this.setupCline(installDir, selectedAgent);
      case "gemini":
        return this.setupGeminiCli(installDir, selectedAgent);
      case "github-copilot":
        return this.setupGitHubCopilot(installDir, selectedAgent, spinner, preConfiguredSettings);
      default:
        console.log(chalk.yellow(`\n尚不支持IDE ${ide}`));
        return false;
    }
  }

  async setupCursor(installDir, selectedAgent) {
    const cursorRulesDir = path.join(installDir, ".cursor", "rules");
    const agents = selectedAgent ? [selectedAgent] : await this.getAllAgentIds(installDir);

    await fileManager.ensureDirectory(cursorRulesDir);

    for (const agentId of agents) {
      const agentPath = await this.findAgentPath(agentId, installDir);

      if (agentPath) {
        const mdcContent = await this.createAgentRuleContent(agentId, agentPath, installDir, 'mdc');
        const mdcPath = path.join(cursorRulesDir, `${agentId}.mdc`);
        await fileManager.writeFile(mdcPath, mdcContent);
        console.log(chalk.green(`✓ 已创建规则: ${agentId}.mdc`));
      }
    }

    console.log(chalk.green(`\n✓ 已在 ${cursorRulesDir} 中创建Cursor规则`));
    return true;
  }

  async setupClaudeCode(installDir, selectedAgent) {
    // 设置bmad-core命令
    const coreSlashPrefix = await this.getCoreSlashPrefix(installDir);
    const coreAgents = selectedAgent ? [selectedAgent] : await this.getCoreAgentIds(installDir);
    const coreTasks = await this.getCoreTaskIds(installDir);
    await this.setupClaudeCodeForPackage(installDir, "core", coreSlashPrefix, coreAgents, coreTasks, ".bmad-core");

    // 设置扩展包命令
    const expansionPacks = await this.getInstalledExpansionPacks(installDir);
    for (const packInfo of expansionPacks) {
      const packSlashPrefix = await this.getExpansionPackSlashPrefix(packInfo.path);
      const packAgents = await this.getExpansionPackAgents(packInfo.path);
      const packTasks = await this.getExpansionPackTasks(packInfo.path);
      
      if (packAgents.length > 0 || packTasks.length > 0) {
        // 使用扩展包安装的实际目录名
        const rootPath = path.relative(installDir, packInfo.path);
        await this.setupClaudeCodeForPackage(installDir, packInfo.name, packSlashPrefix, packAgents, packTasks, rootPath);
      }
    }

    return true;
  }

  async setupClaudeCodeForPackage(installDir, packageName, slashPrefix, agentIds, taskIds, rootPath) {
    const commandsBaseDir = path.join(installDir, ".claude", "commands", slashPrefix);
    const agentsDir = path.join(commandsBaseDir, "agents");
    const tasksDir = path.join(commandsBaseDir, "tasks");

    // 确保目录存在
    await fileManager.ensureDirectory(agentsDir);
    await fileManager.ensureDirectory(tasksDir);

    // 设置代理
    for (const agentId of agentIds) {
      // 查找代理文件 - 对于扩展包，优先使用扩展包版本
      let agentPath;
      if (packageName !== "core") {
        // 对于扩展包，首先尝试在扩展包目录中查找代理
        const expansionPackPath = path.join(installDir, rootPath, "agents", `${agentId}.md`);
        if (await fileManager.pathExists(expansionPackPath)) {
          agentPath = expansionPackPath;
        } else {
          // 如果在扩展包中找不到，则回退到核心
          agentPath = await this.findAgentPath(agentId, installDir);
        }
      } else {
        // 对于核心，使用正常搜索
        agentPath = await this.findAgentPath(agentId, installDir);
      }
      
      const commandPath = path.join(agentsDir, `${agentId}.md`);

      if (agentPath) {
        // 创建带有代理内容的命令文件
        let agentContent = await fileManager.readFile(agentPath);
        
        // 将{root}占位符替换为当前上下文的适当根路径
        agentContent = agentContent.replace(/{root}/g, rootPath);

        // 添加命令头
        let commandContent = `# /${agentId} 命令\n\n`;
        commandContent += `使用此命令时，采用以下代理角色:\n\n`;
        commandContent += agentContent;

        await fileManager.writeFile(commandPath, commandContent);
        console.log(chalk.green(`✓ 已创建代理命令: /${agentId}`));
      }
    }

    // 设置任务
    for (const taskId of taskIds) {
      // 查找任务文件 - 对于扩展包，优先使用扩展包版本
      let taskPath;
      if (packageName !== "core") {
        // 对于扩展包，首先尝试在扩展包目录中查找任务
        const expansionPackPath = path.join(installDir, rootPath, "tasks", `${taskId}.md`);
        if (await fileManager.pathExists(expansionPackPath)) {
          taskPath = expansionPackPath;
        } else {
          // 如果在扩展包中找不到，则回退到核心
          taskPath = await this.findTaskPath(taskId, installDir);
        }
      } else {
        // 对于核心，使用正常搜索
        taskPath = await this.findTaskPath(taskId, installDir);
      }
      
      const commandPath = path.join(tasksDir, `${taskId}.md`);

      if (taskPath) {
        // 创建带有任务内容的命令文件
        let taskContent = await fileManager.readFile(taskPath);
        
        // 将{root}占位符替换为当前上下文的适当根路径
        taskContent = taskContent.replace(/{root}/g, rootPath);

        // 添加命令头
        let commandContent = `# /${taskId} 任务\n\n`;
        commandContent += `使用此命令时，执行以下任务:\n\n`;
        commandContent += taskContent;

        await fileManager.writeFile(commandPath, commandContent);
        console.log(chalk.green(`✓ 已创建任务命令: /${taskId}`));
      }
    }

    console.log(chalk.green(`\n✓ 已为 ${packageName} 在 ${commandsBaseDir} 中创建Claude Code命令`));
    console.log(chalk.dim(`  - 代理目录: ${agentsDir}`));
    console.log(chalk.dim(`  - 任务目录: ${tasksDir}`));
  }

  async setupWindsurf(installDir, selectedAgent) {
    const windsurfRulesDir = path.join(installDir, ".windsurf", "rules");
    const agents = selectedAgent ? [selectedAgent] : await this.getAllAgentIds(installDir);

    await fileManager.ensureDirectory(windsurfRulesDir);

    for (const agentId of agents) {
      // 查找代理文件
      const agentPath = await this.findAgentPath(agentId, installDir);

      if (agentPath) {
        const agentContent = await fileManager.readFile(agentPath);
        const mdPath = path.join(windsurfRulesDir, `${agentId}.md`);

        // 创建MD内容（类似于Cursor，但没有前置元数据）
        let mdContent = `# ${agentId.toUpperCase()} 代理规则\n\n`;
        mdContent += `当用户输入 \`@${agentId}\` 并激活 ${await this.getAgentTitle(
          agentId,
          installDir
        )} 代理角色时，此规则将被触发。\n\n`;
        mdContent += "## 代理激活\n\n";
        mdContent +=
          "重要提示: 阅读完整的YAML，开始激活以改变您的存在状态，遵循启动部分说明，在此状态下直到被告知退出此模式:\n\n";
        mdContent += "```yaml\n";
        // 从代理文件中提取YAML内容
        const yamlContent = extractYamlFromAgent(agentContent);
        if (yamlContent) {
          mdContent += yamlContent;
        } else {
          // 如果未找到YAML，则包含除头信息外的所有内容
          mdContent += agentContent.replace(/^#.*$/m, "").trim();
        }
        mdContent += "\n```\n\n";
        mdContent += "## 文件引用\n\n";
        const relativePath = path.relative(installDir, agentPath).replace(/\\/g, '/');
        mdContent += `完整的代理定义可在 [${relativePath}](${relativePath}) 中找到。\n\n`;
        mdContent += "## 用法\n\n";
        mdContent += `当用户输入 \`@${agentId}\` 时，激活此 ${await this.getAgentTitle(
          agentId,
          installDir
        )} 角色并遵循上述YAML配置中定义的所有说明。\n`;

        await fileManager.writeFile(mdPath, mdContent);
        console.log(chalk.green(`✓ 已创建规则: ${agentId}.md`));
      }
    }

    console.log(chalk.green(`\n✓ 已在 ${windsurfRulesDir} 中创建Windsurf规则`));

    return true;
  }

  async setupTrae(installDir, selectedAgent) {
    const traeRulesDir = path.join(installDir, ".trae", "rules");
    const agents = selectedAgent? [selectedAgent] : await this.getAllAgentIds(installDir);
    
    await fileManager.ensureDirectory(traeRulesDir);
    
    for (const agentId of agents) {
      // 查找代理文件
      const agentPath = await this.findAgentPath(agentId, installDir);
      
      if (agentPath) {
        const agentContent = await fileManager.readFile(agentPath);
        const mdPath = path.join(traeRulesDir, `${agentId}.md`);
        
        // 创建MD内容（类似于Cursor，但没有前置元数据）
        let mdContent = `# ${agentId.toUpperCase()} 代理规则\n\n`;
        mdContent += `当用户输入 \`@${agentId}\` 并激活 ${await this.getAgentTitle(
          agentId,
          installDir
        )} 代理角色时，此规则将被触发。\n\n`;
        mdContent += "## 代理激活\n\n";
        mdContent +=
          "重要提示: 阅读完整的YAML，开始激活以改变您的存在状态，遵循启动部分说明，在此状态下直到被告知退出此模式:\n\n";
        mdContent += "```yaml\n";
        // 从代理文件中提取YAML内容
        const yamlContent = extractYamlFromAgent(agentContent);
        if (yamlContent) {
          mdContent += yamlContent;
        }
        else {
          // 如果未找到YAML，则包含除头信息外的所有内容
          mdContent += agentContent.replace(/^#.*$/m, "").trim();
        }
        mdContent += "\n```\n\n";
        mdContent += "## 文件引用\n\n";
        const relativePath = path.relative(installDir, agentPath).replace(/\\/g, '/');
        mdContent += `完整的代理定义可在 [${relativePath}](${relativePath}) 中找到。\n\n`;
        mdContent += "## 用法\n\n";
        mdContent += `当用户输入 \`@${agentId}\` 时，激活此 ${await this.getAgentTitle(
          agentId,
          installDir
        )} 角色并遵循上述YAML配置中定义的所有说明。\n`;
        
        await fileManager.writeFile(mdPath, mdContent);
        console.log(chalk.green(`✓ 已创建规则: ${agentId}.md`));
      }
    }
  }

  async findAgentPath(agentId, installDir) {
    // 尝试在各种位置查找代理文件
    const possiblePaths = [
      path.join(installDir, ".bmad-core", "agents", `${agentId}.md`),
      path.join(installDir, "agents", `${agentId}.md`)
    ];
    
    // 也检查扩展包目录
    const glob = require("glob");
    const expansionDirs = glob.sync(".*/agents", { cwd: installDir });
    for (const expDir of expansionDirs) {
      possiblePaths.push(path.join(installDir, expDir, `${agentId}.md`));
    }
    
    for (const agentPath of possiblePaths) {
      if (await fileManager.pathExists(agentPath)) {
        return agentPath;
      }
    }
    
    return null;
  }

  async getAllAgentIds(installDir) {
    const glob = require("glob");
    const allAgentIds = [];
    
    // 检查.bmad-core或根目录中的核心代理
    let agentsDir = path.join(installDir, ".bmad-core", "agents");
    if (!(await fileManager.pathExists(agentsDir))) {
      agentsDir = path.join(installDir, "agents");
    }
    
    if (await fileManager.pathExists(agentsDir)) {
      const agentFiles = glob.sync("*.md", { cwd: agentsDir });
      allAgentIds.push(...agentFiles.map((file) => path.basename(file, ".md")));
    }
    
    // 也检查带点文件夹中的扩展包代理
    const expansionDirs = glob.sync(".*/agents", { cwd: installDir });
    for (const expDir of expansionDirs) {
      const fullExpDir = path.join(installDir, expDir);
      const expAgentFiles = glob.sync("*.md", { cwd: fullExpDir });
      allAgentIds.push(...expAgentFiles.map((file) => path.basename(file, ".md")));
    }
    
    // 移除重复项
    return [...new Set(allAgentIds)];
  }

  async getCoreAgentIds(installDir) {
    const allAgentIds = [];
    
    // 仅检查.bmad-core或根目录中的核心代理
    let agentsDir = path.join(installDir, ".bmad-core", "agents");
    if (!(await fileManager.pathExists(agentsDir))) {
      agentsDir = path.join(installDir, "bmad-core", "agents");
    }
    
    if (await fileManager.pathExists(agentsDir)) {
      const glob = require("glob");
      const agentFiles = glob.sync("*.md", { cwd: agentsDir });
      allAgentIds.push(...agentFiles.map((file) => path.basename(file, ".md")));
    }
    
    return [...new Set(allAgentIds)];
  }

  async getCoreTaskIds(installDir) {
    const allTaskIds = [];
    
    // 仅检查.bmad-core或根目录中的核心任务
    let tasksDir = path.join(installDir, ".bmad-core", "tasks");
    if (!(await fileManager.pathExists(tasksDir))) {
      tasksDir = path.join(installDir, "bmad-core", "tasks");
    }
    
    if (await fileManager.pathExists(tasksDir)) {
      const glob = require("glob");
      const taskFiles = glob.sync("*.md", { cwd: tasksDir });
      allTaskIds.push(...taskFiles.map((file) => path.basename(file, ".md")));
    }
    
    // 检查通用任务
    const commonTasksDir = path.join(installDir, "common", "tasks");
    if (await fileManager.pathExists(commonTasksDir)) {
      const commonTaskFiles = glob.sync("*.md", { cwd: commonTasksDir });
      allTaskIds.push(...commonTaskFiles.map((file) => path.basename(file, ".md")));
    }
    
    return [...new Set(allTaskIds)];
  }

  async getAgentTitle(agentId, installDir) {
    // 尝试在各种位置查找代理文件
    const possiblePaths = [
      path.join(installDir, ".bmad-core", "agents", `${agentId}.md`),
      path.join(installDir, "agents", `${agentId}.md`)
    ];
    
    // 也检查扩展包目录
    const glob = require("glob");
    const expansionDirs = glob.sync(".*/agents", { cwd: installDir });
    for (const expDir of expansionDirs) {
      possiblePaths.push(path.join(installDir, expDir, `${agentId}.md`));
    }
    
    for (const agentPath of possiblePaths) {
      if (await fileManager.pathExists(agentPath)) {
        try {
          const agentContent = await fileManager.readFile(agentPath);
          const yamlMatch = agentContent.match(/```ya?ml\r?\n([\s\S]*?)```/);
          
          if (yamlMatch) {
            const yaml = yamlMatch[1];
            const titleMatch = yaml.match(/title:\s*(.+)/);
            if (titleMatch) {
              return titleMatch[1].trim();
            }
          }
        } catch (error) {
          console.warn(`读取代理 ${agentId} 的标题失败: ${error.message}`);
        }
      }
    }
    
    // 回退到格式化后的代理ID
    return agentId.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  async getAllTaskIds(installDir) {
    const glob = require("glob");
    const allTaskIds = [];
    
    // 检查.bmad-core或根目录中的核心任务
    let tasksDir = path.join(installDir, ".bmad-core", "tasks");
    if (!(await fileManager.pathExists(tasksDir))) {
      tasksDir = path.join(installDir, "bmad-core", "tasks");
    }
    
    if (await fileManager.pathExists(tasksDir)) {
      const taskFiles = glob.sync("*.md", { cwd: tasksDir });
      allTaskIds.push(...taskFiles.map((file) => path.basename(file, ".md")));
    }
    
    // 检查通用任务
    const commonTasksDir = path.join(installDir, "common", "tasks");
    if (await fileManager.pathExists(commonTasksDir)) {
      const commonTaskFiles = glob.sync("*.md", { cwd: commonTasksDir });
      allTaskIds.push(...commonTaskFiles.map((file) => path.basename(file, ".md")));
    }
    
    // 也检查带点文件夹中的扩展包任务
    const expansionDirs = glob.sync(".*/tasks", { cwd: installDir });
    for (const expDir of expansionDirs) {
      const fullExpDir = path.join(installDir, expDir);
      const expTaskFiles = glob.sync("*.md", { cwd: fullExpDir });
      allTaskIds.push(...expTaskFiles.map((file) => path.basename(file, ".md")));
    }
    
    // 检查expansion-packs文件夹中的任务
    const expansionPacksDir = path.join(installDir, "expansion-packs");
    if (await fileManager.pathExists(expansionPacksDir)) {
      const expPackDirs = glob.sync("*/tasks", { cwd: expansionPacksDir });
      for (const expDir of expPackDirs) {
        const fullExpDir = path.join(expansionPacksDir, expDir);
        const expTaskFiles = glob.sync("*.md", { cwd: fullExpDir });
        allTaskIds.push(...expTaskFiles.map((file) => path.basename(file, ".md")));
      }
    }
    
    // 移除重复项
    return [...new Set(allTaskIds)];
  }

  async findTaskPath(taskId, installDir) {
    // 尝试在各种位置查找任务文件
    const possiblePaths = [
      path.join(installDir, ".bmad-core", "tasks", `${taskId}.md`),
      path.join(installDir, "bmad-core", "tasks", `${taskId}.md`),
      path.join(installDir, "common", "tasks", `${taskId}.md`)
    ];
    
    // 也检查扩展包目录
    const glob = require("glob");
    
    // 检查带点文件夹中的扩展包
    const expansionDirs = glob.sync(".*/tasks", { cwd: installDir });
    for (const expDir of expansionDirs) {
      possiblePaths.push(path.join(installDir, expDir, `${taskId}.md`));
    }
    
    // 检查expansion-packs文件夹
    const expansionPacksDir = path.join(installDir, "expansion-packs");
    if (await fileManager.pathExists(expansionPacksDir)) {
      const expPackDirs = glob.sync("*/tasks", { cwd: expansionPacksDir });
      for (const expDir of expPackDirs) {
        possiblePaths.push(path.join(expansionPacksDir, expDir, `${taskId}.md`));
      }
    }
    
    for (const taskPath of possiblePaths) {
      if (await fileManager.pathExists(taskPath)) {
        return taskPath;
      }
    }
    
    return null;
  }

  async getCoreSlashPrefix(installDir) {
    try {
      const coreConfigPath = path.join(installDir, ".bmad-core", "core-config.yaml");
      if (!(await fileManager.pathExists(coreConfigPath))) {
        // 尝试bmad-core目录
        const altConfigPath = path.join(installDir, "bmad-core", "core-config.yaml");
        if (await fileManager.pathExists(altConfigPath)) {
          const configContent = await fileManager.readFile(altConfigPath);
          const config = yaml.load(configContent);
          return config.slashPrefix || "BMad";
        }
        return "BMad"; // 回退
      }
      
      const configContent = await fileManager.readFile(coreConfigPath);
      const config = yaml.load(configContent);
      return config.slashPrefix || "BMad";
    } catch (error) {
      console.warn(`读取核心斜杠前缀失败，使用默认值 'BMad': ${error.message}`);
      return "BMad";
    }
  }

  async getInstalledExpansionPacks(installDir) {
    const expansionPacks = [];
    
    // 检查安装目录中带点前缀的扩展包
    const glob = require("glob");
    const dotExpansions = glob.sync(".bmad-*", { cwd: installDir });
    
    for (const dotExpansion of dotExpansions) {
      if (dotExpansion !== ".bmad-core") {
        const packPath = path.join(installDir, dotExpansion);
        const packName = dotExpansion.substring(1); // 移除点
        expansionPacks.push({
          name: packName,
          path: packPath
        });
      }
    }
    
    // 检查expansion-packs目录样式
    const expansionPacksDir = path.join(installDir, "expansion-packs");
    if (await fileManager.pathExists(expansionPacksDir)) {
      const packDirs = glob.sync("*", { cwd: expansionPacksDir });
      
      for (const packDir of packDirs) {
        const packPath = path.join(expansionPacksDir, packDir);
        if ((await fileManager.pathExists(packPath)) && 
            (await fileManager.pathExists(path.join(packPath, "config.yaml")))) {
          expansionPacks.push({
            name: packDir,
            path: packPath
          });
        }
      }
    }
    
    return expansionPacks;
  }

  async getExpansionPackSlashPrefix(packPath) {
    try {
      const configPath = path.join(packPath, "config.yaml");
      if (await fileManager.pathExists(configPath)) {
        const configContent = await fileManager.readFile(configPath);
        const config = yaml.load(configContent);
        return config.slashPrefix || path.basename(packPath);
      }
    } catch (error) {
      console.warn(`从 ${packPath} 读取扩展包斜杠前缀失败: ${error.message}`);
    }
    
    return path.basename(packPath); // 回退到目录名
  }

  async getExpansionPackAgents(packPath) {
    const agentsDir = path.join(packPath, "agents");
    if (!(await fileManager.pathExists(agentsDir))) {
      return [];
    }
    
    try {
      const glob = require("glob");
      const agentFiles = glob.sync("*.md", { cwd: agentsDir });
      return agentFiles.map(file => path.basename(file, ".md"));
    } catch (error) {
      console.warn(`从 ${packPath} 读取扩展包代理失败: ${error.message}`);
      return [];
    }
  }

  async getExpansionPackTasks(packPath) {
    const tasksDir = path.join(packPath, "tasks");
    if (!(await fileManager.pathExists(tasksDir))) {
      return [];
    }
    
    try {
      const glob = require("glob");
      const taskFiles = glob.sync("*.md", { cwd: tasksDir });
      return taskFiles.map(file => path.basename(file, ".md"));
    } catch (error) {
      console.warn(`从 ${packPath} 读取扩展包任务失败: ${error.message}`);
      return [];
    }
  }

  async setupRoo(installDir, selectedAgent) {
    const agents = selectedAgent ? [selectedAgent] : await this.getAllAgentIds(installDir);

    // 检查项目根目录中是否存在.roomodes文件
    const roomodesPath = path.join(installDir, ".roomodes");
    let existingModes = [];
    let existingContent = "";

    if (await fileManager.pathExists(roomodesPath)) {
      existingContent = await fileManager.readFile(roomodesPath);
      // 解析现有模式以避免重复
      const modeMatches = existingContent.matchAll(/- slug: ([\w-]+)/g);
      for (const match of modeMatches) {
        existingModes.push(match[1]);
      }
      console.log(chalk.yellow(`找到现有.roomodes文件，包含 ${existingModes.length} 种模式`));
    }

    // 创建新模式内容
    let newModesContent = "";

    // 从配置中加载动态代理权限
    const config = await this.loadIdeAgentConfig();
    const agentPermissions = config['roo-permissions'] || {};

    for (const agentId of agents) {
      // 如果已存在则跳过
      // 检查带“bmad-”前缀和不带前缀的两种情况
      const checkSlug = agentId.startsWith('bmad-') ? agentId : `bmad-${agentId}`;
      if (existingModes.includes(checkSlug)) {
        console.log(chalk.dim(`跳过 ${agentId} - 已存在于.roomodes中`));
        continue;
      }

      // 读取代理文件以提取所有信息
      const agentPath = await this.findAgentPath(agentId, installDir);

      if (agentPath) {
        const agentContent = await fileManager.readFile(agentPath);

        // 提取YAML内容
        const yamlMatch = agentContent.match(/```ya?ml\r?\n([\s\S]*?)```/);
        if (yamlMatch) {
          const yaml = yamlMatch[1];

          // 从YAML中提取代理信息
          const titleMatch = yaml.match(/title:\s*(.+)/);
          const iconMatch = yaml.match(/icon:\s*(.+)/);
          const whenToUseMatch = yaml.match(/whenToUse:\s*"(.+)"/);
          const roleDefinitionMatch = yaml.match(/roleDefinition:\s*"(.+)"/);

          const title = titleMatch ? titleMatch[1].trim() : await this.getAgentTitle(agentId, installDir);
          const icon = iconMatch ? iconMatch[1].trim() : "🤖";
          const whenToUse = whenToUseMatch ? whenToUseMatch[1].trim() : `用于${title}任务`;
          const roleDefinition = roleDefinitionMatch
            ? roleDefinitionMatch[1].trim()
            : `您是专注于${title.toLowerCase()}任务和职责的${title}专家。`;

          // 构建模式条目并进行适当的格式化（匹配精确的缩进）
          // 避免对于已经有“bmad-”前缀的代理再次添加前缀
          const slug = agentId.startsWith('bmad-') ? agentId : `bmad-${agentId}`;
          newModesContent += ` - slug: ${slug}\n`;
          newModesContent += `   name: '${icon} ${title}'\n`;
          newModesContent += `   roleDefinition: ${roleDefinition}\n`;
          newModesContent += `   whenToUse: ${whenToUse}\n`;
          // 获取从installDir到代理文件的相对路径
          const relativePath = path.relative(installDir, agentPath).replace(/\\/g, '/');
          newModesContent += `   customInstructions: 重要提示 阅读 ${relativePath} 中的完整YAML，开始激活以改变您的存在状态，遵循启动部分说明，在此状态下直到被告知退出此模式\n`;
          newModesContent += `   groups:\n`;
          newModesContent += `    - read\n`;

          // 根据代理类型添加权限
          const permissions = agentPermissions[agentId];
          if (permissions) {
            newModesContent += `    - - edit\n`;
            newModesContent += `      - fileRegex: ${permissions.fileRegex}\n`;
            newModesContent += `        description: ${permissions.description}\n`;
          } else {
            newModesContent += `    - edit\n`;
          }

          console.log(chalk.green(`✓ 已添加模式: bmad-${agentId} (${icon} ${title})`));
        }
      }
    }

    // 构建最终的roomodes内容
    let roomodesContent = "";
    if (existingContent) {
      // 如果存在现有内容，则将新模式追加到其后
      roomodesContent = existingContent.trim() + "\n" + newModesContent;
    } else {
      // 创建具有正确YAML结构的新.roomodes文件
      roomodesContent = "customModes:\n" + newModesContent;
    }

    // 写入.roomodes文件
    await fileManager.writeFile(roomodesPath, roomodesContent);
    console.log(chalk.green("✓ 已在项目根目录中创建.roomodes文件"));

    console.log(chalk.green(`\n✓ Roo Code设置完成!`));
    console.log(chalk.dim("当您在Roo Code中打开此项目时，自定义模式将可用"));

    return true;
  }

  async setupCline(installDir, selectedAgent) {
    const clineRulesDir = path.join(installDir, ".clinerules");
    const agents = selectedAgent ? [selectedAgent] : await this.getAllAgentIds(installDir);

    await fileManager.ensureDirectory(clineRulesDir);

    // 从配置中加载动态代理排序
    const config = await this.loadIdeAgentConfig();
    const agentOrder = config['cline-order'] || {};

    for (const agentId of agents) {
      // 查找代理文件
      const agentPath = await this.findAgentPath(agentId, installDir);

      if (agentPath) {
        const agentContent = await fileManager.readFile(agentPath);

        // 获取用于排序的数字前缀
        const order = agentOrder[agentId] || 99;
        const prefix = order.toString().padStart(2, '0');
        const mdPath = path.join(clineRulesDir, `${prefix}-${agentId}.md`);

        // 为Cline创建MD内容（侧重于项目标准和角色）
        let mdContent = `# ${await this.getAgentTitle(agentId, installDir)} 代理\n\n`;
        mdContent += `此规则定义了 ${await this.getAgentTitle(agentId, installDir)} 角色和项目标准。\n\n`;
        mdContent += "## 角色定义\n\n";
        mdContent +=
          "当用户输入 `@" + agentId + "` 时，采用此角色并遵循以下指南:\n\n";
        mdContent += "```yaml\n";
        // 从代理文件中提取YAML内容
        const yamlContent = extractYamlFromAgent(agentContent);
        if (yamlContent) {
          mdContent += yamlContent;
        } else {
          // 如果未找到YAML，则包含除头信息外的所有内容
          mdContent += agentContent.replace(/^#.*$/m, "").trim();
        }
        mdContent += "\n```\n\n";
        mdContent += "## 项目标准\n\n";
        mdContent += `- 始终与.bmad-core/中的项目文档保持一致\n`;
        mdContent += `- 遵循代理的特定指南和约束\n`;
        mdContent += `- 更改时更新相关的项目文件\n`;
        const relativePath = path.relative(installDir, agentPath).replace(/\\/g, '/');
        mdContent += `- 参考 [${relativePath}](${relativePath}) 中的完整代理定义\n\n`;
        mdContent += "## 用法\n\n";
        mdContent += `输入 \`@${agentId}\` 以激活此 ${await this.getAgentTitle(agentId, installDir)} 角色。\n`;

        await fileManager.writeFile(mdPath, mdContent);
        console.log(chalk.green(`✓ 已创建规则: ${prefix}-${agentId}.md`));
      }
    }

    console.log(chalk.green(`\n✓ 已在 ${clineRulesDir} 中创建Cline规则`));

    return true;
  }

  async setupGeminiCli(installDir) {
    const geminiDir = path.join(installDir, ".gemini");
    const bmadMethodDir = path.join(geminiDir, "bmad-method");
    await fileManager.ensureDirectory(bmadMethodDir);

    // 更新现有settings.json的逻辑
    const settingsPath = path.join(geminiDir, "settings.json");
    if (await fileManager.pathExists(settingsPath)) {
      try {
        const settingsContent = await fileManager.readFile(settingsPath);
        const settings = JSON.parse(settingsContent);
        let updated = false;
        
        // 处理contextFileName属性
        if (settings.contextFileName && Array.isArray(settings.contextFileName)) {
          const originalLength = settings.contextFileName.length;
          settings.contextFileName = settings.contextFileName.filter(
            (fileName) => !fileName.startsWith("agents/")
          );
          if (settings.contextFileName.length !== originalLength) {
            updated = true;
          }
        }
        
        if (updated) {
          await fileManager.writeFile(
            settingsPath,
            JSON.stringify(settings, null, 2)
          );
          console.log(chalk.green("✓ 已更新.gemini/settings.json - 移除了代理文件引用"));
        }
      } catch (error) {
        console.warn(
          chalk.yellow("无法更新.gemini/settings.json"),
          error
        );
      }
    }

    // 移除旧的agents目录
    const agentsDir = path.join(geminiDir, "agents");
    if (await fileManager.pathExists(agentsDir)) {
      await fileManager.removeDirectory(agentsDir);
      console.log(chalk.green("✓ 已移除旧的.gemini/agents目录"));
    }

    // 获取所有可用代理
    const agents = await this.getAllAgentIds(installDir);
    let concatenatedContent = "";

    for (const agentId of agents) {
      // 查找源代理文件
      const agentPath = await this.findAgentPath(agentId, installDir);

      if (agentPath) {
        const agentContent = await fileManager.readFile(agentPath);
        
        // 创建格式正确的代理规则内容（类似于Trae）
        let agentRuleContent = `# ${agentId.toUpperCase()} 代理规则\n\n`;
        agentRuleContent += `当用户输入 \`*${agentId}\` 并激活 ${await this.getAgentTitle(
          agentId,
          installDir
        )} 代理角色时，此规则将被触发。\n\n`;
        agentRuleContent += "## 代理激活\n\n";
        agentRuleContent +=
          "重要提示: 阅读完整的YAML，开始激活以改变您的存在状态，遵循启动部分说明，在此状态下直到被告知退出此模式:\n\n";
        agentRuleContent += "```yaml\n";
        // 从代理文件中提取YAML内容
        const yamlContent = extractYamlFromAgent(agentContent);
        if (yamlContent) {
          agentRuleContent += yamlContent;
        }
        else {
          // 如果未找到YAML，则包含除头信息外的所有内容
          agentRuleContent += agentContent.replace(/^#.*$/m, "").trim();
        }
        agentRuleContent += "\n```\n\n";
        agentRuleContent += "## 文件引用\n\n";
        const relativePath = path.relative(installDir, agentPath).replace(/\\/g, '/');
        agentRuleContent += `完整的代理定义可在 [${relativePath}](${relativePath}) 中找到。\n\n`;
        agentRuleContent += "## 用法\n\n";
        agentRuleContent += `当用户输入 \`*${agentId}\` 时，激活此 ${await this.getAgentTitle(
          agentId,
          installDir
        )} 角色并遵循上述YAML配置中定义的所有说明。\n`;
        
        // 添加到连接内容中，并用分隔符分隔
        concatenatedContent += agentRuleContent + "\n\n---\n\n";
        console.log(chalk.green(`✓ 已添加 ${agentId} 的上下文`));
      }
    }

    // 将连接内容写入GEMINI.md
    const geminiMdPath = path.join(bmadMethodDir, "GEMINI.md");
    await fileManager.writeFile(geminiMdPath, concatenatedContent);
    console.log(chalk.green(`\n✓ 已在 ${bmadMethodDir} 中创建GEMINI.md`));

    return true;
  }

  async setupGitHubCopilot(installDir, selectedAgent, spinner = null, preConfiguredSettings = null) {
    // 首先配置VS Code工作区设置，以避免与加载微调器发生UI冲突
    await this.configureVsCodeSettings(installDir, spinner, preConfiguredSettings);
    
    const chatmodesDir = path.join(installDir, ".github", "chatmodes");
    const agents = selectedAgent ? [selectedAgent] : await this.getAllAgentIds(installDir);
     
    await fileManager.ensureDirectory(chatmodesDir);

    for (const agentId of agents) {
      // 查找代理文件
      const agentPath = await this.findAgentPath(agentId, installDir);
      const chatmodePath = path.join(chatmodesDir, `${agentId}.chatmode.md`);

      if (agentPath) {
        // 创建带有代理内容的聊天模式文件
        const agentContent = await fileManager.readFile(agentPath);
        const agentTitle = await this.getAgentTitle(agentId, installDir);
        
        // 提取whenToUse作为描述
        const yamlMatch = agentContent.match(/```ya?ml\r?\n([\s\S]*?)```/);
        let description = `激活 ${agentTitle} 代理角色。`;
        if (yamlMatch) {
          const whenToUseMatch = yamlMatch[1].match(/whenToUse:\s*"(.*?)"/);
          if (whenToUseMatch && whenToUseMatch[1]) {
            description = whenToUseMatch[1];
          }
        }
        
        let chatmodeContent = `---
description: "${description.replace(/"/g, '\\"')}"
tools: ['changes', 'codebase', 'fetch', 'findTestFiles', 'githubRepo', 'problems', 'usages', 'editFiles', 'runCommands', 'runTasks', 'runTests', 'search', 'searchResults', 'terminalLastCommand', 'terminalSelection', 'testFailure']
---

`;
        chatmodeContent += agentContent;

        await fileManager.writeFile(chatmodePath, chatmodeContent);
        console.log(chalk.green(`✓ 已创建聊天模式: ${agentId}.chatmode.md`));
      }
    }

    console.log(chalk.green(`\n✓ Github Copilot设置完成!`));
    console.log(chalk.dim(`您现在可以在聊天视图的模式选择器中找到BMad代理。`));

    return true;
  }

  async configureVsCodeSettings(installDir, spinner, preConfiguredSettings = null) {
    const vscodeDir = path.join(installDir, ".vscode");
    const settingsPath = path.join(vscodeDir, "settings.json");
    
    await fileManager.ensureDirectory(vscodeDir);
    
    // 读取现有设置（如果存在）
    let existingSettings = {};
    if (await fileManager.pathExists(settingsPath)) {
      try {
        const existingContent = await fileManager.readFile(settingsPath);
        existingSettings = JSON.parse(existingContent);
        console.log(chalk.yellow("找到现有.vscode/settings.json。正在合并BMad设置..."));
      } catch (error) {
        console.warn(chalk.yellow("无法解析现有settings.json。正在创建新文件。"));
        existingSettings = {};
      }
    }
    
    // 如果提供了预配置设置，则使用；否则提示
    let configChoice;
    if (preConfiguredSettings && preConfiguredSettings.configChoice) {
      configChoice = preConfiguredSettings.configChoice;
      console.log(chalk.dim(`正在使用预配置的GitHub Copilot设置: ${configChoice}`));
    } else {
      // 清除任何先前的输出并添加间距以避免与加载器冲突
      console.log('\n'.repeat(2));
      console.log(chalk.blue("🔧 Github Copilot代理设置配置"));
      console.log(chalk.dim("BMad的最佳工作方式是使用特定的VS Code设置，以获得最佳代理体验。"));
      console.log(''); // 添加额外间距
      
      const response = await inquirer.prompt([
        {
          type: 'list',
          name: 'configChoice',
          message: chalk.yellow('您希望如何配置GitHub Copilot设置？'),
          choices: [
            {
              name: '使用推荐的默认值（最快设置）',
              value: 'defaults'
            },
            {
              name: '手动配置每个设置（根据您的偏好自定义）',
              value: 'manual'
            },
            {
              name: '跳过设置配置（我稍后会手动配置）',
              value: 'skip'
            }
          ],
          default: 'defaults'
        }
      ]);
      configChoice = response.configChoice;
    }
    
    let bmadSettings = {};
    
    if (configChoice === 'skip') {
      console.log(chalk.yellow("⚠️  正在跳过VS Code设置配置。"));
      console.log(chalk.dim("您可以手动在.vscode/settings.json中配置这些设置:"));
      console.log(chalk.dim("  • chat.agent.enabled: true"));
      console.log(chalk.dim("  • chat.agent.maxRequests: 15"));
      console.log(chalk.dim("  • github.copilot.chat.agent.runTasks: true"));
      console.log(chalk.dim("  • chat.mcp.discovery.enabled: true"));
      console.log(chalk.dim("  • github.copilot.chat.agent.autoFix: true"));
      console.log(chalk.dim("  • chat.tools.autoApprove: false"));
      return true;
    }
    
    if (configChoice === 'defaults') {
      // 使用推荐的默认值
      bmadSettings = {
        "chat.agent.enabled": true,
        "chat.agent.maxRequests": 15,
        "github.copilot.chat.agent.runTasks": true,
        "chat.mcp.discovery.enabled": true,
        "github.copilot.chat.agent.autoFix": true,
        "chat.tools.autoApprove": false
      };
      console.log(chalk.green("✓ 正在使用GitHub Copilot设置的推荐BMad默认值"));
    } else {
      // 手动配置
      console.log(chalk.blue("\n📋 让我们为您的偏好配置每个设置:"));
      
      // 在手动配置提示期间暂停微调器
      let spinnerWasActive = false;
      if (spinner && spinner.isSpinning) {
        spinner.stop();
        spinnerWasActive = true;
      }
      
      const manualSettings = await inquirer.prompt([
        {
          type: 'input',
          name: 'maxRequests',
          message: '每个代理会话的最大请求数（推荐: 15）？',
          default: '15',
          validate: (input) => {
            const num = parseInt(input);
            if (isNaN(num) || num < 1 || num > 50) {
              return '请输入1到50之间的数字';
            }
            return true;
          }
        },
        {
          type: 'confirm',
          name: 'runTasks',
          message: '允许代理运行工作区任务（package.json脚本等）？',
          default: true
        },
        {
          type: 'confirm',
          name: 'mcpDiscovery',
          message: '启用MCP（模型上下文协议）服务器发现？',
          default: true
        },
        {
          type: 'confirm',
          name: 'autoFix',
          message: '在生成的代码中启用自动错误检测和修复？',
          default: true
        },
        {
          type: 'confirm',
          name: 'autoApprove',
          message: '未经确认自动批准所有工具？（⚠️ 实验性 - 安全性较低）',
          default: false
        }
      ]);

      // 如果微调器在提示之前处于活动状态，则重新启动
      if (spinner && spinnerWasActive) {
        spinner.start();
      }
      
      bmadSettings = {
        "chat.agent.enabled": true, // 始终启用 - BMad代理必需
        "chat.agent.maxRequests": parseInt(manualSettings.maxRequests),
        "github.copilot.chat.agent.runTasks": manualSettings.runTasks,
        "chat.mcp.discovery.enabled": manualSettings.mcpDiscovery,
        "github.copilot.chat.agent.autoFix": manualSettings.autoFix,
        "chat.tools.autoApprove": manualSettings.autoApprove
      };
      
      console.log(chalk.green("✓ 自定义设置已配置"));
    }
    
    // 合并设置（现有设置优先，以避免覆盖用户偏好）
    const mergedSettings = { ...bmadSettings, ...existingSettings };
    
    // 写入更新后的设置
    await fileManager.writeFile(settingsPath, JSON.stringify(mergedSettings, null, 2));
    
    console.log(chalk.green("✓ VS Code工作区设置配置成功"));
    console.log(chalk.dim("  设置已写入.vscode/settings.json:"));
    Object.entries(bmadSettings).forEach(([key, value]) => {
      console.log(chalk.dim(`  • ${key}: ${value}`));
    });
    console.log(chalk.dim(""));
    console.log(chalk.dim("您可以随时在.vscode/settings.json中修改这些设置"));
  }
}

module.exports = new IdeSetup();
