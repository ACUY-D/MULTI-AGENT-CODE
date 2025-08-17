/**
 * Main Orchestrator for BMAD (Build, Measure, Analyze, Deploy) pipeline
 * Coordinates all agents and manages the complete development workflow
 */

import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { createLogger } from '../utils/logger';
import { type CheckpointData, CheckpointManager } from './checkpoint';
import { DefaultErrorHandler, ErrorClassifier, OrchestratorError, PipelineError, RecoveryStrategy } from './errors';
import {
  ExecutionMode,
  type PipelineConfig,
  type PipelineManager,
  TaskPriority,
  createPipelineManager,
} from './pipeline';
import { PipelineEvent, type PipelineStateMachine, createStateMachine } from './state-machine';

/**
 * Execution mode for the orchestrator
 */
export enum OrchestratorMode {
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PRODUCTION = 'production',
}

/**
 * BMAD Phase enum
 */
export enum BMADPhase {
  BUILD = 'build',
  MEASURE = 'measure',
  ANALYZE = 'analyze',
  DEPLOY = 'deploy',
}

/**
 * Orchestrator configuration schema
 */
export const OrchestratorConfigSchema = z.object({
  workDir: z.string().default('.'),
  mode: z.nativeEnum(ExecutionMode).default(ExecutionMode.AUTO),
  environment: z.nativeEnum(OrchestratorMode).default(OrchestratorMode.DEVELOPMENT),
  githubToken: z.string().optional(),
  maxRetries: z.number().int().min(0).max(10).default(3),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  pipeline: z
    .object({
      maxConcurrentTasks: z.number().int().positive().default(5),
      taskTimeout: z.number().int().positive().default(300000), // 5 minutes
      autoApprove: z.boolean().default(false),
    })
    .optional(),

  bmad: z
    .object({
      skipPhases: z.array(z.nativeEnum(BMADPhase)).optional(),
      measurementThreshold: z.number().min(0).max(100).default(80),
      deploymentScore: z.number().min(0).max(100).default(70),
      analysisDepth: z.enum(['shallow', 'normal', 'deep']).default('normal'),
    })
    .optional(),

  agents: z
    .array(
      z.object({
        type: z.enum(['architect', 'developer', 'tester', 'debugger']),
        enabled: z.boolean().default(true),
        capabilities: z.array(z.string()).default([]),
      }),
    )
    .optional(),

  checkpointing: z
    .object({
      enabled: z.boolean().default(true),
      interval: z.number().int().positive().default(60000), // 1 minute
      maxCheckpoints: z.number().int().positive().default(10),
    })
    .optional(),

  telemetry: z
    .object({
      enabled: z.boolean().default(true),
      endpoint: z.string().url().optional(),
      sampleRate: z.number().min(0).max(1).default(1),
    })
    .optional(),
});

export type OrchestratorConfig = z.infer<typeof OrchestratorConfigSchema>;

/**
 * Build result interface
 */
interface BuildResult {
  artifacts: Map<string, unknown>;
  metadata: {
    duration: number;
    timestamp: Date;
    version: string;
  };
  plan?: string;
  architecture?: string;
  code?: Map<string, string>;
  tests?: Map<string, TestResult>;
}

/**
 * Test result interface
 */
interface TestResult {
  passed: boolean;
  coverage: number;
  duration: number;
  errors?: string[];
}

/**
 * Metrics interface
 */
interface Metrics {
  performance: {
    responseTime: number;
    throughput: number;
    cpu: number;
    memory: number;
  };
  quality: {
    coverage: number;
    complexity: number;
    maintainability: number;
    reliability: number;
  };
  business: {
    completeness: number;
    correctness: number;
    efficiency: number;
  };
}

/**
 * Analysis interface
 */
interface Analysis {
  insights: Insight[];
  recommendations: string[];
  score: number;
  risks: Risk[];
}

interface Insight {
  type: 'performance' | 'quality' | 'security' | 'architecture';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details?: unknown;
}

interface Risk {
  area: string;
  probability: number;
  impact: number;
  mitigation: string;
}

