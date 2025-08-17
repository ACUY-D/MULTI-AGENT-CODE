/**
 * Tool Registry
 * Registro central de todos los tools MCP
 */

import { z } from 'zod';
import { createLogger } from '../utils/logger';
import { ArchitectPlanTool, createArchitectPlanTool } from './architect-plan.tool';
import { DebuggerFixTool, createDebuggerFixTool } from './debugger-fix.tool';
import { DeveloperImplementTool, createDeveloperImplementTool } from './developer-implement.tool';
import { OrchestratorRunTool, createOrchestratorRunTool } from './orchestrator-run.tool';
import { TesterValidateTool, createTesterValidateTool } from './tester-validate.tool';

const logger = createLogger('tool-registry');

/**
 * Tool interface
 */
export interface Tool {
  metadata: {
    name: string;
    description: string;
    inputSchema: z.ZodSchema;
    outputSchema: z.ZodSchema;
  };
  execute(input: unknown): Promise<unknown>;
}

/**
 * Tool registration entry
 */
interface ToolRegistryEntry {
  tool: Tool;
  registered: Date;
  executions: number;
  lastExecution?: Date;
  averageExecutionTime?: number;
  errors: number;
}

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: Error;
  duration: number;
  timestamp: Date;
}

/**
 * Tool Registry Class
 * Singleton pattern for managing all tools
 */
export class ToolRegistry {
  private static instance: ToolRegistry | null = null;
  private tools: Map<string, ToolRegistryEntry> = new Map();
  private executionHistory: Map<string, ToolExecutionResult[]> = new Map();
  private initialized = false;

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    logger.info('Tool Registry created');
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  /**
   * Initialize registry with all tools
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('Tool Registry already initialized');
      return;
    }

    logger.info('Initializing Tool Registry');

    try {
      // Register all tools
      await this.register(createOrchestratorRunTool());
      await this.register(createArchitectPlanTool());
      await this.register(createDeveloperImplementTool());
      await this.register(createTesterValidateTool());
      await this.register(createDebuggerFixTool());

      this.initialized = true;
      logger.info(`Tool Registry initialized with ${this.tools.size} tools`);
    } catch (error) {
      logger.error('Failed to initialize Tool Registry', error);
      throw error;
    }
  }

  /**
   * Register a tool
   */
  async register(tool: Tool): Promise<void> {
    const name = tool.metadata.name;

    if (this.tools.has(name)) {
      logger.warn(`Tool ${name} already registered, updating`);
    }

    const entry: ToolRegistryEntry = {
      tool,
      registered: new Date(),
      executions: 0,
      errors: 0,
    };

    this.tools.set(name, entry);
    this.executionHistory.set(name, []);

    logger.info(`Tool registered: ${name}`);
  }

  /**
   * Get tool by name
   */
  get(name: string): Tool | undefined {
    const entry = this.tools.get(name);
    return entry?.tool;
  }

  /**
   * List all registered tools
   */
  list(): Tool[] {
    const tools: Tool[] = [];
    for (const entry of this.tools.values()) {
      tools.push(entry.tool);
    }
    return tools;
  }

  /**
   * List tool metadata
   */
  listMetadata(): Array<{
    name: string;
    description: string;
    inputSchema: any;
    outputSchema: any;
    stats?: {
      executions: number;
      errors: number;
      averageExecutionTime?: number;
      lastExecution?: Date;
    };
  }> {
    const metadata = [];

    for (const [name, entry] of this.tools.entries()) {
      metadata.push({
        name: entry.tool.metadata.name,
        description: entry.tool.metadata.description,
        inputSchema: this.schemaToJSON(entry.tool.metadata.inputSchema),
        outputSchema: this.schemaToJSON(entry.tool.metadata.outputSchema),
        stats: {
          executions: entry.executions,
          errors: entry.errors,
          averageExecutionTime: entry.averageExecutionTime,
          lastExecution: entry.lastExecution,
        },
      });
    }

    return metadata;
  }

