#!/usr/bin/env node
/**
 * MCP Dev Orchestrator CLI
 * Complete command-line interface for the MCP development orchestrator
 */

import { Command } from 'commander';
import { CLIConfig } from './utils/config';
import { getLogger } from './utils/logger';

import { buildCommand } from './commands/build.command';
import { devCommand } from './commands/dev.command';
import { initCommand } from './commands/init.command';
import { lintCommand } from './commands/lint.command';
import { resumeCommand } from './commands/resume.command';
import { runCommand } from './commands/run.command';
// Import all commands
import { startCommand } from './commands/start.command';
import { statusCommand } from './commands/status.command';
import { testCommand } from './commands/test.command';

const cliLogger = getLogger();
const program = new Command();

// Get version from package.json
const packageJson = require('../../package.json');

/**
 * Main CLI configuration
 */
program
  .name('mcp-dev-orchestrator')
  .description('MCP Server for automated software development with BMAD methodology')
  .version(packageJson.version)
  .option('-v, --verbose', 'Enable verbose output')
  .hook('preAction', async (thisCommand) => {
    // Set debug mode if verbose flag is set
    const options = thisCommand.opts();
    if (options.verbose) {
      cliLogger.setDebugMode(true);
    }
  });

/**
 * Start command - Start the MCP server
 */
program
  .command('start')
  .description('Start the MCP server')
  .option('--stdio', 'Use stdio transport (default)')
  .option('--http', 'Use HTTP transport')
  .option('-p, --port <port>', 'Server port for HTTP mode', '3000')
  .option('-h, --host <host>', 'Server host for HTTP mode', 'localhost')
  .action(async (options) => {
    await startCommand.execute(options);
  });

/**
 * Init command - Initialize a new project
 */
program
  .command('init')
  .description('Initialize a new project with MCP orchestrator')
  .option('-t, --template <template>', 'Project template (node|python|go|typescript)', 'typescript')
  .option('-n, --name <name>', 'Project name')
  .option('-f, --force', 'Force initialization even if directory exists')
  .option('--no-interactive', 'Skip interactive prompts')
  .action(async (options) => {
    await initCommand.execute(options);
  });

/**
 * Run command - Execute BMAD pipeline
 */
program
  .command('run')
  .description('Run the BMAD pipeline')
  .option('-o, --objective <objective>', 'Pipeline objective')
  .option('-m, --mode <mode>', 'Execution mode (auto|semi|dry-run)', 'semi')
  .option('-w, --watch', 'Enable watch mode for continuous execution')
  .option('-c, --checkpoint <id>', 'Resume from specific checkpoint')
  .action(async (options) => {
    await runCommand.execute(options);
  });

/**
 * Status command - Show pipeline status
 */
program
  .command('status')
  .description('Show current pipeline and agent status')
  .option('-f, --format <format>', 'Output format (json|table|markdown)', 'table')
  .option('-d, --detailed', 'Show detailed information')
  .option('-w, --watch', 'Watch mode for real-time updates')
  .action(async (options) => {
    await statusCommand.execute(options);
  });

/**
 * Resume command - Resume from checkpoint
 */
program
  .command('resume')
  .description('Resume pipeline from a checkpoint')
  .option('-f, --from <checkpoint>', 'Checkpoint ID to resume from')
  .option('-l, --list', 'List available checkpoints')
  .option('--force', 'Skip confirmation prompt')
  .action(async (options) => {
    await resumeCommand.execute(options);
  });

/**
 * Dev command - Development server
 */
program
  .command('dev')
  .description('Start development server with watch mode')
  .option('-p, --port <port>', 'Development server port', '3001')
  .option('--no-watch', 'Disable file watching')
  .option('--no-hot-reload', 'Disable hot reload')
  .action(async (options) => {
    await devCommand.execute(options);
  });

/**
 * Test command - Run tests
 */
program
  .command('test')
  .description('Run test suites')
  .option('-s, --suite <suite>', 'Test suite to run (unit|integration|e2e|all)', 'all')
  .option('-c, --coverage', 'Generate coverage report')
  .option('-w, --watch', 'Watch mode for continuous testing')
  .action(async (options) => {
    await testCommand.execute(options);
  });

/**
 * Lint command - Code linting
 */
program
  .command('lint')
  .description('Check code style and formatting')
  .option('-f, --fix', 'Automatically fix issues')
  .action(async (options) => {
    await lintCommand.execute(options);
  });

/**
 * Build command - Build for production
 */
program
  .command('build')
  .description('Build project for production')
  .option('--no-production', 'Build in development mode')
  .option('--no-sourcemaps', 'Disable sourcemaps')
  .option('--minify', 'Enable minification')
  .action(async (options) => {
    await buildCommand.execute(options);
  });

/**
 * Config command - Manage configuration
 */
