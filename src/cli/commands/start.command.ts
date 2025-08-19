/**
 * Start Command
 * Starts the MCP server in stdio or HTTP mode
 */

import { type ChildProcess, spawn } from 'child_process';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { PromptRegistry } from '@prompts/registry';
import { ResourceRegistry } from '@resources/registry';
import { ToolRegistry } from '@tools/registry';
import { createLogger } from '@utils/logger';
import { CLIConfig } from '../utils/config';
import { getLogger } from '../utils/logger';

const cliLogger = getLogger();
const logger = createLogger('start-command');

export interface StartOptions {
  stdio?: boolean;
  http?: boolean;
  port?: number;
  host?: string;
  verbose?: boolean;
}

export class StartCommand {
  private server?: Server;
  private serverProcess?: ChildProcess;
  private isRunning = false;

  /**
   * Execute the start command
   */
  async execute(options: StartOptions): Promise<void> {
    try {
      // Load configuration
      const config = await CLIConfig.load({
        server: {
          mode: options.stdio ? 'stdio' : options.http ? 'http' : 'stdio',
          port: options.port || 3000,
          host: options.host || 'localhost',
        },
      });

      const serverMode = config.server.mode;
      const port = config.server.port;
      const host = config.server.host;

      if (options.verbose) {
        cliLogger.setDebugMode(true);
      }

      cliLogger.info(`Starting MCP server in ${serverMode} mode...`);

      if (serverMode === 'stdio') {
        await this.startStdioServer();
      } else {
        await this.startHttpServer(host, port);
      }

      // Handle shutdown signals
      this.setupSignalHandlers();

      cliLogger.success(`MCP server started successfully in ${serverMode} mode`);

      if (serverMode === 'http') {
        cliLogger.info(`Server running at http://${host}:${port}`);
      }

      cliLogger.info('Press Ctrl+C to stop');

      // Keep the process running
      await this.keepAlive();
    } catch (error) {
      cliLogger.error(`Failed to start server: ${error}`);
      logger.error({ error }, 'Server start failed');
      process.exit(1);
    }
  }

  /**
   * Start server in stdio mode
   */
  private async startStdioServer(): Promise<void> {
    const spinner = cliLogger.startSpinner('Initializing stdio server...');

    try {
      // Create server instance
      this.server = new Server(
        {
          name: 'mcp-dev-orchestrator',
          version: '0.1.0',
        },
        {
          capabilities: {
            tools: {},
            resources: {},
            prompts: {},
          },
        },
      );

      // Initialize registries
      spinner.text = 'Loading tools...';
      const toolRegistry = new ToolRegistry();
      await toolRegistry.initialize();

      spinner.text = 'Loading resources...';
      const resourceRegistry = new ResourceRegistry();
      await resourceRegistry.initialize();

      spinner.text = 'Loading prompts...';
      const promptRegistry = new PromptRegistry();
      await promptRegistry.initialize();

      // Register handlers
      this.registerHandlers();

      // Create stdio transport
      const transport = new StdioServerTransport();

      spinner.text = 'Starting stdio transport...';
      await this.server.connect(transport);

      this.isRunning = true;
      cliLogger.spinnerSuccess('Stdio server initialized');

      logger.info('MCP server started in stdio mode');
    } catch (error) {
      cliLogger.spinnerFail('Failed to initialize stdio server');
      throw error;
    }
  }

  /**
   * Start server in HTTP mode
   */
  private async startHttpServer(host: string, port: number): Promise<void> {
    const spinner = cliLogger.startSpinner('Initializing HTTP server...');

    try {
      // For HTTP mode, we'll spawn a separate process
      // This could be extended to use an actual HTTP server implementation

      spinner.text = 'Creating HTTP server...';

      try {
        const { createHTTPServer } = await import('@cli/server/http-server');

        const httpServer = await createHTTPServer({
          host,
          port,
        });

        spinner.text = 'Starting HTTP server...';
        await httpServer.start();

        this.isRunning = true;
        cliLogger.spinnerSuccess(`HTTP server started on ${host}:${port}`);

        logger.info({ host, port }, 'MCP server started in HTTP mode');
      } catch (error: any) {
        if (
          error.code === 'ERR_MODULE_NOT_FOUND' ||
          (typeof error.message === 'string' &&
            error.message.includes('Cannot find module'))
        ) {
          cliLogger.error(
            'HTTP server implementation not found. Please run with --stdio or ensure the HTTP server module is available.',
          );
        }

        throw error;
      }
    } catch (error) {
      cliLogger.spinnerFail('Failed to initialize HTTP server');
      throw error;
    }
  }

  /**
   * Register server handlers
   */
  private registerHandlers(): void {
    if (!this.server) {
      throw new Error('Server not initialized');
    }

    // Tool handlers are registered through ToolRegistry
    const toolRegistry = ToolRegistry.getInstance();

    this.server.setRequestHandler('tools/list', async () => ({
      tools: toolRegistry.listTools(),
    }));

    this.server.setRequestHandler('tools/call', async (request: any) => {
      const { name, arguments: args } = request.params;
      return await toolRegistry.executeTool(name, args);
    });

    // Resource handlers are registered through ResourceRegistry
    const resourceRegistry = ResourceRegistry.getInstance();

    this.server.setRequestHandler('resources/list', async () => ({
      resources: resourceRegistry.listResources(),
    }));

    this.server.setRequestHandler('resources/read', async (request: any) => {
      const { uri } = request.params;
      return await resourceRegistry.resolveResource(uri);
    });

    // Prompt handlers are registered through PromptRegistry
    const promptRegistry = PromptRegistry.getInstance();

    this.server.setRequestHandler('prompts/list', async () => ({
      prompts: promptRegistry.listPrompts(),
    }));

    this.server.setRequestHandler('prompts/get', async (request: any) => {
      const { name, arguments: args } = request.params;
      return await promptRegistry.renderPrompt(name, args);
    });

    logger.debug('All handlers registered');
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  private setupSignalHandlers(): void {
    const shutdown = async (signal: string) => {
      cliLogger.newLine();
      cliLogger.info(`Received ${signal}, shutting down gracefully...`);

      const spinner = cliLogger.startSpinner('Stopping server...');

      try {
        await this.stop();
        cliLogger.spinnerSuccess('Server stopped');
        process.exit(0);
      } catch (error) {
        cliLogger.spinnerFail('Error during shutdown');
        cliLogger.error(error as Error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGHUP', () => shutdown('SIGHUP'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error({ error }, 'Uncaught exception');
      cliLogger.error(`Uncaught exception: ${error.message}`);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error({ reason, promise }, 'Unhandled rejection');
      cliLogger.error(`Unhandled rejection: ${reason}`);
      process.exit(1);
    });
  }

  /**
   * Keep the process alive
   */
  private async keepAlive(): Promise<void> {
    return new Promise((resolve) => {
      // Keep the process running until interrupted
      const interval = setInterval(() => {
        if (!this.isRunning) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.server) {
      try {
        await this.server.close();
        logger.info('Server closed');
      } catch (error) {
        logger.error({ error }, 'Error closing server');
      }
    }

    if (this.serverProcess) {
      this.serverProcess.kill();
      logger.info('Server process terminated');
    }
  }

  /**
   * Check if server is running
   */
  isServerRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get server status
   */
  getStatus(): {
    running: boolean;
    mode?: string;
    uptime?: number;
  } {
    return {
      running: this.isRunning,
      mode: this.server ? 'stdio' : this.serverProcess ? 'http' : undefined,
      uptime: this.isRunning ? process.uptime() : undefined,
    };
  }
}

// Export singleton instance
export const startCommand = new StartCommand();
