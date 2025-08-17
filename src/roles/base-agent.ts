/**
 * Base Agent Abstract Class
 * Foundation for all specialized agents in the system
 */

import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { CheckpointManager } from '../core/checkpoint';
import { 
  AgentError,
  MaxRetriesExceededError,
  TimeoutError,
  ValidationError
} from '../core/errors';
import type { 
  AgentCapability, 
  AgentContext, 
  AgentEvent,
  AgentInfo,
  AgentMessage, 
  AgentMetrics,
  AgentResult,
  AgentType,
  EventHandler,
  MessageType,
  Metrics
} from '../types';
import { createLogger } from '../utils/logger';

/**
 * Base agent configuration
 */
export interface BaseAgentConfig {
  id?: string;
  name: string;
  type: AgentType;
  maxRetries?: number;
  timeout?: number;
  checkpointEnabled?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Agent status enum
 */
export enum AgentStatus {
  IDLE = 'idle',
  BUSY = 'busy',
  ERROR = 'error',
  OFFLINE = 'offline',
}

/**
 * Abstract base class for all agents
 */
export abstract class BaseAgent {
  protected id: string;
  protected name: string;
  protected type: AgentType;
  protected capabilities: AgentCapability[] = [];
  protected context: AgentContext;
  protected maxRetries: number;
  protected timeout: number;
  protected logger;
  protected checkpointManager?: CheckpointManager;
  protected status: AgentStatus = AgentStatus.IDLE;
  protected currentTasks: Set<string> = new Set();
  protected messageHandlers: Map<MessageType, (message: AgentMessage) => Promise<void>> = new Map();
  protected eventHandlers: Map<AgentEvent, EventHandler[]> = new Map();
  protected metrics: AgentMetrics;
  protected startTime: Date;
  private messageQueue: AgentMessage[] = [];
  private isProcessing = false;

  constructor(config: BaseAgentConfig) {
    this.id = config.id || uuidv4();
    this.name = config.name;
    this.type = config.type;
    this.maxRetries = config.maxRetries || 3;
    this.timeout = config.timeout || 300000; // 5 minutes default
    this.logger = createLogger(`agent:${this.type}:${this.id}`);
    
    // Initialize context
    this.context = {
      pipelineId: '',
      executionId: '',
      environment: 'development',
      variables: {},
      artifacts: new Map(),
      history: [],
      checkpoints: [],
    };

    // Initialize metrics
    this.metrics = {
      tasksCompleted: 0,
      tasksFailed: 0,
      averageExecutionTime: 0,
      successRate: 0,
      uptime: 0,
    };
    
    this.startTime = new Date();

    // Initialize checkpoint manager if enabled
    if (config.checkpointEnabled) {
      this.checkpointManager = new CheckpointManager({
        baseDir: `.kilo/agents/${this.type}`,
        filePrefix: `agent_${this.id}`,
        maxCheckpoints: 10,
      });
    }

    // Register default message handlers
    this.registerDefaultHandlers();
    
    this.logger.info(`${this.name} agent initialized`, {
      id: this.id,
      type: this.type,
      capabilities: this.capabilities.length,
    });
  }

  /**
   * Abstract methods that must be implemented by concrete agents
   */
  abstract async execute(message: AgentMessage): Promise<AgentResult>;
  abstract async validate(input: unknown): Promise<boolean>;
  abstract getCapabilities(): AgentCapability[];
  protected abstract async initializeCapabilities(): Promise<void>;

  /**
   * Initialize the agent
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing agent');
      
      // Initialize checkpoint manager
      if (this.checkpointManager) {
        await this.checkpointManager.initialize();
      }
      
      // Initialize agent-specific capabilities
      await this.initializeCapabilities();
      
      // Load capabilities
      this.capabilities = this.getCapabilities();
      
      this.logger.info('Agent initialization complete', {
        capabilities: this.capabilities.map(c => c.name),
      });
    } catch (error) {
      this.logger.error('Failed to initialize agent', error);
      this.status = AgentStatus.ERROR;
      throw new AgentError(
        `Failed to initialize ${this.name} agent: ${(error as Error).message}`,
        this.type,
        error
      );
    }
  }

  /**
   * Send a message to another agent
   */
  protected async sendMessage(target: string, content: unknown, type: MessageType = MessageType.REQUEST): Promise<void> {
    const message: AgentMessage = {
      id: uuidv4(),
      from: this.id,
      to: target,
      type,
      payload: content,
      timestamp: new Date(),
      correlationId: uuidv4(),
    };

    // Add to context history
    this.context.history.push(message);
    
    // Emit event
    await this.emit(AgentEvent.MESSAGE_SENT, message);
    
    this.logger.debug('Message sent', {
      to: target,
      type,
      messageId: message.id,
    });
  }

