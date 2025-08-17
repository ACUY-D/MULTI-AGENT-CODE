/**
 * Lint Command
 * Runs linting and formatting checks
 */

import { type ChildProcess, spawn } from 'child_process';
import { createLogger } from '@utils/logger';
import { getLogger } from '../utils/logger';

const cliLogger = getLogger();
const logger = createLogger('lint-command');

export interface LintOptions {
  fix?: boolean;
  verbose?: boolean;
}

export class LintCommand {
  private lintProcess?: ChildProcess;

  /**
   * Execute the lint command
   */
  async execute(options: LintOptions): Promise<void> {
    try {
      if (options.verbose) {
        cliLogger.setDebugMode(true);
      }

      const action = options.fix ? 'Fixing' : 'Checking';
      const spinner = cliLogger.startSpinner(`${action} code style and formatting...`);

      try {
        const results = await this.runLinter(options.fix || false);

        if (results.hasIssues && !options.fix) {
          cliLogger.spinnerWarn('Linting issues found');
        } else if (options.fix) {
          cliLogger.spinnerSuccess('Code style fixed');
        } else {
          cliLogger.spinnerSuccess('No linting issues found');
        }

        // Display results
        this.displayResults(results);

        // Exit with appropriate code
        process.exit(results.hasIssues && !options.fix ? 1 : 0);
      } catch (error) {
        cliLogger.spinnerFail('Linting failed');
        throw error;
      }
    } catch (error) {
      cliLogger.error(`Linting failed: ${error}`);
      logger.error({ error }, 'Lint command failed');
      process.exit(1);
    }
  }

  /**
   * Run linter (biome)
   */
  private async runLinter(fix: boolean): Promise<any> {
    return new Promise((resolve, reject) => {
      const args = ['check'];

      if (fix) {
        args.push('--apply');
      }

      args.push('.');

      this.lintProcess = spawn('biome', args, {
        stdio: 'pipe',
        cwd: process.cwd(),
      });

      let output = '';
      let errorOutput = '';
      let hasIssues = false;

      this.lintProcess.stdout?.on('data', (data) => {
        output += data.toString();
      });

      this.lintProcess.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      this.lintProcess.on('close', (code) => {
        hasIssues = code !== 0;

        const results = {
          hasIssues,
          output,
          errorOutput,
          filesChecked: this.extractFileCount(output),
          issuesFound: this.extractIssueCount(output),
          issuesFixed: fix ? this.extractFixedCount(output) : 0,
        };

        resolve(results);
      });

      this.lintProcess.on('error', (error) => {
        // Try fallback to ESLint if biome not found
        this.runESLint(fix).then(resolve).catch(reject);
      });
    });
  }

  /**
   * Fallback to ESLint
   */
  private async runESLint(fix: boolean): Promise<any> {
    return new Promise((resolve, reject) => {
      const args = ['.', '--ext', '.ts,.tsx,.js,.jsx'];

      if (fix) {
        args.push('--fix');
      }

      const eslintProcess = spawn('eslint', args, {
        stdio: 'pipe',
        cwd: process.cwd(),
      });

      let output = '';
      let errorOutput = '';

      eslintProcess.stdout?.on('data', (data) => {
        output += data.toString();
      });

      eslintProcess.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      eslintProcess.on('close', (code) => {
        const results = {
          hasIssues: code !== 0,
          output,
          errorOutput,
          filesChecked: 0,
          issuesFound: 0,
          issuesFixed: 0,
        };

        resolve(results);
      });

      eslintProcess.on('error', reject);
    });
  }

  /**
   * Extract file count from output
   */
  private extractFileCount(output: string): number {
    const match = output.match(/Checked (\d+) file/);
    return match ? Number.parseInt(match[1]) : 0;
  }

  /**
   * Extract issue count from output
   */
  private extractIssueCount(output: string): number {
    const match = output.match(/Found (\d+) (error|warning|issue)/i);
    return match ? Number.parseInt(match[1]) : 0;
  }

  /**
   * Extract fixed count from output
   */
  private extractFixedCount(output: string): number {
    const match = output.match(/Fixed (\d+) (error|warning|issue)/i);
    return match ? Number.parseInt(match[1]) : 0;
  }

  /**
   * Display linting results
   */
  private displayResults(results: any): void {
    cliLogger.newLine();

    if (results.filesChecked > 0) {
      cliLogger.info(`Checked ${results.filesChecked} file(s)`);
    }

    if (results.hasIssues) {
      if (results.issuesFixed > 0) {
        cliLogger.success(`Fixed ${results.issuesFixed} issue(s)`);
      } else if (results.issuesFound > 0) {
        cliLogger.warning(`Found ${results.issuesFound} issue(s)`);
        cliLogger.info('Run with --fix to automatically fix issues');
      }

      if (results.output && results.hasIssues) {
        cliLogger.newLine();
        console.log(results.output);
      }
    } else {
      cliLogger.success('✨ No linting issues found!');
    }
  }
}

// Export singleton instance
export const lintCommand = new LintCommand();
