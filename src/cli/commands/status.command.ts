/**
 * Status Command
 * Shows the current status of the pipeline and agents
 */

import path from 'path';
import { CheckpointManager } from '@core/checkpoint';
import { createLogger } from '@utils/logger';
import fs from 'fs/promises';
import { getLogger } from '../utils/logger';

const cliLogger = getLogger();
const logger = createLogger('status-command');

export interface StatusOptions {
  format?: 'json' | 'table' | 'markdown';
  detailed?: boolean;
  watch?: boolean;
}

interface PipelineStatus {
  id: string | null;
  status: string;
  phase: string | null;
  startTime: string | null;
  endTime: string | null;
  duration?: string;
  currentTask?: string;
  progress?: number;
}

interface AgentStatus {
  name: string;
  type: string;
  status: string;
  currentTask?: string;
  tasksCompleted: number;
  tasksFailed: number;
}

interface SystemMetrics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  pendingTasks: number;
  successRate: string;
  avgTaskDuration?: string;
}

export class StatusCommand {
  private checkpointManager: CheckpointManager;

  constructor() {
    this.checkpointManager = new CheckpointManager();
  }

  /**
   * Execute the status command
   */
  async execute(options: StatusOptions): Promise<void> {
    try {
      // Load current state
      const state = await this.loadState();

      if (!state) {
        cliLogger.warning('No pipeline state found. Run "mcp-dev-orchestrator init" to initialize a project');
        return;
      }

      // Format and display based on option
      switch (options.format) {
        case 'json':
          await this.displayJson(state);
          break;
        case 'markdown':
          await this.displayMarkdown(state);
          break;
        case 'table':
        default:
          await this.displayTable(state, options.detailed || false);
          break;
      }

      // Watch mode
      if (options.watch) {
        await this.startWatchMode(options);
      }
    } catch (error) {
      cliLogger.error(`Failed to get status: ${error}`);
      logger.error({ error }, 'Status command failed');
      process.exit(1);
    }
  }

