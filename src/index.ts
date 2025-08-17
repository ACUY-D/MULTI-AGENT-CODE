/**
 * MCP Dev Orchestrator
 * Main entry point for the MCP server
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ExecutionMode, Orchestrator, OrchestratorMode, createOrchestrator } from './core/orchestrator';
import { createPipelineManager } from './core/pipeline';
import { createStateMachine } from './core/state-machine';
import { registerOrchestratorPrompts } from './prompts/definitions/orchestrator.prompts';
import { getPromptRegistry, initializePrompts } from './prompts/registry';
import { getResourceRegistry, initializeResources } from './resources';
import { TOOL_DESCRIPTIONS, TOOL_NAMES, ensureToolsInitialized, getToolStatistics, registerTools } from './tools';
import type { Config } from './types';
import { createLogger } from './utils/logger';

const logger = createLogger('mcp-server');

/**
 * Initialize and start the MCP server
 */
async function startServer(): Promise<void> {
  logger.info('Starting MCP Dev Orchestrator server');

  // Create server instance
  const server = new Server(
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

  // Initialize tools first
  logger.info('Initializing tools...');
  await ensureToolsInitialized();

  // Initialize core components
  logger.info('Initializing core components...');
  const orchestratorConfig = {
    workDir: process.cwd(),
    mode: ExecutionMode.AUTO,
    environment: OrchestratorMode.DEVELOPMENT,
    maxRetries: 3,
    logLevel: 'info' as const,
  };

  const orchestrator = createOrchestrator(orchestratorConfig);
  await orchestrator.initialize();

  // Create state machine
  const stateMachine = createStateMachine({
    enableLogging: true,
    logLevel: 'info',
    maxRetries: 3,
  });

  // Register tools with MCP server
  logger.info('Registering tools with MCP server...');
  await registerTools(server);

  // Register resources and prompts via new registries
  logger.info('Registering resources (registry-based)...');
  await initializeResources(server);

  logger.info('Registering prompts (registry-based)...');
  // Ensure orchestrator prompts are registered before installing handlers
  registerOrchestratorPrompts(getPromptRegistry());
  await initializePrompts(server);

  // Handle completion requests
  const completionHandler = async (request: any) => {
    logger.info({ request }, 'Completion requested');

    // Provide intelligent completions based on context
    const params = (request.params as any) || {};
    const ref = params.ref as { type: string; name?: string } | undefined;

    let completions = [];

    if (ref?.type === 'tool') {
      // Suggest tool names
      completions = Object.values(TOOL_NAMES);
    } else if (ref?.type === 'resource') {
      // Suggest resource URIs from registry
      const registry = getResourceRegistry();
      completions = registry.list().map((r) => r.uri);
    } else {
      // Default completions
      completions = [
        TOOL_NAMES.ORCHESTRATOR_RUN,
        TOOL_NAMES.ARCHITECT_PLAN,
        TOOL_NAMES.DEVELOPER_IMPLEMENT,
        TOOL_NAMES.TESTER_VALIDATE,
        TOOL_NAMES.DEBUGGER_FIX,
      ];
    }

    return {
      completion: {
        values: completions,
        total: completions.length,
        hasMore: false,
      },
    };
  };

  // Type assertion to bypass strict typing temporarily
  (server as any).setRequestHandler('completion/complete', completionHandler);

  // Initialize state machine
  stateMachine.start();

  // Set up error handling
  process.on('uncaughtException', (error) => {
    logger.error({ error }, 'Uncaught exception');
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error({ reason, promise }, 'Unhandled rejection');
    process.exit(1);
  });

  // Handle shutdown gracefully
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully');
    stateMachine.stop();
    orchestrator.abort();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down gracefully');
    stateMachine.stop();
    orchestrator.abort();
    process.exit(0);
  });

  // Create transport based on environment
  const transport = new StdioServerTransport();

  // Connect server to transport
  await server.connect(transport);

  logger.info('MCP Dev Orchestrator server started successfully');
  logger.info('Available tools:', Object.values(TOOL_NAMES));

  // Log tool statistics
  const stats = getToolStatistics();
  logger.info('Tool registry statistics:', {
    totalTools: stats.totalTools,
    tools: Object.keys(stats.tools || {}),
  });

  logger.info('Waiting for client connections...');
}

/**
 * Main function
 */
async function main(): Promise<void> {
  try {
    // Load configuration
    const config = loadConfiguration();

    // Set up logging
    setupLogging(config);

    // Start the server
    await startServer();
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

/**
 * Load configuration from environment and files
 */
function loadConfiguration(): Config {
  // Load from environment variables
  const config: Config = {
    environment: (process.env.NODE_ENV as 'development' | 'staging' | 'production') || 'development',
    logLevel: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
    server: {
      host: process.env.HOST || 'localhost',
      port: Number.parseInt(process.env.PORT || '3000', 10),
    },
    orchestrator: {
      maxConcurrentTasks: Number.parseInt(process.env.MAX_CONCURRENT_TASKS || '5', 10),
      taskTimeout: Number.parseInt(process.env.TASK_TIMEOUT || '300000', 10),
      retryAttempts: Number.parseInt(process.env.RETRY_ATTEMPTS || '3', 10),
    },
    adapters: {
      github: {
        token: process.env.GITHUB_TOKEN,
        owner: process.env.GITHUB_OWNER,
        repo: process.env.GITHUB_REPO,
      },
      memory: {
        serverUrl: process.env.MEMORY_SERVER_URL,
      },
      sequential: {
        serverUrl: process.env.SEQUENTIAL_SERVER_URL,
      },
    },
  };

  return config;
}

/**
 * Set up logging configuration
 */
function setupLogging(config: Config): void {
  // Logging is already configured via environment variables in logger.ts
  logger.info(
    {
      environment: config.environment,
      logLevel: config.logLevel,
      server: config.server,
    },
    'Configuration loaded',
  );
}

// Start the server if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Failed to start:', error);
    process.exit(1);
  });
}

// Export for testing and programmatic use
export { startServer, Orchestrator, createOrchestrator, createPipelineManager, createStateMachine };

// Export tool names and descriptions for external use
export { TOOL_NAMES, TOOL_DESCRIPTIONS };