/**
 * Deployment result interface
 */
interface DeploymentResult {
  success: boolean;
  environment: string;
  url?: string;
  version: string;
  rollbackPlan?: string;
}

/**
 * BMAD Result interface
 */
export interface BMADResult {
  success: boolean;
  phases: {
    build?: BuildResult;
    measure?: Metrics;
    analyze?: Analysis;
    deploy?: DeploymentResult;
  };
  errors?: Error[];
  duration: number;
  checkpoints: string[];
}

/**
 * Main Orchestrator class
 */
export class Orchestrator {
  private config: OrchestratorConfig;
  private logger;
  private pipelineManager?: PipelineManager;
  private stateMachine?: PipelineStateMachine;
  private checkpointManager?: CheckpointManager;
  private errorHandler: DefaultErrorHandler;
  private currentPhase: BMADPhase | null = null;
  private results: Map<BMADPhase, unknown>;
  private startTime?: Date;
  private abortController?: AbortController;

  constructor(config: OrchestratorConfig) {
    // Validate and set configuration
    this.config = OrchestratorConfigSchema.parse(config);
    this.logger = createLogger('orchestrator');
    this.errorHandler = new DefaultErrorHandler();
    this.results = new Map();

    // Initialize checkpoint manager if enabled
    if (this.config.checkpointing?.enabled) {
      this.checkpointManager = new CheckpointManager({
        baseDir: `${this.config.workDir}/.kilo`,
        maxCheckpoints: this.config.checkpointing.maxCheckpoints,
        compressionEnabled: true,
      });
    }

    this.logger.info('Orchestrator initialized', {
      mode: this.config.mode,
      environment: this.config.environment,
      workDir: this.config.workDir,
    });
  }

  /**
   * Initialize orchestrator
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing orchestrator components');

      // Initialize checkpoint manager
      if (this.checkpointManager) {
        await this.checkpointManager.initialize();
      }

      // Create state machine
      this.stateMachine = createStateMachine({
        checkpointManager: this.checkpointManager,
        maxRetries: this.config.maxRetries,
        enableCheckpoints: this.config.checkpointing?.enabled,
        enableLogging: true,
        logLevel: this.config.logLevel,
      });

      // Create pipeline configuration
      const pipelineConfig: PipelineConfig = {
        objective: '', // Will be set when running
        mode: this.config.mode,
        maxIterations: 10,
        maxConcurrentTasks: this.config.pipeline?.maxConcurrentTasks || 5,
        taskTimeout: this.config.pipeline?.taskTimeout || 300000,
        agents: this.createAgentConfigs(),
        checkpointStrategy: {
          enabled: this.config.checkpointing?.enabled || true,
          interval: this.config.checkpointing?.interval || 60000,
          onPhaseComplete: true,
          onError: true,
        },
        errorHandling: {
          continueOnError: false,
          maxErrors: 5,
          rollbackOnCriticalError: true,
        },
      };

      // Create pipeline manager
      this.pipelineManager = createPipelineManager(pipelineConfig);

      this.logger.info('Orchestrator initialization complete');
    } catch (error) {
      throw new OrchestratorError(
        `Failed to initialize orchestrator: ${(error as Error).message}`,
        'INIT_ERROR',
        false,
        { config: this.config },
      );
    }
  }

  /**
   * Run the complete BMAD pipeline
   */
  async run(objective: string): Promise<BMADResult> {
    this.logger.info(`Starting BMAD pipeline for: ${objective}`);
    this.startTime = new Date();
    this.abortController = new AbortController();

    try {
      // Start state machine
      this.stateMachine?.start();
      this.stateMachine?.send(PipelineEvent.START, {
        pipelineId: uuidv4(),
        objective,
      });

      // Execute BMAD phases
      const buildResult = await this.build(objective);
      await this.checkpoint('build-complete', buildResult);

      const metrics = await this.measure(buildResult);
      await this.checkpoint('measure-complete', metrics);

      const analysis = await this.analyze(metrics);
      await this.checkpoint('analyze-complete', analysis);

      const deployment = await this.deploy(buildResult, analysis);
      await this.checkpoint('deploy-complete', deployment);

      // Complete pipeline
      this.stateMachine?.send(PipelineEvent.COMPLETE);

      const duration = Date.now() - this.startTime.getTime();
      const checkpoints = await this.getCheckpointIds();

      this.logger.info('BMAD pipeline completed successfully', {
        objective,
        duration: `${(duration / 1000).toFixed(2)}s`,
        checkpoints: checkpoints.length,
      });

      return {
        success: true,
        phases: {
          build: buildResult,
          measure: metrics,
          analyze: analysis,
          deploy: deployment,
        },
        duration,
        checkpoints,
      };
    } catch (error) {
      return this.handlePipelineError(error as Error);
    } finally {
      this.stateMachine?.stop();
    }
  }

