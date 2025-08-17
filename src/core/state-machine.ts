/**
 * State machine implementation using XState
 * Manages pipeline state transitions and orchestration flow
 */

import { createMachine, interpret } from 'xstate';
import { createLogger } from '../utils/logger';
import type { CheckpointData, CheckpointManager } from './checkpoint';
import { StateMachineError } from './errors';

/**
 * Pipeline states enum
 */
export enum PipelineState {
  IDLE = 'idle',
  INITIALIZING = 'initializing',
  BRAINSTORMING = 'brainstorming',
  MAPPING = 'mapping',
  ACTING = 'acting',
  DEBRIEFING = 'debriefing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PAUSED = 'paused',
  ROLLING_BACK = 'rolling_back',
}

/**
 * Pipeline events enum
 */
export enum PipelineEvent {
  START = 'START',
  NEXT_PHASE = 'NEXT_PHASE',
  PAUSE = 'PAUSE',
  RESUME = 'RESUME',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR',
  RETRY = 'RETRY',
  ROLLBACK = 'ROLLBACK',
  SKIP = 'SKIP',
  CANCEL = 'CANCEL',
}

/**
 * Machine context interface
 */
export interface PipelineMachineContext {
  pipelineId: string;
  objective: string;
  currentPhase: string;
  previousPhase?: string;
  progress: number;
  startTime: Date;
  results: Map<string, unknown>;
  errors: Error[];
  checkpoints: string[];
  retryCount: number;
  maxRetries: number;
  metadata: Record<string, unknown>;
}

/**
 * Event data interfaces
 */
export interface StartEventData {
  pipelineId: string;
  objective: string;
  metadata?: Record<string, unknown>;
}

export interface ErrorEventData {
  error: Error;
  phase: string;
  retryable: boolean;
}

export interface PhaseResultData {
  phase: string;
  result: unknown;
  duration: number;
}

/**
 * State machine configuration
 */
