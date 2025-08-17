/**
 * MCP Tools definitions
 * Exposes tools available to MCP clients with complete integration
 */

import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { Tool as MCPTool } from '@modelcontextprotocol/sdk/types.js';
import { createLogger } from '../utils/logger';
import { executeTool as executeRegistryTool, getToolRegistry, initializeTools } from './registry';

const logger = createLogger('mcp-tools');

/**
 * Register tools with MCP server
 */
export async function registerTools(server: Server): Promise<void> {
  logger.info('Registering MCP tools with server');

  try {
    // Initialize tool registry
    await initializeTools();

    // Set up handlers
    server.setRequestHandler('tools/list' as any, handleListTools);
    server.setRequestHandler('tools/call' as any, handleCallTool);

    logger.info('MCP tools registered successfully');
  } catch (error) {
    logger.error('Failed to register MCP tools', error);
    throw error;
  }
}

/**
 * Handle list tools request
 */
async function handleListTools(): Promise<{ tools: MCPTool[] }> {
  logger.debug('Handling tools/list request');

  try {
    const registry = getToolRegistry();
    const metadata = registry.listMetadata();

    const tools: MCPTool[] = metadata.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: convertZodToMCPSchema(tool.inputSchema),
    }));

    logger.info(`Returning ${tools.length} tools`);
    return { tools };
  } catch (error) {
    logger.error('Failed to list tools', error);
    throw error;
  }
}

/**
 * Handle call tool request
 */
async function handleCallTool(request: any): Promise<any> {
  const { name, arguments: args } = request.params as {
    name: string;
    arguments?: unknown;
  };

  logger.info({ tool: name, args }, 'Tool call requested');

  try {
    const result = await executeRegistryTool(name, args);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    logger.error({ error, tool: name }, 'Tool execution failed');

    // Return error in MCP format
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: true,
              message: (error as Error).message,
              tool: name,
            },
            null,
            2,
          ),
        },
      ],
    };
  }
}

/**
 * Convert Zod schema to MCP-compatible JSON schema
 */
function convertZodToMCPSchema(zodSchema: any): any {
  if (!zodSchema || typeof zodSchema !== 'object') {
    return {
      type: 'object',
      properties: {},
      additionalProperties: true,
    };
  }

  // If it's already in JSON schema format
  if (zodSchema.type && zodSchema.properties) {
    return zodSchema;
  }

  // Basic conversion for common cases
  const mcpSchema: any = {
    type: 'object',
    properties: {},
    required: [],
  };

  // Try to extract properties
  if (zodSchema.properties) {
    for (const [key, value] of Object.entries(zodSchema.properties)) {
      if (value && typeof value === 'object') {
        const propSchema = value as any;
        mcpSchema.properties[key] = {
          type: propSchema.type || 'string',
          description: propSchema.description,
        };

        // Add enum values if present
        if (propSchema.enum) {
          mcpSchema.properties[key].enum = propSchema.enum;
        }

        // Add default if present
        if (propSchema.default !== undefined) {
          mcpSchema.properties[key].default = propSchema.default;
        }
      }
    }
  }

  return mcpSchema;
}

/**
 * Get all available tools
 */
export function tools(): MCPTool[] {
  const registry = getToolRegistry();
  const metadata = registry.listMetadata();

  return metadata.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: convertZodToMCPSchema(tool.inputSchema),
  }));
}

/**
 * Get tool by name
 */
export function getTool(name: string): MCPTool | undefined {
  const registry = getToolRegistry();
  const tool = registry.get(name);

  if (!tool) {
    return undefined;
  }

  return {
    name: tool.metadata.name,
    description: tool.metadata.description,
    inputSchema: convertZodToMCPSchema(tool.metadata.inputSchema),
  };
}

/**
 * Execute a tool by name
 */
export async function executeTool(name: string, input: unknown): Promise<unknown> {
  logger.info({ tool: name, input }, 'Executing tool');

  try {
    const result = await executeRegistryTool(name, input);
    logger.info({ tool: name }, 'Tool executed successfully');
    return result;
  } catch (error) {
    logger.error({ tool: name, error }, 'Tool execution failed');
    throw error;
  }
}

/**
 * Validate tool input
 */
export function validateToolInput(name: string, input: unknown): { valid: boolean; errors?: any } {
  const registry = getToolRegistry();
  return registry.validateInput(name, input);
}

/**
 * Get tool statistics
 */
