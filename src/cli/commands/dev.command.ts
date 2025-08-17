/**
 * Dev Command
 * Starts development server with watch mode and hot reload
 */

import { type ChildProcess, spawn } from 'child_process';
import { createLogger } from '@utils/logger';
import chokidar from 'chokidar';
import { CLIConfig } from '../utils/config';
import { getLogger } from '../utils/logger';

const cliLogger = getLogger();
const logger = createLogger('dev-command');

export interface DevOptions {
  watch?: boolean;
  hotReload?: boolean;
  port?: number;
  verbose?: boolean;
}

export class DevCommand {
  private devProcess?: ChildProcess;
  private watcher?: chokidar.FSWatcher;
  private isRunning = false;

  /**
   * Execute the dev command
   */
  async execute(options: DevOptions): Promise<void> {
    try {
      // Load configuration
      const config = await CLIConfig.load({
        dev: {
          watch: options.watch !== false,
          hotReload: options.hotReload !== false,
          port: options.port || 3001,
        },
      });

      if (options.verbose) {
        cliLogger.setDebugMode(true);
      }

      cliLogger.box('Development Server', [
        `Port: ${config.dev.port}`,
        `Watch: ${config.dev.watch ? 'Enabled' : 'Disabled'}`,
        `Hot Reload: ${config.dev.hotReload ? 'Enabled' : 'Disabled'}`,
      ]);

      // Start dev server
      const spinner = cliLogger.startSpinner('Starting development server...');

      try {
        // Check for TypeScript project
        const isTypeScript = await this.isTypeScriptProject();

        if (isTypeScript) {
          await this.startTypeScriptDev(config.dev);
        } else {
          await this.startNodeDev(config.dev);
        }

        cliLogger.spinnerSuccess('Development server started');

        // Setup file watching
        if (config.dev.watch) {
          await this.setupWatcher(config.dev.hotReload);
        }

        // Setup signal handlers
        this.setupSignalHandlers();

        cliLogger.info('Development server is running. Press Ctrl+C to stop');

        // Keep process alive
        await this.keepAlive();
      } catch (error) {
        cliLogger.spinnerFail('Failed to start development server');
        throw error;
      }
    } catch (error) {
      cliLogger.error(`Dev server failed: ${error}`);
      logger.error({ error }, 'Dev command failed');
      process.exit(1);
    }
  }

  /**
   * Check if project is TypeScript
   */
  private async isTypeScriptProject(): Promise<boolean> {
    const fs = await import('fs/promises');
    const path = await import('path');

    try {
      await fs.access(path.join(process.cwd(), 'tsconfig.json'));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Start TypeScript development server
   */
  private async startTypeScriptDev(config: any): Promise<void> {
    const command = 'tsx';
    const args = ['watch', 'src/index.ts'];

    if (config.port) {
      args.push('--port', config.port.toString());
    }

    this.devProcess = spawn(command, args, {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'development',
        PORT: config.port.toString(),
      },
    });

    this.isRunning = true;

    this.devProcess.on('error', (error) => {
      logger.error({ error }, 'Development server error');
      cliLogger.error(`Development server error: ${error.message}`);
    });

    this.devProcess.on('exit', (code) => {
      this.isRunning = false;
      if (code !== 0 && code !== null) {
        cliLogger.error(`Development server exited with code ${code}`);
      }
    });
  }

  /**
   * Start Node.js development server
   */
  private async startNodeDev(config: any): Promise<void> {
    const command = 'node';
    const args = ['--watch', 'src/index.js'];

    this.devProcess = spawn(command, args, {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'development',
        PORT: config.port.toString(),
      },
    });

    this.isRunning = true;

    this.devProcess.on('error', (error) => {
      logger.error({ error }, 'Development server error');
      cliLogger.error(`Development server error: ${error.message}`);
    });

    this.devProcess.on('exit', (code) => {
      this.isRunning = false;
      if (code !== 0 && code !== null) {
        cliLogger.error(`Development server exited with code ${code}`);
      }
    });
  }

  /**
   * Setup file watcher
   */
  private async setupWatcher(hotReload: boolean): Promise<void> {
    const watchPaths = ['src/**/*', 'tests/**/*', 'package.json', 'tsconfig.json', '.env'];

    this.watcher = chokidar.watch(watchPaths, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: true,
    });

    this.watcher
      .on('add', (path) => {
        cliLogger.info(`File added: ${path}`);
        if (hotReload) this.reload();
      })
      .on('change', (path) => {
        cliLogger.info(`File changed: ${path}`);
        if (hotReload) this.reload();
      })
      .on('unlink', (path) => {
        cliLogger.info(`File removed: ${path}`);
        if (hotReload) this.reload();
      });

    logger.debug('File watcher initialized');
  }

  /**
   * Reload development server
   */
  private reload(): void {
    if (this.devProcess) {
      cliLogger.info('Reloading development server...');
      // The tsx/node --watch flags handle reload automatically
      // This is for additional hot reload logic if needed
    }
  }

  /**
   * Setup signal handlers
   */
  private setupSignalHandlers(): void {
    const shutdown = async (signal: string) => {
      cliLogger.newLine();
      cliLogger.info(`Received ${signal}, stopping development server...`);

      await this.stop();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }

  /**
   * Keep process alive
   */
  private async keepAlive(): Promise<void> {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (!this.isRunning) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });
  }

  /**
   * Stop development server
   */
  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.devProcess) {
      this.devProcess.kill();
      this.devProcess = undefined;
      logger.info('Development server stopped');
    }

    if (this.watcher) {
      await this.watcher.close();
      this.watcher = undefined;
      logger.info('File watcher stopped');
    }
  }
}

// Export singleton instance
export const devCommand = new DevCommand();
