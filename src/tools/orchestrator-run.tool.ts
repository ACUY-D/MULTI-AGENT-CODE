/**
 * Orchestrator Run Tool
 * Tool principal para ejecutar pipeline BMAD completo
 */

import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { ExecutionMode, type Orchestrator, createOrchestrator } from '../core/orchestrator';
import { AgentFactory } from '../roles/agent-factory';
import { createLogger } from '../utils/logger';

const logger = createLogger('orchestrator-run-tool');

/**
 * Schema de entrada con validación Zod completa
 */
export const OrchestratorRunInputSchema = z.object({
  objective: z.string().min(10).describe('Objetivo del proyecto a desarrollar'),
  repoUrl: z.string().url().optional().describe('URL del repositorio GitHub'),
  localPath: z.string().default(process.cwd()).describe('Ruta local del proyecto'),
  mode: z.enum(['auto', 'semi', 'dry-run']).default('semi').describe('Modo de ejecución'),
  maxIterations: z.number().min(1).max(10).default(5).describe('Máximo de iteraciones'),
  testE2E: z.boolean().optional().describe('Ejecutar tests E2E si hay URL disponible'),
  createPR: z.boolean().default(true).describe('Crear PR al finalizar'),
  githubToken: z.string().optional().describe('Token de GitHub para operaciones'),
  config: z
    .object({
      skipPhases: z.array(z.enum(['brainstorm', 'map', 'act', 'debrief'])).optional(),
      parallelAgents: z.boolean().default(false),
      checkpointInterval: z.number().default(5).describe('Minutos entre checkpoints'),
      notifyWebhook: z.string().url().optional(),
    })
    .optional(),
});

/**
 * Schema de salida
 */
export const OrchestratorRunOutputSchema = z.object({
  success: z.boolean(),
  pipelineId: z.string().uuid(),
  phasesCompleted: z.array(
    z.object({
      name: z.string(),
      status: z.enum(['completed', 'failed', 'skipped']),
      duration: z.number(),
      artifacts: z.array(z.string()),
    }),
  ),
  artifacts: z.array(
    z.object({
      type: z.string(),
      path: z.string(),
      url: z.string().optional(),
    }),
  ),
  prUrl: z.string().url().optional(),
  nextActions: z.array(
    z.object({
      action: z.string(),
      description: z.string(),
      priority: z.enum(['high', 'medium', 'low']),
    }),
  ),
  errors: z
    .array(
      z.object({
        phase: z.string(),
        message: z.string(),
        stack: z.string().optional(),
      }),
    )
    .optional(),
  metrics: z.object({
    totalDuration: z.number(),
    linesOfCode: z.number(),
    testCoverage: z.number(),
    filesCreated: z.number(),
    filesModified: z.number(),
  }),
});

type OrchestratorRunInput = z.infer<typeof OrchestratorRunInputSchema>;
type OrchestratorRunOutput = z.infer<typeof OrchestratorRunOutputSchema>;

/**
 * Orchestrator Run Tool Class
 */
export class OrchestratorRunTool {
  static metadata = {
    name: 'orchestrator.run',
    description: 'Ejecuta un pipeline BMAD completo para desarrollo de software',
    inputSchema: OrchestratorRunInputSchema,
    outputSchema: OrchestratorRunOutputSchema,
  };

  private orchestrator: Orchestrator | null = null;
  private agentFactory: AgentFactory;
  private startTime: Date = new Date();

  constructor() {
    this.agentFactory = AgentFactory.getInstance();
  }