export function getToolStatistics(name?: string): any {
  const registry = getToolRegistry();
  return registry.getStatistics(name);
}

/**
 * Get tool execution history
 */
export function getToolHistory(name?: string, limit = 10): any[] {
  const registry = getToolRegistry();
  return registry.getExecutionHistory(name, limit);
}

/**
 * Tool health check
 */
export async function toolHealthCheck(): Promise<Map<string, boolean>> {
  const registry = getToolRegistry();
  return registry.healthCheck();
}

/**
 * Export tool names for convenience
 */
export const TOOL_NAMES = {
  ORCHESTRATOR_RUN: 'orchestrator.run',
  ARCHITECT_PLAN: 'architect.plan',
  DEVELOPER_IMPLEMENT: 'developer.implement',
  TESTER_VALIDATE: 'tester.validate',
  DEBUGGER_FIX: 'debugger.fix',
} as const;

/**
 * Export tool descriptions
 */
export const TOOL_DESCRIPTIONS = {
  [TOOL_NAMES.ORCHESTRATOR_RUN]: 'Ejecuta un pipeline BMAD completo para desarrollo de software',
  [TOOL_NAMES.ARCHITECT_PLAN]: 'Genera planificación completa y arquitectura para un proyecto de software',
  [TOOL_NAMES.DEVELOPER_IMPLEMENT]: 'Implementa código y features basado en tareas especificadas',
  [TOOL_NAMES.TESTER_VALIDATE]: 'Ejecuta validación completa y testing de aplicaciones',
  [TOOL_NAMES.DEBUGGER_FIX]: 'Diagnostica y corrige errores automáticamente',
} as const;

/**
 * Helper function to execute orchestrator pipeline
 */
export async function runOrchestratorPipeline(objective: string, options?: any): Promise<any> {
  return executeTool(TOOL_NAMES.ORCHESTRATOR_RUN, {
    objective,
    ...options,
  });
}

/**
 * Helper function to create architecture plan
 */
export async function createArchitecturePlan(objective: string, constraints?: string[]): Promise<any> {
  return executeTool(TOOL_NAMES.ARCHITECT_PLAN, {
    objective,
    constraints,
  });
}

/**
 * Helper function to implement features
 */
export async function implementFeatures(taskIds: string[], options?: any): Promise<any> {
  return executeTool(TOOL_NAMES.DEVELOPER_IMPLEMENT, {
    taskIds,
    ...options,
  });
}

/**
 * Helper function to validate application
 */
export async function validateApplication(suites?: string[], options?: any): Promise<any> {
  return executeTool(TOOL_NAMES.TESTER_VALIDATE, {
    suites: suites || ['unit'],
    ...options,
  });
}

/**
 * Helper function to debug and fix errors
 */
export async function debugAndFix(failureRef: string, options?: any): Promise<any> {
  return executeTool(TOOL_NAMES.DEBUGGER_FIX, {
    failureRef,
    ...options,
  });
}

/**
 * Execute tools in sequence
 */
export async function executeToolSequence(sequence: Array<{ name: string; input: unknown }>): Promise<unknown[]> {
  logger.info(`Executing tool sequence: ${sequence.map((s) => s.name).join(' -> ')}`);

  const registry = getToolRegistry();
  return registry.executeSequence(sequence);
}

/**
 * Execute tools in parallel
 */
export async function executeToolsParallel(tools: Array<{ name: string; input: unknown }>): Promise<unknown[]> {
  logger.info(`Executing tools in parallel: ${tools.map((t) => t.name).join(', ')}`);

  const registry = getToolRegistry();
  return registry.executeParallel(tools);
}

/**
 * Find tools by capability
 */
export function findToolsByCapability(capability: string): MCPTool[] {
  const registry = getToolRegistry();
  const tools = registry.findByCapability(capability);

  return tools.map((tool) => ({
    name: tool.metadata.name,
    description: tool.metadata.description,
    inputSchema: convertZodToMCPSchema(tool.metadata.inputSchema),
  }));
}

/**
 * Initialize all tools on module load
 */
let initialized = false;

export async function ensureToolsInitialized(): Promise<void> {
  if (!initialized) {
    await initializeTools();
    initialized = true;
    logger.info('Tools initialized successfully');
  }
}

// Auto-initialize when module is imported
ensureToolsInitialized().catch((error) => {
  logger.error('Failed to auto-initialize tools', error);
});

/**
 * Export types for external use
 */
export type { Tool, ToolExecutionResult } from './registry';