  /**
   * Receive and process a message
   */
  async receiveMessage(message: AgentMessage): Promise<void> {
    this.logger.debug('Message received', {
      from: message.from,
      type: message.type,
      messageId: message.id,
    });

    // Add to queue
    this.messageQueue.push(message);
    
    // Add to context history
    this.context.history.push(message);
    
    // Emit event
    await this.emit(AgentEvent.MESSAGE_RECEIVED, message);
    
    // Process queue
    await this.processMessageQueue();
  }

  /**
   * Process message queue
   */
  private async processMessageQueue(): Promise<void> {
    if (this.isProcessing || this.messageQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()!;
      
      try {
        // Get handler for message type
        const handler = this.messageHandlers.get(message.type);
        
        if (handler) {
          await handler(message);
        } else {
          // Default handling - execute the message
          await this.handleDefaultMessage(message);
        }
      } catch (error) {
        this.logger.error('Failed to process message', {
          error,
          messageId: message.id,
        });
        
        // Send error response
        await this.sendMessage(
          message.from,
          {
            error: (error as Error).message,
            originalMessageId: message.id,
          },
          MessageType.ERROR
        );
      }
    }

    this.isProcessing = false;
  }

  /**
   * Default message handler
   */
  private async handleDefaultMessage(message: AgentMessage): Promise<void> {
    if (message.type === MessageType.REQUEST) {
      // Execute the request
      const result = await this.executeWithRetry(message);
      
      // Send response
      await this.sendMessage(
        message.from,
        result,
        MessageType.RESPONSE
      );
    }
  }

  /**
   * Execute with retry logic
   */
  private async executeWithRetry(message: AgentMessage): Promise<AgentResult> {
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        this.logger.debug(`Executing message (attempt ${attempt}/${this.maxRetries})`, {
          messageId: message.id,
        });
        
        // Update status
        this.status = AgentStatus.BUSY;
        this.currentTasks.add(message.id);
        
        // Execute with timeout
        const result = await this.executeWithTimeout(message);
        
        // Update metrics
        this.updateMetrics(true, result.duration);
        
        return result;
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`Execution attempt ${attempt} failed`, {
          error: lastError.message,
          messageId: message.id,
        });
        
        if (attempt < this.maxRetries) {
          // Wait before retry with exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } finally {
        this.currentTasks.delete(message.id);
        if (this.currentTasks.size === 0) {
          this.status = AgentStatus.IDLE;
        }
      }
    }
    
    // Update metrics for failure
    this.updateMetrics(false);
    
    throw new MaxRetriesExceededError(
      `Failed to execute after ${this.maxRetries} attempts: ${lastError?.message}`,
      this.maxRetries,
      this.type
    );
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout(message: AgentMessage): Promise<AgentResult> {
    const startTime = Date.now();
    
    return Promise.race([
      this.execute(message).then(result => ({
        ...result,
        duration: Date.now() - startTime,
      })),
      new Promise<AgentResult>((_, reject) => {
        setTimeout(() => {
          reject(new TimeoutError(
            `Execution timed out after ${this.timeout}ms`,
            this.timeout,
            message.id
          ));
        }, this.timeout);
      }),
    ]);
  }

  /**
   * Save checkpoint
   */
  protected async checkpoint(name: string, state: unknown): Promise<void> {
    if (!this.checkpointManager) {
      return;
    }

    try {
      const checkpointId = await this.checkpointManager.save({
        id: '',
        pipelineId: this.context.pipelineId,
        timestamp: new Date(),
        version: '1.0.0',
        state: {
          phase: name,
          status: this.status,
          progress: 0,
          context: state,
        },
        tasks: {
          completed: [],
          inProgress: Array.from(this.currentTasks),
          pending: [],
          failed: [],
        },
        artifacts: Object.fromEntries(this.context.artifacts),
        metrics: {
          startTime: this.startTime,
          duration: Date.now() - this.startTime.getTime(),
        },
      });
      
      this.context.checkpoints.push(checkpointId);
      
      await this.emit(AgentEvent.CHECKPOINT_SAVED, { checkpointId, name });
      
      this.logger.debug('Checkpoint saved', { checkpointId, name });
    } catch (error) {
      this.logger.error('Failed to save checkpoint', error);
    }
  }

