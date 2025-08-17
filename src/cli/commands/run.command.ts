/**
 * Run Command
 * Executes the BMAD pipeline with the orchestrator
 */

import path from 'path';
import { CheckpointManager } from '@core/checkpoint';
import { OrchestratorRunTool } from '@tools/orchestrator-run.tool';
import { createLogger } from '@utils/logger';
import fs from 'fs/promises';
import { CLIConfig } from '../utils/config';
import { getLogger } from '../utils/logger';

const cliLogger = getLogger();
const logger = createLogger('run-command');

export interface RunOptions {
  objective?: string;
  mode?: 'auto' | 'semi' | 'dry-run';
  watch?: boolean;
  checkpoint?: string;
  verbose?: boolean;
}

interface PipelineProgress {
  phase: string;
  status: string;
  progress: number;
  currentTask?: string;
  errors: string[];
}

export class RunCommand {
  private orchestratorTool: OrchestratorRunTool;
  private checkpointManager: CheckpointManager;
  private isRunning = false;
  private currentPipelineId?: string;

  constructor() {
    this.orchestratorTool = new OrchestratorRunTool();
    this.checkpointManager = new CheckpointManager();
  }

  /**
   * Execute the run command
   */
  async execute(options: RunOptions): Promise<void> {
    try {
      // Load configuration
      const config = await CLIConfig.load({
        pipeline: {
          mode: options.mode || 'semi',
          maxRetries: 3,
          timeout: 300,
          checkpointInterval: 5,
        },
      });

      if (options.verbose) {
        cliLogger.setDebugMode(true);
      }

      // Validate objective
      const objective = await this.getObjective(options.objective);
      if (!objective) {
        cliLogger.error('No objective provided. Use --objective flag or create OBJECTIVE.md file');
        process.exit(1);
      }

      // Display run configuration
      cliLogger.box('Pipeline Configuration', [
        `Objective: ${objective.substring(0, 50)}${objective.length > 50 ? '...' : ''}`,
        `Mode: ${config.pipeline.mode}`,
        `Max Retries: ${config.pipeline.maxRetries}`,
        `Timeout: ${config.pipeline.timeout}s`,
        `Checkpoint Interval: ${config.pipeline.checkpointInterval} min`,
      ]);

      // Start pipeline
      const spinner = cliLogger.startSpinner('Initializing pipeline...');

      try {
        this.isRunning = true;
        this.currentPipelineId = `pipeline-${Date.now()}`;

        // Setup signal handlers
        this.setupSignalHandlers();

        // Execute pipeline
        spinner.text = 'Starting BMAD pipeline...';

        const result = await this.orchestratorTool.execute({
          objective,
          mode: config.pipeline.mode,
          maxRetries: config.pipeline.maxRetries,
          checkpointEnabled: true,
        });

        cliLogger.spinnerSuccess('Pipeline completed successfully!');

        // Display results
        this.displayResults(result);

        // Save final state
        await this.saveFinalState(result);
      } catch (error) {
        cliLogger.spinnerFail('Pipeline execution failed');
        throw error;
      } finally {
        this.isRunning = false;
        this.currentPipelineId = undefined;
      }

      // Watch mode
      if (options.watch) {
        cliLogger.info('Watch mode enabled. Monitoring for changes...');
        await this.startWatchMode(objective, config);
      }
    } catch (error) {
      cliLogger.error(`Pipeline execution failed: ${error}`);
      logger.error({ error }, 'Run command failed');

      // Save error checkpoint
      if (this.currentPipelineId) {
        await this.saveErrorCheckpoint(error as Error);
      }

      process.exit(1);
    }
  }

  /**
   * Get objective from options or file
   */
  private async getObjective(objectiveOption?: string): Promise<string | null> {
    if (objectiveOption) {
      return objectiveOption;
    }

    // Try to read from OBJECTIVE.md
    const objectivePath = path.join(process.cwd(), 'OBJECTIVE.md');
    try {
      const content = await fs.readFile(objectivePath, 'utf-8');
      logger.debug('Objective loaded from OBJECTIVE.md');
      return content.trim();
    } catch {
      // Try to read from .kilo/OBJECTIVE.md
      const kiloObjectivePath = path.join(process.cwd(), '.kilo', 'OBJECTIVE.md');
      try {
        const content = await fs.readFile(kiloObjectivePath, 'utf-8');
        logger.debug('Objective loaded from .kilo/OBJECTIVE.md');
        return content.trim();
      } catch {
        return null;
      }
    }
  }

  /**
   * Display pipeline results
   */
  private displayResults(result: any): void {
    cliLogger.newLine();
    cliLogger.box('Pipeline Results', []);

    // Display phase results
    if (result.phases) {
      cliLogger.info('Phase Completion:');
      const phaseData = [
        ['Phase', 'Status', 'Duration', 'Tasks'],
        ['-----', '------', '--------', '-----'],
      ];

      for (const [phase, data] of Object.entries(result.phases as any)) {
        phaseData.push([phase, data.status || 'pending', data.duration || '-', data.taskCount || '0']);
      }

      cliLogger.table(phaseData, {
        head: ['Phase', 'Status', 'Duration', 'Tasks'],
        colWidths: [20, 15, 15, 10],
      });
    }

    // Display metrics
    if (result.metrics) {
      cliLogger.newLine();
      cliLogger.info('Execution Metrics:');
      cliLogger.list([
        `Total Duration: ${result.metrics.totalDuration || 'N/A'}`,
        `Tasks Completed: ${result.metrics.completedTasks || 0}`,
        `Tasks Failed: ${result.metrics.failedTasks || 0}`,
        `Checkpoints Created: ${result.metrics.checkpoints || 0}`,
      ]);
    }

    // Display artifacts
    if (result.artifacts && result.artifacts.length > 0) {
      cliLogger.newLine();
      cliLogger.info('Generated Artifacts:');
      cliLogger.tree(result.artifacts);
    }

    // Display next steps
    cliLogger.newLine();
    cliLogger.info('Next Steps:');
    cliLogger.list(
      [
        'Review generated artifacts in .kilo/artifacts/',
        'Check detailed logs in .kilo/logs/',
        'Run tests with: mcp-dev-orchestrator test',
        'Deploy with: mcp-dev-orchestrator deploy',
      ],
      true,
    );
  }