  /**
   * BUILD phase: Planning, Architecture, Implementation, Testing
   */
  private async build(objective: string): Promise<BuildResult> {
    this.logger.info('Starting BUILD phase');
    this.currentPhase = BMADPhase.BUILD;
    this.stateMachine?.send(PipelineEvent.NEXT_PHASE, { phase: 'build' });

    if (this.config.bmad?.skipPhases?.includes(BMADPhase.BUILD)) {
      this.logger.info('Skipping BUILD phase');
      return this.createMockBuildResult();
    }

    try {
      // Planning
      const plan = await this.planning(objective);

      // Architecture
      const architecture = await this.architecting(plan);

      // Implementation
      const code = await this.implementing(architecture);

      // Testing
      const tests = await this.testing(code);

      return {
        artifacts: new Map<string, any>([
          ['plan', plan],
          ['architecture', architecture],
          ['code', code],
          ['tests', tests],
        ]),
        metadata: {
          duration: Date.now() - this.startTime!.getTime(),
          timestamp: new Date(),
          version: '1.0.0',
        },
        plan,
        architecture,
        code,
        tests,
      };
    } catch (error) {
      throw new PipelineError(`BUILD phase failed: ${(error as Error).message}`);
    }
  }

  /**
   * MEASURE phase: Collect metrics and performance data
   */
  private async measure(buildResult: BuildResult): Promise<Metrics> {
    this.logger.info('Starting MEASURE phase');
    this.currentPhase = BMADPhase.MEASURE;
    this.stateMachine?.send(PipelineEvent.NEXT_PHASE, { phase: 'measure' });

    if (this.config.bmad?.skipPhases?.includes(BMADPhase.MEASURE)) {
      this.logger.info('Skipping MEASURE phase');
      return this.createMockMetrics();
    }

    try {
      // Collect performance metrics
      const performance = await this.measurePerformance(buildResult);

      // Collect quality metrics
      const quality = await this.measureQuality(buildResult);

      // Collect business metrics
      const business = await this.measureBusiness(buildResult);

      return {
        performance,
        quality,
        business,
      };
    } catch (error) {
      throw new PipelineError(`MEASURE phase failed: ${(error as Error).message}`);
    }
  }

  /**
   * ANALYZE phase: Analyze metrics and generate insights
   */
  private async analyze(metrics: Metrics): Promise<Analysis> {
    this.logger.info('Starting ANALYZE phase');
    this.currentPhase = BMADPhase.ANALYZE;
    this.stateMachine?.send(PipelineEvent.NEXT_PHASE, { phase: 'analyze' });

    if (this.config.bmad?.skipPhases?.includes(BMADPhase.ANALYZE)) {
      this.logger.info('Skipping ANALYZE phase');
      return this.createMockAnalysis();
    }

    try {
      const insights: Insight[] = [];
      const recommendations: string[] = [];
      const risks: Risk[] = [];

      // Analyze performance
      if (metrics.performance.responseTime > 1000) {
        insights.push({
          type: 'performance',
          severity: 'high',
          message: 'Response time exceeds threshold',
          details: { responseTime: metrics.performance.responseTime },
        });
        recommendations.push('Optimize database queries and API calls');
      }

      // Analyze quality
      if (metrics.quality.coverage < this.config.bmad?.measurementThreshold!) {
        insights.push({
          type: 'quality',
          severity: 'medium',
          message: 'Test coverage below threshold',
          details: { coverage: metrics.quality.coverage },
        });
        recommendations.push('Increase unit test coverage');
      }

      // Analyze complexity
      if (metrics.quality.complexity > 10) {
        insights.push({
          type: 'quality',
          severity: 'medium',
          message: 'Code complexity is high',
          details: { complexity: metrics.quality.complexity },
        });
        recommendations.push('Refactor complex functions');
      }

      // Calculate overall score
      const score = this.calculateScore(metrics, insights);

      // Identify risks
      if (score < this.config.bmad?.deploymentScore!) {
        risks.push({
          area: 'deployment',
          probability: 0.7,
          impact: 0.8,
          mitigation: 'Improve quality metrics before deployment',
        });
      }

      return {
        insights,
        recommendations,
        score,
        risks,
      };
    } catch (error) {
      throw new PipelineError(`ANALYZE phase failed: ${(error as Error).message}`);
    }
  }

