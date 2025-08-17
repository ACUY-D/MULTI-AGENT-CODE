/**
 * CLI Logger with colors and formatting
 * Provides formatted console output for CLI operations
 */

import chalk from 'chalk';
import Table from 'cli-table3';
import ora, { type Ora } from 'ora';

export type LogLevel = 'info' | 'success' | 'error' | 'warning' | 'debug';

export interface TableOptions {
  head?: string[];
  colWidths?: number[];
  style?: {
    head?: string[];
    border?: string[];
  };
}

export class CLILogger {
  private spinner: Ora | null = null;
  private debugMode = false;

  constructor(debugMode = false) {
    this.debugMode = debugMode;
  }

  /**
   * Log info message
   */
  info(message: string): void {
    console.log(chalk.blue('ℹ'), message);
  }

  /**
   * Log success message
   */
  success(message: string): void {
    console.log(chalk.green('✅'), message);
  }

  /**
   * Log error message
   */
  error(message: string | Error): void {
    const msg = message instanceof Error ? message.message : message;
    console.error(chalk.red('❌'), chalk.red(msg));

    if (message instanceof Error && this.debugMode && message.stack) {
      console.error(chalk.gray(message.stack));
    }
  }

  /**
   * Log warning message
   */
  warning(message: string): void {
    console.warn(chalk.yellow('⚠️'), chalk.yellow(message));
  }

  /**
   * Log debug message (only if debug mode is enabled)
   */
  debug(message: string): void {
    if (this.debugMode) {
      console.log(chalk.gray('[DEBUG]'), chalk.gray(message));
    }
  }

  /**
   * Start a spinner for long-running operations
   */
  startSpinner(text: string): Ora {
    if (this.spinner) {
      this.spinner.stop();
    }
    this.spinner = ora({
      text,
      spinner: 'dots',
    }).start();
    return this.spinner;
  }

  /**
   * Update spinner text
   */
  updateSpinner(text: string): void {
    if (this.spinner) {
      this.spinner.text = text;
    }
  }

  /**
   * Stop spinner with success
   */
  spinnerSuccess(text?: string): void {
    if (this.spinner) {
      this.spinner.succeed(text);
      this.spinner = null;
    }
  }

  /**
   * Stop spinner with failure
   */
  spinnerFail(text?: string): void {
    if (this.spinner) {
      this.spinner.fail(text);
      this.spinner = null;
    }
  }

  /**
   * Stop spinner with warning
   */
  spinnerWarn(text?: string): void {
    if (this.spinner) {
      this.spinner.warn(text);
      this.spinner = null;
    }
  }

  /**
   * Stop spinner without status
   */
  spinnerStop(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  /**
   * Display data in a table format
   */
  table(data: any[], options?: TableOptions): void {
    const table = new Table({
      head: options?.head || [],
      colWidths: options?.colWidths,
      style: {
        head: options?.style?.head || ['cyan'],
        border: options?.style?.border || ['gray'],
      },
    });

    // Add data rows
    data.forEach((row) => {
      if (Array.isArray(row)) {
        table.push(row);
      } else {
        table.push(Object.values(row));
      }
    });

    console.log(table.toString());
  }

  /**
   * Display a box with content
   */
  box(title: string, content: string | string[]): void {
    console.log(chalk.cyan('┌─' + '─'.repeat(title.length + 2) + '─┐'));
    console.log(chalk.cyan('│ ') + chalk.bold(title) + chalk.cyan(' │'));
    console.log(chalk.cyan('└─' + '─'.repeat(title.length + 2) + '─┘'));

    const lines = Array.isArray(content) ? content : [content];
    lines.forEach((line) => {
      console.log('  ' + line);
    });
  }

  /**
   * Display a progress bar
   */
  progress(current: number, total: number, label?: string): void {
    const percentage = Math.round((current / total) * 100);
    const filled = Math.round((current / total) * 30);
    const empty = 30 - filled;

    const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
    const text = label ? `${label}: ` : '';

    process.stdout.write(`\r${text}${bar} ${percentage}%`);

    if (current === total) {
      console.log(); // New line when complete
    }
  }

  /**
   * Display a list with bullets
   */
  list(items: string[], ordered = false): void {
    items.forEach((item, index) => {
      const bullet = ordered ? chalk.cyan(`${index + 1}.`) : chalk.cyan('•');
      console.log(`  ${bullet} ${item}`);
    });
  }

  /**
   * Display a tree structure
   */
  tree(data: any, indent = '', isLast = true): void {
    const prefix = isLast ? '└── ' : '├── ';
    const connector = isLast ? '    ' : '│   ';

    if (typeof data === 'object' && data !== null) {
      const entries = Object.entries(data);
      entries.forEach(([key, value], index) => {
        const last = index === entries.length - 1;
        console.log(chalk.gray(indent + prefix) + chalk.white(key));

        if (typeof value === 'object' && value !== null) {
          this.tree(value, indent + connector, last);
        } else {
          console.log(chalk.gray(indent + connector + '    └── ') + chalk.gray(String(value)));
        }
      });
    } else {
      console.log(chalk.gray(indent + prefix) + chalk.white(String(data)));
    }
  }

  /**
   * Clear the console
   */
  clear(): void {
    console.clear();
  }

  /**
   * New line
   */
  newLine(count = 1): void {
    for (let i = 0; i < count; i++) {
      console.log();
    }
  }

  /**
   * Divider line
   */
  divider(char = '─', length = 50): void {
    console.log(chalk.gray(char.repeat(length)));
  }

  /**
   * Enable/disable debug mode
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }
}

// Singleton instance
let loggerInstance: CLILogger;

/**
 * Get or create logger instance
 */
export function getLogger(debugMode?: boolean): CLILogger {
  if (!loggerInstance) {
    loggerInstance = new CLILogger(debugMode);
  } else if (debugMode !== undefined) {
    loggerInstance.setDebugMode(debugMode);
  }
  return loggerInstance;
}

// Export default instance
export default getLogger();
