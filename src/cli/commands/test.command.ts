/**
 * Test Command
 * Runs test suites (unit, integration, e2e)
 */

import { type ChildProcess, spawn } from 'child_process';
import { createLogger } from '@utils/logger';
import { CLIConfig } from '../utils/config';
import { getLogger } from '../utils/logger';

const cliLogger = getLogger();
const logger = createLogger('test-command');

export interface TestOptions {
  suite?: 'unit' | 'integration' | 'e2e' | 'all';
  coverage?: boolean;
  watch?: boolean;
  verbose?: boolean;
}

export class TestCommand {
  private testProcess?: ChildProcess;

  /**
   * Execute the test command
   */
  async execute(options: TestOptions): Promise<void> {
    try {
      // Load configuration
      const config = await CLIConfig.load({
        test: {
          suite: options.suite || 'all',
          coverage: options.coverage || false,
          watch: options.watch || false,
        },
      });

      if (options.verbose) {
        cliLogger.setDebugMode(true);
      }

      cliLogger.box('Running Tests', [
        `Suite: ${config.test.suite}`,
        `Coverage: ${config.test.coverage ? 'Enabled' : 'Disabled'}`,
        `Watch: ${config.test.watch ? 'Enabled' : 'Disabled'}`,
      ]);

      const spinner = cliLogger.startSpinner(`Running ${config.test.suite} tests...`);

      try {
        const results = await this.runTests(config.test);

        cliLogger.spinnerSuccess('Tests completed');

        // Display results
        this.displayResults(results);

        // Generate coverage report if enabled
        if (config.test.coverage) {
          await this.generateCoverageReport();
        }

        // Exit with appropriate code
        process.exit(results.failed > 0 ? 1 : 0);
      } catch (error) {
        cliLogger.spinnerFail('Tests failed');
        throw error;
      }
    } catch (error) {
      cliLogger.error(`Test execution failed: ${error}`);
      logger.error({ error }, 'Test command failed');
      process.exit(1);
    }
  }

  /**
   * Run tests based on suite
   */
  private async runTests(config: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const args: string[] = [];

      // Suite-specific configuration
      switch (config.suite) {
        case 'unit':
          args.push('run', 'tests/unit');
          break;
        case 'integration':
          args.push('run', 'tests/integration');
          break;
        case 'e2e':
          // Use playwright for e2e tests
          this.testProcess = spawn('npx', ['playwright', 'test'], {
            stdio: 'pipe',
            cwd: process.cwd(),
          });
          break;
        case 'all':
        default:
          args.push('run');
          break;
      }

      // Add coverage flag
      if (config.coverage) {
        args.push('--coverage');
      }

      // Add watch flag
      if (config.watch) {
        args.push('--watch');
      }

      // Run vitest for unit/integration tests
      if (config.suite !== 'e2e') {
        this.testProcess = spawn('vitest', args, {
          stdio: 'pipe',
          cwd: process.cwd(),
        });
      }

      let output = '';
      let errorOutput = '';

      this.testProcess!.stdout?.on('data', (data) => {
        output += data.toString();
        if (config.watch) {
          process.stdout.write(data);
        }
      });

      this.testProcess!.stderr?.on('data', (data) => {
        errorOutput += data.toString();
        if (config.watch) {
          process.stderr.write(data);
        }
      });

      this.testProcess!.on('close', (code) => {
        // Parse test results from output
        const results = this.parseTestResults(output);

        if (code === 0) {
          resolve(results);
        } else {
          reject(new Error(`Tests exited with code ${code}\n${errorOutput}`));
        }
      });

      this.testProcess!.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Parse test results from output
   */
  private parseTestResults(output: string): any {
    // Simple parsing - can be enhanced based on actual output format
    const results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: '0ms',
    };

    // Extract test counts from output
    const passMatch = output.match(/(\d+) pass/);
    const failMatch = output.match(/(\d+) fail/);
    const skipMatch = output.match(/(\d+) skip/);
    const durationMatch = output.match(/Duration:\s+([\d.]+\w+)/);

    if (passMatch) results.passed = Number.parseInt(passMatch[1]);
    if (failMatch) results.failed = Number.parseInt(failMatch[1]);
    if (skipMatch) results.skipped = Number.parseInt(skipMatch[1]);
    if (durationMatch) results.duration = durationMatch[1];

    results.total = results.passed + results.failed + results.skipped;

    return results;
  }

  /**
   * Display test results
   */
  private displayResults(results: any): void {
    cliLogger.newLine();
    cliLogger.box('Test Results', []);

    const data = [
      ['Total', results.total.toString()],
      ['Passed', `✅ ${results.passed}`],
      ['Failed', `❌ ${results.failed}`],
      ['Skipped', `⚠️  ${results.skipped}`],
      ['Duration', results.duration],
    ];

    cliLogger.table(data, {
      head: ['Metric', 'Value'],
      colWidths: [15, 20],
    });

    if (results.failed > 0) {
      cliLogger.error(`${results.failed} test(s) failed`);
    } else {
      cliLogger.success('All tests passed!');
    }
  }

  /**
   * Generate coverage report
   */
  private async generateCoverageReport(): Promise<void> {
    cliLogger.info('Generating coverage report...');

    // Coverage is generated by vitest automatically
    // Display coverage summary
    cliLogger.newLine();
    cliLogger.info('Coverage Report:');
    cliLogger.list([
      'HTML report: coverage/index.html',
      'JSON report: coverage/coverage-final.json',
      'Text summary: coverage/coverage-summary.txt',
    ]);
  }
}

// Export singleton instance
export const testCommand = new TestCommand();
