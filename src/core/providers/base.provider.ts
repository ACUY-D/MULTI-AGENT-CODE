/**
 * Base provider class for external service integration
 * Implements common patterns like retry logic, circuit breaker, and health checks
 */

import { createLogger } from '../../utils/logger';
import { MaxRetriesExceededError, NetworkError, ProviderError, TimeoutError } from '../errors';

/**
 * Provider configuration interface
 */
export interface ProviderConfig {
  name: string;
  endpoint?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  backoffMultiplier?: number;
  maxBackoff?: number;
  circuitBreakerThreshold?: number;
  circuitBreakerResetTimeout?: number;
  enableJitter?: boolean;
  headers?: Record<string, string>;
}

/**
 * Health status interface
 */
export interface HealthStatus {
  healthy: boolean;
  message: string;
  timestamp: Date;
  latency?: number;
  details?: Record<string, unknown>;
}

/**
 * Provider metrics interface
 */
export interface ProviderMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  lastRequestTime?: Date;
  uptime: number;
  circuitBreakerState: CircuitState;
}

/**
 * Retry context interface
 */
export interface RetryContext {
  attempt: number;
  maxAttempts: number;
  delay: number;
  error?: Error;
  operation: string;
}

/**
 * Circuit breaker states
 */
export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

/**
 * Circuit breaker implementation
 */
class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime?: Date;
  private successCount = 0;

  constructor(
    private threshold = 5,
    private resetTimeout = 60000, // 1 minute
  ) {}

  /**
   * Check if requests are allowed
   */
  isOpen(): boolean {
    if (this.state === CircuitState.OPEN) {
      // Check if we should transition to half-open
      if (this.lastFailureTime) {
        const timeSinceLastFailure = Date.now() - this.lastFailureTime.getTime();
        if (timeSinceLastFailure > this.resetTimeout) {
          this.state = CircuitState.HALF_OPEN;
          return false;
        }
      }
      return true;
    }
    return false;
  }

  /**
   * Record a successful request
   */
  recordSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      // After successful requests in half-open, close the circuit
      if (this.successCount >= 3) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
      }
    }
  }

  /**
   * Record a failed request
   */
  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();
    this.successCount = 0;

    if (this.failureCount >= this.threshold) {
      this.state = CircuitState.OPEN;
    }

    if (this.state === CircuitState.HALF_OPEN) {
      // Immediately open on failure in half-open state
      this.state = CircuitState.OPEN;
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Reset the circuit breaker
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
  }
}

/**
 * Abstract base provider class
 */
export abstract class BaseProvider {
  protected config: ProviderConfig;
  protected logger;
  protected connected = false;
  protected circuitBreaker: CircuitBreaker;
  protected metrics: ProviderMetrics;
  protected startTime: Date;
  private latencies: number[] = [];