export interface StateMachineConfig {
  checkpointManager?: CheckpointManager;
  maxRetries?: number;
  enableCheckpoints?: boolean;
  enableLogging?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Pipeline state machine factory
 */
export function createPipelineMachine(config?: StateMachineConfig) {
  const logger = createLogger('state-machine');
  const checkpointManager = config?.checkpointManager;
  const maxRetries = config?.maxRetries || 3;

  return createMachine(
    {
      id: 'pipeline',
      initial: PipelineState.IDLE,

      context: {
        pipelineId: '',
        objective: '',
        currentPhase: PipelineState.IDLE,
        previousPhase: undefined,
        progress: 0,
        startTime: new Date(),
        results: new Map(),
        errors: [] as Error[],
        checkpoints: [] as string[],
        retryCount: 0,
        maxRetries,
        metadata: {},
      },

      states: {
        [PipelineState.IDLE]: {
          entry: ['logStateEntry'],
          on: {
            [PipelineEvent.START]: {
              target: PipelineState.INITIALIZING,
              actions: ['initializeContext', 'logTransition'],
            },
          },
        },

        [PipelineState.INITIALIZING]: {
          entry: ['logStateEntry', 'saveCheckpoint'],
          invoke: {
            id: 'initialize',
            src: 'initializeService',
            onDone: {
              target: PipelineState.BRAINSTORMING,
              actions: ['saveResult', 'updateProgress', 'logSuccess'],
            },
            onError: {
              target: PipelineState.FAILED,
              actions: ['logError', 'saveError'],
            },
          },
          on: {
            [PipelineEvent.PAUSE]: {
              target: PipelineState.PAUSED,
              actions: ['logPause'],
            },
            [PipelineEvent.CANCEL]: {
              target: PipelineState.FAILED,
              actions: ['logCancellation'],
            },
          },
        },

        [PipelineState.BRAINSTORMING]: {
          entry: ['logStateEntry', 'saveCheckpoint'],
          invoke: {
            id: 'brainstorm',
            src: 'brainstormService',
            onDone: {
              target: PipelineState.MAPPING,
              actions: ['saveResult', 'updateProgress', 'logSuccess'],
            },
            onError: [
              {
                guard: 'canRetry',
                actions: ['incrementRetry', 'logRetry'],
                target: PipelineState.BRAINSTORMING,
              },
              {
                target: PipelineState.FAILED,
                actions: ['logError', 'saveError'],
              },
            ],
          },
          on: {
            [PipelineEvent.PAUSE]: {
              target: PipelineState.PAUSED,
              actions: ['logPause'],
            },
            [PipelineEvent.SKIP]: {
              target: PipelineState.MAPPING,
              actions: ['logSkip'],
            },
            [PipelineEvent.CANCEL]: {
              target: PipelineState.FAILED,
              actions: ['logCancellation'],
            },
            [PipelineEvent.ERROR]: {
              target: PipelineState.FAILED,
              actions: ['logError', 'saveError'],
            },
          },
        },

        [PipelineState.MAPPING]: {
          entry: ['logStateEntry', 'saveCheckpoint'],
          invoke: {
            id: 'map',
            src: 'mappingService',
            onDone: {
              target: PipelineState.ACTING,
              actions: ['saveResult', 'updateProgress', 'logSuccess'],
            },
            onError: [
              {
                guard: 'canRetry',
                actions: ['incrementRetry', 'logRetry'],
                target: PipelineState.MAPPING,
              },
              {
                target: PipelineState.FAILED,
                actions: ['logError', 'saveError'],
              },
            ],
          },
          on: {
            [PipelineEvent.PAUSE]: {
              target: PipelineState.PAUSED,
              actions: ['logPause'],
            },
            [PipelineEvent.SKIP]: {
              target: PipelineState.ACTING,
              actions: ['logSkip'],
            },
            [PipelineEvent.CANCEL]: {
              target: PipelineState.FAILED,
              actions: ['logCancellation'],
            },
            [PipelineEvent.ROLLBACK]: {
              target: PipelineState.ROLLING_BACK,
              actions: ['logRollback'],
            },
          },
        },

        [PipelineState.ACTING]: {
          entry: ['logStateEntry', 'saveCheckpoint'],
          invoke: {
            id: 'act',
            src: 'actingService',
            onDone: {
              target: PipelineState.DEBRIEFING,
              actions: ['saveResult', 'updateProgress', 'logSuccess'],
            },
            onError: [
              {
                guard: 'canRetry',
                actions: ['incrementRetry', 'logRetry'],
                target: PipelineState.ACTING,
              },
              {
                target: PipelineState.ROLLING_BACK,
                actions: ['logError', 'saveError'],
              },
            ],
          },
          on: {
            [PipelineEvent.PAUSE]: {
              target: PipelineState.PAUSED,
              actions: ['logPause'],
            },
            [PipelineEvent.SKIP]: {
              target: PipelineState.DEBRIEFING,
              actions: ['logSkip'],
            },
            [PipelineEvent.CANCEL]: {
              target: PipelineState.FAILED,
              actions: ['logCancellation'],
            },
            [PipelineEvent.ROLLBACK]: {
              target: PipelineState.ROLLING_BACK,
              actions: ['logRollback'],
            },
          },
        },

        [PipelineState.DEBRIEFING]: {
          entry: ['logStateEntry', 'saveCheckpoint'],
          invoke: {
            id: 'debrief',
            src: 'debriefingService',
            onDone: {
              target: PipelineState.COMPLETED,
              actions: ['saveResult', 'updateProgress', 'logSuccess', 'notifyCompletion'],
            },
            onError: [
              {
                guard: 'canRetry',
                actions: ['incrementRetry', 'logRetry'],
                target: PipelineState.DEBRIEFING,
              },
              {
                target: PipelineState.FAILED,
                actions: ['logError', 'saveError'],
              },
            ],
          },
          on: {
            [PipelineEvent.PAUSE]: {
              target: PipelineState.PAUSED,
              actions: ['logPause'],
            },
            [PipelineEvent.COMPLETE]: {
              target: PipelineState.COMPLETED,
              actions: ['logCompletion'],
            },
            [PipelineEvent.CANCEL]: {
              target: PipelineState.FAILED,
              actions: ['logCancellation'],
            },
          },
        },

        [PipelineState.PAUSED]: {
          entry: ['logStateEntry', 'saveCheckpoint', 'savePausedState'],
          on: {
            [PipelineEvent.RESUME]: {
              target: 'history',
              actions: ['logResume', 'restorePausedState'],
            },
            [PipelineEvent.CANCEL]: {
              target: PipelineState.FAILED,
              actions: ['logCancellation'],
            },
          },
          type: 'history',
          history: 'shallow',
        },

        [PipelineState.ROLLING_BACK]: {
          entry: ['logStateEntry'],
          invoke: {
            id: 'rollback',
            src: 'rollbackService',
            onDone: [
              {
                guard: 'hasCheckpoint',
                target: PipelineState.MAPPING,
                actions: ['restoreCheckpoint', 'logRollbackSuccess'],
              },
              {
                target: PipelineState.FAILED,
                actions: ['logRollbackFailure'],
              },
            ],
            onError: {
              target: PipelineState.FAILED,
              actions: ['logError', 'saveError'],
            },
          },
        },

        [PipelineState.FAILED]: {
          entry: ['logStateEntry', 'saveCheckpoint', 'notifyFailure'],
          on: {
            [PipelineEvent.RETRY]: [
              {
                guard: 'canRetry',
                target: PipelineState.INITIALIZING,
                actions: ['resetRetryCount', 'logRetry'],
              },
              {
                actions: ['logMaxRetriesExceeded'],
              },
            ],
            [PipelineEvent.ROLLBACK]: {
              target: PipelineState.ROLLING_BACK,
              actions: ['logRollback'],
            },
          },
          type: 'final',
        },

        [PipelineState.COMPLETED]: {
          entry: ['logStateEntry', 'saveCheckpoint', 'cleanup', 'generateReport'],
          type: 'final',
        },
      },
    },
    {
      guards: {
        canRetry: ({ context }) => context.retryCount < context.maxRetries,
        hasCheckpoint: ({ context }) => context.checkpoints.length > 0,
      },

      actions: {
        // Initialization actions
        initializeContext: ({ context, event }) => {
          const startEvent = event as any;
          Object.assign(context, {
            pipelineId: startEvent.data?.pipelineId || '',
            objective: startEvent.data?.objective || '',
            startTime: new Date(),
            metadata: startEvent.data?.metadata || {},
          });
        },

        // Result management
        saveResult: ({ context, event }) => {
          const result = (event as any).data as PhaseResultData;
          context.results.set(result.phase, result.result);
        },

        saveError: ({ context, event }) => {
          const errorData = (event as any).data as ErrorEventData;
          context.errors.push(errorData.error);
        },

        // Progress tracking
        updateProgress: ({ context }) => {
          const phases = [
            PipelineState.INITIALIZING,
            PipelineState.BRAINSTORMING,
            PipelineState.MAPPING,
            PipelineState.ACTING,
            PipelineState.DEBRIEFING,
          ];

          const currentIndex = phases.indexOf(context.currentPhase as PipelineState);
          context.progress = ((currentIndex + 1) / phases.length) * 100;
        },

        // Retry management
        incrementRetry: ({ context }) => {
          context.retryCount++;
        },

        resetRetryCount: ({ context }) => {
          context.retryCount = 0;
        },

        // Checkpoint management
        saveCheckpoint: async ({ context }) => {
          if (!checkpointManager || !config?.enableCheckpoints) {
            return;
          }

          try {
            const checkpointData: CheckpointData = {
              id: '',
              pipelineId: context.pipelineId,
              timestamp: new Date(),
              version: '1.0.0',
              state: {
                phase: context.currentPhase,
                status: 'active',
                progress: context.progress,
                context: Object.fromEntries(context.results),
              },
              tasks: {
                completed: [],
                inProgress: [context.currentPhase],
                pending: [],
                failed: context.errors.map((e: Error) => e.message),
              },
              artifacts: Object.fromEntries(context.results),
              metrics: {
                startTime: context.startTime,
                duration: Date.now() - context.startTime.getTime(),
              },
              metadata: context.metadata,
            };

            const checkpointId = await checkpointManager.save(checkpointData);
            context.checkpoints.push(checkpointId);
            logger.info(`Checkpoint saved: ${checkpointId}`);
          } catch (error) {
            logger.error('Failed to save checkpoint', error);
          }
        },

        restoreCheckpoint: async ({ context }) => {
          if (!checkpointManager || context.checkpoints.length === 0) {
            return;
          }

          try {
            const lastCheckpoint = context.checkpoints[context.checkpoints.length - 1];
            if (lastCheckpoint) {
              const data = await checkpointManager.load(lastCheckpoint);

              // Restore context from checkpoint
              context.currentPhase = data.state.phase;
              context.progress = data.state.progress;
              context.results = new Map(Object.entries(data.state.context || {}));

              logger.info(`Restored from checkpoint: ${lastCheckpoint}`);
            }
          } catch (error) {
            logger.error('Failed to restore checkpoint', error);
          }
        },

        // State persistence for pause/resume
        savePausedState: ({ context }) => {
          context.previousPhase = context.currentPhase;
        },

        restorePausedState: ({ context }) => {
          if (context.previousPhase) {
            context.currentPhase = context.previousPhase;
          }
        },

        // Logging actions
        logStateEntry: ({ context }) => {
          if (config?.enableLogging) {
            logger.info(`Entering state`, {
              pipelineId: context.pipelineId,
              progress: context.progress,
            });
          }
        },

        logTransition: ({ context, event }) => {
          if (config?.enableLogging) {
            logger.debug(`Transition: ${event.type}`, {
              from: context.currentPhase,
            });
          }
        },

        logSuccess: ({ context }) => {
          if (config?.enableLogging) {
            logger.info(`Phase completed successfully: ${context.currentPhase}`);
          }
        },

        logError: ({ event }) => {
          const errorData = (event as any).data as ErrorEventData;
          logger.error(`Error in phase ${errorData.phase}`, errorData.error);
        },

        logRetry: ({ context }) => {
          logger.warn(`Retrying phase ${context.currentPhase}`, {
            attempt: context.retryCount,
            maxRetries: context.maxRetries,
          });
        },

        logMaxRetriesExceeded: ({ context }) => {
          logger.error(`Max retries exceeded for phase ${context.currentPhase}`);
        },

        logPause: ({ context }) => {
          logger.info(`Pipeline paused at phase ${context.currentPhase}`);
        },

        logResume: ({ context }) => {
          logger.info(`Pipeline resumed from phase ${context.currentPhase}`);
        },

        logSkip: ({ context }) => {
          logger.info(`Skipping phase ${context.currentPhase}`);
        },

        logRollback: ({ context }) => {
          logger.warn(`Rolling back from phase ${context.currentPhase}`);
        },

        logRollbackSuccess: () => {
          logger.info('Rollback completed successfully');
        },

        logRollbackFailure: () => {
          logger.error('Rollback failed');
        },

        logCancellation: ({ context }) => {
          logger.warn(`Pipeline cancelled at phase ${context.currentPhase}`);
        },

        logCompletion: ({ context }) => {
          const duration = Date.now() - context.startTime.getTime();
          logger.info(`Pipeline completed successfully`, {
            pipelineId: context.pipelineId,
            duration: `${(duration / 1000).toFixed(2)}s`,
            phases: context.results.size,
          });
        },

        // Notifications
        notifyCompletion: () => {
          // Emit completion event
          if (config?.enableLogging) {
            logger.info('Pipeline completed, sending notification');
          }
        },

        notifyFailure: ({ context }) => {
          // Emit failure event
          const lastError = context.errors[context.errors.length - 1];
          logger.error('Pipeline failed, sending notification', {
            errors: context.errors.length,
            lastError: lastError?.message,
          });
        },

        // Cleanup
        cleanup: () => {
          logger.info('Performing cleanup');
          // Clean up resources, temporary files, etc.
        },

        generateReport: () => {
          logger.info('Generating final report');
          // Generate execution report
        },
      },
    },
  );
}

/**
 * Pipeline state machine class wrapper
 */
export class PipelineStateMachine {
  private machine: any;
  private interpreter?: any;
  private logger;
  private config: StateMachineConfig;

