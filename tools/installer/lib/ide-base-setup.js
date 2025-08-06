/**
 * IDE基础设置 - 所有IDE设置的通用功能
 * 减少重复代码并提供共享方法。
 *
 * 此模块负责处理与IDE集成相关的通用逻辑，
 * 包括代理ID的获取、代理路径的查找、代理标题的提取，
 * 以及处理扩展包的安装和代理规则内容的创建。
 * 它还提供了缓存机制来优化性能。
 */

const path = require("path");
const fs = require("fs-extra");
const yaml = require("js-yaml");
const chalk = require("chalk");
const fileManager = require("./file-manager");
const resourceLocator = require("./resource-locator");
const { extractYamlFromAgent } = require("../../lib/yaml-utils");

class BaseIdeSetup {
  constructor() {
    this._agentCache = new Map();
    this._pathCache = new Map();
  }

  /**
   * 获取所有代理ID（带缓存）
   */
  async getAllAgentIds(installDir) {
    const cacheKey = `all-agents:${installDir}`;
    if (this._agentCache.has(cacheKey)) {
      return this._agentCache.get(cacheKey);
    }

    const allAgents = new Set();
    
    // 获取核心代理
    const coreAgents = await this.getCoreAgentIds(installDir);
    coreAgents.forEach(id => allAgents.add(id));
    
    // 获取扩展包代理
    const expansionPacks = await this.getInstalledExpansionPacks(installDir);
    for (const pack of expansionPacks) {
      const packAgents = await this.getExpansionPackAgents(pack.path);
      packAgents.forEach(id => allAgents.add(id));
    }
    
    const result = Array.from(allAgents);
    this._agentCache.set(cacheKey, result);
    return result;
  }

  /**
   * 获取核心代理ID
   */
  async getCoreAgentIds(installDir) {
    const coreAgents = [];
    const corePaths = [
      path.join(installDir, ".bmad-core", "agents"),
      path.join(installDir, "bmad-core", "agents")
    ];

    for (const agentsDir of corePaths) {
      if (await fileManager.pathExists(agentsDir)) {
        const files = await resourceLocator.findFiles("*.md", { cwd: agentsDir });
        coreAgents.push(...files.map(file => path.basename(file, ".md")));
        break; // 使用第一个找到的
      }
    }

    return coreAgents;
  }

  /**
   * 查找代理路径（带缓存）
   */
  async findAgentPath(agentId, installDir) {
    const cacheKey = `agent-path:${agentId}:${installDir}`;
    if (this._pathCache.has(cacheKey)) {
      return this._pathCache.get(cacheKey);
    }

    // 使用资源定位器高效查找路径
    let agentPath = await resourceLocator.getAgentPath(agentId);
    
    if (!agentPath) {
      // 检查特定安装路径
      const possiblePaths = [
        path.join(installDir, ".bmad-core", "agents", `${agentId}.md`),
        path.join(installDir, "bmad-core", "agents", `${agentId}.md`),
        path.join(installDir, "common", "agents", `${agentId}.md`)
      ];

      for (const testPath of possiblePaths) {
        if (await fileManager.pathExists(testPath)) {
          agentPath = testPath;
          break;
        }
      }
    }

    if (agentPath) {
      this._pathCache.set(cacheKey, agentPath);
    }
    return agentPath;
  }

  /**
   * 从元数据中获取代理标题
   */
  async getAgentTitle(agentId, installDir) {
    const agentPath = await this.findAgentPath(agentId, installDir);
    if (!agentPath) return agentId;

    try {
      const content = await fileManager.readFile(agentPath);
      const yamlContent = extractYamlFromAgent(content);
      if (yamlContent) {
        const metadata = yaml.load(yamlContent);
        return metadata.agent_name || agentId;
      }
    } catch (error) {
      // 出现错误时回退到代理ID
    }
    return agentId;
  }

  /**
   * 获取已安装的扩展包
   */
  async getInstalledExpansionPacks(installDir) {
    const cacheKey = `expansion-packs:${installDir}`;
    if (this._pathCache.has(cacheKey)) {
      return this._pathCache.get(cacheKey);
    }

    const expansionPacks = [];
    
    // 检查带点前缀的扩展包
    const dotExpansions = await resourceLocator.findFiles(".bmad-*", { cwd: installDir });
    
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
    
    // 检查其他带有config.yaml的带点文件夹
    const allDotFolders = await resourceLocator.findFiles(".*", { cwd: installDir });
    for (const folder of allDotFolders) {
      if (!folder.startsWith(".bmad-") && folder !== ".bmad-core") {
        const packPath = path.join(installDir, folder);
        const configPath = path.join(packPath, "config.yaml");
        if (await fileManager.pathExists(configPath)) {
          expansionPacks.push({
            name: folder.substring(1), // 移除点
            path: packPath
          });
        }
      }
    }

    this._pathCache.set(cacheKey, expansionPacks);
    return expansionPacks;
  }

  /**
   * 获取扩展包代理
   */
  async getExpansionPackAgents(packPath) {
    const agentsDir = path.join(packPath, "agents");
    if (!(await fileManager.pathExists(agentsDir))) {
      return [];
    }
    
    const agentFiles = await resourceLocator.findFiles("*.md", { cwd: agentsDir });
    return agentFiles.map(file => path.basename(file, ".md"));
  }

  /**
   * 创建代理规则内容 (共享逻辑)
   */
  async createAgentRuleContent(agentId, agentPath, installDir, format = 'mdc') {
    const agentContent = await fileManager.readFile(agentPath);
    const agentTitle = await this.getAgentTitle(agentId, installDir);
    const yamlContent = extractYamlFromAgent(agentContent);
    
    let content = "";
    
    if (format === 'mdc') {
      // Cursor的MDC格式
      content = "---\n";
      content += "description: \n";
      content += "globs: []\n";
      content += "alwaysApply: false\n";
      content += "---\n\n";
      content += `# ${agentId.toUpperCase()} 代理规则\n\n`;
      content += `当用户输入 \`@${agentId}\` 时，此规则将被触发，并激活 ${agentTitle} 代理角色。\n\n`;
      content += "## 代理激活\n\n";
      content += "重要提示: 阅读完整的YAML，开始激活以改变您的存在状态，遵循启动部分说明，在此状态下直到被告知退出此模式:\n\n";
      content += "```yaml\n";
      content += yamlContent || agentContent.replace(/^#.*$/m, "").trim();
      content += "\n```\n\n";
      content += "## 文件引用\n\n";
      const relativePath = path.relative(installDir, agentPath).replace(/\\/g, '/');
      content += `完整的代理定义可在 [${relativePath}](mdc:${relativePath}) 中找到。\n\n`;
      content += "## 用法\n\n";
      content += `当用户输入 \`@${agentId}\` 时，激活此 ${agentTitle} 角色并遵循上述YAML配置中定义的所有说明。\n`;
    } else if (format === 'claude') {
      // Claude Code格式
      content = `# /${agentId} 命令\n\n`;
      content += `使用此命令时，采用以下代理角色:\n\n`;
      content += agentContent;
    }
    
    return content;
  }

  /**
   * 清除所有缓存
   */
  clearCache() {
    this._agentCache.clear();
    this._pathCache.clear();
  }
}

module.exports = BaseIdeSetup;