  constructor(config: ProviderConfig) {
    this.config = {
      timeout: 30000, // 30 seconds default
      maxRetries: 3,
      retryDelay: 1000,
      backoffMultiplier: 2,
      maxBackoff: 30000,
      circuitBreakerThreshold: 5,
      circuitBreakerResetTimeout: 60000,
      enableJitter: true,
      ...config,
    };

    this.logger = createLogger(`provider:${this.config.name}`);
    this.circuitBreaker = new CircuitBreaker(
      this.config.circuitBreakerThreshold,
      this.config.circuitBreakerResetTimeout,
    );

    this.startTime = new Date();
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
      uptime: 0,
      circuitBreakerState: CircuitState.CLOSED,
    };
  }

  /**
   * Connect to the provider service
   */
  abstract connect(): Promise<void>;

  /**
   * Disconnect from the provider service
   */
  abstract disconnect(): Promise<void>;

  /**
   * Check if the provider is healthy
   */
  abstract isHealthy(): Promise<boolean>;

  /**
   * Execute an operation with retry logic and circuit breaker
   */
  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    customRetryConfig?: Partial<RetryContext>,
  ): Promise<T> {
    // Check circuit breaker
    if (this.circuitBreaker.isOpen()) {
      throw new ProviderError(
        `Circuit breaker is open for provider ${this.config.name}`,
        this.config.name,
        operationName,
        false,
      );
    }

    const maxAttempts = customRetryConfig?.maxAttempts || this.config.maxRetries || 3;
    let lastError: Error | undefined;
    let delay = customRetryConfig?.delay || this.config.retryDelay || 1000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.logger.debug(`Executing operation ${operationName}, attempt ${attempt}/${maxAttempts}`);

        // Record start time for metrics
        const startTime = Date.now();

        // Execute with timeout
        const result = await this.executeWithTimeout(operation, operationName);

        // Record success metrics
        const latency = Date.now() - startTime;
        this.recordMetrics(true, latency);
        this.circuitBreaker.recordSuccess();

        // Log success if retried
        if (attempt > 1) {
          this.logger.info(`Operation ${operationName} succeeded after ${attempt} attempts`);
        }

        return result;
      } catch (error) {
        lastError = error as Error;

        // Record failure metrics
        this.recordMetrics(false, 0);
        this.circuitBreaker.recordFailure();

        // Check if error is retryable
        if (!this.isRetryableError(lastError)) {
          this.logger.error(`Non-retryable error in operation ${operationName}`, lastError);
          throw lastError;
        }

        // Check if max attempts reached
        if (attempt >= maxAttempts) {
          throw new MaxRetriesExceededError(lastError, attempt, maxAttempts, {
            operation: operationName,
            provider: this.config.name,
          });
        }

        // Log retry attempt
        this.logger.warn(`Operation ${operationName} failed on attempt ${attempt}, retrying in ${delay}ms`, {
          error: lastError.message,
        });

        // Wait before retry
        await this.sleep(delay);

        // Calculate next delay with exponential backoff
        delay = Math.min(delay * (this.config.backoffMultiplier || 2), this.config.maxBackoff || 30000);

        // Add jitter if enabled
        if (this.config.enableJitter) {
          delay = this.addJitter(delay);
        }
      }
    }

    // This should not be reached, but TypeScript needs it
    throw lastError || new Error(`Operation ${operationName} failed after ${maxAttempts} attempts`);
  }

  /**
   * Execute operation with timeout
   */
  protected async executeWithTimeout<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    const timeout = this.config.timeout || 30000;

    return Promise.race([
      operation(),
      new Promise<T>((_, reject) => {
        setTimeout(() => {
          reject(
            new TimeoutError(`Operation ${operationName} timed out after ${timeout}ms`, timeout, operationName, true, {
              provider: this.config.name,
            }),
          );
        }, timeout);
      }),
    ]);
  }

  /**
   * Check if an error is retryable
   */
  protected isRetryableError(error: Error): boolean {
    // Network errors are usually retryable
    if (error instanceof NetworkError || error instanceof TimeoutError) {
      return true;
    }

    // Provider errors might be retryable
    if (error instanceof ProviderError) {
      return error.retryable;
    }

    // Check error message for common retryable patterns
    const retryablePatterns = [
      /network/i,
      /timeout/i,
      /connection/i,
      /econnrefused/i,
      /enotfound/i,
      /etimedout/i,
      /socket hang up/i,
      /service unavailable/i,
      /too many requests/i,
      /rate limit/i,
    ];

    return retryablePatterns.some((pattern) => pattern.test(error.message));
  }

  /**
   * Add jitter to delay
   */
  protected addJitter(delay: number): number {
    // Add random jitter between 0% and 50% of the delay
    return delay * (1 + Math.random() * 0.5);
  }

  /**
   * Sleep for specified milliseconds
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Record metrics for operations
   */
  protected recordMetrics(success: boolean, latency: number): void {
    this.metrics.totalRequests++;

    if (success) {
      this.metrics.successfulRequests++;
      this.latencies.push(latency);

      // Keep only last 100 latencies for average calculation
      if (this.latencies.length > 100) {
        this.latencies.shift();
      }

      // Calculate average latency
      this.metrics.averageLatency = this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length;
    } else {
      this.metrics.failedRequests++;
    }

    this.metrics.lastRequestTime = new Date();
    this.metrics.uptime = Date.now() - this.startTime.getTime();
    this.metrics.circuitBreakerState = this.circuitBreaker.getState();
  }

  /**
   * Get current metrics
   */
  public getMetrics(): ProviderMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
      uptime: Date.now() - this.startTime.getTime(),
      circuitBreakerState: this.circuitBreaker.getState(),
    };
    this.latencies = [];
  }

  /**
   * Get health status
   */
  public async getHealthStatus(): Promise<HealthStatus> {
    const startTime = Date.now();

    try {
      const healthy = await this.isHealthy();
      const latency = Date.now() - startTime;

      return {
        healthy,
        message: healthy ? 'Provider is healthy' : 'Provider is unhealthy',
        timestamp: new Date(),
        latency,
        details: {
          provider: this.config.name,
          connected: this.connected,
          circuitBreakerState: this.circuitBreaker.getState(),
          metrics: this.getMetrics(),
        },
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Health check failed: ${(error as Error).message}`,
        timestamp: new Date(),
        latency: Date.now() - startTime,
        details: {
          provider: this.config.name,
          error: (error as Error).message,
        },
      };
    }
  }

  /**
   * Reset circuit breaker
   */
  public resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
    this.logger.info(`Circuit breaker reset for provider ${this.config.name}`);
  }

  /**
   * Check if provider is connected
   */
  public isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get provider name
   */
  public getName(): string {
    return this.config.name;
  }

  /**
   * Get provider configuration
   */
  public getConfig(): ProviderConfig {
    return { ...this.config };
  }
}

/**
 * Example concrete provider implementation
 */
export class HttpProvider extends BaseProvider {
  private baseUrl: string;

  constructor(config: ProviderConfig & { baseUrl: string }) {
    super(config);
    this.baseUrl = config.baseUrl;
  }

  async connect(): Promise<void> {
    try {
      this.logger.info(`Connecting to HTTP provider at ${this.baseUrl}`);

      // Verify connection with a health check
      const healthy = await this.isHealthy();
      if (!healthy) {
        throw new ProviderError(`Failed to connect to provider ${this.config.name}`, this.config.name, 'connect', true);
      }

      this.connected = true;
      this.logger.info(`Successfully connected to provider ${this.config.name}`);
    } catch (error) {
      this.connected = false;
      throw new ProviderError(`Connection failed: ${(error as Error).message}`, this.config.name, 'connect', true, {
        baseUrl: this.baseUrl,
      });
    }
  }

  async disconnect(): Promise<void> {
    this.logger.info(`Disconnecting from provider ${this.config.name}`);
    this.connected = false;
    this.resetCircuitBreaker();
  }

  async isHealthy(): Promise<boolean> {
    try {
      // Simple health check - could be a ping endpoint
      const response = await this.executeWithTimeout(async () => {
        // Simulated health check - replace with actual HTTP request
        await this.sleep(100);
        return { status: 200 };
      }, 'health-check');

      return response.status === 200;
    } catch (error) {
      this.logger.error(`Health check failed for provider ${this.config.name}`, error);
      return false;
    }
  }

  /**
   * Make an HTTP request with retry logic
   */
  async request<T>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      headers?: Record<string, string>;
      timeout?: number;
    },
  ): Promise<T> {
    if (!this.connected) {
      throw new ProviderError(`Provider ${this.config.name} is not connected`, this.config.name, 'request', false);
    }

    return this.executeWithRetry(async () => {
      // Simulated HTTP request - replace with actual implementation
      const url = `${this.baseUrl}${path}`;
      this.logger.debug(`Making ${method} request to ${url}`);

      // Here you would make the actual HTTP request
      // For now, returning mock data
      await this.sleep(100);
      return {} as T;
    }, `${method} ${path}`);
  }
}
