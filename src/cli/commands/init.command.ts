/**
 * Init Command
 * Initializes a new project with MCP orchestrator
 */

import path from 'path';
import { createLogger } from '@utils/logger';
import fs from 'fs/promises';
import inquirer from 'inquirer';
import { CLIConfig } from '../utils/config';
import { getLogger } from '../utils/logger';

const cliLogger = getLogger();
const logger = createLogger('init-command');

export interface InitOptions {
  template?: 'node' | 'python' | 'go' | 'typescript';
  name?: string;
  force?: boolean;
  interactive?: boolean;
}

interface ProjectConfig {
  name: string;
  template: string;
  description?: string;
  author?: string;
  version: string;
  rootDir: string;
  kiloDir: string;
}

export class InitCommand {
  private templates = {
    node: {
      name: 'Node.js',
      description: 'Node.js project with JavaScript',
      files: {
        'package.json': this.getNodePackageJson,
        '.gitignore': this.getGitignore,
        'README.md': this.getReadme,
        'src/index.js': this.getNodeIndex,
      },
    },
    typescript: {
      name: 'TypeScript',
      description: 'TypeScript project with type safety',
      files: {
        'package.json': this.getTsPackageJson,
        'tsconfig.json': this.getTsConfig,
        '.gitignore': this.getGitignore,
        'README.md': this.getReadme,
        'src/index.ts': this.getTsIndex,
      },
    },
    python: {
      name: 'Python',
      description: 'Python project with pip',
      files: {
        'requirements.txt': this.getPythonRequirements,
        'setup.py': this.getPythonSetup,
        '.gitignore': this.getPythonGitignore,
        'README.md': this.getReadme,
        'src/__init__.py': () => '',
        'src/main.py': this.getPythonMain,
      },
    },
    go: {
      name: 'Go',
      description: 'Go project with modules',
      files: {
        'go.mod': this.getGoMod,
        '.gitignore': this.getGoGitignore,
        'README.md': this.getReadme,
        'main.go': this.getGoMain,
      },
    },
  };

  /**
   * Execute the init command
   */
  async execute(options: InitOptions): Promise<void> {
    try {
      const config = await this.gatherProjectInfo(options);

      cliLogger.box('Project Configuration', [
        `Name: ${config.name}`,
        `Template: ${config.template}`,
        `Directory: ${config.rootDir}`,
        `Version: ${config.version}`,
      ]);

      // Check if directory exists
      if (!options.force && (await this.directoryExists(config.rootDir))) {
        const { proceed } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'proceed',
            message: `Directory ${config.rootDir} already exists. Continue?`,
            default: false,
          },
        ]);