program
  .command('config')
  .description('Manage MCP orchestrator configuration')
  .argument('[key]', 'Configuration key to get/set')
  .argument('[value]', 'Value to set')
  .option('-l, --list', 'List all configuration')
  .option('-r, --reset', 'Reset to default configuration')
  .option('-e, --edit', 'Open configuration in editor')
  .action(async (key, value, options) => {
    try {
      if (options.list) {
        const config = CLIConfig.get();
        cliLogger.box('Current Configuration', []);
        console.log(JSON.stringify(config, null, 2));
      } else if (options.reset) {
        CLIConfig.reset();
        cliLogger.success('Configuration reset to defaults');
      } else if (options.edit) {
        // Open in default editor
        const { spawn } = await import('child_process');
        const editor = process.env.EDITOR || 'nano';
        spawn(editor, ['mcp-orchestrator.config.json'], { stdio: 'inherit' });
      } else if (key && value) {
        // Set configuration value
        const config = CLIConfig.get();
        const keys = key.split('.');
        let obj: any = config;

        for (let i = 0; i < keys.length - 1; i++) {
          if (!obj[keys[i]]) obj[keys[i]] = {};
          obj = obj[keys[i]];
        }

        obj[keys[keys.length - 1]] = value;
        await CLIConfig.save(config);
        cliLogger.success(`Set ${key} = ${value}`);
      } else if (key) {
        // Get configuration value
        const config = CLIConfig.get();
        const keys = key.split('.');
        let value: any = config;

        for (const k of keys) {
          value = value?.[k];
        }

        if (value !== undefined) {
          console.log(value);
        } else {
          cliLogger.warning(`Configuration key '${key}' not found`);
        }
      } else {
        // Show help for config command
        console.log('Usage:');
        console.log('  mcp-dev-orchestrator config --list              # List all config');
        console.log('  mcp-dev-orchestrator config <key>               # Get value');
        console.log('  mcp-dev-orchestrator config <key> <value>       # Set value');
        console.log('  mcp-dev-orchestrator config --reset             # Reset to defaults');
      }
    } catch (error) {
      cliLogger.error(`Config command failed: ${error}`);
      process.exit(1);
    }
  });

/**
 * Version command - Show version information
 */
program
  .command('version')
  .description('Show version and system information')
  .action(() => {
    cliLogger.box('MCP Dev Orchestrator', [
      `Version: ${packageJson.version}`,
      `Node: ${process.version}`,
      `Platform: ${process.platform}`,
      `Architecture: ${process.arch}`,
      `Working Directory: ${process.cwd()}`,
    ]);
  });

/**
 * Help command enhancement
 */
program
  .command('help [command]')
  .description('Show help for a specific command')
  .action((command) => {
    if (command) {
      const cmd = program.commands.find((c) => c.name() === command);
      if (cmd) {
        cmd.outputHelp();
      } else {
        cliLogger.error(`Unknown command: ${command}`);
        program.outputHelp();
      }
    } else {
      program.outputHelp();
    }
  });

/**
 * Interactive mode (if no command provided)
 */
async function interactiveMode() {
  const inquirer = await import('inquirer');

  cliLogger.box('MCP Dev Orchestrator - Interactive Mode', [
    'Welcome to the MCP Development Orchestrator!',
    'This tool helps you automate software development using the BMAD methodology.',
  ]);

  const { action } = await inquirer.default.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: '🚀 Start MCP Server', value: 'start' },
        { name: '📦 Initialize New Project', value: 'init' },
        { name: '▶️  Run Pipeline', value: 'run' },
        { name: '📊 Check Status', value: 'status' },
        { name: '🔄 Resume from Checkpoint', value: 'resume' },
        { name: '💻 Start Dev Server', value: 'dev' },
        { name: '🧪 Run Tests', value: 'test' },
        { name: '🔍 Lint Code', value: 'lint' },
        { name: '📦 Build for Production', value: 'build' },
        { name: '⚙️  Configure', value: 'config' },
        { name: '❌ Exit', value: 'exit' },
      ],
    },
  ]);

  if (action === 'exit') {
    cliLogger.info('Goodbye! 👋');
    process.exit(0);
  }

  // Execute selected command
  const command = program.commands.find((cmd) => cmd.name() === action);
  if (command) {
    // Get command-specific options interactively
    await command.parseAsync([process.argv[0], process.argv[1], action]);
  }
}

/**
 * Error handling
 */
program.exitOverride();

program.on('error', (error) => {
  cliLogger.error(`Command error: ${error.message}`);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  cliLogger.error(`Uncaught exception: ${error.message}`);
  if (program.opts().verbose) {
    console.error(error.stack);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  cliLogger.error(`Unhandled rejection: ${reason}`);
  if (program.opts().verbose) {
    console.error('Promise:', promise);
  }
  process.exit(1);
});

/**
 * Main execution
 */
async function main() {
  // Parse command line arguments
  if (process.argv.length <= 2) {
    // No command provided, enter interactive mode
    await interactiveMode();
  } else {
    // Parse and execute command
    await program.parseAsync(process.argv);
  }
}

// Run the CLI
main().catch((error) => {
  cliLogger.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