  /**
   * Execute the tool
   */
  async execute(input: OrchestratorRunInput): Promise<OrchestratorRunOutput> {
    logger.info('Starting orchestrator run', { objective: input.objective });
    this.startTime = new Date();
    const pipelineId = uuidv4();

    try {
      // Validate input
      const validatedInput = OrchestratorRunInputSchema.parse(input);

      // Create orchestrator configuration
      const orchestratorConfig = {
        workDir: validatedInput.localPath,
        mode: this.mapExecutionMode(validatedInput.mode),
        githubToken: validatedInput.githubToken,
        maxRetries: 3,
        logLevel: 'info' as const,
        checkpointing: {
          enabled: true,
          interval: validatedInput.config?.checkpointInterval
            ? validatedInput.config.checkpointInterval * 60000
            : 300000,
          maxCheckpoints: 10,
        },
      };

      // Initialize orchestrator
      this.orchestrator = createOrchestrator(orchestratorConfig);
      await this.orchestrator.initialize();

      // Execute the BMAD pipeline
      const result = await this.orchestrator.run(validatedInput.objective);

      // Process results
      const phasesCompleted = this.extractPhasesInfo(result);
      const artifacts = await this.collectArtifacts(validatedInput.localPath);
      const metrics = await this.calculateMetrics(validatedInput.localPath, result);
      const nextActions = this.determineNextActions(result);

      // Create PR if requested
      let prUrl: string | undefined;
      if (validatedInput.createPR && validatedInput.githubToken && validatedInput.repoUrl) {
        prUrl = await this.createPullRequest(
          validatedInput.repoUrl,
          validatedInput.githubToken,
          pipelineId,
          validatedInput.objective,
        );
      }

      // Run E2E tests if requested
      if (validatedInput.testE2E && result.phases.deploy?.url) {
        await this.runE2ETests(result.phases.deploy.url);
      }

      // Send webhook notification if configured
      if (validatedInput.config?.notifyWebhook) {
        await this.sendWebhookNotification(validatedInput.config.notifyWebhook, pipelineId, result.success);
      }

      const output: OrchestratorRunOutput = {
        success: result.success,
        pipelineId,
        phasesCompleted,
        artifacts,
        prUrl,
        nextActions,
        metrics,
        errors: result.errors ? this.formatErrors(result.errors) : undefined,
      };

      // Validate output
      return OrchestratorRunOutputSchema.parse(output);
    } catch (error) {
      logger.error('Orchestrator run failed', error);

      return {
        success: false,
        pipelineId,
        phasesCompleted: [],
        artifacts: [],
        nextActions: [
          {
            action: 'review_error',
            description: 'Review the error and retry the pipeline',
            priority: 'high',
          },
        ],
        errors: [
          {
            phase: 'initialization',
            message: (error as Error).message,
            stack: (error as Error).stack,
          },
        ],
        metrics: {
          totalDuration: Date.now() - this.startTime.getTime(),
          linesOfCode: 0,
          testCoverage: 0,
          filesCreated: 0,
          filesModified: 0,
        },
      };
    } finally {
      // Cleanup
      if (this.orchestrator) {
        await this.shutdown();
      }
    }
  }

  /**
   * Shutdown the orchestrator
   */
  private async shutdown(): Promise<void> {
    if (this.orchestrator) {
      this.orchestrator.abort();
      this.orchestrator = null;
    }
  }

  /**
   * Map execution mode from input to orchestrator mode
   */
  private mapExecutionMode(mode: 'auto' | 'semi' | 'dry-run'): ExecutionMode {
    switch (mode) {
      case 'auto':
        return ExecutionMode.AUTO;
      case 'semi':
        return ExecutionMode.SEMI;
      case 'dry-run':
        return ExecutionMode.DRY_RUN;
      default:
        return ExecutionMode.SEMI;
    }
  }

  /**
   * Extract phases information from BMAD result
   */
  private extractPhasesInfo(result: any): any[] {
    const phases = [];
    const phaseNames = ['build', 'measure', 'analyze', 'deploy'];

    for (const phaseName of phaseNames) {
      if (result.phases[phaseName]) {
        phases.push({
          name: phaseName,
          status: result.phases[phaseName] ? 'completed' : 'skipped',
          duration: result.phases[phaseName]?.metadata?.duration || 0,
          artifacts: this.extractPhaseArtifacts(result.phases[phaseName]),
        });
      }
    }

    return phases;
  }