  constructor(config?: StateMachineConfig) {
    this.config = {
      maxRetries: 3,
      enableCheckpoints: true,
      enableLogging: true,
      logLevel: 'info',
      ...config,
    };

    this.machine = createPipelineMachine(this.config);
    this.logger = createLogger('pipeline-state-machine');
  }

  /**
   * Start the state machine
   */
  start(): void {
    if (this.interpreter) {
      throw new StateMachineError(
        'State machine is already running',
        PipelineState.IDLE,
        undefined,
        PipelineEvent.START,
      );
    }

    this.interpreter = interpret(this.machine);

    // Add state change listener
    this.interpreter.onTransition((state: any) => {
      this.logger.debug(`State transition`, {
        state: state.value,
        context: state.context,
      });
    });

    this.interpreter.start();
    this.logger.info('State machine started');
  }

  /**
   * Stop the state machine
   */
  stop(): void {
    if (!this.interpreter) {
      return;
    }

    this.interpreter.stop();
    this.interpreter = undefined;
    this.logger.info('State machine stopped');
  }

  /**
   * Send an event to the state machine
   */
  send(event: PipelineEvent | string, data?: unknown): void {
    if (!this.interpreter) {
      throw new StateMachineError('State machine is not running', PipelineState.IDLE, undefined, event as string);
    }

    this.interpreter.send({ type: event, data });
  }