        if (!proceed) {
          cliLogger.warning('Initialization cancelled');
          return;
        }
      }

      const spinner = cliLogger.startSpinner('Initializing project...');

      try {
        // Create project structure
        spinner.text = 'Creating project structure...';
        await this.createProjectStructure(config);

        // Create template files
        spinner.text = 'Creating template files...';
        await this.createTemplateFiles(config);

        // Initialize git if not exists
        spinner.text = 'Initializing git repository...';
        await this.initGit(config);

        // Create .kilo directory structure
        spinner.text = 'Creating .kilo directory...';
        await this.createKiloStructure(config);

        // Save configuration
        spinner.text = 'Saving configuration...';
        await this.saveConfiguration(config);

        cliLogger.spinnerSuccess('Project initialized successfully!');

        // Display next steps
        this.displayNextSteps(config);
      } catch (error) {
        cliLogger.spinnerFail('Failed to initialize project');
        throw error;
      }
    } catch (error) {
      cliLogger.error(`Initialization failed: ${error}`);
      logger.error({ error }, 'Init command failed');
      process.exit(1);
    }
  }

  /**
   * Gather project information
   */
  private async gatherProjectInfo(options: InitOptions): Promise<ProjectConfig> {
    const config: Partial<ProjectConfig> = {
      rootDir: process.cwd(),
      kiloDir: '.kilo',
      version: '0.1.0',
    };

    if (options.interactive !== false) {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Project name:',
          default: options.name || path.basename(process.cwd()),
          validate: (input: string) => {
            if (!input || input.trim().length === 0) {
              return 'Project name is required';
            }
            return true;
          },
        },
        {
          type: 'list',
          name: 'template',
          message: 'Select project template:',
          choices: Object.entries(this.templates).map(([key, value]) => ({
            name: `${value.name} - ${value.description}`,
            value: key,
          })),
          default: options.template || 'typescript',
        },
        {
          type: 'input',
          name: 'description',
          message: 'Project description:',
          default: 'A project managed by MCP Orchestrator',
        },
        {
          type: 'input',
          name: 'author',
          message: 'Author:',
          default: '',
        },
      ]);

      Object.assign(config, answers);
    } else {
      config.name = options.name || path.basename(process.cwd());
      config.template = options.template || 'typescript';
      config.description = 'A project managed by MCP Orchestrator';
    }

    return config as ProjectConfig;
  }

  /**
   * Check if directory exists
   */
  private async directoryExists(dir: string): Promise<boolean> {
    try {
      const stat = await fs.stat(dir);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Create project structure
   */
  private async createProjectStructure(config: ProjectConfig): Promise<void> {
    const dirs = [
      config.rootDir,
      path.join(config.rootDir, 'src'),
      path.join(config.rootDir, 'tests'),
      path.join(config.rootDir, 'docs'),
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }

    logger.debug({ dirs }, 'Project structure created');
  }

  /**
   * Create template files
   */
  private async createTemplateFiles(config: ProjectConfig): Promise<void> {
    const template = this.templates[config.template as keyof typeof this.templates];
    if (!template) {
      throw new Error(`Unknown template: ${config.template}`);
    }

    for (const [filePath, contentGenerator] of Object.entries(template.files)) {
      const fullPath = path.join(config.rootDir, filePath);
      const dir = path.dirname(fullPath);

      await fs.mkdir(dir, { recursive: true });

      const content = contentGenerator.call(this, config);
      await fs.writeFile(fullPath, content, 'utf-8');

      logger.debug({ filePath }, 'Template file created');
    }
  }

  /**
   * Initialize git repository
   */
  private async initGit(config: ProjectConfig): Promise<void> {
    const gitDir = path.join(config.rootDir, '.git');

    try {
      const stat = await fs.stat(gitDir);
      if (stat.isDirectory()) {
        logger.debug('Git repository already exists');
        return;
      }
    } catch {
      // Git directory doesn't exist, initialize it
      const { spawn } = await import('child_process');

      return new Promise((resolve, reject) => {
        const git = spawn('git', ['init'], {
          cwd: config.rootDir,
          stdio: 'ignore',
        });

        git.on('close', (code) => {
          if (code === 0) {
            logger.debug('Git repository initialized');
            resolve();
          } else {
            logger.warn('Failed to initialize git repository');
            resolve(); // Don't fail the whole process
          }
        });

        git.on('error', () => {
          logger.warn('Git not available, skipping repository initialization');
          resolve(); // Don't fail if git is not available
        });
      });
    }
  }

  /**
   * Create .kilo directory structure
   */
  private async createKiloStructure(config: ProjectConfig): Promise<void> {
    const kiloDirs = [
      path.join(config.rootDir, config.kiloDir),
      path.join(config.rootDir, config.kiloDir, 'state'),
      path.join(config.rootDir, config.kiloDir, 'checkpoints'),
      path.join(config.rootDir, config.kiloDir, 'artifacts'),
      path.join(config.rootDir, config.kiloDir, 'logs'),
    ];

    for (const dir of kiloDirs) {
      await fs.mkdir(dir, { recursive: true });
    }

    // Create initial STATE.json
    const stateFile = path.join(config.rootDir, config.kiloDir, 'state', 'STATE.json');
    const initialState = {
      pipeline: {
        id: null,
        status: 'idle',
        phase: null,
        startTime: null,
        endTime: null,
      },
      agents: {},
      tasks: [],
      metrics: {
        totalTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
      },
    };

    await fs.writeFile(stateFile, JSON.stringify(initialState, null, 2), 'utf-8');

    logger.debug({ kiloDirs }, '.kilo structure created');
  }

  /**
   * Save configuration
   */
  private async saveConfiguration(config: ProjectConfig): Promise<void> {
    const configPath = path.join(config.rootDir, 'mcp-orchestrator.config.json');

    const configData = {
      project: {
        name: config.name,
        type: config.template,
        rootDir: config.rootDir,
        kiloDir: config.kiloDir,
      },
      version: config.version,
      createdAt: new Date().toISOString(),
    };

    await fs.writeFile(configPath, JSON.stringify(configData, null, 2), 'utf-8');

    logger.debug({ configPath }, 'Configuration saved');
  }

  /**
   * Display next steps
   */
  private displayNextSteps(config: ProjectConfig): void {
    cliLogger.newLine();
    cliLogger.box('🎉 Project Initialized Successfully!', [
      `Project: ${config.name}`,
      `Template: ${config.template}`,
      `Location: ${config.rootDir}`,
    ]);

    cliLogger.newLine();
    cliLogger.info('Next steps:');
    cliLogger.list(
      [
        `cd ${path.relative(process.cwd(), config.rootDir) || '.'}`,
        'mcp-dev-orchestrator start --stdio  # Start MCP server',
        'mcp-dev-orchestrator run --objective "Build my application"  # Run pipeline',
        'mcp-dev-orchestrator status  # Check pipeline status',
      ],
      true,
    );

    cliLogger.newLine();
    cliLogger.info('For more information, visit: https://github.com/yourusername/mcp-dev-orchestrator');
  }

  // Template content generators
  private getNodePackageJson(config: ProjectConfig): string {
    return JSON.stringify(
      {
        name: config.name,
        version: config.version,
        description: config.description,
        main: 'src/index.js',
        scripts: {
          start: 'node src/index.js',
          test: 'echo "Error: no test specified" && exit 1',
        },
        keywords: ['mcp', 'orchestrator'],
        author: config.author,
        license: 'MIT',
        dependencies: {},
        devDependencies: {},
      },
      null,
      2,
    );
  }

  private getTsPackageJson(config: ProjectConfig): string {
    return JSON.stringify(
      {
        name: config.name,
        version: config.version,
        description: config.description,
        main: 'dist/index.js',
        scripts: {
          build: 'tsc',
          start: 'node dist/index.js',
          dev: 'tsx src/index.ts',
          test: 'echo "Error: no test specified" && exit 1',
        },
        keywords: ['mcp', 'orchestrator', 'typescript'],
        author: config.author,
        license: 'MIT',
        dependencies: {},
        devDependencies: {
          '@types/node': '^22.0.0',
          typescript: '^5.0.0',
          tsx: '^4.0.0',
        },
      },
      null,
      2,
    );
  }

  private getTsConfig(config: ProjectConfig): string {
    return JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'commonjs',
          lib: ['ES2022'],
          outDir: './dist',
          rootDir: './src',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
          resolveJsonModule: true,
          declaration: true,
          declarationMap: true,
          sourceMap: true,
        },
        include: ['src/**/*'],
        exclude: ['node_modules', 'dist'],
      },
      null,
      2,
    );
  }

  private getGitignore(config: ProjectConfig): string {
    return `# Dependencies
node_modules/

# Build outputs
dist/
build/
*.js
*.js.map
*.d.ts

# Logs
logs/
*.log
npm-debug.log*

# Environment variables
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# MCP Orchestrator
.kilo/state/
.kilo/checkpoints/
.kilo/logs/
.kilo/artifacts/
`;
  }

  private getPythonGitignore(config: ProjectConfig): string {
    return `# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
*.egg-info/
.installed.cfg
*.egg

# Virtual Environment
venv/
ENV/
env/

# IDE
.vscode/
.idea/
*.swp
*.swo

# MCP Orchestrator
.kilo/state/
.kilo/checkpoints/
.kilo/logs/
.kilo/artifacts/
`;
  }

  private getGoGitignore(config: ProjectConfig): string {
    return `# Binaries for programs and plugins
*.exe
*.exe~
*.dll
*.so
*.dylib

# Test binary, built with go test -c
*.test

# Output of the go coverage tool
*.out

# Dependency directories
vendor/

# Go workspace file
go.work

# IDE
.vscode/
.idea/

# MCP Orchestrator
.kilo/state/
.kilo/checkpoints/
.kilo/logs/
.kilo/artifacts/
`;
  }

  private getReadme(config: ProjectConfig): string {
    return `# ${config.name}

${config.description || 'A project managed by MCP Dev Orchestrator'}

## Getting Started

This project is managed by MCP Dev Orchestrator, which provides automated development workflows using the BMAD methodology.

### Prerequisites

- MCP Dev Orchestrator installed globally
- ${config.template === 'node' || config.template === 'typescript' ? 'Node.js >= 20.0.0' : ''}
${config.template === 'python' ? 'Python >= 3.8' : ''}
${config.template === 'go' ? 'Go >= 1.21' : ''}

### Installation

\`\`\`bash
# Install dependencies
${config.template === 'node' || config.template === 'typescript' ? 'npm install' : ''}
${config.template === 'python' ? 'pip install -r requirements.txt' : ''}
${config.template === 'go' ? 'go mod download' : ''}
\`\`\`

### Running the Orchestrator

\`\`\`bash
# Start the MCP server
mcp-dev-orchestrator start --stdio

# Run a development pipeline
mcp-dev-orchestrator run --objective "Implement feature X"

# Check pipeline status
mcp-dev-orchestrator status
\`\`\`

## Project Structure

\`\`\`
${config.name}/
├── src/              # Source code
├── tests/            # Test files
├── docs/             # Documentation
├── .kilo/            # MCP Orchestrator data
│   ├── state/        # Pipeline state
│   ├── checkpoints/  # Pipeline checkpoints
│   ├── artifacts/    # Generated artifacts
│   └── logs/         # Execution logs
└── mcp-orchestrator.config.json
\`\`\`

## License

MIT
`;
  }

  private getNodeIndex(config: ProjectConfig): string {
    return `// ${config.name} - Main entry point

console.log('Hello from ${config.name}!');
console.log('This project is managed by MCP Dev Orchestrator');

// Your code here
`;
  }

  private getTsIndex(config: ProjectConfig): string {
    return `// ${config.name} - Main entry point

console.log('Hello from ${config.name}!');
console.log('This project is managed by MCP Dev Orchestrator');

// Your TypeScript code here

export {};
`;
  }

  private getPythonMain(config: ProjectConfig): string {
    return `#!/usr/bin/env python3
"""${config.name} - Main entry point"""

def main():
    print(f"Hello from ${config.name}!")
    print("This project is managed by MCP Dev Orchestrator")
    
    # Your code here

if __name__ == "__main__":
    main()
`;
  }

  private getPythonRequirements(config: ProjectConfig): string {
    return `# ${config.name} dependencies
# Add your Python dependencies here
`;
  }

  private getPythonSetup(config: ProjectConfig): string {
    return `from setuptools import setup, find_packages

setup(
    name="${config.name}",
    version="${config.version}",
    description="${config.description}",
    author="${config.author}",
    packages=find_packages(),
    python_requires=">=3.8",
    install_requires=[
        # Add your dependencies here
    ],
)
`;
  }

  private getGoMod(config: ProjectConfig): string {
    return `module ${config.name}

go 1.21

// Add your dependencies here
`;
  }

  private getGoMain(config: ProjectConfig): string {
    return `package main

import "fmt"

func main() {
    fmt.Println("Hello from ${config.name}!")
    fmt.Println("This project is managed by MCP Dev Orchestrator")
    
    // Your Go code here
}
`;
  }
}

// Export singleton instance
export const initCommand = new InitCommand();