  /**
   * Extract artifacts from a phase
   */
  private extractPhaseArtifacts(phase: any): string[] {
    const artifacts: string[] = [];

    if (phase?.artifacts) {
      for (const [key, value] of phase.artifacts.entries()) {
        artifacts.push(key);
      }
    }

    return artifacts;
  }

  /**
   * Collect all artifacts from the project
   */
  private async collectArtifacts(localPath: string): Promise<any[]> {
    const artifacts = [];

    // Check for common artifact locations
    const artifactPaths = [
      { type: 'documentation', path: `${localPath}/docs` },
      { type: 'tests', path: `${localPath}/tests` },
      { type: 'build', path: `${localPath}/dist` },
      { type: 'coverage', path: `${localPath}/coverage` },
    ];

    for (const artifact of artifactPaths) {
      // Check if path exists (simplified for now)
      artifacts.push({
        type: artifact.type,
        path: artifact.path,
        url: undefined,
      });
    }

    return artifacts;
  }

  /**
   * Calculate project metrics
   */
  private async calculateMetrics(localPath: string, result: any): Promise<any> {
    // Simplified metrics calculation
    const totalDuration = Date.now() - this.startTime.getTime();

    // Extract test coverage from result if available
    let testCoverage = 0;
    if (result.phases.build?.tests) {
      let totalCoverage = 0;
      let testCount = 0;
      for (const test of result.phases.build.tests.values()) {
        totalCoverage += test.coverage || 0;
        testCount++;
      }
      testCoverage = testCount > 0 ? totalCoverage / testCount : 0;
    }

    return {
      totalDuration,
      linesOfCode: 1000, // Placeholder
      testCoverage,
      filesCreated: 10, // Placeholder
      filesModified: 5, // Placeholder
    };
  }

  /**
   * Determine next actions based on results
   */
  private determineNextActions(result: any): any[] {
    const actions = [];

    if (!result.success) {
      actions.push({
        action: 'fix_errors',
        description: 'Fix the identified errors and retry',
        priority: 'high',
      });
    }

    if (result.phases.analyze?.recommendations) {
      for (const recommendation of result.phases.analyze.recommendations) {
        actions.push({
          action: 'implement_recommendation',
          description: recommendation,
          priority: 'medium',
        });
      }
    }

    if (result.phases.measure?.quality?.coverage < 80) {
      actions.push({
        action: 'improve_coverage',
        description: 'Increase test coverage to at least 80%',
        priority: 'medium',
      });
    }

    if (actions.length === 0) {
      actions.push({
        action: 'monitor_deployment',
        description: 'Monitor the deployed application for issues',
        priority: 'low',
      });
    }

    return actions;
  }

  /**
   * Create a pull request
   */
  private async createPullRequest(
    repoUrl: string,
    token: string,
    pipelineId: string,
    objective: string,
  ): Promise<string> {
    logger.info('Creating pull request', { repoUrl, pipelineId });

    // This would integrate with GitHub API
    // For now, return a mock URL
    return `${repoUrl}/pull/1`;
  }

  /**
   * Run E2E tests
   */
  private async runE2ETests(url: string): Promise<void> {
    logger.info('Running E2E tests', { url });

    // This would integrate with Playwright adapter
    // For now, just log
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(webhookUrl: string, pipelineId: string, success: boolean): Promise<void> {
    logger.info('Sending webhook notification', { webhookUrl, pipelineId, success });

    // This would make an HTTP POST request
    // For now, just log
  }

  /**
   * Format errors for output
   */
  private formatErrors(errors: Error[]): any[] {
    return errors.map((error) => ({
      phase: 'unknown',
      message: error.message,
      stack: error.stack,
    }));
  }
}

/**
 * Factory function to create tool instance
 */
export function createOrchestratorRunTool(): OrchestratorRunTool {
  return new OrchestratorRunTool();
}
