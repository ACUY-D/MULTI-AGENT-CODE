/**
 * Sequential Thinking Adapter
 * Provides integration with Sequential Thinking MCP server for chain-of-thought reasoning
 * and advanced planning with DAG (Directed Acyclic Graph) support
 * Extends BaseProvider for retry logic, circuit breaker, and health checks
 */

import * as crypto from 'crypto';
import { Client } from '@modelcontextprotocol/sdk/client';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { z } from 'zod';
import { BaseProvider, type ProviderConfig, ProviderError } from '../core/providers/base.provider';
import { createLogger } from '../utils/logger';

const logger = createLogger('sequential-adapter');

// Configuration schema
export const SequentialConfigSchema = z.object({
  serverUrl: z.string().optional(),
  maxThoughts: z.number().optional().default(20),
  enableBranching: z.boolean().optional().default(true),
  enableRevisions: z.boolean().optional().default(true),
  defaultTimeout: z.number().optional().default(60000), // 1 minute
  parallelExecution: z.boolean().optional().default(true),
});

export type SequentialConfig = z.infer<typeof SequentialConfigSchema>;

// Constraint interface
export interface Constraint {
  type: 'time' | 'resource' | 'dependency' | 'custom';
  description: string;
  value?: any;
  validator?: (context: any) => boolean;
}

// Step interface
export interface Step {
  id: string;
  name: string;
  description: string;
  type: 'sequential' | 'parallel' | 'conditional';
  dependencies: string[];
  preconditions?: string[];
  postconditions?: string[];
  estimatedDuration?: number;
  actualDuration?: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  result?: any;
  error?: Error;
  metadata?: Record<string, any>;
}

// Plan interface
export interface Plan {
  id: string;
  name: string;
  objective: string;
  constraints: Constraint[];
  steps: Step[];
  dependencies: Map<string, Set<string>>;
  status: 'draft' | 'validated' | 'executing' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  executionStartTime?: Date;
  executionEndTime?: Date;
  metadata?: Record<string, any>;
}

// DAG (Directed Acyclic Graph) interface
export interface DAG {
  nodes: Map<string, Step>;
  edges: Map<string, Set<string>>;
  topologicalOrder?: string[];
  isAcyclic: boolean;
}

// Cycle interface
export interface Cycle {
  nodes: string[];
  edges: Array<{ from: string; to: string }>;
}

// Path interface for critical path
export interface Path {
  nodes: string[];
  totalDuration: number;
  criticalSteps: string[];
}

// Execution options
export interface ExecutionOptions {
  parallel?: boolean;
  continueOnError?: boolean;
  timeout?: number;
  maxRetries?: number;
  dryRun?: boolean;
}

// Execution result
export interface ExecutionResult {
  planId: string;
  success: boolean;
  completedSteps: string[];
  failedSteps: string[];
  skippedSteps: string[];
  duration: number;
  results: Map<string, any>;
  errors: Map<string, Error>;
}

// Validation result
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

// Reasoning session for chain-of-thought
export interface ReasoningSession {
  id: string;
  prompt: string;
  thoughts: Thought[];
  status: 'active' | 'completed' | 'failed';
  conclusion?: Conclusion;
  createdAt: Date;
  updatedAt: Date;
}

// Thought interface
export interface Thought {
  id: string;
  thought: string;
  thoughtNumber: number;
  totalThoughts: number;
  nextThoughtNeeded: boolean;
  isRevision?: boolean;
  revisesThought?: number;
  branchFromThought?: number;
  branchId?: string;
  needsMoreThoughts?: boolean;
  timestamp: Date;
}

// Conclusion interface
export interface Conclusion {
  answer: string;
  confidence: number;
  reasoning: string[];
  alternatives?: string[];
}

// Sequential Adapter class
export class SequentialAdapter extends BaseProvider {
  private client: Client | null = null;
  private sequentialConfig: SequentialConfig | null = null;
  private mcpTransport: StdioClientTransport | null = null;

  // Plans storage
  private plans: Map<string, Plan> = new Map();
  private activePlan: Plan | null = null;

  // Reasoning sessions
  private reasoningSessions: Map<string, ReasoningSession> = new Map();
  private activeSession: ReasoningSession | null = null;

  // Execution context
  private executionContext: Map<string, any> = new Map();

  constructor(config?: Partial<ProviderConfig>) {
    super({
      name: 'sequential',
      timeout: 60000,
      maxRetries: 3,
      retryDelay: 1000,
      ...config,
    });

    logger.info('Sequential adapter initialized with BaseProvider');
  }

