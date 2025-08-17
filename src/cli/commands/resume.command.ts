/**
 * Resume Command
 * Resumes a pipeline from a checkpoint
 */

import { CheckpointManager } from '@core/checkpoint';
import { OrchestratorRunTool } from '@tools/orchestrator-run.tool';
import { createLogger } from '@utils/logger';
import inquirer from 'inquirer';
import { CLIConfig } from '../utils/config';
import { getLogger } from '../utils/logger';

const cliLogger = getLogger();
const logger = createLogger('resume-command');

export interface ResumeOptions {
  from?: string;
  list?: boolean;
  force?: boolean;
  verbose?: boolean;
}

export class ResumeCommand {
  private checkpointManager: CheckpointManager;
  private orchestratorTool: OrchestratorRunTool;

  constructor() {
    this.checkpointManager = new CheckpointManager();
    this.orchestratorTool = new OrchestratorRunTool();
  }

  /**
   * Execute the resume command
   */
  async execute(options: ResumeOptions): Promise<void> {
    try {
      if (options.verbose) {
        cliLogger.setDebugMode(true);
      }

      // If list option, show available checkpoints
      if (options.list) {
        await this.listCheckpoints();
        return;
      }

      // Get checkpoint to resume from
      const checkpointId = await this.getCheckpointId(options.from);

      if (!checkpointId) {
        cliLogger.warning('No checkpoint selected. Use --list to see available checkpoints');
        return;
      }

      // Load checkpoint
      const spinner = cliLogger.startSpinner(`Loading checkpoint ${checkpointId.substring(0, 8)}...`);

      try {
        const checkpoint = await this.checkpointManager.load(checkpointId);

        if (!checkpoint) {
          cliLogger.spinnerFail('Checkpoint not found');
          return;
        }

        cliLogger.spinnerSuccess('Checkpoint loaded');

        // Display checkpoint information
        this.displayCheckpointInfo(checkpoint);

        // Confirm resume
        if (!options.force) {
          const { proceed } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'proceed',
              message: 'Resume pipeline from this checkpoint?',
              default: true,
            },
          ]);

          if (!proceed) {
            cliLogger.info('Resume cancelled');
            return;
          }
        }

