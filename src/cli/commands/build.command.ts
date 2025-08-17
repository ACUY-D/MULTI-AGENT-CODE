/**
 * Build Command
 * Builds the project for production
 */

import { type ChildProcess, spawn } from 'child_process';
import path from 'path';
import { createLogger } from '@utils/logger';
import fs from 'fs/promises';
import { CLIConfig } from '../utils/config';
import { getLogger } from '../utils/logger';

const cliLogger = getLogger();
const logger = createLogger('build-command');

export interface BuildOptions {
  production?: boolean;
  sourcemaps?: boolean;
  minify?: boolean;
  verbose?: boolean;
}

export class BuildCommand {
  private buildProcess?: ChildProcess;

  /**
   * Execute the build command
   */
  async execute(options: BuildOptions): Promise<void> {
    try {
      // Load configuration
      const config = await CLIConfig.load({
        build: {
          production: options.production !== false,
          sourcemaps: options.sourcemaps !== false,
          minify: options.minify || options.production,
        },
      });

      if (options.verbose) {
        cliLogger.setDebugMode(true);
      }

      cliLogger.box('Building Project', [
        `Mode: ${config.build.production ? 'Production' : 'Development'}`,
        `Sourcemaps: ${config.build.sourcemaps ? 'Enabled' : 'Disabled'}`,
        `Minify: ${config.build.minify ? 'Enabled' : 'Disabled'}`,
      ]);

      const spinner = cliLogger.startSpinner('Building project...');

      try {
        // Clean dist directory
        spinner.text = 'Cleaning dist directory...';
        await this.cleanDist();

        // Run build
        spinner.text = 'Compiling source code...';
        const buildTime = await this.runBuild(config.build);

        // Copy static assets
        spinner.text = 'Copying static assets...';
        await this.copyAssets();

        // Generate bundle analysis
        if (config.build.production) {
          spinner.text = 'Analyzing bundle size...';
          const bundleInfo = await this.analyzeBundleSize();

          cliLogger.spinnerSuccess(`Build completed in ${buildTime}ms`);

          // Display bundle info
          this.displayBundleInfo(bundleInfo);
        } else {
          cliLogger.spinnerSuccess(`Build completed in ${buildTime}ms`);
        }

        // Display build summary
        await this.displayBuildSummary();
      } catch (error) {
        cliLogger.spinnerFail('Build failed');
        throw error;
      }
    } catch (error) {
      cliLogger.error(`Build failed: ${error}`);
      logger.error({ error }, 'Build command failed');
      process.exit(1);
    }
  }

  /**
   * Clean dist directory
   */
  private async cleanDist(): Promise<void> {
    const distPath = path.join(process.cwd(), 'dist');

    try {
      await fs.rm(distPath, { recursive: true, force: true });
      await fs.mkdir(distPath, { recursive: true });
      logger.debug('Dist directory cleaned');
    } catch (error) {
      logger.error({ error }, 'Failed to clean dist directory');
    }
  }