  /**
   * DEPLOY phase: Deploy to target environment
   */
  private async deploy(buildResult: BuildResult, analysis: Analysis): Promise<DeploymentResult> {
    this.logger.info('Starting DEPLOY phase');
    this.currentPhase = BMADPhase.DEPLOY;
    this.stateMachine?.send(PipelineEvent.NEXT_PHASE, { phase: 'deploy' });

    if (this.config.bmad?.skipPhases?.includes(BMADPhase.DEPLOY)) {
      this.logger.info('Skipping DEPLOY phase');
      return this.createMockDeployment();
    }

    try {
      // Pre-deployment checks
      if (analysis.score < this.config.bmad?.deploymentScore!) {
        throw new PipelineError(
          `Deployment blocked: score ${analysis.score} below threshold ${this.config.bmad?.deploymentScore}`,
        );
      }

      // Select deployment strategy based on environment
      const strategy = this.selectDeploymentStrategy(analysis);

      // Execute deployment
      const result = await this.executeDeployment(buildResult, strategy);

      // Post-deployment validation
      await this.validateDeployment(result);

      return result;
    } catch (error) {
      throw new PipelineError(`DEPLOY phase failed: ${(error as Error).message}`);
    }
  }

  /**
   * Sub-phase: Planning
   */
  private async planning(objective: string): Promise<string> {
    this.logger.debug('Executing planning sub-phase');

    if (!this.pipelineManager) {
      throw new OrchestratorError('Pipeline manager not initialized');
    }

    // Create planning task
    await this.pipelineManager.addTask(
      'Create project plan',
      'planning',
      { objective },
      { priority: TaskPriority.HIGH },
    );

    // Execute planning (mock for now)
    await new Promise((resolve) => setTimeout(resolve, 100));

    return `# Project Plan\n\n## Objective\n${objective}\n\n## Tasks\n- Design architecture\n- Implement features\n- Write tests\n- Deploy`;
  }

  /**
   * Sub-phase: Architecting
   */
  private async architecting(_plan: string): Promise<string> {
    this.logger.debug('Executing architecting sub-phase');

    // Create architecture task
    await new Promise((resolve) => setTimeout(resolve, 100));

    return `# Architecture\n\n## Components\n- API Layer\n- Business Logic\n- Data Layer\n\n## Technologies\n- TypeScript\n- Node.js\n- PostgreSQL`;
  }

  /**
   * Sub-phase: Implementing
   */
  private async implementing(_architecture: string): Promise<Map<string, string>> {
    this.logger.debug('Executing implementing sub-phase');

    // Create implementation tasks
    await new Promise((resolve) => setTimeout(resolve, 200));

    const code = new Map<string, string>();
    code.set('index.ts', 'export function main() { console.log("Hello BMAD"); }');
    code.set('api.ts', 'export class API { /* implementation */ }');
    code.set('database.ts', 'export class Database { /* implementation */ }');

    return code;
  }