  /**
   * Recover from checkpoint
   */
  protected async recover(checkpointId: string): Promise<unknown> {
    if (!this.checkpointManager) {
      throw new Error('Checkpoint manager not initialized');
    }

    try {
      const checkpoint = await this.checkpointManager.load(checkpointId);
      
      if (!checkpoint) {
        throw new Error(`Checkpoint ${checkpointId} not found`);
      }
      
      this.logger.info('Recovering from checkpoint', { checkpointId });
      
      // Restore context
      this.context.artifacts = new Map(Object.entries(checkpoint.artifacts));
      
      return checkpoint.state.context;
    } catch (error) {
      this.logger.error('Failed to recover from checkpoint', error);
      throw error;
    }
  }

  /**
   * Register default message handlers
   */
  private registerDefaultHandlers(): void {
    // Status request handler
    this.messageHandlers.set(MessageType.STATUS, async (message) => {
      await this.sendMessage(
        message.from,
        this.getInfo(),
        MessageType.RESPONSE
      );
    });

    // Notification handler
    this.messageHandlers.set(MessageType.NOTIFICATION, async (message) => {
      this.logger.info('Notification received', {
        from: message.from,
        payload: message.payload,
      });
    });

    // Error handler
    this.messageHandlers.set(MessageType.ERROR, async (message) => {
      this.logger.error('Error message received', {
        from: message.from,
        error: message.payload,
      });
    });
  }

  /**
   * Register a message handler
   */
  protected registerMessageHandler(type: MessageType, handler: (message: AgentMessage) => Promise<void>): void {
    this.messageHandlers.set(type, handler);
  }

  /**
   * Register an event handler
   */
  on(event: AgentEvent, handler: EventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  /**
   * Emit an event
   */
  protected async emit(event: AgentEvent, data: unknown): Promise<void> {
    const handlers = this.eventHandlers.get(event) || [];
    
    for (const handler of handlers) {
      try {
        await handler(event, data);
      } catch (error) {
        this.logger.error('Event handler error', {
          event,
          error: (error as Error).message,
        });
      }
    }
  }

  /**
   * Update metrics
   */
  private updateMetrics(success: boolean, duration?: number): void {
    if (success) {
      this.metrics.tasksCompleted++;
    } else {
      this.metrics.tasksFailed++;
    }

    // Update success rate
    const total = this.metrics.tasksCompleted + this.metrics.tasksFailed;
    this.metrics.successRate = total > 0 
      ? (this.metrics.tasksCompleted / total) * 100 
      : 0;

    // Update average execution time
    if (duration) {
      const currentAvg = this.metrics.averageExecutionTime;
      const completed = this.metrics.tasksCompleted;
      this.metrics.averageExecutionTime = completed > 0
        ? ((currentAvg * (completed - 1)) + duration) / completed
        : duration;
    }

    // Update uptime
    this.metrics.uptime = Date.now() - this.startTime.getTime();
  }

  /**
   * Validate input with schema
   */
  protected async validateWithSchema<T>(input: unknown, schema: z.ZodSchema<T>): Promise<T> {
    try {
      return schema.parse(input);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(
          'Input validation failed',
          'schema',
          error.errors
        );
      }
      throw error;
    }
  }

  /**
   * Get agent information
   */
  getInfo(): AgentInfo {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
      status: this.status,
      capabilities: this.capabilities.map(c => c.name),
      currentTasks: Array.from(this.currentTasks),
      metrics: { ...this.metrics },
    };
  }

  /**
   * Get agent status
   */
  getStatus(): AgentStatus {
    return this.status;
  }

  /**
   * Get agent metrics
   */
  getMetrics(): AgentMetrics {
    return { ...this.metrics };
  }

  /**
   * Check if agent can handle a specific capability
   */
  hasCapability(name: string): boolean {
    return this.capabilities.some(c => c.name === name);
  }

  /**
   * Get capability by name
   */
  getCapability(name: string): AgentCapability | undefined {
    return this.capabilities.find(c => c.name === name);
  }

  /**
   * Update context
   */
  updateContext(updates: Partial<AgentContext>): void {
    this.context = {
      ...this.context,
      ...updates,
      artifacts: updates.artifacts || this.context.artifacts,
      history: updates.history || this.context.history,
      checkpoints: updates.checkpoints || this.context.checkpoints,
    };
  }

  /**
   * Shutdown the agent
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down agent');
    
    // Update status
    this.status = AgentStatus.OFFLINE;
    
    // Clear tasks
    this.currentTasks.clear();
    
    // Clear message queue
    this.messageQueue = [];
    
    // Emit shutdown event
    await this.emit(AgentEvent.STATUS_CHANGED, { status: AgentStatus.OFFLINE });
    
    this.logger.info('Agent shutdown complete');
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    return this.status !== AgentStatus.ERROR && this.status !== AgentStatus.OFFLINE;
  }
}