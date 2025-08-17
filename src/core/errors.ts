/**
 * Custom error hierarchy for the orchestrator system
 * Provides specialized error types for different failure scenarios
 */

/**
 * Base error class for all orchestrator errors
 */
export class OrchestratorError extends Error {
  public readonly code: string;
  public readonly timestamp: Date;
  public readonly context?: Record<string, unknown>;
  public readonly retryable: boolean;

  constructor(message: string, code = 'ORCHESTRATOR_ERROR', retryable = false, context?: Record<string, unknown>) {
    super(message);
    this.name = 'OrchestratorError';
    this.code = code;
    this.timestamp = new Date();
    this.retryable = retryable;
    this.context = context;

    // Maintain proper stack trace for V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON representation
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      timestamp: this.timestamp.toISOString(),
      retryable: this.retryable,
      context: this.context,
      stack: this.stack,
    };
  }
}

/**
 * Pipeline-related errors
 */
export class PipelineError extends OrchestratorError {
  constructor(
    message: string,
    public readonly pipelineId?: string,
    public readonly stage?: string,
    retryable = false,
    context?: Record<string, unknown>,
  ) {
    super(message, 'PIPELINE_ERROR', retryable, {
      ...context,
      pipelineId,
      stage,
    });
    this.name = 'PipelineError';
  }
}

/**
 * Agent-related errors
 */
export class AgentError extends OrchestratorError {
  constructor(
    message: string,
    public readonly agentType: string,
    public readonly agentId?: string,
    public readonly taskId?: string,
    retryable = false,
    context?: Record<string, unknown>,
  ) {
    super(message, 'AGENT_ERROR', retryable, {
      ...context,
      agentType,
      agentId,
      taskId,
    });
    this.name = 'AgentError';
  }
}

/**
 * Checkpoint-related errors
 */
export class CheckpointError extends OrchestratorError {
  constructor(
    message: string,
    public readonly checkpointId?: string,
    public readonly operation?: 'save' | 'load' | 'delete' | 'rotate',
    retryable = true,
    context?: Record<string, unknown>,
  ) {
    super(message, 'CHECKPOINT_ERROR', retryable, {
      ...context,
      checkpointId,
      operation,
    });
    this.name = 'CheckpointError';
  }
}

/**
 * State machine errors
 */
export class StateMachineError extends OrchestratorError {
  constructor(
    message: string,
    public readonly currentState?: string,
    public readonly targetState?: string,
    public readonly event?: string,
    retryable = false,
    context?: Record<string, unknown>,
  ) {
    super(message, 'STATE_MACHINE_ERROR', retryable, {
      ...context,
      currentState,
      targetState,
      event,
    });
    this.name = 'StateMachineError';
  }
}

/**
 * Provider/Adapter errors
 */
export class ProviderError extends OrchestratorError {
  constructor(
    message: string,
    public readonly providerName: string,
    public readonly operation?: string,
    retryable = true,
    context?: Record<string, unknown>,
  ) {
    super(message, 'PROVIDER_ERROR', retryable, {
      ...context,
      providerName,
      operation,
    });
    this.name = 'ProviderError';
  }
}

/**
 * Validation errors
 */
export class ValidationError extends OrchestratorError {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: unknown,
    public readonly validationRule?: string,
    context?: Record<string, unknown>,
  ) {
    super(message, 'VALIDATION_ERROR', false, {
      ...context,
      field,
      value,
      validationRule,
    });
    this.name = 'ValidationError';
  }
}

/**
 * Timeout errors
 */
export class TimeoutError extends OrchestratorError {
  constructor(
    message: string,
    public readonly timeout: number,
    public readonly operation?: string,
    retryable = true,
    context?: Record<string, unknown>,
  ) {
    super(message, 'TIMEOUT_ERROR', retryable, {
      ...context,
      timeout,
      operation,
    });
    this.name = 'TimeoutError';
  }
}

/**
 * Resource errors (memory, disk, etc.)
 */
export class ResourceError extends OrchestratorError {
  constructor(
    message: string,
    public readonly resourceType: 'memory' | 'disk' | 'cpu' | 'network' | 'other',
    public readonly required?: number,
    public readonly available?: number,
    retryable = true,
    context?: Record<string, unknown>,
  ) {
    super(message, 'RESOURCE_ERROR', retryable, {
      ...context,
      resourceType,
      required,
      available,
    });
    this.name = 'ResourceError';
  }
}

/**
 * Configuration errors
 */
export class ConfigurationError extends OrchestratorError {
  constructor(
    message: string,
    public readonly configKey?: string,
    public readonly expectedType?: string,
    public readonly actualValue?: unknown,
    context?: Record<string, unknown>,
  ) {
    super(message, 'CONFIGURATION_ERROR', false, {
      ...context,
      configKey,
      expectedType,
      actualValue,
    });
    this.name = 'ConfigurationError';
  }
}

/**
 * Network/Communication errors
 */
export class NetworkError extends OrchestratorError {
  constructor(
    message: string,
    public readonly endpoint?: string,
    public readonly statusCode?: number,
    retryable = true,
    context?: Record<string, unknown>,
  ) {
    super(message, 'NETWORK_ERROR', retryable, {
      ...context,
      endpoint,
      statusCode,
    });
    this.name = 'NetworkError';
  }
}

/**
 * Maximum retries exceeded error
 */
