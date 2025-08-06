/**
 * 安装器 - 负责BMad Method的安装、更新和管理
 *
 * 此模块提供了一系列功能，用于处理BMad Method在用户系统上的生命周期，
 * 包括：
 * - 检测现有安装状态（全新安装、V3/V4升级、未知安装）
 * - 执行全新安装，支持完整安装、单个代理安装和团队安装
 * - 处理V4版本的更新和修复
 * - 引导用户从V3版本升级到V4版本
 * - 管理扩展包的安装和更新
 * - 配置与各种IDE（如Cursor, Claude Code, Github Copilot等）的集成
 * - 生成并维护安装清单
 * - 提供Web Bundle的安装支持
 * - 显示安装状态和可用代理/扩展包列表
 */

const path = require("node:path");
const fs = require("fs-extra");
const chalk = require("chalk");
const ora = require("ora");
const inquirer = require("inquirer");
const fileManager = require("./file-manager");
const configLoader = require("./config-loader");
const ideSetup = require("./ide-setup");
const { extractYamlFromAgent } = require("../../lib/yaml-utils");
const resourceLocator = require("./resource-locator");

class Installer {
  async getCoreVersion() {
    try {
      // 始终使用package.json版本
      const packagePath = path.join(__dirname, '..', '..', '..', 'package.json');
      const packageJson = require(packagePath);
      return packageJson.version;
    } catch (error) {
      console.warn("无法从package.json读取版本，使用'unknown'");
      return "unknown";
    }
  }

  async install(config) {
    const spinner = ora("正在分析安装目录...").start();
    
    try {
      // 存储npx执行时的原始CWD
      const originalCwd = process.env.INIT_CWD || process.env.PWD || process.cwd();
      
      // 解析相对于用户运行命令的安装目录
      let installDir = path.isAbsolute(config.directory) 
        ? config.directory 
        : path.resolve(originalCwd, config.directory);
        
      if (path.basename(installDir) === '.bmad-core') {
        // 如果用户直接指向.bmad-core，则将其父目录视为项目根目录
        installDir = path.dirname(installDir);
      }
      
      // 为了清晰起见，记录解析后的路径
      if (!path.isAbsolute(config.directory)) {
        spinner.text = `正在将 "${config.directory}" 解析为: ${installDir}`;
      }

      // 检查目录是否存在并处理不存在的目录
      if (!(await fileManager.pathExists(installDir))) {
        spinner.stop();
        console.log(`\n目录 ${installDir} 不存在。`);
        
        const { action } = await inquirer.prompt([
          {
            type: 'list',
            name: 'action',
            message: '您想做什么？',
            choices: [
              {
                name: '创建目录并继续',
                value: 'create'
              },
              {
                name: '选择不同的目录',
                value: 'change'
              },
              {
                name: '取消安装',
                value: 'cancel'
              }
            ]
          }
        ]);

        if (action === 'cancel') {
            console.log('安装已取消。');
          process.exit(0);
        } else if (action === 'change') {
          const { newDirectory } = await inquirer.prompt([
            {
              type: 'input',
              name: 'newDirectory',
              message: '请输入新目录路径:',
              validate: (input) => {
                if (!input.trim()) {
                  return '请输入有效的目录路径';
                }
                return true;
              }
            }
          ]);
          // 保留原始CWD以便递归调用
          config.directory = newDirectory;
          return await this.install(config); // 递归调用新目录
        } else if (action === 'create') {
          try {
            await fileManager.ensureDirectory(installDir);
            console.log(`✓ 已创建目录: ${installDir}`);
          } catch (error) {
            console.error(`创建目录失败: ${error.message}`);
            console.error('您可能需要检查权限或使用其他路径。');
            process.exit(1);
          }
        }
        
        spinner.start("正在分析安装目录...");
      }

      // 如果这是早期检测的更新请求，则直接处理
      if (config.installType === 'update') {
        const state = await this.detectInstallationState(installDir);
        if (state.type === 'v4_existing') {
          return await this.performUpdate(config, installDir, state.manifest, spinner);
        } else {
          spinner.fail('未找到现有v4安装进行更新');
          throw new Error('未找到现有v4安装');
        }
      }

      // 检测当前状态
      const state = await this.detectInstallationState(installDir);

      // 处理不同状态
      switch (state.type) {
        case "clean":
          return await this.performFreshInstall(config, installDir, spinner);

        case "v4_existing":
          return await this.handleExistingV4Installation(
            config,
            installDir,
            state,
            spinner
          );

        case "v3_existing":
          return await this.handleV3Installation(
            config,
            installDir,
            state,
            spinner
          );

        case "unknown_existing":
          return await this.handleUnknownInstallation(
            config,
            installDir,
            state,
            spinner
          );
      }
    } catch (error) {
      // 检查模块是否已初始化
      if (spinner) {
        spinner.fail("安装失败");
      } else {
        console.error("安装失败:", error.message);
      }
      throw error;
    }
  }

  async detectInstallationState(installDir) {
    const state = {
      type: "clean",
      hasV4Manifest: false,
      hasV3Structure: false,
      hasBmadCore: false,
      hasOtherFiles: false,
      manifest: null,
      expansionPacks: {},
    };

    // 检查目录是否存在
    if (!(await fileManager.pathExists(installDir))) {
      return state; // 全新安装
    }

    // 检查V4安装（包含.bmad-core和清单文件）
    const bmadCorePath = path.join(installDir, ".bmad-core");
    const manifestPath = path.join(bmadCorePath, "install-manifest.yaml");

    if (await fileManager.pathExists(manifestPath)) {
      state.type = "v4_existing";
      state.hasV4Manifest = true;
      state.hasBmadCore = true;
      state.manifest = await fileManager.readManifest(installDir);
      return state;
    }

    // 检查V3安装（包含bmad-agent目录）
    const bmadAgentPath = path.join(installDir, "bmad-agent");
    if (await fileManager.pathExists(bmadAgentPath)) {
      state.type = "v3_existing";
      state.hasV3Structure = true;
      return state;
    }

    // 检查不带清单的.bmad-core（损坏的V4或手动复制）
    if (await fileManager.pathExists(bmadCorePath)) {
      state.type = "unknown_existing";
      state.hasBmadCore = true;
      return state;
    }

    // 检查目录是否包含其他文件
    const files = await resourceLocator.findFiles("**/*", {
      cwd: installDir,
      nodir: true,
      ignore: ["**/.git/**", "**/node_modules/**"],
    });

    if (files.length > 0) {
      // 目录包含其他文件，但没有BMad安装。
      // 视为全新安装，但记录它不为空。
      state.hasOtherFiles = true;
    }

    // 检查扩展包（以点开头的文件夹）
    const expansionPacks = await this.detectExpansionPacks(installDir);
    state.expansionPacks = expansionPacks;

    return state; // 全新安装
  }