  /**
   * Connect to Sequential Thinking MCP server
   */
  async connect(): Promise<void> {
    try {
      this.logger.info('Connecting to Sequential Thinking MCP server');

      // Initialize MCP client
      this.mcpTransport = new StdioClientTransport({
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
      });

      this.client = new Client(
        {
          name: 'sequential-adapter',
          version: '1.0.0',
        },
        {
          capabilities: {},
        },
      );

      await this.client.connect(this.mcpTransport);
      this.connected = true;

      this.logger.info('Successfully connected to Sequential Thinking MCP server');
    } catch (error) {
      this.connected = false;
      throw new ProviderError(
        `Failed to connect to Sequential Thinking: ${(error as Error).message}`,
        'sequential',
        'connect',
        true,
      );
    }
  }

  /**
   * Disconnect from Sequential Thinking MCP server
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }

    if (this.mcpTransport) {
      await this.mcpTransport.close();
      this.mcpTransport = null;
    }

    this.connected = false;
    this.logger.info('Disconnected from Sequential Thinking MCP server');
  }

  /**
   * Check if the provider is healthy
   */
  async isHealthy(): Promise<boolean> {
    if (!this.connected || !this.client) {
      return false;
    }

    try {
      // Try to list available tools as a health check
      const result = await this.client.listTools();
      return result.tools.length > 0;
    } catch (error) {
      this.logger.error('Health check failed', error);
      return false;
    }
  }

  /**
   * Initialize with configuration
   */
  async initialize(config: unknown): Promise<void> {
    this.sequentialConfig = SequentialConfigSchema.parse(config);
    await this.connect();
  }

  /**
   * Create a new plan
   */
  async createPlan(objective: string, constraints?: Constraint[]): Promise<Plan> {
    return this.executeWithRetry(async () => {
      const planId = this.generateId('plan');

      const plan: Plan = {
        id: planId,
        name: `Plan for: ${objective.substring(0, 50)}`,
        objective,
        constraints: constraints || [],
        steps: [],
        dependencies: new Map(),
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.plans.set(planId, plan);
      this.activePlan = plan;

      this.logger.info(`Created plan ${planId} for objective: ${objective}`);

      return plan;
    }, 'createPlan');
  }

  /**
   * Add a step to the plan
   */
  async addStep(planId: string, step: Omit<Step, 'id' | 'status'>): Promise<void> {
    return this.executeWithRetry(async () => {
      const plan = this.plans.get(planId);

      if (!plan) {
        throw new Error(`Plan ${planId} not found`);
      }

      const stepId = this.generateId('step');
      const fullStep: Step = {
        ...step,
        id: stepId,
        status: 'pending',
      };

      plan.steps.push(fullStep);

      // Update dependencies
      for (const dep of step.dependencies) {
        if (!plan.dependencies.has(dep)) {
          plan.dependencies.set(dep, new Set());
        }
        plan.dependencies.get(dep)!.add(stepId);
      }

      plan.updatedAt = new Date();

      this.logger.info(`Added step ${stepId} to plan ${planId}`);
    }, 'addStep');
  }

  /**
   * Update a step in the plan
   */
  async updateStep(planId: string, stepId: string, updates: Partial<Step>): Promise<void> {
    return this.executeWithRetry(async () => {
      const plan = this.plans.get(planId);

      if (!plan) {
        throw new Error(`Plan ${planId} not found`);
      }

      const stepIndex = plan.steps.findIndex((s) => s.id === stepId);

      if (stepIndex === -1) {
        throw new Error(`Step ${stepId} not found in plan ${planId}`);
      }

      plan.steps[stepIndex] = {
        ...plan.steps[stepIndex],
        ...updates,
      };

      plan.updatedAt = new Date();

      this.logger.info(`Updated step ${stepId} in plan ${planId}`);
    }, 'updateStep');
  }

  /**
   * Execute a plan
   */
  async executePlan(planId: string, options?: ExecutionOptions): Promise<ExecutionResult> {
    return this.executeWithRetry(async () => {
      const plan = this.plans.get(planId);

      if (!plan) {
        throw new Error(`Plan ${planId} not found`);
      }

      // Validate plan first
      const validation = await this.validatePlan(plan);
      if (!validation.valid) {
        throw new Error(`Plan validation failed: ${validation.errors.join(', ')}`);
      }

      const opts = {
        parallel: this.sequentialConfig?.parallelExecution ?? true,
        continueOnError: false,
        timeout: this.sequentialConfig?.defaultTimeout ?? 60000,
        maxRetries: 3,
        dryRun: false,
        ...options,
      };

      this.logger.info(`Executing plan ${planId} with options:`, opts);

      plan.status = 'executing';
      plan.executionStartTime = new Date();

      const result: ExecutionResult = {
        planId,
        success: true,
        completedSteps: [],
        failedSteps: [],
        skippedSteps: [],
        duration: 0,
        results: new Map(),
        errors: new Map(),
      };

      try {
        if (opts.parallel) {
          await this.executeParallel(plan, opts, result);
        } else {
          await this.executeSequential(plan, opts, result);
        }
      } catch (error) {
        result.success = false;
        this.logger.error(`Plan execution failed: ${error}`);
      }

      plan.executionEndTime = new Date();
      plan.status = result.success ? 'completed' : 'failed';
      result.duration = plan.executionEndTime.getTime() - plan.executionStartTime.getTime();

      this.logger.info(`Plan ${planId} execution completed in ${result.duration}ms`);

      return result;
    }, 'executePlan');
  }

  /**
   * Validate a plan
   */
  async validatePlan(plan: Plan): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: [],
    };