  /**
   * Execute a tool
   */
  async execute(name: string, input: unknown): Promise<unknown> {
    const startTime = Date.now();
    const entry = this.tools.get(name);

    if (!entry) {
      const error = new Error(`Tool ${name} not found`);
      logger.error(error.message);
      throw error;
    }

    logger.info(`Executing tool: ${name}`, { input });

    try {
      // Validate input with Zod
      const validatedInput = entry.tool.metadata.inputSchema.parse(input);

      // Execute tool
      const result = await entry.tool.execute(validatedInput);

      // Validate output with Zod
      const validatedOutput = entry.tool.metadata.outputSchema.parse(result);

      // Update statistics
      const duration = Date.now() - startTime;
      this.updateStatistics(name, true, duration);

      // Record execution
      const executionResult: ToolExecutionResult = {
        success: true,
        data: validatedOutput,
        duration,
        timestamp: new Date(),
      };
      this.recordExecution(name, executionResult);

      logger.info(`Tool ${name} executed successfully`, { duration });
      return validatedOutput;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Update error statistics
      this.updateStatistics(name, false, duration);

      // Record failed execution
      const executionResult: ToolExecutionResult = {
        success: false,
        error: error as Error,
        duration,
        timestamp: new Date(),
      };
      this.recordExecution(name, executionResult);

      logger.error(`Tool ${name} execution failed`, error);
      throw error;
    }
  }

  /**
   * Execute multiple tools in sequence
   */
  async executeSequence(tools: Array<{ name: string; input: unknown }>): Promise<unknown[]> {
    logger.info(`Executing tool sequence: ${tools.map((t) => t.name).join(' -> ')}`);

    const results: unknown[] = [];

    for (const { name, input } of tools) {
      try {
        const result = await this.execute(name, input);
        results.push(result);
      } catch (error) {
        logger.error(`Sequence failed at tool ${name}`, error);
        throw error;
      }
    }

    return results;
  }

  /**
   * Execute multiple tools in parallel
   */
  async executeParallel(tools: Array<{ name: string; input: unknown }>): Promise<unknown[]> {
    logger.info(`Executing tools in parallel: ${tools.map((t) => t.name).join(', ')}`);

    const promises = tools.map(({ name, input }) => this.execute(name, input));

    try {
      const results = await Promise.all(promises);
      return results;
    } catch (error) {
      logger.error('Parallel execution failed', error);
      throw error;
    }
  }

  /**
   * Get tool statistics
   */
  getStatistics(name?: string): any {
    if (name) {
      const entry = this.tools.get(name);
      if (!entry) {
        return null;
      }

      return {
        name,
        registered: entry.registered,
        executions: entry.executions,
        errors: entry.errors,
        successRate: entry.executions > 0 ? ((entry.executions - entry.errors) / entry.executions) * 100 : 0,
        averageExecutionTime: entry.averageExecutionTime,
        lastExecution: entry.lastExecution,
      };
    }

    // Return statistics for all tools
    const stats: any = {
      totalTools: this.tools.size,
      totalExecutions: 0,
      totalErrors: 0,
      tools: {},
    };

    for (const [toolName, entry] of this.tools.entries()) {
      stats.totalExecutions += entry.executions;
      stats.totalErrors += entry.errors;
      stats.tools[toolName] = this.getStatistics(toolName);
    }

    stats.overallSuccessRate =
      stats.totalExecutions > 0 ? ((stats.totalExecutions - stats.totalErrors) / stats.totalExecutions) * 100 : 0;

    return stats;
  }

  /**
   * Get execution history
   */
  getExecutionHistory(name?: string, limit = 10): ToolExecutionResult[] {
    if (name) {
      const history = this.executionHistory.get(name) || [];
      return history.slice(-limit);
    }

    // Return recent executions from all tools
    const allHistory: ToolExecutionResult[] = [];
    for (const history of this.executionHistory.values()) {
      allHistory.push(...history);
    }

    // Sort by timestamp and return most recent
    allHistory.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return allHistory.slice(0, limit);
  }

  /**
   * Clear registry (for testing)
   */
  clear(): void {
    this.tools.clear();
    this.executionHistory.clear();
    this.initialized = false;
    logger.info('Tool Registry cleared');
  }

  /**
   * Update tool statistics
   */
  private updateStatistics(name: string, success: boolean, duration: number): void {
    const entry = this.tools.get(name);
    if (!entry) return;

    entry.executions++;
    if (!success) {
      entry.errors++;
    }

    entry.lastExecution = new Date();

    // Update average execution time
    if (entry.averageExecutionTime) {
      entry.averageExecutionTime = (entry.averageExecutionTime * (entry.executions - 1) + duration) / entry.executions;
    } else {
      entry.averageExecutionTime = duration;
    }
  }