  /**
   * Get current state
   */
  getState(): any {
    return this.interpreter?.state;
  }

  /**
   * Get current state value
   */
  getCurrentStateValue(): string | undefined {
    return this.interpreter?.state?.value as string;
  }

  /**
   * Get state context
   */
  getContext(): PipelineMachineContext | undefined {
    return this.interpreter?.state?.context;
  }

  /**
   * Check if machine is in a specific state
   */
  isInState(state: PipelineState): boolean {
    return this.interpreter?.state?.matches(state) || false;
  }

  /**
   * Check if machine can transition with event
   */
  canTransition(event: PipelineEvent): boolean {
    if (!this.interpreter) {
      return false;
    }

    const nextState = this.machine.transition(this.interpreter.state, { type: event });

    return nextState.changed || false;
  }

  /**
   * Wait for a specific state
   */
  async waitForState(targetState: PipelineState, timeout?: number): Promise<void> {
    if (!this.interpreter) {
      throw new StateMachineError('State machine is not running', PipelineState.IDLE, targetState);
    }

    return new Promise((resolve, reject) => {
      const timeoutId = timeout
        ? setTimeout(() => {
            reject(
              new StateMachineError(
                `Timeout waiting for state ${targetState}`,
                this.getCurrentStateValue(),
                targetState,
              ),
            );
          }, timeout)
        : undefined;

      const listener = this.interpreter!.onTransition((state: any) => {
        if (state.matches(targetState)) {
          if (timeoutId) clearTimeout(timeoutId);
          listener.unsubscribe();
          resolve();
        }
      });
    });
  }