  /**
   * Run build process
   */
  private async runBuild(config: any): Promise<number> {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      // Check if using tsup or tsc
      this.checkBuildTool()
        .then((tool) => {
          let args: string[] = [];

          if (tool === 'tsup') {
            args = this.getTsupArgs(config);
          } else {
            args = this.getTscArgs(config);
          }

          this.buildProcess = spawn(tool, args, {
            stdio: 'pipe',
            cwd: process.cwd(),
          });

          let output = '';
          let errorOutput = '';

          this.buildProcess.stdout?.on('data', (data) => {
            output += data.toString();
            logger.debug(data.toString());
          });

          this.buildProcess.stderr?.on('data', (data) => {
            errorOutput += data.toString();
          });

          this.buildProcess.on('close', (code) => {
            const buildTime = Date.now() - startTime;

            if (code === 0) {
              resolve(buildTime);
            } else {
              reject(new Error(`Build exited with code ${code}\n${errorOutput}`));
            }
          });

          this.buildProcess.on('error', (error) => {
            reject(error);
          });
        })
        .catch(reject);
    });
  }

  /**
   * Check which build tool to use
   */
  private async checkBuildTool(): Promise<string> {
    try {
      // Check for tsup.config.ts
      await fs.access(path.join(process.cwd(), 'tsup.config.ts'));
      return 'tsup';
    } catch {
      // Fallback to tsc
      return 'tsc';
    }
  }

  /**
   * Get tsup arguments
   */
  private getTsupArgs(config: any): string[] {
    const args = [];

    if (!config.sourcemaps) {
      args.push('--no-sourcemap');
    }

    if (config.minify) {
      args.push('--minify');
    }

    if (config.production) {
      args.push('--env.NODE_ENV', 'production');
    }

    return args;
  }

  /**
   * Get tsc arguments
   */
  private getTscArgs(config: any): string[] {
    const args = ['--build'];

    if (config.sourcemaps) {
      args.push('--sourceMap');
    }

    return args;
  }

  /**
   * Copy static assets
   */
  private async copyAssets(): Promise<void> {
    const sourceAssets = [
      { src: 'package.json', dest: 'package.json' },
      { src: 'README.md', dest: 'README.md' },
      { src: '.env.example', dest: '.env.example' },
    ];

    for (const asset of sourceAssets) {
      try {
        const srcPath = path.join(process.cwd(), asset.src);
        const destPath = path.join(process.cwd(), 'dist', asset.dest);

        await fs.copyFile(srcPath, destPath);
        logger.debug(`Copied ${asset.src} to dist/`);
      } catch {
        // Asset doesn't exist, skip
      }
    }
  }

  /**
   * Analyze bundle size
   */
  private async analyzeBundleSize(): Promise<any> {
    const distPath = path.join(process.cwd(), 'dist');
    let totalSize = 0;
    const files: any[] = [];

    try {
      const entries = await fs.readdir(distPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile()) {
          const filePath = path.join(distPath, entry.name);
          const stats = await fs.stat(filePath);

          files.push({
            name: entry.name,
            size: stats.size,
          });

          totalSize += stats.size;
        }
      }
    } catch (error) {
      logger.error({ error }, 'Failed to analyze bundle size');
    }

    return {
      totalSize,
      files: files.sort((a, b) => b.size - a.size),
    };
  }

  /**
   * Display bundle information
   */
  private displayBundleInfo(bundleInfo: any): void {
    cliLogger.newLine();
    cliLogger.info('Bundle Analysis:');
    cliLogger.divider();

    const tableData = bundleInfo.files.slice(0, 10).map((file: any) => [file.name, this.formatSize(file.size)]);

    cliLogger.table(tableData, {
      head: ['File', 'Size'],
      colWidths: [40, 15],
    });

    cliLogger.newLine();
    cliLogger.info(`Total Bundle Size: ${this.formatSize(bundleInfo.totalSize)}`);
  }

  /**
   * Display build summary
   */
  private async displayBuildSummary(): Promise<void> {
    const distPath = path.join(process.cwd(), 'dist');

    try {
      const files = await fs.readdir(distPath);

      cliLogger.newLine();
      cliLogger.box('Build Summary', [
        `Output Directory: ./dist`,
        `Files Generated: ${files.length}`,
        `Entry Point: dist/index.js`,
      ]);

      cliLogger.newLine();
      cliLogger.success('✨ Build completed successfully!');
      cliLogger.info('The project is ready for deployment.');

      cliLogger.newLine();
      cliLogger.info('Next steps:');
      cliLogger.list(
        [
          'npm publish - Publish to npm registry',
          'npm link - Link for local development',
          'docker build - Create Docker image',
        ],
        true,
      );
    } catch (error) {
      logger.error({ error }, 'Failed to display build summary');
    }
  }

  /**
   * Format file size
   */
  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}

// Export singleton instance
export const buildCommand = new BuildCommand();