export class MaxRetriesExceededError extends OrchestratorError {
  constructor(
    public readonly originalError: Error,
    public readonly attempts: number,
    public readonly maxRetries: number,
    context?: Record<string, unknown>,
  ) {
    super(
      `Maximum retries (${maxRetries}) exceeded after ${attempts} attempts: ${originalError.message}`,
      'MAX_RETRIES_EXCEEDED',
      false,
      {
        ...context,
        attempts,
        maxRetries,
        originalError: originalError.message,
      },
    );
    this.name = 'MaxRetriesExceededError';
  }
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Error categories for classification
 */
export enum ErrorCategory {
  TRANSIENT = 'transient',
  RECOVERABLE = 'recoverable',
  FATAL = 'fatal',
  UNKNOWN = 'unknown',
}

/**
 * Error classification interface
 */
export interface ErrorClassification {
  severity: ErrorSeverity;
  category: ErrorCategory;
  retryable: boolean;
  requiresIntervention: boolean;
}

/**
 * Error classifier utility
 */
export class ErrorClassifier {
  /**
   * Classify an error based on its type and properties
   */
  static classify(error: Error): ErrorClassification {
    // Network errors - usually transient
    if (error instanceof NetworkError) {
      return {
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.TRANSIENT,
        retryable: true,
        requiresIntervention: false,
      };
    }

    // Resource errors - may be recoverable
    if (error instanceof ResourceError) {
      return {
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.RECOVERABLE,
        retryable: error.retryable,
        requiresIntervention: error.resourceType === 'disk' || error.resourceType === 'memory',
      };
    }

    // Validation errors - usually fatal
    if (error instanceof ValidationError) {
      return {
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.FATAL,
        retryable: false,
        requiresIntervention: true,
      };
    }

    // Configuration errors - fatal
    if (error instanceof ConfigurationError) {
      return {
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.FATAL,
        retryable: false,
        requiresIntervention: true,
      };
    }

    // State machine errors - depends on context
    if (error instanceof StateMachineError) {
      return {
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.RECOVERABLE,
        retryable: error.retryable,
        requiresIntervention: false,
      };
    }

    // Timeout errors - usually retryable
    if (error instanceof TimeoutError) {
      return {
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.TRANSIENT,
        retryable: true,
        requiresIntervention: false,
      };
    }

    // Max retries exceeded - requires intervention
    if (error instanceof MaxRetriesExceededError) {
      return {
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.FATAL,
        retryable: false,
        requiresIntervention: true,
      };
    }

    // Orchestrator base error
    if (error instanceof OrchestratorError) {
      return {
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.UNKNOWN,
        retryable: error.retryable,
        requiresIntervention: false,
      };
    }

    // Default classification for unknown errors
    return {
      severity: ErrorSeverity.MEDIUM,
      category: ErrorCategory.UNKNOWN,
      retryable: true,
      requiresIntervention: false,
    };
  }

  /**
   * Determine if an error is network-related
   */
  static isNetworkError(error: Error): boolean {
    return (
      error instanceof NetworkError ||
      error.message.toLowerCase().includes('network') ||
      error.message.toLowerCase().includes('fetch') ||
      error.message.toLowerCase().includes('connection') ||
      error.message.toLowerCase().includes('econnrefused')
    );
  }

  /**
   * Determine if an error is resource-related
   */
  static isResourceError(error: Error): boolean {
    return (
      error instanceof ResourceError ||
      error.message.toLowerCase().includes('memory') ||
      error.message.toLowerCase().includes('disk') ||
      error.message.toLowerCase().includes('enospc') ||
      error.message.toLowerCase().includes('enomem')
    );
  }

  /**
   * Determine if an error is a logic/validation error
   */
  static isLogicError(error: Error): boolean {
    return (
      error instanceof ValidationError ||
      error instanceof ConfigurationError ||
      error instanceof TypeError ||
      error instanceof ReferenceError ||
      error instanceof SyntaxError
    );
  }
}

/**
 * Error recovery strategies
 */
export enum RecoveryStrategy {
  RETRY = 'retry',
  ROLLBACK = 'rollback',
  SKIP = 'skip',
  ESCALATE = 'escalate',
  ABORT = 'abort',
}

/**
 * Error handler interface
 */
export interface ErrorHandler {
  handle(error: Error, context?: Record<string, unknown>): Promise<RecoveryStrategy>;
  canHandle(error: Error): boolean;
}

/**
 * Default error handler implementation
 */
export class DefaultErrorHandler implements ErrorHandler {
  async handle(error: Error, context?: Record<string, unknown>): Promise<RecoveryStrategy> {
    const classification = ErrorClassifier.classify(error);

    // Critical errors require abort
    if (classification.severity === ErrorSeverity.CRITICAL) {
      return RecoveryStrategy.ABORT;
    }

    // Fatal errors require escalation
    if (classification.category === ErrorCategory.FATAL) {
      return RecoveryStrategy.ESCALATE;
    }

    // Retryable errors
    if (classification.retryable) {
      return RecoveryStrategy.RETRY;
    }

    // Recoverable errors might need rollback
    if (classification.category === ErrorCategory.RECOVERABLE) {
      return RecoveryStrategy.ROLLBACK;
    }

    // Default to skip for unknown errors
    return RecoveryStrategy.SKIP;
  }

  canHandle(error: Error): boolean {
    return true; // Default handler can handle any error
  }
}