  /**
   * Subscribe to state changes
   */
  onStateChange(callback: (state: any) => void): () => void {
    if (!this.interpreter) {
      throw new StateMachineError('State machine is not running', PipelineState.IDLE);
    }

    const subscription = this.interpreter.subscribe(callback);
    return () => subscription.unsubscribe();
  }

  /**
   * Get machine visualization (for debugging)
   */
  getVisualization(): string {
    // This would generate a visual representation of the state machine
    // For now, return a simple text representation
    return `
    State Machine: Pipeline
    Current State: ${this.getCurrentStateValue() || 'Not Started'}
    States: ${Object.values(PipelineState).join(', ')}
    Events: ${Object.values(PipelineEvent).join(', ')}
    `;
  }
}

/**
 * Service implementations for state machine
 * These would be actual implementations in production
 */
export const pipelineServices = {
  initializeService: async () => {
    // Initialize pipeline resources
    return { phase: 'initialize', result: 'initialized', duration: 100 };
  },

  brainstormService: async () => {
    // Brainstorming phase implementation
    return { phase: 'brainstorm', result: 'ideas generated', duration: 200 };
  },

  mappingService: async () => {
    // Mapping phase implementation
    return { phase: 'map', result: 'tasks mapped', duration: 150 };
  },

  actingService: async () => {
    // Acting phase implementation
    return { phase: 'act', result: 'actions executed', duration: 500 };
  },

  debriefingService: async () => {
    // Debriefing phase implementation
    return { phase: 'debrief', result: 'results analyzed', duration: 100 };
  },

  rollbackService: async () => {
    // Rollback implementation
    return { phase: 'rollback', result: 'rolled back', duration: 50 };
  },
};

/**
 * Export default instance factory
 */
export function createStateMachine(config?: StateMachineConfig): PipelineStateMachine {
  return new PipelineStateMachine(config);
}