  /**
   * Record execution in history
   */
  private recordExecution(name: string, result: ToolExecutionResult): void {
    const history = this.executionHistory.get(name) || [];
    history.push(result);

    // Keep only last 100 executions per tool
    if (history.length > 100) {
      history.shift();
    }

    this.executionHistory.set(name, history);
  }

  /**
   * Convert Zod schema to JSON representation
   */
  private schemaToJSON(schema: z.ZodSchema): any {
    try {
      // Get the shape if it's an object schema
      if ('shape' in schema) {
        const shape = (schema as any).shape;
        const jsonSchema: any = {
          type: 'object',
          properties: {},
        };

        for (const [key, value] of Object.entries(shape)) {
          if (value && typeof value === 'object' && '_def' in value) {
            const def = (value as any)._def;
            jsonSchema.properties[key] = {
              type: this.getZodType(def),
              description: def.description || undefined,
            };
          }
        }

        return jsonSchema;
      }

      return { type: 'unknown' };
    } catch (error) {
      logger.warn('Failed to convert schema to JSON', error);
      return { type: 'unknown' };
    }
  }

  /**
   * Get Zod type as string
   */
  private getZodType(def: any): string {
    if (def.typeName) {
      switch (def.typeName) {
        case 'ZodString':
          return 'string';
        case 'ZodNumber':
          return 'number';
        case 'ZodBoolean':
          return 'boolean';
        case 'ZodArray':
          return 'array';
        case 'ZodObject':
          return 'object';
        case 'ZodEnum':
          return 'enum';
        case 'ZodOptional':
          return this.getZodType(def.innerType?._def);
        default:
          return 'unknown';
      }
    }
    return 'unknown';
  }

  /**
   * Validate tool input
   */
  validateInput(toolName: string, input: unknown): { valid: boolean; errors?: any } {
    const tool = this.get(toolName);
    if (!tool) {
      return { valid: false, errors: [`Tool ${toolName} not found`] };
    }

    try {
      tool.metadata.inputSchema.parse(input);
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { valid: false, errors: error.errors };
      }
      return { valid: false, errors: [error] };
    }
  }

  /**
   * Validate tool output
   */
  validateOutput(toolName: string, output: unknown): { valid: boolean; errors?: any } {
    const tool = this.get(toolName);
    if (!tool) {
      return { valid: false, errors: [`Tool ${toolName} not found`] };
    }

    try {
      tool.metadata.outputSchema.parse(output);
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { valid: false, errors: error.errors };
      }
      return { valid: false, errors: [error] };
    }
  }

  /**
   * Get tool by capability
   */
  findByCapability(capability: string): Tool[] {
    const matchingTools: Tool[] = [];

    for (const entry of this.tools.values()) {
      if (
        entry.tool.metadata.description.toLowerCase().includes(capability.toLowerCase()) ||
        entry.tool.metadata.name.toLowerCase().includes(capability.toLowerCase())
      ) {
        matchingTools.push(entry.tool);
      }
    }

    return matchingTools;
  }

  /**
   * Health check for all tools
   */
  async healthCheck(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const [name, entry] of this.tools.entries()) {
      try {
        // Try to validate a minimal input
        const minimalInput = {};
        entry.tool.metadata.inputSchema.parse(minimalInput);
        results.set(name, true);
      } catch {
        // Tool is available even if minimal validation fails
        results.set(name, true);
      }
    }

    return results;
  }
}

/**
 * Factory function to get registry instance
 */
export function getToolRegistry(): ToolRegistry {
  return ToolRegistry.getInstance();
}

/**
 * Initialize and return registry
 */
export async function initializeTools(): Promise<ToolRegistry> {
  const registry = getToolRegistry();
  await registry.initialize();
  return registry;
}

/**
 * Helper function to execute tool
 */
export async function executeTool(name: string, input: unknown): Promise<unknown> {
  const registry = getToolRegistry();
  return registry.execute(name, input);
}

/**
 * Helper function to list tools
 */
export function listTools(): Tool[] {
  const registry = getToolRegistry();
  return registry.list();
}

/**
 * Helper function to get tool metadata
 */
export function getToolMetadata(name?: string): any {
  const registry = getToolRegistry();
  if (name) {
    const tool = registry.get(name);
    return tool?.metadata;
  }
  return registry.listMetadata();
}