    // Check for empty plan
    if (plan.steps.length === 0) {
      result.errors.push('Plan has no steps');
      result.valid = false;
    }

    // Build and check DAG
    const dag = await this.buildDependencyGraph(plan.steps);

    // Check for cycles
    const cycles = await this.detectCycles(dag);
    if (cycles.length > 0) {
      result.errors.push(`Plan contains cycles: ${cycles.map((c) => c.nodes.join(' -> ')).join(', ')}`);
      result.valid = false;
    }

    // Check for unreachable steps
    const reachable = this.findReachableSteps(dag);
    const unreachable = plan.steps.filter((s) => !reachable.has(s.id));
    if (unreachable.length > 0) {
      result.warnings.push(`Unreachable steps: ${unreachable.map((s) => s.name).join(', ')}`);
    }

    // Check for missing dependencies
    for (const step of plan.steps) {
      for (const dep of step.dependencies) {
        if (!plan.steps.find((s) => s.id === dep)) {
          result.errors.push(`Step ${step.name} has missing dependency: ${dep}`);
          result.valid = false;
        }
      }
    }

    // Check constraints
    for (const constraint of plan.constraints) {
      if (constraint.validator) {
        const isValid = constraint.validator(plan);
        if (!isValid) {
          result.errors.push(`Constraint violation: ${constraint.description}`);
          result.valid = false;
        }
      }
    }

    // Add suggestions
    if (plan.steps.length > 10 && !this.hasParallelSteps(plan)) {
      result.suggestions.push('Consider parallelizing independent steps to improve execution time');
    }