  async performFreshInstall(config, installDir, spinner, options = {}) {
    spinner.text = "正在安装BMad Method...";

    let files = [];

    if (config.installType === "full") {
      // 完整安装 - 将整个.bmad-core文件夹复制为子目录
      spinner.text = "正在复制完整的.bmad-core文件夹...";
      const sourceDir = resourceLocator.getBmadCorePath();
      const bmadCoreDestDir = path.join(installDir, ".bmad-core");
      await fileManager.copyDirectoryWithRootReplacement(sourceDir, bmadCoreDestDir, ".bmad-core");
      
      // 将common/项复制到.bmad-core
      spinner.text = "正在复制通用工具...";
      await this.copyCommonItems(installDir, ".bmad-core", spinner);

      // 获取清单的所有文件列表
      const foundFiles = await resourceLocator.findFiles("**/*", {
        cwd: bmadCoreDestDir,
        nodir: true,
        ignore: ["**/.git/**", "**/node_modules/**"],
      });
      files = foundFiles.map((file) => path.join(".bmad-core", file));
    } else if (config.installType === "single-agent") {
      // 单个代理安装
      spinner.text = `正在安装 ${config.agent} 代理...`;

      // 复制代理文件并替换{root}
      const agentPath = configLoader.getAgentPath(config.agent);
      const destAgentPath = path.join(
        installDir,
        ".bmad-core",
        "agents",
        `${config.agent}.md`
      );
      await fileManager.copyFileWithRootReplacement(agentPath, destAgentPath, ".bmad-core");
      files.push(`.bmad-core/agents/${config.agent}.md`);

      // 复制依赖项
      const { all: dependencies } = await resourceLocator.getAgentDependencies(
        config.agent
      );
      const sourceBase = resourceLocator.getBmadCorePath();

      for (const dep of dependencies) {
        spinner.text = `正在复制依赖项: ${dep}`;

        if (dep.includes("*")) {
          // 处理带有{root}替换的glob模式
          const copiedFiles = await fileManager.copyGlobPattern(
            dep.replace(".bmad-core/", ""),
            sourceBase,
            path.join(installDir, ".bmad-core"),
            ".bmad-core"
          );
          files.push(...copiedFiles.map(f => `.bmad-core/${f}`));
        } else {
          // 处理单个文件，如果需要则替换{root}
          const sourcePath = path.join(
            sourceBase,
            dep.replace(".bmad-core/", "")
          );
          const destPath = path.join(
            installDir,
            dep
          );

          const needsRootReplacement = dep.endsWith('.md') || dep.endsWith('.yaml') || dep.endsWith('.yml');
          let success = false;
          
          if (needsRootReplacement) {
            success = await fileManager.copyFileWithRootReplacement(sourcePath, destPath, ".bmad-core");
          } else {
            success = await fileManager.copyFile(sourcePath, destPath);
          }

          if (success) {
            files.push(dep);
          }
        }
      }
      
      // 将common/项复制到.bmad-core
      spinner.text = "正在复制通用工具...";
      const commonFiles = await this.copyCommonItems(installDir, ".bmad-core", spinner);
      files.push(...commonFiles);
    } else if (config.installType === "team") {
      // 团队安装
      spinner.text = `正在安装 ${config.team} 团队...`;
      
      // 获取团队依赖项
      const teamDependencies = await configLoader.getTeamDependencies(config.team);
      const sourceBase = resourceLocator.getBmadCorePath();
      
      // 安装所有团队依赖项
      for (const dep of teamDependencies) {
        spinner.text = `正在复制团队依赖项: ${dep}`;
        
        if (dep.includes("*")) {
          // 处理带有{root}替换的glob模式
          const copiedFiles = await fileManager.copyGlobPattern(
            dep.replace(".bmad-core/", ""),
            sourceBase,
            path.join(installDir, ".bmad-core"),
            ".bmad-core"
          );
          files.push(...copiedFiles.map(f => `.bmad-core/${f}`));
        } else {
          // 处理单个文件，如果需要则替换{root}
          const sourcePath = path.join(sourceBase, dep.replace(".bmad-core/", ""));
          const destPath = path.join(installDir, dep);
          
          const needsRootReplacement = dep.endsWith('.md') || dep.endsWith('.yaml') || dep.endsWith('.yml');
          let success = false;
          
          if (needsRootReplacement) {
            success = await fileManager.copyFileWithRootReplacement(sourcePath, destPath, ".bmad-core");
          } else {
            success = await fileManager.copyFile(sourcePath, destPath);
          }

          if (success) {
            files.push(dep);
          }
        }
      }
      
      // 将common/项复制到.bmad-core
      spinner.text = "正在复制通用工具...";
      const commonFiles = await this.copyCommonItems(installDir, ".bmad-core", spinner);
      files.push(...commonFiles);
    } else if (config.installType === "expansion-only") {
      // 仅扩展包安装 - 不创建.bmad-core
      // 仅安装扩展包
      spinner.text = "正在安装仅扩展包...";
    }

    // 如果请求，则安装扩展包
    const expansionFiles = await this.installExpansionPacks(installDir, config.expansionPacks, spinner, config);
    files.push(...expansionFiles);

    // 如果请求，则安装Web Bundle
    if (config.includeWebBundles && config.webBundlesDirectory) {
      spinner.text = "正在安装Web Bundle...";
      // 使用与主安装目录相同的逻辑解析Web Bundle目录
      const originalCwd = process.env.INIT_CWD || process.env.PWD || process.cwd();
      let resolvedWebBundlesDir = path.isAbsolute(config.webBundlesDirectory) 
        ? config.webBundlesDirectory 
        : path.resolve(originalCwd, config.webBundlesDirectory);
      await this.installWebBundles(resolvedWebBundlesDir, config, spinner);
    }

    // 如果提供了分片偏好，则修改core-config.yaml
    if (config.installType !== "expansion-only" && (config.prdSharded !== undefined || config.architectureSharded !== undefined)) {
      spinner.text = "正在配置文档分片设置...";
      await fileManager.modifyCoreConfig(installDir, config);
    }

    // 创建清单（跳过仅扩展包安装）
    if (config.installType !== "expansion-only") {
      spinner.text = "正在创建安装清单...";
      await fileManager.createManifest(installDir, config, files);
    }

    spinner.succeed("安装完成！");
    this.showSuccessMessage(config, installDir, options);
  }