  /**
   * Load current state from STATE.json
   */
  private async loadState(): Promise<any | null> {
    const statePath = path.join(process.cwd(), '.kilo', 'state', 'STATE.json');

    try {
      const content = await fs.readFile(statePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      logger.debug({ error }, 'Failed to load state');
      return null;
    }
  }

  /**
   * Display status in table format
   */
  private async displayTable(state: any, detailed: boolean): Promise<void> {
    // Pipeline Status
    const pipeline = this.extractPipelineStatus(state);

    cliLogger.box('Pipeline Status', []);
    cliLogger.newLine();

    const statusColor = this.getStatusColor(pipeline.status);
    cliLogger.info(`Status: ${statusColor(pipeline.status.toUpperCase())}`);

    if (pipeline.id) {
      cliLogger.info(`Pipeline ID: ${pipeline.id}`);
    }

    if (pipeline.phase) {
      cliLogger.info(`Current Phase: ${pipeline.phase}`);
      if (pipeline.progress) {
        cliLogger.progress(pipeline.progress, 100, 'Progress');
      }
    }

    if (pipeline.currentTask) {
      cliLogger.info(`Current Task: ${pipeline.currentTask}`);
    }

    if (pipeline.startTime) {
      cliLogger.info(`Started: ${new Date(pipeline.startTime).toLocaleString()}`);
      if (pipeline.duration) {
        cliLogger.info(`Duration: ${pipeline.duration}`);
      }
    }

    // Agent Status
    if (state.agents && Object.keys(state.agents).length > 0) {
      cliLogger.newLine();
      cliLogger.divider();
      cliLogger.info('Agent Status:');
      cliLogger.newLine();

      const agentData = this.extractAgentStatus(state);
      const tableData = agentData.map((agent) => [
        agent.name,
        agent.type,
        this.getStatusColor(agent.status)(agent.status),
        agent.currentTask || '-',
        `${agent.tasksCompleted}/${agent.tasksFailed}`,
      ]);

      cliLogger.table(tableData, {
        head: ['Agent', 'Type', 'Status', 'Current Task', 'Tasks (✓/✗)'],
        colWidths: [15, 12, 10, 30, 12],
      });
    }

    // System Metrics
    const metrics = this.extractMetrics(state);

    cliLogger.newLine();
    cliLogger.divider();
    cliLogger.info('Metrics:');
    cliLogger.newLine();

    cliLogger.list([
      `Total Tasks: ${metrics.totalTasks}`,
      `Completed: ${metrics.completedTasks} ✅`,
      `Failed: ${metrics.failedTasks} ❌`,
      `Pending: ${metrics.pendingTasks} ⏳`,
      `Success Rate: ${metrics.successRate}`,
    ]);

    // Detailed view
    if (detailed) {
      await this.displayDetailedInfo(state);
    }

    // Recent checkpoints
    cliLogger.newLine();
    cliLogger.divider();
    cliLogger.info('Recent Checkpoints:');
    cliLogger.newLine();

    await this.displayCheckpoints();

    // Next actions
    cliLogger.newLine();
    cliLogger.divider();
    cliLogger.info('Available Actions:');
    cliLogger.list(
      [
        pipeline.status === 'paused' ? 'mcp-dev-orchestrator resume - Continue pipeline' : null,
        pipeline.status === 'idle' ? 'mcp-dev-orchestrator run - Start new pipeline' : null,
        pipeline.status === 'running' ? 'mcp-dev-orchestrator status --watch - Monitor progress' : null,
        'mcp-dev-orchestrator status --format json - Export as JSON',
      ].filter(Boolean) as string[],
      true,
    );
  }

  /**
   * Display status in JSON format
   */
  private async displayJson(state: any): Promise<void> {
    const output = {
      pipeline: this.extractPipelineStatus(state),
      agents: this.extractAgentStatus(state),
      metrics: this.extractMetrics(state),
      checkpoints: await this.getRecentCheckpoints(),
      timestamp: new Date().toISOString(),
    };

    console.log(JSON.stringify(output, null, 2));
  }

  /**
   * Display status in Markdown format
   */
  private async displayMarkdown(state: any): Promise<void> {
    const pipeline = this.extractPipelineStatus(state);
    const agents = this.extractAgentStatus(state);
    const metrics = this.extractMetrics(state);
    const checkpoints = await this.getRecentCheckpoints();

    let markdown = '# Pipeline Status Report\n\n';
    markdown += `Generated: ${new Date().toLocaleString()}\n\n`;

    // Pipeline section
    markdown += '## Pipeline\n\n';
    markdown += `- **Status**: ${pipeline.status}\n`;
    markdown += `- **Phase**: ${pipeline.phase || 'N/A'}\n`;
    markdown += `- **Pipeline ID**: ${pipeline.id || 'N/A'}\n`;

    if (pipeline.startTime) {
      markdown += `- **Started**: ${new Date(pipeline.startTime).toLocaleString()}\n`;
      if (pipeline.duration) {
        markdown += `- **Duration**: ${pipeline.duration}\n`;
      }
    }

    if (pipeline.currentTask) {
      markdown += `- **Current Task**: ${pipeline.currentTask}\n`;
    }

    if (pipeline.progress) {
      markdown += `- **Progress**: ${pipeline.progress}%\n`;
    }

    // Agents section
    if (agents.length > 0) {
      markdown += '\n## Agents\n\n';
      markdown += '| Agent | Type | Status | Current Task | Tasks Completed | Tasks Failed |\n';
      markdown += '|-------|------|--------|--------------|-----------------|---------------|\n';

      agents.forEach((agent) => {
        markdown += `| ${agent.name} | ${agent.type} | ${agent.status} | ${agent.currentTask || '-'} | ${agent.tasksCompleted} | ${agent.tasksFailed} |\n`;
      });
    }

    // Metrics section
    markdown += '\n## Metrics\n\n';
    markdown += `- **Total Tasks**: ${metrics.totalTasks}\n`;
    markdown += `- **Completed Tasks**: ${metrics.completedTasks}\n`;
    markdown += `- **Failed Tasks**: ${metrics.failedTasks}\n`;
    markdown += `- **Pending Tasks**: ${metrics.pendingTasks}\n`;
    markdown += `- **Success Rate**: ${metrics.successRate}\n`;

    // Checkpoints section
    if (checkpoints.length > 0) {
      markdown += '\n## Recent Checkpoints\n\n';
      markdown += '| ID | Timestamp | Phase | Reason |\n';
      markdown += '|----|-----------|-------|--------|\n';

      checkpoints.forEach((cp) => {
        const timestamp = new Date(cp.timestamp).toLocaleString();
        markdown += `| ${cp.id.substring(0, 8)}... | ${timestamp} | ${cp.phase || '-'} | ${cp.reason || '-'} |\n`;
      });
    }

    console.log(markdown);
  }

  /**
   * Display detailed information
   */
  private async displayDetailedInfo(state: any): Promise<void> {
    cliLogger.newLine();
    cliLogger.divider();
    cliLogger.info('Detailed Information:');
    cliLogger.newLine();

    // Tasks breakdown
    if (state.tasks && state.tasks.length > 0) {
      cliLogger.info('Recent Tasks:');
      const recentTasks = state.tasks.slice(-5);

      recentTasks.forEach((task: any) => {
        const status = task.status === 'completed' ? '✅' : task.status === 'failed' ? '❌' : '⏳';
        cliLogger.info(`  ${status} ${task.name || 'Unknown task'} - ${task.agent || 'N/A'}`);
      });
    }

    // Errors
    if (state.errors && state.errors.length > 0) {
      cliLogger.newLine();
      cliLogger.warning('Recent Errors:');
      state.errors.slice(-3).forEach((error: any) => {
        cliLogger.error(`  ${error.message || error}`);
      });
    }

    // Artifacts
    const artifactsPath = path.join(process.cwd(), '.kilo', 'artifacts');
    try {
      const artifacts = await fs.readdir(artifactsPath);
      if (artifacts.length > 0) {
        cliLogger.newLine();
        cliLogger.info('Generated Artifacts:');
        cliLogger.tree(artifacts);
      }
    } catch {
      // No artifacts directory
    }
  }

  /**
   * Display recent checkpoints
   */
  private async displayCheckpoints(): Promise<void> {
    const checkpoints = await this.getRecentCheckpoints();

    if (checkpoints.length === 0) {
      cliLogger.info('No checkpoints found');
      return;
    }

    checkpoints.slice(0, 5).forEach((cp) => {
      const timestamp = new Date(cp.timestamp).toLocaleString();
      const id = cp.id.substring(0, 8);
      cliLogger.info(`  [${id}...] ${timestamp} - ${cp.reason || 'Manual checkpoint'}`);
    });
  }

  /**
   * Get recent checkpoints
   */
  private async getRecentCheckpoints(): Promise<any[]> {
    try {
      const checkpoints = await this.checkpointManager.list();
      return checkpoints.slice(0, 5);
    } catch {
      return [];
    }
  }

  /**
   * Extract pipeline status from state
   */
  private extractPipelineStatus(state: any): PipelineStatus {
    const pipeline = state.pipeline || {};

    const status: PipelineStatus = {
      id: pipeline.id || null,
      status: pipeline.status || 'idle',
      phase: pipeline.phase || null,
      startTime: pipeline.startTime || null,
      endTime: pipeline.endTime || null,
      currentTask: pipeline.currentTask,
      progress: pipeline.progress,
    };

    if (status.startTime) {
      const start = new Date(status.startTime);
      const end = status.endTime ? new Date(status.endTime) : new Date();
      const duration = end.getTime() - start.getTime();
      status.duration = this.formatDuration(duration);
    }

    return status;
  }

  /**
   * Extract agent status from state
   */
  private extractAgentStatus(state: any): AgentStatus[] {
    const agents = state.agents || {};

    return Object.entries(agents).map(([name, data]: [string, any]) => ({
      name,
      type: data.type || 'unknown',
      status: data.status || 'idle',
      currentTask: data.currentTask,
      tasksCompleted: data.tasksCompleted || 0,
      tasksFailed: data.tasksFailed || 0,
    }));
  }

  /**
   * Extract metrics from state
   */
  private extractMetrics(state: any): SystemMetrics {
    const metrics = state.metrics || {};

    const totalTasks = metrics.totalTasks || 0;
    const completedTasks = metrics.completedTasks || 0;
    const failedTasks = metrics.failedTasks || 0;
    const pendingTasks = totalTasks - completedTasks - failedTasks;

    const successRate = totalTasks > 0 ? `${Math.round((completedTasks / totalTasks) * 100)}%` : 'N/A';

    return {
      totalTasks,
      completedTasks,
      failedTasks,
      pendingTasks,
      successRate,
      avgTaskDuration: metrics.avgTaskDuration,
    };
  }

  /**
   * Start watch mode
   */
  private async startWatchMode(options: StatusOptions): Promise<void> {
    cliLogger.info('Watch mode enabled. Press Ctrl+C to exit');
    cliLogger.newLine();

    const interval = setInterval(async () => {
      // Clear console
      cliLogger.clear();

      // Display updated status
      await this.execute({ ...options, watch: false });
    }, 2000);

    // Handle exit
    process.on('SIGINT', () => {
      clearInterval(interval);
      cliLogger.newLine();
      cliLogger.info('Watch mode stopped');
      process.exit(0);
    });

    // Keep process alive
    return new Promise(() => {});
  }

  /**
   * Get status color based on status
   */
  private getStatusColor(status: string): (text: string) => string {
    const chalk = require('chalk');

    switch (status.toLowerCase()) {
      case 'running':
      case 'active':
        return chalk.green;
      case 'paused':
      case 'waiting':
        return chalk.yellow;
      case 'error':
      case 'failed':
        return chalk.red;
      case 'completed':
      case 'success':
        return chalk.cyan;
      default:
        return chalk.gray;
    }
  }

  /**
   * Format duration from milliseconds
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}

// Export singleton instance
export const statusCommand = new StatusCommand();