  /**
   * Sub-phase: Testing
   */
  private async testing(_code: Map<string, string>): Promise<Map<string, TestResult>> {
    this.logger.debug('Executing testing sub-phase');

    // Create testing tasks
    await new Promise((resolve) => setTimeout(resolve, 150));

    const tests = new Map<string, TestResult>();
    tests.set('unit', { passed: true, coverage: 85, duration: 100 });
    tests.set('integration', { passed: true, coverage: 75, duration: 200 });
    tests.set('e2e', { passed: true, coverage: 60, duration: 500 });

    return tests;
  }

  /**
   * Measure performance metrics
   */
  private async measurePerformance(_buildResult: BuildResult): Promise<Metrics['performance']> {
    await new Promise((resolve) => setTimeout(resolve, 50));

    return {
      responseTime: 250,
      throughput: 1000,
      cpu: 45,
      memory: 512,
    };
  }

  /**
   * Measure quality metrics
   */
  private async measureQuality(buildResult: BuildResult): Promise<Metrics['quality']> {
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Calculate average coverage from tests
    let totalCoverage = 0;
    let testCount = 0;

    if (buildResult.tests) {
      for (const test of buildResult.tests.values()) {
        totalCoverage += test.coverage;
        testCount++;
      }
    }

    const coverage = testCount > 0 ? totalCoverage / testCount : 0;

    return {
      coverage,
      complexity: 7,
      maintainability: 82,
      reliability: 90,
    };
  }

  /**
   * Measure business metrics
   */
  private async measureBusiness(_buildResult: BuildResult): Promise<Metrics['business']> {
    await new Promise((resolve) => setTimeout(resolve, 50));

    return {
      completeness: 95,
      correctness: 98,
      efficiency: 88,
    };
  }

  /**
   * Calculate overall score
   */
  private calculateScore(metrics: Metrics, insights: Insight[]): number {
    let score = 100;

    // Deduct points for insights based on severity
    for (const insight of insights) {
      switch (insight.severity) {
        case 'critical':
          score -= 20;
          break;
        case 'high':
          score -= 10;
          break;
        case 'medium':
          score -= 5;
          break;
        case 'low':
          score -= 2;
          break;
      }
    }

    // Factor in metrics
    score = Math.min(score, metrics.quality.coverage);
    score = Math.min(score, metrics.quality.reliability);
    score = Math.min(score, metrics.business.correctness);

    return Math.max(0, Math.round(score));
  }

  /**
   * Select deployment strategy
   */
  private selectDeploymentStrategy(analysis: Analysis): string {
    if (analysis.risks.length > 0 && analysis.risks[0] && analysis.risks[0].probability > 0.5) {
      return 'canary';
    }

    if (this.config.environment === OrchestratorMode.PRODUCTION) {
      return 'blue-green';
    }

    return 'direct';
  }

  /**
   * Execute deployment
   */
  private async executeDeployment(buildResult: BuildResult, strategy: string): Promise<DeploymentResult> {
    this.logger.info(`Deploying with ${strategy} strategy`);

    await new Promise((resolve) => setTimeout(resolve, 200));

    return {
      success: true,
      environment: this.config.environment,
      url: `https://${this.config.environment}.example.com`,
      version: buildResult.metadata.version,
      rollbackPlan: 'kubectl rollout undo deployment/app',
    };
  }