    return result;
  }

  /**
   * Build a dependency graph from steps
   */
  async buildDependencyGraph(steps: Step[]): Promise<DAG> {
    const dag: DAG = {
      nodes: new Map(),
      edges: new Map(),
      isAcyclic: true,
    };

    // Add nodes
    for (const step of steps) {
      dag.nodes.set(step.id, step);
      dag.edges.set(step.id, new Set());
    }

    // Add edges based on dependencies
    for (const step of steps) {
      for (const dep of step.dependencies) {
        if (dag.edges.has(dep)) {
          dag.edges.get(dep)!.add(step.id);
        }
      }
    }

    // Check if acyclic
    const cycles = await this.detectCycles(dag);
    dag.isAcyclic = cycles.length === 0;

    // Calculate topological order if acyclic
    if (dag.isAcyclic) {
      dag.topologicalOrder = await this.topologicalSort(dag);
    }

    return dag;
  }

  /**
   * Detect cycles in a DAG
   */
  async detectCycles(graph: DAG): Promise<Cycle[]> {
    const cycles: Cycle[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const edges = graph.edges.get(nodeId);
      if (edges) {
        for (const neighbor of edges) {
          if (!visited.has(neighbor)) {
            if (dfs(neighbor)) {
              return true;
            }
          } else if (recursionStack.has(neighbor)) {
            // Found a cycle
            const cycleStart = path.indexOf(neighbor);
            const cycleNodes = path.slice(cycleStart);
            cycleNodes.push(neighbor);

            const cycleEdges: Array<{ from: string; to: string }> = [];
            for (let i = 0; i < cycleNodes.length - 1; i++) {
              cycleEdges.push({ from: cycleNodes[i], to: cycleNodes[i + 1] });
            }

            cycles.push({ nodes: cycleNodes, edges: cycleEdges });
            return true;
          }
        }
      }

      path.pop();
      recursionStack.delete(nodeId);
      return false;
    };

    for (const nodeId of graph.nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId);
      }
    }

    return cycles;
  }

  /**
   * Perform topological sort on a DAG
   */
  async topologicalSort(graph: DAG): Promise<string[]> {
    const inDegree = new Map<string, number>();
    const queue: string[] = [];
    const result: string[] = [];

    // Initialize in-degrees
    for (const nodeId of graph.nodes.keys()) {
      inDegree.set(nodeId, 0);
    }

    // Calculate in-degrees
    for (const edges of graph.edges.values()) {
      for (const to of edges) {
        inDegree.set(to, (inDegree.get(to) || 0) + 1);
      }
    }

    // Find nodes with no incoming edges
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    // Process queue
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      result.push(nodeId);

      const edges = graph.edges.get(nodeId);
      if (edges) {
        for (const neighbor of edges) {
          const newDegree = (inDegree.get(neighbor) || 0) - 1;
          inDegree.set(neighbor, newDegree);

          if (newDegree === 0) {
            queue.push(neighbor);
          }
        }
      }
    }

    // Check if all nodes were processed
    if (result.length !== graph.nodes.size) {
      throw new Error('Graph contains cycles, cannot perform topological sort');
    }

    return result;
  }

  /**
   * Find the critical path in a plan
   */
  async findCriticalPath(graph: DAG): Promise<Path> {
    const distances = new Map<string, number>();
    const predecessors = new Map<string, string | null>();

    // Initialize distances
    for (const nodeId of graph.nodes.keys()) {
      distances.set(nodeId, 0);
      predecessors.set(nodeId, null);
    }

    // Get topological order
    const order = graph.topologicalOrder || (await this.topologicalSort(graph));

    // Calculate longest paths
    for (const nodeId of order) {
      const node = graph.nodes.get(nodeId)!;
      const nodeDuration = node.estimatedDuration || 0;

      const edges = graph.edges.get(nodeId);
      if (edges) {
        for (const successor of edges) {
          const currentDistance = distances.get(nodeId)! + nodeDuration;
          if (currentDistance > distances.get(successor)!) {
            distances.set(successor, currentDistance);
            predecessors.set(successor, nodeId);
          }
        }
      }
    }

    // Find the end node with maximum distance
    let maxDistance = 0;
    let endNode: string | null = null;

    for (const [nodeId, distance] of distances) {
      const node = graph.nodes.get(nodeId)!;
      const totalDistance = distance + (node.estimatedDuration || 0);

      if (totalDistance > maxDistance) {
        maxDistance = totalDistance;
        endNode = nodeId;
      }
    }

    // Build critical path
    const criticalPath: string[] = [];
    let current = endNode;

    while (current !== null) {
      criticalPath.unshift(current);
      current = predecessors.get(current) || null;
    }

    return {
      nodes: criticalPath,
      totalDuration: maxDistance,
      criticalSteps: criticalPath,
    };
  }

  /**
   * Start a reasoning session for chain-of-thought
   */
  async startReasoning(prompt: string): Promise<ReasoningSession> {
    return this.executeWithRetry(async () => {
      const sessionId = this.generateId('session');

      const session: ReasoningSession = {
        id: sessionId,
        prompt,
        thoughts: [],
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.reasoningSessions.set(sessionId, session);
      this.activeSession = session;

      this.logger.info(`Started reasoning session ${sessionId}`);

      // Start with first thought if MCP is connected
      if (this.client && this.connected) {
        await this.addThought(sessionId, prompt);
      }

      return session;
    }, 'startReasoning');
  }

  /**
   * Add a thought to the reasoning session
   */
  async addThought(sessionId: string, thoughtContent: string): Promise<void> {
    return this.executeWithRetry(async () => {
      const session = this.reasoningSessions.get(sessionId);

      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      const thoughtNumber = session.thoughts.length + 1;
      const thoughtId = this.generateId('thought');

      // Use MCP if connected
      let thought: Thought;

      if (this.client && this.connected) {
        const result = await this.client.callTool('sequentialthinking', {
          thought: thoughtContent,
          thoughtNumber,
          totalThoughts: this.sequentialConfig?.maxThoughts || 20,
          nextThoughtNeeded: true,
        });

        thought = {
          id: thoughtId,
          thought: result.content.thought || thoughtContent,
          thoughtNumber: result.content.thoughtNumber || thoughtNumber,
          totalThoughts: result.content.totalThoughts || 20,
          nextThoughtNeeded: result.content.nextThoughtNeeded || false,
          isRevision: result.content.isRevision,
          revisesThought: result.content.revisesThought,
          branchFromThought: result.content.branchFromThought,
          branchId: result.content.branchId,
          needsMoreThoughts: result.content.needsMoreThoughts,
          timestamp: new Date(),
        };
      } else {
        // Fallback to local reasoning
        thought = {
          id: thoughtId,
          thought: thoughtContent,
          thoughtNumber,
          totalThoughts: this.sequentialConfig?.maxThoughts || 20,
          nextThoughtNeeded: thoughtNumber < (this.sequentialConfig?.maxThoughts || 20),
          timestamp: new Date(),
        };
      }

      session.thoughts.push(thought);
      session.updatedAt = new Date();

      this.logger.info(`Added thought ${thoughtNumber} to session ${sessionId}`);
    }, 'addThought');
  }

  /**
   * Conclude a reasoning session
   */
  async concludeReasoning(sessionId: string): Promise<Conclusion> {
    return this.executeWithRetry(async () => {
      const session = this.reasoningSessions.get(sessionId);

      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      // Analyze thoughts to form conclusion
      const reasoning = session.thoughts.map((t) => t.thought);
      const lastThought = session.thoughts[session.thoughts.length - 1];

      const conclusion: Conclusion = {
        answer: lastThought?.thought || 'No conclusion reached',
        confidence: this.calculateConfidence(session.thoughts),
        reasoning,
        alternatives: this.extractAlternatives(session.thoughts),
      };

      session.conclusion = conclusion;
      session.status = 'completed';
      session.updatedAt = new Date();

      this.logger.info(`Concluded reasoning session ${sessionId}`);

      return conclusion;
    }, 'concludeReasoning');
  }

  /**
   * Export a plan in different formats
   */
  async exportPlan(planId: string, format: 'json' | 'yaml' | 'mermaid'): Promise<string> {
    return this.executeWithRetry(async () => {
      const plan = this.plans.get(planId);

      if (!plan) {
        throw new Error(`Plan ${planId} not found`);
      }

      switch (format) {
        case 'json':
          return this.exportAsJSON(plan);
        case 'yaml':
          return this.exportAsYAML(plan);
        case 'mermaid':
          return this.exportAsMermaid(plan);
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
    }, 'exportPlan');
  }

  /**
   * Import a plan from data
   */
  async importPlan(data: string, format: 'json' | 'yaml'): Promise<Plan> {
    return this.executeWithRetry(async () => {
      let plan: Plan;

      switch (format) {
        case 'json':
          plan = this.importFromJSON(data);
          break;
        case 'yaml':
          plan = this.importFromYAML(data);
          break;
        default:
          throw new Error(`Unsupported import format: ${format}`);
      }

      this.plans.set(plan.id, plan);

      this.logger.info(`Imported plan ${plan.id}`);

      return plan;
    }, 'importPlan');
  }

  // === Private helper methods ===

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Execute plan sequentially
   */
  private async executeSequential(plan: Plan, options: ExecutionOptions, result: ExecutionResult): Promise<void> {
    const dag = await this.buildDependencyGraph(plan.steps);
    const order = dag.topologicalOrder!;

    for (const stepId of order) {
      const step = plan.steps.find((s) => s.id === stepId)!;

      try {
        await this.executeStep(step, options, result);
        result.completedSteps.push(stepId);
      } catch (error) {
        result.failedSteps.push(stepId);
        result.errors.set(stepId, error as Error);

        if (!options.continueOnError) {
          throw error;
        }
      }
    }
  }

  /**
   * Execute plan in parallel
   */
  private async executeParallel(plan: Plan, options: ExecutionOptions, result: ExecutionResult): Promise<void> {
    const dag = await this.buildDependencyGraph(plan.steps);
    const completed = new Set<string>();
    const executing = new Set<string>();

    while (completed.size < plan.steps.length) {
      // Find steps that can be executed
      const ready = plan.steps.filter(
        (step) =>
          !completed.has(step.id) && !executing.has(step.id) && step.dependencies.every((dep) => completed.has(dep)),
      );

      if (ready.length === 0 && executing.size === 0) {
        // No progress possible
        break;
      }

      // Execute ready steps in parallel
      const promises = ready.map(async (step) => {
        executing.add(step.id);

        try {
          await this.executeStep(step, options, result);
          result.completedSteps.push(step.id);
          completed.add(step.id);
        } catch (error) {
          result.failedSteps.push(step.id);
          result.errors.set(step.id, error as Error);
          completed.add(step.id); // Mark as completed even if failed

          if (!options.continueOnError) {
            throw error;
          }
        } finally {
          executing.delete(step.id);
        }
      });

      await Promise.all(promises);
    }
  }

  /**
   * Execute a single step
   */
  private async executeStep(step: Step, options: ExecutionOptions, result: ExecutionResult): Promise<void> {
    if (options.dryRun) {
      this.logger.info(`[DRY RUN] Would execute step: ${step.name}`);
      return;
    }

    this.logger.info(`Executing step: ${step.name}`);

    step.status = 'in_progress';
    const startTime = Date.now();

    try {
      // Check preconditions
      if (step.preconditions) {
        for (const condition of step.preconditions) {
          if (!this.evaluateCondition(condition)) {
            throw new Error(`Precondition failed: ${condition}`);
          }
        }
      }

      // Execute step logic (placeholder - would be customized per step type)
      await this.sleep(step.estimatedDuration || 100);

      // Check postconditions
      if (step.postconditions) {
        for (const condition of step.postconditions) {
          if (!this.evaluateCondition(condition)) {
            throw new Error(`Postcondition failed: ${condition}`);
          }
        }
      }

      step.status = 'completed';
      step.actualDuration = Date.now() - startTime;
      step.result = { success: true };

      result.results.set(step.id, step.result);
    } catch (error) {
      step.status = 'failed';
      step.actualDuration = Date.now() - startTime;
      step.error = error as Error;
      throw error;
    }
  }

  /**
   * Evaluate a condition
   */
  private evaluateCondition(condition: string): boolean {
    // Simple evaluation - in production would use a proper expression evaluator
    if (condition === 'true') return true;
    if (condition === 'false') return false;

    // Check if condition references context
    if (condition.startsWith('context.')) {
      const key = condition.substring(8);
      return !!this.executionContext.get(key);
    }

    // Default to true for now
    return true;
  }

  /**
   * Find reachable steps in DAG
   */
  private findReachableSteps(dag: DAG): Set<string> {
    const reachable = new Set<string>();
    const visited = new Set<string>();

    // Find starting nodes (no dependencies)
    const startNodes = Array.from(dag.nodes.keys()).filter((nodeId) => {
      const node = dag.nodes.get(nodeId)!;
      return node.dependencies.length === 0;
    });

    // DFS from each start node
    const dfs = (nodeId: string) => {
      if (visited.has(nodeId)) return;

      visited.add(nodeId);
      reachable.add(nodeId);

      const edges = dag.edges.get(nodeId);
      if (edges) {
        for (const neighbor of edges) {
          dfs(neighbor);
        }
      }
    };

    for (const startNode of startNodes) {
      dfs(startNode);
    }

    return reachable;
  }

  /**
   * Check if plan has parallel steps
   */
  private hasParallelSteps(plan: Plan): boolean {
    // Check if any steps can be executed in parallel
    const dependencyCount = new Map<string, number>();

    for (const step of plan.steps) {
      dependencyCount.set(step.id, step.dependencies.length);
    }

    // If multiple steps have the same dependency count, they might be parallel
    const counts = Array.from(dependencyCount.values());
    const uniqueCounts = new Set(counts);

    return uniqueCounts.size < counts.length;
  }

  /**
   * Calculate confidence score for reasoning
   */
  private calculateConfidence(thoughts: Thought[]): number {
    if (thoughts.length === 0) return 0;

    let confidence = 0.5; // Base confidence

    // Increase confidence with more thoughts
    confidence += Math.min(thoughts.length * 0.05, 0.3);

    // Decrease confidence if there are many revisions
    const revisions = thoughts.filter((t) => t.isRevision).length;
    confidence -= revisions * 0.1;

    // Increase confidence if thoughts converge
    const lastThoughts = thoughts.slice(-3);
    if (lastThoughts.length >= 3) {
      const similarity = this.calculateThoughtSimilarity(lastThoughts);
      confidence += similarity * 0.2;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Calculate similarity between thoughts
   */
  private calculateThoughtSimilarity(thoughts: Thought[]): number {
    // Simple similarity based on common words
    const wordSets = thoughts.map((t) => new Set(t.thought.toLowerCase().split(/\s+/)));

    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < wordSets.length - 1; i++) {
      for (let j = i + 1; j < wordSets.length; j++) {
        const set1 = wordSets[i];
        const set2 = wordSets[j];

        const intersection = new Set([...set1].filter((x) => set2.has(x)));
        const union = new Set([...set1, ...set2]);

        const jaccard = intersection.size / union.size;
        totalSimilarity += jaccard;
        comparisons++;
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  /**
   * Extract alternative conclusions from thoughts
   */
  private extractAlternatives(thoughts: Thought[]): string[] {
    const alternatives: string[] = [];

    // Look for branching thoughts
    const branches = thoughts.filter((t) => t.branchFromThought !== undefined);

    for (const branch of branches) {
      if (
        branch.thought.toLowerCase().includes('alternatively') ||
        branch.thought.toLowerCase().includes('another approach') ||
        branch.thought.toLowerCase().includes('or we could')
      ) {
        alternatives.push(branch.thought);
      }
    }

    // Look for revised thoughts
    const revisions = thoughts.filter((t) => t.isRevision);
    for (const revision of revisions) {
      if (!alternatives.includes(revision.thought)) {
        alternatives.push(revision.thought);
      }
    }

    return alternatives.slice(0, 3); // Return top 3 alternatives
  }

  /**
   * Export plan as JSON
   */
  private exportAsJSON(plan: Plan): string {
    const exportData = {
      id: plan.id,
      name: plan.name,
      objective: plan.objective,
      constraints: plan.constraints.map((c) => ({
        type: c.type,
        description: c.description,
        value: c.value,
      })),
      steps: plan.steps.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        type: s.type,
        dependencies: s.dependencies,
        preconditions: s.preconditions,
        postconditions: s.postconditions,
        estimatedDuration: s.estimatedDuration,
        status: s.status,
        metadata: s.metadata,
      })),
      status: plan.status,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
      metadata: plan.metadata,
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Export plan as YAML
   */
  private exportAsYAML(plan: Plan): string {
    // Simple YAML export - would use a proper YAML library in production
    const lines: string[] = [];

    lines.push(`id: ${plan.id}`);
    lines.push(`name: ${plan.name}`);
    lines.push(`objective: ${plan.objective}`);
    lines.push(`status: ${plan.status}`);
    lines.push('');

    lines.push('constraints:');
    for (const constraint of plan.constraints) {
      lines.push(`  - type: ${constraint.type}`);
      lines.push(`    description: ${constraint.description}`);
      if (constraint.value) {
        lines.push(`    value: ${constraint.value}`);
      }
    }
    lines.push('');

    lines.push('steps:');
    for (const step of plan.steps) {
      lines.push(`  - id: ${step.id}`);
      lines.push(`    name: ${step.name}`);
      lines.push(`    description: ${step.description}`);
      lines.push(`    type: ${step.type}`);
      lines.push(`    status: ${step.status}`);

      if (step.dependencies.length > 0) {
        lines.push('    dependencies:');
        for (const dep of step.dependencies) {
          lines.push(`      - ${dep}`);
        }
      }

      if (step.preconditions) {
        lines.push('    preconditions:');
        for (const condition of step.preconditions) {
          lines.push(`      - ${condition}`);
        }
      }

      if (step.postconditions) {
        lines.push('    postconditions:');
        for (const condition of step.postconditions) {
          lines.push(`      - ${condition}`);
        }
      }

      if (step.estimatedDuration) {
        lines.push(`    estimatedDuration: ${step.estimatedDuration}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Export plan as Mermaid diagram
   */
  private exportAsMermaid(plan: Plan): string {
    const lines: string[] = [];

    lines.push('graph TD');
    lines.push(`  Start[${plan.name}]`);

    // Add step nodes
    for (const step of plan.steps) {
      const shape = step.type === 'parallel' ? '{{' + step.name + '}}' : '[' + step.name + ']';
      lines.push(`  ${step.id}${shape}`);
    }

    // Add edges
    for (const step of plan.steps) {
      if (step.dependencies.length === 0) {
        lines.push(`  Start --> ${step.id}`);
      } else {
        for (const dep of step.dependencies) {
          lines.push(`  ${dep} --> ${step.id}`);
        }
      }
    }

    // Add end node for steps with no dependents
    const endSteps = plan.steps.filter((s) => !plan.steps.some((other) => other.dependencies.includes(s.id)));

    if (endSteps.length > 0) {
      lines.push('  End[Complete]');
      for (const step of endSteps) {
        lines.push(`  ${step.id} --> End`);
      }
    }

    // Add styling
    lines.push('');
    lines.push('  classDef pending fill:#f9f,stroke:#333,stroke-width:2px;');
    lines.push('  classDef completed fill:#9f9,stroke:#333,stroke-width:2px;');
    lines.push('  classDef failed fill:#f99,stroke:#333,stroke-width:2px;');

    // Apply styles based on status
    for (const step of plan.steps) {
      if (step.status === 'completed') {
        lines.push(`  class ${step.id} completed;`);
      } else if (step.status === 'failed') {
        lines.push(`  class ${step.id} failed;`);
      } else if (step.status === 'pending') {
        lines.push(`  class ${step.id} pending;`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Import plan from JSON
   */
  private importFromJSON(data: string): Plan {
    const parsed = JSON.parse(data);

    const plan: Plan = {
      id: parsed.id || this.generateId('plan'),
      name: parsed.name,
      objective: parsed.objective,
      constraints:
        parsed.constraints?.map((c: any) => ({
          type: c.type,
          description: c.description,
          value: c.value,
        })) || [],
      steps:
        parsed.steps?.map((s: any) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          type: s.type || 'sequential',
          dependencies: s.dependencies || [],
          preconditions: s.preconditions,
          postconditions: s.postconditions,
          estimatedDuration: s.estimatedDuration,
          status: s.status || 'pending',
          metadata: s.metadata,
        })) || [],
      dependencies: new Map(),
      status: parsed.status || 'draft',
      createdAt: new Date(parsed.createdAt || Date.now()),
      updatedAt: new Date(parsed.updatedAt || Date.now()),
      metadata: parsed.metadata,
    };

    // Rebuild dependencies map
    for (const step of plan.steps) {
      for (const dep of step.dependencies) {
        if (!plan.dependencies.has(dep)) {
          plan.dependencies.set(dep, new Set());
        }
        plan.dependencies.get(dep)!.add(step.id);
      }
    }

    return plan;
  }

  /**
   * Import plan from YAML
   */
  private importFromYAML(data: string): Plan {
    // Simple YAML import - would use a proper YAML library in production
    const lines = data.split('\n');
    const plan: Partial<Plan> = {
      constraints: [],
      steps: [],
      dependencies: new Map(),
    };

    let currentSection: string | null = null;
    let currentStep: Partial<Step> | null = null;
    let currentConstraint: Partial<Constraint> | null = null;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed === '') continue;

      // Check for top-level properties
      if (line.startsWith('id:')) {
        plan.id = trimmed.substring(3).trim();
      } else if (line.startsWith('name:')) {
        plan.name = trimmed.substring(5).trim();
      } else if (line.startsWith('objective:')) {
        plan.objective = trimmed.substring(10).trim();
      } else if (line.startsWith('status:')) {
        plan.status = trimmed.substring(7).trim() as any;
      } else if (trimmed === 'constraints:') {
        currentSection = 'constraints';
      } else if (trimmed === 'steps:') {
        currentSection = 'steps';
      } else if (currentSection === 'constraints') {
        if (trimmed.startsWith('- type:')) {
          if (currentConstraint) {
            plan.constraints!.push(currentConstraint as Constraint);
          }
          currentConstraint = { type: trimmed.substring(7).trim() as any };
        } else if (trimmed.startsWith('description:') && currentConstraint) {
          currentConstraint.description = trimmed.substring(12).trim();
        } else if (trimmed.startsWith('value:') && currentConstraint) {
          currentConstraint.value = trimmed.substring(6).trim();
        }
      } else if (currentSection === 'steps') {
        if (trimmed.startsWith('- id:')) {
          if (currentStep) {
            plan.steps!.push(currentStep as Step);
          }
          currentStep = {
            id: trimmed.substring(5).trim(),
            dependencies: [],
            status: 'pending',
          };
        } else if (currentStep) {
          if (trimmed.startsWith('name:')) {
            currentStep.name = trimmed.substring(5).trim();
          } else if (trimmed.startsWith('description:')) {
            currentStep.description = trimmed.substring(12).trim();
          } else if (trimmed.startsWith('type:')) {
            currentStep.type = trimmed.substring(5).trim() as any;
          } else if (trimmed.startsWith('status:')) {
            currentStep.status = trimmed.substring(7).trim() as any;
          } else if (trimmed.startsWith('- ') && line.includes('dependencies:')) {
            currentStep.dependencies!.push(trimmed.substring(2).trim());
          }
        }
      }
    }

    // Add last items
    if (currentConstraint) {
      plan.constraints!.push(currentConstraint as Constraint);
    }
    if (currentStep) {
      plan.steps!.push(currentStep as Step);
    }

    // Set defaults
    plan.id = plan.id || this.generateId('plan');
    plan.status = plan.status || 'draft';
    plan.createdAt = new Date();
    plan.updatedAt = new Date();

    // Rebuild dependencies map
    for (const step of plan.steps!) {
      for (const dep of step.dependencies) {
        if (!plan.dependencies!.has(dep)) {
          plan.dependencies!.set(dep, new Set());
        }
        plan.dependencies!.get(dep)!.add(step.id);
      }
    }

    return plan as Plan;
  }
}

// Export singleton instance
export const sequentialAdapter = new SequentialAdapter();
