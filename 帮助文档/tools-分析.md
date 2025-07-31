<?xml version="1.0" encoding="UTF-8"?>
<files>
  <file path="yaml-format.js"><![CDATA[
    #!/usr/bin/env node
    
    const fs = require('fs');
    const path = require('path');
    const yaml = require('js-yaml');
    const { execSync } = require('child_process');
    
    // Dynamic import for ES module
    let chalk;
    
    // Initialize ES modules
    async function initializeModules() {
      if (!chalk) {
        chalk = (await import('chalk')).default;
      }
    }
    
    /**
     * YAML Formatter and Linter for BMad-Method
     * Formats and validates YAML files and YAML embedded in Markdown
     */
    
    async function formatYamlContent(content, filename) {
      await initializeModules();
      try {
        // First try to fix common YAML issues
        let fixedContent = content
          // Fix "commands :" -> "commands:"
          .replace(/^(\s*)(\w+)\s+:/gm, '$1$2:')
          // Fix inconsistent list indentation
          .replace(/^(\s*)-\s{3,}/gm, '$1- ');
        
        // Skip auto-fixing for .roomodes files - they have special nested structure
        if (!filename.includes('.roomodes')) {
          fixedContent = fixedContent
            // Fix unquoted list items that contain special characters or multiple parts
            .replace(/^(\s*)-\s+(.*)$/gm, (match, indent, content) => {
              // Skip if already quoted
              if (content.startsWith('"') && content.endsWith('"')) {
                return match;
              }
              // If the content contains special YAML characters or looks complex, quote it
              // BUT skip if it looks like a proper YAML key-value pair (like "key: value")
              if ((content.includes(':') || content.includes('-') || content.includes('{') || content.includes('}')) && 
                  !content.match(/^\w+:\s/)) {
                // Remove any existing quotes first, escape internal quotes, then add proper quotes
                const cleanContent = content.replace(/^["']|["']$/g, '').replace(/"/g, '\\"');
                return `${indent}- "${cleanContent}"`;
              }
              return match;
            });
        }
        
        // Debug: show what we're trying to parse
        if (fixedContent !== content) {
          console.log(chalk.blue(`🔧 Applied YAML fixes to ${filename}`));
        }
        
        // Parse and re-dump YAML to format it
        const parsed = yaml.load(fixedContent);
        const formatted = yaml.dump(parsed, {
          indent: 2,
          lineWidth: -1, // Disable line wrapping
          noRefs: true,
          sortKeys: false // Preserve key order
        });
        return formatted;
      } catch (error) {
        console.error(chalk.red(`❌ YAML syntax error in ${filename}:`), error.message);
        console.error(chalk.yellow(`💡 Try manually fixing the YAML structure first`));
        return null;
      }
    }
    
    async function processMarkdownFile(filePath) {
      await initializeModules();
      const content = fs.readFileSync(filePath, 'utf8');
      let modified = false;
      let newContent = content;
    
      // Fix untyped code blocks by adding 'text' type
      // Match ``` at start of line followed by newline, but only if it's an opening fence
      newContent = newContent.replace(/^```\n([\s\S]*?)\n```$/gm, '```text\n$1\n```');
      if (newContent !== content) {
        modified = true;
        console.log(chalk.blue(`🔧 Added 'text' type to untyped code blocks in ${filePath}`));
      }
    
      // Find YAML code blocks
      const yamlBlockRegex = /```ya?ml\n([\s\S]*?)\n```/g;
      let match;
      const replacements = [];
      
      while ((match = yamlBlockRegex.exec(newContent)) !== null) {
        const [fullMatch, yamlContent] = match;
        const formatted = await formatYamlContent(yamlContent, filePath);
        if (formatted !== null) {
          // Remove trailing newline that js-yaml adds
          const trimmedFormatted = formatted.replace(/\n$/, '');
          
          if (trimmedFormatted !== yamlContent) {
            modified = true;
            console.log(chalk.green(`✓ Formatted YAML in ${filePath}`));
          }
          
          replacements.push({
            start: match.index,
            end: match.index + fullMatch.length,
            replacement: `\`\`\`yaml\n${trimmedFormatted}\n\`\`\``
          });
        }
      }
      
      // Apply replacements in reverse order to maintain indices
      for (let i = replacements.length - 1; i >= 0; i--) {
        const { start, end, replacement } = replacements[i];
        newContent = newContent.slice(0, start) + replacement + newContent.slice(end);
      }
    
      if (modified) {
        fs.writeFileSync(filePath, newContent);
        return true;
      }
      return false;
    }
    
    async function processYamlFile(filePath) {
      await initializeModules();
      const content = fs.readFileSync(filePath, 'utf8');
      const formatted = await formatYamlContent(content, filePath);
      
      if (formatted === null) {
        return false; // Syntax error
      }
      
      if (formatted !== content) {
        fs.writeFileSync(filePath, formatted);
        return true;
      }
      return false;
    }
    
    async function lintYamlFile(filePath) {
      await initializeModules();
      try {
        // Use yaml-lint for additional validation
        execSync(`npx yaml-lint "${filePath}"`, { stdio: 'pipe' });
        return true;
      } catch (error) {
        console.error(chalk.red(`❌ YAML lint error in ${filePath}:`));
        console.error(error.stdout?.toString() || error.message);
        return false;
      }
    }
    
    async function main() {
      await initializeModules();
      const args = process.argv.slice(2);
      const glob = require('glob');
      
      if (args.length === 0) {
        console.error('Usage: node yaml-format.js <file1> [file2] ...');
        process.exit(1);
      }
    
      let hasErrors = false;
      let hasChanges = false;
      let filesProcessed = [];
    
      // Expand glob patterns and collect all files
      const allFiles = [];
      for (const arg of args) {
        if (arg.includes('*')) {
          // It's a glob pattern
          const matches = glob.sync(arg);
          allFiles.push(...matches);
        } else {
          // It's a direct file path
          allFiles.push(arg);
        }
      }
    
      for (const filePath of allFiles) {
        if (!fs.existsSync(filePath)) {
          // Skip silently for glob patterns that don't match anything
          if (!args.some(arg => arg.includes('*') && filePath === arg)) {
            console.error(chalk.red(`❌ File not found: ${filePath}`));
            hasErrors = true;
          }
          continue;
        }
    
        const ext = path.extname(filePath).toLowerCase();
        const basename = path.basename(filePath).toLowerCase();
        
        try {
          let changed = false;
          if (ext === '.md') {
            changed = await processMarkdownFile(filePath);
          } else if (ext === '.yaml' || ext === '.yml' || basename.includes('roomodes') || basename.includes('.yaml') || basename.includes('.yml')) {
            // Handle YAML files and special cases like .roomodes
            changed = await processYamlFile(filePath);
            
            // Also run linting
            const lintPassed = await lintYamlFile(filePath);
            if (!lintPassed) hasErrors = true;
          } else {
            // Skip silently for unsupported files
            continue;
          }
          
          if (changed) {
            hasChanges = true;
            filesProcessed.push(filePath);
          }
        } catch (error) {
          console.error(chalk.red(`❌ Error processing ${filePath}:`), error.message);
          hasErrors = true;
        }
      }
    
      if (hasChanges) {
        console.log(chalk.green(`\n✨ YAML formatting completed! Modified ${filesProcessed.length} files:`));
        filesProcessed.forEach(file => console.log(chalk.blue(`  📝 ${file}`)));
      }
    
      if (hasErrors) {
        console.error(chalk.red('\n💥 Some files had errors. Please fix them before committing.'));
        process.exit(1);
      }
    }
    
    if (require.main === module) {
      main().catch(error => {
        console.error('Error:', error);
        process.exit(1);
      });
    }
    
    module.exports = { formatYamlContent, processMarkdownFile, processYamlFile };
    ]]></file>
  <file path="version-bump.js"><![CDATA[
    #!/usr/bin/env node
    
    const fs = require('fs');
    const { execSync } = require('child_process');
    const path = require('path');
    
    // Dynamic import for ES module
    let chalk;
    
    // Initialize ES modules
    async function initializeModules() {
      if (!chalk) {
        chalk = (await import('chalk')).default;
      }
    }
    
    /**
     * Simple version bumping script for BMad-Method
     * Usage: node tools/version-bump.js [patch|minor|major]
     */
    
    function getCurrentVersion() {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      return packageJson.version;
    }
    
    async function bumpVersion(type = 'patch') {
      await initializeModules();
      
      const validTypes = ['patch', 'minor', 'major'];
      if (!validTypes.includes(type)) {
        console.error(chalk.red(`Invalid version type: ${type}. Use: ${validTypes.join(', ')}`));
        process.exit(1);
      }
    
      console.log(chalk.yellow('⚠️  Manual version bumping is disabled.'));
      console.log(chalk.blue('🤖 This project uses semantic-release for automated versioning.'));
      console.log('');
      console.log(chalk.bold('To create a new release, use conventional commits:'));
      console.log(chalk.cyan('  feat: new feature (minor version bump)'));
      console.log(chalk.cyan('  fix: bug fix (patch version bump)'));
      console.log(chalk.cyan('  feat!: breaking change (major version bump)'));
      console.log('');
      console.log(chalk.dim('Example: git commit -m "feat: add new installer features"'));
      console.log(chalk.dim('Then push to main branch to trigger automatic release.'));
      
      return null;
    }
    
    async function main() {
      await initializeModules();
      
      const type = process.argv[2] || 'patch';
      const currentVersion = getCurrentVersion();
      
      console.log(chalk.blue(`Current version: ${currentVersion}`));
      
      // Check if working directory is clean
      try {
        execSync('git diff-index --quiet HEAD --');
      } catch (error) {
        console.error(chalk.red('❌ Working directory is not clean. Commit your changes first.'));
        process.exit(1);
      }
      
      const newVersion = await bumpVersion(type);
      
      console.log(chalk.green(`\n🎉 Version bump complete!`));
      console.log(chalk.blue(`📦 ${currentVersion} → ${newVersion}`));
    }
    
    if (require.main === module) {
      main().catch(error => {
        console.error('Error:', error);
        process.exit(1);
      });
    }
    
    module.exports = { bumpVersion, getCurrentVersion };
    ]]></file>
  <file path="update-expansion-version.js"><![CDATA[
    #!/usr/bin/env node
    
    const fs = require('fs');
    const path = require('path');
    const yaml = require('js-yaml');
    
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
      console.log('Usage: node update-expansion-version.js <expansion-pack-id> <new-version>');
      console.log('Example: node update-expansion-version.js bmad-creator-tools 1.1.0');
      process.exit(1);
    }
    
    const [packId, newVersion] = args;
    
    // Validate version format
    if (!/^\d+\.\d+\.\d+$/.test(newVersion)) {
      console.error('Error: Version must be in format X.Y.Z (e.g., 1.2.3)');
      process.exit(1);
    }
    
    async function updateVersion() {
      try {
        // Update in config.yaml
        const configPath = path.join(__dirname, '..', 'expansion-packs', packId, 'config.yaml');
        
        if (!fs.existsSync(configPath)) {
          console.error(`Error: Expansion pack '${packId}' not found`);
          process.exit(1);
        }
        
        const configContent = fs.readFileSync(configPath, 'utf8');
        const config = yaml.load(configContent);
        const oldVersion = config.version || 'unknown';
        
        config.version = newVersion;
        
        const updatedYaml = yaml.dump(config, { indent: 2 });
        fs.writeFileSync(configPath, updatedYaml);
        
        console.log(`✓ Updated ${packId}/config.yaml: ${oldVersion} → ${newVersion}`);
        console.log(`\n✓ Successfully updated ${packId} to version ${newVersion}`);
        console.log('\nNext steps:');
        console.log('1. Test the changes');
        console.log('2. Commit: git add -A && git commit -m "chore: bump ' + packId + ' to v' + newVersion + '"');
        
      } catch (error) {
        console.error('Error updating version:', error.message);
        process.exit(1);
      }
    }
    
    updateVersion();
    ]]></file>
  <file path="sync-installer-version.js"><![CDATA[
    #!/usr/bin/env node
    
    /**
     * Sync installer package.json version with main package.json
     * Used by semantic-release to keep versions in sync
     */
    
    const fs = require('fs');
    const path = require('path');
    
    function syncInstallerVersion() {
      // Read main package.json
      const mainPackagePath = path.join(__dirname, '..', 'package.json');
      const mainPackage = JSON.parse(fs.readFileSync(mainPackagePath, 'utf8'));
      
      // Read installer package.json
      const installerPackagePath = path.join(__dirname, 'installer', 'package.json');
      const installerPackage = JSON.parse(fs.readFileSync(installerPackagePath, 'utf8'));
      
      // Update installer version to match main version
      installerPackage.version = mainPackage.version;
      
      // Write back installer package.json
      fs.writeFileSync(installerPackagePath, JSON.stringify(installerPackage, null, 2) + '\n');
      
      console.log(`Synced installer version to ${mainPackage.version}`);
    }
    
    // Run if called directly
    if (require.main === module) {
      syncInstallerVersion();
    }
    
    module.exports = { syncInstallerVersion };
    ]]></file>
  <file path="semantic-release-sync-installer.js"><![CDATA[
    /**
     * Semantic-release plugin to sync installer package.json version
     */
    
    const fs = require('fs');
    const path = require('path');
    
    // This function runs during the "prepare" step of semantic-release
    function prepare(_, { nextRelease, logger }) {
      // Define the path to the installer package.json file
      const file = path.join(process.cwd(), 'tools/installer/package.json');
    
      // If the file does not exist, skip syncing and log a message
      if (!fs.existsSync(file)) return logger.log('Installer package.json not found, skipping');
    
      // Read and parse the package.json file
      const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
    
      // Update the version field with the next release version
      pkg.version = nextRelease.version;
    
      // Write the updated JSON back to the file
      fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
    
      // Log success message
      logger.log(`Synced installer package.json to version ${nextRelease.version}`);
    }
    
    // Export the prepare function so semantic-release can use it
    module.exports = { prepare };
    
    ]]></file>
  <file path="cli.js"><![CDATA[
    #!/usr/bin/env node
    
    const { Command } = require('commander');
    const WebBuilder = require('./builders/web-builder');
    const V3ToV4Upgrader = require('./upgraders/v3-to-v4-upgrader');
    const IdeSetup = require('./installer/lib/ide-setup');
    const path = require('path');
    
    const program = new Command();
    
    program
      .name('bmad-build')
      .description('BMad-Method build tool for creating web bundles')
      .version('4.0.0');
    
    program
      .command('build')
      .description('Build web bundles for agents and teams')
      .option('-a, --agents-only', 'Build only agent bundles')
      .option('-t, --teams-only', 'Build only team bundles')
      .option('-e, --expansions-only', 'Build only expansion pack bundles')
      .option('--no-expansions', 'Skip building expansion packs')
      .option('--no-clean', 'Skip cleaning output directories')
      .action(async (options) => {
        const builder = new WebBuilder({
          rootDir: process.cwd()
        });
    
        try {
          if (options.clean) {
            console.log('Cleaning output directories...');
            await builder.cleanOutputDirs();
          }
    
          if (options.expansionsOnly) {
            console.log('Building expansion pack bundles...');
            await builder.buildAllExpansionPacks({ clean: false });
          } else {
            if (!options.teamsOnly) {
              console.log('Building agent bundles...');
              await builder.buildAgents();
            }
    
            if (!options.agentsOnly) {
              console.log('Building team bundles...');
              await builder.buildTeams();
            }
    
            if (!options.noExpansions) {
              console.log('Building expansion pack bundles...');
              await builder.buildAllExpansionPacks({ clean: false });
            }
          }
    
          console.log('Build completed successfully!');
        } catch (error) {
          console.error('Build failed:', error.message);
          process.exit(1);
        }
      });
    
    program
      .command('build:expansions')
      .description('Build web bundles for all expansion packs')
      .option('--expansion <name>', 'Build specific expansion pack only')
      .option('--no-clean', 'Skip cleaning output directories')
      .action(async (options) => {
        const builder = new WebBuilder({
          rootDir: process.cwd()
        });
    
        try {
          if (options.expansion) {
            console.log(`Building expansion pack: ${options.expansion}`);
            await builder.buildExpansionPack(options.expansion, { clean: options.clean });
          } else {
            console.log('Building all expansion packs...');
            await builder.buildAllExpansionPacks({ clean: options.clean });
          }
    
          console.log('Expansion pack build completed successfully!');
        } catch (error) {
          console.error('Expansion pack build failed:', error.message);
          process.exit(1);
        }
      });
    
    program
      .command('list:agents')
      .description('List all available agents')
      .action(async () => {
        const builder = new WebBuilder({ rootDir: process.cwd() });
        const agents = await builder.resolver.listAgents();
        console.log('Available agents:');
        agents.forEach(agent => console.log(`  - ${agent}`));
      });
    
    program
      .command('list:expansions')
      .description('List all available expansion packs')
      .action(async () => {
        const builder = new WebBuilder({ rootDir: process.cwd() });
        const expansions = await builder.listExpansionPacks();
        console.log('Available expansion packs:');
        expansions.forEach(expansion => console.log(`  - ${expansion}`));
      });
    
    program
      .command('validate')
      .description('Validate agent and team configurations')
      .action(async () => {
        const builder = new WebBuilder({ rootDir: process.cwd() });
        try {
          // Validate by attempting to build all agents and teams
          const agents = await builder.resolver.listAgents();
          const teams = await builder.resolver.listTeams();
          
          console.log('Validating agents...');
          for (const agent of agents) {
            await builder.resolver.resolveAgentDependencies(agent);
            console.log(`  ✓ ${agent}`);
          }
          
          console.log('\nValidating teams...');
          for (const team of teams) {
            await builder.resolver.resolveTeamDependencies(team);
            console.log(`  ✓ ${team}`);
          }
          
          console.log('\nAll configurations are valid!');
        } catch (error) {
          console.error('Validation failed:', error.message);
          process.exit(1);
        }
      });
    
    program
      .command('upgrade')
      .description('Upgrade a BMad-Method V3 project to V4')
      .option('-p, --project <path>', 'Path to V3 project (defaults to current directory)')
      .option('--dry-run', 'Show what would be changed without making changes')
      .option('--no-backup', 'Skip creating backup (not recommended)')
      .action(async (options) => {
        const upgrader = new V3ToV4Upgrader();
        await upgrader.upgrade({
          projectPath: options.project,
          dryRun: options.dryRun,
          backup: options.backup
        });
      });
    
    program.parse();
    ]]></file>
  <file path="bump-expansion-version.js"><![CDATA[
    #!/usr/bin/env node
    
    // Load required modules
    const fs = require('fs');
    const path = require('path');
    const yaml = require('js-yaml');
    
    // Parse CLI arguments
    const args = process.argv.slice(2);
    const packId = args[0];
    const bumpType = args[1] || 'minor';
    
    // Validate arguments
    if (!packId || args.length > 2) {
      console.log('Usage: node bump-expansion-version.js <expansion-pack-id> [major|minor|patch]');
      console.log('Default: minor');
      console.log('Example: node bump-expansion-version.js bmad-creator-tools patch');
      process.exit(1);
    }
    
    if (!['major', 'minor', 'patch'].includes(bumpType)) {
      console.error('Error: Bump type must be major, minor, or patch');
      process.exit(1);
    }
    
    // Version bump logic
    function bumpVersion(currentVersion, type) {
      const [major, minor, patch] = currentVersion.split('.').map(Number);
    
      switch (type) {
        case 'major': return `${major + 1}.0.0`;
        case 'minor': return `${major}.${minor + 1}.0`;
        case 'patch': return `${major}.${minor}.${patch + 1}`;
        default: return currentVersion;
      }
    }
    
    // Main function to bump version
    async function updateVersion() {
      const configPath = path.join(__dirname, '..', 'expansion-packs', packId, 'config.yaml');
    
      // Check if config exists
      if (!fs.existsSync(configPath)) {
        console.error(`Error: Expansion pack '${packId}' not found`);
        console.log('\nAvailable expansion packs:');
    
        const packsDir = path.join(__dirname, '..', 'expansion-packs');
        const entries = fs.readdirSync(packsDir, { withFileTypes: true });
    
        entries.forEach(entry => {
          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            console.log(`  - ${entry.name}`);
          }
        });
    
        process.exit(1);
      }
    
      try {
        const configContent = fs.readFileSync(configPath, 'utf8');
        const config = yaml.load(configContent);
    
        const oldVersion = config.version || '1.0.0';
        const newVersion = bumpVersion(oldVersion, bumpType);
    
        config.version = newVersion;
    
        const updatedYaml = yaml.dump(config, { indent: 2 });
        fs.writeFileSync(configPath, updatedYaml);
    
        console.log(`✓ ${packId}: ${oldVersion} → ${newVersion}`);
        console.log(`\n✓ Successfully bumped ${packId} with ${bumpType} version bump`);
        console.log('\nNext steps:');
        console.log(`1. Test the changes`);
        console.log(`2. Commit: git add -A && git commit -m "chore: bump ${packId} version (${bumpType})"`);
    
      } catch (error) {
        console.error('Error updating version:', error.message);
        process.exit(1);
      }
    }
    
    updateVersion();
    
    ]]></file>
  <file path="bump-all-versions.js"><![CDATA[
    #!/usr/bin/env node
    
    const fs = require('fs');
    const path = require('path');
    const yaml = require('js-yaml');
    
    const args = process.argv.slice(2);
    const bumpType = args[0] || 'minor'; // default to minor
    
    if (!['major', 'minor', 'patch'].includes(bumpType)) {
      console.log('Usage: node bump-all-versions.js [major|minor|patch]');
      console.log('Default: minor');
      process.exit(1);
    }
    
    function bumpVersion(currentVersion, type) {
      const [major, minor, patch] = currentVersion.split('.').map(Number);
      
      switch (type) {
        case 'major':
          return `${major + 1}.0.0`;
        case 'minor':
          return `${major}.${minor + 1}.0`;
        case 'patch':
          return `${major}.${minor}.${patch + 1}`;
        default:
          return currentVersion;
      }
    }
    
    async function bumpAllVersions() {
      const updatedItems = [];
      
      // First, bump the core version (package.json)
      const packagePath = path.join(__dirname, '..', 'package.json');
      try {
        const packageContent = fs.readFileSync(packagePath, 'utf8');
        const packageJson = JSON.parse(packageContent);
        const oldCoreVersion = packageJson.version || '1.0.0';
        const newCoreVersion = bumpVersion(oldCoreVersion, bumpType);
        
        packageJson.version = newCoreVersion;
        
        fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
        
        updatedItems.push({ type: 'core', name: 'BMad Core', oldVersion: oldCoreVersion, newVersion: newCoreVersion });
        console.log(`✓ BMad Core (package.json): ${oldCoreVersion} → ${newCoreVersion}`);
      } catch (error) {
        console.error(`✗ Failed to update BMad Core: ${error.message}`);
      }
      
      // Then, bump all expansion packs
      const expansionPacksDir = path.join(__dirname, '..', 'expansion-packs');
      
      try {
        const entries = fs.readdirSync(expansionPacksDir, { withFileTypes: true });
        
        for (const entry of entries) {
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'README.md') {
            const packId = entry.name;
            const configPath = path.join(expansionPacksDir, packId, 'config.yaml');
            
            if (fs.existsSync(configPath)) {
              try {
                const configContent = fs.readFileSync(configPath, 'utf8');
                const config = yaml.load(configContent);
                const oldVersion = config.version || '1.0.0';
                const newVersion = bumpVersion(oldVersion, bumpType);
                
                config.version = newVersion;
                
                const updatedYaml = yaml.dump(config, { indent: 2 });
                fs.writeFileSync(configPath, updatedYaml);
                
                updatedItems.push({ type: 'expansion', name: packId, oldVersion, newVersion });
                console.log(`✓ ${packId}: ${oldVersion} → ${newVersion}`);
                
              } catch (error) {
                console.error(`✗ Failed to update ${packId}: ${error.message}`);
              }
            }
          }
        }
        
        if (updatedItems.length > 0) {
          const coreCount = updatedItems.filter(i => i.type === 'core').length;
          const expansionCount = updatedItems.filter(i => i.type === 'expansion').length;
          
          console.log(`\n✓ Successfully bumped ${updatedItems.length} item(s) with ${bumpType} version bump`);
          if (coreCount > 0) console.log(`  - ${coreCount} core`);
          if (expansionCount > 0) console.log(`  - ${expansionCount} expansion pack(s)`);
          
          console.log('\nNext steps:');
          console.log('1. Test the changes');
          console.log('2. Commit: git add -A && git commit -m "chore: bump all versions (' + bumpType + ')"');
        } else {
          console.log('No items found to update');
        }
        
      } catch (error) {
        console.error('Error reading expansion packs directory:', error.message);
        process.exit(1);
      }
    }
    
    bumpAllVersions();
    ]]></file>
  <file path="bmad-npx-wrapper.js"><![CDATA[
    #!/usr/bin/env node
    
    /**
     * BMad Method CLI - Direct execution wrapper for npx
     * This file ensures proper execution when run via npx from GitHub
     */
    
    const { execSync } = require('child_process');
    const path = require('path');
    const fs = require('fs');
    
    // Check if we're running in an npx temporary directory
    const isNpxExecution = __dirname.includes('_npx') || __dirname.includes('.npm');
    
    // If running via npx, we need to handle things differently
    if (isNpxExecution) {
      const args = process.argv.slice(2);
      
      // Use the installer for all commands
      const bmadScriptPath = path.join(__dirname, 'installer', 'bin', 'bmad.js');
      
      if (!fs.existsSync(bmadScriptPath)) {
        console.error('Error: Could not find bmad.js at', bmadScriptPath);
        console.error('Current directory:', __dirname);
        process.exit(1);
      }
      
      try {
        execSync(`node "${bmadScriptPath}" ${args.join(' ')}`, {
          stdio: 'inherit',
          cwd: path.dirname(__dirname)
        });
      } catch (error) {
        process.exit(error.status || 1);
      }
    } else {
      // Local execution - use installer for all commands
      require('./installer/bin/bmad.js');
    }
    ]]></file>
  <file path="upgraders\v3-to-v4-upgrader.js"><![CDATA[
    const fs = require("fs").promises;
    const path = require("path");
    const { glob } = require("glob");
    
    // Dynamic imports for ES modules
    let chalk, ora, inquirer;
    
    // Initialize ES modules
    async function initializeModules() {
      chalk = (await import("chalk")).default;
      ora = (await import("ora")).default;
      inquirer = (await import("inquirer")).default;
    }
    
    class V3ToV4Upgrader {
      constructor() {
        // Constructor remains empty
      }
    
      async upgrade(options = {}) {
        try {
          // Initialize ES modules
          await initializeModules();
          // Keep readline open throughout the process
          process.stdin.resume();
    
          // 1. Welcome message
          console.log(
            chalk.bold("\nWelcome to BMad-Method V3 to V4 Upgrade Tool\n")
          );
          console.log(
            "This tool will help you upgrade your BMad-Method V3 project to V4.\n"
          );
          console.log(chalk.cyan("What this tool does:"));
          console.log("- Creates a backup of your V3 files (.bmad-v3-backup/)");
          console.log("- Installs the new V4 .bmad-core structure");
          console.log(
            "- Preserves your PRD, Architecture, and Stories in the new format\n"
          );
          console.log(chalk.yellow("What this tool does NOT do:"));
          console.log(
            "- Modify your document content (use doc-migration-task after upgrade)"
          );
          console.log("- Touch any files outside bmad-agent/ and docs/\n");
    
          // 2. Get project path
          const projectPath = await this.getProjectPath(options.projectPath);
    
          // 3. Validate V3 structure
          const validation = await this.validateV3Project(projectPath);
          if (!validation.isValid) {
            console.error(
              chalk.red("\nError: This doesn't appear to be a V3 project.")
            );
            console.error("Expected to find:");
            console.error("- bmad-agent/ directory");
            console.error("- docs/ directory\n");
            console.error(
              "Please check you're in the correct directory and try again."
            );
            return;
          }
    
          // 4. Pre-flight check
          const analysis = await this.analyzeProject(projectPath);
          await this.showPreflightCheck(analysis, options);
    
          if (!options.dryRun) {
            const { confirm } = await inquirer.prompt([
              {
                type: "confirm",
                name: "confirm",
                message: "Continue with upgrade?",
                default: true,
              },
            ]);
    
            if (!confirm) {
              console.log("Upgrade cancelled.");
              return;
            }
          }
    
          // 5. Create backup
          if (options.backup !== false && !options.dryRun) {
            await this.createBackup(projectPath);
          }
    
          // 6. Install V4 structure
          if (!options.dryRun) {
            await this.installV4Structure(projectPath);
          }
    
          // 7. Migrate documents
          if (!options.dryRun) {
            await this.migrateDocuments(projectPath, analysis);
          }
    
          // 8. Setup IDE
          if (!options.dryRun) {
            await this.setupIDE(projectPath, options.ides);
          }
    
          // 9. Show completion report
          this.showCompletionReport(projectPath, analysis);
    
          process.exit(0);
        } catch (error) {
          console.error(chalk.red("\nUpgrade error:"), error.message);
          process.exit(1);
        }
      }
    
      async getProjectPath(providedPath) {
        if (providedPath) {
          return path.resolve(providedPath);
        }
    
        const { projectPath } = await inquirer.prompt([
          {
            type: "input",
            name: "projectPath",
            message: "Please enter the path to your V3 project:",
            default: process.cwd(),
          },
        ]);
    
        return path.resolve(projectPath);
      }
    
      async validateV3Project(projectPath) {
        const spinner = ora("Validating project structure...").start();
    
        try {
          const bmadAgentPath = path.join(projectPath, "bmad-agent");
          const docsPath = path.join(projectPath, "docs");
    
          const hasBmadAgent = await this.pathExists(bmadAgentPath);
          const hasDocs = await this.pathExists(docsPath);
    
          if (hasBmadAgent) {
            spinner.text = "✓ Found bmad-agent/ directory";
            console.log(chalk.green("\n✓ Found bmad-agent/ directory"));
          }
    
          if (hasDocs) {
            console.log(chalk.green("✓ Found docs/ directory"));
          }
    
          const isValid = hasBmadAgent && hasDocs;
    
          if (isValid) {
            spinner.succeed("This appears to be a valid V3 project");
          } else {
            spinner.fail("Invalid V3 project structure");
          }
    
          return { isValid, hasBmadAgent, hasDocs };
        } catch (error) {
          spinner.fail("Validation failed");
          throw error;
        }
      }
    
      async analyzeProject(projectPath) {
        const docsPath = path.join(projectPath, "docs");
        const bmadAgentPath = path.join(projectPath, "bmad-agent");
    
        // Find PRD
        const prdCandidates = ["prd.md", "PRD.md", "product-requirements.md"];
        let prdFile = null;
        for (const candidate of prdCandidates) {
          const candidatePath = path.join(docsPath, candidate);
          if (await this.pathExists(candidatePath)) {
            prdFile = candidate;
            break;
          }
        }
    
        // Find Architecture
        const archCandidates = [
          "architecture.md",
          "Architecture.md",
          "technical-architecture.md",
        ];
        let archFile = null;
        for (const candidate of archCandidates) {
          const candidatePath = path.join(docsPath, candidate);
          if (await this.pathExists(candidatePath)) {
            archFile = candidate;
            break;
          }
        }
    
        // Find Front-end Architecture (V3 specific)
        const frontEndCandidates = [
          "front-end-architecture.md",
          "frontend-architecture.md",
          "ui-architecture.md",
        ];
        let frontEndArchFile = null;
        for (const candidate of frontEndCandidates) {
          const candidatePath = path.join(docsPath, candidate);
          if (await this.pathExists(candidatePath)) {
            frontEndArchFile = candidate;
            break;
          }
        }
    
        // Find UX/UI spec
        const uxSpecCandidates = [
          "ux-ui-spec.md",
          "ux-ui-specification.md",
          "ui-spec.md",
          "ux-spec.md",
        ];
        let uxSpecFile = null;
        for (const candidate of uxSpecCandidates) {
          const candidatePath = path.join(docsPath, candidate);
          if (await this.pathExists(candidatePath)) {
            uxSpecFile = candidate;
            break;
          }
        }
    
        // Find v0 prompt or UX prompt
        const uxPromptCandidates = [
          "v0-prompt.md",
          "ux-prompt.md",
          "ui-prompt.md",
          "design-prompt.md",
        ];
        let uxPromptFile = null;
        for (const candidate of uxPromptCandidates) {
          const candidatePath = path.join(docsPath, candidate);
          if (await this.pathExists(candidatePath)) {
            uxPromptFile = candidate;
            break;
          }
        }
    
        // Find epic files
        const epicFiles = await glob("epic*.md", { cwd: docsPath });
    
        // Find story files
        const storiesPath = path.join(docsPath, "stories");
        let storyFiles = [];
        if (await this.pathExists(storiesPath)) {
          storyFiles = await glob("*.md", { cwd: storiesPath });
        }
    
        // Count custom files in bmad-agent
        const bmadAgentFiles = await glob("**/*.md", {
          cwd: bmadAgentPath,
          ignore: ["node_modules/**"],
        });
    
        return {
          prdFile,
          archFile,
          frontEndArchFile,
          uxSpecFile,
          uxPromptFile,
          epicFiles,
          storyFiles,
          customFileCount: bmadAgentFiles.length,
        };
      }
    
      async showPreflightCheck(analysis, options) {
        console.log(chalk.bold("\nProject Analysis:"));
        console.log(
          `- PRD found: ${
            analysis.prdFile
              ? `docs/${analysis.prdFile}`
              : chalk.yellow("Not found")
          }`
        );
        console.log(
          `- Architecture found: ${
            analysis.archFile
              ? `docs/${analysis.archFile}`
              : chalk.yellow("Not found")
          }`
        );
        if (analysis.frontEndArchFile) {
          console.log(
            `- Front-end Architecture found: docs/${analysis.frontEndArchFile}`
          );
        }
        console.log(
          `- UX/UI Spec found: ${
            analysis.uxSpecFile
              ? `docs/${analysis.uxSpecFile}`
              : chalk.yellow("Not found")
          }`
        );
        console.log(
          `- UX/Design Prompt found: ${
            analysis.uxPromptFile
              ? `docs/${analysis.uxPromptFile}`
              : chalk.yellow("Not found")
          }`
        );
        console.log(
          `- Epic files found: ${analysis.epicFiles.length} files (epic*.md)`
        );
        console.log(
          `- Stories found: ${analysis.storyFiles.length} files in docs/stories/`
        );
        console.log(`- Custom files in bmad-agent/: ${analysis.customFileCount}`);
    
        if (!options.dryRun) {
          console.log("\nThe following will be backed up to .bmad-v3-backup/:");
          console.log("- bmad-agent/ (entire directory)");
          console.log("- docs/ (entire directory)");
    
          if (analysis.epicFiles.length > 0) {
            console.log(
              chalk.green(
                "\nNote: Epic files found! They will be placed in docs/prd/ with an index.md file."
              )
            );
            console.log(
              chalk.green(
                "Since epic files exist, you won't need to shard the PRD after upgrade."
              )
            );
          }
        }
      }
    
      async createBackup(projectPath) {
        const spinner = ora("Creating backup...").start();
    
        try {
          const backupPath = path.join(projectPath, ".bmad-v3-backup");
    
          // Check if backup already exists
          if (await this.pathExists(backupPath)) {
            spinner.fail("Backup directory already exists");
            console.error(
              chalk.red(
                "\nError: Backup directory .bmad-v3-backup/ already exists."
              )
            );
            console.error("\nThis might mean an upgrade was already attempted.");
            console.error(
              "Please remove or rename the existing backup and try again."
            );
            throw new Error("Backup already exists");
          }
    
          // Create backup directory
          await fs.mkdir(backupPath, { recursive: true });
          spinner.text = "✓ Created .bmad-v3-backup/";
          console.log(chalk.green("\n✓ Created .bmad-v3-backup/"));
    
          // Move bmad-agent
          const bmadAgentSrc = path.join(projectPath, "bmad-agent");
          const bmadAgentDest = path.join(backupPath, "bmad-agent");
          await fs.rename(bmadAgentSrc, bmadAgentDest);
          console.log(chalk.green("✓ Moved bmad-agent/ to backup"));
    
          // Move docs
          const docsSrc = path.join(projectPath, "docs");
          const docsDest = path.join(backupPath, "docs");
          await fs.rename(docsSrc, docsDest);
          console.log(chalk.green("✓ Moved docs/ to backup"));
    
          spinner.succeed("Backup created successfully");
        } catch (error) {
          spinner.fail("Backup failed");
          throw error;
        }
      }
    
      async installV4Structure(projectPath) {
        const spinner = ora("Installing V4 structure...").start();
    
        try {
          // Get the source bmad-core directory (without dot prefix)
          const sourcePath = path.join(__dirname, "..", "..", "bmad-core");
          const destPath = path.join(projectPath, ".bmad-core");
    
          // Copy .bmad-core
          await this.copyDirectory(sourcePath, destPath);
          spinner.text = "✓ Copied fresh .bmad-core/ directory from V4";
          console.log(
            chalk.green("\n✓ Copied fresh .bmad-core/ directory from V4")
          );
    
          // Create docs directory
          const docsPath = path.join(projectPath, "docs");
          await fs.mkdir(docsPath, { recursive: true });
          console.log(chalk.green("✓ Created new docs/ directory"));
    
          // Create install manifest for future updates
          await this.createInstallManifest(projectPath);
          console.log(chalk.green("✓ Created install manifest"));
    
          console.log(
            chalk.yellow(
              "\nNote: Your V3 bmad-agent content has been backed up and NOT migrated."
            )
          );
          console.log(
            chalk.yellow(
              "The new V4 agents are completely different and look for different file structures."
            )
          );
    
          spinner.succeed("V4 structure installed successfully");
        } catch (error) {
          spinner.fail("V4 installation failed");
          throw error;
        }
      }
    
      async migrateDocuments(projectPath, analysis) {
        const spinner = ora("Migrating your project documents...").start();
    
        try {
          const backupDocsPath = path.join(projectPath, ".bmad-v3-backup", "docs");
          const newDocsPath = path.join(projectPath, "docs");
          let copiedCount = 0;
    
          // Copy PRD
          if (analysis.prdFile) {
            const src = path.join(backupDocsPath, analysis.prdFile);
            const dest = path.join(newDocsPath, analysis.prdFile);
            await fs.copyFile(src, dest);
            console.log(chalk.green(`\n✓ Copied PRD to docs/${analysis.prdFile}`));
            copiedCount++;
          }
    
          // Copy Architecture
          if (analysis.archFile) {
            const src = path.join(backupDocsPath, analysis.archFile);
            const dest = path.join(newDocsPath, analysis.archFile);
            await fs.copyFile(src, dest);
            console.log(
              chalk.green(`✓ Copied Architecture to docs/${analysis.archFile}`)
            );
            copiedCount++;
          }
    
          // Copy Front-end Architecture if exists
          if (analysis.frontEndArchFile) {
            const src = path.join(backupDocsPath, analysis.frontEndArchFile);
            const dest = path.join(newDocsPath, analysis.frontEndArchFile);
            await fs.copyFile(src, dest);
            console.log(
              chalk.green(
                `✓ Copied Front-end Architecture to docs/${analysis.frontEndArchFile}`
              )
            );
            console.log(
              chalk.yellow(
                "Note: V4 uses a single full-stack-architecture.md - use doc-migration-task to merge"
              )
            );
            copiedCount++;
          }
    
          // Copy UX/UI Spec if exists
          if (analysis.uxSpecFile) {
            const src = path.join(backupDocsPath, analysis.uxSpecFile);
            const dest = path.join(newDocsPath, analysis.uxSpecFile);
            await fs.copyFile(src, dest);
            console.log(
              chalk.green(`✓ Copied UX/UI Spec to docs/${analysis.uxSpecFile}`)
            );
            copiedCount++;
          }
    
          // Copy UX/Design Prompt if exists
          if (analysis.uxPromptFile) {
            const src = path.join(backupDocsPath, analysis.uxPromptFile);
            const dest = path.join(newDocsPath, analysis.uxPromptFile);
            await fs.copyFile(src, dest);
            console.log(
              chalk.green(
                `✓ Copied UX/Design Prompt to docs/${analysis.uxPromptFile}`
              )
            );
            copiedCount++;
          }
    
          // Copy stories
          if (analysis.storyFiles.length > 0) {
            const storiesDir = path.join(newDocsPath, "stories");
            await fs.mkdir(storiesDir, { recursive: true });
    
            for (const storyFile of analysis.storyFiles) {
              const src = path.join(backupDocsPath, "stories", storyFile);
              const dest = path.join(storiesDir, storyFile);
              await fs.copyFile(src, dest);
            }
            console.log(
              chalk.green(
                `✓ Copied ${analysis.storyFiles.length} story files to docs/stories/`
              )
            );
            copiedCount += analysis.storyFiles.length;
          }
    
          // Copy epic files to prd subfolder
          if (analysis.epicFiles.length > 0) {
            const prdDir = path.join(newDocsPath, "prd");
            await fs.mkdir(prdDir, { recursive: true });
    
            for (const epicFile of analysis.epicFiles) {
              const src = path.join(backupDocsPath, epicFile);
              const dest = path.join(prdDir, epicFile);
              await fs.copyFile(src, dest);
            }
            console.log(
              chalk.green(
                `✓ Found and copied ${analysis.epicFiles.length} epic files to docs/prd/`
              )
            );
    
            // Create index.md for the prd folder
            await this.createPrdIndex(projectPath, analysis);
            console.log(chalk.green("✓ Created index.md in docs/prd/"));
    
            console.log(
              chalk.green(
                "\nNote: Epic files detected! These are compatible with V4 and have been copied."
              )
            );
            console.log(
              chalk.green(
                "You won't need to shard the PRD since epics already exist."
              )
            );
            copiedCount += analysis.epicFiles.length;
          }
    
          spinner.succeed(`Migrated ${copiedCount} documents successfully`);
        } catch (error) {
          spinner.fail("Document migration failed");
          throw error;
        }
      }
    
      async setupIDE(projectPath, selectedIdes) {
        // Use the IDE selections passed from the installer
        if (!selectedIdes || selectedIdes.length === 0) {
          console.log(chalk.dim("No IDE setup requested - skipping"));
          return;
        }
    
        const ideSetup = require("../installer/lib/ide-setup");
        const spinner = ora("Setting up IDE rules for all agents...").start();
    
        try {
          const ideMessages = {
            cursor: "Rules created in .cursor/rules/",
            "claude-code": "Commands created in .claude/commands/BMad/",
            windsurf: "Rules created in .windsurf/rules/",
            trae: "Rules created in.trae/rules/",
            roo: "Custom modes created in .roomodes",
            cline: "Rules created in .clinerules/",
          };
    
          // Setup each selected IDE
          for (const ide of selectedIdes) {
            spinner.text = `Setting up ${ide}...`;
            await ideSetup.setup(ide, projectPath);
            console.log(chalk.green(`\n✓ ${ideMessages[ide]}`));
          }
    
          spinner.succeed(`IDE setup complete for ${selectedIdes.length} IDE(s)!`);
        } catch (error) {
          spinner.fail("IDE setup failed");
          console.error(
            chalk.yellow("IDE setup failed, but upgrade is complete.")
          );
        }
      }
    
      showCompletionReport(projectPath, analysis) {
        console.log(chalk.bold.green("\n✓ Upgrade Complete!\n"));
        console.log(chalk.bold("Summary:"));
        console.log(`- V3 files backed up to: .bmad-v3-backup/`);
        console.log(`- V4 structure installed: .bmad-core/ (fresh from V4)`);
    
        const totalDocs =
          (analysis.prdFile ? 1 : 0) +
          (analysis.archFile ? 1 : 0) +
          (analysis.frontEndArchFile ? 1 : 0) +
          (analysis.uxSpecFile ? 1 : 0) +
          (analysis.uxPromptFile ? 1 : 0) +
          analysis.storyFiles.length;
        console.log(
          `- Documents migrated: ${totalDocs} files${
            analysis.epicFiles.length > 0
              ? ` + ${analysis.epicFiles.length} epics`
              : ""
          }`
        );
    
        console.log(chalk.bold("\nImportant Changes:"));
        console.log(
          "- The V4 agents (sm, dev, etc.) expect different file structures than V3"
        );
        console.log(
          "- Your V3 bmad-agent content was NOT migrated (it's incompatible)"
        );
        if (analysis.epicFiles.length > 0) {
          console.log(
            "- Epic files were found and copied - no PRD sharding needed!"
          );
        }
        if (analysis.frontEndArchFile) {
          console.log(
            "- Front-end architecture found - V4 uses full-stack-architecture.md, migration needed"
          );
        }
        if (analysis.uxSpecFile || analysis.uxPromptFile) {
          console.log(
            "- UX/UI design files found and copied - ready for use with V4"
          );
        }
    
        console.log(chalk.bold("\nNext Steps:"));
        console.log("1. Review your documents in the new docs/ folder");
        console.log(
          "2. Use @bmad-master agent to run the doc-migration-task to align your documents with V4 templates"
        );
        if (analysis.epicFiles.length === 0) {
          console.log(
            "3. Use @bmad-master agent to shard the PRD to create epic files"
          );
        }
    
        console.log(
          chalk.dim(
            "\nYour V3 backup is preserved in .bmad-v3-backup/ and can be restored if needed."
          )
        );
      }
    
      async pathExists(filePath) {
        try {
          await fs.access(filePath);
          return true;
        } catch {
          return false;
        }
      }
    
      async copyDirectory(src, dest) {
        await fs.mkdir(dest, { recursive: true });
        const entries = await fs.readdir(src, { withFileTypes: true });
    
        for (const entry of entries) {
          const srcPath = path.join(src, entry.name);
          const destPath = path.join(dest, entry.name);
    
          if (entry.isDirectory()) {
            await this.copyDirectory(srcPath, destPath);
          } else {
            await fs.copyFile(srcPath, destPath);
          }
        }
      }
    
      async createPrdIndex(projectPath, analysis) {
        const prdIndexPath = path.join(projectPath, "docs", "prd", "index.md");
        const prdPath = path.join(
          projectPath,
          "docs",
          analysis.prdFile || "prd.md"
        );
    
        let indexContent = "# Product Requirements Document\n\n";
    
        // Try to read the PRD to get the title and intro content
        if (analysis.prdFile && (await this.pathExists(prdPath))) {
          try {
            const prdContent = await fs.readFile(prdPath, "utf8");
            const lines = prdContent.split("\n");
    
            // Find the first heading
            const titleMatch = lines.find((line) => line.startsWith("# "));
            if (titleMatch) {
              indexContent = titleMatch + "\n\n";
            }
    
            // Get any content before the first ## section
            let introContent = "";
            let foundFirstSection = false;
            for (const line of lines) {
              if (line.startsWith("## ")) {
                foundFirstSection = true;
                break;
              }
              if (!line.startsWith("# ")) {
                introContent += line + "\n";
              }
            }
    
            if (introContent.trim()) {
              indexContent += introContent.trim() + "\n\n";
            }
          } catch (error) {
            // If we can't read the PRD, just use default content
          }
        }
    
        // Add sections list
        indexContent += "## Sections\n\n";
    
        // Sort epic files for consistent ordering
        const sortedEpics = [...analysis.epicFiles].sort();
    
        for (const epicFile of sortedEpics) {
          // Extract epic name from filename
          const epicName = epicFile
            .replace(/\.md$/, "")
            .replace(/^epic-?/i, "")
            .replace(/-/g, " ")
            .replace(/^\d+\s*/, "") // Remove leading numbers
            .trim();
    
          const displayName = epicName.charAt(0).toUpperCase() + epicName.slice(1);
          indexContent += `- [${
            displayName || epicFile.replace(".md", "")
          }](./${epicFile})\n`;
        }
    
        await fs.writeFile(prdIndexPath, indexContent);
      }
    
      async createInstallManifest(projectPath) {
        const fileManager = require("../installer/lib/file-manager");
        const { glob } = require("glob");
    
        // Get all files in .bmad-core for the manifest
        const bmadCorePath = path.join(projectPath, ".bmad-core");
        const files = await glob("**/*", {
          cwd: bmadCorePath,
          nodir: true,
          ignore: ["**/.git/**", "**/node_modules/**"],
        });
    
        // Prepend .bmad-core/ to file paths for manifest
        const manifestFiles = files.map((file) => path.join(".bmad-core", file));
    
        const config = {
          installType: "full",
          agent: null,
          ide: null, // Will be set if IDE setup is done later
        };
    
        await fileManager.createManifest(projectPath, config, manifestFiles);
      }
    }
    
    module.exports = V3ToV4Upgrader;
    
    ]]></file>
  <file path="md-assets\web-agent-startup-instructions.md"><![CDATA[
    # Web Agent Bundle Instructions
    
    You are now operating as a specialized AI agent from the BMad-Method framework. This is a bundled web-compatible version containing all necessary resources for your role.
    
    ## Important Instructions
    
    ### **Follow all startup commands**: Your agent configuration includes startup instructions that define your behavior, personality, and approach. These MUST be followed exactly.
    
    ### **Resource Navigation**: This bundle contains all resources you need. Resources are marked with tags like:
    
    - `==================== START: .bmad-core/folder/filename.md ====================`
    - `==================== END: .bmad-core/folder/filename.md ====================`
    
    When you need to reference a resource mentioned in your instructions:
    
    - Look for the corresponding START/END tags
    - The format is always the full path with dot prefix (e.g., `.bmad-core/personas/analyst.md`, `.bmad-core/tasks/create-story.md`)
    - If a section is specified (e.g., `{root}/tasks/create-story.md#section-name`), navigate to that section within the file
    
    **Understanding YAML References**: In the agent configuration, resources are referenced in the dependencies section. For example:
    
    ```yaml
    dependencies:
      utils:
        - template-format
      tasks:
        - create-story
    ```
    
    These references map directly to bundle sections:
    
    - `dependencies.utils: template-format` → Look for `==================== START: .bmad-core/utils/template-format.md ====================`
    - `dependencies.utils: create-story` → Look for `==================== START: .bmad-core/tasks/create-story.md ====================`
    
    ### **Execution Context**: You are operating in a web environment. All your capabilities and knowledge are contained within this bundle. Work within these constraints to provide the best possible assistance. You have no file system to write to, so you will maintain document history being drafted in your memory unless a canvas feature is available and the user confirms its usage.
    
    ## **Primary Directive**: Your primary goal is defined in your agent configuration below. Focus on fulfilling your designated role explicitly as defined.
    
    ---
    
    ]]></file>
  <file path="lib\yaml-utils.js"><![CDATA[
    /**
     * Utility functions for YAML extraction from agent files
     */
    
    /**
     * Extract YAML content from agent markdown files
     * @param {string} agentContent - The full content of the agent file
     * @param {boolean} cleanCommands - Whether to clean command descriptions (default: false)
     * @returns {string|null} - The extracted YAML content or null if not found
     */
    function extractYamlFromAgent(agentContent, cleanCommands = false) {
      // Remove carriage returns and match YAML block
      const yamlMatch = agentContent.replace(/\r/g, "").match(/```ya?ml\n([\s\S]*?)\n```/);
      if (!yamlMatch) return null;
      
      let yamlContent = yamlMatch[1].trim();
      
      // Clean up command descriptions if requested
      // Converts "- command - description" to just "- command"
      if (cleanCommands) {
        yamlContent = yamlContent.replace(/^(\s*-)(\s*"[^"]+")(\s*-\s*.*)$/gm, '$1$2');
      }
      
      return yamlContent;
    }
    
    module.exports = {
      extractYamlFromAgent
    };
    ]]></file>
  <file path="lib\dependency-resolver.js"><![CDATA[
    const fs = require('fs').promises;
    const path = require('path');
    const yaml = require('js-yaml');
    const { extractYamlFromAgent } = require('./yaml-utils');
    
    class DependencyResolver {
      constructor(rootDir) {
        this.rootDir = rootDir;
        this.bmadCore = path.join(rootDir, 'bmad-core');
        this.common = path.join(rootDir, 'common');
        this.cache = new Map();
      }
    
      async resolveAgentDependencies(agentId) {
        const agentPath = path.join(this.bmadCore, 'agents', `${agentId}.md`);
        const agentContent = await fs.readFile(agentPath, 'utf8');
        
        // Extract YAML from markdown content with command cleaning
        const yamlContent = extractYamlFromAgent(agentContent, true);
        if (!yamlContent) {
          throw new Error(`No YAML configuration found in agent ${agentId}`);
        }
        
        const agentConfig = yaml.load(yamlContent);
        
        const dependencies = {
          agent: {
            id: agentId,
            path: agentPath,
            content: agentContent,
            config: agentConfig
          },
          resources: []
        };
    
        // Personas are now embedded in agent configs, no need to resolve separately
    
        // Resolve other dependencies
        const depTypes = ['tasks', 'templates', 'checklists', 'data', 'utils'];
        for (const depType of depTypes) {
          const deps = agentConfig.dependencies?.[depType] || [];
          for (const depId of deps) {
            const resource = await this.loadResource(depType, depId);
            if (resource) dependencies.resources.push(resource);
          }
        }
    
        return dependencies;
      }
    
      async resolveTeamDependencies(teamId) {
        const teamPath = path.join(this.bmadCore, 'agent-teams', `${teamId}.yaml`);
        const teamContent = await fs.readFile(teamPath, 'utf8');
        const teamConfig = yaml.load(teamContent);
        
        const dependencies = {
          team: {
            id: teamId,
            path: teamPath,
            content: teamContent,
            config: teamConfig
          },
          agents: [],
          resources: new Map() // Use Map to deduplicate resources
        };
    
        // Always add bmad-orchestrator agent first if it's a team
        const bmadAgent = await this.resolveAgentDependencies('bmad-orchestrator');
        dependencies.agents.push(bmadAgent.agent);
        bmadAgent.resources.forEach(res => {
          dependencies.resources.set(res.path, res);
        });
    
        // Resolve all agents in the team
        let agentsToResolve = teamConfig.agents || [];
        
        // Handle wildcard "*" - include all agents except bmad-master
        if (agentsToResolve.includes('*')) {
          const allAgents = await this.listAgents();
          // Remove wildcard and add all agents except those already in the list and bmad-master
          agentsToResolve = agentsToResolve.filter(a => a !== '*');
          for (const agent of allAgents) {
            if (!agentsToResolve.includes(agent) && agent !== 'bmad-master') {
              agentsToResolve.push(agent);
            }
          }
        }
        
        for (const agentId of agentsToResolve) {
          if (agentId === 'bmad-orchestrator' || agentId === 'bmad-master') continue; // Already added or excluded
          const agentDeps = await this.resolveAgentDependencies(agentId);
          dependencies.agents.push(agentDeps.agent);
          
          // Add resources with deduplication
          agentDeps.resources.forEach(res => {
            dependencies.resources.set(res.path, res);
          });
        }
    
        // Resolve workflows
        for (const workflowId of teamConfig.workflows || []) {
          const resource = await this.loadResource('workflows', workflowId);
          if (resource) dependencies.resources.set(resource.path, resource);
        }
    
        // Convert Map back to array
        dependencies.resources = Array.from(dependencies.resources.values());
    
        return dependencies;
      }
    
      async loadResource(type, id) {
        const cacheKey = `${type}#${id}`;
        if (this.cache.has(cacheKey)) {
          return this.cache.get(cacheKey);
        }
    
        try {
          let content = null;
          let filePath = null;
    
          // First try bmad-core
          try {
            filePath = path.join(this.bmadCore, type, id);
            content = await fs.readFile(filePath, 'utf8');
          } catch (e) {
            // If not found in bmad-core, try common folder
            try {
              filePath = path.join(this.common, type, id);
              content = await fs.readFile(filePath, 'utf8');
            } catch (e2) {
              // File not found in either location
            }
          }
    
          if (!content) {
            console.warn(`Resource not found: ${type}/${id}`);
            return null;
          }
    
          const resource = {
            type,
            id,
            path: filePath,
            content
          };
    
          this.cache.set(cacheKey, resource);
          return resource;
        } catch (error) {
          console.error(`Error loading resource ${type}/${id}:`, error.message);
          return null;
        }
      }
    
      async listAgents() {
        try {
          const files = await fs.readdir(path.join(this.bmadCore, 'agents'));
          return files
            .filter(f => f.endsWith('.md'))
            .map(f => f.replace('.md', ''));
        } catch (error) {
          return [];
        }
      }
    
      async listTeams() {
        try {
          const files = await fs.readdir(path.join(this.bmadCore, 'agent-teams'));
          return files
            .filter(f => f.endsWith('.yaml'))
            .map(f => f.replace('.yaml', ''));
        } catch (error) {
          return [];
        }
      }
    }
    
    module.exports = DependencyResolver;
    
    ]]></file>
  <file path="installer\README.md"><![CDATA[
    # BMad Method Installer
    
    ## Usage
    
    ```bash
    # Interactive installation
    npx bmad-method install
    ```
    
    ]]></file>
  <file path="installer\package.json"><![CDATA[
    {
      "name": "bmad-method",
      "version": "4.33.1",
      "description": "BMad Method installer - AI-powered Agile development framework",
      "main": "lib/installer.js",
      "bin": {
        "bmad": "./bin/bmad.js",
        "bmad-method": "./bin/bmad.js"
      },
      "scripts": {
        "test": "echo \"Error: no test specified\" && exit 1"
      },
      "keywords": [
        "bmad",
        "agile",
        "ai",
        "development",
        "framework",
        "installer",
        "agents"
      ],
      "author": "BMad Team",
      "license": "MIT",
      "dependencies": {
        "chalk": "^5.4.1",
        "commander": "^14.0.0",
        "fs-extra": "^11.3.0",
        "inquirer": "^12.6.3",
        "js-yaml": "^4.1.0",
        "ora": "^8.2.0"
      },
      "engines": {
        "node": ">=20.0.0"
      },
      "repository": {
        "type": "git",
        "url": "https://github.com/bmad-team/bmad-method.git"
      },
      "bugs": {
        "url": "https://github.com/bmad-team/bmad-method/issues"
      },
      "homepage": "https://github.com/bmad-team/bmad-method#readme"
    }
    
    ]]></file>
  <file path="installer\package-lock.json"><![CDATA[
    {
      "name": "bmad-method",
      "version": "4.32.0",
      "lockfileVersion": 3,
      "requires": true,
      "packages": {
        "": {
          "name": "bmad-method",
          "version": "4.32.0",
          "license": "MIT",
          "dependencies": {
            "chalk": "^5.4.1",
            "commander": "^14.0.0",
            "fs-extra": "^11.3.0",
            "inquirer": "^12.6.3",
            "js-yaml": "^4.1.0",
            "ora": "^8.2.0"
          },
          "bin": {
            "bmad": "bin/bmad.js",
            "bmad-method": "bin/bmad.js"
          },
          "engines": {
            "node": ">=20.0.0"
          }
        },
        "node_modules/@inquirer/checkbox": {
          "version": "4.2.0",
          "resolved": "https://registry.npmjs.org/@inquirer/checkbox/-/checkbox-4.2.0.tgz",
          "integrity": "sha512-fdSw07FLJEU5vbpOPzXo5c6xmMGDzbZE2+niuDHX5N6mc6V0Ebso/q3xiHra4D73+PMsC8MJmcaZKuAAoaQsSA==",
          "license": "MIT",
          "dependencies": {
            "@inquirer/core": "^10.1.15",
            "@inquirer/figures": "^1.0.13",
            "@inquirer/type": "^3.0.8",
            "ansi-escapes": "^4.3.2",
            "yoctocolors-cjs": "^2.1.2"
          },
          "engines": {
            "node": ">=18"
          },
          "peerDependencies": {
            "@types/node": ">=18"
          },
          "peerDependenciesMeta": {
            "@types/node": {
              "optional": true
            }
          }
        },
        "node_modules/@inquirer/confirm": {
          "version": "5.1.14",
          "resolved": "https://registry.npmjs.org/@inquirer/confirm/-/confirm-5.1.14.tgz",
          "integrity": "sha512-5yR4IBfe0kXe59r1YCTG8WXkUbl7Z35HK87Sw+WUyGD8wNUx7JvY7laahzeytyE1oLn74bQnL7hstctQxisQ8Q==",
          "license": "MIT",
          "dependencies": {
            "@inquirer/core": "^10.1.15",
            "@inquirer/type": "^3.0.8"
          },
          "engines": {
            "node": ">=18"
          },
          "peerDependencies": {
            "@types/node": ">=18"
          },
          "peerDependenciesMeta": {
            "@types/node": {
              "optional": true
            }
          }
        },
        "node_modules/@inquirer/core": {
          "version": "10.1.15",
          "resolved": "https://registry.npmjs.org/@inquirer/core/-/core-10.1.15.tgz",
          "integrity": "sha512-8xrp836RZvKkpNbVvgWUlxjT4CraKk2q+I3Ksy+seI2zkcE+y6wNs1BVhgcv8VyImFecUhdQrYLdW32pAjwBdA==",
          "license": "MIT",
          "dependencies": {
            "@inquirer/figures": "^1.0.13",
            "@inquirer/type": "^3.0.8",
            "ansi-escapes": "^4.3.2",
            "cli-width": "^4.1.0",
            "mute-stream": "^2.0.0",
            "signal-exit": "^4.1.0",
            "wrap-ansi": "^6.2.0",
            "yoctocolors-cjs": "^2.1.2"
          },
          "engines": {
            "node": ">=18"
          },
          "peerDependencies": {
            "@types/node": ">=18"
          },
          "peerDependenciesMeta": {
            "@types/node": {
              "optional": true
            }
          }
        },
        "node_modules/@inquirer/editor": {
          "version": "4.2.15",
          "resolved": "https://registry.npmjs.org/@inquirer/editor/-/editor-4.2.15.tgz",
          "integrity": "sha512-wst31XT8DnGOSS4nNJDIklGKnf+8shuauVrWzgKegWUe28zfCftcWZ2vktGdzJgcylWSS2SrDnYUb6alZcwnCQ==",
          "license": "MIT",
          "dependencies": {
            "@inquirer/core": "^10.1.15",
            "@inquirer/type": "^3.0.8",
            "external-editor": "^3.1.0"
          },
          "engines": {
            "node": ">=18"
          },
          "peerDependencies": {
            "@types/node": ">=18"
          },
          "peerDependenciesMeta": {
            "@types/node": {
              "optional": true
            }
          }
        },
        "node_modules/@inquirer/expand": {
          "version": "4.0.17",
          "resolved": "https://registry.npmjs.org/@inquirer/expand/-/expand-4.0.17.tgz",
          "integrity": "sha512-PSqy9VmJx/VbE3CT453yOfNa+PykpKg/0SYP7odez1/NWBGuDXgPhp4AeGYYKjhLn5lUUavVS/JbeYMPdH50Mw==",
          "license": "MIT",
          "dependencies": {
            "@inquirer/core": "^10.1.15",
            "@inquirer/type": "^3.0.8",
            "yoctocolors-cjs": "^2.1.2"
          },
          "engines": {
            "node": ">=18"
          },
          "peerDependencies": {
            "@types/node": ">=18"
          },
          "peerDependenciesMeta": {
            "@types/node": {
              "optional": true
            }
          }
        },
        "node_modules/@inquirer/figures": {
          "version": "1.0.13",
          "resolved": "https://registry.npmjs.org/@inquirer/figures/-/figures-1.0.13.tgz",
          "integrity": "sha512-lGPVU3yO9ZNqA7vTYz26jny41lE7yoQansmqdMLBEfqaGsmdg7V3W9mK9Pvb5IL4EVZ9GnSDGMO/cJXud5dMaw==",
          "license": "MIT",
          "engines": {
            "node": ">=18"
          }
        },
        "node_modules/@inquirer/input": {
          "version": "4.2.1",
          "resolved": "https://registry.npmjs.org/@inquirer/input/-/input-4.2.1.tgz",
          "integrity": "sha512-tVC+O1rBl0lJpoUZv4xY+WGWY8V5b0zxU1XDsMsIHYregdh7bN5X5QnIONNBAl0K765FYlAfNHS2Bhn7SSOVow==",
          "license": "MIT",
          "dependencies": {
            "@inquirer/core": "^10.1.15",
            "@inquirer/type": "^3.0.8"
          },
          "engines": {
            "node": ">=18"
          },
          "peerDependencies": {
            "@types/node": ">=18"
          },
          "peerDependenciesMeta": {
            "@types/node": {
              "optional": true
            }
          }
        },
        "node_modules/@inquirer/number": {
          "version": "3.0.17",
          "resolved": "https://registry.npmjs.org/@inquirer/number/-/number-3.0.17.tgz",
          "integrity": "sha512-GcvGHkyIgfZgVnnimURdOueMk0CztycfC8NZTiIY9arIAkeOgt6zG57G+7vC59Jns3UX27LMkPKnKWAOF5xEYg==",
          "license": "MIT",
          "dependencies": {
            "@inquirer/core": "^10.1.15",
            "@inquirer/type": "^3.0.8"
          },
          "engines": {
            "node": ">=18"
          },
          "peerDependencies": {
            "@types/node": ">=18"
          },
          "peerDependenciesMeta": {
            "@types/node": {
              "optional": true
            }
          }
        },
        "node_modules/@inquirer/password": {
          "version": "4.0.17",
          "resolved": "https://registry.npmjs.org/@inquirer/password/-/password-4.0.17.tgz",
          "integrity": "sha512-DJolTnNeZ00E1+1TW+8614F7rOJJCM4y4BAGQ3Gq6kQIG+OJ4zr3GLjIjVVJCbKsk2jmkmv6v2kQuN/vriHdZA==",
          "license": "MIT",
          "dependencies": {
            "@inquirer/core": "^10.1.15",
            "@inquirer/type": "^3.0.8",
            "ansi-escapes": "^4.3.2"
          },
          "engines": {
            "node": ">=18"
          },
          "peerDependencies": {
            "@types/node": ">=18"
          },
          "peerDependenciesMeta": {
            "@types/node": {
              "optional": true
            }
          }
        },
        "node_modules/@inquirer/prompts": {
          "version": "7.7.1",
          "resolved": "https://registry.npmjs.org/@inquirer/prompts/-/prompts-7.7.1.tgz",
          "integrity": "sha512-XDxPrEWeWUBy8scAXzXuFY45r/q49R0g72bUzgQXZ1DY/xEFX+ESDMkTQolcb5jRBzaNJX2W8XQl6krMNDTjaA==",
          "license": "MIT",
          "dependencies": {
            "@inquirer/checkbox": "^4.2.0",
            "@inquirer/confirm": "^5.1.14",
            "@inquirer/editor": "^4.2.15",
            "@inquirer/expand": "^4.0.17",
            "@inquirer/input": "^4.2.1",
            "@inquirer/number": "^3.0.17",
            "@inquirer/password": "^4.0.17",
            "@inquirer/rawlist": "^4.1.5",
            "@inquirer/search": "^3.0.17",
            "@inquirer/select": "^4.3.1"
          },
          "engines": {
            "node": ">=18"
          },
          "peerDependencies": {
            "@types/node": ">=18"
          },
          "peerDependenciesMeta": {
            "@types/node": {
              "optional": true
            }
          }
        },
        "node_modules/@inquirer/rawlist": {
          "version": "4.1.5",
          "resolved": "https://registry.npmjs.org/@inquirer/rawlist/-/rawlist-4.1.5.tgz",
          "integrity": "sha512-R5qMyGJqtDdi4Ht521iAkNqyB6p2UPuZUbMifakg1sWtu24gc2Z8CJuw8rP081OckNDMgtDCuLe42Q2Kr3BolA==",
          "license": "MIT",
          "dependencies": {
            "@inquirer/core": "^10.1.15",
            "@inquirer/type": "^3.0.8",
            "yoctocolors-cjs": "^2.1.2"
          },
          "engines": {
            "node": ">=18"
          },
          "peerDependencies": {
            "@types/node": ">=18"
          },
          "peerDependenciesMeta": {
            "@types/node": {
              "optional": true
            }
          }
        },
        "node_modules/@inquirer/search": {
          "version": "3.0.17",
          "resolved": "https://registry.npmjs.org/@inquirer/search/-/search-3.0.17.tgz",
          "integrity": "sha512-CuBU4BAGFqRYors4TNCYzy9X3DpKtgIW4Boi0WNkm4Ei1hvY9acxKdBdyqzqBCEe4YxSdaQQsasJlFlUJNgojw==",
          "license": "MIT",
          "dependencies": {
            "@inquirer/core": "^10.1.15",
            "@inquirer/figures": "^1.0.13",
            "@inquirer/type": "^3.0.8",
            "yoctocolors-cjs": "^2.1.2"
          },
          "engines": {
            "node": ">=18"
          },
          "peerDependencies": {
            "@types/node": ">=18"
          },
          "peerDependenciesMeta": {
            "@types/node": {
              "optional": true
            }
          }
        },
        "node_modules/@inquirer/select": {
          "version": "4.3.1",
          "resolved": "https://registry.npmjs.org/@inquirer/select/-/select-4.3.1.tgz",
          "integrity": "sha512-Gfl/5sqOF5vS/LIrSndFgOh7jgoe0UXEizDqahFRkq5aJBLegZ6WjuMh/hVEJwlFQjyLq1z9fRtvUMkb7jM1LA==",
          "license": "MIT",
          "dependencies": {
            "@inquirer/core": "^10.1.15",
            "@inquirer/figures": "^1.0.13",
            "@inquirer/type": "^3.0.8",
            "ansi-escapes": "^4.3.2",
            "yoctocolors-cjs": "^2.1.2"
          },
          "engines": {
            "node": ">=18"
          },
          "peerDependencies": {
            "@types/node": ">=18"
          },
          "peerDependenciesMeta": {
            "@types/node": {
              "optional": true
            }
          }
        },
        "node_modules/@inquirer/type": {
          "version": "3.0.8",
          "resolved": "https://registry.npmjs.org/@inquirer/type/-/type-3.0.8.tgz",
          "integrity": "sha512-lg9Whz8onIHRthWaN1Q9EGLa/0LFJjyM8mEUbL1eTi6yMGvBf8gvyDLtxSXztQsxMvhxxNpJYrwa1YHdq+w4Jw==",
          "license": "MIT",
          "engines": {
            "node": ">=18"
          },
          "peerDependencies": {
            "@types/node": ">=18"
          },
          "peerDependenciesMeta": {
            "@types/node": {
              "optional": true
            }
          }
        },
        "node_modules/ansi-escapes": {
          "version": "4.3.2",
          "resolved": "https://registry.npmjs.org/ansi-escapes/-/ansi-escapes-4.3.2.tgz",
          "integrity": "sha512-gKXj5ALrKWQLsYG9jlTRmR/xKluxHV+Z9QEwNIgCfM1/uwPMCuzVVnh5mwTd+OuBZcwSIMbqssNWRm1lE51QaQ==",
          "license": "MIT",
          "dependencies": {
            "type-fest": "^0.21.3"
          },
          "engines": {
            "node": ">=8"
          },
          "funding": {
            "url": "https://github.com/sponsors/sindresorhus"
          }
        },
        "node_modules/ansi-regex": {
          "version": "6.1.0",
          "resolved": "https://registry.npmjs.org/ansi-regex/-/ansi-regex-6.1.0.tgz",
          "integrity": "sha512-7HSX4QQb4CspciLpVFwyRe79O3xsIZDDLER21kERQ71oaPodF8jL725AgJMFAYbooIqolJoRLuM81SpeUkpkvA==",
          "license": "MIT",
          "engines": {
            "node": ">=12"
          },
          "funding": {
            "url": "https://github.com/chalk/ansi-regex?sponsor=1"
          }
        },
        "node_modules/ansi-styles": {
          "version": "4.3.0",
          "resolved": "https://registry.npmjs.org/ansi-styles/-/ansi-styles-4.3.0.tgz",
          "integrity": "sha512-zbB9rCJAT1rbjiVDb2hqKFHNYLxgtk8NURxZ3IZwD3F6NtxbXZQCnnSi1Lkx+IDohdPlFp222wVALIheZJQSEg==",
          "license": "MIT",
          "dependencies": {
            "color-convert": "^2.0.1"
          },
          "engines": {
            "node": ">=8"
          },
          "funding": {
            "url": "https://github.com/chalk/ansi-styles?sponsor=1"
          }
        },
        "node_modules/argparse": {
          "version": "2.0.1",
          "resolved": "https://registry.npmjs.org/argparse/-/argparse-2.0.1.tgz",
          "integrity": "sha512-8+9WqebbFzpX9OR+Wa6O29asIogeRMzcGtAINdpMHHyAg10f05aSFVBbcEqGf/PXw1EjAZ+q2/bEBg3DvurK3Q==",
          "license": "Python-2.0"
        },
        "node_modules/chalk": {
          "version": "5.4.1",
          "resolved": "https://registry.npmjs.org/chalk/-/chalk-5.4.1.tgz",
          "integrity": "sha512-zgVZuo2WcZgfUEmsn6eO3kINexW8RAE4maiQ8QNs8CtpPCSyMiYsULR3HQYkm3w8FIA3SberyMJMSldGsW+U3w==",
          "license": "MIT",
          "engines": {
            "node": "^12.17.0 || ^14.13 || >=16.0.0"
          },
          "funding": {
            "url": "https://github.com/chalk/chalk?sponsor=1"
          }
        },
        "node_modules/chardet": {
          "version": "0.7.0",
          "resolved": "https://registry.npmjs.org/chardet/-/chardet-0.7.0.tgz",
          "integrity": "sha512-mT8iDcrh03qDGRRmoA2hmBJnxpllMR+0/0qlzjqZES6NdiWDcZkCNAk4rPFZ9Q85r27unkiNNg8ZOiwZXBHwcA==",
          "license": "MIT"
        },
        "node_modules/cli-cursor": {
          "version": "5.0.0",
          "resolved": "https://registry.npmjs.org/cli-cursor/-/cli-cursor-5.0.0.tgz",
          "integrity": "sha512-aCj4O5wKyszjMmDT4tZj93kxyydN/K5zPWSCe6/0AV/AA1pqe5ZBIw0a2ZfPQV7lL5/yb5HsUreJ6UFAF1tEQw==",
          "license": "MIT",
          "dependencies": {
            "restore-cursor": "^5.0.0"
          },
          "engines": {
            "node": ">=18"
          },
          "funding": {
            "url": "https://github.com/sponsors/sindresorhus"
          }
        },
        "node_modules/cli-spinners": {
          "version": "2.9.2",
          "resolved": "https://registry.npmjs.org/cli-spinners/-/cli-spinners-2.9.2.tgz",
          "integrity": "sha512-ywqV+5MmyL4E7ybXgKys4DugZbX0FC6LnwrhjuykIjnK9k8OQacQ7axGKnjDXWNhns0xot3bZI5h55H8yo9cJg==",
          "license": "MIT",
          "engines": {
            "node": ">=6"
          },
          "funding": {
            "url": "https://github.com/sponsors/sindresorhus"
          }
        },
        "node_modules/cli-width": {
          "version": "4.1.0",
          "resolved": "https://registry.npmjs.org/cli-width/-/cli-width-4.1.0.tgz",
          "integrity": "sha512-ouuZd4/dm2Sw5Gmqy6bGyNNNe1qt9RpmxveLSO7KcgsTnU7RXfsw+/bukWGo1abgBiMAic068rclZsO4IWmmxQ==",
          "license": "ISC",
          "engines": {
            "node": ">= 12"
          }
        },
        "node_modules/color-convert": {
          "version": "2.0.1",
          "resolved": "https://registry.npmjs.org/color-convert/-/color-convert-2.0.1.tgz",
          "integrity": "sha512-RRECPsj7iu/xb5oKYcsFHSppFNnsj/52OVTRKb4zP5onXwVF3zVmmToNcOfGC+CRDpfK/U584fMg38ZHCaElKQ==",
          "license": "MIT",
          "dependencies": {
            "color-name": "~1.1.4"
          },
          "engines": {
            "node": ">=7.0.0"
          }
        },
        "node_modules/color-name": {
          "version": "1.1.4",
          "resolved": "https://registry.npmjs.org/color-name/-/color-name-1.1.4.tgz",
          "integrity": "sha512-dOy+3AuW3a2wNbZHIuMZpTcgjGuLU/uBL/ubcZF9OXbDo8ff4O8yVp5Bf0efS8uEoYo5q4Fx7dY9OgQGXgAsQA==",
          "license": "MIT"
        },
        "node_modules/commander": {
          "version": "14.0.0",
          "resolved": "https://registry.npmjs.org/commander/-/commander-14.0.0.tgz",
          "integrity": "sha512-2uM9rYjPvyq39NwLRqaiLtWHyDC1FvryJDa2ATTVims5YAS4PupsEQsDvP14FqhFr0P49CYDugi59xaxJlTXRA==",
          "license": "MIT",
          "engines": {
            "node": ">=20"
          }
        },
        "node_modules/emoji-regex": {
          "version": "10.4.0",
          "resolved": "https://registry.npmjs.org/emoji-regex/-/emoji-regex-10.4.0.tgz",
          "integrity": "sha512-EC+0oUMY1Rqm4O6LLrgjtYDvcVYTy7chDnM4Q7030tP4Kwj3u/pR6gP9ygnp2CJMK5Gq+9Q2oqmrFJAz01DXjw==",
          "license": "MIT"
        },
        "node_modules/external-editor": {
          "version": "3.1.0",
          "resolved": "https://registry.npmjs.org/external-editor/-/external-editor-3.1.0.tgz",
          "integrity": "sha512-hMQ4CX1p1izmuLYyZqLMO/qGNw10wSv9QDCPfzXfyFrOaCSSoRfqE1Kf1s5an66J5JZC62NewG+mK49jOCtQew==",
          "license": "MIT",
          "dependencies": {
            "chardet": "^0.7.0",
            "iconv-lite": "^0.4.24",
            "tmp": "^0.0.33"
          },
          "engines": {
            "node": ">=4"
          }
        },
        "node_modules/fs-extra": {
          "version": "11.3.0",
          "resolved": "https://registry.npmjs.org/fs-extra/-/fs-extra-11.3.0.tgz",
          "integrity": "sha512-Z4XaCL6dUDHfP/jT25jJKMmtxvuwbkrD1vNSMFlo9lNLY2c5FHYSQgHPRZUjAB26TpDEoW9HCOgplrdbaPV/ew==",
          "license": "MIT",
          "dependencies": {
            "graceful-fs": "^4.2.0",
            "jsonfile": "^6.0.1",
            "universalify": "^2.0.0"
          },
          "engines": {
            "node": ">=14.14"
          }
        },
        "node_modules/get-east-asian-width": {
          "version": "1.3.0",
          "resolved": "https://registry.npmjs.org/get-east-asian-width/-/get-east-asian-width-1.3.0.tgz",
          "integrity": "sha512-vpeMIQKxczTD/0s2CdEWHcb0eeJe6TFjxb+J5xgX7hScxqrGuyjmv4c1D4A/gelKfyox0gJJwIHF+fLjeaM8kQ==",
          "license": "MIT",
          "engines": {
            "node": ">=18"
          },
          "funding": {
            "url": "https://github.com/sponsors/sindresorhus"
          }
        },
        "node_modules/graceful-fs": {
          "version": "4.2.11",
          "resolved": "https://registry.npmjs.org/graceful-fs/-/graceful-fs-4.2.11.tgz",
          "integrity": "sha512-RbJ5/jmFcNNCcDV5o9eTnBLJ/HszWV0P73bc+Ff4nS/rJj+YaS6IGyiOL0VoBYX+l1Wrl3k63h/KrH+nhJ0XvQ==",
          "license": "ISC"
        },
        "node_modules/iconv-lite": {
          "version": "0.4.24",
          "resolved": "https://registry.npmjs.org/iconv-lite/-/iconv-lite-0.4.24.tgz",
          "integrity": "sha512-v3MXnZAcvnywkTUEZomIActle7RXXeedOR31wwl7VlyoXO4Qi9arvSenNQWne1TcRwhCL1HwLI21bEqdpj8/rA==",
          "license": "MIT",
          "dependencies": {
            "safer-buffer": ">= 2.1.2 < 3"
          },
          "engines": {
            "node": ">=0.10.0"
          }
        },
        "node_modules/inquirer": {
          "version": "12.8.2",
          "resolved": "https://registry.npmjs.org/inquirer/-/inquirer-12.8.2.tgz",
          "integrity": "sha512-oBDL9f4+cDambZVJdfJu2M5JQfvaug9lbo6fKDlFV40i8t3FGA1Db67ov5Hp5DInG4zmXhHWTSnlXBntnJ7GMA==",
          "license": "MIT",
          "dependencies": {
            "@inquirer/core": "^10.1.15",
            "@inquirer/prompts": "^7.7.1",
            "@inquirer/type": "^3.0.8",
            "ansi-escapes": "^4.3.2",
            "mute-stream": "^2.0.0",
            "run-async": "^4.0.5",
            "rxjs": "^7.8.2"
          },
          "engines": {
            "node": ">=18"
          },
          "peerDependencies": {
            "@types/node": ">=18"
          },
          "peerDependenciesMeta": {
            "@types/node": {
              "optional": true
            }
          }
        },
        "node_modules/is-fullwidth-code-point": {
          "version": "3.0.0",
          "resolved": "https://registry.npmjs.org/is-fullwidth-code-point/-/is-fullwidth-code-point-3.0.0.tgz",
          "integrity": "sha512-zymm5+u+sCsSWyD9qNaejV3DFvhCKclKdizYaJUuHA83RLjb7nSuGnddCHGv0hk+KY7BMAlsWeK4Ueg6EV6XQg==",
          "license": "MIT",
          "engines": {
            "node": ">=8"
          }
        },
        "node_modules/is-interactive": {
          "version": "2.0.0",
          "resolved": "https://registry.npmjs.org/is-interactive/-/is-interactive-2.0.0.tgz",
          "integrity": "sha512-qP1vozQRI+BMOPcjFzrjXuQvdak2pHNUMZoeG2eRbiSqyvbEf/wQtEOTOX1guk6E3t36RkaqiSt8A/6YElNxLQ==",
          "license": "MIT",
          "engines": {
            "node": ">=12"
          },
          "funding": {
            "url": "https://github.com/sponsors/sindresorhus"
          }
        },
        "node_modules/is-unicode-supported": {
          "version": "2.1.0",
          "resolved": "https://registry.npmjs.org/is-unicode-supported/-/is-unicode-supported-2.1.0.tgz",
          "integrity": "sha512-mE00Gnza5EEB3Ds0HfMyllZzbBrmLOX3vfWoj9A9PEnTfratQ/BcaJOuMhnkhjXvb2+FkY3VuHqtAGpTPmglFQ==",
          "license": "MIT",
          "engines": {
            "node": ">=18"
          },
          "funding": {
            "url": "https://github.com/sponsors/sindresorhus"
          }
        },
        "node_modules/js-yaml": {
          "version": "4.1.0",
          "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-4.1.0.tgz",
          "integrity": "sha512-wpxZs9NoxZaJESJGIZTyDEaYpl0FKSA+FB9aJiyemKhMwkxQg63h4T1KJgUGHpTqPDNRcmmYLugrRjJlBtWvRA==",
          "license": "MIT",
          "dependencies": {
            "argparse": "^2.0.1"
          },
          "bin": {
            "js-yaml": "bin/js-yaml.js"
          }
        },
        "node_modules/jsonfile": {
          "version": "6.1.0",
          "resolved": "https://registry.npmjs.org/jsonfile/-/jsonfile-6.1.0.tgz",
          "integrity": "sha512-5dgndWOriYSm5cnYaJNhalLNDKOqFwyDB/rr1E9ZsGciGvKPs8R2xYGCacuf3z6K1YKDz182fd+fY3cn3pMqXQ==",
          "license": "MIT",
          "dependencies": {
            "universalify": "^2.0.0"
          },
          "optionalDependencies": {
            "graceful-fs": "^4.1.6"
          }
        },
        "node_modules/log-symbols": {
          "version": "6.0.0",
          "resolved": "https://registry.npmjs.org/log-symbols/-/log-symbols-6.0.0.tgz",
          "integrity": "sha512-i24m8rpwhmPIS4zscNzK6MSEhk0DUWa/8iYQWxhffV8jkI4Phvs3F+quL5xvS0gdQR0FyTCMMH33Y78dDTzzIw==",
          "license": "MIT",
          "dependencies": {
            "chalk": "^5.3.0",
            "is-unicode-supported": "^1.3.0"
          },
          "engines": {
            "node": ">=18"
          },
          "funding": {
            "url": "https://github.com/sponsors/sindresorhus"
          }
        },
        "node_modules/log-symbols/node_modules/is-unicode-supported": {
          "version": "1.3.0",
          "resolved": "https://registry.npmjs.org/is-unicode-supported/-/is-unicode-supported-1.3.0.tgz",
          "integrity": "sha512-43r2mRvz+8JRIKnWJ+3j8JtjRKZ6GmjzfaE/qiBJnikNnYv/6bagRJ1kUhNk8R5EX/GkobD+r+sfxCPJsiKBLQ==",
          "license": "MIT",
          "engines": {
            "node": ">=12"
          },
          "funding": {
            "url": "https://github.com/sponsors/sindresorhus"
          }
        },
        "node_modules/mimic-function": {
          "version": "5.0.1",
          "resolved": "https://registry.npmjs.org/mimic-function/-/mimic-function-5.0.1.tgz",
          "integrity": "sha512-VP79XUPxV2CigYP3jWwAUFSku2aKqBH7uTAapFWCBqutsbmDo96KY5o8uh6U+/YSIn5OxJnXp73beVkpqMIGhA==",
          "license": "MIT",
          "engines": {
            "node": ">=18"
          },
          "funding": {
            "url": "https://github.com/sponsors/sindresorhus"
          }
        },
        "node_modules/mute-stream": {
          "version": "2.0.0",
          "resolved": "https://registry.npmjs.org/mute-stream/-/mute-stream-2.0.0.tgz",
          "integrity": "sha512-WWdIxpyjEn+FhQJQQv9aQAYlHoNVdzIzUySNV1gHUPDSdZJ3yZn7pAAbQcV7B56Mvu881q9FZV+0Vx2xC44VWA==",
          "license": "ISC",
          "engines": {
            "node": "^18.17.0 || >=20.5.0"
          }
        },
        "node_modules/onetime": {
          "version": "7.0.0",
          "resolved": "https://registry.npmjs.org/onetime/-/onetime-7.0.0.tgz",
          "integrity": "sha512-VXJjc87FScF88uafS3JllDgvAm+c/Slfz06lorj2uAY34rlUu0Nt+v8wreiImcrgAjjIHp1rXpTDlLOGw29WwQ==",
          "license": "MIT",
          "dependencies": {
            "mimic-function": "^5.0.0"
          },
          "engines": {
            "node": ">=18"
          },
          "funding": {
            "url": "https://github.com/sponsors/sindresorhus"
          }
        },
        "node_modules/ora": {
          "version": "8.2.0",
          "resolved": "https://registry.npmjs.org/ora/-/ora-8.2.0.tgz",
          "integrity": "sha512-weP+BZ8MVNnlCm8c0Qdc1WSWq4Qn7I+9CJGm7Qali6g44e/PUzbjNqJX5NJ9ljlNMosfJvg1fKEGILklK9cwnw==",
          "license": "MIT",
          "dependencies": {
            "chalk": "^5.3.0",
            "cli-cursor": "^5.0.0",
            "cli-spinners": "^2.9.2",
            "is-interactive": "^2.0.0",
            "is-unicode-supported": "^2.0.0",
            "log-symbols": "^6.0.0",
            "stdin-discarder": "^0.2.2",
            "string-width": "^7.2.0",
            "strip-ansi": "^7.1.0"
          },
          "engines": {
            "node": ">=18"
          },
          "funding": {
            "url": "https://github.com/sponsors/sindresorhus"
          }
        },
        "node_modules/os-tmpdir": {
          "version": "1.0.2",
          "resolved": "https://registry.npmjs.org/os-tmpdir/-/os-tmpdir-1.0.2.tgz",
          "integrity": "sha512-D2FR03Vir7FIu45XBY20mTb+/ZSWB00sjU9jdQXt83gDrI4Ztz5Fs7/yy74g2N5SVQY4xY1qDr4rNddwYRVX0g==",
          "license": "MIT",
          "engines": {
            "node": ">=0.10.0"
          }
        },
        "node_modules/restore-cursor": {
          "version": "5.1.0",
          "resolved": "https://registry.npmjs.org/restore-cursor/-/restore-cursor-5.1.0.tgz",
          "integrity": "sha512-oMA2dcrw6u0YfxJQXm342bFKX/E4sG9rbTzO9ptUcR/e8A33cHuvStiYOwH7fszkZlZ1z/ta9AAoPk2F4qIOHA==",
          "license": "MIT",
          "dependencies": {
            "onetime": "^7.0.0",
            "signal-exit": "^4.1.0"
          },
          "engines": {
            "node": ">=18"
          },
          "funding": {
            "url": "https://github.com/sponsors/sindresorhus"
          }
        },
        "node_modules/run-async": {
          "version": "4.0.5",
          "resolved": "https://registry.npmjs.org/run-async/-/run-async-4.0.5.tgz",
          "integrity": "sha512-oN9GTgxUNDBumHTTDmQ8dep6VIJbgj9S3dPP+9XylVLIK4xB9XTXtKWROd5pnhdXR9k0EgO1JRcNh0T+Ny2FsA==",
          "license": "MIT",
          "engines": {
            "node": ">=0.12.0"
          }
        },
        "node_modules/rxjs": {
          "version": "7.8.2",
          "resolved": "https://registry.npmjs.org/rxjs/-/rxjs-7.8.2.tgz",
          "integrity": "sha512-dhKf903U/PQZY6boNNtAGdWbG85WAbjT/1xYoZIC7FAY0yWapOBQVsVrDl58W86//e1VpMNBtRV4MaXfdMySFA==",
          "license": "Apache-2.0",
          "dependencies": {
            "tslib": "^2.1.0"
          }
        },
        "node_modules/safer-buffer": {
          "version": "2.1.2",
          "resolved": "https://registry.npmjs.org/safer-buffer/-/safer-buffer-2.1.2.tgz",
          "integrity": "sha512-YZo3K82SD7Riyi0E1EQPojLz7kpepnSQI9IyPbHHg1XXXevb5dJI7tpyN2ADxGcQbHG7vcyRHk0cbwqcQriUtg==",
          "license": "MIT"
        },
        "node_modules/signal-exit": {
          "version": "4.1.0",
          "resolved": "https://registry.npmjs.org/signal-exit/-/signal-exit-4.1.0.tgz",
          "integrity": "sha512-bzyZ1e88w9O1iNJbKnOlvYTrWPDl46O1bG0D3XInv+9tkPrxrN8jUUTiFlDkkmKWgn1M6CfIA13SuGqOa9Korw==",
          "license": "ISC",
          "engines": {
            "node": ">=14"
          },
          "funding": {
            "url": "https://github.com/sponsors/isaacs"
          }
        },
        "node_modules/stdin-discarder": {
          "version": "0.2.2",
          "resolved": "https://registry.npmjs.org/stdin-discarder/-/stdin-discarder-0.2.2.tgz",
          "integrity": "sha512-UhDfHmA92YAlNnCfhmq0VeNL5bDbiZGg7sZ2IvPsXubGkiNa9EC+tUTsjBRsYUAz87btI6/1wf4XoVvQ3uRnmQ==",
          "license": "MIT",
          "engines": {
            "node": ">=18"
          },
          "funding": {
            "url": "https://github.com/sponsors/sindresorhus"
          }
        },
        "node_modules/string-width": {
          "version": "7.2.0",
          "resolved": "https://registry.npmjs.org/string-width/-/string-width-7.2.0.tgz",
          "integrity": "sha512-tsaTIkKW9b4N+AEj+SVA+WhJzV7/zMhcSu78mLKWSk7cXMOSHsBKFWUs0fWwq8QyK3MgJBQRX6Gbi4kYbdvGkQ==",
          "license": "MIT",
          "dependencies": {
            "emoji-regex": "^10.3.0",
            "get-east-asian-width": "^1.0.0",
            "strip-ansi": "^7.1.0"
          },
          "engines": {
            "node": ">=18"
          },
          "funding": {
            "url": "https://github.com/sponsors/sindresorhus"
          }
        },
        "node_modules/strip-ansi": {
          "version": "7.1.0",
          "resolved": "https://registry.npmjs.org/strip-ansi/-/strip-ansi-7.1.0.tgz",
          "integrity": "sha512-iq6eVVI64nQQTRYq2KtEg2d2uU7LElhTJwsH4YzIHZshxlgZms/wIc4VoDQTlG/IvVIrBKG06CrZnp0qv7hkcQ==",
          "license": "MIT",
          "dependencies": {
            "ansi-regex": "^6.0.1"
          },
          "engines": {
            "node": ">=12"
          },
          "funding": {
            "url": "https://github.com/chalk/strip-ansi?sponsor=1"
          }
        },
        "node_modules/tmp": {
          "version": "0.0.33",
          "resolved": "https://registry.npmjs.org/tmp/-/tmp-0.0.33.tgz",
          "integrity": "sha512-jRCJlojKnZ3addtTOjdIqoRuPEKBvNXcGYqzO6zWZX8KfKEpnGY5jfggJQ3EjKuu8D4bJRr0y+cYJFmYbImXGw==",
          "license": "MIT",
          "dependencies": {
            "os-tmpdir": "~1.0.2"
          },
          "engines": {
            "node": ">=0.6.0"
          }
        },
        "node_modules/tslib": {
          "version": "2.8.1",
          "resolved": "https://registry.npmjs.org/tslib/-/tslib-2.8.1.tgz",
          "integrity": "sha512-oJFu94HQb+KVduSUQL7wnpmqnfmLsOA/nAh6b6EH0wCEoK0/mPeXU6c3wKDV83MkOuHPRHtSXKKU99IBazS/2w==",
          "license": "0BSD"
        },
        "node_modules/type-fest": {
          "version": "0.21.3",
          "resolved": "https://registry.npmjs.org/type-fest/-/type-fest-0.21.3.tgz",
          "integrity": "sha512-t0rzBq87m3fVcduHDUFhKmyyX+9eo6WQjZvf51Ea/M0Q7+T374Jp1aUiyUl0GKxp8M/OETVHSDvmkyPgvX+X2w==",
          "license": "(MIT OR CC0-1.0)",
          "engines": {
            "node": ">=10"
          },
          "funding": {
            "url": "https://github.com/sponsors/sindresorhus"
          }
        },
        "node_modules/universalify": {
          "version": "2.0.1",
          "resolved": "https://registry.npmjs.org/universalify/-/universalify-2.0.1.tgz",
          "integrity": "sha512-gptHNQghINnc/vTGIk0SOFGFNXw7JVrlRUtConJRlvaw6DuX0wO5Jeko9sWrMBhh+PsYAZ7oXAiOnf/UKogyiw==",
          "license": "MIT",
          "engines": {
            "node": ">= 10.0.0"
          }
        },
        "node_modules/wrap-ansi": {
          "version": "6.2.0",
          "resolved": "https://registry.npmjs.org/wrap-ansi/-/wrap-ansi-6.2.0.tgz",
          "integrity": "sha512-r6lPcBGxZXlIcymEu7InxDMhdW0KDxpLgoFLcguasxCaJ/SOIZwINatK9KY/tf+ZrlywOKU0UDj3ATXUBfxJXA==",
          "license": "MIT",
          "dependencies": {
            "ansi-styles": "^4.0.0",
            "string-width": "^4.1.0",
            "strip-ansi": "^6.0.0"
          },
          "engines": {
            "node": ">=8"
          }
        },
        "node_modules/wrap-ansi/node_modules/ansi-regex": {
          "version": "5.0.1",
          "resolved": "https://registry.npmjs.org/ansi-regex/-/ansi-regex-5.0.1.tgz",
          "integrity": "sha512-quJQXlTSUGL2LH9SUXo8VwsY4soanhgo6LNSm84E1LBcE8s3O0wpdiRzyR9z/ZZJMlMWv37qOOb9pdJlMUEKFQ==",
          "license": "MIT",
          "engines": {
            "node": ">=8"
          }
        },
        "node_modules/wrap-ansi/node_modules/emoji-regex": {
          "version": "8.0.0",
          "resolved": "https://registry.npmjs.org/emoji-regex/-/emoji-regex-8.0.0.tgz",
          "integrity": "sha512-MSjYzcWNOA0ewAHpz0MxpYFvwg6yjy1NG3xteoqz644VCo/RPgnr1/GGt+ic3iJTzQ8Eu3TdM14SawnVUmGE6A==",
          "license": "MIT"
        },
        "node_modules/wrap-ansi/node_modules/string-width": {
          "version": "4.2.3",
          "resolved": "https://registry.npmjs.org/string-width/-/string-width-4.2.3.tgz",
          "integrity": "sha512-wKyQRQpjJ0sIp62ErSZdGsjMJWsap5oRNihHhu6G7JVO/9jIB6UyevL+tXuOqrng8j/cxKTWyWUwvSTriiZz/g==",
          "license": "MIT",
          "dependencies": {
            "emoji-regex": "^8.0.0",
            "is-fullwidth-code-point": "^3.0.0",
            "strip-ansi": "^6.0.1"
          },
          "engines": {
            "node": ">=8"
          }
        },
        "node_modules/wrap-ansi/node_modules/strip-ansi": {
          "version": "6.0.1",
          "resolved": "https://registry.npmjs.org/strip-ansi/-/strip-ansi-6.0.1.tgz",
          "integrity": "sha512-Y38VPSHcqkFrCpFnQ9vuSXmquuv5oXOKpGeT6aGrr3o3Gc9AlVa6JBfUSOCnbxGGZF+/0ooI7KrPuUSztUdU5A==",
          "license": "MIT",
          "dependencies": {
            "ansi-regex": "^5.0.1"
          },
          "engines": {
            "node": ">=8"
          }
        },
        "node_modules/yoctocolors-cjs": {
          "version": "2.1.2",
          "resolved": "https://registry.npmjs.org/yoctocolors-cjs/-/yoctocolors-cjs-2.1.2.tgz",
          "integrity": "sha512-cYVsTjKl8b+FrnidjibDWskAv7UKOfcwaVZdp/it9n1s9fU3IkgDbhdIRKCW4JDsAlECJY0ytoVPT3sK6kideA==",
          "license": "MIT",
          "engines": {
            "node": ">=18"
          },
          "funding": {
            "url": "https://github.com/sponsors/sindresorhus"
          }
        }
      }
    }
    
    ]]></file>
  <file path="flattener\main.js"><![CDATA[
    #!/usr/bin/env node
    
    const { Command } = require('commander');
    const fs = require('fs-extra');
    const path = require('node:path');
    const { glob } = require('glob');
    const { minimatch } = require('minimatch');
    
    /**
     * Recursively discover all files in a directory
     * @param {string} rootDir - The root directory to scan
     * @returns {Promise<string[]>} Array of file paths
     */
    async function discoverFiles(rootDir) {
      try {
        const gitignorePath = path.join(rootDir, '.gitignore');
        const gitignorePatterns = await parseGitignore(gitignorePath);
    
        // Common gitignore patterns that should always be ignored
        const commonIgnorePatterns = [
          // Version control
          '.git/**',
          '.svn/**',
          '.hg/**',
          '.bzr/**',
    
          // Dependencies
          'node_modules/**',
          'bower_components/**',
          'vendor/**',
          'packages/**',
    
          // Build outputs
          'build/**',
          'dist/**',
          'out/**',
          'target/**',
          'bin/**',
          'obj/**',
          'release/**',
          'debug/**',
    
          // Environment and config
          '.env',
          '.env.*',
          '*.env',
          '.config',
    
          // Logs
          'logs/**',
          '*.log',
          'npm-debug.log*',
          'yarn-debug.log*',
          'yarn-error.log*',
          'lerna-debug.log*',
    
          // Coverage and testing
          'coverage/**',
          '.nyc_output/**',
          '.coverage/**',
          'test-results/**',
          'junit.xml',
    
          // Cache directories
          '.cache/**',
          '.tmp/**',
          '.temp/**',
          'tmp/**',
          'temp/**',
          '.sass-cache/**',
          '.eslintcache',
          '.stylelintcache',
    
          // OS generated files
          '.DS_Store',
          '.DS_Store?',
          '._*',
          '.Spotlight-V100',
          '.Trashes',
          'ehthumbs.db',
          'Thumbs.db',
          'desktop.ini',
    
          // IDE and editor files
          '.vscode/**',
          '.idea/**',
          '*.swp',
          '*.swo',
          '*~',
          '.project',
          '.classpath',
          '.settings/**',
          '*.sublime-project',
          '*.sublime-workspace',
    
          // Package manager files
          'package-lock.json',
          'yarn.lock',
          'pnpm-lock.yaml',
          'composer.lock',
          'Pipfile.lock',
    
          // Runtime and compiled files
          '*.pyc',
          '*.pyo',
          '*.pyd',
          '__pycache__/**',
          '*.class',
          '*.jar',
          '*.war',
          '*.ear',
          '*.o',
          '*.so',
          '*.dll',
          '*.exe',
    
          // Documentation build
          '_site/**',
          '.jekyll-cache/**',
          '.jekyll-metadata',
    
          // Flattener specific outputs
          'flattened-codebase.xml',
          'repomix-output.xml'
        ];
    
        const combinedIgnores = [
          ...gitignorePatterns,
          ...commonIgnorePatterns
        ];
    
        // Use glob to recursively find all files, excluding common ignore patterns
        const files = await glob('**/*', {
          cwd: rootDir,
          nodir: true, // Only files, not directories
          dot: true,   // Include hidden files
          follow: false, // Don't follow symbolic links
          ignore: combinedIgnores
        });
    
        return files.map(file => path.resolve(rootDir, file));
      } catch (error) {
        console.error('Error discovering files:', error.message);
        return [];
      }
    }
    
    /**
     * Parse .gitignore file and return ignore patterns
     * @param {string} gitignorePath - Path to .gitignore file
     * @returns {Promise<string[]>} Array of ignore patterns
     */
    async function parseGitignore(gitignorePath) {
      try {
        if (!await fs.pathExists(gitignorePath)) {
          return [];
        }
    
        const content = await fs.readFile(gitignorePath, 'utf8');
        return content
          .split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('#')) // Remove empty lines and comments
          .map(pattern => {
            // Convert gitignore patterns to glob patterns
            if (pattern.endsWith('/')) {
              return pattern + '**';
            }
            return pattern;
          });
      } catch (error) {
        console.error('Error parsing .gitignore:', error.message);
        return [];
      }
    }
    
    /**
     * Check if a file is binary using file command and heuristics
     * @param {string} filePath - Path to the file
     * @returns {Promise<boolean>} True if file is binary
     */
    async function isBinaryFile(filePath) {
      try {
        // First check by file extension
        const binaryExtensions = [
          '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', '.svg',
          '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
          '.zip', '.tar', '.gz', '.rar', '.7z',
          '.exe', '.dll', '.so', '.dylib',
          '.mp3', '.mp4', '.avi', '.mov', '.wav',
          '.ttf', '.otf', '.woff', '.woff2',
          '.bin', '.dat', '.db', '.sqlite'
        ];
    
        const ext = path.extname(filePath).toLowerCase();
        if (binaryExtensions.includes(ext)) {
          return true;
        }
    
        // For files without clear extensions, try to read a small sample
        const stats = await fs.stat(filePath);
        if (stats.size === 0) {
          return false; // Empty files are considered text
        }
    
        // Read first 1024 bytes to check for null bytes
        const sampleSize = Math.min(1024, stats.size);
        const buffer = await fs.readFile(filePath, { encoding: null, flag: 'r' });
        const sample = buffer.slice(0, sampleSize);
        // If we find null bytes, it's likely binary
        return sample.includes(0);
      } catch (error) {
        console.warn(`Warning: Could not determine if file is binary: ${filePath} - ${error.message}`);
        return false; // Default to text if we can't determine
      }
    }
    
    /**
     * Read and aggregate content from text files
     * @param {string[]} files - Array of file paths
     * @param {string} rootDir - The root directory
     * @param {Object} spinner - Optional spinner instance for progress display
     * @returns {Promise<Object>} Object containing file contents and metadata
     */
    async function aggregateFileContents(files, rootDir, spinner = null) {
      const results = {
        textFiles: [],
        binaryFiles: [],
        errors: [],
        totalFiles: files.length,
        processedFiles: 0
      };
    
      for (const filePath of files) {
        try {
          const relativePath = path.relative(rootDir, filePath);
    
          // Update progress indicator
          if (spinner) {
            spinner.text = `Processing file ${results.processedFiles + 1}/${results.totalFiles}: ${relativePath}`;
          }
    
          const isBinary = await isBinaryFile(filePath);
    
          if (isBinary) {
            results.binaryFiles.push({
              path: relativePath,
              absolutePath: filePath,
              size: (await fs.stat(filePath)).size
            });
          } else {
            // Read text file content
            const content = await fs.readFile(filePath, 'utf8');
            results.textFiles.push({
              path: relativePath,
              absolutePath: filePath,
              content: content,
              size: content.length,
              lines: content.split('\n').length
            });
          }
    
          results.processedFiles++;
        } catch (error) {
          const relativePath = path.relative(rootDir, filePath);
          const errorInfo = {
            path: relativePath,
            absolutePath: filePath,
            error: error.message
          };
    
          results.errors.push(errorInfo);
    
          // Log warning without interfering with spinner
          if (spinner) {
            spinner.warn(`Warning: Could not read file ${relativePath}: ${error.message}`);
          } else {
            console.warn(`Warning: Could not read file ${relativePath}: ${error.message}`);
          }
    
          results.processedFiles++;
        }
      }
    
      return results;
    }
    
    /**
     * Generate XML output with aggregated file contents using streaming
     * @param {Object} aggregatedContent - The aggregated content object
     * @param {string} outputPath - The output file path
     * @returns {Promise<void>} Promise that resolves when writing is complete
     */
    async function generateXMLOutput(aggregatedContent, outputPath) {
      const { textFiles } = aggregatedContent;
    
      // Create write stream for efficient memory usage
      const writeStream = fs.createWriteStream(outputPath, { encoding: 'utf8' });
    
      return new Promise((resolve, reject) => {
        writeStream.on('error', reject);
        writeStream.on('finish', resolve);
    
        // Write XML header
        writeStream.write('<?xml version="1.0" encoding="UTF-8"?>\n');
        writeStream.write('<files>\n');
    
        // Process files one by one to minimize memory usage
        let fileIndex = 0;
    
        const writeNextFile = () => {
          if (fileIndex >= textFiles.length) {
            // All files processed, close XML and stream
            writeStream.write('</files>\n');
            writeStream.end();
            return;
          }
    
          const file = textFiles[fileIndex];
          fileIndex++;
    
          // Write file opening tag
          writeStream.write(`  <file path="${escapeXml(file.path)}">`);
    
          // Use CDATA for code content, handling CDATA end sequences properly
          if (file.content?.trim()) {
            const indentedContent = indentFileContent(file.content);
            if (file.content.includes(']]]]><![CDATA[>')) {
              // If content contains ]]]]><![CDATA[>, split it and wrap each part in CDATA
              writeStream.write(splitAndWrapCDATA(indentedContent));
            } else {
              writeStream.write(`<![CDATA[\n${indentedContent}\n    ]]]]><![CDATA[>`);
            }
          } else if (file.content) {
            // Handle empty or whitespace-only content
            const indentedContent = indentFileContent(file.content);
            writeStream.write(`<![CDATA[\n${indentedContent}\n    ]]]]><![CDATA[>`);
          }
    
          // Write file closing tag
          writeStream.write('</file>\n');
    
          // Continue with next file on next tick to avoid stack overflow
          setImmediate(writeNextFile);
        };
    
        // Start processing files
        writeNextFile();
      });
    }
    
    /**
     * Escape XML special characters for attributes
     * @param {string} str - String to escape
     * @returns {string} Escaped string
     */
    function escapeXml(str) {
      if (typeof str !== 'string') {
        return String(str);
      }
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    }
    
    /**
     * Indent file content with 4 spaces for each line
     * @param {string} content - Content to indent
     * @returns {string} Indented content
     */
    function indentFileContent(content) {
      if (typeof content !== 'string') {
        return String(content);
      }
    
      // Split content into lines and add 4 spaces of indentation to each line
      return content.split('\n').map(line => `    ${line}`).join('\n');
    }
    
    /**
     * Split content containing ]]]]><![CDATA[> and wrap each part in CDATA
     * @param {string} content - Content to process
     * @returns {string} Content with properly wrapped CDATA sections
     */
    function splitAndWrapCDATA(content) {
      if (typeof content !== 'string') {
        return String(content);
      }
    
      // Replace ]]]]><![CDATA[> with ]]]]]]><![CDATA[><![CDATA[> to escape it within CDATA
      const escapedContent = content.replace(/]]]]><![CDATA[>/g, ']]]]]]><![CDATA[><![CDATA[>');
      return `<![CDATA[
    ${escapedContent}
        ]]]]><![CDATA[>`;
    }
    
    /**
     * Calculate statistics for the processed files
     * @param {Object} aggregatedContent - The aggregated content object
     * @param {number} xmlFileSize - The size of the generated XML file in bytes
     * @returns {Object} Statistics object
     */
    function calculateStatistics(aggregatedContent, xmlFileSize) {
      const { textFiles, binaryFiles, errors } = aggregatedContent;
    
      // Calculate total file size in bytes
      const totalTextSize = textFiles.reduce((sum, file) => sum + file.size, 0);
      const totalBinarySize = binaryFiles.reduce((sum, file) => sum + file.size, 0);
      const totalSize = totalTextSize + totalBinarySize;
    
      // Calculate total lines of code
      const totalLines = textFiles.reduce((sum, file) => sum + file.lines, 0);
    
      // Estimate token count (rough approximation: 1 token ≈ 4 characters)
      const estimatedTokens = Math.ceil(xmlFileSize / 4);
    
      // Format file size
      const formatSize = (bytes) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      };
    
      return {
        totalFiles: textFiles.length + binaryFiles.length,
        textFiles: textFiles.length,
        binaryFiles: binaryFiles.length,
        errorFiles: errors.length,
        totalSize: formatSize(totalSize),
        xmlSize: formatSize(xmlFileSize),
        totalLines,
        estimatedTokens: estimatedTokens.toLocaleString()
      };
    }
    
    /**
     * Filter files based on .gitignore patterns
     * @param {string[]} files - Array of file paths
     * @param {string} rootDir - The root directory
     * @returns {Promise<string[]>} Filtered array of file paths
     */
    async function filterFiles(files, rootDir) {
      const gitignorePath = path.join(rootDir, '.gitignore');
      const ignorePatterns = await parseGitignore(gitignorePath);
    
      if (ignorePatterns.length === 0) {
        return files;
      }
    
      // Convert absolute paths to relative for pattern matching
      const relativeFiles = files.map(file => path.relative(rootDir, file));
    
      // Separate positive and negative patterns
      const positivePatterns = ignorePatterns.filter(p => !p.startsWith('!'));
      const negativePatterns = ignorePatterns.filter(p => p.startsWith('!')).map(p => p.slice(1));
    
      // Filter out files that match ignore patterns
      const filteredRelative = [];
    
      for (const file of relativeFiles) {
        let shouldIgnore = false;
    
        // First check positive patterns (ignore these files)
        for (const pattern of positivePatterns) {
          if (minimatch(file, pattern)) {
            shouldIgnore = true;
            break;
          }
        }
    
        // Then check negative patterns (don't ignore these files even if they match positive patterns)
        if (shouldIgnore) {
          for (const pattern of negativePatterns) {
            if (minimatch(file, pattern)) {
              shouldIgnore = false;
              break;
            }
          }
        }
    
        if (!shouldIgnore) {
          filteredRelative.push(file);
        }
      }
    
      // Convert back to absolute paths
      return filteredRelative.map(file => path.resolve(rootDir, file));
    }
    
    const program = new Command();
    
    program
      .name('bmad-flatten')
      .description('BMad-Method codebase flattener tool')
      .version('1.0.0')
      .option('-i, --input <path>', 'Input directory to flatten', process.cwd())
      .option('-o, --output <path>', 'Output file path', 'flattened-codebase.xml')
      .action(async (options) => {
        const inputDir = path.resolve(options.input);
        const outputPath = path.resolve(options.output);
        
        console.log(`Flattening codebase from: ${inputDir}`);
        console.log(`Output file: ${outputPath}`);
    
        try {
          // Verify input directory exists
          if (!await fs.pathExists(inputDir)) {
            console.error(`❌ Error: Input directory does not exist: ${inputDir}`);
            process.exit(1);
          }
    
          // Import ora dynamically
          const { default: ora } = await import('ora');
    
          // Start file discovery with spinner
          const discoverySpinner = ora('🔍 Discovering files...').start();
          const files = await discoverFiles(inputDir);
          const filteredFiles = await filterFiles(files, inputDir);
          discoverySpinner.succeed(`📁 Found ${filteredFiles.length} files to include`);
    
          // Process files with progress tracking
          console.log('Reading file contents');
          const processingSpinner = ora('📄 Processing files...').start();
          const aggregatedContent = await aggregateFileContents(filteredFiles, inputDir, processingSpinner);
          processingSpinner.succeed(`✅ Processed ${aggregatedContent.processedFiles}/${filteredFiles.length} files`);
    
          // Log processing results for test validation
          console.log(`Processed ${aggregatedContent.processedFiles}/${filteredFiles.length} files`);
          if (aggregatedContent.errors.length > 0) {
            console.log(`Errors: ${aggregatedContent.errors.length}`);
          }
          console.log(`Text files: ${aggregatedContent.textFiles.length}`);
          if (aggregatedContent.binaryFiles.length > 0) {
            console.log(`Binary files: ${aggregatedContent.binaryFiles.length}`);
          }
    
          // Generate XML output using streaming
          const xmlSpinner = ora('🔧 Generating XML output...').start();
          await generateXMLOutput(aggregatedContent, outputPath);
          xmlSpinner.succeed('📝 XML generation completed');
    
          // Calculate and display statistics
          const outputStats = await fs.stat(outputPath);
          const stats = calculateStatistics(aggregatedContent, outputStats.size);
    
          // Display completion summary
          console.log('\n📊 Completion Summary:');
          console.log(`✅ Successfully processed ${filteredFiles.length} files into ${path.basename(outputPath)}`);
          console.log(`📁 Output file: ${outputPath}`);
          console.log(`📏 Total source size: ${stats.totalSize}`);
          console.log(`📄 Generated XML size: ${stats.xmlSize}`);
          console.log(`📝 Total lines of code: ${stats.totalLines.toLocaleString()}`);
          console.log(`🔢 Estimated tokens: ${stats.estimatedTokens}`);
          console.log(`📊 File breakdown: ${stats.textFiles} text, ${stats.binaryFiles} binary, ${stats.errorFiles} errors`);
    
        } catch (error) {
          console.error('❌ Critical error:', error.message);
          console.error('An unexpected error occurred.');
          process.exit(1);
        }
      });
    
    if (require.main === module) {
      program.parse();
    }
    
    module.exports = program;
    
    ]]></file>
  <file path="builders\web-builder.js"><![CDATA[
    const fs = require("node:fs").promises;
    const path = require("node:path");
    const DependencyResolver = require("../lib/dependency-resolver");
    const yamlUtils = require("../lib/yaml-utils");
    
    class WebBuilder {
      constructor(options = {}) {
        this.rootDir = options.rootDir || process.cwd();
        this.outputDirs = options.outputDirs || [path.join(this.rootDir, "dist")];
        this.resolver = new DependencyResolver(this.rootDir);
        this.templatePath = path.join(
          this.rootDir,
          "tools",
          "md-assets",
          "web-agent-startup-instructions.md"
        );
      }
    
      parseYaml(content) {
        const yaml = require("js-yaml");
        return yaml.load(content);
      }
    
      convertToWebPath(filePath, bundleRoot = 'bmad-core') {
        // Convert absolute paths to web bundle paths with dot prefix
        // All resources get installed under the bundle root, so use that path
        const relativePath = path.relative(this.rootDir, filePath);
        const pathParts = relativePath.split(path.sep);
        
        let resourcePath;
        if (pathParts[0] === 'expansion-packs') {
          // For expansion packs, remove 'expansion-packs/packname' and use the rest
          resourcePath = pathParts.slice(2).join('/');
        } else {
          // For bmad-core, common, etc., remove the first part
          resourcePath = pathParts.slice(1).join('/');
        }
        
        return `.${bundleRoot}/${resourcePath}`;
      }
    
      generateWebInstructions(bundleType, packName = null) {
        // Generate dynamic web instructions based on bundle type
        const rootExample = packName ? `.${packName}` : '.bmad-core';
        const examplePath = packName ? `.${packName}/folder/filename.md` : '.bmad-core/folder/filename.md';
        const personasExample = packName ? `.${packName}/personas/analyst.md` : '.bmad-core/personas/analyst.md';
        const tasksExample = packName ? `.${packName}/tasks/create-story.md` : '.bmad-core/tasks/create-story.md';
        const utilsExample = packName ? `.${packName}/utils/template-format.md` : '.bmad-core/utils/template-format.md';
        const tasksRef = packName ? `.${packName}/tasks/create-story.md` : '.bmad-core/tasks/create-story.md';
    
        return `# Web Agent Bundle Instructions
    
    You are now operating as a specialized AI agent from the BMad-Method framework. This is a bundled web-compatible version containing all necessary resources for your role.
    
    ## Important Instructions
    
    1. **Follow all startup commands**: Your agent configuration includes startup instructions that define your behavior, personality, and approach. These MUST be followed exactly.
    
    2. **Resource Navigation**: This bundle contains all resources you need. Resources are marked with tags like:
    
    - \`==================== START: ${examplePath} ====================\`
    - \`==================== END: ${examplePath} ====================\`
    
    When you need to reference a resource mentioned in your instructions:
    
    - Look for the corresponding START/END tags
    - The format is always the full path with dot prefix (e.g., \`${personasExample}\`, \`${tasksExample}\`)
    - If a section is specified (e.g., \`{root}/tasks/create-story.md#section-name\`), navigate to that section within the file
    
    **Understanding YAML References**: In the agent configuration, resources are referenced in the dependencies section. For example:
    
    \`\`\`yaml
    dependencies:
      utils:
        - template-format
      tasks:
        - create-story
    \`\`\`
    
    These references map directly to bundle sections:
    
    - \`utils: template-format\` → Look for \`==================== START: ${utilsExample} ====================\`
    - \`tasks: create-story\` → Look for \`==================== START: ${tasksRef} ====================\`
    
    3. **Execution Context**: You are operating in a web environment. All your capabilities and knowledge are contained within this bundle. Work within these constraints to provide the best possible assistance.
    
    4. **Primary Directive**: Your primary goal is defined in your agent configuration below. Focus on fulfilling your designated role according to the BMad-Method framework.
    
    ---
    
    `;
      }
    
      async cleanOutputDirs() {
        for (const dir of this.outputDirs) {
          try {
            await fs.rm(dir, { recursive: true, force: true });
            console.log(`Cleaned: ${path.relative(this.rootDir, dir)}`);
          } catch (error) {
            console.debug(`Failed to clean directory ${dir}:`, error.message);
            // Directory might not exist, that's fine
          }
        }
      }
    
      async buildAgents() {
        const agents = await this.resolver.listAgents();
    
        for (const agentId of agents) {
          console.log(`  Building agent: ${agentId}`);
          const bundle = await this.buildAgentBundle(agentId);
    
          // Write to all output directories
          for (const outputDir of this.outputDirs) {
            const outputPath = path.join(outputDir, "agents");
            await fs.mkdir(outputPath, { recursive: true });
            const outputFile = path.join(outputPath, `${agentId}.txt`);
            await fs.writeFile(outputFile, bundle, "utf8");
          }
        }
    
        console.log(`Built ${agents.length} agent bundles in ${this.outputDirs.length} locations`);
      }
    
      async buildTeams() {
        const teams = await this.resolver.listTeams();
    
        for (const teamId of teams) {
          console.log(`  Building team: ${teamId}`);
          const bundle = await this.buildTeamBundle(teamId);
    
          // Write to all output directories
          for (const outputDir of this.outputDirs) {
            const outputPath = path.join(outputDir, "teams");
            await fs.mkdir(outputPath, { recursive: true });
            const outputFile = path.join(outputPath, `${teamId}.txt`);
            await fs.writeFile(outputFile, bundle, "utf8");
          }
        }
    
        console.log(`Built ${teams.length} team bundles in ${this.outputDirs.length} locations`);
      }
    
      async buildAgentBundle(agentId) {
        const dependencies = await this.resolver.resolveAgentDependencies(agentId);
        const template = this.generateWebInstructions('agent');
    
        const sections = [template];
    
        // Add agent configuration
        const agentPath = this.convertToWebPath(dependencies.agent.path, 'bmad-core');
        sections.push(this.formatSection(agentPath, dependencies.agent.content, 'bmad-core'));
    
        // Add all dependencies
        for (const resource of dependencies.resources) {
          const resourcePath = this.convertToWebPath(resource.path, 'bmad-core');
          sections.push(this.formatSection(resourcePath, resource.content, 'bmad-core'));
        }
    
        return sections.join("\n");
      }
    
      async buildTeamBundle(teamId) {
        const dependencies = await this.resolver.resolveTeamDependencies(teamId);
        const template = this.generateWebInstructions('team');
    
        const sections = [template];
    
        // Add team configuration
        const teamPath = this.convertToWebPath(dependencies.team.path, 'bmad-core');
        sections.push(this.formatSection(teamPath, dependencies.team.content, 'bmad-core'));
    
        // Add all agents
        for (const agent of dependencies.agents) {
          const agentPath = this.convertToWebPath(agent.path, 'bmad-core');
          sections.push(this.formatSection(agentPath, agent.content, 'bmad-core'));
        }
    
        // Add all deduplicated resources
        for (const resource of dependencies.resources) {
          const resourcePath = this.convertToWebPath(resource.path, 'bmad-core');
          sections.push(this.formatSection(resourcePath, resource.content, 'bmad-core'));
        }
    
        return sections.join("\n");
      }
    
      processAgentContent(content) {
        // First, replace content before YAML with the template
        const yamlContent = yamlUtils.extractYamlFromAgent(content);
        if (!yamlContent) return content;
    
        const yamlMatch = content.match(/```ya?ml\n([\s\S]*?)\n```/);
        if (!yamlMatch) return content;
        
        const yamlStartIndex = content.indexOf(yamlMatch[0]);
        const yamlEndIndex = yamlStartIndex + yamlMatch[0].length;
    
        // Parse YAML and remove root and IDE-FILE-RESOLUTION properties
        try {
          const yaml = require("js-yaml");
          const parsed = yaml.load(yamlContent);
    
          // Remove the properties if they exist at root level
          delete parsed.root;
          delete parsed["IDE-FILE-RESOLUTION"];
          delete parsed["REQUEST-RESOLUTION"];
    
          // Also remove from activation-instructions if they exist
          if (parsed["activation-instructions"] && Array.isArray(parsed["activation-instructions"])) {
            parsed["activation-instructions"] = parsed["activation-instructions"].filter(
              (instruction) => {
                return (
                  typeof instruction === 'string' &&
                  !instruction.startsWith("IDE-FILE-RESOLUTION:") &&
                  !instruction.startsWith("REQUEST-RESOLUTION:")
                );
              }
            );
          }
    
          // Reconstruct the YAML
          const cleanedYaml = yaml.dump(parsed, { lineWidth: -1 });
    
          // Get the agent name from the YAML for the header
          const agentName = parsed.agent?.id || "agent";
    
          // Build the new content with just the agent header and YAML
          const newHeader = `# ${agentName}\n\nCRITICAL: Read the full YAML, start activation to alter your state of being, follow startup section instructions, stay in this being until told to exit this mode:\n\n`;
          const afterYaml = content.substring(yamlEndIndex);
    
          return newHeader + "```yaml\n" + cleanedYaml.trim() + "\n```" + afterYaml;
        } catch (error) {
          console.warn("Failed to process agent YAML:", error.message);
          // If parsing fails, return original content
          return content;
        }
      }
    
      formatSection(path, content, bundleRoot = 'bmad-core') {
        const separator = "====================";
    
        // Process agent content if this is an agent file
        if (path.includes("/agents/")) {
          content = this.processAgentContent(content);
        }
    
        // Replace {root} references with the actual bundle root
        content = this.replaceRootReferences(content, bundleRoot);
    
        return [
          `${separator} START: ${path} ${separator}`,
          content.trim(),
          `${separator} END: ${path} ${separator}`,
          "",
        ].join("\n");
      }
    
      replaceRootReferences(content, bundleRoot) {
        // Replace {root} with the appropriate bundle root path
        return content.replace(/\{root\}/g, `.${bundleRoot}`);
      }
    
      async validate() {
        console.log("Validating agent configurations...");
        const agents = await this.resolver.listAgents();
        for (const agentId of agents) {
          try {
            await this.resolver.resolveAgentDependencies(agentId);
            console.log(`  ✓ ${agentId}`);
          } catch (error) {
            console.log(`  ✗ ${agentId}: ${error.message}`);
            throw error;
          }
        }
    
        console.log("\nValidating team configurations...");
        const teams = await this.resolver.listTeams();
        for (const teamId of teams) {
          try {
            await this.resolver.resolveTeamDependencies(teamId);
            console.log(`  ✓ ${teamId}`);
          } catch (error) {
            console.log(`  ✗ ${teamId}: ${error.message}`);
            throw error;
          }
        }
      }
    
      async buildAllExpansionPacks(options = {}) {
        const expansionPacks = await this.listExpansionPacks();
    
        for (const packName of expansionPacks) {
          console.log(`  Building expansion pack: ${packName}`);
          await this.buildExpansionPack(packName, options);
        }
    
        console.log(`Built ${expansionPacks.length} expansion pack bundles`);
      }
    
      async buildExpansionPack(packName, options = {}) {
        const packDir = path.join(this.rootDir, "expansion-packs", packName);
        const outputDirs = [path.join(this.rootDir, "dist", "expansion-packs", packName)];
    
        // Clean output directories if requested
        if (options.clean !== false) {
          for (const outputDir of outputDirs) {
            try {
              await fs.rm(outputDir, { recursive: true, force: true });
            } catch (error) {
              // Directory might not exist, that's fine
            }
          }
        }
    
        // Build individual agents first
        const agentsDir = path.join(packDir, "agents");
        try {
          const agentFiles = await fs.readdir(agentsDir);
          const agentMarkdownFiles = agentFiles.filter((f) => f.endsWith(".md"));
    
          if (agentMarkdownFiles.length > 0) {
            console.log(`    Building individual agents for ${packName}:`);
    
            for (const agentFile of agentMarkdownFiles) {
              const agentName = agentFile.replace(".md", "");
              console.log(`      - ${agentName}`);
    
              // Build individual agent bundle
              const bundle = await this.buildExpansionAgentBundle(packName, packDir, agentName);
    
              // Write to all output directories
              for (const outputDir of outputDirs) {
                const agentsOutputDir = path.join(outputDir, "agents");
                await fs.mkdir(agentsOutputDir, { recursive: true });
                const outputFile = path.join(agentsOutputDir, `${agentName}.txt`);
                await fs.writeFile(outputFile, bundle, "utf8");
              }
            }
          }
        } catch (error) {
          console.debug(`    No agents directory found for ${packName}`);
        }
    
        // Build team bundle
        const agentTeamsDir = path.join(packDir, "agent-teams");
        try {
          const teamFiles = await fs.readdir(agentTeamsDir);
          const teamFile = teamFiles.find((f) => f.endsWith(".yaml"));
    
          if (teamFile) {
            console.log(`    Building team bundle for ${packName}`);
            const teamConfigPath = path.join(agentTeamsDir, teamFile);
    
            // Build expansion pack as a team bundle
            const bundle = await this.buildExpansionTeamBundle(packName, packDir, teamConfigPath);
    
            // Write to all output directories
            for (const outputDir of outputDirs) {
              const teamsOutputDir = path.join(outputDir, "teams");
              await fs.mkdir(teamsOutputDir, { recursive: true });
              const outputFile = path.join(teamsOutputDir, teamFile.replace(".yaml", ".txt"));
              await fs.writeFile(outputFile, bundle, "utf8");
              console.log(`    ✓ Created bundle: ${path.relative(this.rootDir, outputFile)}`);
            }
          } else {
            console.warn(`    ⚠ No team configuration found in ${packName}/agent-teams/`);
          }
        } catch (error) {
          console.warn(`    ⚠ No agent-teams directory found for ${packName}`);
        }
      }
    
      async buildExpansionAgentBundle(packName, packDir, agentName) {
        const template = this.generateWebInstructions('expansion-agent', packName);
        const sections = [template];
    
        // Add agent configuration
        const agentPath = path.join(packDir, "agents", `${agentName}.md`);
        const agentContent = await fs.readFile(agentPath, "utf8");
        const agentWebPath = this.convertToWebPath(agentPath, packName);
        sections.push(this.formatSection(agentWebPath, agentContent, packName));
    
        // Resolve and add agent dependencies
        const yamlContent = yamlUtils.extractYamlFromAgent(agentContent);
        if (yamlContent) {
          try {
            const yaml = require("js-yaml");
            const agentConfig = yaml.load(yamlContent);
    
            if (agentConfig.dependencies) {
              // Add resources, first try expansion pack, then core
              for (const [resourceType, resources] of Object.entries(agentConfig.dependencies)) {
                if (Array.isArray(resources)) {
                  for (const resourceName of resources) {
                    let found = false;
    
                    // Try expansion pack first
                    const resourcePath = path.join(packDir, resourceType, resourceName);
                    try {
                      const resourceContent = await fs.readFile(resourcePath, "utf8");
                      const resourceWebPath = this.convertToWebPath(resourcePath, packName);
                      sections.push(
                        this.formatSection(resourceWebPath, resourceContent, packName)
                      );
                      found = true;
                    } catch (error) {
                      // Not in expansion pack, continue
                    }
    
                    // If not found in expansion pack, try core
                    if (!found) {
                      const corePath = path.join(
                        this.rootDir,
                        "bmad-core",
                        resourceType,
                        resourceName
                      );
                      try {
                        const coreContent = await fs.readFile(corePath, "utf8");
                        const coreWebPath = this.convertToWebPath(corePath, packName);
                        sections.push(
                          this.formatSection(coreWebPath, coreContent, packName)
                        );
                        found = true;
                      } catch (error) {
                        // Not in core either, continue
                      }
                    }
    
                    // If not found in core, try common folder
                    if (!found) {
                      const commonPath = path.join(
                        this.rootDir,
                        "common",
                        resourceType,
                        resourceName
                      );
                      try {
                        const commonContent = await fs.readFile(commonPath, "utf8");
                        const commonWebPath = this.convertToWebPath(commonPath, packName);
                        sections.push(
                          this.formatSection(commonWebPath, commonContent, packName)
                        );
                        found = true;
                      } catch (error) {
                        // Not in common either, continue
                      }
                    }
    
                    if (!found) {
                      console.warn(
                        `    ⚠ Dependency ${resourceType}#${resourceName} not found in expansion pack or core`
                      );
                    }
                  }
                }
              }
            }
          } catch (error) {
            console.debug(`Failed to parse agent YAML for ${agentName}:`, error.message);
          }
        }
    
        return sections.join("\n");
      }
    
      async buildExpansionTeamBundle(packName, packDir, teamConfigPath) {
        const template = this.generateWebInstructions('expansion-team', packName);
    
        const sections = [template];
    
        // Add team configuration and parse to get agent list
        const teamContent = await fs.readFile(teamConfigPath, "utf8");
        const teamFileName = path.basename(teamConfigPath, ".yaml");
        const teamConfig = this.parseYaml(teamContent);
        const teamWebPath = this.convertToWebPath(teamConfigPath, packName);
        sections.push(this.formatSection(teamWebPath, teamContent, packName));
    
        // Get list of expansion pack agents
        const expansionAgents = new Set();
        const agentsDir = path.join(packDir, "agents");
        try {
          const agentFiles = await fs.readdir(agentsDir);
          for (const agentFile of agentFiles.filter((f) => f.endsWith(".md"))) {
            const agentName = agentFile.replace(".md", "");
            expansionAgents.add(agentName);
          }
        } catch (error) {
          console.warn(`    ⚠ No agents directory found in ${packName}`);
        }
    
        // Build a map of all available expansion pack resources for override checking
        const expansionResources = new Map();
        const resourceDirs = ["templates", "tasks", "checklists", "workflows", "data"];
        for (const resourceDir of resourceDirs) {
          const resourcePath = path.join(packDir, resourceDir);
          try {
            const resourceFiles = await fs.readdir(resourcePath);
            for (const resourceFile of resourceFiles.filter(
              (f) => f.endsWith(".md") || f.endsWith(".yaml")
            )) {
              expansionResources.set(`${resourceDir}#${resourceFile}`, true);
            }
          } catch (error) {
            // Directory might not exist, that's fine
          }
        }
    
        // Process all agents listed in team configuration
        const agentsToProcess = teamConfig.agents || [];
    
        // Ensure bmad-orchestrator is always included for teams
        if (!agentsToProcess.includes("bmad-orchestrator")) {
          console.warn(`    ⚠ Team ${teamFileName} missing bmad-orchestrator, adding automatically`);
          agentsToProcess.unshift("bmad-orchestrator");
        }
    
        // Track all dependencies from all agents (deduplicated)
        const allDependencies = new Map();
    
        for (const agentId of agentsToProcess) {
          if (expansionAgents.has(agentId)) {
            // Use expansion pack version (override)
            const agentPath = path.join(agentsDir, `${agentId}.md`);
            const agentContent = await fs.readFile(agentPath, "utf8");
            const expansionAgentWebPath = this.convertToWebPath(agentPath, packName);
            sections.push(this.formatSection(expansionAgentWebPath, agentContent, packName));
    
            // Parse and collect dependencies from expansion agent
            const agentYaml = agentContent.match(/```yaml\n([\s\S]*?)\n```/);
            if (agentYaml) {
              try {
                const agentConfig = this.parseYaml(agentYaml[1]);
                if (agentConfig.dependencies) {
                  for (const [resourceType, resources] of Object.entries(agentConfig.dependencies)) {
                    if (Array.isArray(resources)) {
                      for (const resourceName of resources) {
                        const key = `${resourceType}#${resourceName}`;
                        if (!allDependencies.has(key)) {
                          allDependencies.set(key, { type: resourceType, name: resourceName });
                        }
                      }
                    }
                  }
                }
              } catch (error) {
                console.debug(`Failed to parse agent YAML for ${agentId}:`, error.message);
              }
            }
          } else {
            // Use core BMad version
            try {
              const coreAgentPath = path.join(this.rootDir, "bmad-core", "agents", `${agentId}.md`);
              const coreAgentContent = await fs.readFile(coreAgentPath, "utf8");
              const coreAgentWebPath = this.convertToWebPath(coreAgentPath, packName);
              sections.push(this.formatSection(coreAgentWebPath, coreAgentContent, packName));
    
              // Parse and collect dependencies from core agent
              const yamlContent = yamlUtils.extractYamlFromAgent(coreAgentContent, true);
              if (yamlContent) {
                try {
                  const agentConfig = this.parseYaml(yamlContent);
                  if (agentConfig.dependencies) {
                    for (const [resourceType, resources] of Object.entries(agentConfig.dependencies)) {
                      if (Array.isArray(resources)) {
                        for (const resourceName of resources) {
                          const key = `${resourceType}#${resourceName}`;
                          if (!allDependencies.has(key)) {
                            allDependencies.set(key, { type: resourceType, name: resourceName });
                          }
                        }
                      }
                    }
                  }
                } catch (error) {
                  console.debug(`Failed to parse agent YAML for ${agentId}:`, error.message);
                }
              }
            } catch (error) {
              console.warn(`    ⚠ Agent ${agentId} not found in core or expansion pack`);
            }
          }
        }
    
        // Add all collected dependencies from agents
        // Always prefer expansion pack versions if they exist
        for (const [key, dep] of allDependencies) {
          let found = false;
    
          // Always check expansion pack first, even if the dependency came from a core agent
          if (expansionResources.has(key)) {
            // We know it exists in expansion pack, find and load it
            const expansionPath = path.join(packDir, dep.type, dep.name);
            try {
              const content = await fs.readFile(expansionPath, "utf8");
              const expansionWebPath = this.convertToWebPath(expansionPath, packName);
              sections.push(this.formatSection(expansionWebPath, content, packName));
              console.log(`      ✓ Using expansion override for ${key}`);
              found = true;
            } catch (error) {
              // Try next extension
            }
          }
    
          // If not found in expansion pack (or doesn't exist there), try core
          if (!found) {
            const corePath = path.join(this.rootDir, "bmad-core", dep.type, dep.name);
            try {
              const content = await fs.readFile(corePath, "utf8");
              const coreWebPath = this.convertToWebPath(corePath, packName);
              sections.push(this.formatSection(coreWebPath, content, packName));
              found = true;
            } catch (error) {
              // Not in core either, continue
            }
          }
    
          // If not found in core, try common folder
          if (!found) {
            const commonPath = path.join(this.rootDir, "common", dep.type, dep.name);
            try {
              const content = await fs.readFile(commonPath, "utf8");
              const commonWebPath = this.convertToWebPath(commonPath, packName);
              sections.push(this.formatSection(commonWebPath, content, packName));
              found = true;
            } catch (error) {
              // Not in common either, continue
            }
          }
    
          if (!found) {
            console.warn(`    ⚠ Dependency ${key} not found in expansion pack or core`);
          }
        }
    
        // Add remaining expansion pack resources not already included as dependencies
        for (const resourceDir of resourceDirs) {
          const resourcePath = path.join(packDir, resourceDir);
          try {
            const resourceFiles = await fs.readdir(resourcePath);
            for (const resourceFile of resourceFiles.filter(
              (f) => f.endsWith(".md") || f.endsWith(".yaml")
            )) {
              const filePath = path.join(resourcePath, resourceFile);
              const fileContent = await fs.readFile(filePath, "utf8");
              const fileName = resourceFile.replace(/\.(md|yaml)$/, "");
    
              // Only add if not already included as a dependency
              const resourceKey = `${resourceDir}#${fileName}`;
              if (!allDependencies.has(resourceKey)) {
                const fullResourcePath = path.join(resourcePath, resourceFile);
                const resourceWebPath = this.convertToWebPath(fullResourcePath, packName);
                sections.push(this.formatSection(resourceWebPath, fileContent, packName));
              }
            }
          } catch (error) {
            // Directory might not exist, that's fine
          }
        }
    
        return sections.join("\n");
      }
    
      async listExpansionPacks() {
        const expansionPacksDir = path.join(this.rootDir, "expansion-packs");
        try {
          const entries = await fs.readdir(expansionPacksDir, { withFileTypes: true });
          return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
        } catch (error) {
          console.warn("No expansion-packs directory found");
          return [];
        }
      }
    
      listAgents() {
        return this.resolver.listAgents();
      }
    }
    
    module.exports = WebBuilder;
    
    ]]></file>
  <file path="installer\lib\resource-locator.js"><![CDATA[
    /**
     * Resource Locator - Centralized file path resolution and caching
     * Reduces duplicate file system operations and memory usage
     */
    
    const path = require('node:path');
    const fs = require('fs-extra');
    const moduleManager = require('./module-manager');
    
    class ResourceLocator {
      constructor() {
        this._pathCache = new Map();
        this._globCache = new Map();
        this._bmadCorePath = null;
        this._expansionPacksPath = null;
      }
    
      /**
       * Get the base path for bmad-core
       */
      getBmadCorePath() {
        if (!this._bmadCorePath) {
          this._bmadCorePath = path.join(__dirname, '../../../bmad-core');
        }
        return this._bmadCorePath;
      }
    
      /**
       * Get the base path for expansion packs
       */
      getExpansionPacksPath() {
        if (!this._expansionPacksPath) {
          this._expansionPacksPath = path.join(__dirname, '../../../expansion-packs');
        }
        return this._expansionPacksPath;
      }
    
      /**
       * Find all files matching a pattern, with caching
       * @param {string} pattern - Glob pattern
       * @param {Object} options - Glob options
       * @returns {Promise<string[]>} Array of matched file paths
       */
      async findFiles(pattern, options = {}) {
        const cacheKey = `${pattern}:${JSON.stringify(options)}`;
        
        if (this._globCache.has(cacheKey)) {
          return this._globCache.get(cacheKey);
        }
    
        const { glob } = await moduleManager.getModules(['glob']);
        const files = await glob(pattern, options);
        
        // Cache for 5 minutes
        this._globCache.set(cacheKey, files);
        setTimeout(() => this._globCache.delete(cacheKey), 5 * 60 * 1000);
        
        return files;
      }
    
      /**
       * Get agent path with caching
       * @param {string} agentId - Agent identifier
       * @returns {Promise<string|null>} Path to agent file or null if not found
       */
      async getAgentPath(agentId) {
        const cacheKey = `agent:${agentId}`;
        
        if (this._pathCache.has(cacheKey)) {
          return this._pathCache.get(cacheKey);
        }
    
        // Check in bmad-core
        let agentPath = path.join(this.getBmadCorePath(), 'agents', `${agentId}.md`);
        if (await fs.pathExists(agentPath)) {
          this._pathCache.set(cacheKey, agentPath);
          return agentPath;
        }
    
        // Check in expansion packs
        const expansionPacks = await this.getExpansionPacks();
        for (const pack of expansionPacks) {
          agentPath = path.join(pack.path, 'agents', `${agentId}.md`);
          if (await fs.pathExists(agentPath)) {
            this._pathCache.set(cacheKey, agentPath);
            return agentPath;
          }
        }
    
        return null;
      }
    
      /**
       * Get available agents with metadata
       * @returns {Promise<Array>} Array of agent objects
       */
      async getAvailableAgents() {
        const cacheKey = 'all-agents';
        
        if (this._pathCache.has(cacheKey)) {
          return this._pathCache.get(cacheKey);
        }
    
        const agents = [];
        const yaml = require('js-yaml');
        const { extractYamlFromAgent } = require('../../lib/yaml-utils');
    
        // Get agents from bmad-core
        const coreAgents = await this.findFiles('agents/*.md', {
          cwd: this.getBmadCorePath()
        });
    
        for (const agentFile of coreAgents) {
          const content = await fs.readFile(
            path.join(this.getBmadCorePath(), agentFile),
            'utf8'
          );
          const yamlContent = extractYamlFromAgent(content);
          if (yamlContent) {
            try {
              const metadata = yaml.load(yamlContent);
              agents.push({
                id: path.basename(agentFile, '.md'),
                name: metadata.agent_name || path.basename(agentFile, '.md'),
                description: metadata.description || 'No description available',
                source: 'core'
              });
            } catch (e) {
              // Skip invalid agents
            }
          }
        }
    
        // Cache for 10 minutes
        this._pathCache.set(cacheKey, agents);
        setTimeout(() => this._pathCache.delete(cacheKey), 10 * 60 * 1000);
    
        return agents;
      }
    
      /**
       * Get available expansion packs
       * @returns {Promise<Array>} Array of expansion pack objects
       */
      async getExpansionPacks() {
        const cacheKey = 'expansion-packs';
        
        if (this._pathCache.has(cacheKey)) {
          return this._pathCache.get(cacheKey);
        }
    
        const packs = [];
        const expansionPacksPath = this.getExpansionPacksPath();
    
        if (await fs.pathExists(expansionPacksPath)) {
          const entries = await fs.readdir(expansionPacksPath, { withFileTypes: true });
          
          for (const entry of entries) {
            if (entry.isDirectory()) {
              const configPath = path.join(expansionPacksPath, entry.name, 'config.yaml');
              if (await fs.pathExists(configPath)) {
                try {
                  const yaml = require('js-yaml');
                  const config = yaml.load(await fs.readFile(configPath, 'utf8'));
                  packs.push({
                    id: entry.name,
                    name: config.name || entry.name,
                    version: config.version || '1.0.0',
                    description: config.description || 'No description available',
                    shortTitle: config['short-title'] || config.description || 'No description available',
                    author: config.author || 'Unknown',
                    path: path.join(expansionPacksPath, entry.name)
                  });
                } catch (e) {
                  // Skip invalid packs
                }
              }
            }
          }
        }
    
        // Cache for 10 minutes
        this._pathCache.set(cacheKey, packs);
        setTimeout(() => this._pathCache.delete(cacheKey), 10 * 60 * 1000);
    
        return packs;
      }
    
      /**
       * Get team configuration
       * @param {string} teamId - Team identifier
       * @returns {Promise<Object|null>} Team configuration or null
       */
      async getTeamConfig(teamId) {
        const cacheKey = `team:${teamId}`;
        
        if (this._pathCache.has(cacheKey)) {
          return this._pathCache.get(cacheKey);
        }
    
        const teamPath = path.join(this.getBmadCorePath(), 'agent-teams', `${teamId}.yaml`);
        
        if (await fs.pathExists(teamPath)) {
          try {
            const yaml = require('js-yaml');
            const content = await fs.readFile(teamPath, 'utf8');
            const config = yaml.load(content);
            this._pathCache.set(cacheKey, config);
            return config;
          } catch (e) {
            return null;
          }
        }
    
        return null;
      }
    
      /**
       * Get resource dependencies for an agent
       * @param {string} agentId - Agent identifier
       * @returns {Promise<Object>} Dependencies object
       */
      async getAgentDependencies(agentId) {
        const cacheKey = `deps:${agentId}`;
        
        if (this._pathCache.has(cacheKey)) {
          return this._pathCache.get(cacheKey);
        }
    
        const agentPath = await this.getAgentPath(agentId);
        if (!agentPath) {
          return { all: [], byType: {} };
        }
    
        const content = await fs.readFile(agentPath, 'utf8');
        const { extractYamlFromAgent } = require('../../lib/yaml-utils');
        const yamlContent = extractYamlFromAgent(content);
    
        if (!yamlContent) {
          return { all: [], byType: {} };
        }
    
        try {
          const yaml = require('js-yaml');
          const metadata = yaml.load(yamlContent);
          const dependencies = metadata.dependencies || {};
          
          // Flatten dependencies
          const allDeps = [];
          const byType = {};
          
          for (const [type, deps] of Object.entries(dependencies)) {
            if (Array.isArray(deps)) {
              byType[type] = deps;
              for (const dep of deps) {
                allDeps.push(`.bmad-core/${type}/${dep}`);
              }
            }
          }
    
          const result = { all: allDeps, byType };
          this._pathCache.set(cacheKey, result);
          return result;
        } catch (e) {
          return { all: [], byType: {} };
        }
      }
    
      /**
       * Clear all caches to free memory
       */
      clearCache() {
        this._pathCache.clear();
        this._globCache.clear();
      }
    
      /**
       * Get IDE configuration
       * @param {string} ideId - IDE identifier
       * @returns {Promise<Object|null>} IDE configuration or null
       */
      async getIdeConfig(ideId) {
        const cacheKey = `ide:${ideId}`;
        
        if (this._pathCache.has(cacheKey)) {
          return this._pathCache.get(cacheKey);
        }
    
        const idePath = path.join(this.getBmadCorePath(), 'ide-rules', `${ideId}.yaml`);
        
        if (await fs.pathExists(idePath)) {
          try {
            const yaml = require('js-yaml');
            const content = await fs.readFile(idePath, 'utf8');
            const config = yaml.load(content);
            this._pathCache.set(cacheKey, config);
            return config;
          } catch (e) {
            return null;
          }
        }
    
        return null;
      }
    }
    
    // Singleton instance
    const resourceLocator = new ResourceLocator();
    
    module.exports = resourceLocator;
    ]]></file>
  <file path="installer\lib\module-manager.js"><![CDATA[
    /**
     * Module Manager - Centralized dynamic import management
     * Handles loading and caching of ES modules to reduce memory overhead
     */
    
    class ModuleManager {
      constructor() {
        this._cache = new Map();
        this._loadingPromises = new Map();
      }
    
      /**
       * Initialize all commonly used ES modules at once
       * @returns {Promise<Object>} Object containing all loaded modules
       */
      async initializeCommonModules() {
        const modules = await Promise.all([
          this.getModule('chalk'),
          this.getModule('ora'),
          this.getModule('inquirer')
        ]);
    
        return {
          chalk: modules[0],
          ora: modules[1],
          inquirer: modules[2]
        };
      }
    
      /**
       * Get a module by name, with caching
       * @param {string} moduleName - Name of the module to load
       * @returns {Promise<any>} The loaded module
       */
      async getModule(moduleName) {
        // Return from cache if available
        if (this._cache.has(moduleName)) {
          return this._cache.get(moduleName);
        }
    
        // If already loading, return the existing promise
        if (this._loadingPromises.has(moduleName)) {
          return this._loadingPromises.get(moduleName);
        }
    
        // Start loading the module
        const loadPromise = this._loadModule(moduleName);
        this._loadingPromises.set(moduleName, loadPromise);
    
        try {
          const module = await loadPromise;
          this._cache.set(moduleName, module);
          this._loadingPromises.delete(moduleName);
          return module;
        } catch (error) {
          this._loadingPromises.delete(moduleName);
          throw error;
        }
      }
    
      /**
       * Internal method to load a specific module
       * @private
       */
      async _loadModule(moduleName) {
        switch (moduleName) {
          case 'chalk':
            return (await import('chalk')).default;
          case 'ora':
            return (await import('ora')).default;
          case 'inquirer':
            return (await import('inquirer')).default;
          case 'glob':
            return (await import('glob')).glob;
          case 'globSync':
            return (await import('glob')).globSync;
          default:
            throw new Error(`Unknown module: ${moduleName}`);
        }
      }
    
      /**
       * Clear the module cache to free memory
       */
      clearCache() {
        this._cache.clear();
        this._loadingPromises.clear();
      }
    
      /**
       * Get multiple modules at once
       * @param {string[]} moduleNames - Array of module names
       * @returns {Promise<Object>} Object with module names as keys
       */
      async getModules(moduleNames) {
        const modules = await Promise.all(
          moduleNames.map(name => this.getModule(name))
        );
    
        return moduleNames.reduce((acc, name, index) => {
          acc[name] = modules[index];
          return acc;
        }, {});
      }
    }
    
    // Singleton instance
    const moduleManager = new ModuleManager();
    
    module.exports = moduleManager;
    ]]></file>
  <file path="installer\lib\memory-profiler.js"><![CDATA[
    /**
     * Memory Profiler - Track memory usage during installation
     * Helps identify memory leaks and optimize resource usage
     */
    
    const v8 = require('v8');
    
    class MemoryProfiler {
      constructor() {
        this.checkpoints = [];
        this.startTime = Date.now();
        this.peakMemory = 0;
      }
    
      /**
       * Create a memory checkpoint
       * @param {string} label - Label for this checkpoint
       */
      checkpoint(label) {
        const memUsage = process.memoryUsage();
        const heapStats = v8.getHeapStatistics();
        
        const checkpoint = {
          label,
          timestamp: Date.now() - this.startTime,
          memory: {
            rss: this.formatBytes(memUsage.rss),
            heapTotal: this.formatBytes(memUsage.heapTotal),
            heapUsed: this.formatBytes(memUsage.heapUsed),
            external: this.formatBytes(memUsage.external),
            arrayBuffers: this.formatBytes(memUsage.arrayBuffers || 0)
          },
          heap: {
            totalHeapSize: this.formatBytes(heapStats.total_heap_size),
            usedHeapSize: this.formatBytes(heapStats.used_heap_size),
            heapSizeLimit: this.formatBytes(heapStats.heap_size_limit),
            mallocedMemory: this.formatBytes(heapStats.malloced_memory),
            externalMemory: this.formatBytes(heapStats.external_memory)
          },
          raw: {
            heapUsed: memUsage.heapUsed
          }
        };
    
        // Track peak memory
        if (memUsage.heapUsed > this.peakMemory) {
          this.peakMemory = memUsage.heapUsed;
        }
    
        this.checkpoints.push(checkpoint);
        return checkpoint;
      }
    
      /**
       * Force garbage collection (requires --expose-gc flag)
       */
      forceGC() {
        if (global.gc) {
          global.gc();
          return true;
        }
        return false;
      }
    
      /**
       * Get memory usage summary
       */
      getSummary() {
        const currentMemory = process.memoryUsage();
        
        return {
          currentUsage: {
            rss: this.formatBytes(currentMemory.rss),
            heapTotal: this.formatBytes(currentMemory.heapTotal),
            heapUsed: this.formatBytes(currentMemory.heapUsed)
          },
          peakMemory: this.formatBytes(this.peakMemory),
          totalCheckpoints: this.checkpoints.length,
          runTime: `${((Date.now() - this.startTime) / 1000).toFixed(2)}s`
        };
      }
    
      /**
       * Get detailed report of memory usage
       */
      getDetailedReport() {
        const summary = this.getSummary();
        const memoryGrowth = this.calculateMemoryGrowth();
        
        return {
          summary,
          memoryGrowth,
          checkpoints: this.checkpoints,
          recommendations: this.getRecommendations(memoryGrowth)
        };
      }
    
      /**
       * Calculate memory growth between checkpoints
       */
      calculateMemoryGrowth() {
        if (this.checkpoints.length < 2) return [];
        
        const growth = [];
        for (let i = 1; i < this.checkpoints.length; i++) {
          const prev = this.checkpoints[i - 1];
          const curr = this.checkpoints[i];
          
          const heapDiff = curr.raw.heapUsed - prev.raw.heapUsed;
          
          growth.push({
            from: prev.label,
            to: curr.label,
            heapGrowth: this.formatBytes(Math.abs(heapDiff)),
            isIncrease: heapDiff > 0,
            timeDiff: `${((curr.timestamp - prev.timestamp) / 1000).toFixed(2)}s`
          });
        }
        
        return growth;
      }
    
      /**
       * Get recommendations based on memory usage
       */
      getRecommendations(memoryGrowth) {
        const recommendations = [];
        
        // Check for large memory growth
        const largeGrowths = memoryGrowth.filter(g => {
          const bytes = this.parseBytes(g.heapGrowth);
          return bytes > 50 * 1024 * 1024; // 50MB
        });
        
        if (largeGrowths.length > 0) {
          recommendations.push({
            type: 'warning',
            message: `Large memory growth detected in ${largeGrowths.length} operations`,
            details: largeGrowths.map(g => `${g.from} → ${g.to}: ${g.heapGrowth}`)
          });
        }
        
        // Check peak memory
        if (this.peakMemory > 500 * 1024 * 1024) { // 500MB
          recommendations.push({
            type: 'warning',
            message: `High peak memory usage: ${this.formatBytes(this.peakMemory)}`,
            suggestion: 'Consider processing files in smaller batches'
          });
        }
        
        // Check for potential memory leaks
        const continuousGrowth = this.checkContinuousGrowth();
        if (continuousGrowth) {
          recommendations.push({
            type: 'error',
            message: 'Potential memory leak detected',
            details: 'Memory usage continuously increases without significant decreases'
          });
        }
        
        return recommendations;
      }
    
      /**
       * Check for continuous memory growth (potential leak)
       */
      checkContinuousGrowth() {
        if (this.checkpoints.length < 5) return false;
        
        let increasingCount = 0;
        for (let i = 1; i < this.checkpoints.length; i++) {
          if (this.checkpoints[i].raw.heapUsed > this.checkpoints[i - 1].raw.heapUsed) {
            increasingCount++;
          }
        }
        
        // If memory increases in more than 80% of checkpoints, might be a leak
        return increasingCount / (this.checkpoints.length - 1) > 0.8;
      }
    
      /**
       * Format bytes to human-readable string
       */
      formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
      }
    
      /**
       * Parse human-readable bytes back to number
       */
      parseBytes(str) {
        const match = str.match(/^([\d.]+)\s*([KMGT]?B?)$/i);
        if (!match) return 0;
        
        const value = parseFloat(match[1]);
        const unit = match[2].toUpperCase();
        
        const multipliers = {
          'B': 1,
          'KB': 1024,
          'MB': 1024 * 1024,
          'GB': 1024 * 1024 * 1024
        };
        
        return value * (multipliers[unit] || 1);
      }
    
      /**
       * Clear checkpoints to free memory
       */
      clear() {
        this.checkpoints = [];
      }
    }
    
    // Export singleton instance
    module.exports = new MemoryProfiler();
    ]]></file>
  <file path="installer\lib\installer.js"><![CDATA[
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
          // Always use package.json version
          const packagePath = path.join(__dirname, '..', '..', '..', 'package.json');
          const packageJson = require(packagePath);
          return packageJson.version;
        } catch (error) {
          console.warn("Could not read version from package.json, using 'unknown'");
          return "unknown";
        }
      }
    
      async install(config) {
        const spinner = ora("Analyzing installation directory...").start();
        
        try {
          // Store the original CWD where npx was executed
          const originalCwd = process.env.INIT_CWD || process.env.PWD || process.cwd();
          
          // Resolve installation directory relative to where the user ran the command
          let installDir = path.isAbsolute(config.directory) 
            ? config.directory 
            : path.resolve(originalCwd, config.directory);
            
          if (path.basename(installDir) === '.bmad-core') {
            // If user points directly to .bmad-core, treat its parent as the project root
            installDir = path.dirname(installDir);
          }
          
          // Log resolved path for clarity
          if (!path.isAbsolute(config.directory)) {
            spinner.text = `Resolving "${config.directory}" to: ${installDir}`;
          }
    
          // Check if directory exists and handle non-existent directories
          if (!(await fileManager.pathExists(installDir))) {
            spinner.stop();
            console.log(`\nThe directory ${installDir} does not exist.`);
            
            const { action } = await inquirer.prompt([
              {
                type: 'list',
                name: 'action',
                message: 'What would you like to do?',
                choices: [
                  {
                    name: 'Create the directory and continue',
                    value: 'create'
                  },
                  {
                    name: 'Choose a different directory',
                    value: 'change'
                  },
                  {
                    name: 'Cancel installation',
                    value: 'cancel'
                  }
                ]
              }
            ]);
    
            if (action === 'cancel') {
                console.log('Installation cancelled.');
              process.exit(0);
            } else if (action === 'change') {
              const { newDirectory } = await inquirer.prompt([
                {
                  type: 'input',
                  name: 'newDirectory',
                  message: 'Enter the new directory path:',
                  validate: (input) => {
                    if (!input.trim()) {
                      return 'Please enter a valid directory path';
                    }
                    return true;
                  }
                }
              ]);
              // Preserve the original CWD for the recursive call
              config.directory = newDirectory;
              return await this.install(config); // Recursive call with new directory
            } else if (action === 'create') {
              try {
                await fileManager.ensureDirectory(installDir);
                console.log(`✓ Created directory: ${installDir}`);
              } catch (error) {
                console.error(`Failed to create directory: ${error.message}`);
                console.error('You may need to check permissions or use a different path.');
                process.exit(1);
              }
            }
            
            spinner.start("Analyzing installation directory...");
          }
    
          // If this is an update request from early detection, handle it directly
          if (config.installType === 'update') {
            const state = await this.detectInstallationState(installDir);
            if (state.type === 'v4_existing') {
              return await this.performUpdate(config, installDir, state.manifest, spinner);
            } else {
              spinner.fail('No existing v4 installation found to update');
              throw new Error('No existing v4 installation found');
            }
          }
    
          // Detect current state
          const state = await this.detectInstallationState(installDir);
    
          // Handle different states
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
          // Check if modules were initialized
          if (spinner) {
            spinner.fail("Installation failed");
          } else {
            console.error("Installation failed:", error.message);
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
    
        // Check if directory exists
        if (!(await fileManager.pathExists(installDir))) {
          return state; // clean install
        }
    
        // Check for V4 installation (has .bmad-core with manifest)
        const bmadCorePath = path.join(installDir, ".bmad-core");
        const manifestPath = path.join(bmadCorePath, "install-manifest.yaml");
    
        if (await fileManager.pathExists(manifestPath)) {
          state.type = "v4_existing";
          state.hasV4Manifest = true;
          state.hasBmadCore = true;
          state.manifest = await fileManager.readManifest(installDir);
          return state;
        }
    
        // Check for V3 installation (has bmad-agent directory)
        const bmadAgentPath = path.join(installDir, "bmad-agent");
        if (await fileManager.pathExists(bmadAgentPath)) {
          state.type = "v3_existing";
          state.hasV3Structure = true;
          return state;
        }
    
        // Check for .bmad-core without manifest (broken V4 or manual copy)
        if (await fileManager.pathExists(bmadCorePath)) {
          state.type = "unknown_existing";
          state.hasBmadCore = true;
          return state;
        }
    
        // Check if directory has other files
        const files = await resourceLocator.findFiles("**/*", {
          cwd: installDir,
          nodir: true,
          ignore: ["**/.git/**", "**/node_modules/**"],
        });
    
        if (files.length > 0) {
          // Directory has other files, but no BMad installation.
          // Treat as clean install but record that it isn't empty.
          state.hasOtherFiles = true;
        }
    
        // Check for expansion packs (folders starting with .)
        const expansionPacks = await this.detectExpansionPacks(installDir);
        state.expansionPacks = expansionPacks;
    
        return state; // clean install
      }
    
      async performFreshInstall(config, installDir, spinner, options = {}) {
        spinner.text = "Installing BMad Method...";
    
        let files = [];
    
        if (config.installType === "full") {
          // Full installation - copy entire .bmad-core folder as a subdirectory
          spinner.text = "Copying complete .bmad-core folder...";
          const sourceDir = resourceLocator.getBmadCorePath();
          const bmadCoreDestDir = path.join(installDir, ".bmad-core");
          await fileManager.copyDirectoryWithRootReplacement(sourceDir, bmadCoreDestDir, ".bmad-core");
          
          // Copy common/ items to .bmad-core
          spinner.text = "Copying common utilities...";
          await this.copyCommonItems(installDir, ".bmad-core", spinner);
    
          // Get list of all files for manifest
          const foundFiles = await resourceLocator.findFiles("**/*", {
            cwd: bmadCoreDestDir,
            nodir: true,
            ignore: ["**/.git/**", "**/node_modules/**"],
          });
          files = foundFiles.map((file) => path.join(".bmad-core", file));
        } else if (config.installType === "single-agent") {
          // Single agent installation
          spinner.text = `Installing ${config.agent} agent...`;
    
          // Copy agent file with {root} replacement
          const agentPath = configLoader.getAgentPath(config.agent);
          const destAgentPath = path.join(
            installDir,
            ".bmad-core",
            "agents",
            `${config.agent}.md`
          );
          await fileManager.copyFileWithRootReplacement(agentPath, destAgentPath, ".bmad-core");
          files.push(`.bmad-core/agents/${config.agent}.md`);
    
          // Copy dependencies
          const { all: dependencies } = await resourceLocator.getAgentDependencies(
            config.agent
          );
          const sourceBase = resourceLocator.getBmadCorePath();
    
          for (const dep of dependencies) {
            spinner.text = `Copying dependency: ${dep}`;
    
            if (dep.includes("*")) {
              // Handle glob patterns with {root} replacement
              const copiedFiles = await fileManager.copyGlobPattern(
                dep.replace(".bmad-core/", ""),
                sourceBase,
                path.join(installDir, ".bmad-core"),
                ".bmad-core"
              );
              files.push(...copiedFiles.map(f => `.bmad-core/${f}`));
            } else {
              // Handle single files with {root} replacement if needed
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
          
          // Copy common/ items to .bmad-core
          spinner.text = "Copying common utilities...";
          const commonFiles = await this.copyCommonItems(installDir, ".bmad-core", spinner);
          files.push(...commonFiles);
        } else if (config.installType === "team") {
          // Team installation
          spinner.text = `Installing ${config.team} team...`;
          
          // Get team dependencies
          const teamDependencies = await configLoader.getTeamDependencies(config.team);
          const sourceBase = resourceLocator.getBmadCorePath();
          
          // Install all team dependencies
          for (const dep of teamDependencies) {
            spinner.text = `Copying team dependency: ${dep}`;
            
            if (dep.includes("*")) {
              // Handle glob patterns with {root} replacement
              const copiedFiles = await fileManager.copyGlobPattern(
                dep.replace(".bmad-core/", ""),
                sourceBase,
                path.join(installDir, ".bmad-core"),
                ".bmad-core"
              );
              files.push(...copiedFiles.map(f => `.bmad-core/${f}`));
            } else {
              // Handle single files with {root} replacement if needed
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
          
          // Copy common/ items to .bmad-core
          spinner.text = "Copying common utilities...";
          const commonFiles = await this.copyCommonItems(installDir, ".bmad-core", spinner);
          files.push(...commonFiles);
        } else if (config.installType === "expansion-only") {
          // Expansion-only installation - DO NOT create .bmad-core
          // Only install expansion packs
          spinner.text = "Installing expansion packs only...";
        }
    
        // Install expansion packs if requested
        const expansionFiles = await this.installExpansionPacks(installDir, config.expansionPacks, spinner, config);
        files.push(...expansionFiles);
    
        // Install web bundles if requested
        if (config.includeWebBundles && config.webBundlesDirectory) {
          spinner.text = "Installing web bundles...";
          // Resolve web bundles directory using the same logic as the main installation directory
          const originalCwd = process.env.INIT_CWD || process.env.PWD || process.cwd();
          let resolvedWebBundlesDir = path.isAbsolute(config.webBundlesDirectory) 
            ? config.webBundlesDirectory 
            : path.resolve(originalCwd, config.webBundlesDirectory);
          await this.installWebBundles(resolvedWebBundlesDir, config, spinner);
        }
    
        // Set up IDE integration if requested
        const ides = config.ides || (config.ide ? [config.ide] : []);
        if (ides.length > 0) {
          for (const ide of ides) {
            spinner.text = `Setting up ${ide} integration...`;
            const preConfiguredSettings = ide === 'github-copilot' ? config.githubCopilotConfig : null;
            await ideSetup.setup(ide, installDir, config.agent, spinner, preConfiguredSettings);
          }
        }
    
        // Modify core-config.yaml if sharding preferences were provided
        if (config.installType !== "expansion-only" && (config.prdSharded !== undefined || config.architectureSharded !== undefined)) {
          spinner.text = "Configuring document sharding settings...";
          await fileManager.modifyCoreConfig(installDir, config);
        }
    
        // Create manifest (skip for expansion-only installations)
        if (config.installType !== "expansion-only") {
          spinner.text = "Creating installation manifest...";
          await fileManager.createManifest(installDir, config, files);
        }
    
        spinner.succeed("Installation complete!");
        this.showSuccessMessage(config, installDir, options);
      }
    
      async handleExistingV4Installation(config, installDir, state, spinner) {
        spinner.stop();
    
        const currentVersion = state.manifest.version;
        const newVersion = await this.getCoreVersion();
        const versionCompare = this.compareVersions(currentVersion, newVersion);
    
        console.log(chalk.yellow("\n🔍 Found existing BMad v4 installation"));
        console.log(`   Directory: ${installDir}`);
        console.log(`   Current version: ${currentVersion}`);
        console.log(`   Available version: ${newVersion}`);
        console.log(
          `   Installed: ${new Date(
            state.manifest.installed_at
          ).toLocaleDateString()}`
        );
    
        // Check file integrity
        spinner.start("Checking installation integrity...");
        const integrity = await fileManager.checkFileIntegrity(installDir, state.manifest);
        spinner.stop();
        
        const hasMissingFiles = integrity.missing.length > 0;
        const hasModifiedFiles = integrity.modified.length > 0;
        const hasIntegrityIssues = hasMissingFiles || hasModifiedFiles;
        
        if (hasIntegrityIssues) {
            console.log(chalk.red("\n⚠️  Installation issues detected:"));
          if (hasMissingFiles) {
            console.log(chalk.red(`   Missing files: ${integrity.missing.length}`));
            if (integrity.missing.length <= 5) {
              integrity.missing.forEach(file => console.log(chalk.dim(`     - ${file}`)));
            }
          }
          if (hasModifiedFiles) {
            console.log(chalk.yellow(`   Modified files: ${integrity.modified.length}`));
            if (integrity.modified.length <= 5) {
              integrity.modified.forEach(file => console.log(chalk.dim(`     - ${file}`)));
            }
          }
        }
    
        // Show existing expansion packs
        if (Object.keys(state.expansionPacks).length > 0) {
          console.log(chalk.cyan("\n📦 Installed expansion packs:"));
          for (const [packId, packInfo] of Object.entries(state.expansionPacks)) {
            if (packInfo.hasManifest && packInfo.manifest) {
              console.log(`   - ${packId} (v${packInfo.manifest.version || 'unknown'})`);
            } else {
              console.log(`   - ${packId} (no manifest)`);
            }
          }
        }
    
        let choices = [];
        
        if (versionCompare < 0) {
            console.log(chalk.cyan("\n⬆️  Upgrade available for BMad core"));
          choices.push({ name: `Upgrade BMad core (v${currentVersion} → v${newVersion})`, value: "upgrade" });
        } else if (versionCompare === 0) {
          if (hasIntegrityIssues) {
            // Offer repair option when files are missing or modified
            choices.push({ 
              name: "Repair installation (restore missing/modified files)", 
              value: "repair" 
            });
          }
            console.log(chalk.yellow("\n⚠️  Same version already installed"));
          choices.push({ name: `Force reinstall BMad core (v${currentVersion} - reinstall)`, value: "reinstall" });
        } else {
            console.log(chalk.yellow("\n⬇️  Installed version is newer than available"));
          choices.push({ name: `Downgrade BMad core (v${currentVersion} → v${newVersion})`, value: "reinstall" });
        }
        
        choices.push(
          { name: "Add/update expansion packs only", value: "expansions" },
          { name: "Cancel", value: "cancel" }
        );
    
        const { action } = await inquirer.prompt([
          {
            type: "list",
            name: "action",
            message: "What would you like to do?",
            choices: choices,
          },
        ]);
    
        switch (action) {
          case "upgrade":
            return await this.performUpdate(config, installDir, state.manifest, spinner);
          case "repair":
            // For repair, restore missing/modified files while backing up modified ones
            return await this.performRepair(config, installDir, state.manifest, integrity, spinner);
          case "reinstall":
            // For reinstall, don't check for modifications - just overwrite
            return await this.performReinstall(config, installDir, spinner);
          case "expansions": {
            // Ask which expansion packs to install
            const availableExpansionPacks = await resourceLocator.getExpansionPacks();
            
            if (availableExpansionPacks.length === 0) {
              console.log(chalk.yellow("No expansion packs available."));
              return;
            }
            
            const { selectedPacks } = await inquirer.prompt([
              {
                type: 'checkbox',
                name: 'selectedPacks',
                message: 'Select expansion packs to install/update:',
                choices: availableExpansionPacks.map(pack => ({
                  name: `${pack.name} (v${pack.version}) .${pack.id}`,
                  value: pack.id,
                  checked: state.expansionPacks[pack.id] !== undefined
                }))
              }
            ]);
            
            if (selectedPacks.length === 0) {
              console.log(chalk.yellow("No expansion packs selected."));
              return;
            }
            
            spinner.start("Installing expansion packs...");
            const expansionFiles = await this.installExpansionPacks(installDir, selectedPacks, spinner, { ides: config.ides || [] });
            spinner.succeed("Expansion packs installed successfully!");
            
            console.log(chalk.green("\n✓ Installation complete!"));
            console.log(chalk.green(`✓ Expansion packs installed/updated:`));
            for (const packId of selectedPacks) {
              console.log(chalk.green(`  - ${packId} → .${packId}/`));
            }
            return;
          }
          case "cancel":
            console.log("Installation cancelled.");
            return;
        }
      }
    
      async handleV3Installation(config, installDir, state, spinner) {
        spinner.stop();
    
        console.log(
          chalk.yellow("\n🔍 Found BMad v3 installation (bmad-agent/ directory)")
        );
        console.log(`   Directory: ${installDir}`);
    
        const { action } = await inquirer.prompt([
          {
            type: "list",
            name: "action",
            message: "What would you like to do?",
            choices: [
              { name: "Upgrade from v3 to v4 (recommended)", value: "upgrade" },
              { name: "Install v4 alongside v3", value: "alongside" },
              { name: "Cancel", value: "cancel" },
            ],
          },
        ]);
    
        switch (action) {
          case "upgrade": {
            console.log(chalk.cyan("\n📦 Starting v3 to v4 upgrade process..."));
            const V3ToV4Upgrader = require("../../upgraders/v3-to-v4-upgrader");
            const upgrader = new V3ToV4Upgrader();
            return await upgrader.upgrade({ 
              projectPath: installDir,
              ides: config.ides || [] // Pass IDE selections from initial config
            });
          }
          case "alongside":
            return await this.performFreshInstall(config, installDir, spinner);
          case "cancel":
            console.log("Installation cancelled.");
            return;
        }
      }
    
      async handleUnknownInstallation(config, installDir, state, spinner) {
        spinner.stop();
    
        console.log(chalk.yellow("\n⚠️  Directory contains existing files"));
        console.log(`   Directory: ${installDir}`);
    
        if (state.hasBmadCore) {
          console.log("   Found: .bmad-core directory (but no manifest)");
        }
        if (state.hasOtherFiles) {
          console.log("   Found: Other files in directory");
        }
    
        const { action } = await inquirer.prompt([
          {
            type: "list",
            name: "action",
            message: "What would you like to do?",
            choices: [
              { name: "Install anyway (may overwrite files)", value: "force" },
              { name: "Choose different directory", value: "different" },
              { name: "Cancel", value: "cancel" },
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
                message: "Enter new installation directory:",
                default: path.join(path.dirname(installDir), "bmad-project"),
              },
            ]);
            config.directory = newDir;
            return await this.install(config);
          }
          case "cancel":
            console.log("Installation cancelled.");
            return;
        }
      }
    
      async performUpdate(newConfig, installDir, manifest, spinner) {
        spinner.start("Checking for updates...");
    
        try {
          // Get current and new versions
          const currentVersion = manifest.version;
          const newVersion = await this.getCoreVersion();
          const versionCompare = this.compareVersions(currentVersion, newVersion);
          
          // Only check for modified files if it's an actual version upgrade
          let modifiedFiles = [];
          if (versionCompare !== 0) {
            spinner.text = "Checking for modified files...";
            modifiedFiles = await fileManager.checkModifiedFiles(
              installDir,
              manifest
            );
          }
    
          if (modifiedFiles.length > 0) {
            spinner.warn("Found modified files");
            console.log(chalk.yellow("\nThe following files have been modified:"));
            for (const file of modifiedFiles) {
              console.log(`  - ${file}`);
            }
    
            const { action } = await inquirer.prompt([
              {
                type: "list",
                name: "action",
                message: "How would you like to proceed?",
                choices: [
                  { name: "Backup and overwrite modified files", value: "backup" },
                  { name: "Skip modified files", value: "skip" },
                  { name: "Cancel update", value: "cancel" },
                ],
              },
            ]);
    
            if (action === "cancel") {
              console.log("Update cancelled.");
              return;
            }
    
            if (action === "backup") {
              spinner.start("Backing up modified files...");
              for (const file of modifiedFiles) {
                const filePath = path.join(installDir, file);
                const backupPath = await fileManager.backupFile(filePath);
                console.log(
                  chalk.dim(`  Backed up: ${file} → ${path.basename(backupPath)}`)
                );
              }
            }
          }
    
          // Perform update by re-running installation
          spinner.text = versionCompare === 0 ? "Reinstalling files..." : "Updating files...";
          const config = {
            installType: manifest.install_type,
            agent: manifest.agent,
            directory: installDir,
            ides: newConfig?.ides || manifest.ides_setup || [],
          };
    
          await this.performFreshInstall(config, installDir, spinner, { isUpdate: true });
          
          // Clean up .yml files that now have .yaml counterparts
          spinner.text = "Cleaning up legacy .yml files...";
          await this.cleanupLegacyYmlFiles(installDir, spinner);
        } catch (error) {
          spinner.fail("Update failed");
          throw error;
        }
      }
    
      async performRepair(config, installDir, manifest, integrity, spinner) {
        spinner.start("Preparing to repair installation...");
    
        try {
          // Back up modified files
          if (integrity.modified.length > 0) {
            spinner.text = "Backing up modified files...";
            for (const file of integrity.modified) {
              const filePath = path.join(installDir, file);
              if (await fileManager.pathExists(filePath)) {
                const backupPath = await fileManager.backupFile(filePath);
                console.log(chalk.dim(`  Backed up: ${file} → ${path.basename(backupPath)}`));
              }
            }
          }
    
          // Restore missing and modified files
          spinner.text = "Restoring files...";
          const sourceBase = resourceLocator.getBmadCorePath();
          const filesToRestore = [...integrity.missing, ...integrity.modified];
          
          for (const file of filesToRestore) {
            // Skip the manifest file itself
            if (file.endsWith('install-manifest.yaml')) continue;
            
            const relativePath = file.replace('.bmad-core/', '');
            const destPath = path.join(installDir, file);
            
            // Check if this is a common/ file that needs special processing
            const commonBase = path.dirname(path.dirname(path.dirname(path.dirname(__filename))));
            const commonSourcePath = path.join(commonBase, 'common', relativePath);
            
            if (await fileManager.pathExists(commonSourcePath)) {
              // This is a common/ file - needs template processing
              const fs = require('fs').promises;
              const content = await fs.readFile(commonSourcePath, 'utf8');
              const updatedContent = content.replace(/\{root\}/g, '.bmad-core');
              await fileManager.ensureDirectory(path.dirname(destPath));
              await fs.writeFile(destPath, updatedContent, 'utf8');
              spinner.text = `Restored: ${file}`;
            } else {
              // Regular file from bmad-core
              const sourcePath = path.join(sourceBase, relativePath);
              if (await fileManager.pathExists(sourcePath)) {
                await fileManager.copyFile(sourcePath, destPath);
                spinner.text = `Restored: ${file}`;
                
                // If this is a .yaml file, check for and remove corresponding .yml file
                if (file.endsWith('.yaml')) {
                  const ymlFile = file.replace(/\.yaml$/, '.yml');
                  const ymlPath = path.join(installDir, ymlFile);
                  if (await fileManager.pathExists(ymlPath)) {
                    const fs = require('fs').promises;
                    await fs.unlink(ymlPath);
                    console.log(chalk.dim(`  Removed legacy: ${ymlFile} (replaced by ${file})`));
                  }
                }
              } else {
                console.warn(chalk.yellow(`  Warning: Source file not found: ${file}`));
              }
            }
          }
          
          // Clean up .yml files that now have .yaml counterparts
          spinner.text = "Cleaning up legacy .yml files...";
          await this.cleanupLegacyYmlFiles(installDir, spinner);
          
          spinner.succeed("Repair completed successfully!");
          
          // Show summary
          console.log(chalk.green("\n✓ Installation repaired!"));
          if (integrity.missing.length > 0) {
            console.log(chalk.green(`  Restored ${integrity.missing.length} missing files`));
          }
          if (integrity.modified.length > 0) {
            console.log(chalk.green(`  Restored ${integrity.modified.length} modified files (backups created)`));
          }
          
          // Warning for Cursor custom modes if agents were repaired
          const ides = manifest.ides_setup || [];
          if (ides.includes('cursor')) {
            console.log(chalk.yellow.bold("\n⚠️  IMPORTANT: Cursor Custom Modes Update Required"));
            console.log(chalk.yellow("Since agent files have been repaired, you need to update any custom agent modes configured in the Cursor custom agent GUI per the Cursor docs."));
          }
          
        } catch (error) {
          spinner.fail("Repair failed");
          throw error;
        }
      }
    
      async performReinstall(config, installDir, spinner) {
        spinner.start("Preparing to reinstall BMad Method...");
    
        // Remove existing .bmad-core
        const bmadCorePath = path.join(installDir, ".bmad-core");
        if (await fileManager.pathExists(bmadCorePath)) {
          spinner.text = "Removing existing installation...";
          await fileManager.removeDirectory(bmadCorePath);
        }
        
        spinner.text = "Installing fresh copy...";
        const result = await this.performFreshInstall(config, installDir, spinner, { isUpdate: true });
        
        // Clean up .yml files that now have .yaml counterparts
        spinner.text = "Cleaning up legacy .yml files...";
        await this.cleanupLegacyYmlFiles(installDir, spinner);
        
        return result;
      }
    
      showSuccessMessage(config, installDir, options = {}) {
        console.log(chalk.green("\n✓ BMad Method installed successfully!\n"));
    
        const ides = config.ides || (config.ide ? [config.ide] : []);
        if (ides.length > 0) {
          for (const ide of ides) {
            const ideConfig = configLoader.getIdeConfiguration(ide);
            if (ideConfig?.instructions) {
              console.log(
                chalk.bold(`To use BMad agents in ${ideConfig.name}:`)
              );
              console.log(ideConfig.instructions);
            }
          }
        } else {
          console.log(chalk.yellow("No IDE configuration was set up."));
          console.log(
            "You can manually configure your IDE using the agent files in:",
            installDir
          );
        }
    
        // Information about installation components
        console.log(chalk.bold("\n🎯 Installation Summary:"));
        if (config.installType !== "expansion-only") {
          console.log(chalk.green("✓ .bmad-core framework installed with all agents and workflows"));
        }
        
        if (config.expansionPacks && config.expansionPacks.length > 0) {
          console.log(chalk.green(`✓ Expansion packs installed:`));
          for (const packId of config.expansionPacks) {
            console.log(chalk.green(`  - ${packId} → .${packId}/`));
          }
        }
        
        if (config.includeWebBundles && config.webBundlesDirectory) {
          const bundleInfo = this.getWebBundleInfo(config);
          // Resolve the web bundles directory for display
          const originalCwd = process.env.INIT_CWD || process.env.PWD || process.cwd();
          const resolvedWebBundlesDir = path.isAbsolute(config.webBundlesDirectory) 
            ? config.webBundlesDirectory 
            : path.resolve(originalCwd, config.webBundlesDirectory);
          console.log(chalk.green(`✓ Web bundles (${bundleInfo}) installed to: ${resolvedWebBundlesDir}`));
        }
        
        if (ides.length > 0) {
          const ideNames = ides.map(ide => {
            const ideConfig = configLoader.getIdeConfiguration(ide);
            return ideConfig?.name || ide;
          }).join(", ");
          console.log(chalk.green(`✓ IDE rules and configurations set up for: ${ideNames}`));
        }
        
    
    
        // Information about web bundles
        if (!config.includeWebBundles) {
          console.log(chalk.bold("\n📦 Web Bundles Available:"));
          console.log("Pre-built web bundles are available and can be added later:");
          console.log(chalk.cyan("  Run the installer again to add them to your project"));
          console.log("These bundles work independently and can be shared, moved, or used");
          console.log("in other projects as standalone files.");
        }
    
        if (config.installType === "single-agent") {
          console.log(
            chalk.dim(
              "\nNeed other agents? Run: npx bmad-method install --agent=<name>"
            )
          );
          console.log(
            chalk.dim("Need everything? Run: npx bmad-method install --full")
          );
        }
    
        // Warning for Cursor custom modes if agents were updated
        if (options.isUpdate && ides.includes('cursor')) {
          console.log(chalk.yellow.bold("\n⚠️  IMPORTANT: Cursor Custom Modes Update Required"));
          console.log(chalk.yellow("Since agents have been updated, you need to update any custom agent modes configured in the Cursor custom agent GUI per the Cursor docs."));
        }
    
        // Important notice to read the user guide
        console.log(chalk.red.bold("\n📖 IMPORTANT: Please read the user guide installed at .bmad-core/user-guide.md"));
        console.log(chalk.red("This guide contains essential information about the BMad workflow and how to use the agents effectively."));
      }
    
      // Legacy method for backward compatibility
      async update() {
        console.log(chalk.yellow('The "update" command is deprecated.'));
        console.log(
          'Please use "install" instead - it will detect and offer to update existing installations.'
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
        console.log(chalk.red("No BMad installation found."));
      }
    
      async listAgents() {
        const agents = await resourceLocator.getAvailableAgents();
    
        console.log(chalk.bold("\nAvailable BMad Agents:\n"));
    
        for (const agent of agents) {
          console.log(chalk.cyan(`  ${agent.id.padEnd(20)}`), agent.description);
        }
    
        console.log(
          chalk.dim("\nInstall with: npx bmad-method install --agent=<id>\n")
        );
      }
    
      async listExpansionPacks() {
        const expansionPacks = await resourceLocator.getExpansionPacks();
    
        console.log(chalk.bold("\nAvailable BMad Expansion Packs:\n"));
    
        if (expansionPacks.length === 0) {
          console.log(chalk.yellow("No expansion packs found."));
          return;
        }
    
        for (const pack of expansionPacks) {
          console.log(chalk.cyan(`  ${pack.id.padEnd(20)}`), 
                      `${pack.name} v${pack.version}`);
          console.log(chalk.dim(`  ${' '.repeat(22)}${pack.description}`));
          if (pack.author && pack.author !== 'Unknown') {
            console.log(chalk.dim(`  ${' '.repeat(22)}by ${pack.author}`));
          }
          console.log();
        }
    
        console.log(
          chalk.dim("Install with: npx bmad-method install --full --expansion-packs <id>\n")
        );
      }
    
      async showStatus() {
        const installDir = await this.findInstallation();
    
        if (!installDir) {
          console.log(
            chalk.yellow("No BMad installation found in current directory tree")
          );
          return;
        }
    
        const manifest = await fileManager.readManifest(installDir);
    
        if (!manifest) {
          console.log(chalk.red("Invalid installation - manifest not found"));
          return;
        }
    
        console.log(chalk.bold("\nBMad Installation Status:\n"));
        console.log(`  Directory:      ${installDir}`);
        console.log(`  Version:        ${manifest.version}`);
        console.log(
          `  Installed:      ${new Date(
            manifest.installed_at
          ).toLocaleDateString()}`
        );
        console.log(`  Type:           ${manifest.install_type}`);
    
        if (manifest.agent) {
          console.log(`  Agent:          ${manifest.agent}`);
        }
    
        if (manifest.ides_setup && manifest.ides_setup.length > 0) {
          console.log(`  IDE Setup:      ${manifest.ides_setup.join(', ')}`);
        }
    
        console.log(`  Total Files:    ${manifest.files.length}`);
    
        // Check for modifications
        const modifiedFiles = await fileManager.checkModifiedFiles(
          installDir,
          manifest
        );
        if (modifiedFiles.length > 0) {
          console.log(chalk.yellow(`  Modified Files: ${modifiedFiles.length}`));
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
          spinner.text = `Installing expansion pack: ${packId}...`;
          
          try {
            const expansionPacks = await resourceLocator.getExpansionPacks();
            const pack = expansionPacks.find(p => p.id === packId);
            
            if (!pack) {
              console.warn(`Expansion pack ${packId} not found, skipping...`);
              continue;
            }
            
            // Check if expansion pack already exists
            let expansionDotFolder = path.join(installDir, `.${packId}`);
            const existingManifestPath = path.join(expansionDotFolder, 'install-manifest.yaml');
            
            if (await fileManager.pathExists(existingManifestPath)) {
              spinner.stop();
              const existingManifest = await fileManager.readExpansionPackManifest(installDir, packId);
              
              console.log(chalk.yellow(`\n🔍 Found existing ${pack.name} installation`));
              console.log(`   Current version: ${existingManifest.version || 'unknown'}`);
              console.log(`   New version: ${pack.version}`);
              
              // Check integrity of existing expansion pack
              const packIntegrity = await fileManager.checkFileIntegrity(installDir, existingManifest);
              const hasPackIntegrityIssues = packIntegrity.missing.length > 0 || packIntegrity.modified.length > 0;
              
              if (hasPackIntegrityIssues) {
                console.log(chalk.red("   ⚠️  Installation issues detected:"));
                if (packIntegrity.missing.length > 0) {
                  console.log(chalk.red(`     Missing files: ${packIntegrity.missing.length}`));
                }
                if (packIntegrity.modified.length > 0) {
                  console.log(chalk.yellow(`     Modified files: ${packIntegrity.modified.length}`));
                }
              }
              
              const versionCompare = this.compareVersions(existingManifest.version || '0.0.0', pack.version);
              
              if (versionCompare === 0) {
                console.log(chalk.yellow('   ⚠️  Same version already installed'));
                
                const choices = [];
                if (hasPackIntegrityIssues) {
                  choices.push({ name: 'Repair (restore missing/modified files)', value: 'repair' });
                }
                choices.push(
                  { name: 'Force reinstall (overwrite)', value: 'overwrite' },
                  { name: 'Skip this expansion pack', value: 'skip' },
                  { name: 'Cancel installation', value: 'cancel' }
                );
                
                const { action } = await inquirer.prompt([{
                  type: 'list',
                  name: 'action',
                  message: `${pack.name} v${pack.version} is already installed. What would you like to do?`,
                  choices: choices
                }]);
                
                if (action === 'skip') {
                  spinner.start();
                  continue;
                } else if (action === 'cancel') {
                    console.log('Installation cancelled.');
                  process.exit(0);
                } else if (action === 'repair') {
                  // Repair the expansion pack
                  await this.repairExpansionPack(installDir, packId, pack, packIntegrity, spinner);
                  continue;
                }
              } else if (versionCompare < 0) {
                console.log(chalk.cyan('   ⬆️  Upgrade available'));
                
                const { proceed } = await inquirer.prompt([{
                  type: 'confirm',
                  name: 'proceed',
                  message: `Upgrade ${pack.name} from v${existingManifest.version} to v${pack.version}?`,
                  default: true
                }]);
                
                if (!proceed) {
                  spinner.start();
                  continue;
                }
              } else {
                console.log(chalk.yellow('   ⬇️  Installed version is newer than available version'));
                
                const { action } = await inquirer.prompt([{
                  type: 'list',
                  name: 'action',
                  message: 'What would you like to do?',
                  choices: [
                    { name: 'Keep current version', value: 'skip' },
                    { name: 'Downgrade to available version', value: 'downgrade' },
                    { name: 'Cancel installation', value: 'cancel' }
                  ]
                }]);
                
                if (action === 'skip') {
                  spinner.start();
                  continue;
                } else if (action === 'cancel') {
                    console.log('Installation cancelled.');
                  process.exit(0);
                }
              }
              
              // If we get here, we're proceeding with installation
              spinner.start(`Removing old ${pack.name} installation...`);
              await fileManager.removeDirectory(expansionDotFolder);
            }
    
            const expansionPackDir = pack.path;
            
            // Ensure dedicated dot folder exists for this expansion pack
            expansionDotFolder = path.join(installDir, `.${packId}`);
            await fileManager.ensureDirectory(expansionDotFolder);
            
            // Define the folders to copy from expansion packs
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
    
            // Copy each folder if it exists
            for (const folder of foldersToSync) {
              const sourceFolder = path.join(expansionPackDir, folder);
              
              // Check if folder exists in expansion pack
              if (await fileManager.pathExists(sourceFolder)) {
                // Get all files in this folder
                const files = await resourceLocator.findFiles('**/*', {
                  cwd: sourceFolder,
                  nodir: true
                });
    
                // Copy each file to the expansion pack's dot folder with {root} replacement
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
    
            // Copy config.yaml with {root} replacement
            const configPath = path.join(expansionPackDir, 'config.yaml');
            if (await fileManager.pathExists(configPath)) {
              const configDestPath = path.join(expansionDotFolder, 'config.yaml');
              if (await fileManager.copyFileWithRootReplacement(configPath, configDestPath, `.${packId}`)) {
                installedFiles.push(path.join(`.${packId}`, 'config.yaml'));
              }
            }
            
            // Copy README if it exists with {root} replacement
            const readmePath = path.join(expansionPackDir, 'README.md');
            if (await fileManager.pathExists(readmePath)) {
              const readmeDestPath = path.join(expansionDotFolder, 'README.md');
              if (await fileManager.copyFileWithRootReplacement(readmePath, readmeDestPath, `.${packId}`)) {
                installedFiles.push(path.join(`.${packId}`, 'README.md'));
              }
            }
    
            // Copy common/ items to expansion pack folder
            spinner.text = `Copying common utilities to ${packId}...`;
            await this.copyCommonItems(installDir, `.${packId}`, spinner);
            
            // Check and resolve core dependencies
            await this.resolveExpansionPackCoreDependencies(installDir, expansionDotFolder, packId, pack, spinner);
            
            // Check and resolve core agents referenced by teams
            await this.resolveExpansionPackCoreAgents(installDir, expansionDotFolder, packId, spinner);
    
            // Create manifest for this expansion pack
            spinner.text = `Creating manifest for ${packId}...`;
            const expansionConfig = {
              installType: 'expansion-pack',
              expansionPackId: packId,
              expansionPackName: pack.name,
              expansionPackVersion: pack.version,
              ides: config.ides || []  // Use ides_setup instead of ide_setup
            };
            
            // Get all files installed in this expansion pack
            const foundFiles = await resourceLocator.findFiles('**/*', {
              cwd: expansionDotFolder,
              nodir: true
            });
            const expansionPackFiles = foundFiles.map(f => path.join(`.${packId}`, f));
            
            await fileManager.createExpansionPackManifest(installDir, packId, expansionConfig, expansionPackFiles);
    
            console.log(chalk.green(`✓ Installed expansion pack: ${pack.name} to ${`.${packId}`}`));
          } catch (error) {
            console.error(`Failed to install expansion pack ${packId}: ${error.message}`);
            console.error(`Stack trace: ${error.stack}`);
          }
        }
    
        return installedFiles;
      }
    
      async resolveExpansionPackCoreDependencies(installDir, expansionDotFolder, packId, pack, spinner) {
        const yaml = require('js-yaml');
        const fs = require('fs').promises;
        
        // Find all agent files in the expansion pack
        const agentFiles = await resourceLocator.findFiles('agents/*.md', {
          cwd: expansionDotFolder
        });
    
        for (const agentFile of agentFiles) {
          const agentPath = path.join(expansionDotFolder, agentFile);
          const agentContent = await fs.readFile(agentPath, 'utf8');
          
          // Extract YAML frontmatter to check dependencies
          const yamlContent = extractYamlFromAgent(agentContent);
          if (yamlContent) {
            try {
              const agentConfig = yaml.load(yamlContent);
              const dependencies = agentConfig.dependencies || {};
              
              // Check for core dependencies (those that don't exist in the expansion pack)
              for (const depType of ['tasks', 'templates', 'checklists', 'workflows', 'utils', 'data']) {
                const deps = dependencies[depType] || [];
                
                for (const dep of deps) {
                  const depFileName = dep.endsWith('.md') || dep.endsWith('.yaml') ? dep : 
                                      (depType === 'templates' ? `${dep}.yaml` : `${dep}.md`);
                  const expansionDepPath = path.join(expansionDotFolder, depType, depFileName);
                  
                  // Check if dependency exists in expansion pack dot folder
                  if (!(await fileManager.pathExists(expansionDepPath))) {
                    // Try to find it in expansion pack source
                    const sourceDepPath = path.join(pack.path, depType, depFileName);
                    
                    if (await fileManager.pathExists(sourceDepPath)) {
                      // Copy from expansion pack source
                      spinner.text = `Copying ${packId} dependency ${dep}...`;
                      const destPath = path.join(expansionDotFolder, depType, depFileName);
                      await fileManager.copyFileWithRootReplacement(sourceDepPath, destPath, `.${packId}`);
                      console.log(chalk.dim(`  Added ${packId} dependency: ${depType}/${depFileName}`));
                    } else {
                      // Try to find it in core
                      const coreDepPath = path.join(resourceLocator.getBmadCorePath(), depType, depFileName);
                      
                        if (await fileManager.pathExists(coreDepPath)) {
                          spinner.text = `Copying core dependency ${dep} for ${packId}...`;
                          
                          // Copy from core to expansion pack dot folder with {root} replacement
                          const destPath = path.join(expansionDotFolder, depType, depFileName);
                          await fileManager.copyFileWithRootReplacement(coreDepPath, destPath, `.${packId}`);
                          
                          console.log(chalk.dim(`  Added core dependency: ${depType}/${depFileName}`));
                        } else {
                          console.warn(chalk.yellow(`  Warning: Dependency ${depType}/${dep} not found in core or expansion pack`));
                        }
                      }
                    }
                }
              }
            } catch (error) {
              console.warn(`  Warning: Could not parse agent dependencies: ${error.message}`);
            }
          }
        }
      }
    
      async resolveExpansionPackCoreAgents(installDir, expansionDotFolder, packId, spinner) {
        const yaml = require('js-yaml');
        const fs = require('fs').promises;
        
        // Find all team files in the expansion pack
        const teamFiles = await resourceLocator.findFiles('agent-teams/*.yaml', {
          cwd: expansionDotFolder
        });
    
        // Also get existing agents in the expansion pack
        const existingAgents = new Set();
        const agentFiles = await resourceLocator.findFiles('agents/*.md', {
          cwd: expansionDotFolder
        });
        for (const agentFile of agentFiles) {
          const agentName = path.basename(agentFile, '.md');
          existingAgents.add(agentName);
        }
    
        // Process each team file
        for (const teamFile of teamFiles) {
          const teamPath = path.join(expansionDotFolder, teamFile);
          const teamContent = await fs.readFile(teamPath, 'utf8');
          
          try {
            const teamConfig = yaml.load(teamContent);
            const agents = teamConfig.agents || [];
            
            // Add bmad-orchestrator if not present (required for all teams)
            if (!agents.includes('bmad-orchestrator')) {
              agents.unshift('bmad-orchestrator');
            }
            
            // Check each agent in the team
            for (const agentId of agents) {
              if (!existingAgents.has(agentId)) {
                // Agent not in expansion pack, try to get from core
                const coreAgentPath = path.join(resourceLocator.getBmadCorePath(), 'agents', `${agentId}.md`);
                
                if (await fileManager.pathExists(coreAgentPath)) {
                  spinner.text = `Copying core agent ${agentId} for ${packId}...`;
                  
                  // Copy agent file with {root} replacement
                  const destPath = path.join(expansionDotFolder, 'agents', `${agentId}.md`);
                  await fileManager.copyFileWithRootReplacement(coreAgentPath, destPath, `.${packId}`);
                  existingAgents.add(agentId);
                  
                  console.log(chalk.dim(`  Added core agent: ${agentId}`));
                  
                  // Now resolve this agent's dependencies too
                  const agentContent = await fs.readFile(coreAgentPath, 'utf8');
                  const yamlContent = extractYamlFromAgent(agentContent, true);
                  
                  if (yamlContent) {
                    try {
                      
                      const agentConfig = yaml.load(yamlContent);
                      const dependencies = agentConfig.dependencies || {};
                      
                      // Copy all dependencies for this agent
                      for (const depType of ['tasks', 'templates', 'checklists', 'workflows', 'utils', 'data']) {
                        const deps = dependencies[depType] || [];
                        
                        for (const dep of deps) {
                          const depFileName = dep.endsWith('.md') || dep.endsWith('.yaml') ? dep : 
                                              (depType === 'templates' ? `${dep}.yaml` : `${dep}.md`);
                          const expansionDepPath = path.join(expansionDotFolder, depType, depFileName);
                          
                          // Check if dependency exists in expansion pack
                          if (!(await fileManager.pathExists(expansionDepPath))) {
                            // Try to find it in core
                            const coreDepPath = path.join(resourceLocator.getBmadCorePath(), depType, depFileName);
                            
                            if (await fileManager.pathExists(coreDepPath)) {
                              const destDepPath = path.join(expansionDotFolder, depType, depFileName);
                              await fileManager.copyFileWithRootReplacement(coreDepPath, destDepPath, `.${packId}`);
                              console.log(chalk.dim(`    Added agent dependency: ${depType}/${depFileName}`));
                            } else {
                              // Try common folder
                              const sourceBase = path.dirname(path.dirname(path.dirname(path.dirname(__filename)))); // Go up to project root
                              const commonDepPath = path.join(sourceBase, 'common', depType, depFileName);
                              if (await fileManager.pathExists(commonDepPath)) {
                                const destDepPath = path.join(expansionDotFolder, depType, depFileName);
                                await fileManager.copyFile(commonDepPath, destDepPath);
                                console.log(chalk.dim(`    Added agent dependency from common: ${depType}/${depFileName}`));
                              }
                            }
                          }
                        }
                      }
                    } catch (error) {
                      console.warn(`  Warning: Could not parse agent ${agentId} dependencies: ${error.message}`);
                    }
                  }
                } else {
                  console.warn(chalk.yellow(`  Warning: Core agent ${agentId} not found for team ${path.basename(teamFile, '.yaml')}`));
                }
              }
            }
          } catch (error) {
            console.warn(`  Warning: Could not parse team file ${teamFile}: ${error.message}`);
          }
        }
      }
    
      getWebBundleInfo(config) {
        const webBundleType = config.webBundleType || 'all';
        
        switch (webBundleType) {
          case 'all':
            return 'all bundles';
          case 'agents':
            return 'individual agents only';
          case 'teams':
            return config.selectedWebBundleTeams ? 
              `teams: ${config.selectedWebBundleTeams.join(', ')}` : 
              'selected teams';
          case 'custom': {
            const parts = [];
            if (config.selectedWebBundleTeams && config.selectedWebBundleTeams.length > 0) {
              parts.push(`teams: ${config.selectedWebBundleTeams.join(', ')}`);
            }
            if (config.includeIndividualAgents) {
              parts.push('individual agents');
            }
            return parts.length > 0 ? parts.join(' + ') : 'custom selection';
          }
          default:
            return 'selected bundles';
        }
      }
    
      async installWebBundles(webBundlesDirectory, config, spinner) {
        
        try {
          // Find the dist directory in the BMad installation
          const distDir = configLoader.getDistPath();
          
          if (!(await fileManager.pathExists(distDir))) {
            console.warn('Web bundles not found. Run "npm run build" to generate them.');
            return;
          }
    
          // Ensure web bundles directory exists
          await fileManager.ensureDirectory(webBundlesDirectory);
          
          const webBundleType = config.webBundleType || 'all';
          
          if (webBundleType === 'all') {
            // Copy the entire dist directory structure
            await fileManager.copyDirectory(distDir, webBundlesDirectory);
            console.log(chalk.green(`✓ Installed all web bundles to: ${webBundlesDirectory}`));
          } else {
            let copiedCount = 0;
            
            // Copy specific selections based on type
            if (webBundleType === 'agents' || (webBundleType === 'custom' && config.includeIndividualAgents)) {
              const agentsSource = path.join(distDir, 'agents');
              const agentsTarget = path.join(webBundlesDirectory, 'agents');
              if (await fileManager.pathExists(agentsSource)) {
                await fileManager.copyDirectory(agentsSource, agentsTarget);
                console.log(chalk.green(`✓ Copied individual agent bundles`));
                copiedCount += 10; // Approximate count for agents
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
                    console.log(chalk.green(`✓ Copied team bundle: ${teamId}`));
                  }
                }
              }
            }
            
            // Always copy expansion packs if they exist
            const expansionSource = path.join(distDir, 'expansion-packs');
            const expansionTarget = path.join(webBundlesDirectory, 'expansion-packs');
            if (await fileManager.pathExists(expansionSource)) {
              await fileManager.copyDirectory(expansionSource, expansionTarget);
              console.log(chalk.green(`✓ Copied expansion pack bundles`));
            }
            
            console.log(chalk.green(`✓ Installed ${copiedCount} selected web bundles to: ${webBundlesDirectory}`));
          }
        } catch (error) {
          console.error(`Failed to install web bundles: ${error.message}`);
        }
      }
    
      async copyCommonItems(installDir, targetSubdir, spinner) {
        
        const fs = require('fs').promises;
        const sourceBase = path.dirname(path.dirname(path.dirname(path.dirname(__filename)))); // Go up to project root
        const commonPath = path.join(sourceBase, 'common');
        const targetPath = path.join(installDir, targetSubdir);
        const copiedFiles = [];
        
        // Check if common/ exists
        if (!(await fileManager.pathExists(commonPath))) {
          console.warn('Warning: common/ folder not found');
          return copiedFiles;
        }
        
        // Copy all items from common/ to target
        const commonItems = await resourceLocator.findFiles('**/*', {
          cwd: commonPath,
          nodir: true
        });
        
        for (const item of commonItems) {
          const sourcePath = path.join(commonPath, item);
          const destPath = path.join(targetPath, item);
          
          // Read the file content
          const content = await fs.readFile(sourcePath, 'utf8');
          
          // Replace {root} with the target subdirectory
          const updatedContent = content.replace(/\{root\}/g, targetSubdir);
          
          // Ensure directory exists
          await fileManager.ensureDirectory(path.dirname(destPath));
          
          // Write the updated content
          await fs.writeFile(destPath, updatedContent, 'utf8');
          copiedFiles.push(path.join(targetSubdir, item));
        }
        
        console.log(chalk.dim(`  Added ${commonItems.length} common utilities`));
        return copiedFiles;
      }
    
      async detectExpansionPacks(installDir) {
        const expansionPacks = {};
        const glob = require("glob");
        
        // Find all dot folders that might be expansion packs
        const dotFolders = glob.sync(".*", {
          cwd: installDir,
          ignore: [".git", ".git/**", ".bmad-core", ".bmad-core/**"],
        });
        
        for (const folder of dotFolders) {
          const folderPath = path.join(installDir, folder);
          const stats = await fileManager.pathExists(folderPath);
          
          if (stats) {
            // Check if it has a manifest
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
              // Check if it has a config.yaml (expansion pack without manifest)
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
        spinner.start(`Repairing ${pack.name}...`);
        
        try {
          const expansionDotFolder = path.join(installDir, `.${packId}`);
          
          // Back up modified files
          if (integrity.modified.length > 0) {
            spinner.text = "Backing up modified files...";
            for (const file of integrity.modified) {
              const filePath = path.join(installDir, file);
              if (await fileManager.pathExists(filePath)) {
                const backupPath = await fileManager.backupFile(filePath);
                console.log(chalk.dim(`  Backed up: ${file} → ${path.basename(backupPath)}`));
              }
            }
          }
          
          // Restore missing and modified files
          spinner.text = "Restoring files...";
          const filesToRestore = [...integrity.missing, ...integrity.modified];
          
          for (const file of filesToRestore) {
            // Skip the manifest file itself
            if (file.endsWith('install-manifest.yaml')) continue;
            
            const relativePath = file.replace(`.${packId}/`, '');
            const sourcePath = path.join(pack.path, relativePath);
            const destPath = path.join(installDir, file);
            
            // Check if this is a common/ file that needs special processing
            const commonBase = path.dirname(path.dirname(path.dirname(path.dirname(__filename))));
            const commonSourcePath = path.join(commonBase, 'common', relativePath);
            
            if (await fileManager.pathExists(commonSourcePath)) {
              // This is a common/ file - needs template processing
              const fs = require('fs').promises;
              const content = await fs.readFile(commonSourcePath, 'utf8');
              const updatedContent = content.replace(/\{root\}/g, `.${packId}`);
              await fileManager.ensureDirectory(path.dirname(destPath));
              await fs.writeFile(destPath, updatedContent, 'utf8');
              spinner.text = `Restored: ${file}`;
            } else if (await fileManager.pathExists(sourcePath)) {
              // Regular file from expansion pack
              await fileManager.copyFile(sourcePath, destPath);
              spinner.text = `Restored: ${file}`;
            } else {
              console.warn(chalk.yellow(`  Warning: Source file not found: ${file}`));
            }
          }
          
          spinner.succeed(`${pack.name} repaired successfully!`);
          
          // Show summary
          console.log(chalk.green(`\n✓ ${pack.name} repaired!`));
          if (integrity.missing.length > 0) {
            console.log(chalk.green(`  Restored ${integrity.missing.length} missing files`));
          }
          if (integrity.modified.length > 0) {
            console.log(chalk.green(`  Restored ${integrity.modified.length} modified files (backups created)`));
          }
          
        } catch (error) {
          if (spinner) spinner.fail(`Failed to repair ${pack.name}`);
          console.error(`Error: ${error.message}`);
        }
      }
    
      compareVersions(v1, v2) {
        // Simple semver comparison
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
          // Find all .yml files in the installation directory
          const ymlFiles = glob.sync('**/*.yml', {
            cwd: installDir,
            ignore: ['**/node_modules/**', '**/.git/**']
          });
          
          let deletedCount = 0;
          
          for (const ymlFile of ymlFiles) {
            // Check if corresponding .yaml file exists
            const yamlFile = ymlFile.replace(/\.yml$/, '.yaml');
            const ymlPath = path.join(installDir, ymlFile);
            const yamlPath = path.join(installDir, yamlFile);
            
            if (await fileManager.pathExists(yamlPath)) {
              // .yaml counterpart exists, delete the .yml file
              await fs.unlink(ymlPath);
              deletedCount++;
              console.log(chalk.dim(`  Removed legacy: ${ymlFile} (replaced by ${yamlFile})`));
            }
          }
          
          if (deletedCount > 0) {
            console.log(chalk.green(`✓ Cleaned up ${deletedCount} legacy .yml files`));
          }
          
        } catch (error) {
          console.warn(`Warning: Could not cleanup legacy .yml files: ${error.message}`);
        }
      }
    
      async findInstallation() {
        // Look for .bmad-core in current directory or parent directories
        let currentDir = process.cwd();
    
        while (currentDir !== path.dirname(currentDir)) {
          const bmadDir = path.join(currentDir, ".bmad-core");
          const manifestPath = path.join(bmadDir, "install-manifest.yaml");
    
          if (await fileManager.pathExists(manifestPath)) {
            return bmadDir;
          }
    
          currentDir = path.dirname(currentDir);
        }
    
        // Also check if we're inside a .bmad-core directory
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
    
    ]]></file>
  <file path="installer\lib\ide-setup.js"><![CDATA[
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
          console.warn('Failed to load IDE agent configuration, using defaults');
          return {
            'roo-permissions': {},
            'cline-order': {}
          };
        }
      }
    
      async setup(ide, installDir, selectedAgent = null, spinner = null, preConfiguredSettings = null) {
        const ideConfig = await configLoader.getIdeConfiguration(ide);
    
        if (!ideConfig) {
          console.log(chalk.yellow(`\nNo configuration available for ${ide}`));
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
            console.log(chalk.yellow(`\nIDE ${ide} not yet supported`));
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
            console.log(chalk.green(`✓ Created rule: ${agentId}.mdc`));
          }
        }
    
        console.log(chalk.green(`\n✓ Created Cursor rules in ${cursorRulesDir}`));
        return true;
      }
    
      async setupClaudeCode(installDir, selectedAgent) {
        // Setup bmad-core commands
        const coreSlashPrefix = await this.getCoreSlashPrefix(installDir);
        const coreAgents = selectedAgent ? [selectedAgent] : await this.getCoreAgentIds(installDir);
        const coreTasks = await this.getCoreTaskIds(installDir);
        await this.setupClaudeCodeForPackage(installDir, "core", coreSlashPrefix, coreAgents, coreTasks, ".bmad-core");
    
        // Setup expansion pack commands
        const expansionPacks = await this.getInstalledExpansionPacks(installDir);
        for (const packInfo of expansionPacks) {
          const packSlashPrefix = await this.getExpansionPackSlashPrefix(packInfo.path);
          const packAgents = await this.getExpansionPackAgents(packInfo.path);
          const packTasks = await this.getExpansionPackTasks(packInfo.path);
          
          if (packAgents.length > 0 || packTasks.length > 0) {
            // Use the actual directory name where the expansion pack is installed
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
    
        // Ensure directories exist
        await fileManager.ensureDirectory(agentsDir);
        await fileManager.ensureDirectory(tasksDir);
    
        // Setup agents
        for (const agentId of agentIds) {
          // Find the agent file - for expansion packs, prefer the expansion pack version
          let agentPath;
          if (packageName !== "core") {
            // For expansion packs, first try to find the agent in the expansion pack directory
            const expansionPackPath = path.join(installDir, rootPath, "agents", `${agentId}.md`);
            if (await fileManager.pathExists(expansionPackPath)) {
              agentPath = expansionPackPath;
            } else {
              // Fall back to core if not found in expansion pack
              agentPath = await this.findAgentPath(agentId, installDir);
            }
          } else {
            // For core, use the normal search
            agentPath = await this.findAgentPath(agentId, installDir);
          }
          
          const commandPath = path.join(agentsDir, `${agentId}.md`);
    
          if (agentPath) {
            // Create command file with agent content
            let agentContent = await fileManager.readFile(agentPath);
            
            // Replace {root} placeholder with the appropriate root path for this context
            agentContent = agentContent.replace(/{root}/g, rootPath);
    
            // Add command header
            let commandContent = `# /${agentId} Command\n\n`;
            commandContent += `When this command is used, adopt the following agent persona:\n\n`;
            commandContent += agentContent;
    
            await fileManager.writeFile(commandPath, commandContent);
            console.log(chalk.green(`✓ Created agent command: /${agentId}`));
          }
        }
    
        // Setup tasks
        for (const taskId of taskIds) {
          // Find the task file - for expansion packs, prefer the expansion pack version
          let taskPath;
          if (packageName !== "core") {
            // For expansion packs, first try to find the task in the expansion pack directory
            const expansionPackPath = path.join(installDir, rootPath, "tasks", `${taskId}.md`);
            if (await fileManager.pathExists(expansionPackPath)) {
              taskPath = expansionPackPath;
            } else {
              // Fall back to core if not found in expansion pack
              taskPath = await this.findTaskPath(taskId, installDir);
            }
          } else {
            // For core, use the normal search
            taskPath = await this.findTaskPath(taskId, installDir);
          }
          
          const commandPath = path.join(tasksDir, `${taskId}.md`);
    
          if (taskPath) {
            // Create command file with task content
            let taskContent = await fileManager.readFile(taskPath);
            
            // Replace {root} placeholder with the appropriate root path for this context
            taskContent = taskContent.replace(/{root}/g, rootPath);
    
            // Add command header
            let commandContent = `# /${taskId} Task\n\n`;
            commandContent += `When this command is used, execute the following task:\n\n`;
            commandContent += taskContent;
    
            await fileManager.writeFile(commandPath, commandContent);
            console.log(chalk.green(`✓ Created task command: /${taskId}`));
          }
        }
    
        console.log(chalk.green(`\n✓ Created Claude Code commands for ${packageName} in ${commandsBaseDir}`));
        console.log(chalk.dim(`  - Agents in: ${agentsDir}`));
        console.log(chalk.dim(`  - Tasks in: ${tasksDir}`));
      }
    
      async setupWindsurf(installDir, selectedAgent) {
        const windsurfRulesDir = path.join(installDir, ".windsurf", "rules");
        const agents = selectedAgent ? [selectedAgent] : await this.getAllAgentIds(installDir);
    
        await fileManager.ensureDirectory(windsurfRulesDir);
    
        for (const agentId of agents) {
          // Find the agent file
          const agentPath = await this.findAgentPath(agentId, installDir);
    
          if (agentPath) {
            const agentContent = await fileManager.readFile(agentPath);
            const mdPath = path.join(windsurfRulesDir, `${agentId}.md`);
    
            // Create MD content (similar to Cursor but without frontmatter)
            let mdContent = `# ${agentId.toUpperCase()} Agent Rule\n\n`;
            mdContent += `This rule is triggered when the user types \`@${agentId}\` and activates the ${await this.getAgentTitle(
              agentId,
              installDir
            )} agent persona.\n\n`;
            mdContent += "## Agent Activation\n\n";
            mdContent +=
              "CRITICAL: Read the full YAML, start activation to alter your state of being, follow startup section instructions, stay in this being until told to exit this mode:\n\n";
            mdContent += "```yaml\n";
            // Extract just the YAML content from the agent file
            const yamlContent = extractYamlFromAgent(agentContent);
            if (yamlContent) {
              mdContent += yamlContent;
            } else {
              // If no YAML found, include the whole content minus the header
              mdContent += agentContent.replace(/^#.*$/m, "").trim();
            }
            mdContent += "\n```\n\n";
            mdContent += "## File Reference\n\n";
            const relativePath = path.relative(installDir, agentPath).replace(/\\/g, '/');
            mdContent += `The complete agent definition is available in [${relativePath}](${relativePath}).\n\n`;
            mdContent += "## Usage\n\n";
            mdContent += `When the user types \`@${agentId}\`, activate this ${await this.getAgentTitle(
              agentId,
              installDir
            )} persona and follow all instructions defined in the YAML configuration above.\n`;
    
            await fileManager.writeFile(mdPath, mdContent);
            console.log(chalk.green(`✓ Created rule: ${agentId}.md`));
          }
        }
    
        console.log(chalk.green(`\n✓ Created Windsurf rules in ${windsurfRulesDir}`));
    
        return true;
      }
    
      async setupTrae(installDir, selectedAgent) {
        const traeRulesDir = path.join(installDir, ".trae", "rules");
        const agents = selectedAgent? [selectedAgent] : await this.getAllAgentIds(installDir);
        
        await fileManager.ensureDirectory(traeRulesDir);
        
        for (const agentId of agents) {
          // Find the agent file
          const agentPath = await this.findAgentPath(agentId, installDir);
          
          if (agentPath) {
            const agentContent = await fileManager.readFile(agentPath);
            const mdPath = path.join(traeRulesDir, `${agentId}.md`);
            
            // Create MD content (similar to Cursor but without frontmatter)
            let mdContent = `# ${agentId.toUpperCase()} Agent Rule\n\n`;
            mdContent += `This rule is triggered when the user types \`@${agentId}\` and activates the ${await this.getAgentTitle(
              agentId,
              installDir
            )} agent persona.\n\n`;
            mdContent += "## Agent Activation\n\n";
            mdContent +=
              "CRITICAL: Read the full YAML, start activation to alter your state of being, follow startup section instructions, stay in this being until told to exit this mode:\n\n";
            mdContent += "```yaml\n";
            // Extract just the YAML content from the agent file
            const yamlContent = extractYamlFromAgent(agentContent);
            if (yamlContent) {
              mdContent += yamlContent;
            }
            else {
              // If no YAML found, include the whole content minus the header
              mdContent += agentContent.replace(/^#.*$/m, "").trim();
            }
            mdContent += "\n```\n\n";
            mdContent += "## File Reference\n\n";
            const relativePath = path.relative(installDir, agentPath).replace(/\\/g, '/');
            mdContent += `The complete agent definition is available in [${relativePath}](${relativePath}).\n\n`;
            mdContent += "## Usage\n\n";
            mdContent += `When the user types \`@${agentId}\`, activate this ${await this.getAgentTitle(
              agentId,
              installDir
            )} persona and follow all instructions defined in the YAML configuration above.\n`;
            
            await fileManager.writeFile(mdPath, mdContent);
            console.log(chalk.green(`✓ Created rule: ${agentId}.md`));
          }
        }
      }
    
      async findAgentPath(agentId, installDir) {
        // Try to find the agent file in various locations
        const possiblePaths = [
          path.join(installDir, ".bmad-core", "agents", `${agentId}.md`),
          path.join(installDir, "agents", `${agentId}.md`)
        ];
        
        // Also check expansion pack directories
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
        
        // Check core agents in .bmad-core or root
        let agentsDir = path.join(installDir, ".bmad-core", "agents");
        if (!(await fileManager.pathExists(agentsDir))) {
          agentsDir = path.join(installDir, "agents");
        }
        
        if (await fileManager.pathExists(agentsDir)) {
          const agentFiles = glob.sync("*.md", { cwd: agentsDir });
          allAgentIds.push(...agentFiles.map((file) => path.basename(file, ".md")));
        }
        
        // Also check for expansion pack agents in dot folders
        const expansionDirs = glob.sync(".*/agents", { cwd: installDir });
        for (const expDir of expansionDirs) {
          const fullExpDir = path.join(installDir, expDir);
          const expAgentFiles = glob.sync("*.md", { cwd: fullExpDir });
          allAgentIds.push(...expAgentFiles.map((file) => path.basename(file, ".md")));
        }
        
        // Remove duplicates
        return [...new Set(allAgentIds)];
      }
    
      async getCoreAgentIds(installDir) {
        const allAgentIds = [];
        
        // Check core agents in .bmad-core or root only
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
        
        // Check core tasks in .bmad-core or root only
        let tasksDir = path.join(installDir, ".bmad-core", "tasks");
        if (!(await fileManager.pathExists(tasksDir))) {
          tasksDir = path.join(installDir, "bmad-core", "tasks");
        }
        
        if (await fileManager.pathExists(tasksDir)) {
          const glob = require("glob");
          const taskFiles = glob.sync("*.md", { cwd: tasksDir });
          allTaskIds.push(...taskFiles.map((file) => path.basename(file, ".md")));
        }
        
        // Check common tasks
        const commonTasksDir = path.join(installDir, "common", "tasks");
        if (await fileManager.pathExists(commonTasksDir)) {
          const commonTaskFiles = glob.sync("*.md", { cwd: commonTasksDir });
          allTaskIds.push(...commonTaskFiles.map((file) => path.basename(file, ".md")));
        }
        
        return [...new Set(allTaskIds)];
      }
    
      async getAgentTitle(agentId, installDir) {
        // Try to find the agent file in various locations
        const possiblePaths = [
          path.join(installDir, ".bmad-core", "agents", `${agentId}.md`),
          path.join(installDir, "agents", `${agentId}.md`)
        ];
        
        // Also check expansion pack directories
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
              console.warn(`Failed to read agent title for ${agentId}: ${error.message}`);
            }
          }
        }
        
        // Fallback to formatted agent ID
        return agentId.split('-').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
      }
    
      async getAllTaskIds(installDir) {
        const glob = require("glob");
        const allTaskIds = [];
        
        // Check core tasks in .bmad-core or root
        let tasksDir = path.join(installDir, ".bmad-core", "tasks");
        if (!(await fileManager.pathExists(tasksDir))) {
          tasksDir = path.join(installDir, "bmad-core", "tasks");
        }
        
        if (await fileManager.pathExists(tasksDir)) {
          const taskFiles = glob.sync("*.md", { cwd: tasksDir });
          allTaskIds.push(...taskFiles.map((file) => path.basename(file, ".md")));
        }
        
        // Check common tasks
        const commonTasksDir = path.join(installDir, "common", "tasks");
        if (await fileManager.pathExists(commonTasksDir)) {
          const commonTaskFiles = glob.sync("*.md", { cwd: commonTasksDir });
          allTaskIds.push(...commonTaskFiles.map((file) => path.basename(file, ".md")));
        }
        
        // Also check for expansion pack tasks in dot folders
        const expansionDirs = glob.sync(".*/tasks", { cwd: installDir });
        for (const expDir of expansionDirs) {
          const fullExpDir = path.join(installDir, expDir);
          const expTaskFiles = glob.sync("*.md", { cwd: fullExpDir });
          allTaskIds.push(...expTaskFiles.map((file) => path.basename(file, ".md")));
        }
        
        // Check expansion-packs folder tasks
        const expansionPacksDir = path.join(installDir, "expansion-packs");
        if (await fileManager.pathExists(expansionPacksDir)) {
          const expPackDirs = glob.sync("*/tasks", { cwd: expansionPacksDir });
          for (const expDir of expPackDirs) {
            const fullExpDir = path.join(expansionPacksDir, expDir);
            const expTaskFiles = glob.sync("*.md", { cwd: fullExpDir });
            allTaskIds.push(...expTaskFiles.map((file) => path.basename(file, ".md")));
          }
        }
        
        // Remove duplicates
        return [...new Set(allTaskIds)];
      }
    
      async findTaskPath(taskId, installDir) {
        // Try to find the task file in various locations
        const possiblePaths = [
          path.join(installDir, ".bmad-core", "tasks", `${taskId}.md`),
          path.join(installDir, "bmad-core", "tasks", `${taskId}.md`),
          path.join(installDir, "common", "tasks", `${taskId}.md`)
        ];
        
        // Also check expansion pack directories
        const glob = require("glob");
        
        // Check dot folder expansion packs
        const expansionDirs = glob.sync(".*/tasks", { cwd: installDir });
        for (const expDir of expansionDirs) {
          possiblePaths.push(path.join(installDir, expDir, `${taskId}.md`));
        }
        
        // Check expansion-packs folder
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
            // Try bmad-core directory
            const altConfigPath = path.join(installDir, "bmad-core", "core-config.yaml");
            if (await fileManager.pathExists(altConfigPath)) {
              const configContent = await fileManager.readFile(altConfigPath);
              const config = yaml.load(configContent);
              return config.slashPrefix || "BMad";
            }
            return "BMad"; // fallback
          }
          
          const configContent = await fileManager.readFile(coreConfigPath);
          const config = yaml.load(configContent);
          return config.slashPrefix || "BMad";
        } catch (error) {
          console.warn(`Failed to read core slashPrefix, using default 'BMad': ${error.message}`);
          return "BMad";
        }
      }
    
      async getInstalledExpansionPacks(installDir) {
        const expansionPacks = [];
        
        // Check for dot-prefixed expansion packs in install directory
        const glob = require("glob");
        const dotExpansions = glob.sync(".bmad-*", { cwd: installDir });
        
        for (const dotExpansion of dotExpansions) {
          if (dotExpansion !== ".bmad-core") {
            const packPath = path.join(installDir, dotExpansion);
            const packName = dotExpansion.substring(1); // remove the dot
            expansionPacks.push({
              name: packName,
              path: packPath
            });
          }
        }
        
        // Check for expansion-packs directory style
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
          console.warn(`Failed to read expansion pack slashPrefix from ${packPath}: ${error.message}`);
        }
        
        return path.basename(packPath); // fallback to directory name
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
          console.warn(`Failed to read expansion pack agents from ${packPath}: ${error.message}`);
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
          console.warn(`Failed to read expansion pack tasks from ${packPath}: ${error.message}`);
          return [];
        }
      }
    
      async setupRoo(installDir, selectedAgent) {
        const agents = selectedAgent ? [selectedAgent] : await this.getAllAgentIds(installDir);
    
        // Check for existing .roomodes file in project root
        const roomodesPath = path.join(installDir, ".roomodes");
        let existingModes = [];
        let existingContent = "";
    
        if (await fileManager.pathExists(roomodesPath)) {
          existingContent = await fileManager.readFile(roomodesPath);
          // Parse existing modes to avoid duplicates
          const modeMatches = existingContent.matchAll(/- slug: ([\w-]+)/g);
          for (const match of modeMatches) {
            existingModes.push(match[1]);
          }
          console.log(chalk.yellow(`Found existing .roomodes file with ${existingModes.length} modes`));
        }
    
        // Create new modes content
        let newModesContent = "";
    
        // Load dynamic agent permissions from configuration
        const config = await this.loadIdeAgentConfig();
        const agentPermissions = config['roo-permissions'] || {};
    
        for (const agentId of agents) {
          // Skip if already exists
          // Check both with and without bmad- prefix to handle both cases
          const checkSlug = agentId.startsWith('bmad-') ? agentId : `bmad-${agentId}`;
          if (existingModes.includes(checkSlug)) {
            console.log(chalk.dim(`Skipping ${agentId} - already exists in .roomodes`));
            continue;
          }
    
          // Read agent file to extract all information
          const agentPath = await this.findAgentPath(agentId, installDir);
    
          if (agentPath) {
            const agentContent = await fileManager.readFile(agentPath);
    
            // Extract YAML content
            const yamlMatch = agentContent.match(/```ya?ml\r?\n([\s\S]*?)```/);
            if (yamlMatch) {
              const yaml = yamlMatch[1];
    
              // Extract agent info from YAML
              const titleMatch = yaml.match(/title:\s*(.+)/);
              const iconMatch = yaml.match(/icon:\s*(.+)/);
              const whenToUseMatch = yaml.match(/whenToUse:\s*"(.+)"/);
              const roleDefinitionMatch = yaml.match(/roleDefinition:\s*"(.+)"/);
    
              const title = titleMatch ? titleMatch[1].trim() : await this.getAgentTitle(agentId, installDir);
              const icon = iconMatch ? iconMatch[1].trim() : "🤖";
              const whenToUse = whenToUseMatch ? whenToUseMatch[1].trim() : `Use for ${title} tasks`;
              const roleDefinition = roleDefinitionMatch
                ? roleDefinitionMatch[1].trim()
                : `You are a ${title} specializing in ${title.toLowerCase()} tasks and responsibilities.`;
    
              // Build mode entry with proper formatting (matching exact indentation)
              // Avoid double "bmad-" prefix for agents that already have it
              const slug = agentId.startsWith('bmad-') ? agentId : `bmad-${agentId}`;
              newModesContent += ` - slug: ${slug}\n`;
              newModesContent += `   name: '${icon} ${title}'\n`;
              newModesContent += `   roleDefinition: ${roleDefinition}\n`;
              newModesContent += `   whenToUse: ${whenToUse}\n`;
              // Get relative path from installDir to agent file
              const relativePath = path.relative(installDir, agentPath).replace(/\\/g, '/');
              newModesContent += `   customInstructions: CRITICAL Read the full YAML from ${relativePath} start activation to alter your state of being follow startup section instructions stay in this being until told to exit this mode\n`;
              newModesContent += `   groups:\n`;
              newModesContent += `    - read\n`;
    
              // Add permissions based on agent type
              const permissions = agentPermissions[agentId];
              if (permissions) {
                newModesContent += `    - - edit\n`;
                newModesContent += `      - fileRegex: ${permissions.fileRegex}\n`;
                newModesContent += `        description: ${permissions.description}\n`;
              } else {
                newModesContent += `    - edit\n`;
              }
    
              console.log(chalk.green(`✓ Added mode: bmad-${agentId} (${icon} ${title})`));
            }
          }
        }
    
        // Build final roomodes content
        let roomodesContent = "";
        if (existingContent) {
          // If there's existing content, append new modes to it
          roomodesContent = existingContent.trim() + "\n" + newModesContent;
        } else {
          // Create new .roomodes file with proper YAML structure
          roomodesContent = "customModes:\n" + newModesContent;
        }
    
        // Write .roomodes file
        await fileManager.writeFile(roomodesPath, roomodesContent);
        console.log(chalk.green("✓ Created .roomodes file in project root"));
    
        console.log(chalk.green(`\n✓ Roo Code setup complete!`));
        console.log(chalk.dim("Custom modes will be available when you open this project in Roo Code"));
    
        return true;
      }
    
      async setupCline(installDir, selectedAgent) {
        const clineRulesDir = path.join(installDir, ".clinerules");
        const agents = selectedAgent ? [selectedAgent] : await this.getAllAgentIds(installDir);
    
        await fileManager.ensureDirectory(clineRulesDir);
    
        // Load dynamic agent ordering from configuration
        const config = await this.loadIdeAgentConfig();
        const agentOrder = config['cline-order'] || {};
    
        for (const agentId of agents) {
          // Find the agent file
          const agentPath = await this.findAgentPath(agentId, installDir);
    
          if (agentPath) {
            const agentContent = await fileManager.readFile(agentPath);
    
            // Get numeric prefix for ordering
            const order = agentOrder[agentId] || 99;
            const prefix = order.toString().padStart(2, '0');
            const mdPath = path.join(clineRulesDir, `${prefix}-${agentId}.md`);
    
            // Create MD content for Cline (focused on project standards and role)
            let mdContent = `# ${await this.getAgentTitle(agentId, installDir)} Agent\n\n`;
            mdContent += `This rule defines the ${await this.getAgentTitle(agentId, installDir)} persona and project standards.\n\n`;
            mdContent += "## Role Definition\n\n";
            mdContent +=
              "When the user types `@" + agentId + "`, adopt this persona and follow these guidelines:\n\n";
            mdContent += "```yaml\n";
            // Extract just the YAML content from the agent file
            const yamlContent = extractYamlFromAgent(agentContent);
            if (yamlContent) {
              mdContent += yamlContent;
            } else {
              // If no YAML found, include the whole content minus the header
              mdContent += agentContent.replace(/^#.*$/m, "").trim();
            }
            mdContent += "\n```\n\n";
            mdContent += "## Project Standards\n\n";
            mdContent += `- Always maintain consistency with project documentation in .bmad-core/\n`;
            mdContent += `- Follow the agent's specific guidelines and constraints\n`;
            mdContent += `- Update relevant project files when making changes\n`;
            const relativePath = path.relative(installDir, agentPath).replace(/\\/g, '/');
            mdContent += `- Reference the complete agent definition in [${relativePath}](${relativePath})\n\n`;
            mdContent += "## Usage\n\n";
            mdContent += `Type \`@${agentId}\` to activate this ${await this.getAgentTitle(agentId, installDir)} persona.\n`;
    
            await fileManager.writeFile(mdPath, mdContent);
            console.log(chalk.green(`✓ Created rule: ${prefix}-${agentId}.md`));
          }
        }
    
        console.log(chalk.green(`\n✓ Created Cline rules in ${clineRulesDir}`));
    
        return true;
      }
    
      async setupGeminiCli(installDir) {
        const geminiDir = path.join(installDir, ".gemini");
        const bmadMethodDir = path.join(geminiDir, "bmad-method");
        await fileManager.ensureDirectory(bmadMethodDir);
    
        // Update logic for existing settings.json
        const settingsPath = path.join(geminiDir, "settings.json");
        if (await fileManager.pathExists(settingsPath)) {
          try {
            const settingsContent = await fileManager.readFile(settingsPath);
            const settings = JSON.parse(settingsContent);
            let updated = false;
            
            // Handle contextFileName property
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
              console.log(chalk.green("✓ Updated .gemini/settings.json - removed agent file references"));
            }
          } catch (error) {
            console.warn(
              chalk.yellow("Could not update .gemini/settings.json"),
              error
            );
          }
        }
    
        // Remove old agents directory
        const agentsDir = path.join(geminiDir, "agents");
        if (await fileManager.pathExists(agentsDir)) {
          await fileManager.removeDirectory(agentsDir);
          console.log(chalk.green("✓ Removed old .gemini/agents directory"));
        }
    
        // Get all available agents
        const agents = await this.getAllAgentIds(installDir);
        let concatenatedContent = "";
    
        for (const agentId of agents) {
          // Find the source agent file
          const agentPath = await this.findAgentPath(agentId, installDir);
    
          if (agentPath) {
            const agentContent = await fileManager.readFile(agentPath);
            
            // Create properly formatted agent rule content (similar to trae)
            let agentRuleContent = `# ${agentId.toUpperCase()} Agent Rule\n\n`;
            agentRuleContent += `This rule is triggered when the user types \`*${agentId}\` and activates the ${await this.getAgentTitle(
              agentId,
              installDir
            )} agent persona.\n\n`;
            agentRuleContent += "## Agent Activation\n\n";
            agentRuleContent +=
              "CRITICAL: Read the full YAML, start activation to alter your state of being, follow startup section instructions, stay in this being until told to exit this mode:\n\n";
            agentRuleContent += "```yaml\n";
            // Extract just the YAML content from the agent file
            const yamlContent = extractYamlFromAgent(agentContent);
            if (yamlContent) {
              agentRuleContent += yamlContent;
            }
            else {
              // If no YAML found, include the whole content minus the header
              agentRuleContent += agentContent.replace(/^#.*$/m, "").trim();
            }
            agentRuleContent += "\n```\n\n";
            agentRuleContent += "## File Reference\n\n";
            const relativePath = path.relative(installDir, agentPath).replace(/\\/g, '/');
            agentRuleContent += `The complete agent definition is available in [${relativePath}](${relativePath}).\n\n`;
            agentRuleContent += "## Usage\n\n";
            agentRuleContent += `When the user types \`*${agentId}\`, activate this ${await this.getAgentTitle(
              agentId,
              installDir
            )} persona and follow all instructions defined in the YAML configuration above.\n`;
            
            // Add to concatenated content with separator
            concatenatedContent += agentRuleContent + "\n\n---\n\n";
            console.log(chalk.green(`✓ Added context for @${agentId}`));
          }
        }
    
        // Write the concatenated content to GEMINI.md
        const geminiMdPath = path.join(bmadMethodDir, "GEMINI.md");
        await fileManager.writeFile(geminiMdPath, concatenatedContent);
        console.log(chalk.green(`\n✓ Created GEMINI.md in ${bmadMethodDir}`));
    
        return true;
      }
    
      async setupGitHubCopilot(installDir, selectedAgent, spinner = null, preConfiguredSettings = null) {
        // Configure VS Code workspace settings first to avoid UI conflicts with loading spinners
        await this.configureVsCodeSettings(installDir, spinner, preConfiguredSettings);
        
        const chatmodesDir = path.join(installDir, ".github", "chatmodes");
        const agents = selectedAgent ? [selectedAgent] : await this.getAllAgentIds(installDir);
         
        await fileManager.ensureDirectory(chatmodesDir);
    
        for (const agentId of agents) {
          // Find the agent file
          const agentPath = await this.findAgentPath(agentId, installDir);
          const chatmodePath = path.join(chatmodesDir, `${agentId}.chatmode.md`);
    
          if (agentPath) {
            // Create chat mode file with agent content
            const agentContent = await fileManager.readFile(agentPath);
            const agentTitle = await this.getAgentTitle(agentId, installDir);
            
            // Extract whenToUse for the description
            const yamlMatch = agentContent.match(/```ya?ml\r?\n([\s\S]*?)```/);
            let description = `Activates the ${agentTitle} agent persona.`;
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
            console.log(chalk.green(`✓ Created chat mode: ${agentId}.chatmode.md`));
          }
        }
    
        console.log(chalk.green(`\n✓ Github Copilot setup complete!`));
        console.log(chalk.dim(`You can now find the BMad agents in the Chat view's mode selector.`));
    
        return true;
      }
    
      async configureVsCodeSettings(installDir, spinner, preConfiguredSettings = null) {
        const vscodeDir = path.join(installDir, ".vscode");
        const settingsPath = path.join(vscodeDir, "settings.json");
        
        await fileManager.ensureDirectory(vscodeDir);
        
        // Read existing settings if they exist
        let existingSettings = {};
        if (await fileManager.pathExists(settingsPath)) {
          try {
            const existingContent = await fileManager.readFile(settingsPath);
            existingSettings = JSON.parse(existingContent);
            console.log(chalk.yellow("Found existing .vscode/settings.json. Merging BMad settings..."));
          } catch (error) {
            console.warn(chalk.yellow("Could not parse existing settings.json. Creating new one."));
            existingSettings = {};
          }
        }
        
        // Use pre-configured settings if provided, otherwise prompt
        let configChoice;
        if (preConfiguredSettings && preConfiguredSettings.configChoice) {
          configChoice = preConfiguredSettings.configChoice;
          console.log(chalk.dim(`Using pre-configured GitHub Copilot settings: ${configChoice}`));
        } else {
          // Clear any previous output and add spacing to avoid conflicts with loaders
          console.log('\n'.repeat(2));
          console.log(chalk.blue("🔧 Github Copilot Agent Settings Configuration"));
          console.log(chalk.dim("BMad works best with specific VS Code settings for optimal agent experience."));
          console.log(''); // Add extra spacing
          
          const response = await inquirer.prompt([
            {
              type: 'list',
              name: 'configChoice',
              message: chalk.yellow('How would you like to configure GitHub Copilot settings?'),
              choices: [
                {
                  name: 'Use recommended defaults (fastest setup)',
                  value: 'defaults'
                },
                {
                  name: 'Configure each setting manually (customize to your preferences)',
                  value: 'manual'
                },
                {
                  name: 'Skip settings configuration (I\'ll configure manually later)',
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
          console.log(chalk.yellow("⚠️  Skipping VS Code settings configuration."));
          console.log(chalk.dim("You can manually configure these settings in .vscode/settings.json:"));
          console.log(chalk.dim("  • chat.agent.enabled: true"));
          console.log(chalk.dim("  • chat.agent.maxRequests: 15"));
          console.log(chalk.dim("  • github.copilot.chat.agent.runTasks: true"));
          console.log(chalk.dim("  • chat.mcp.discovery.enabled: true"));
          console.log(chalk.dim("  • github.copilot.chat.agent.autoFix: true"));
          console.log(chalk.dim("  • chat.tools.autoApprove: false"));
          return true;
        }
        
        if (configChoice === 'defaults') {
          // Use recommended defaults
          bmadSettings = {
            "chat.agent.enabled": true,
            "chat.agent.maxRequests": 15,
            "github.copilot.chat.agent.runTasks": true,
            "chat.mcp.discovery.enabled": true,
            "github.copilot.chat.agent.autoFix": true,
            "chat.tools.autoApprove": false
          };
          console.log(chalk.green("✓ Using recommended BMad defaults for Github Copilot settings"));
        } else {
          // Manual configuration
          console.log(chalk.blue("\n📋 Let's configure each setting for your preferences:"));
          
          // Pause spinner during manual configuration prompts
          let spinnerWasActive = false;
          if (spinner && spinner.isSpinning) {
            spinner.stop();
            spinnerWasActive = true;
          }
          
          const manualSettings = await inquirer.prompt([
            {
              type: 'input',
              name: 'maxRequests',
              message: 'Maximum requests per agent session (recommended: 15)?',
              default: '15',
              validate: (input) => {
                const num = parseInt(input);
                if (isNaN(num) || num < 1 || num > 50) {
                  return 'Please enter a number between 1 and 50';
                }
                return true;
              }
            },
            {
              type: 'confirm',
              name: 'runTasks',
              message: 'Allow agents to run workspace tasks (package.json scripts, etc.)?',
              default: true
            },
            {
              type: 'confirm',
              name: 'mcpDiscovery',
              message: 'Enable MCP (Model Context Protocol) server discovery?',
              default: true
            },
            {
              type: 'confirm',
              name: 'autoFix',
              message: 'Enable automatic error detection and fixing in generated code?',
              default: true
            },
            {
              type: 'confirm',
              name: 'autoApprove',
              message: 'Auto-approve ALL tools without confirmation? (⚠️  EXPERIMENTAL - less secure)',
              default: false
            }
          ]);
    
          // Restart spinner if it was active before prompts
          if (spinner && spinnerWasActive) {
            spinner.start();
          }
          
          bmadSettings = {
            "chat.agent.enabled": true, // Always enabled - required for BMad agents
            "chat.agent.maxRequests": parseInt(manualSettings.maxRequests),
            "github.copilot.chat.agent.runTasks": manualSettings.runTasks,
            "chat.mcp.discovery.enabled": manualSettings.mcpDiscovery,
            "github.copilot.chat.agent.autoFix": manualSettings.autoFix,
            "chat.tools.autoApprove": manualSettings.autoApprove
          };
          
          console.log(chalk.green("✓ Custom settings configured"));
        }
        
        // Merge settings (existing settings take precedence to avoid overriding user preferences)
        const mergedSettings = { ...bmadSettings, ...existingSettings };
        
        // Write the updated settings
        await fileManager.writeFile(settingsPath, JSON.stringify(mergedSettings, null, 2));
        
        console.log(chalk.green("✓ VS Code workspace settings configured successfully"));
        console.log(chalk.dim("  Settings written to .vscode/settings.json:"));
        Object.entries(bmadSettings).forEach(([key, value]) => {
          console.log(chalk.dim(`  • ${key}: ${value}`));
        });
        console.log(chalk.dim(""));
        console.log(chalk.dim("You can modify these settings anytime in .vscode/settings.json"));
      }
    }
    
    module.exports = new IdeSetup();
    
    ]]></file>
  <file path="installer\lib\ide-base-setup.js"><![CDATA[
    /**
     * Base IDE Setup - Common functionality for all IDE setups
     * Reduces duplication and provides shared methods
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
       * Get all agent IDs with caching
       */
      async getAllAgentIds(installDir) {
        const cacheKey = `all-agents:${installDir}`;
        if (this._agentCache.has(cacheKey)) {
          return this._agentCache.get(cacheKey);
        }
    
        const allAgents = new Set();
        
        // Get core agents
        const coreAgents = await this.getCoreAgentIds(installDir);
        coreAgents.forEach(id => allAgents.add(id));
        
        // Get expansion pack agents
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
       * Get core agent IDs
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
            break; // Use first found
          }
        }
    
        return coreAgents;
      }
    
      /**
       * Find agent path with caching
       */
      async findAgentPath(agentId, installDir) {
        const cacheKey = `agent-path:${agentId}:${installDir}`;
        if (this._pathCache.has(cacheKey)) {
          return this._pathCache.get(cacheKey);
        }
    
        // Use resource locator for efficient path finding
        let agentPath = await resourceLocator.getAgentPath(agentId);
        
        if (!agentPath) {
          // Check installation-specific paths
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
       * Get agent title from metadata
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
          // Fallback to agent ID
        }
        return agentId;
      }
    
      /**
       * Get installed expansion packs
       */
      async getInstalledExpansionPacks(installDir) {
        const cacheKey = `expansion-packs:${installDir}`;
        if (this._pathCache.has(cacheKey)) {
          return this._pathCache.get(cacheKey);
        }
    
        const expansionPacks = [];
        
        // Check for dot-prefixed expansion packs
        const dotExpansions = await resourceLocator.findFiles(".bmad-*", { cwd: installDir });
        
        for (const dotExpansion of dotExpansions) {
          if (dotExpansion !== ".bmad-core") {
            const packPath = path.join(installDir, dotExpansion);
            const packName = dotExpansion.substring(1); // remove the dot
            expansionPacks.push({
              name: packName,
              path: packPath
            });
          }
        }
        
        // Check other dot folders that have config.yaml
        const allDotFolders = await resourceLocator.findFiles(".*", { cwd: installDir });
        for (const folder of allDotFolders) {
          if (!folder.startsWith(".bmad-") && folder !== ".bmad-core") {
            const packPath = path.join(installDir, folder);
            const configPath = path.join(packPath, "config.yaml");
            if (await fileManager.pathExists(configPath)) {
              expansionPacks.push({
                name: folder.substring(1), // remove the dot
                path: packPath
              });
            }
          }
        }
    
        this._pathCache.set(cacheKey, expansionPacks);
        return expansionPacks;
      }
    
      /**
       * Get expansion pack agents
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
       * Create agent rule content (shared logic)
       */
      async createAgentRuleContent(agentId, agentPath, installDir, format = 'mdc') {
        const agentContent = await fileManager.readFile(agentPath);
        const agentTitle = await this.getAgentTitle(agentId, installDir);
        const yamlContent = extractYamlFromAgent(agentContent);
        
        let content = "";
        
        if (format === 'mdc') {
          // MDC format for Cursor
          content = "---\n";
          content += "description: \n";
          content += "globs: []\n";
          content += "alwaysApply: false\n";
          content += "---\n\n";
          content += `# ${agentId.toUpperCase()} Agent Rule\n\n`;
          content += `This rule is triggered when the user types \`@${agentId}\` and activates the ${agentTitle} agent persona.\n\n`;
          content += "## Agent Activation\n\n";
          content += "CRITICAL: Read the full YAML, start activation to alter your state of being, follow startup section instructions, stay in this being until told to exit this mode:\n\n";
          content += "```yaml\n";
          content += yamlContent || agentContent.replace(/^#.*$/m, "").trim();
          content += "\n```\n\n";
          content += "## File Reference\n\n";
          const relativePath = path.relative(installDir, agentPath).replace(/\\/g, '/');
          content += `The complete agent definition is available in [${relativePath}](mdc:${relativePath}).\n\n`;
          content += "## Usage\n\n";
          content += `When the user types \`@${agentId}\`, activate this ${agentTitle} persona and follow all instructions defined in the YAML configuration above.\n`;
        } else if (format === 'claude') {
          // Claude Code format
          content = `# /${agentId} Command\n\n`;
          content += `When this command is used, adopt the following agent persona:\n\n`;
          content += agentContent;
        }
        
        return content;
      }
    
      /**
       * Clear all caches
       */
      clearCache() {
        this._agentCache.clear();
        this._pathCache.clear();
      }
    }
    
    module.exports = BaseIdeSetup;
    ]]></file>
  <file path="installer\lib\file-manager.js"><![CDATA[
    const fs = require("fs-extra");
    const path = require("path");
    const crypto = require("crypto");
    const yaml = require("js-yaml");
    const chalk = require("chalk");
    const { createReadStream, createWriteStream, promises: fsPromises } = require('fs');
    const { pipeline } = require('stream/promises');
    const resourceLocator = require('./resource-locator');
    
    class FileManager {
      constructor() {
        this.manifestDir = ".bmad-core";
        this.manifestFile = "install-manifest.yaml";
      }
    
      async copyFile(source, destination) {
        try {
          await fs.ensureDir(path.dirname(destination));
          
          // Use streaming for large files (> 10MB)
          const stats = await fs.stat(source);
          if (stats.size > 10 * 1024 * 1024) {
            await pipeline(
              createReadStream(source),
              createWriteStream(destination)
            );
          } else {
            await fs.copy(source, destination);
          }
          return true;
        } catch (error) {
          console.error(chalk.red(`Failed to copy ${source}:`), error.message);
          return false;
        }
      }
    
      async copyDirectory(source, destination) {
        try {
          await fs.ensureDir(destination);
          
          // Use streaming copy for large directories
          const files = await resourceLocator.findFiles('**/*', {
            cwd: source,
            nodir: true
          });
          
          // Process files in batches to avoid memory issues
          const batchSize = 50;
          for (let i = 0; i < files.length; i += batchSize) {
            const batch = files.slice(i, i + batchSize);
            await Promise.all(
              batch.map(file => 
                this.copyFile(
                  path.join(source, file),
                  path.join(destination, file)
                )
              )
            );
          }
          return true;
        } catch (error) {
          console.error(
            chalk.red(`Failed to copy directory ${source}:`),
            error.message
          );
          return false;
        }
      }
    
      async copyGlobPattern(pattern, sourceDir, destDir, rootValue = null) {
        const files = await resourceLocator.findFiles(pattern, { cwd: sourceDir });
        const copied = [];
    
        for (const file of files) {
          const sourcePath = path.join(sourceDir, file);
          const destPath = path.join(destDir, file);
    
          // Use root replacement if rootValue is provided and file needs it
          const needsRootReplacement = rootValue && (file.endsWith('.md') || file.endsWith('.yaml') || file.endsWith('.yml'));
          
          let success = false;
          if (needsRootReplacement) {
            success = await this.copyFileWithRootReplacement(sourcePath, destPath, rootValue);
          } else {
            success = await this.copyFile(sourcePath, destPath);
          }
    
          if (success) {
            copied.push(file);
          }
        }
    
        return copied;
      }
    
      async calculateFileHash(filePath) {
        try {
          // Use streaming for hash calculation to reduce memory usage
          const stream = createReadStream(filePath);
          const hash = crypto.createHash("sha256");
          
          for await (const chunk of stream) {
            hash.update(chunk);
          }
          
          return hash.digest("hex").slice(0, 16);
        } catch (error) {
          return null;
        }
      }
    
      async createManifest(installDir, config, files) {
        const manifestPath = path.join(
          installDir,
          this.manifestDir,
          this.manifestFile
        );
    
        // Read version from package.json
        let coreVersion = "unknown";
        try {
          const packagePath = path.join(__dirname, '..', '..', '..', 'package.json');
          const packageJson = require(packagePath);
          coreVersion = packageJson.version;
        } catch (error) {
          console.warn("Could not read version from package.json, using 'unknown'");
        }
    
        const manifest = {
          version: coreVersion,
          installed_at: new Date().toISOString(),
          install_type: config.installType,
          agent: config.agent || null,
          ides_setup: config.ides || [],
          expansion_packs: config.expansionPacks || [],
          files: [],
        };
    
        // Add file information
        for (const file of files) {
          const filePath = path.join(installDir, file);
          const hash = await this.calculateFileHash(filePath);
    
          manifest.files.push({
            path: file,
            hash: hash,
            modified: false,
          });
        }
    
        // Write manifest
        await fs.ensureDir(path.dirname(manifestPath));
        await fs.writeFile(manifestPath, yaml.dump(manifest, { indent: 2 }));
    
        return manifest;
      }
    
      async readManifest(installDir) {
        const manifestPath = path.join(
          installDir,
          this.manifestDir,
          this.manifestFile
        );
    
        try {
          const content = await fs.readFile(manifestPath, "utf8");
          return yaml.load(content);
        } catch (error) {
          return null;
        }
      }
    
      async readExpansionPackManifest(installDir, packId) {
        const manifestPath = path.join(
          installDir,
          `.${packId}`,
          this.manifestFile
        );
    
        try {
          const content = await fs.readFile(manifestPath, "utf8");
          return yaml.load(content);
        } catch (error) {
          return null;
        }
      }
    
      async checkModifiedFiles(installDir, manifest) {
        const modified = [];
    
        for (const file of manifest.files) {
          const filePath = path.join(installDir, file.path);
          const currentHash = await this.calculateFileHash(filePath);
    
          if (currentHash && currentHash !== file.hash) {
            modified.push(file.path);
          }
        }
    
        return modified;
      }
    
      async checkFileIntegrity(installDir, manifest) {
        const result = {
          missing: [],
          modified: []
        };
    
        for (const file of manifest.files) {
          const filePath = path.join(installDir, file.path);
          
          // Skip checking the manifest file itself - it will always be different due to timestamps
          if (file.path.endsWith('install-manifest.yaml')) {
            continue;
          }
          
          if (!(await this.pathExists(filePath))) {
            result.missing.push(file.path);
          } else {
            const currentHash = await this.calculateFileHash(filePath);
            if (currentHash && currentHash !== file.hash) {
              result.modified.push(file.path);
            }
          }
        }
    
        return result;
      }
    
      async backupFile(filePath) {
        const backupPath = filePath + ".bak";
        let counter = 1;
        let finalBackupPath = backupPath;
    
        // Find a unique backup filename
        while (await fs.pathExists(finalBackupPath)) {
          finalBackupPath = `${filePath}.bak${counter}`;
          counter++;
        }
    
        await fs.copy(filePath, finalBackupPath);
        return finalBackupPath;
      }
    
      async ensureDirectory(dirPath) {
        try {
          await fs.ensureDir(dirPath);
          return true;
        } catch (error) {
          throw error;
        }
      }
    
      async pathExists(filePath) {
        return fs.pathExists(filePath);
      }
    
      async readFile(filePath) {
        return fs.readFile(filePath, "utf8");
      }
    
      async writeFile(filePath, content) {
        await fs.ensureDir(path.dirname(filePath));
        await fs.writeFile(filePath, content);
      }
    
      async removeDirectory(dirPath) {
        await fs.remove(dirPath);
      }
    
      async createExpansionPackManifest(installDir, packId, config, files) {
        const manifestPath = path.join(
          installDir,
          `.${packId}`,
          this.manifestFile
        );
    
        const manifest = {
          version: config.expansionPackVersion || require("../../../package.json").version,
          installed_at: new Date().toISOString(),
          install_type: config.installType,
          expansion_pack_id: config.expansionPackId,
          expansion_pack_name: config.expansionPackName,
          ides_setup: config.ides || [],
          files: [],
        };
    
        // Add file information
        for (const file of files) {
          const filePath = path.join(installDir, file);
          const hash = await this.calculateFileHash(filePath);
    
          manifest.files.push({
            path: file,
            hash: hash,
            modified: false,
          });
        }
    
        // Write manifest
        await fs.ensureDir(path.dirname(manifestPath));
        await fs.writeFile(manifestPath, yaml.dump(manifest, { indent: 2 }));
    
        return manifest;
      }
    
      async modifyCoreConfig(installDir, config) {
        const coreConfigPath = path.join(installDir, '.bmad-core', 'core-config.yaml');
        
        try {
          // Read the existing core-config.yaml
          const coreConfigContent = await fs.readFile(coreConfigPath, 'utf8');
          const coreConfig = yaml.load(coreConfigContent);
          
          // Modify sharding settings if provided
          if (config.prdSharded !== undefined) {
            coreConfig.prd.prdSharded = config.prdSharded;
          }
          
          if (config.architectureSharded !== undefined) {
            coreConfig.architecture.architectureSharded = config.architectureSharded;
          }
          
          // Write back the modified config
          await fs.writeFile(coreConfigPath, yaml.dump(coreConfig, { indent: 2 }));
          
          return true;
        } catch (error) {
          console.error(chalk.red(`Failed to modify core-config.yaml:`), error.message);
          return false;
        }
      }
    
      async copyFileWithRootReplacement(source, destination, rootValue) {
        try {
          // Check file size to determine if we should stream
          const stats = await fs.stat(source);
          
          if (stats.size > 5 * 1024 * 1024) { // 5MB threshold
            // Use streaming for large files
            const { Transform } = require('stream');
            const replaceStream = new Transform({
              transform(chunk, encoding, callback) {
                const modified = chunk.toString().replace(/\{root\}/g, rootValue);
                callback(null, modified);
              }
            });
            
            await this.ensureDirectory(path.dirname(destination));
            await pipeline(
              createReadStream(source, { encoding: 'utf8' }),
              replaceStream,
              createWriteStream(destination, { encoding: 'utf8' })
            );
          } else {
            // Regular approach for smaller files
            const content = await fsPromises.readFile(source, 'utf8');
            const updatedContent = content.replace(/\{root\}/g, rootValue);
            await this.ensureDirectory(path.dirname(destination));
            await fsPromises.writeFile(destination, updatedContent, 'utf8');
          }
          
          return true;
        } catch (error) {
          console.error(chalk.red(`Failed to copy ${source} with root replacement:`), error.message);
          return false;
        }
      }
    
      async copyDirectoryWithRootReplacement(source, destination, rootValue, fileExtensions = ['.md', '.yaml', '.yml']) {
        try {
          await this.ensureDirectory(destination);
          
          // Get all files in source directory
          const files = await resourceLocator.findFiles('**/*', { 
            cwd: source, 
            nodir: true 
          });
          
          let replacedCount = 0;
          
          for (const file of files) {
            const sourcePath = path.join(source, file);
            const destPath = path.join(destination, file);
            
            // Check if this file type should have {root} replacement
            const shouldReplace = fileExtensions.some(ext => file.endsWith(ext));
            
            if (shouldReplace) {
              if (await this.copyFileWithRootReplacement(sourcePath, destPath, rootValue)) {
                replacedCount++;
              }
            } else {
              // Regular copy for files that don't need replacement
              await this.copyFile(sourcePath, destPath);
            }
          }
          
          if (replacedCount > 0) {
            console.log(chalk.dim(`  Processed ${replacedCount} files with {root} replacement`));
          }
          
          return true;
        } catch (error) {
          console.error(chalk.red(`Failed to copy directory ${source} with root replacement:`), error.message);
          return false;
        }
      }
    }
    
    module.exports = new FileManager();
    
    ]]></file>
  <file path="installer\lib\config-loader.js"><![CDATA[
    const fs = require('fs-extra');
    const path = require('path');
    const yaml = require('js-yaml');
    const { extractYamlFromAgent } = require('../../lib/yaml-utils');
    
    class ConfigLoader {
      constructor() {
        this.configPath = path.join(__dirname, '..', 'config', 'install.config.yaml');
        this.config = null;
      }
    
      async load() {
        if (this.config) return this.config;
        
        try {
          const configContent = await fs.readFile(this.configPath, 'utf8');
          this.config = yaml.load(configContent);
          return this.config;
        } catch (error) {
          throw new Error(`Failed to load configuration: ${error.message}`);
        }
      }
    
      async getInstallationOptions() {
        const config = await this.load();
        return config['installation-options'] || {};
      }
    
      async getAvailableAgents() {
        const agentsDir = path.join(this.getBmadCorePath(), 'agents');
        
        try {
          const entries = await fs.readdir(agentsDir, { withFileTypes: true });
          const agents = [];
          
          for (const entry of entries) {
            if (entry.isFile() && entry.name.endsWith('.md')) {
              const agentPath = path.join(agentsDir, entry.name);
              const agentId = path.basename(entry.name, '.md');
              
              try {
                const agentContent = await fs.readFile(agentPath, 'utf8');
                
                // Extract YAML block from agent file
                const yamlContentText = extractYamlFromAgent(agentContent);
                if (yamlContentText) {
                  const yamlContent = yaml.load(yamlContentText);
                  const agentConfig = yamlContent.agent || {};
                  
                  agents.push({
                    id: agentId,
                    name: agentConfig.title || agentConfig.name || agentId,
                    file: `bmad-core/agents/${entry.name}`,
                    description: agentConfig.whenToUse || 'No description available'
                  });
                }
              } catch (error) {
                console.warn(`Failed to read agent ${entry.name}: ${error.message}`);
              }
            }
          }
          
          // Sort agents by name for consistent display
          agents.sort((a, b) => a.name.localeCompare(b.name));
          
          return agents;
        } catch (error) {
          console.warn(`Failed to read agents directory: ${error.message}`);
          return [];
        }
      }
    
      async getAvailableExpansionPacks() {
        const expansionPacksDir = path.join(this.getBmadCorePath(), '..', 'expansion-packs');
        
        try {
          const entries = await fs.readdir(expansionPacksDir, { withFileTypes: true });
          const expansionPacks = [];
          
          for (const entry of entries) {
            if (entry.isDirectory() && !entry.name.startsWith('.')) {
              const packPath = path.join(expansionPacksDir, entry.name);
              const configPath = path.join(packPath, 'config.yaml');
              
              try {
                // Read config.yaml
                const configContent = await fs.readFile(configPath, 'utf8');
                const config = yaml.load(configContent);
                
                expansionPacks.push({
                  id: entry.name,
                  name: config.name || entry.name,
                  description: config['short-title'] || config.description || 'No description available',
                  fullDescription: config.description || config['short-title'] || 'No description available',
                  version: config.version || '1.0.0',
                  author: config.author || 'BMad Team',
                  packPath: packPath,
                  dependencies: config.dependencies?.agents || []
                });
              } catch (error) {
                // Fallback if config.yaml doesn't exist or can't be read
                console.warn(`Failed to read config for expansion pack ${entry.name}: ${error.message}`);
                
                // Try to derive info from directory name as fallback
                const name = entry.name
                  .split('-')
                  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(' ');
                
                expansionPacks.push({
                  id: entry.name,
                  name: name,
                  description: 'No description available',
                  fullDescription: 'No description available',
                  version: '1.0.0',
                  author: 'BMad Team',
                  packPath: packPath,
                  dependencies: []
                });
              }
            }
          }
          
          return expansionPacks;
        } catch (error) {
          console.warn(`Failed to read expansion packs directory: ${error.message}`);
          return [];
        }
      }
    
      async getAgentDependencies(agentId) {
        // Use DependencyResolver to dynamically parse agent dependencies
        const DependencyResolver = require('../../lib/dependency-resolver');
        const resolver = new DependencyResolver(path.join(__dirname, '..', '..', '..'));
        
        const agentDeps = await resolver.resolveAgentDependencies(agentId);
        
        // Convert to flat list of file paths
        const depPaths = [];
        
        // Core files and utilities are included automatically by DependencyResolver
        
        // Add agent file itself is already handled by installer
        
        // Add all resolved resources
        for (const resource of agentDeps.resources) {
          const filePath = `.bmad-core/${resource.type}/${resource.id}.md`;
          if (!depPaths.includes(filePath)) {
            depPaths.push(filePath);
          }
        }
        
        return depPaths;
      }
    
      async getIdeConfiguration(ide) {
        const config = await this.load();
        const ideConfigs = config['ide-configurations'] || {};
        return ideConfigs[ide] || null;
      }
    
      getBmadCorePath() {
        // Get the path to bmad-core relative to the installer (now under tools)
        return path.join(__dirname, '..', '..', '..', 'bmad-core');
      }
    
      getDistPath() {
        // Get the path to dist directory relative to the installer
        return path.join(__dirname, '..', '..', '..', 'dist');
      }
    
      getAgentPath(agentId) {
        return path.join(this.getBmadCorePath(), 'agents', `${agentId}.md`);
      }
    
      async getAvailableTeams() {
        const teamsDir = path.join(this.getBmadCorePath(), 'agent-teams');
        
        try {
          const entries = await fs.readdir(teamsDir, { withFileTypes: true });
          const teams = [];
          
          for (const entry of entries) {
            if (entry.isFile() && entry.name.endsWith('.yaml')) {
              const teamPath = path.join(teamsDir, entry.name);
              
              try {
                const teamContent = await fs.readFile(teamPath, 'utf8');
                const teamConfig = yaml.load(teamContent);
                
                if (teamConfig.bundle) {
                  teams.push({
                    id: path.basename(entry.name, '.yaml'),
                    name: teamConfig.bundle.name || entry.name,
                    description: teamConfig.bundle.description || 'Team configuration',
                    icon: teamConfig.bundle.icon || '📋'
                  });
                }
              } catch (error) {
                console.warn(`Warning: Could not load team config ${entry.name}: ${error.message}`);
              }
            }
          }
          
          return teams;
        } catch (error) {
          console.warn(`Warning: Could not scan teams directory: ${error.message}`);
          return [];
        }
      }
    
      getTeamPath(teamId) {
        return path.join(this.getBmadCorePath(), 'agent-teams', `${teamId}.yaml`);
      }
    
      async getTeamDependencies(teamId) {
        // Use DependencyResolver to dynamically parse team dependencies
        const DependencyResolver = require('../../lib/dependency-resolver');
        const resolver = new DependencyResolver(path.join(__dirname, '..', '..', '..'));
        
        try {
          const teamDeps = await resolver.resolveTeamDependencies(teamId);
          
          // Convert to flat list of file paths
          const depPaths = [];
          
          // Add team config file
          depPaths.push(`.bmad-core/agent-teams/${teamId}.yaml`);
          
          // Add all agents
          for (const agent of teamDeps.agents) {
            const filePath = `.bmad-core/agents/${agent.id}.md`;
            if (!depPaths.includes(filePath)) {
              depPaths.push(filePath);
            }
          }
          
          // Add all resolved resources
          for (const resource of teamDeps.resources) {
            const filePath = `.bmad-core/${resource.type}/${resource.id}.${resource.type === 'workflows' ? 'yaml' : 'md'}`;
            if (!depPaths.includes(filePath)) {
              depPaths.push(filePath);
            }
          }
          
          return depPaths;
        } catch (error) {
          throw new Error(`Failed to resolve team dependencies for ${teamId}: ${error.message}`);
        }
      }
    }
    
    module.exports = new ConfigLoader();
    ]]></file>
  <file path="installer\config\install.config.yaml"><![CDATA[
    installation-options:
      full:
        name: Complete BMad Core
        description: Copy the entire .bmad-core folder with all agents, templates, and tools
        action: copy-folder
        source: bmad-core
      single-agent:
        name: Single Agent
        description: Select and install a single agent with its dependencies
        action: copy-agent
    ide-configurations:
      cursor:
        name: Cursor
        rule-dir: .cursor/rules/
        format: multi-file
        command-suffix: .mdc
        instructions: |
          # To use BMad agents in Cursor:
          # 1. Press Ctrl+L (Cmd+L on Mac) to open the chat
          # 2. Type @agent-name (e.g., "@dev", "@pm", "@architect")
          # 3. The agent will adopt that persona for the conversation
      claude-code:
        name: Claude Code
        rule-dir: .claude/commands/BMad/
        format: multi-file
        command-suffix: .md
        instructions: |
          # To use BMad agents in Claude Code:
          # 1. Type /agent-name (e.g., "/dev", "/pm", "/architect")
          # 2. Claude will switch to that agent's persona
      windsurf:
        name: Windsurf
        rule-dir: .windsurf/rules/
        format: multi-file
        command-suffix: .md
        instructions: |
          # To use BMad agents in Windsurf:
          # 1. Type @agent-name (e.g., "@dev", "@pm")
          # 2. Windsurf will adopt that agent's persona
      trae:
        name: Trae
        rule-dir: .trae/rules/
        format: multi-file
        command-suffix: .md
        instructions: |
          # To use BMad agents in Trae:
          # 1. Type @agent-name (e.g., "@dev", "@pm", "@architect")
          # 2. Trae will adopt that agent's persona
      roo:
        name: Roo Code
        format: custom-modes
        file: .roomodes
        instructions: |
          # To use BMad agents in Roo Code:
          # 1. Open the mode selector (usually in the status bar)
          # 2. Select any bmad-{agent} mode (e.g., "bmad-dev", "bmad-pm")
          # 3. The AI will adopt that agent's full personality and capabilities
      cline:
        name: Cline
        rule-dir: .clinerules/
        format: multi-file
        command-suffix: .md
        instructions: |
          # To use BMad agents in Cline:
          # 1. Open the Cline chat panel in VS Code
          # 2. Type @agent-name (e.g., "@dev", "@pm", "@architect")
          # 3. The agent will adopt that persona for the conversation
          # 4. Rules are stored in .clinerules/ directory in your project
      gemini:
        name: Gemini CLI
        rule-dir: .gemini/bmad-method/
        format: single-file
        command-suffix: .md
        instructions: |
          # To use BMad agents with the Gemini CLI:
          # 1. The installer creates a .gemini/bmad-method/ directory in your project.
          # 2. It concatenates all agent files into a single GEMINI.md file.
          # 3. Simply mention the agent in your prompt (e.g., "As *dev, ...").
          # 4. The Gemini CLI will automatically have the context for that agent.
      github-copilot:
        name: Github Copilot
        rule-dir: .github/chatmodes/
        format: multi-file
        command-suffix: .md
        instructions: |
          # To use BMad agents with Github Copilot:
          # 1. The installer creates a .github/chatmodes/ directory in your project
          # 2. Open the Chat view (`⌃⌘I` on Mac, `Ctrl+Alt+I` on Windows/Linux) and select **Agent** from the chat mode selector.
          # 3. The agent will adopt that persona for the conversation
          # 4. Requires VS Code 1.101+ with `chat.agent.enabled: true` in settings
          # 5. Agent files are stored in .github/chatmodes/
          # 6. Use `*help` to see available commands and agents
    ]]></file>
  <file path="installer\config\ide-agent-config.yaml"><![CDATA[
    # IDE-specific agent configurations
    # This file defines agent-specific settings for different IDEs
    
    # Roo Code file permissions
    # Each agent can have restricted file access based on regex patterns
    # If an agent is not listed here, it gets full edit access
    roo-permissions:
      # Core agents
      analyst:
        fileRegex: "\\.(md|txt)$"
        description: "Documentation and text files"
      pm:
        fileRegex: "\\.(md|txt)$"
        description: "Product documentation"
      architect:
        fileRegex: "\\.(md|txt|yml|yaml|json)$"
        description: "Architecture docs and configs"
      qa:
        fileRegex: "\\.(test|spec)\\.(js|ts|jsx|tsx)$|\\.md$"
        description: "Test files and documentation"
      ux-expert:
        fileRegex: "\\.(md|css|scss|html|jsx|tsx)$"
        description: "Design-related files"
      po:
        fileRegex: "\\.(md|txt)$"
        description: "Story and requirement docs"
      sm:
        fileRegex: "\\.(md|txt)$"
        description: "Process and planning docs"
      # Expansion pack agents
      game-designer:
        fileRegex: "\\.(md|txt|json|yaml|yml)$"
        description: "Game design documents and configs"
      game-sm:
        fileRegex: "\\.(md|txt)$"
        description: "Game project management docs"
    
    # Cline agent ordering
    # Lower numbers appear first in the list
    # Agents not listed get order 99
    cline-order:
      # Core agents
      bmad-master: 1
      bmad-orchestrator: 2
      pm: 3
      analyst: 4
      architect: 5
      po: 6
      sm: 7
      dev: 8
      qa: 9
      ux-expert: 10
      # Expansion pack agents
      bmad-the-creator: 11
      game-designer: 12
      game-developer: 13
      game-sm: 14
      infra-devops-platform: 15
    ]]></file>
  <file path="installer\bin\bmad.js"><![CDATA[
    #!/usr/bin/env node
    
    const { program } = require('commander');
    const path = require('path');
    const fs = require('fs').promises;
    const yaml = require('js-yaml');
    const chalk = require('chalk');
    const inquirer = require('inquirer');
    
    // Handle both execution contexts (from root via npx or from installer directory)
    let version;
    let installer;
    try {
      // Try installer context first (when run from tools/installer/)
      version = require('../package.json').version;
      installer = require('../lib/installer');
    } catch (e) {
      // Fall back to root context (when run via npx from GitHub)
      console.log(`Installer context not found (${e.message}), trying root context...`);
      try {
        version = require('../../../package.json').version;
        installer = require('../../../tools/installer/lib/installer');
      } catch (e2) {
        console.error('Error: Could not load required modules. Please ensure you are running from the correct directory.');
        console.error('Debug info:', {
          __dirname,
          cwd: process.cwd(),
          error: e2.message
        });
        process.exit(1);
      }
    }
    
    program
      .version(version)
      .description('BMad Method installer - Universal AI agent framework for any domain');
    
    program
      .command('install')
      .description('Install BMad Method agents and tools')
      .option('-f, --full', 'Install complete BMad Method')
      .option('-x, --expansion-only', 'Install only expansion packs (no bmad-core)')
      .option('-d, --directory <path>', 'Installation directory')
      .option('-i, --ide <ide...>', 'Configure for specific IDE(s) - can specify multiple (cursor, claude-code, windsurf, trae, roo, cline, gemini, github-copilot, other)')
      .option('-e, --expansion-packs <packs...>', 'Install specific expansion packs (can specify multiple)')
      .action(async (options) => {
        try {
          if (!options.full && !options.expansionOnly) {
            // Interactive mode
            const answers = await promptInstallation();
            if (!answers._alreadyInstalled) {
              await installer.install(answers);
              process.exit(0);
            }
          } else {
            // Direct mode
            let installType = 'full';
            if (options.expansionOnly) installType = 'expansion-only';
    
            const config = {
              installType,
              directory: options.directory || '.',
              ides: (options.ide || []).filter(ide => ide !== 'other'),
              expansionPacks: options.expansionPacks || []
            };
            await installer.install(config);
            process.exit(0);
          }
        } catch (error) {
          console.error(chalk.red('Installation failed:'), error.message);
          process.exit(1);
        }
      });
    
    program
      .command('update')
      .description('Update existing BMad installation')
      .option('--force', 'Force update, overwriting modified files')
      .option('--dry-run', 'Show what would be updated without making changes')
      .action(async () => {
        try {
          await installer.update();
        } catch (error) {
          console.error(chalk.red('Update failed:'), error.message);
          process.exit(1);
        }
      });
    
    program
      .command('list:expansions')
      .description('List available expansion packs')
      .action(async () => {
        try {
          await installer.listExpansionPacks();
        } catch (error) {
          console.error(chalk.red('Error:'), error.message);
          process.exit(1);
        }
      });
    
    program
      .command('status')
      .description('Show installation status')
      .action(async () => {
        try {
          await installer.showStatus();
        } catch (error) {
          console.error(chalk.red('Error:'), error.message);
          process.exit(1);
        }
      });
    
    program
      .command('flatten')
      .description('Flatten codebase to XML format')
      .option('-i, --input <path>', 'Input directory to flatten', process.cwd())
      .option('-o, --output <path>', 'Output file path', 'flattened-codebase.xml')
      .action(async (options) => {
        try {
          await installer.flatten(options);
        } catch (error) {
          console.error(chalk.red('Flatten failed:'), error.message);
          process.exit(1);
        }
      });
    
    async function promptInstallation() {
      
      // Display ASCII logo
      console.log(chalk.bold.cyan(`
    ██████╗ ███╗   ███╗ █████╗ ██████╗       ███╗   ███╗███████╗████████╗██╗  ██╗ ██████╗ ██████╗ 
    ██╔══██╗████╗ ████║██╔══██╗██╔══██╗      ████╗ ████║██╔════╝╚══██╔══╝██║  ██║██╔═══██╗██╔══██╗
    ██████╔╝██╔████╔██║███████║██║  ██║█████╗██╔████╔██║█████╗     ██║   ███████║██║   ██║██║  ██║
    ██╔══██╗██║╚██╔╝██║██╔══██║██║  ██║╚════╝██║╚██╔╝██║██╔══╝     ██║   ██╔══██║██║   ██║██║  ██║
    ██████╔╝██║ ╚═╝ ██║██║  ██║██████╔╝      ██║ ╚═╝ ██║███████╗   ██║   ██║  ██║╚██████╔╝██████╔╝
    ╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═╝╚═════╝       ╚═╝     ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚═════╝ 
      `));
      
      console.log(chalk.bold.magenta('🚀 Universal AI Agent Framework for Any Domain'));
      console.log(chalk.bold.blue(`✨ Installer v${version}\n`));
    
      const answers = {};
    
      // Ask for installation directory first
      const { directory } = await inquirer.prompt([
        {
          type: 'input',
          name: 'directory',
          message: 'Enter the full path to your project directory where BMad should be installed:',
          validate: (input) => {
            if (!input.trim()) {
              return 'Please enter a valid project path';
            }
            return true;
          }
        }
      ]);
      answers.directory = directory;
    
      // Detect existing installations
      const installDir = path.resolve(directory);
      const state = await installer.detectInstallationState(installDir);
      
      // Check for existing expansion packs
      const existingExpansionPacks = state.expansionPacks || {};
      
      // Get available expansion packs
      const availableExpansionPacks = await installer.getAvailableExpansionPacks();
      
      // Build choices list
      const choices = [];
      
      // Load core config to get short-title
      const coreConfigPath = path.join(__dirname, '..', '..', '..', 'bmad-core', 'core-config.yaml');
      const coreConfig = yaml.load(await fs.readFile(coreConfigPath, 'utf8'));
      const coreShortTitle = coreConfig['short-title'] || 'BMad Agile Core System';
      
      // Add BMad core option
      let bmadOptionText;
      if (state.type === 'v4_existing') {
        const currentVersion = state.manifest?.version || 'unknown';
        const newVersion = version; // Always use package.json version
        const versionInfo = currentVersion === newVersion 
          ? `(v${currentVersion} - reinstall)`
          : `(v${currentVersion} → v${newVersion})`;
        bmadOptionText = `Update ${coreShortTitle} ${versionInfo} .bmad-core`;
      } else {
        bmadOptionText = `${coreShortTitle} (v${version}) .bmad-core`;
      }
      
      choices.push({
        name: bmadOptionText,
        value: 'bmad-core',
        checked: true
      });
      
      // Add expansion pack options
      for (const pack of availableExpansionPacks) {
        const existing = existingExpansionPacks[pack.id];
        let packOptionText;
        
        if (existing) {
          const currentVersion = existing.manifest?.version || 'unknown';
          const newVersion = pack.version;
          const versionInfo = currentVersion === newVersion 
            ? `(v${currentVersion} - reinstall)`
            : `(v${currentVersion} → v${newVersion})`;
          packOptionText = `Update ${pack.shortTitle} ${versionInfo} .${pack.id}`;
        } else {
          packOptionText = `${pack.shortTitle} (v${pack.version}) .${pack.id}`;
        }
        
        choices.push({
          name: packOptionText,
          value: pack.id,
          checked: false
        });
      }
      
      // Ask what to install
      const { selectedItems } = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'selectedItems',
          message: 'Select what to install/update (use space to select, enter to continue):',
          choices: choices,
          validate: (selected) => {
            if (selected.length === 0) {
              return 'Please select at least one item to install';
            }
            return true;
          }
        }
      ]);
      
      // Process selections
      answers.installType = selectedItems.includes('bmad-core') ? 'full' : 'expansion-only';
      answers.expansionPacks = selectedItems.filter(item => item !== 'bmad-core');
    
      // Ask sharding questions if installing BMad core
      if (selectedItems.includes('bmad-core')) {
        console.log(chalk.cyan('\n📋 Document Organization Settings'));
        console.log(chalk.dim('Configure how your project documentation should be organized.\n'));
        
        // Ask about PRD sharding
        const { prdSharded } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'prdSharded',
            message: 'Will the PRD (Product Requirements Document) be sharded into multiple files?',
            default: true
          }
        ]);
        answers.prdSharded = prdSharded;
        
        // Ask about architecture sharding
        const { architectureSharded } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'architectureSharded',
            message: 'Will the architecture documentation be sharded into multiple files?',
            default: true
          }
        ]);
        answers.architectureSharded = architectureSharded;
        
        // Show warning if architecture sharding is disabled
        if (!architectureSharded) {
          console.log(chalk.yellow.bold('\n⚠️  IMPORTANT: Architecture Sharding Disabled'));
          console.log(chalk.yellow('With architecture sharding disabled, you should still create the files listed'));
          console.log(chalk.yellow('in devLoadAlwaysFiles (like coding-standards.md, tech-stack.md, source-tree.md)'));
          console.log(chalk.yellow('as these are used by the dev agent at runtime.'));
          console.log(chalk.yellow('\nAlternatively, you can remove these files from the devLoadAlwaysFiles list'));
          console.log(chalk.yellow('in your core-config.yaml after installation.'));
          
          const { acknowledge } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'acknowledge',
              message: 'Do you acknowledge this requirement and want to proceed?',
              default: false
            }
          ]);
          
          if (!acknowledge) {
            console.log(chalk.red('Installation cancelled.'));
            process.exit(0);
          }
        }
      }
    
      // Ask for IDE configuration
      let ides = [];
      let ideSelectionComplete = false;
      
      while (!ideSelectionComplete) {
        console.log(chalk.cyan('\n🛠️  IDE Configuration'));
        console.log(chalk.bold.yellow.bgRed(' ⚠️  IMPORTANT: This is a MULTISELECT! Use SPACEBAR to toggle each IDE! '));
        console.log(chalk.bold.magenta('🔸 Use arrow keys to navigate'));
        console.log(chalk.bold.magenta('🔸 Use SPACEBAR to select/deselect IDEs'));
        console.log(chalk.bold.magenta('🔸 Press ENTER when finished selecting\n'));
        
        const ideResponse = await inquirer.prompt([
          {
            type: 'checkbox',
            name: 'ides',
            message: 'Which IDE(s) do you want to configure? (Select with SPACEBAR, confirm with ENTER):',
            choices: [
              { name: 'Cursor', value: 'cursor' },
              { name: 'Claude Code', value: 'claude-code' },
              { name: 'Windsurf', value: 'windsurf' },
              { name: 'Trae', value: 'trae' }, // { name: 'Trae', value: 'trae'}
              { name: 'Roo Code', value: 'roo' },
              { name: 'Cline', value: 'cline' },
              { name: 'Gemini CLI', value: 'gemini' },
              { name: 'Github Copilot', value: 'github-copilot' }
            ]
          }
        ]);
        
        ides = ideResponse.ides;
    
        // Confirm no IDE selection if none selected
        if (ides.length === 0) {
          const { confirmNoIde } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirmNoIde',
              message: chalk.red('⚠️  You have NOT selected any IDEs. This means NO IDE integration will be set up. Is this correct?'),
              default: false
            }
          ]);
          
          if (!confirmNoIde) {
            console.log(chalk.bold.red('\n🔄 Returning to IDE selection. Remember to use SPACEBAR to select IDEs!\n'));
            continue; // Go back to IDE selection only
          }
        }
        
        ideSelectionComplete = true;
      }
    
      // Use selected IDEs directly
      answers.ides = ides;
    
      // Configure GitHub Copilot immediately if selected
      if (ides.includes('github-copilot')) {
        console.log(chalk.cyan('\n🔧 GitHub Copilot Configuration'));
        console.log(chalk.dim('BMad works best with specific VS Code settings for optimal agent experience.\n'));
        
        const { configChoice } = await inquirer.prompt([
          {
            type: 'list',
            name: 'configChoice',
            message: chalk.yellow('How would you like to configure GitHub Copilot settings?'),
            choices: [
              {
                name: 'Use recommended defaults (fastest setup)',
                value: 'defaults'
              },
              {
                name: 'Configure each setting manually (customize to your preferences)',
                value: 'manual'
              },
              {
                name: 'Skip settings configuration (I\'ll configure manually later)',
                value: 'skip'
              }
            ],
            default: 'defaults'
          }
        ]);
        
        answers.githubCopilotConfig = { configChoice };
      }
    
      // Ask for web bundles installation
      const { includeWebBundles } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'includeWebBundles',
          message: 'Would you like to include pre-built web bundles? (standalone files for ChatGPT, Claude, Gemini)',
          default: false
        }
      ]);
    
      if (includeWebBundles) {
        console.log(chalk.cyan('\n📦 Web bundles are standalone files perfect for web AI platforms.'));
        console.log(chalk.dim('   You can choose different teams/agents than your IDE installation.\n'));
    
        const { webBundleType } = await inquirer.prompt([
          {
            type: 'list',
            name: 'webBundleType',
            message: 'What web bundles would you like to include?',
            choices: [
              {
                name: 'All available bundles (agents, teams, expansion packs)',
                value: 'all'
              },
              {
                name: 'Specific teams only',
                value: 'teams'
              },
              {
                name: 'Individual agents only',
                value: 'agents'
              },
              {
                name: 'Custom selection',
                value: 'custom'
              }
            ]
          }
        ]);
    
        answers.webBundleType = webBundleType;
    
        // If specific teams, let them choose which teams
        if (webBundleType === 'teams' || webBundleType === 'custom') {
          const teams = await installer.getAvailableTeams();
          const { selectedTeams } = await inquirer.prompt([
            {
              type: 'checkbox',
              name: 'selectedTeams',
              message: 'Select team bundles to include:',
              choices: teams.map(t => ({
                name: `${t.icon || '📋'} ${t.name}: ${t.description}`,
                value: t.id,
                checked: webBundleType === 'teams' // Check all if teams-only mode
              })),
              validate: (answer) => {
                if (answer.length < 1) {
                  return 'You must select at least one team.';
                }
                return true;
              }
            }
          ]);
          answers.selectedWebBundleTeams = selectedTeams;
        }
    
        // If custom selection, also ask about individual agents
        if (webBundleType === 'custom') {
          const { includeIndividualAgents } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'includeIndividualAgents',
              message: 'Also include individual agent bundles?',
              default: true
            }
          ]);
          answers.includeIndividualAgents = includeIndividualAgents;
        }
    
        const { webBundlesDirectory } = await inquirer.prompt([
          {
            type: 'input',
            name: 'webBundlesDirectory',
            message: 'Enter directory for web bundles:',
            default: `${answers.directory}/web-bundles`,
            validate: (input) => {
              if (!input.trim()) {
                return 'Please enter a valid directory path';
              }
              return true;
            }
          }
        ]);
        answers.webBundlesDirectory = webBundlesDirectory;
      }
    
      answers.includeWebBundles = includeWebBundles;
    
      return answers;
    }
    
    program.parse(process.argv);
    
    // Show help if no command provided
    if (!process.argv.slice(2).length) {
      program.outputHelp();
    }
    ]]></file>
</files>
