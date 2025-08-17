/**
 * Pipeline Manager for multi-agent workflow coordination
 * Handles task execution, dependencies, and agent coordination
 */

import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { createLogger } from '../utils/logger';
import { type CheckpointData, CheckpointManager } from './checkpoint';
import { PipelineError, TimeoutError, ValidationError } from './errors';
import { PipelineEvent, PipelineState, PipelineStateMachine } from './state-machine';

/**
 * Execution mode enum
 */
export enum ExecutionMode {
  AUTO = 'auto',
  SEMI = 'semi',
  DRY_RUN = 'dry-run',
}

/**
 * Task priority levels
 */
export enum TaskPriority {
  LOW = 0,
  MEDIUM = 1,
  HIGH = 2,
  CRITICAL = 3,
}

/**
 * Task status enum
 */
export enum TaskStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  CANCELLED = 'cancelled',
}

/**
 * Agent configuration interface
 */
export interface AgentConfig {
  id: string;
  type: 'architect' | 'developer' | 'tester' | 'debugger';
  name: string;
  capabilities: string[];
  maxConcurrentTasks: number;
  timeout?: number;
  retryPolicy?: {
    maxRetries: number;
    retryDelay: number;
  };
}

/**
 * Task interface
 */
export interface Task {
  id: string;
  name: string;
  description?: string;
  type: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignedAgent?: string;
  dependencies: string[];
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: Error;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  retryCount: number;
  metadata?: Record<string, unknown>;
}

/**
 * Task result interface
 */
export interface TaskResult {
  taskId: string;
  status: 'success' | 'failure' | 'partial' | 'skipped';
  output?: Record<string, unknown>;
  error?: Error;
  duration: number;
  artifacts?: Array<{
    name: string;
    type: string;
    path: string;
  }>;
}

/**
 * Pipeline configuration schema
 */
export const PipelineConfigSchema = z.object({
  id: z.string().optional(),
  objective: z.string().min(1),
  mode: z.nativeEnum(ExecutionMode).default(ExecutionMode.AUTO),
  maxIterations: z.number().int().positive().default(10),
  maxConcurrentTasks: z.number().int().positive().default(5),
  taskTimeout: z.number().int().positive().default(300000), // 5 minutes
  agents: z.array(
    z.object({
      id: z.string(),
      type: z.enum(['architect', 'developer', 'tester', 'debugger']),
      name: z.string(),
      capabilities: z.array(z.string()),
      maxConcurrentTasks: z.number().int().positive().default(3),
      timeout: z.number().int().positive().optional(),
      retryPolicy: z
        .object({
          maxRetries: z.number().int().min(0).default(3),
          retryDelay: z.number().int().positive().default(1000),
        })
        .optional(),
    }),
  ),
  checkpointStrategy: z
    .object({
      enabled: z.boolean().default(true),
      interval: z.number().int().positive().default(60000), // 1 minute
      onPhaseComplete: z.boolean().default(true),
      onError: z.boolean().default(true),
    })
    .optional(),
  errorHandling: z
    .object({
      continueOnError: z.boolean().default(false),
      maxErrors: z.number().int().positive().default(5),
      rollbackOnCriticalError: z.boolean().default(true),
    })
    .optional(),
});

export type PipelineConfig = z.infer<typeof PipelineConfigSchema>;

/**
 * Agent interface
 */
export interface IAgent {
  id: string;
  type: string;
  status: 'idle' | 'busy' | 'error' | 'offline';
  currentTasks: Set<string>;
  retryPolicy?: {
    maxRetries: number;
    retryDelay: number;
  };

  canHandle(task: Task): boolean;
  execute(task: Task): Promise<TaskResult>;
  getCapabilities(): string[];
  getStatus(): string;
}

/**
 * Dependency graph for task management
 */
class DependencyGraph {
  private adjacencyList: Map<string, Set<string>>;
  private inDegree: Map<string, number>;

  constructor() {
    this.adjacencyList = new Map();
    this.inDegree = new Map();
  }

  addNode(nodeId: string): void {
    if (!this.adjacencyList.has(nodeId)) {
      this.adjacencyList.set(nodeId, new Set());
      this.inDegree.set(nodeId, 0);
    }
  }