  async handleExistingV4Installation(config, installDir, state, spinner) {
    spinner.stop();

    const currentVersion = state.manifest.version;
    const newVersion = await this.getCoreVersion();
    const versionCompare = this.compareVersions(currentVersion, newVersion);

    console.log(chalk.yellow("\n🔍 找到现有BMad v4安装"));
    console.log(`   目录: ${installDir}`);
    console.log(`   当前版本: ${currentVersion}`);
    console.log(`   可用版本: ${newVersion}`);
    console.log(
      `   安装日期: ${new Date(
        state.manifest.installed_at
      ).toLocaleDateString()}`
    );

    // 检查文件完整性
    spinner.start("正在检查安装完整性...");
    const integrity = await fileManager.checkFileIntegrity(installDir, state.manifest);
    spinner.stop();
    
    const hasMissingFiles = integrity.missing.length > 0;
    const hasModifiedFiles = integrity.modified.length > 0;
    const hasIntegrityIssues = hasMissingFiles || hasModifiedFiles;
    
    if (hasIntegrityIssues) {
        console.log(chalk.red("\n⚠️  检测到安装问题:"));
      if (hasMissingFiles) {
        console.log(chalk.red(`   缺失文件: ${integrity.missing.length}`));
        if (integrity.missing.length <= 5) {
          integrity.missing.forEach(file => console.log(chalk.dim(`     - ${file}`)));
        }
      }
      if (hasModifiedFiles) {
        console.log(chalk.yellow(`   修改文件: ${integrity.modified.length}`));
        if (integrity.modified.length <= 5) {
          integrity.modified.forEach(file => console.log(chalk.dim(`     - ${file}`)));
        }
      }
    }

    // 显示现有扩展包
    if (Object.keys(state.expansionPacks).length > 0) {
      console.log(chalk.cyan("\n📦 已安装的扩展包:"));
      for (const [packId, packInfo] of Object.entries(state.expansionPacks)) {
        if (packInfo.hasManifest && packInfo.manifest) {
          console.log(`   - ${packId} (v${packInfo.manifest.version || 'unknown'})`);
        } else {
          console.log(`   - ${packId} (无清单)`);
        }
      }
    }

    let choices = [];
    
    if (versionCompare < 0) {
        console.log(chalk.cyan("\n⬆️  BMad核心有可用升级"));
      choices.push({ name: `升级BMad核心 (v${currentVersion} → v${newVersion})`, value: "upgrade" });
    } else if (versionCompare === 0) {
      if (hasIntegrityIssues) {
        // 当文件缺失或被修改时，提供修复选项
        choices.push({ 
          name: "修复安装 (恢复缺失/修改的文件)", 
          value: "repair" 
        });
      }
        console.log(chalk.yellow("\n⚠️  已安装相同版本"));
      choices.push({ name: `强制重新安装BMad核心 (v${currentVersion} - 重新安装)`, value: "reinstall" });
    } else {
        console.log(chalk.yellow("\n⬇️  已安装版本比可用版本新"));
      choices.push({ name: `降级BMad核心 (v${currentVersion} → v${newVersion})`, value: "reinstall" });
    }
    
    choices.push(
      { name: "仅添加/更新扩展包", value: "expansions" },
      { name: "取消", value: "cancel" }
    );

    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: "您想做什么？",
        choices: choices,
      },
    ]);

    switch (action) {
      case "upgrade":
        return await this.performUpdate(config, installDir, state.manifest, spinner);
      case "repair":
        // 对于修复，恢复缺失/修改的文件，同时备份修改过的文件
        return await this.performRepair(config, installDir, state.manifest, integrity, spinner);
      case "reinstall":
        // 对于重新安装，不检查修改 - 直接覆盖
        return await this.performReinstall(config, installDir, spinner);
      case "expansions": {
        // 询问要安装哪些扩展包
        const availableExpansionPacks = await resourceLocator.getExpansionPacks();
        
        if (availableExpansionPacks.length === 0) {
          console.log(chalk.yellow("没有可用的扩展包。"));
          return;
        }
        
        const { selectedPacks } = await inquirer.prompt([
          {
            type: 'checkbox',
            name: 'selectedPacks',
            message: '选择要安装/更新的扩展包:',
            choices: availableExpansionPacks.map(pack => ({
              name: `${pack.name} (v${pack.version}) .${pack.id}`,
              value: pack.id,
              checked: state.expansionPacks[pack.id] !== undefined
            }))
          }
        ]);
        
        if (selectedPacks.length === 0) {
          console.log(chalk.yellow("未选择扩展包。"));
          return;
        }
        
        spinner.start("正在安装扩展包...");
        const expansionFiles = await this.installExpansionPacks(installDir, selectedPacks, spinner, { ides: config.ides || [] });
        spinner.succeed("扩展包安装成功！");
        
        console.log(chalk.green("\n✓ 安装完成！"));
        console.log(chalk.green(`✓ 已安装/更新扩展包:`));
        for (const packId of selectedPacks) {
          console.log(chalk.green(`  - ${packId} → .${packId}/`));
        }
        return;
      }
      case "cancel":
        console.log("安装已取消。");
        return;
    }
  }

  async handleV3Installation(config, installDir, state, spinner) {
    spinner.stop();

    console.log(
      chalk.yellow("\n🔍 找到BMad v3安装 (bmad-agent/ 目录)")
    );
    console.log(`   目录: ${installDir}`);

    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: "您想做什么？",
        choices: [
          { name: "从v3升级到v4（推荐）", value: "upgrade" },
          { name: "与v3并行安装v4", value: "alongside" },
          { name: "取消", value: "cancel" },
        ],
      },
    ]);

    switch (action) {
      case "upgrade": {
        console.log(chalk.cyan("\n📦 正在启动v3到v4升级过程..."));
        const V3ToV4Upgrader = require("../../upgraders/v3-to-v4-upgrader");
        const upgrader = new V3ToV4Upgrader();
        return await upgrader.upgrade({ 
          projectPath: installDir,
          ides: config.ides || [] // 从初始配置传递IDE选择
        });
      }
      case "alongside":
        return await this.performFreshInstall(config, installDir, spinner);
      case "cancel":
        console.log("安装已取消。");
        return;
    }
  }

  async handleUnknownInstallation(config, installDir, state, spinner) {
    spinner.stop();

    console.log(chalk.yellow("\n⚠️  目录包含现有文件"));
    console.log(`   目录: ${installDir}`);

    if (state.hasBmadCore) {
      console.log("   找到: .bmad-core 目录（但没有清单）");
    }
    if (state.hasOtherFiles) {
      console.log("   找到: 目录中的其他文件");
    }

    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: "您想做什么？",
        choices: [
          { name: "无论如何安装（可能会覆盖文件）", value: "force" },
          { name: "选择其他目录", value: "different" },
          { name: "取消", value: "cancel" },
        ],
      },
    ]);

    switch (action) {
      case "force":
        return await this.performFreshInstall(config, installDir, spinner);
      case "different": {
        const { newDir } = await inquirer.prompt([
          {
            type: "input",
            name: "newDir",
            message: "输入新安装目录:",
            default: path.join(path.dirname(installDir), "bmad-project"),
          },
        ]);
        config.directory = newDir;
        return await this.install(config);
      }
      case "cancel":
        console.log("安装已取消。");
        return;
    }
  }

  async performUpdate(newConfig, installDir, manifest, spinner) {
    spinner.start("正在检查更新...");

    try {
      // 获取当前版本和新版本
      const currentVersion = manifest.version;
      const newVersion = await this.getCoreVersion();
      const versionCompare = this.compareVersions(currentVersion, newVersion);
      
      // 仅在实际版本升级时检查修改文件
      let modifiedFiles = [];
      if (versionCompare !== 0) {
        spinner.text = "正在检查修改文件...";
        modifiedFiles = await fileManager.checkModifiedFiles(
          installDir,
          manifest
        );
      }

      if (modifiedFiles.length > 0) {
        spinner.warn("找到修改文件");
        console.log(chalk.yellow("\n以下文件已被修改:"));
        for (const file of modifiedFiles) {
          console.log(`  - ${file}`);
        }

        const { action } = await inquirer.prompt([
          {
            type: "list",
            name: "action",
            message: "您想如何进行？",
            choices: [
              { name: "备份并覆盖修改的文件", value: "backup" },
              { name: "跳过修改的文件", value: "skip" },
              { name: "取消更新", value: "cancel" },
            ],
          },
        ]);

        if (action === "cancel") {
          console.log("更新已取消。");
          return;
        }

        if (action === "backup") {
          spinner.start("正在备份修改的文件...");
          for (const file of modifiedFiles) {
            const filePath = path.join(installDir, file);
            const backupPath = await fileManager.backupFile(filePath);
            console.log(
              chalk.dim(`  已备份: ${file} → ${path.basename(backupPath)}`)
            );
          }
        }
      }

      // 通过重新运行安装来执行更新
      spinner.text = versionCompare === 0 ? "正在重新安装文件..." : "正在更新文件...";
      const config = {
        installType: manifest.install_type,
        agent: manifest.agent,
        directory: installDir,
        ides: newConfig?.ides || manifest.ides_setup || [],
      };

      await this.performFreshInstall(config, installDir, spinner, { isUpdate: true });
      
      // 清理现在有.yaml对应文件的.yml文件
      spinner.text = "正在清理遗留的.yml文件...";
      await this.cleanupLegacyYmlFiles(installDir, spinner);
    } catch (error) {
      spinner.fail("更新失败");
      throw error;
    }
  }

  async performRepair(config, installDir, manifest, integrity, spinner) {
    spinner.start("正在准备修复安装...");

    try {
      // 备份修改的文件
      if (integrity.modified.length > 0) {
        spinner.text = "正在备份修改的文件...";
        for (const file of integrity.modified) {
          const filePath = path.join(installDir, file);
          if (await fileManager.pathExists(filePath)) {
            const backupPath = await fileManager.backupFile(filePath);
            console.log(chalk.dim(`  已备份: ${file} → ${path.basename(backupPath)}`));
          }
        }
      }

      // 恢复缺失和修改的文件
      spinner.text = "正在恢复文件...";
      const filesToRestore = [...integrity.missing, ...integrity.modified];
      
      for (const file of filesToRestore) {
        // 跳过清单文件本身
        if (file.endsWith('install-manifest.yaml')) continue;
        
        const relativePath = file.replace('.bmad-core/', '');
        const destPath = path.join(installDir, file);
        
        // 检查这是否是需要特殊处理的common/文件
        const commonBase = path.dirname(path.dirname(path.dirname(path.dirname(__filename))));
        const commonSourcePath = path.join(commonBase, 'common', relativePath);
        
        if (await fileManager.pathExists(commonSourcePath)) {
          // 这是一个common/文件 - 需要模板处理
          const fs = require('fs').promises;
          const content = await fs.readFile(commonSourcePath, 'utf8');
          const updatedContent = content.replace(/\{root\}/g, '.bmad-core');
          await fileManager.ensureDirectory(path.dirname(destPath));
          await fs.writeFile(destPath, updatedContent, 'utf8');
          spinner.text = `已恢复: ${file}`;
        } else {
          // 来自bmad-core的常规文件
          const sourcePath = path.join(sourceBase, relativePath);
          if (await fileManager.pathExists(sourcePath)) {
            await fileManager.copyFile(sourcePath, destPath);
            spinner.text = `已恢复: ${file}`;
            
            // 如果这是.yaml文件，检查并移除对应的.yml文件
            if (file.endsWith('.yaml')) {
              const ymlFile = file.replace(/\.yaml$/, '.yml');
              const ymlPath = path.join(installDir, ymlFile);
              if (await fileManager.pathExists(ymlPath)) {
                const fs = require('fs').promises;
                await fs.unlink(ymlPath);
                console.log(chalk.dim(`  已移除遗留文件: ${ymlFile} （由 ${file} 替换）`));
              }
            }
          } else {
            console.warn(chalk.yellow(`  警告: 未找到源文件: ${file}`));
          }
        }
      }
      
      // 清理现在有.yaml对应文件的.yml文件
      spinner.text = "正在清理遗留的.yml文件...";
      await this.cleanupLegacyYmlFiles(installDir, spinner);
      
      spinner.succeed("修复成功完成！");
      
      // 显示摘要
      console.log(chalk.green("\n✓ 安装已修复！"));
      if (integrity.missing.length > 0) {
        console.log(chalk.green(`  恢复了 ${integrity.missing.length} 个缺失文件`));
      }
      if (integrity.modified.length > 0) {
        console.log(chalk.green(`  恢复了 ${integrity.modified.length} 个修改文件（已创建备份）`));
      }
      
      // 如果代理已修复，则对Cursor自定义模式发出警告
      const ides = manifest.ides_setup || [];
      if (ides.includes('cursor')) {
        console.log(chalk.yellow.bold("\n⚠️  重要提示: Cursor自定义模式更新要求"));
        console.log(chalk.yellow("由于代理文件已修复，您需要根据Cursor文档更新在Cursor自定义代理GUI中配置的任何自定义代理模式。"));
      }
      
    } catch (error) {
      spinner.fail("修复失败");
      throw error;
    }
  }

  async performReinstall(config, installDir, spinner) {
    spinner.start("正在准备重新安装BMad Method...");

    // 移除现有.bmad-core
    const bmadCorePath = path.join(installDir, ".bmad-core");
    if (await fileManager.pathExists(bmadCorePath)) {
      spinner.text = "正在移除现有安装...";
      await fileManager.removeDirectory(bmadCorePath);
    }
    
    spinner.text = "正在安装全新副本...";
    const result = await this.performFreshInstall(config, installDir, spinner, { isUpdate: true });
    
    // 清理现在有.yaml对应文件的.yml文件
    spinner.text = "正在清理遗留的.yml文件...";
    await this.cleanupLegacyYmlFiles(installDir, spinner);
    
    return result;
  }

  showSuccessMessage(config, installDir, options = {}) {
    console.log(chalk.green("\n✓ BMad Method安装成功！\n"));

    const ides = config.ides || (config.ide ? [config.ide] : []);
    if (ides.length > 0) {
      for (const ide of ides) {
        const ideConfig = configLoader.getIdeConfiguration(ide);
        if (ideConfig?.instructions) {
          console.log(
            chalk.bold(`要在 ${ideConfig.name} 中使用BMad代理:`)
          );
          console.log(ideConfig.instructions);
        }
      }
    } else {
      console.log(chalk.yellow("未设置IDE配置。"));
      console.log(
        "您可以使用以下路径中的代理文件手动配置您的IDE:",
        installDir
      );
    }

    // 安装组件信息
    console.log(chalk.bold("\n🎯 安装摘要:"));
    if (config.installType !== "expansion-only") {
      console.log(chalk.green("✓ .bmad-core框架已安装，包含所有代理和工作流程"));
    }
    
    if (config.expansionPacks && config.expansionPacks.length > 0) {
      console.log(chalk.green(`✓ 已安装扩展包:`));
      for (const packId of config.expansionPacks) {
        console.log(chalk.green(`  - ${packId} → .${packId}/`));
      }
    }
    
    if (config.includeWebBundles && config.webBundlesDirectory) {
      const bundleInfo = this.getWebBundleInfo(config);
      // 解析Web Bundle目录以显示
      const originalCwd = process.env.INIT_CWD || process.env.PWD || process.cwd();
      const resolvedWebBundlesDir = path.isAbsolute(config.webBundlesDirectory) 
        ? config.webBundlesDirectory 
        : path.resolve(originalCwd, config.webBundlesDirectory);
      console.log(chalk.green(`✓ Web Bundle (${bundleInfo}) 已安装到: ${resolvedWebBundlesDir}`));
    }
    
    if (ides.length > 0) {
      const ideNames = ides.map(ide => {
        const ideConfig = configLoader.getIdeConfiguration(ide);
        return ideConfig?.name || ide;
      }).join(", ");
      console.log(chalk.green(`✓ 已为以下IDE设置规则和配置: ${ideNames}`));
    }
    

    // Web Bundle信息
    if (!config.includeWebBundles) {
      console.log(chalk.bold("\n📦 可用的Web Bundle:"));
      console.log("预构建的Web Bundle可用，可以稍后添加:");
      console.log(chalk.cyan("  再次运行安装程序，将它们添加到您的项目中"));
      console.log("这些Bundle独立工作，可以共享、移动或用作");
      console.log("其他项目中的独立文件。");
    }

    if (config.installType === "single-agent") {
      console.log(
        chalk.dim(
          "\n需要其他代理？运行: npx bmad-method install --agent=<name>"
        )
      );
      console.log(
        chalk.dim("需要所有内容？运行: npx bmad-method install --full")
      );
    }

    // 如果代理已更新，则对Cursor自定义模式发出警告
    if (options.isUpdate && ides.includes('cursor')) {
      console.log(chalk.yellow.bold("\n⚠️  重要提示: Cursor自定义模式更新要求"));
      console.log(chalk.yellow("由于代理已更新，您需要根据Cursor文档更新在Cursor自定义代理GUI中配置的任何自定义代理模式。"));
    }

    // 阅读用户指南的重要通知
    console.log(chalk.red.bold("\n📖 重要提示: 请阅读安装在.bmad-core/user-guide.md的用户指南"));
    console.log(chalk.red("本指南包含有关BMad工作流程以及如何有效使用代理的基本信息。"));
  }

  // 为了向后兼容的遗留方法
  async update() {
    console.log(chalk.yellow('“update”命令已弃用。'));
    console.log(
      '请使用“install”代替 - 它将检测并提供更新现有安装。'
    );

    const installDir = await this.findInstallation();
    if (installDir) {
      const config = {
        installType: "full",
        directory: path.dirname(installDir),
        ide: null,
      };
      return await this.install(config);
    }
    console.log(chalk.red("未找到BMad安装。"));
  }

  async listAgents() {
    const agents = await resourceLocator.getAvailableAgents();

    console.log(chalk.bold("\n可用BMad代理:\n"));

    for (const agent of agents) {
      console.log(chalk.cyan(`  ${agent.id.padEnd(20)}`), agent.description);
    }

    console.log(
      chalk.dim("\n使用以下命令安装: npx bmad-method install --agent=<id>\n")
    );
  }

  async listExpansionPacks() {
    const expansionPacks = await resourceLocator.getExpansionPacks();

    console.log(chalk.bold("\n可用BMad扩展包:\n"));

    if (expansionPacks.length === 0) {
      console.log(chalk.yellow("未找到扩展包。"));
      return;
    }

    for (const pack of expansionPacks) {
      console.log(chalk.cyan(`  ${pack.id.padEnd(20)}`), 
                  `${pack.name} v${pack.version}`);
      console.log(chalk.dim(`  ${' '.repeat(22)}${pack.description}`));
      if (pack.author && pack.author !== 'Unknown') {
        console.log(chalk.dim(`  ${' '.repeat(22)}作者: ${pack.author}`));
      }
      console.log();
    }

    console.log(
      chalk.dim("使用以下命令安装: npx bmad-method install --full --expansion-packs <id>\n")
    );
  }

  async showStatus() {
    const installDir = await this.findInstallation();

    if (!installDir) {
      console.log(
        chalk.yellow("在当前目录树中未找到BMad安装")
      );
      return;
    }

    const manifest = await fileManager.readManifest(installDir);

    if (!manifest) {
      console.log(chalk.red("安装无效 - 未找到清单"));
      return;
    }

    console.log(chalk.bold("\nBMad安装状态:\n"));
    console.log(`  目录:      ${installDir}`);
    console.log(`  版本:        ${manifest.version}`);
    console.log(
      `  安装日期:      ${new Date(
        manifest.installed_at
      ).toLocaleDateString()}`
    );
    console.log(`  类型:           ${manifest.install_type}`);

    if (manifest.agent) {
      console.log(`  代理:          ${manifest.agent}`);
    }

    if (manifest.ides_setup && manifest.ides_setup.length > 0) {
      console.log(`  IDE设置:      ${manifest.ides_setup.join(', ')}`);
    }

    console.log(`  总文件数:    ${manifest.files.length}`);

    // 检查修改
    const modifiedFiles = await fileManager.checkModifiedFiles(
      installDir,
      manifest
    );
    if (modifiedFiles.length > 0) {
      console.log(chalk.yellow(`  修改文件: ${modifiedFiles.length}`));
    }

    console.log("");
  }

  async getAvailableAgents() {
    return resourceLocator.getAvailableAgents();
  }

  async getAvailableExpansionPacks() {
    return resourceLocator.getExpansionPacks();
  }

  async getAvailableTeams() {
    return configLoader.getAvailableTeams();
  }

  async installExpansionPacks(installDir, selectedPacks, spinner, config = {}) {
    if (!selectedPacks || selectedPacks.length === 0) {
      return [];
    }

    const installedFiles = [];

    for (const packId of selectedPacks) {
      spinner.text = `正在安装扩展包: ${packId}...`;
      
      try {
        const expansionPacks = await resourceLocator.getExpansionPacks();
        const pack = expansionPacks.find(p => p.id === packId);
        
        if (!pack) {
          console.warn(`未找到扩展包 ${packId}，跳过...`);
          continue;
        }
        
        // 检查扩展包是否已存在
        let expansionDotFolder = path.join(installDir, `.${packId}`);
        const existingManifestPath = path.join(expansionDotFolder, 'install-manifest.yaml');
        
        if (await fileManager.pathExists(existingManifestPath)) {
          spinner.stop();
          const existingManifest = await fileManager.readExpansionPackManifest(installDir, packId);
          
          console.log(chalk.yellow(`\n🔍 找到现有 ${pack.name} 安装`));
          console.log(`   当前版本: ${existingManifest.version || 'unknown'}`);
          console.log(`   新版本: ${pack.version}`);
          
          // 检查现有扩展包的完整性
          const packIntegrity = await fileManager.checkFileIntegrity(installDir, existingManifest);
          const hasPackIntegrityIssues = packIntegrity.missing.length > 0 || packIntegrity.modified.length > 0;
          
          if (hasPackIntegrityIssues) {
            console.log(chalk.red("   ⚠️  检测到安装问题:"));
            if (packIntegrity.missing.length > 0) {
              console.log(chalk.red(`     缺失文件: ${packIntegrity.missing.length}`));
            }
            if (packIntegrity.modified.length > 0) {
              console.log(chalk.yellow(`     修改文件: ${packIntegrity.modified.length}`));
            }
          }
          
          const versionCompare = this.compareVersions(existingManifest.version || '0.0.0', pack.version);
          
          if (versionCompare === 0) {
            console.log(chalk.yellow('   ⚠️  已安装相同版本'));
            
            const choices = [];
            if (hasPackIntegrityIssues) {
              choices.push({ name: '修复 (恢复缺失/修改的文件)', value: 'repair' });
            }
            choices.push(
              { name: '强制重新安装 (覆盖)', value: 'overwrite' },
              { name: '跳过此扩展包', value: 'skip' },
              { name: '取消安装', value: 'cancel' }
            );
            
            const { action } = await inquirer.prompt([{
              type: 'list',
              name: 'action',
              message: `${pack.name} v${pack.version} 已安装。您想做什么？`,
              choices: choices
            }]);
            
            if (action === 'skip') {
              spinner.start();
              continue;
            } else if (action === 'cancel') {
                console.log('安装已取消。');
              process.exit(0);
            } else if (action === 'repair') {
              // 修复扩展包
              await this.repairExpansionPack(installDir, packId, pack, packIntegrity, spinner);
              continue;
            }
          } else if (versionCompare < 0) {
            console.log(chalk.cyan('   ⬆️  有可用升级'));
            
            const { proceed } = await inquirer.prompt([{
              type: 'confirm',
              name: 'proceed',
              message: `将 ${pack.name} 从 v${existingManifest.version} 升级到 v${pack.version}？`,
              default: true
            }]);
            
            if (!proceed) {
              spinner.start();
              continue;
            }
          } else {
            console.log(chalk.yellow('   ⬇️  已安装版本比可用版本新'));
            
            const { action } = await inquirer.prompt([{
              type: 'list',
              name: 'action',
              message: '您想做什么？',
              choices: [
                { name: '保留当前版本', value: 'skip' },
                { name: '降级到可用版本', value: 'downgrade' },
                { name: '取消安装', value: 'cancel' }
              ]
            }]);
            
            if (action === 'skip') {
              spinner.start();
              continue;
            } else if (action === 'cancel') {
                console.log('安装已取消。');
              process.exit(0);
            }
          }
          
          // 如果到达这里，则继续安装
          spinner.start(`正在移除旧的 ${pack.name} 安装...`);
          await fileManager.removeDirectory(expansionDotFolder);
        }

        const expansionPackDir = pack.path;
        
        // 确保此扩展包的专用点文件夹存在
        expansionDotFolder = path.join(installDir, `.${packId}`);
        await fileManager.ensureDirectory(expansionDotFolder);
        
        // 定义要从扩展包复制的文件夹
        const foldersToSync = [
          'agents',
          'agent-teams',
          'templates',
          'tasks',
          'checklists',
          'workflows',
          'data',
          'utils',
          'schemas'
        ];

        // 复制每个文件夹（如果存在）
        for (const folder of foldersToSync) {
          const sourceFolder = path.join(expansionPackDir, folder);
          
          // 检查文件夹是否存在于扩展包中
          if (await fileManager.pathExists(sourceFolder)) {
            // 获取此文件夹中的所有文件
            const files = await resourceLocator.findFiles('**/*', {
              cwd: sourceFolder,
              nodir: true
            });

            // 将每个文件复制到扩展包的点文件夹中，并替换{root}
            for (const file of files) {
              const sourcePath = path.join(sourceFolder, file);
              const destPath = path.join(expansionDotFolder, folder, file);
              
              const needsRootReplacement = file.endsWith('.md') || file.endsWith('.yaml') || file.endsWith('.yml');
              let success = false;
              
              if (needsRootReplacement) {
                success = await fileManager.copyFileWithRootReplacement(sourcePath, destPath, `.${packId}`);
              } else {
                success = await fileManager.copyFile(sourcePath, destPath);
              }
              
              if (success) {
                installedFiles.push(path.join(`.${packId}`, folder, file));
              }
            }
          }
        }

        // 复制config.yaml并替换{root}
        const configPath = path.join(expansionPackDir, 'config.yaml');
        if (await fileManager.pathExists(configPath)) {
          const configDestPath = path.join(expansionDotFolder, 'config.yaml');
          if (await fileManager.copyFileWithRootReplacement(configPath, configDestPath, `.${packId}`)) {
            installedFiles.push(path.join(`.${packId}`, 'config.yaml'));
          }
        }
        
        // 如果存在，则复制README并替换{root}
        const readmePath = path.join(expansionPackDir, 'README.md');
        if (await fileManager.pathExists(readmePath)) {
          const readmeDestPath = path.join(expansionDotFolder, 'README.md');
          if (await fileManager.copyFileWithRootReplacement(readmePath, readmeDestPath, `.${packId}`)) {
            installedFiles.push(path.join(`.${packId}`, 'README.md'));
          }
        }

        // 将common/项复制到扩展包文件夹
        spinner.text = `正在将通用工具复制到 ${packId}...`;
        await this.copyCommonItems(installDir, `.${packId}`, spinner);
        
        // 检查并解析核心依赖项
        await this.resolveExpansionPackCoreDependencies(installDir, expansionDotFolder, packId, pack, spinner);
        
        // 检查并解析团队引用的核心代理
        await this.resolveExpansionPackCoreAgents(installDir, expansionDotFolder, packId, spinner);

        // 为此扩展包创建清单
        spinner.text = `正在为 ${packId} 创建清单...`;
        const expansionConfig = {
          installType: 'expansion-pack',
          expansionPackId: packId,
          expansionPackName: pack.name,
          expansionPackVersion: pack.version,
          ides: config.ides || []  // 使用ides_setup而不是ide_setup
        };
        
        // 获取此扩展包中安装的所有文件
        const foundFiles = await resourceLocator.findFiles('**/*', {
          cwd: expansionDotFolder,
          nodir: true
        });
        const expansionPackFiles = foundFiles.map(f => path.join(`.${packId}`, f));
        
        await fileManager.createExpansionPackManifest(installDir, packId, expansionConfig, expansionPackFiles);

        console.log(chalk.green(`✓ 已安装扩展包: ${pack.name} 到 ${`.${packId}`}`));
      } catch (error) {
        console.error(`安装扩展包 ${packId} 失败: ${error.message}`);
        console.error(`堆栈跟踪: ${error.stack}`);
      }
    }

    return installedFiles;
  }

  async resolveExpansionPackCoreDependencies(installDir, expansionDotFolder, packId, pack, spinner) {
    const yaml = require('js-yaml');
    const fs = require('fs').promises;
    
    // 查找扩展包中的所有代理文件
    const agentFiles = await resourceLocator.findFiles('agents/*.md', {
      cwd: expansionDotFolder
    });

    for (const agentFile of agentFiles) {
      const agentPath = path.join(expansionDotFolder, agentFile);
      const agentContent = await fs.readFile(agentPath, 'utf8');
      
      // 提取YAML frontmatter以检查依赖项
      const yamlContent = extractYamlFromAgent(agentContent);
      if (yamlContent) {
        try {
          const agentConfig = yaml.load(yamlContent);
          const dependencies = agentConfig.dependencies || {};
          
          // 检查核心依赖项（扩展包中不存在的）
          for (const depType of ['tasks', 'templates', 'checklists', 'workflows', 'utils', 'data']) {
            const deps = dependencies[depType] || [];
            
            for (const dep of deps) {
              const depFileName = dep.endsWith('.md') || dep.endsWith('.yaml') ? dep : 
                                  (depType === 'templates' ? `${dep}.yaml` : `${dep}.md`);
              const expansionDepPath = path.join(expansionDotFolder, depType, depFileName);
              
              // 检查依赖项是否存在于扩展包点文件夹中
              if (!(await fileManager.pathExists(expansionDepPath))) {
                // 尝试在扩展包源中查找
                const sourceDepPath = path.join(pack.path, depType, depFileName);
                
                if (await fileManager.pathExists(sourceDepPath)) {
                  // 从扩展包源复制
                  spinner.text = `正在复制 ${packId} 依赖项 ${dep}...`;
                  const destPath = path.join(expansionDotFolder, depType, depFileName);
                  await fileManager.copyFileWithRootReplacement(sourceDepPath, destPath, `.${packId}`);
                  console.log(chalk.dim(`  已添加 ${packId} 依赖项: ${depType}/${depFileName}`));
                } else {
                  // 尝试在核心中查找
                  const coreDepPath = path.join(resourceLocator.getBmadCorePath(), depType, depFileName);
                  
                    if (await fileManager.pathExists(coreDepPath)) {
                      spinner.text = `正在为 ${packId} 复制核心依赖项 ${dep}...`;
                      
                      // 从核心复制到扩展包点文件夹，并替换{root}
                      const destPath = path.join(expansionDotFolder, depType, depFileName);
                      await fileManager.copyFileWithRootReplacement(coreDepPath, destPath, `.${packId}`);
                      
                      console.log(chalk.dim(`  已添加核心依赖项: ${depType}/${depFileName}`));
                    } else {
                      console.warn(chalk.yellow(`  警告: 未在核心或扩展包中找到依赖项 ${depType}/${dep}`));
                    }
                  }
                }
            }
          }
        } catch (error) {
          console.warn(`  警告: 无法解析代理依赖项: ${error.message}`);
        }
      }
    }
  }

  async resolveExpansionPackCoreAgents(installDir, expansionDotFolder, packId, spinner) {
    const yaml = require('js-yaml');
    const fs = require('fs').promises;
    
    // 查找扩展包中的所有团队文件
    const teamFiles = await resourceLocator.findFiles('agent-teams/*.yaml', {
      cwd: expansionDotFolder
    });

    // 也获取扩展包中现有代理
    const existingAgents = new Set();
    const agentFiles = await resourceLocator.findFiles('agents/*.md', {
      cwd: expansionDotFolder
    });
    for (const agentFile of agentFiles) {
      const agentName = path.basename(agentFile, '.md');
      existingAgents.add(agentName);
    }

    // 处理每个团队文件
    for (const teamFile of teamFiles) {
      const teamPath = path.join(expansionDotFolder, teamFile);
      const teamContent = await fs.readFile(teamPath, 'utf8');
      
      try {
        const teamConfig = yaml.load(teamContent);
        const agents = teamConfig.agents || [];
        
        // 如果不存在，则添加bmad-orchestrator（所有团队都必需）
        if (!agents.includes('bmad-orchestrator')) {
          agents.unshift('bmad-orchestrator');
        }
        
        // 检查团队中的每个代理
        for (const agentId of agents) {
          if (!existingAgents.has(agentId)) {
            // 代理不在扩展包中，尝试从核心获取
            const coreAgentPath = path.join(resourceLocator.getBmadCorePath(), 'agents', `${agentId}.md`);
            
            if (await fileManager.pathExists(coreAgentPath)) {
              spinner.text = `正在为 ${packId} 复制核心代理 ${agentId}...`;
              
              // 复制代理文件并替换{root}
              const destPath = path.join(expansionDotFolder, 'agents', `${agentId}.md`);
              await fileManager.copyFileWithRootReplacement(coreAgentPath, destPath, `.${packId}`);
              existingAgents.add(agentId);
              
              console.log(chalk.dim(`  已添加核心代理: ${agentId}`));
              
              // 现在也解析此代理的依赖项
              const agentContent = await fs.readFile(coreAgentPath, 'utf8');
              const yamlContent = extractYamlFromAgent(agentContent, true);
              
              if (yamlContent) {
                try {
                  
                  const agentConfig = yaml.load(yamlContent);
                  const dependencies = agentConfig.dependencies || {};
                  
                  // 复制此代理的所有依赖项
                  for (const depType of ['tasks', 'templates', 'checklists', 'workflows', 'utils', 'data']) {
                    const deps = dependencies[depType] || [];
                    
                    for (const dep of deps) {
                      const depFileName = dep.endsWith('.md') || dep.endsWith('.yaml') ? dep : 
                                          (depType === 'templates' ? `${dep}.yaml` : `${dep}.md`);
                      const expansionDepPath = path.join(expansionDotFolder, depType, depFileName);
                      
                      // 检查依赖项是否存在于扩展包中
                      if (!(await fileManager.pathExists(expansionDepPath))) {
                        // 尝试在核心中查找
                        const coreDepPath = path.join(resourceLocator.getBmadCorePath(), depType, depFileName);
                        
                        if (await fileManager.pathExists(coreDepPath)) {
                          const destDepPath = path.join(expansionDotFolder, depType, depFileName);
                          await fileManager.copyFileWithRootReplacement(coreDepPath, destDepPath, `.${packId}`);
                          console.log(chalk.dim(`    已添加代理依赖项: ${depType}/${depFileName}`));
                        } else {
                          // 尝试通用文件夹
                          const sourceBase = path.dirname(path.dirname(path.dirname(path.dirname(__filename)))); // 返回到项目根目录
                          const commonDepPath = path.join(sourceBase, 'common', depType, depFileName);
                          if (await fileManager.pathExists(commonDepPath)) {
                            const destDepPath = path.join(expansionDotFolder, depType, depFileName);
                            await fileManager.copyFile(commonDepPath, destDepPath);
                            console.log(chalk.dim(`    已从common添加代理依赖项: ${depType}/${depFileName}`));
                          }
                        }
                      }
                    }
                  }
                } catch (error) {
                  console.warn(`  警告: 无法解析代理 ${agentId} 的依赖项: ${error.message}`);
                }
              }
            } else {
              console.warn(chalk.yellow(`  警告: 未找到团队 ${path.basename(teamFile, '.yaml')} 的核心代理 ${agentId}`));
            }
          }
        }
      } catch (error) {
        console.warn(`  警告: 无法解析团队文件 ${teamFile}: ${error.message}`);
      }
    }
  }

  getWebBundleInfo(config) {
    const webBundleType = config.webBundleType || 'all';
    
    switch (webBundleType) {
      case 'all':
        return '所有Bundle';
      case 'agents':
        return '仅限单个代理';
      case 'teams':
        return config.selectedWebBundleTeams ? 
          `团队: ${config.selectedWebBundleTeams.join(', ')}` : 
          '选定团队';
      case 'custom': {
        const parts = [];
        if (config.selectedWebBundleTeams && config.selectedWebBundleTeams.length > 0) {
          parts.push(`团队: ${config.selectedWebBundleTeams.join(', ')}`);
        }
        if (config.includeIndividualAgents) {
          parts.push('单个代理');
        }
        return parts.length > 0 ? parts.join(' + ') : '自定义选择';
      }
      default:
        return '选定Bundle';
    }
  }

  async installWebBundles(webBundlesDirectory, config, spinner) {
    
    try {
      // 查找BMad安装中的dist目录
      const distDir = configLoader.getDistPath();
      
      if (!(await fileManager.pathExists(distDir))) {
        console.warn('未找到Web Bundle。运行“npm run build”以生成它们。');
        return;
      }

      // 确保Web Bundle目录存在
      await fileManager.ensureDirectory(webBundlesDirectory);
      
      const webBundleType = config.webBundleType || 'all';
      
      if (webBundleType === 'all') {
        // 复制整个dist目录结构
        await fileManager.copyDirectory(distDir, webBundlesDirectory);
        console.log(chalk.green(`✓ 已将所有Web Bundle安装到: ${webBundlesDirectory}`));
      } else {
        let copiedCount = 0;
        
        // 根据类型复制特定选择
        if (webBundleType === 'agents' || (webBundleType === 'custom' && config.includeIndividualAgents)) {
          const agentsSource = path.join(distDir, 'agents');
          const agentsTarget = path.join(webBundlesDirectory, 'agents');
          if (await fileManager.pathExists(agentsSource)) {
            await fileManager.copyDirectory(agentsSource, agentsTarget);
            console.log(chalk.green(`✓ 已复制单个代理Bundle`));
            copiedCount += 10; // 代理的大致数量
          }
        }
        
        if (webBundleType === 'teams' || webBundleType === 'custom') {
          if (config.selectedWebBundleTeams && config.selectedWebBundleTeams.length > 0) {
            const teamsSource = path.join(distDir, 'teams');
            const teamsTarget = path.join(webBundlesDirectory, 'teams');
            await fileManager.ensureDirectory(teamsTarget);
            
            for (const teamId of config.selectedWebBundleTeams) {
              const teamFile = `${teamId}.txt`;
              const sourcePath = path.join(teamsSource, teamFile);
              const targetPath = path.join(teamsTarget, teamFile);
              
              if (await fileManager.pathExists(sourcePath)) {
                await fileManager.copyFile(sourcePath, targetPath);
                copiedCount++;
                console.log(chalk.green(`✓ 已复制团队Bundle: ${teamId}`));
              }
            }
          }
        }
        
        // 如果存在，则始终复制扩展包
        const expansionSource = path.join(distDir, 'expansion-packs');
        const expansionTarget = path.join(webBundlesDirectory, 'expansion-packs');
        if (await fileManager.pathExists(expansionSource)) {
          await fileManager.copyDirectory(expansionSource, expansionTarget);
          console.log(chalk.green(`✓ 已复制扩展包Bundle`));
        }
        
        console.log(chalk.green(`✓ 已将 ${copiedCount} 个选定Web Bundle安装到: ${webBundlesDirectory}`));
      }
    } catch (error) {
      console.error(`安装Web Bundle失败: ${error.message}`);
    }
  }

  async copyCommonItems(installDir, targetSubdir, spinner) {
    
    const fs = require('fs').promises;
    const sourceBase = path.dirname(path.dirname(path.dirname(path.dirname(__filename)))); // 返回到项目根目录
    const commonPath = path.join(sourceBase, 'common');
    const targetPath = path.join(installDir, targetSubdir);
    const copiedFiles = [];
    
    // 检查common/是否存在
    if (!(await fileManager.pathExists(commonPath))) {
      console.warn('警告: 未找到common/文件夹');
      return copiedFiles;
    }
    
    // 将common/中的所有项复制到目标
    const commonItems = await resourceLocator.findFiles('**/*', {
      cwd: commonPath,
      nodir: true
    });
    
    for (const item of commonItems) {
      const sourcePath = path.join(commonPath, item);
      const destPath = path.join(targetPath, item);
      
      // 读取文件内容
      const content = await fs.readFile(sourcePath, 'utf8');
      
      // 将{root}替换为目标子目录
      const updatedContent = content.replace(/\{root\}/g, targetSubdir);
      
      // 确保目录存在
      await fileManager.ensureDirectory(path.dirname(destPath));
      
      // 写入更新后的内容
      await fs.writeFile(destPath, updatedContent, 'utf8');
      copiedFiles.push(path.join(targetSubdir, item));
    }
    
    console.log(chalk.dim(`  已添加 ${commonItems.length} 个通用工具`));
    return copiedFiles;
  }

  async detectExpansionPacks(installDir) {
    const expansionPacks = {};
    const glob = require("glob");
    
    // 查找所有可能是扩展包的点文件夹
    const dotFolders = glob.sync(".*", {
      cwd: installDir,
      ignore: [".git", ".git/**", ".bmad-core", ".bmad-core/**"],
    });
    
    for (const folder of dotFolders) {
      const folderPath = path.join(installDir, folder);
      const stats = await fileManager.pathExists(folderPath);
      
      if (stats) {
        // 检查它是否包含清单
        const manifestPath = path.join(folderPath, "install-manifest.yaml");
        if (await fileManager.pathExists(manifestPath)) {
          const manifest = await fileManager.readExpansionPackManifest(installDir, folder.substring(1));
          if (manifest) {
            expansionPacks[folder.substring(1)] = {
              path: folderPath,
              manifest: manifest,
              hasManifest: true
            };
          }
        } else {
          // 检查它是否包含config.yaml（不带清单的扩展包）
          const configPath = path.join(folderPath, "config.yaml");
          if (await fileManager.pathExists(configPath)) {
            expansionPacks[folder.substring(1)] = {
              path: folderPath,
              manifest: null,
              hasManifest: false
            };
          }
        }
      }
    }
    
    return expansionPacks;
  }

  async repairExpansionPack(installDir, packId, pack, integrity, spinner) {
    spinner.start(`正在修复 ${pack.name}...`);
    
    try {
      const expansionDotFolder = path.join(installDir, `.${packId}`);
      
      // 备份修改的文件
      if (integrity.modified.length > 0) {
        spinner.text = "正在备份修改的文件...";
        for (const file of integrity.modified) {
          const filePath = path.join(installDir, file);
          if (await fileManager.pathExists(filePath)) {
            const backupPath = await fileManager.backupFile(filePath);
            console.log(chalk.dim(`  已备份: ${file} → ${path.basename(backupPath)}`));
          }
        }
      }
      
      // 恢复缺失和修改的文件
      spinner.text = "正在恢复文件...";
      const filesToRestore = [...integrity.missing, ...integrity.modified];
      
      for (const file of filesToRestore) {
        // 跳过清单文件本身
        if (file.endsWith('install-manifest.yaml')) continue;
        
        const relativePath = file.replace(`.${packId}/`, '');
        const sourcePath = path.join(pack.path, relativePath);
        const destPath = path.join(installDir, file);
        
        // 检查这是否是需要特殊处理的common/文件
        const commonBase = path.dirname(path.dirname(path.dirname(path.dirname(__filename))));
        const commonSourcePath = path.join(commonBase, 'common', relativePath);
        
        if (await fileManager.pathExists(commonSourcePath)) {
          // 这是一个common/文件 - 需要模板处理
          const fs = require('fs').promises;
          const content = await fs.readFile(commonSourcePath, 'utf8');
          const updatedContent = content.replace(/\{root\}/g, `.${packId}`);
          await fileManager.ensureDirectory(path.dirname(destPath));
          await fs.writeFile(destPath, updatedContent, 'utf8');
          spinner.text = `已恢复: ${file}`;
        } else if (await fileManager.pathExists(sourcePath)) {
          // 来自扩展包的常规文件
          await fileManager.copyFile(sourcePath, destPath);
          spinner.text = `已恢复: ${file}`;
        } else {
          console.warn(chalk.yellow(`  警告: 未找到源文件: ${file}`));
        }
      }
      
      spinner.succeed(`${pack.name} 修复成功！`);
      
      // 显示摘要
      console.log(chalk.green(`\n✓ ${pack.name} 已修复！`));
      if (integrity.missing.length > 0) {
        console.log(chalk.green(`  恢复了 ${integrity.missing.length} 个缺失文件`));
      }
      if (integrity.modified.length > 0) {
        console.log(chalk.green(`  恢复了 ${integrity.modified.length} 个修改文件（已创建备份）`));
      }
      
    } catch (error) {
      if (spinner) spinner.fail(`修复 ${pack.name} 失败`);
      console.error(`错误: ${error.message}`);
    }
  }

  compareVersions(v1, v2) {
    // 简单的语义版本比较
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < 3; i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;
      
      if (part1 > part2) return 1;
      if (part1 < part2) return -1;
    }
    
    return 0;
  }

  async cleanupLegacyYmlFiles(installDir, spinner) {
    const glob = require('glob');
    const fs = require('fs').promises;
    
    try {
      // 查找安装目录中的所有.yml文件
      const ymlFiles = glob.sync('**/*.yml', {
        cwd: installDir,
        ignore: ['**/node_modules/**', '**/.git/**']
      });
      
      let deletedCount = 0;
      
      for (const ymlFile of ymlFiles) {
        // 检查是否存在对应的.yaml文件
        const yamlFile = ymlFile.replace(/\.yml$/, '.yaml');
        const ymlPath = path.join(installDir, ymlFile);
        const yamlPath = path.join(installDir, yamlFile);
        
        if (await fileManager.pathExists(yamlPath)) {
          // .yaml对应文件存在，删除.yml文件
          await fs.unlink(ymlPath);
          deletedCount++;
          console.log(chalk.dim(`  已移除遗留文件: ${ymlFile} （由 ${yamlFile} 替换）`));
        }
      }
      
      if (deletedCount > 0) {
        console.log(chalk.green(`✓ 已清理 ${deletedCount} 个遗留的.yml文件`));
      }
      
    } catch (error) {
      console.warn(`警告: 无法清理遗留的.yml文件: ${error.message}`);
    }
  }

  async findInstallation() {
    // 在当前目录或父目录中查找.bmad-core
    let currentDir = process.cwd();

    while (currentDir !== path.dirname(currentDir)) {
      const bmadDir = path.join(currentDir, ".bmad-core");
      const manifestPath = path.join(bmadDir, "install-manifest.yaml");

      if (await fileManager.pathExists(manifestPath)) {
        return bmadDir;
      }

      currentDir = path.dirname(currentDir);
    }

    // 也检查我们是否在.bmad-core目录中
    if (path.basename(process.cwd()) === ".bmad-core") {
      const manifestPath = path.join(process.cwd(), "install-manifest.yaml");
      if (await fileManager.pathExists(manifestPath)) {
        return process.cwd();
      }
    }

    return null;
  }

  async flatten(options) {
    const { spawn } = require('child_process');
    const flattenerPath = path.join(__dirname, '..', '..', 'flattener', 'main.js');
    
    const args = [];
    if (options.input) {
      args.push('--input', options.input);
    }
    if (options.output) {
      args.push('--output', options.output);
    }
    
    const child = spawn('node', [flattenerPath, ...args], {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    child.on('exit', (code) => {
      process.exit(code);
    });
  }
}

module.exports = new Installer();