        // Resume pipeline
        await this.resumePipeline(checkpoint);
      } catch (error) {
        cliLogger.spinnerFail('Failed to load checkpoint');
        throw error;
      }
    } catch (error) {
      cliLogger.error(`Resume failed: ${error}`);
      logger.error({ error }, 'Resume command failed');
      process.exit(1);
    }
  }

  /**
   * List available checkpoints
   */
  private async listCheckpoints(): Promise<void> {
    const spinner = cliLogger.startSpinner('Loading checkpoints...');

    try {
      const checkpoints = await this.checkpointManager.list();
      cliLogger.spinnerSuccess(`Found ${checkpoints.length} checkpoint(s)`);

      if (checkpoints.length === 0) {
        cliLogger.info('No checkpoints available');
        return;
      }

      cliLogger.newLine();
      cliLogger.box('Available Checkpoints', []);

      // Group checkpoints by pipeline
      const grouped = this.groupCheckpointsByPipeline(checkpoints);

      for (const [pipelineId, pipelineCheckpoints] of Object.entries(grouped)) {
        cliLogger.newLine();
        cliLogger.info(`Pipeline: ${pipelineId}`);
        cliLogger.divider('-', 40);

        const tableData = pipelineCheckpoints.map((cp) => [
          cp.id.substring(0, 8) + '...',
          new Date(cp.timestamp).toLocaleString(),
          cp.phase || 'N/A',
          cp.reason || 'Manual',
          this.formatSize(cp.size),
        ]);

        cliLogger.table(tableData, {
          head: ['ID', 'Timestamp', 'Phase', 'Reason', 'Size'],
          colWidths: [12, 20, 15, 20, 10],
        });
      }

      cliLogger.newLine();
      cliLogger.info('To resume from a checkpoint:');
      cliLogger.info('  mcp-dev-orchestrator resume --from <checkpoint-id>');
    } catch (error) {
      cliLogger.spinnerFail('Failed to list checkpoints');
      throw error;
    }
  }

  /**
   * Get checkpoint ID to resume from
   */
  private async getCheckpointId(fromOption?: string): Promise<string | null> {
    // If checkpoint ID provided via option
    if (fromOption) {
      return fromOption;
    }

    // Load available checkpoints
    const checkpoints = await this.checkpointManager.list();

    if (checkpoints.length === 0) {
      cliLogger.warning('No checkpoints available');
      return null;
    }

    // If only one checkpoint, use it
    if (checkpoints.length === 1) {
      const checkpoint = checkpoints[0];
      cliLogger.info(`Using only available checkpoint: ${checkpoint.id.substring(0, 8)}...`);
      return checkpoint.id;
    }

    // Get latest checkpoint by default
    const latest = await this.checkpointManager.getLatest();
    if (latest) {
      cliLogger.info(`Using latest checkpoint: ${latest.id.substring(0, 8)}...`);
      cliLogger.info('Use --from to specify a different checkpoint');
      return latest.id;
    }

    // Interactive selection
    const choices = checkpoints.map((cp) => ({
      name: `${cp.id.substring(0, 8)}... - ${new Date(cp.timestamp).toLocaleString()} - ${cp.phase || 'N/A'}`,
      value: cp.id,
    }));

    const { checkpointId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'checkpointId',
        message: 'Select checkpoint to resume from:',
        choices,
      },
    ]);

    return checkpointId;
  }

  /**
   * Display checkpoint information
   */
  private displayCheckpointInfo(checkpoint: any): void {
    cliLogger.newLine();
    cliLogger.box('Checkpoint Information', [
      `ID: ${checkpoint.id}`,
      `Pipeline: ${checkpoint.pipelineId}`,
      `Phase: ${checkpoint.state?.phase || 'N/A'}`,
      `Status: ${checkpoint.state?.status || 'N/A'}`,
      `Created: ${new Date(checkpoint.metadata?.timestamp || checkpoint.timestamp).toLocaleString()}`,
      `Reason: ${checkpoint.metadata?.reason || 'Manual checkpoint'}`,
    ]);

    // Display state summary
    if (checkpoint.state) {
      cliLogger.newLine();
      cliLogger.info('State Summary:');

      if (checkpoint.state.agents) {
        const activeAgents = Object.entries(checkpoint.state.agents)
          .filter(([_, agent]: [string, any]) => agent.status === 'active')
          .map(([name]) => name);

        if (activeAgents.length > 0) {
          cliLogger.list([`Active Agents: ${activeAgents.join(', ')}`]);
        }
      }

      if (checkpoint.state.metrics) {
        cliLogger.list([
          `Tasks Completed: ${checkpoint.state.metrics.completedTasks || 0}`,
          `Tasks Failed: ${checkpoint.state.metrics.failedTasks || 0}`,
          `Tasks Pending: ${checkpoint.state.metrics.pendingTasks || 0}`,
        ]);
      }

      if (checkpoint.state.currentTask) {
        cliLogger.list([`Current Task: ${checkpoint.state.currentTask}`]);
      }
    }
  }

  /**
   * Resume pipeline from checkpoint
   */
  private async resumePipeline(checkpoint: any): Promise<void> {
    const spinner = cliLogger.startSpinner('Resuming pipeline...');

    try {
      // Restore state
      spinner.text = 'Restoring pipeline state...';
      const restoredState = await this.restoreState(checkpoint);

      // Setup signal handlers
      this.setupSignalHandlers(checkpoint.pipelineId);

      // Resume execution
      spinner.text = 'Resuming pipeline execution...';

      const result = await this.orchestratorTool.execute({
        objective: restoredState.objective || checkpoint.state?.objective || 'Continue pipeline',
        mode: restoredState.mode || 'semi',
        checkpoint: checkpoint.id,
        resumeFrom: {
          phase: checkpoint.state?.phase,
          state: checkpoint.state,
          context: checkpoint.context,
        },
      });

      cliLogger.spinnerSuccess('Pipeline resumed and completed successfully!');

      // Display results
      this.displayResults(result);
    } catch (error) {
      cliLogger.spinnerFail('Failed to resume pipeline');

      // Save error checkpoint
      try {
        await this.checkpointManager.save({
          pipelineId: checkpoint.pipelineId,
          state: {
            ...checkpoint.state,
            status: 'error',
            error: {
              message: (error as Error).message,
              stack: (error as Error).stack,
              resumeAttemptFailed: true,
            },
          },
          metadata: {
            timestamp: new Date(),
            reason: 'Resume attempt failed',
            parentCheckpoint: checkpoint.id,
          },
        });

        cliLogger.warning('Error checkpoint saved. Try resuming again or debug the issue');
      } catch (saveError) {
        logger.error({ saveError }, 'Failed to save error checkpoint');
      }

      throw error;
    }
  }

  /**
   * Restore state from checkpoint
   */
  private async restoreState(checkpoint: any): Promise<any> {
    const state = {
      objective: checkpoint.state?.objective,
      mode: checkpoint.state?.mode || 'semi',
      phase: checkpoint.state?.phase,
      agents: checkpoint.state?.agents || {},
      tasks: checkpoint.state?.tasks || [],
      metrics: checkpoint.state?.metrics || {},
      context: checkpoint.context || {},
    };

    // Write state to STATE.json
    const fs = await import('fs/promises');
    const path = await import('path');
    const statePath = path.join(process.cwd(), '.kilo', 'state', 'STATE.json');

    try {
      await fs.mkdir(path.dirname(statePath), { recursive: true });
      await fs.writeFile(
        statePath,
        JSON.stringify(
          {
            pipeline: {
              id: checkpoint.pipelineId,
              status: 'resuming',
              phase: state.phase,
              resumedFrom: checkpoint.id,
              resumedAt: new Date().toISOString(),
            },
            ...state,
          },
          null,
          2,
        ),
        'utf-8',
      );

      logger.debug({ statePath }, 'State restored from checkpoint');
    } catch (error) {
      logger.error({ error }, 'Failed to restore state file');
    }

    return state;
  }

  /**
   * Display pipeline results
   */
  private displayResults(result: any): void {
    cliLogger.newLine();
    cliLogger.box('Pipeline Results', []);

    if (result.phases) {
      cliLogger.info('Completed Phases:');
      Object.entries(result.phases).forEach(([phase, data]: [string, any]) => {
        const status = data.status === 'completed' ? '✅' : data.status === 'failed' ? '❌' : '⏳';
        cliLogger.info(`  ${status} ${phase}`);
      });
    }

    if (result.metrics) {
      cliLogger.newLine();
      cliLogger.info('Final Metrics:');
      cliLogger.list([
        `Total Duration: ${result.metrics.totalDuration || 'N/A'}`,
        `Tasks Completed: ${result.metrics.completedTasks || 0}`,
        `Tasks Failed: ${result.metrics.failedTasks || 0}`,
      ]);
    }

    cliLogger.newLine();
    cliLogger.success('Pipeline resumed and completed successfully!');
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  private setupSignalHandlers(pipelineId: string): void {
    const handleSignal = async (signal: string) => {
      cliLogger.newLine();
      cliLogger.warning(`Received ${signal}, saving checkpoint...`);

      try {
        await this.checkpointManager.save({
          pipelineId,
          state: {
            status: 'interrupted',
            signal,
            interruptedDuringResume: true,
          },
          metadata: {
            timestamp: new Date(),
            reason: `Interrupted during resume by ${signal}`,
          },
        });

        cliLogger.info('Checkpoint saved. Use "mcp-dev-orchestrator resume" to continue');
      } catch (error) {
        logger.error({ error }, 'Failed to save checkpoint on interrupt');
      }

      process.exit(0);
    };

    process.once('SIGINT', () => handleSignal('SIGINT'));
    process.once('SIGTERM', () => handleSignal('SIGTERM'));
  }

  /**
   * Group checkpoints by pipeline ID
   */
  private groupCheckpointsByPipeline(checkpoints: any[]): Record<string, any[]> {
    const grouped: Record<string, any[]> = {};

    checkpoints.forEach((cp) => {
      const pipelineId = cp.pipelineId || 'unknown';
      if (!grouped[pipelineId]) {
        grouped[pipelineId] = [];
      }
      grouped[pipelineId].push(cp);
    });

    // Sort each group by timestamp (newest first)
    Object.values(grouped).forEach((group) => {
      group.sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeB - timeA;
      });
    });

    return grouped;
  }

  /**
   * Format file size
   */
  private formatSize(bytes?: number): string {
    if (!bytes) return 'N/A';

    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
}

// Export singleton instance
export const resumeCommand = new ResumeCommand();