  addEdge(from: string, to: string): void {
    this.addNode(from);
    this.addNode(to);

    const neighbors = this.adjacencyList.get(from)!;
    if (!neighbors.has(to)) {
      neighbors.add(to);
      this.inDegree.set(to, (this.inDegree.get(to) || 0) + 1);
    }
  }

  getExecutableNodes(): string[] {
    const executable: string[] = [];

    for (const [node, degree] of this.inDegree.entries()) {
      if (degree === 0) {
        executable.push(node);
      }
    }

    return executable;
  }

  markCompleted(nodeId: string): void {
    const neighbors = this.adjacencyList.get(nodeId);
    if (neighbors) {
      for (const neighbor of neighbors) {
        const degree = this.inDegree.get(neighbor) || 0;
        this.inDegree.set(neighbor, Math.max(0, degree - 1));
      }
    }

    // Remove the completed node
    this.adjacencyList.delete(nodeId);
    this.inDegree.delete(nodeId);
  }

  hasCycle(): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycleDFS = (node: string): boolean => {
      visited.add(node);
      recursionStack.add(node);

      const neighbors = this.adjacencyList.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycleDFS(neighbor)) {
            return true;
          }
        } else if (recursionStack.has(neighbor)) {
          return true;
        }
      }

      recursionStack.delete(node);
      return false;
    };

    for (const node of this.adjacencyList.keys()) {
      if (!visited.has(node)) {
        if (hasCycleDFS(node)) {
          return true;
        }
      }
    }

    return false;
  }
}

/**
 * Task queue with priority support
 */
class TaskQueue {
  private queues: Map<TaskPriority, Task[]>;

  constructor() {
    this.queues = new Map([
      [TaskPriority.CRITICAL, []],
      [TaskPriority.HIGH, []],
      [TaskPriority.MEDIUM, []],
      [TaskPriority.LOW, []],
    ]);
  }

  enqueue(task: Task): void {
    const queue = this.queues.get(task.priority)!;
    queue.push(task);
  }

  dequeue(): Task | undefined {
    // Check queues in priority order
    for (const priority of [TaskPriority.CRITICAL, TaskPriority.HIGH, TaskPriority.MEDIUM, TaskPriority.LOW]) {
      const queue = this.queues.get(priority)!;
      if (queue.length > 0) {
        return queue.shift();
      }
    }
    return undefined;
  }

  isEmpty(): boolean {
    for (const queue of this.queues.values()) {
      if (queue.length > 0) {
        return false;
      }
    }
    return true;
  }

  size(): number {
    let total = 0;
    for (const queue of this.queues.values()) {
      total += queue.length;
    }
    return total;
  }

  clear(): void {
    for (const queue of this.queues.values()) {
      queue.length = 0;
    }
  }
}

/**
 * Pipeline Manager class
 */
export class PipelineManager {
  private config: PipelineConfig;
  private logger;
  private stateMachine: PipelineStateMachine;
  private checkpointManager?: CheckpointManager;
  private agents: Map<string, IAgent>;
  private tasks: Map<string, Task>;
  private taskQueue: TaskQueue;
  private dependencyGraph: DependencyGraph;
  private runningTasks: Set<string>;
  private completedTasks: Set<string>;
  private failedTasks: Set<string>;
  private metrics: {
    startTime?: Date;
    endTime?: Date;
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    averageTaskDuration: number;
  };
  private abortController?: AbortController;

  constructor(config: PipelineConfig) {
    // Validate configuration
    const validatedConfig = PipelineConfigSchema.parse(config);
    this.config = {
      ...validatedConfig,
      id: validatedConfig.id || uuidv4(),
    };

    this.logger = createLogger(`pipeline:${this.config.id}`);
    this.stateMachine = new PipelineStateMachine({
      enableCheckpoints: this.config.checkpointStrategy?.enabled,
      enableLogging: true,
    });

    if (this.config.checkpointStrategy?.enabled) {
      this.checkpointManager = new CheckpointManager({
        baseDir: '.kilo',
        filePrefix: `pipeline_${this.config.id}`,
      });
    }

    this.agents = new Map();
    this.tasks = new Map();
    this.taskQueue = new TaskQueue();
    this.dependencyGraph = new DependencyGraph();
    this.runningTasks = new Set();
    this.completedTasks = new Set();
    this.failedTasks = new Set();

    this.metrics = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      averageTaskDuration: 0,
    };