  /**
   * Validate deployment
   */
  private async validateDeployment(result: DeploymentResult): Promise<void> {
    this.logger.debug('Validating deployment');

    if (!result.success) {
      throw new PipelineError('Deployment validation failed');
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  /**
   * Pause execution
   */
  async pause(): Promise<void> {
    this.logger.info('Pausing orchestrator');
    this.stateMachine?.send(PipelineEvent.PAUSE);
    await this.pipelineManager?.pause();
    await this.saveCheckpoint();
  }

  /**
   * Resume execution
   */
  async resume(): Promise<void> {
    this.logger.info('Resuming orchestrator');

    // Load latest checkpoint
    const checkpoint = await this.loadLatestCheckpoint();
    if (checkpoint) {
      await this.restoreFromCheckpoint(checkpoint);
    }

    this.stateMachine?.send(PipelineEvent.RESUME);
    await this.pipelineManager?.resume();
  }

  /**
   * Abort execution
   */
  abort(): void {
    this.logger.warn('Aborting orchestrator');
    this.abortController?.abort();
    this.stateMachine?.send(PipelineEvent.CANCEL);
    this.pipelineManager?.abort();
  }

  /**
   * Get current status
   */
  getStatus(): {
    phase: BMADPhase | null;
    state: string;
    progress: number;
    metrics?: unknown;
  } {
    const pipelineStatus = this.pipelineManager?.getStatus();

    return {
      phase: this.currentPhase,
      state: this.stateMachine?.getCurrentStateValue() || 'unknown',
      progress: pipelineStatus?.progress || 0,
      metrics: pipelineStatus?.metrics,
    };
  }

  /**
   * Get metrics
   */
  getMetrics(): unknown {
    return this.pipelineManager?.getMetrics();
  }

  /**
   * Save checkpoint
   */
  private async saveCheckpoint(): Promise<void> {
    if (!this.checkpointManager) {
      return;
    }

    await this.checkpoint(`phase-${this.currentPhase}`, this.results);
  }

  /**
   * Checkpoint helper
   */
  private async checkpoint(name: string, data: unknown): Promise<void> {
    if (!this.checkpointManager) {
      return;
    }

    try {
      const checkpointData: CheckpointData = {
        id: '',
        pipelineId: 'orchestrator',
        timestamp: new Date(),
        version: '1.0.0',
        state: {
          phase: this.currentPhase || 'unknown',
          status: 'active',
          progress: this.getStatus().progress,
          context: { name, data },
        },
        tasks: {
          completed: [],
          inProgress: [],
          pending: [],
          failed: [],
        },
        artifacts: Object.fromEntries(this.results),
        metrics: {
          startTime: this.startTime || new Date(),
          duration: this.startTime ? Date.now() - this.startTime.getTime() : 0,
        },
      };

      await this.checkpointManager.save(checkpointData);
      this.logger.debug(`Checkpoint saved: ${name}`);
    } catch (error) {
      this.logger.error('Failed to save checkpoint', error);
    }
  }

  /**
   * Load latest checkpoint
   */
  private async loadLatestCheckpoint(): Promise<CheckpointData | null> {
    if (!this.checkpointManager) {
      return null;
    }

    try {
      return await this.checkpointManager.getLatest('orchestrator');
    } catch (error) {
      this.logger.error('Failed to load checkpoint', error);
      return null;
    }
  }

  /**
   * Restore from checkpoint
   */
  private async restoreFromCheckpoint(checkpoint: CheckpointData): Promise<void> {
    this.logger.info(`Restoring from checkpoint ${checkpoint.id}`);

    // Restore phase and results
    this.currentPhase = checkpoint.state.phase as BMADPhase;
    this.results = new Map<BMADPhase, unknown>(Object.entries(checkpoint.artifacts) as [BMADPhase, unknown][]);

    // Restore timing
    this.startTime = new Date(checkpoint.metrics.startTime);
  }

  /**
   * Get checkpoint IDs
   */
  private async getCheckpointIds(): Promise<string[]> {
    if (!this.checkpointManager) {
      return [];
    }

    const checkpoints = await this.checkpointManager.list('orchestrator');
    return checkpoints.map((cp) => cp.id);
  }

  /**
   * Handle pipeline error
   */
  private async handlePipelineError(error: Error): Promise<BMADResult> {
    this.logger.error('Pipeline error occurred', error);

    const classification = ErrorClassifier.classify(error);
    const strategy = await this.errorHandler.handle(error);

    this.logger.info(`Error recovery strategy: ${strategy}`, {
      severity: classification.severity,
      category: classification.category,
    });

    // Apply recovery strategy
    switch (strategy) {
      case RecoveryStrategy.RETRY:
        if (this.config.maxRetries > 0) {
          this.logger.info('Retrying pipeline');
          this.config.maxRetries--;
          return this.run('retry'); // Simplified retry
        }
        break;

      case RecoveryStrategy.ROLLBACK:
        this.logger.info('Rolling back');
        this.stateMachine?.send(PipelineEvent.ROLLBACK);
        break;

      case RecoveryStrategy.ABORT:
        this.abort();
        break;
    }

    const duration = this.startTime ? Date.now() - this.startTime.getTime() : 0;

    return {
      success: false,
      phases: {
        build: this.results.get(BMADPhase.BUILD) as BuildResult,
        measure: this.results.get(BMADPhase.MEASURE) as Metrics,
        analyze: this.results.get(BMADPhase.ANALYZE) as Analysis,
        deploy: this.results.get(BMADPhase.DEPLOY) as DeploymentResult,
      },
      errors: [error],
      duration,
      checkpoints: await this.getCheckpointIds(),
    };
  }

  /**
   * Create agent configurations
   */
  private createAgentConfigs() {
    const defaultAgents = [
      {
        id: 'architect-1',
        type: 'architect' as const,
        name: 'Architect Agent',
        capabilities: ['planning', 'design', 'architecture'],
        maxConcurrentTasks: 3,
      },
      {
        id: 'developer-1',
        type: 'developer' as const,
        name: 'Developer Agent',
        capabilities: ['coding', 'implementation', 'refactoring'],
        maxConcurrentTasks: 5,
      },
      {
        id: 'tester-1',
        type: 'tester' as const,
        name: 'Tester Agent',
        capabilities: ['testing', 'validation', 'coverage'],
        maxConcurrentTasks: 4,
      },
      {
        id: 'debugger-1',
        type: 'debugger' as const,
        name: 'Debugger Agent',
        capabilities: ['debugging', 'analysis', 'fixing'],
        maxConcurrentTasks: 2,
      },
    ];

    // Filter based on configuration
    if (this.config.agents) {
      return defaultAgents.filter((agent) => {
        const configAgent = this.config.agents?.find((a) => a.type === agent.type);
        return !configAgent || configAgent.enabled !== false;
      });
    }

    return defaultAgents;
  }

  /**
   * Create mock build result for testing
   */
  private createMockBuildResult(): BuildResult {
    return {
      artifacts: new Map(),
      metadata: {
        duration: 0,
        timestamp: new Date(),
        version: '1.0.0',
      },
    };
  }

  /**
   * Create mock metrics for testing
   */
  private createMockMetrics(): Metrics {
    return {
      performance: {
        responseTime: 100,
        throughput: 1000,
        cpu: 30,
        memory: 256,
      },
      quality: {
        coverage: 90,
        complexity: 5,
        maintainability: 85,
        reliability: 95,
      },
      business: {
        completeness: 100,
        correctness: 100,
        efficiency: 95,
      },
    };
  }

  /**
   * Create mock analysis for testing
   */
  private createMockAnalysis(): Analysis {
    return {
      insights: [],
      recommendations: [],
      score: 95,
      risks: [],
    };
  }

  /**
   * Create mock deployment for testing
   */
  private createMockDeployment(): DeploymentResult {
    return {
      success: true,
      environment: this.config.environment,
      version: '1.0.0',
    };
  }
}

/**
 * Factory function to create orchestrator
 */
export function createOrchestrator(config: OrchestratorConfig): Orchestrator {
  return new Orchestrator(config);
}

/**
 * Re-export ExecutionMode from pipeline for convenience
 */
export { ExecutionMode } from './pipeline';

/**
 * Default orchestrator configuration
 */
export const defaultOrchestratorConfig: OrchestratorConfig = {
  workDir: '.',
  mode: ExecutionMode.AUTO,
  environment: OrchestratorMode.DEVELOPMENT,
  maxRetries: 3,
  logLevel: 'info',
  pipeline: {
    maxConcurrentTasks: 5,
    taskTimeout: 300000,
    autoApprove: false,
  },
  bmad: {
    measurementThreshold: 80,
    deploymentScore: 70,
    analysisDepth: 'normal',
  },
  checkpointing: {
    enabled: true,
    interval: 60000,
    maxCheckpoints: 10,
  },
  telemetry: {
    enabled: true,
    sampleRate: 1,
  },
};