  /**
   * Save final pipeline state
   */
  private async saveFinalState(result: any): Promise<void> {
    const statePath = path.join(process.cwd(), '.kilo', 'state', 'STATE.json');

    const state = {
      pipeline: {
        id: this.currentPipelineId,
        status: 'completed',
        completedAt: new Date().toISOString(),
        result,
      },
    };

    try {
      await fs.mkdir(path.dirname(statePath), { recursive: true });
      await fs.writeFile(statePath, JSON.stringify(state, null, 2), 'utf-8');
      logger.debug({ statePath }, 'Final state saved');
    } catch (error) {
      logger.error({ error }, 'Failed to save final state');
    }
  }

  /**
   * Save error checkpoint
   */
  private async saveErrorCheckpoint(error: Error): Promise<void> {
    try {
      await this.checkpointManager.save({
        pipelineId: this.currentPipelineId!,
        state: {
          status: 'error',
          error: {
            message: error.message,
            stack: error.stack,
          },
        },
        metadata: {
          timestamp: new Date(),
          reason: 'Pipeline error',
        },
      });

      cliLogger.warning('Error checkpoint saved. Use "mcp-dev-orchestrator resume" to continue');
    } catch (checkpointError) {
      logger.error({ checkpointError }, 'Failed to save error checkpoint');
    }
  }

  /**
   * Start watch mode
   */
  private async startWatchMode(objective: string, config: any): Promise<void> {
    const chokidar = await import('chokidar');

    const watcher = chokidar.watch(['src/**/*', 'tests/**/*'], {
      ignored: /node_modules/,
      persistent: true,
    });

    watcher.on('change', async (filePath) => {
      cliLogger.info(`File changed: ${filePath}`);
      cliLogger.info('Re-running pipeline...');

      try {
        const result = await this.orchestratorTool.execute({
          objective,
          mode: config.pipeline.mode,
          maxRetries: config.pipeline.maxRetries,
          checkpointEnabled: true,
        });

        cliLogger.success('Pipeline re-executed successfully');
        this.displayResults(result);
      } catch (error) {
        cliLogger.error(`Pipeline re-execution failed: ${error}`);
      }
    });

    // Keep watch mode running
    return new Promise((resolve) => {
      process.on('SIGINT', () => {
        watcher.close();
        resolve();
      });
    });
  }

  /**
   * Setup signal handlers
   */
  private setupSignalHandlers(): void {
    const handleSignal = async (signal: string) => {
      cliLogger.newLine();
      cliLogger.warning(`Received ${signal}, saving checkpoint...`);

      if (this.currentPipelineId) {
        try {
          await this.checkpointManager.save({
            pipelineId: this.currentPipelineId,
            state: {
              status: 'interrupted',
              signal,
            },
            metadata: {
              timestamp: new Date(),
              reason: `Interrupted by ${signal}`,
            },
          });

          cliLogger.info('Checkpoint saved. Use "mcp-dev-orchestrator resume" to continue');
        } catch (error) {
          logger.error({ error }, 'Failed to save checkpoint on interrupt');
        }
      }

      process.exit(0);
    };

    process.once('SIGINT', () => handleSignal('SIGINT'));
    process.once('SIGTERM', () => handleSignal('SIGTERM'));
  }

  /**
   * Monitor pipeline progress
   */
  private async monitorProgress(pipelineId: string): Promise<void> {
    // This could be enhanced to show real-time progress
    const progressInterval = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(progressInterval);
        return;
      }

      try {
        const state = await this.getProgress(pipelineId);
        this.updateProgressDisplay(state);
      } catch (error) {
        logger.error({ error }, 'Failed to get progress');
      }
    }, 1000);
  }

  /**
   * Get pipeline progress
   */
  private async getProgress(pipelineId: string): Promise<PipelineProgress> {
    // Read from STATE.json
    const statePath = path.join(process.cwd(), '.kilo', 'state', 'STATE.json');

    try {
      const content = await fs.readFile(statePath, 'utf-8');
      const state = JSON.parse(content);

      return {
        phase: state.pipeline?.phase || 'unknown',
        status: state.pipeline?.status || 'unknown',
        progress: state.metrics?.progress || 0,
        currentTask: state.pipeline?.currentTask,
        errors: state.errors || [],
      };
    } catch {
      return {
        phase: 'initializing',
        status: 'running',
        progress: 0,
        errors: [],
      };
    }
  }

  /**
   * Update progress display
   */
  private updateProgressDisplay(progress: PipelineProgress): void {
    const phases = ['Business', 'Models', 'Actions', 'Deliverables'];
    const currentPhaseIndex = phases.findIndex((p) => p.toLowerCase() === progress.phase.toLowerCase());

    if (currentPhaseIndex >= 0) {
      const overallProgress = ((currentPhaseIndex + progress.progress / 100) / phases.length) * 100;
      cliLogger.progress(overallProgress, 100, `Phase: ${progress.phase}`);

      if (progress.currentTask) {
        cliLogger.updateSpinner(`${progress.phase}: ${progress.currentTask}`);
      }
    }
  }
}

// Export singleton instance
export const runCommand = new RunCommand();