    this.initializeAgents();
  }

  /**
   * Initialize agents from configuration
   */
  private initializeAgents(): void {
    for (const agentConfig of this.config.agents) {
      // Create mock agent for now - would be real agent implementation
      const agent: IAgent = {
        id: agentConfig.id,
        type: agentConfig.type,
        status: 'idle',
        currentTasks: new Set(),
        retryPolicy: agentConfig.retryPolicy,

        canHandle: (task: Task) => {
          return agentConfig.capabilities.includes(task.type);
        },

        execute: async (task: Task) => {
          // Mock execution - replace with real implementation
          await new Promise((resolve) => setTimeout(resolve, 100));
          return {
            taskId: task.id,
            status: 'success',
            output: { result: 'mock result' },
            duration: 100,
          };
        },

        getCapabilities: () => agentConfig.capabilities,
        getStatus: () => 'idle',
      };

      this.agents.set(agent.id, agent);
    }

    this.logger.info(`Initialized ${this.agents.size} agents`);
  }

  /**
   * Create and add a task to the pipeline
   */
  async addTask(
    name: string,
    type: string,
    input: Record<string, unknown>,
    options?: {
      priority?: TaskPriority;
      dependencies?: string[];
      assignedAgent?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<Task> {
    const task: Task = {
      id: uuidv4(),
      name,
      type,
      priority: options?.priority || TaskPriority.MEDIUM,
      status: TaskStatus.PENDING,
      assignedAgent: options?.assignedAgent,
      dependencies: options?.dependencies || [],
      input,
      createdAt: new Date(),
      retryCount: 0,
      metadata: options?.metadata,
    };

    // Validate dependencies exist
    for (const depId of task.dependencies) {
      if (!this.tasks.has(depId)) {
        throw new ValidationError(`Dependency task ${depId} does not exist`, 'dependencies', depId);
      }
    }

    // Add to task map and dependency graph
    this.tasks.set(task.id, task);
    this.dependencyGraph.addNode(task.id);

    // Add dependency edges
    for (const depId of task.dependencies) {
      this.dependencyGraph.addEdge(depId, task.id);
    }

    // Check for cycles
    if (this.dependencyGraph.hasCycle()) {
      this.tasks.delete(task.id);
      throw new ValidationError('Adding task would create a dependency cycle', 'dependencies', task.dependencies);
    }

    this.metrics.totalTasks++;
    this.logger.debug(`Added task ${task.id}: ${task.name}`);

    return task;
  }

  /**
   * Execute the pipeline
   */
  async execute(): Promise<Map<string, TaskResult>> {
    this.logger.info(`Starting pipeline execution: ${this.config.objective}`);
    this.metrics.startTime = new Date();
    this.abortController = new AbortController();

    try {
      // Initialize checkpoint manager
      if (this.checkpointManager) {
        await this.checkpointManager.initialize();
      }

      // Start state machine
      this.stateMachine.start();
      this.stateMachine.send(PipelineEvent.START, {
        pipelineId: this.config.id,
        objective: this.config.objective,
      });

      // Process tasks
      const results = await this.processTasks();

      // Complete pipeline
      this.stateMachine.send(PipelineEvent.COMPLETE);
      await this.stateMachine.waitForState(PipelineState.COMPLETED, 5000);

      this.metrics.endTime = new Date();
      this.logMetrics();

      return results;
    } catch (error) {
      this.logger.error('Pipeline execution failed', error);
      this.stateMachine.send(PipelineEvent.ERROR, { error });
      throw new PipelineError(`Pipeline execution failed: ${(error as Error).message}`);
    } finally {
      this.stateMachine.stop();
    }
  }

  /**
   * Process all tasks in the pipeline
   */
  private async processTasks(): Promise<Map<string, TaskResult>> {
    const results = new Map<string, TaskResult>();
    let iteration = 0;

    while (
      !this.allTasksCompleted() &&
      iteration < this.config.maxIterations &&
      !this.abortController?.signal.aborted
    ) {
      iteration++;

      // Get executable tasks (no pending dependencies)
      const executableTasks = this.getExecutableTasks();

      if (executableTasks.length === 0 && this.runningTasks.size === 0) {
        // Deadlock detected
        throw new PipelineError('Pipeline deadlock: no executable tasks and no running tasks');
      }

      // Queue executable tasks
      for (const task of executableTasks) {
        this.taskQueue.enqueue(task);
        task.status = TaskStatus.QUEUED;
      }

      // Process queued tasks up to concurrency limit
      while (!this.taskQueue.isEmpty() && this.runningTasks.size < this.config.maxConcurrentTasks) {
        const task = this.taskQueue.dequeue()!;

        // Find suitable agent
        const agent = this.findSuitableAgent(task);
        if (!agent) {
          // No agent available, re-queue with lower priority
          task.priority = Math.max(TaskPriority.LOW, task.priority - 1);
          this.taskQueue.enqueue(task);
          continue;
        }

        // Execute task asynchronously
        this.executeTask(task, agent).then(
          (result) => {
            results.set(task.id, result);
            this.handleTaskCompletion(task, result);
          },
          (error) => {
            this.handleTaskError(task, error);
          },
        );
      }

      // Wait for some tasks to complete before next iteration
      if (this.runningTasks.size > 0) {
        await this.waitForTaskCompletion();
      }

      // Checkpoint if needed
      if (this.shouldCheckpoint()) {
        await this.saveCheckpoint();
      }
    }

    // Wait for all remaining tasks
    while (this.runningTasks.size > 0) {
      await this.waitForTaskCompletion();
    }

    return results;
  }

  /**
   * Execute a single task
   */
  private async executeTask(task: Task, agent: IAgent): Promise<TaskResult> {
    this.logger.debug(`Executing task ${task.id} with agent ${agent.id}`);

    task.status = TaskStatus.RUNNING;
    task.startedAt = new Date();
    task.assignedAgent = agent.id;
    this.runningTasks.add(task.id);
    agent.currentTasks.add(task.id);
    agent.status = 'busy';

    try {
      // Execute with timeout
      const timeoutMs = this.config.taskTimeout;
      const result = await Promise.race([
        agent.execute(task),
        new Promise<TaskResult>((_, reject) => {
          setTimeout(() => {
            reject(new TimeoutError(`Task ${task.id} timed out after ${timeoutMs}ms`, timeoutMs, task.name));
          }, timeoutMs);
        }),
      ]);

      task.completedAt = new Date();
      task.duration = task.completedAt.getTime() - task.startedAt.getTime();
      task.output = result.output;

      return result;
    } catch (error) {
      task.error = error as Error;

      // Retry if applicable
      if (task.retryCount < (agent.retryPolicy?.maxRetries || 3)) {
        task.retryCount++;
        this.logger.warn(`Retrying task ${task.id}, attempt ${task.retryCount}`);

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, agent.retryPolicy?.retryDelay || 1000));

        return this.executeTask(task, agent);
      }

      throw error;
    } finally {
      this.runningTasks.delete(task.id);
      agent.currentTasks.delete(task.id);
      if (agent.currentTasks.size === 0) {
        agent.status = 'idle';
      }
    }
  }

  /**
   * Find a suitable agent for a task
   */
  private findSuitableAgent(task: Task): IAgent | undefined {
    // If agent is pre-assigned
    if (task.assignedAgent) {
      const agent = this.agents.get(task.assignedAgent);
      if (agent && agent.canHandle(task) && agent.status === 'idle') {
        return agent;
      }
    }

    // Find first available agent that can handle the task
    for (const agent of this.agents.values()) {
      if (
        agent.canHandle(task) &&
        agent.status === 'idle' &&
        agent.currentTasks.size < 3 // Max concurrent tasks per agent
      ) {
        return agent;
      }
    }

    return undefined;
  }

  /**
   * Get tasks that are ready to execute
   */
  private getExecutableTasks(): Task[] {
    const executableIds = this.dependencyGraph.getExecutableNodes();
    const executableTasks: Task[] = [];

    for (const taskId of executableIds) {
      const task = this.tasks.get(taskId);
      if (
        task &&
        task.status === TaskStatus.PENDING &&
        !this.runningTasks.has(taskId) &&
        !this.completedTasks.has(taskId) &&
        !this.failedTasks.has(taskId)
      ) {
        executableTasks.push(task);
      }
    }

    return executableTasks;
  }

  /**
   * Handle task completion
   */
  private handleTaskCompletion(task: Task, result: TaskResult): void {
    task.status = TaskStatus.COMPLETED;
    this.completedTasks.add(task.id);
    this.dependencyGraph.markCompleted(task.id);
    this.metrics.completedTasks++;

    // Update average duration
    const durations = Array.from(this.tasks.values())
      .filter((t) => t.duration)
      .map((t) => t.duration!);

    if (durations.length > 0) {
      this.metrics.averageTaskDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    }

    this.logger.info(`Task ${task.id} completed successfully`);

    // Notify state machine
    this.stateMachine.send(PipelineEvent.NEXT_PHASE, { task, result });
  }

  /**
   * Handle task error
   */
  private handleTaskError(task: Task, error: Error): void {
    task.status = TaskStatus.FAILED;
    task.error = error;
    this.failedTasks.add(task.id);
    this.metrics.failedTasks++;

    this.logger.error(`Task ${task.id} failed`, error);

    // Check error handling policy
    if (this.config.errorHandling?.continueOnError) {
      // Mark dependencies as skipped
      this.skipDependentTasks(task.id);
    } else if (this.config.errorHandling?.rollbackOnCriticalError) {
      // Trigger rollback
      this.stateMachine.send(PipelineEvent.ROLLBACK, { task, error });
    } else {
      // Abort pipeline
      this.abort();
    }
  }

  /**
   * Skip tasks that depend on a failed task
   */
  private skipDependentTasks(failedTaskId: string): void {
    for (const task of this.tasks.values()) {
      if (task.dependencies.includes(failedTaskId)) {
        task.status = TaskStatus.SKIPPED;
        this.logger.info(`Skipping task ${task.id} due to failed dependency`);

        // Recursively skip dependents
        this.skipDependentTasks(task.id);
      }
    }
  }

  /**
   * Wait for at least one task to complete
   */
  private async waitForTaskCompletion(): Promise<void> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.runningTasks.size === 0) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }

  /**
   * Check if all tasks are completed
   */
  private allTasksCompleted(): boolean {
    return (
      this.tasks.size ===
      this.completedTasks.size +
        this.failedTasks.size +
        Array.from(this.tasks.values()).filter((t) => t.status === TaskStatus.SKIPPED).length
    );
  }

  /**
   * Check if checkpoint should be saved
   */
  private shouldCheckpoint(): boolean {
    if (!this.config.checkpointStrategy?.enabled) {
      return false;
    }

    // Checkpoint on phase complete
    if (this.config.checkpointStrategy.onPhaseComplete) {
      const currentState = this.stateMachine.getCurrentStateValue();
      if (currentState && ['mapping', 'acting', 'debriefing'].includes(currentState)) {
        return true;
      }
    }

    // Periodic checkpoint
    // This would check time since last checkpoint
    return false;
  }

  /**
   * Save checkpoint
   */
  private async saveCheckpoint(): Promise<void> {
    if (!this.checkpointManager) {
      return;
    }

    try {
      const checkpointData: CheckpointData = {
        id: '',
        pipelineId: this.config.id!,
        timestamp: new Date(),
        version: '1.0.0',
        state: {
          phase: this.stateMachine.getCurrentStateValue() || 'unknown',
          status: 'active',
          progress: this.getProgress(),
          context: {
            objective: this.config.objective,
            mode: this.config.mode,
          },
        },
        tasks: {
          completed: Array.from(this.completedTasks),
          inProgress: Array.from(this.runningTasks),
          pending: Array.from(this.tasks.values())
            .filter((t) => t.status === TaskStatus.PENDING)
            .map((t) => t.id),
          failed: Array.from(this.failedTasks),
        },
        artifacts: {},
        metrics: {
          startTime: this.metrics.startTime || new Date(),
          duration: this.metrics.startTime ? Date.now() - this.metrics.startTime.getTime() : 0,
        },
      };

      await this.checkpointManager.save(checkpointData);
      this.logger.debug('Checkpoint saved');
    } catch (error) {
      this.logger.error('Failed to save checkpoint', error);
    }
  }

  /**
   * Pause pipeline execution
   */
  async pause(): Promise<void> {
    this.logger.info('Pausing pipeline');
    this.stateMachine.send(PipelineEvent.PAUSE);
    await this.saveCheckpoint();
  }

  /**
   * Resume pipeline execution
   */
  async resume(): Promise<void> {
    this.logger.info('Resuming pipeline');

    // Load latest checkpoint if available
    if (this.checkpointManager) {
      const checkpoint = await this.checkpointManager.getLatest(this.config.id!);
      if (checkpoint) {
        await this.restoreFromCheckpoint(checkpoint);
      }
    }

    this.stateMachine.send(PipelineEvent.RESUME);
  }

  /**
   * Abort pipeline execution
   */
  abort(): void {
    this.logger.warn('Aborting pipeline');
    this.abortController?.abort();
    this.stateMachine.send(PipelineEvent.CANCEL);

    // Cancel all running tasks
    for (const taskId of this.runningTasks) {
      const task = this.tasks.get(taskId);
      if (task) {
        task.status = TaskStatus.CANCELLED;
      }
    }
  }

  /**
   * Get current pipeline status
   */
  getStatus(): {
    state: string;
    progress: number;
    tasks: {
      total: number;
      completed: number;
      running: number;
      failed: number;
    };
    metrics: {
      startTime?: Date;
      endTime?: Date;
      totalTasks: number;
      completedTasks: number;
      failedTasks: number;
      averageTaskDuration: number;
    };
  } {
    return {
      state: this.stateMachine.getCurrentStateValue() || 'unknown',
      progress: this.getProgress(),
      tasks: {
        total: this.tasks.size,
        completed: this.completedTasks.size,
        running: this.runningTasks.size,
        failed: this.failedTasks.size,
      },
      metrics: { ...this.metrics },
    };
  }

  /**
   * Get pipeline progress percentage
   */
  private getProgress(): number {
    if (this.tasks.size === 0) {
      return 0;
    }

    const completed = this.completedTasks.size + this.failedTasks.size;
    return Math.round((completed / this.tasks.size) * 100);
  }

  /**
   * Get pipeline metrics
   */
  getMetrics(): {
    startTime?: Date;
    endTime?: Date;
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    averageTaskDuration: number;
  } {
    return { ...this.metrics };
  }

  /**
   * Restore from checkpoint
   */
  private async restoreFromCheckpoint(checkpoint: CheckpointData): Promise<void> {
    this.logger.info(`Restoring from checkpoint ${checkpoint.id}`);

    // Restore task states
    for (const taskId of checkpoint.tasks.completed) {
      this.completedTasks.add(taskId);
      const task = this.tasks.get(taskId);
      if (task) {
        task.status = TaskStatus.COMPLETED;
        this.dependencyGraph.markCompleted(taskId);
      }
    }

    for (const taskId of checkpoint.tasks.failed) {
      this.failedTasks.add(taskId);
      const task = this.tasks.get(taskId);
      if (task) {
        task.status = TaskStatus.FAILED;
      }
    }

    // Restore metrics
    this.metrics.completedTasks = checkpoint.tasks.completed.length;
    this.metrics.failedTasks = checkpoint.tasks.failed.length;
  }

  /**
   * Log pipeline metrics
   */
  private logMetrics(): void {
    const duration =
      this.metrics.endTime && this.metrics.startTime
        ? this.metrics.endTime.getTime() - this.metrics.startTime.getTime()
        : 0;

    this.logger.info('Pipeline execution completed', {
      pipelineId: this.config.id,
      objective: this.config.objective,
      duration: `${(duration / 1000).toFixed(2)}s`,
      tasks: {
        total: this.metrics.totalTasks,
        completed: this.metrics.completedTasks,
        failed: this.metrics.failedTasks,
      },
      averageTaskDuration: `${(this.metrics.averageTaskDuration / 1000).toFixed(2)}s`,
    });
  }
}

/**
 * Create pipeline manager instance
 */
export function createPipelineManager(config: PipelineConfig): PipelineManager {
  return new PipelineManager(config);
}
