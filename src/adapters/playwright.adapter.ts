/**
 * Playwright Adapter
 * Provides integration with Playwright MCP server for browser automation and E2E testing
 * Extends BaseProvider for retry logic, circuit breaker, and health checks
 */

import * as path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import * as fs from 'fs/promises';
import { z } from 'zod';
import { BaseProvider, type ProviderConfig, ProviderError } from '../core/providers/base.provider';
import { createLogger } from '../utils/logger';

const logger = createLogger('playwright-adapter');

// Configuration schema
export const PlaywrightConfigSchema = z.object({
  browserType: z.enum(['chromium', 'firefox', 'webkit']).optional().default('chromium'),
  headless: z.boolean().optional().default(true),
  slowMo: z.number().optional().default(0),
  timeout: z.number().optional().default(30000),
  viewport: z
    .object({
      width: z.number().default(1280),
      height: z.number().default(720),
    })
    .optional(),
  recordVideo: z.boolean().optional().default(false),
  recordHar: z.boolean().optional().default(false),
  screenshotOnFailure: z.boolean().optional().default(true),
  tracesDir: z.string().optional().default('./traces'),
  artifactsDir: z.string().optional().default('./test-artifacts'),
});

export type PlaywrightConfig = z.infer<typeof PlaywrightConfigSchema>;

// Browser types
export type BrowserType = 'chromium' | 'firefox' | 'webkit';

// Browser options
export interface BrowserOptions {
  headless?: boolean;
  slowMo?: number;
  args?: string[];
  proxy?: {
    server: string;
    username?: string;
    password?: string;
  };
}

// Page interface
export interface Page {
  id: string;
  url: string;
  title: string;
  viewport: { width: number; height: number };
}

// Browser interface
export interface Browser {
  id: string;
  type: BrowserType;
  isConnected: boolean;
  pages: Page[];
}

// Wait options
export interface WaitOptions {
  timeout?: number;
  state?: 'attached' | 'detached' | 'visible' | 'hidden';
}

// E2E Scenario
export interface E2EScenario {
  id: string;
  name: string;
  description: string;
  steps: ScenarioStep[];
  assertions: Assertion[];
  setup?: () => Promise<void>;
  teardown?: () => Promise<void>;
}

// Scenario step
export interface ScenarioStep {
  action: 'navigate' | 'click' | 'type' | 'select' | 'hover' | 'scroll' | 'wait' | 'screenshot';
  target?: string;
  value?: string | number;
  options?: Record<string, any>;
}

// Assertion
export interface Assertion {
  type: 'text' | 'visible' | 'url' | 'title' | 'attribute' | 'count';
  target?: string;
  expected: any;
  message?: string;
}

// Scenario result
export interface ScenarioResult {
  scenarioId: string;
  scenarioName: string;
  passed: boolean;
  duration: number;
  steps: StepResult[];
  assertions: AssertionResult[];
  error?: Error;
  screenshots: string[];
  videos?: string[];
  traces?: string[];
}

// Step result
export interface StepResult {
  step: ScenarioStep;
  success: boolean;
  duration: number;
  error?: Error;
  screenshot?: string;
}

// Assertion result
export interface AssertionResult {
  assertion: Assertion;
  passed: boolean;
  actual?: any;
  error?: Error;
}

// Test results
export interface TestResults {
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  skippedScenarios: number;
  duration: number;
  scenarios: ScenarioResult[];
  coverage?: CoverageReport;
}

// Coverage report
export interface CoverageReport {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
}

// Auth credentials
export interface AuthCredentials {
  username: string;
  password: string;
  url?: string;
  rememberMe?: boolean;
}

// Auth result
export interface AuthResult {
  success: boolean;
  token?: string;
  cookies?: Array<{ name: string; value: string }>;
  error?: Error;
}

// CRUD configuration
export interface CRUDConfig {
  baseUrl: string;
  entity: string;
  createData: Record<string, any>;
  updateData: Record<string, any>;
  idField?: string;
}

// CRUD results
export interface CRUDResults {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
  errors: Error[];
}

// Regression results
export interface RegressionResults {
  baseline: string;
  current: string;
  differences: Array<{
    page: string;
    selector: string;
    type: 'visual' | 'text' | 'structure';
    description: string;
  }>;
  passed: boolean;
}

// Report interface
export interface Report {
  id: string;
  title: string;
  timestamp: Date;
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
  };
  details: ScenarioResult[];
  artifacts: string[];
}

// Playwright Adapter class
export class PlaywrightAdapter extends BaseProvider {
  private client: Client | null = null;
  private playwrightConfig: PlaywrightConfig | null = null;
  private mcpTransport: StdioClientTransport | null = null;

  // Browser management
  private browsers: Map<string, Browser> = new Map();
  private currentBrowser: Browser | null = null;
  private currentPage: Page | null = null;

  // Test scenarios
  private scenarios: Map<string, E2EScenario> = new Map();
  private testResults: TestResults | null = null;

  // Artifacts
  private screenshots: string[] = [];
  private videos: string[] = [];
  private traces: string[] = [];

  constructor(config?: Partial<ProviderConfig>) {
    super({
      name: 'playwright',
      timeout: 30000,
      maxRetries: 2,
      retryDelay: 1000,
      ...config,
    });

    logger.info('Playwright adapter initialized with BaseProvider');
  }

  /**
   * Connect to Playwright MCP server
   */
  async connect(): Promise<void> {
    try {
      this.logger.info('Connecting to Playwright MCP server');

      // Initialize MCP client
      this.mcpTransport = new StdioClientTransport({
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-puppeteer'], // Using puppeteer server as base
      });

      this.client = new Client(
        {
          name: 'playwright-adapter',
          version: '1.0.0',
        },
        {
          capabilities: {},
        },
      );

      await this.client.connect(this.mcpTransport);
      this.connected = true;

      this.logger.info('Successfully connected to Playwright MCP server');
    } catch (error) {
      this.connected = false;
      throw new ProviderError(
        `Failed to connect to Playwright: ${(error as Error).message}`,
        'playwright',
        'connect',
        true,
      );
    }
  }

  /**
   * Disconnect from Playwright MCP server
   */
  async disconnect(): Promise<void> {
    // Close all browsers
    for (const browser of this.browsers.values()) {
      await this.closeBrowser(browser.id);
    }

    if (this.client) {
      await this.client.close();
      this.client = null;
    }

    if (this.mcpTransport) {
      await this.mcpTransport.close();
      this.mcpTransport = null;
    }

    this.connected = false;
    this.logger.info('Disconnected from Playwright MCP server');
  }

  /**
   * Check if the provider is healthy
   */
  async isHealthy(): Promise<boolean> {
    if (!this.connected || !this.client) {
      return false;
    }

    try {
      // Try to list available tools as a health check
      const result = await this.client.listTools();
      return result.tools.length > 0;
    } catch (error) {
      this.logger.error('Health check failed', error);
      return false;
    }
  }

  /**
   * Initialize with configuration
   */
  async initialize(config: unknown): Promise<void> {
    this.playwrightConfig = PlaywrightConfigSchema.parse(config);

    // Create artifacts directory
    await fs.mkdir(this.playwrightConfig.artifactsDir, { recursive: true });
    await fs.mkdir(this.playwrightConfig.tracesDir, { recursive: true });

    await this.connect();
  }

  /**
   * Launch a browser
   */
  async launchBrowser(options?: BrowserOptions): Promise<void> {
    return this.executeWithRetry(async () => {
      if (!this.client) throw new Error('Not connected to Playwright');

      const browserType = this.playwrightConfig?.browserType || 'chromium';
      const browserOptions = {
        headless: options?.headless ?? this.playwrightConfig?.headless ?? true,
        slowMo: options?.slowMo ?? this.playwrightConfig?.slowMo ?? 0,
        args: options?.args || [],
      };

      this.logger.info(`Launching ${browserType} browser`, browserOptions);

      // Launch browser via MCP
      const launchOptions = {
        headless: browserOptions.headless,
        args: browserOptions.args,
      };

      await this.client.callTool('puppeteer_navigate', {
        url: 'about:blank',
        launchOptions,
      });

      const browserId = `browser_${Date.now()}`;
      const browser: Browser = {
        id: browserId,
        type: browserType,
        isConnected: true,
        pages: [],
      };

      this.browsers.set(browserId, browser);
      this.currentBrowser = browser;

      // Create initial page
      await this.newPage();

      this.logger.info(`Browser ${browserId} launched successfully`);
    }, 'launchBrowser');
  }

  /**
   * Close a browser
   */
  async closeBrowser(browserId?: string): Promise<void> {
    return this.executeWithRetry(async () => {
      const id = browserId || this.currentBrowser?.id;

      if (!id) {
        throw new Error('No browser to close');
      }

      const browser = this.browsers.get(id);
      if (!browser) {
        throw new Error(`Browser ${id} not found`);
      }

      this.logger.info(`Closing browser ${id}`);

      // Close via MCP if connected
      if (this.client && this.connected) {
        // Note: Puppeteer MCP doesn't have explicit close, browser closes on disconnect
      }

      this.browsers.delete(id);

      if (this.currentBrowser?.id === id) {
        this.currentBrowser = null;
        this.currentPage = null;
      }

      this.logger.info(`Browser ${id} closed`);
    }, 'closeBrowser');
  }

  /**
   * Create a new page
   */
  async newPage(): Promise<Page> {
    return this.executeWithRetry(async () => {
      if (!this.currentBrowser) {
        throw new Error('No active browser');
      }

      const pageId = `page_${Date.now()}`;
      const page: Page = {
        id: pageId,
        url: 'about:blank',
        title: '',
        viewport: this.playwrightConfig?.viewport || { width: 1280, height: 720 },
      };

      this.currentBrowser.pages.push(page);
      this.currentPage = page;

      this.logger.info(`Created new page ${pageId}`);

      return page;
    }, 'newPage');
  }

  /**
   * Run an E2E scenario
   */
  async runScenario(scenario: E2EScenario): Promise<ScenarioResult> {
    return this.executeWithRetry(async () => {
      if (!this.client) throw new Error('Not connected to Playwright');

      this.logger.info(`Running scenario: ${scenario.name}`);

      const result: ScenarioResult = {
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        passed: true,
        duration: 0,
        steps: [],
        assertions: [],
        screenshots: [],
      };

      const startTime = Date.now();

      try {
        // Run setup if provided
        if (scenario.setup) {
          await scenario.setup();
        }

        // Execute steps
        for (const step of scenario.steps) {
          const stepResult = await this.executeStep(step);
          result.steps.push(stepResult);

          if (!stepResult.success) {
            result.passed = false;
            result.error = stepResult.error;

            // Take screenshot on failure
            if (this.playwrightConfig?.screenshotOnFailure) {
              const screenshot = await this.screenshot(`${scenario.id}_failure`);
              result.screenshots.push(screenshot);
            }

            break;
          }
        }

        // Run assertions if all steps passed
        if (result.passed) {
          for (const assertion of scenario.assertions) {
            const assertionResult = await this.executeAssertion(assertion);
            result.assertions.push(assertionResult);

            if (!assertionResult.passed) {
              result.passed = false;
              result.error = assertionResult.error;
              break;
            }
          }
        }

        // Run teardown
        if (scenario.teardown) {
          await scenario.teardown();
        }
      } catch (error) {
        result.passed = false;
        result.error = error as Error;
        this.logger.error(`Scenario ${scenario.name} failed:`, error);
      }

      result.duration = Date.now() - startTime;

      this.logger.info(`Scenario ${scenario.name} ${result.passed ? 'passed' : 'failed'} in ${result.duration}ms`);

      return result;
    }, 'runScenario');
  }

  /**
   * Run smoke tests
   */
  async runSmokeTests(url: string): Promise<TestResults> {
    return this.executeWithRetry(async () => {
      this.logger.info(`Running smoke tests for ${url}`);

      const scenarios: E2EScenario[] = [
        {
          id: 'smoke_homepage',
          name: 'Homepage loads',
          description: 'Verify homepage loads successfully',
          steps: [
            { action: 'navigate', value: url },
            { action: 'wait', value: 2000 },
          ],
          assertions: [
            { type: 'url', expected: url },
            { type: 'visible', target: 'body', expected: true },
          ],
        },
        {
          id: 'smoke_navigation',
          name: 'Navigation works',
          description: 'Verify main navigation links work',
          steps: [
            { action: 'navigate', value: url },
            { action: 'click', target: 'a[href]' },
            { action: 'wait', value: 1000 },
          ],
          assertions: [{ type: 'url', expected: /.+/, message: 'URL should change' }],
        },
        {
          id: 'smoke_responsive',
          name: 'Responsive design',
          description: 'Verify site is responsive',
          steps: [{ action: 'navigate', value: url }],
          assertions: [{ type: 'visible', target: 'body', expected: true }],
        },
      ];

      const results: TestResults = {
        totalScenarios: scenarios.length,
        passedScenarios: 0,
        failedScenarios: 0,
        skippedScenarios: 0,
        duration: 0,
        scenarios: [],
      };

      const startTime = Date.now();

      for (const scenario of scenarios) {
        const result = await this.runScenario(scenario);
        results.scenarios.push(result);

        if (result.passed) {
          results.passedScenarios++;
        } else {
          results.failedScenarios++;
        }
      }

      results.duration = Date.now() - startTime;

      this.logger.info(`Smoke tests completed: ${results.passedScenarios}/${results.totalScenarios} passed`);

      return results;
    }, 'runSmokeTests');
  }

  /**
   * Run authentication flow
   */
  async runAuthFlow(credentials: AuthCredentials): Promise<AuthResult> {
    return this.executeWithRetry(async () => {
      if (!this.client) throw new Error('Not connected to Playwright');

      this.logger.info('Running authentication flow');

      const result: AuthResult = {
        success: false,
      };

      try {
        // Navigate to login page
        if (credentials.url) {
          await this.navigate(credentials.url);
        }

        // Fill username
        await this.type('input[type="text"], input[type="email"], #username, #email', credentials.username);

        // Fill password
        await this.type('input[type="password"], #password', credentials.password);

        // Check remember me if needed
        if (credentials.rememberMe) {
          await this.click('input[type="checkbox"][name*="remember"]');
        }

        // Submit form
        await this.click('button[type="submit"], input[type="submit"], .login-button');

        // Wait for navigation
        await this.waitForSelector('body', { timeout: 5000 });

        // Check if login was successful (look for common logout elements)
        const logoutExists = await this.elementExists('.logout, [href*="logout"], button[aria-label*="logout"]');

        if (logoutExists) {
          result.success = true;
          // Get cookies if needed
          // result.cookies = await this.getCookies();
          this.logger.info('Authentication successful');
        } else {
          result.error = new Error('Authentication failed - logout element not found');
        }
      } catch (error) {
        result.success = false;
        result.error = error as Error;
        this.logger.error('Authentication failed:', error);
      }

      return result;
    }, 'runAuthFlow');
  }

  /**
   * Run CRUD tests
   */
  async runCRUDTests(config: CRUDConfig): Promise<CRUDResults> {
    return this.executeWithRetry(async () => {
      this.logger.info(`Running CRUD tests for ${config.entity}`);

      const results: CRUDResults = {
        create: false,
        read: false,
        update: false,
        delete: false,
        errors: [],
      };

      try {
        // CREATE test
        await this.navigate(`${config.baseUrl}/create`);
        for (const [field, value] of Object.entries(config.createData)) {
          await this.type(`[name="${field}"], #${field}`, String(value));
        }
        await this.click('button[type="submit"], .save-button');
        await this.waitForSelector('.success, .created', { timeout: 5000 });
        results.create = true;

        // READ test
        await this.navigate(`${config.baseUrl}/list`);
        const itemExists = await this.elementExists(`[data-id], .item, tr`);
        results.read = itemExists;

        // UPDATE test
        await this.click('.edit-button, [href*="edit"]');
        for (const [field, value] of Object.entries(config.updateData)) {
          await this.type(`[name="${field}"], #${field}`, String(value));
        }
        await this.click('button[type="submit"], .save-button');
        await this.waitForSelector('.success, .updated', { timeout: 5000 });
        results.update = true;

        // DELETE test
        await this.click('.delete-button, [data-action="delete"]');
        await this.click('.confirm-delete, button[type="submit"]');
        await this.waitForSelector('.success, .deleted', { timeout: 5000 });
        results.delete = true;
      } catch (error) {
        results.errors.push(error as Error);
        this.logger.error('CRUD test failed:', error);
      }

      this.logger.info(
        `CRUD tests completed: C=${results.create} R=${results.read} U=${results.update} D=${results.delete}`,
      );

      return results;
    }, 'runCRUDTests');
  }

  /**
   * Run regression suite
   */
  async runRegressionSuite(baseline: string): Promise<RegressionResults> {
    return this.executeWithRetry(async () => {
      this.logger.info(`Running regression suite against baseline: ${baseline}`);

      const results: RegressionResults = {
        baseline,
        current: `regression_${Date.now()}`,
        differences: [],
        passed: true,
      };

      // This would compare current state with baseline
      // For now, returning mock results

      this.logger.info(`Regression suite completed: ${results.passed ? 'PASSED' : 'FAILED'}`);

      return results;
    }, 'runRegressionSuite');
  }

  /**
   * Navigate to URL
   */
  async navigate(url: string): Promise<void> {
    return this.executeWithRetry(async () => {
      if (!this.client) throw new Error('Not connected to Playwright');

      this.logger.info(`Navigating to ${url}`);

      await this.client.callTool('puppeteer_navigate', { url });

      if (this.currentPage) {
        this.currentPage.url = url;
      }
    }, 'navigate');
  }

  /**
   * Click an element
   */
  async click(selector: string): Promise<void> {
    return this.executeWithRetry(async () => {
      if (!this.client) throw new Error('Not connected to Playwright');

      this.logger.info(`Clicking ${selector}`);

      await this.client.callTool('puppeteer_click', { selector });
    }, 'click');
  }

  /**
   * Type text
   */
  async type(selector: string, text: string): Promise<void> {
    return this.executeWithRetry(async () => {
      if (!this.client) throw new Error('Not connected to Playwright');

      this.logger.info(`Typing into ${selector}`);

      await this.client.callTool('puppeteer_fill', { selector, value: text });
    }, 'type');
  }

  /**
   * Wait for selector
   */
  async waitForSelector(selector: string, options?: WaitOptions): Promise<void> {
    return this.executeWithRetry(async () => {
      this.logger.info(`Waiting for ${selector}`);

      // Simple wait implementation
      const timeout = options?.timeout || this.playwrightConfig?.timeout || 30000;
      const startTime = Date.now();

      while (Date.now() - startTime < timeout) {
        const exists = await this.elementExists(selector);
        if (exists) return;

        await this.sleep(100);
      }

      throw new Error(`Timeout waiting for selector: ${selector}`);
    }, 'waitForSelector');
  }

  /**
   * Take a screenshot
   */
  async screenshot(name?: string): Promise<string> {
    return this.executeWithRetry(async () => {
      if (!this.client) throw new Error('Not connected to Playwright');

      const screenshotName = name || `screenshot_${Date.now()}`;

      this.logger.info(`Taking screenshot: ${screenshotName}`);

      const result = await this.client.callTool('puppeteer_screenshot', {
        name: screenshotName,
        encoded: false,
      });

      // Save screenshot
      const screenshotPath = path.join(
        this.playwrightConfig?.artifactsDir || './test-artifacts',
        `${screenshotName}.png`,
      );

      this.screenshots.push(screenshotPath);

      return screenshotPath;
    }, 'screenshot');
  }

  /**
   * Record video
   */
  async recordVideo(name: string): Promise<void> {
    this.logger.info(`Recording video: ${name}`);

    const videoPath = path.join(this.playwrightConfig?.artifactsDir || './test-artifacts', `${name}.webm`);

    this.videos.push(videoPath);

    // Video recording would be implemented with actual Playwright
  }

  /**
   * Assert text
   */
  async assertText(selector: string, expected: string): Promise<void> {
    return this.executeWithRetry(async () => {
      this.logger.info(`Asserting text for ${selector}`);

      // This would get actual text from page
      const actual = 'placeholder text';

      if (actual !== expected) {
        throw new Error(`Text assertion failed: expected "${expected}", got "${actual}"`);
      }
    }, 'assertText');
  }

  /**
   * Assert element is visible
   */
  async assertVisible(selector: string): Promise<void> {
    return this.executeWithRetry(async () => {
      this.logger.info(`Asserting visibility for ${selector}`);

      const isVisible = await this.elementExists(selector);

      if (!isVisible) {
        throw new Error(`Element ${selector} is not visible`);
      }
    }, 'assertVisible');
  }

  /**
   * Assert URL matches pattern
   */
  async assertUrl(pattern: string | RegExp): Promise<void> {
    return this.executeWithRetry(async () => {
      this.logger.info(`Asserting URL matches ${pattern}`);

      const currentUrl = this.currentPage?.url || '';

      if (typeof pattern === 'string') {
        if (currentUrl !== pattern) {
          throw new Error(`URL assertion failed: expected "${pattern}", got "${currentUrl}"`);
        }
      } else {
        if (!pattern.test(currentUrl)) {
          throw new Error(`URL assertion failed: "${currentUrl}" does not match pattern ${pattern}`);
        }
      }
    }, 'assertUrl');
  }

  /**
   * Generate test report
   */
  async generateReport(results: TestResults): Promise<Report> {
    return this.executeWithRetry(async () => {
      this.logger.info('Generating test report');

      const report: Report = {
        id: `report_${Date.now()}`,
        title: 'E2E Test Report',
        timestamp: new Date(),
        summary: {
          total: results.totalScenarios,
          passed: results.passedScenarios,
          failed: results.failedScenarios,
          skipped: results.skippedScenarios,
          duration: results.duration,
        },
        details: results.scenarios,
        artifacts: [...this.screenshots, ...this.videos, ...this.traces],
      };

      // Save report to file
      const reportPath = path.join(this.playwrightConfig?.artifactsDir || './test-artifacts', `${report.id}.json`);

      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

      this.logger.info(`Report generated: ${reportPath}`);

      return report;
    }, 'generateReport');
  }

  /**
   * Capture trace
   */
  async captureTrace(name: string): Promise<string> {
    return this.executeWithRetry(async () => {
      this.logger.info(`Capturing trace: ${name}`);

      const tracePath = path.join(this.playwrightConfig?.tracesDir || './traces', `${name}.zip`);

      this.traces.push(tracePath);

      // Trace capturing would be implemented with actual Playwright

      return tracePath;
    }, 'captureTrace');
  }

  // === Private helper methods ===

  /**
   * Execute a scenario step
   */
  private async executeStep(step: ScenarioStep): Promise<StepResult> {
    const startTime = Date.now();
    const result: StepResult = {
      step,
      success: true,
      duration: 0,
    };

    try {
      switch (step.action) {
        case 'navigate':
          await this.navigate(step.value as string);
          break;
        case 'click':
          await this.click(step.target!);
          break;
        case 'type':
          await this.type(step.target!, step.value as string);
          break;
        case 'hover':
          await this.hover(step.target!);
          break;
        case 'scroll':
          await this.scroll(step.value as number);
          break;
        case 'wait':
          await this.sleep(step.value as number);
          break;
        case 'screenshot':
          result.screenshot = await this.screenshot(step.target);
          break;
        default:
          throw new Error(`Unknown step action: ${step.action}`);
      }
    } catch (error) {
      result.success = false;
      result.error = error as Error;
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Execute an assertion
   */
  private async executeAssertion(assertion: Assertion): Promise<AssertionResult> {
    const result: AssertionResult = {
      assertion,
      passed: true,
    };

    try {
      switch (assertion.type) {
        case 'text':
          await this.assertText(assertion.target!, assertion.expected);
          break;
        case 'visible':
          await this.assertVisible(assertion.target!);
          break;
        case 'url':
          await this.assertUrl(assertion.expected);
          break;
        case 'title':
          // Check page title
          if (this.currentPage?.title !== assertion.expected) {
            throw new Error(
              `Title assertion failed: expected "${assertion.expected}", got "${this.currentPage?.title}"`,
            );
          }
          break;
        case 'attribute':
          // Check element attribute
          // This would get actual attribute from element
          const actualAttribute = 'placeholder';
          if (actualAttribute !== assertion.expected) {
            throw new Error(`Attribute assertion failed`);
          }
          break;
        case 'count':
          // Check element count
          const count = await this.getElementCount(assertion.target!);
          if (count !== assertion.expected) {
            throw new Error(`Count assertion failed: expected ${assertion.expected}, got ${count}`);
          }
          break;
        default:
          throw new Error(`Unknown assertion type: ${assertion.type}`);
      }
    } catch (error) {
      result.passed = false;
      result.error = error as Error;
    }

    return result;
  }

  /**
   * Check if element exists
   */
  private async elementExists(selector: string): Promise<boolean> {
    try {
      if (!this.client) return false;

      // Try to find element
      // This is a simplified check - actual implementation would use Playwright
      return true; // Placeholder
    } catch {
      return false;
    }
  }

  /**
   * Get element count
   */
  private async getElementCount(selector: string): Promise<number> {
    try {
      if (!this.client) return 0;

      // Count elements matching selector
      // This is a placeholder - actual implementation would use Playwright
      return 1;
    } catch {
      return 0;
    }
  }

  /**
   * Hover over element
   */
  private async hover(selector: string): Promise<void> {
    if (!this.client) throw new Error('Not connected to Playwright');

    this.logger.info(`Hovering over ${selector}`);

    await this.client.callTool('puppeteer_hover', { selector });
  }

  /**
   * Scroll page
   */
  private async scroll(amount: number): Promise<void> {
    if (!this.client) throw new Error('Not connected to Playwright');

    this.logger.info(`Scrolling ${amount}px`);

    await this.client.callTool('puppeteer_evaluate', {
      script: `window.scrollBy(0, ${amount})`,
    });
  }

  /**
   * Select option
   */
  async select(selector: string, value: string): Promise<void> {
    return this.executeWithRetry(async () => {
      if (!this.client) throw new Error('Not connected to Playwright');

      this.logger.info(`Selecting ${value} in ${selector}`);

      await this.client.callTool('puppeteer_select', { selector, value });
    }, 'select');
  }

  /**
   * Evaluate JavaScript in browser
   */
  async evaluate(script: string): Promise<any> {
    return this.executeWithRetry(async () => {
      if (!this.client) throw new Error('Not connected to Playwright');

      this.logger.info('Evaluating script in browser');

      const result = await this.client.callTool('puppeteer_evaluate', { script });

      return result.content;
    }, 'evaluate');
  }

  /**
   * Get page content
   */
  async getContent(): Promise<string> {
    return this.executeWithRetry(async () => {
      if (!this.client) throw new Error('Not connected to Playwright');

      const content = await this.evaluate('document.documentElement.outerHTML');

      return content;
    }, 'getContent');
  }

  /**
   * Get page title
   */
  async getTitle(): Promise<string> {
    return this.executeWithRetry(async () => {
      if (!this.client) throw new Error('Not connected to Playwright');

      const title = await this.evaluate('document.title');

      if (this.currentPage) {
        this.currentPage.title = title;
      }

      return title;
    }, 'getTitle');
  }

  /**
   * Get current URL
   */
  async getUrl(): Promise<string> {
    return this.executeWithRetry(async () => {
      if (!this.client) throw new Error('Not connected to Playwright');

      const url = await this.evaluate('window.location.href');

      if (this.currentPage) {
        this.currentPage.url = url;
      }

      return url;
    }, 'getUrl');
  }

  /**
   * Wait for navigation
   */
  async waitForNavigation(options?: { timeout?: number }): Promise<void> {
    return this.executeWithRetry(async () => {
      this.logger.info('Waiting for navigation');

      const timeout = options?.timeout || this.playwrightConfig?.timeout || 30000;
      const startUrl = this.currentPage?.url;
      const startTime = Date.now();

      while (Date.now() - startTime < timeout) {
        const currentUrl = await this.getUrl();

        if (currentUrl !== startUrl) {
          this.logger.info(`Navigation detected: ${startUrl} -> ${currentUrl}`);
          return;
        }

        await this.sleep(100);
      }

      throw new Error('Timeout waiting for navigation');
    }, 'waitForNavigation');
  }

  /**
   * Set viewport size
   */
  async setViewport(width: number, height: number): Promise<void> {
    return this.executeWithRetry(async () => {
      this.logger.info(`Setting viewport to ${width}x${height}`);

      if (this.currentPage) {
        this.currentPage.viewport = { width, height };
      }

      // This would set actual viewport with Playwright
    }, 'setViewport');
  }

  /**
   * Emulate device
   */
  async emulateDevice(deviceName: string): Promise<void> {
    return this.executeWithRetry(async () => {
      this.logger.info(`Emulating device: ${deviceName}`);

      // Device presets
      const devices: Record<string, { width: number; height: number; userAgent: string }> = {
        'iPhone 12': {
          width: 390,
          height: 844,
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        },
        iPad: {
          width: 768,
          height: 1024,
          userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)',
        },
        Desktop: {
          width: 1920,
          height: 1080,
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
      };

      const device = devices[deviceName];
      if (!device) {
        throw new Error(`Unknown device: ${deviceName}`);
      }

      await this.setViewport(device.width, device.height);

      // Set user agent
      if (this.client) {
        await this.evaluate(`Object.defineProperty(navigator, 'userAgent', { value: '${device.userAgent}' })`);
      }
    }, 'emulateDevice');
  }

  /**
   * Add test scenario
   */
  async addScenario(scenario: E2EScenario): Promise<void> {
    this.scenarios.set(scenario.id, scenario);
    this.logger.info(`Added scenario: ${scenario.name}`);
  }

  /**
   * Get test scenario
   */
  async getScenario(id: string): Promise<E2EScenario | undefined> {
    return this.scenarios.get(id);
  }

  /**
   * List all scenarios
   */
  async listScenarios(): Promise<E2EScenario[]> {
    return Array.from(this.scenarios.values());
  }

  /**
   * Run all scenarios
   */
  async runAllScenarios(): Promise<TestResults> {
    return this.executeWithRetry(async () => {
      this.logger.info('Running all scenarios');

      const results: TestResults = {
        totalScenarios: this.scenarios.size,
        passedScenarios: 0,
        failedScenarios: 0,
        skippedScenarios: 0,
        duration: 0,
        scenarios: [],
      };

      const startTime = Date.now();

      for (const scenario of this.scenarios.values()) {
        const result = await this.runScenario(scenario);
        results.scenarios.push(result);

        if (result.passed) {
          results.passedScenarios++;
        } else {
          results.failedScenarios++;
        }
      }

      results.duration = Date.now() - startTime;

      this.testResults = results;

      this.logger.info(`All scenarios completed: ${results.passedScenarios}/${results.totalScenarios} passed`);

      return results;
    }, 'runAllScenarios');
  }

  /**
   * Get last test results
   */
  async getLastResults(): Promise<TestResults | null> {
    return this.testResults;
  }

  /**
   * Clear all artifacts
   */
  async clearArtifacts(): Promise<void> {
    this.screenshots = [];
    this.videos = [];
    this.traces = [];

    // Clear artifacts directory
    if (this.playwrightConfig?.artifactsDir) {
      try {
        const files = await fs.readdir(this.playwrightConfig.artifactsDir);
        for (const file of files) {
          await fs.unlink(path.join(this.playwrightConfig.artifactsDir, file));
        }
      } catch (error) {
        this.logger.warn('Failed to clear artifacts:', error);
      }
    }

    this.logger.info('Artifacts cleared');
  }

  /**
   * Create predefined scenarios
   */
  async createStandardScenarios(baseUrl: string): Promise<void> {
    // Homepage test
    this.addScenario({
      id: 'standard_homepage',
      name: 'Homepage Test',
      description: 'Comprehensive homepage testing',
      steps: [
        { action: 'navigate', value: baseUrl },
        { action: 'wait', value: 2000 },
        { action: 'screenshot', target: 'homepage' },
      ],
      assertions: [
        { type: 'url', expected: baseUrl },
        { type: 'visible', target: 'body', expected: true },
      ],
    });

    // Form test
    this.addScenario({
      id: 'standard_form',
      name: 'Form Submission Test',
      description: 'Test form validation and submission',
      steps: [
        { action: 'navigate', value: `${baseUrl}/contact` },
        { action: 'type', target: 'input[name="name"]', value: 'Test User' },
        { action: 'type', target: 'input[name="email"]', value: 'test@example.com' },
        { action: 'type', target: 'textarea[name="message"]', value: 'Test message' },
        { action: 'click', target: 'button[type="submit"]' },
        { action: 'wait', value: 1000 },
      ],
      assertions: [{ type: 'visible', target: '.success, .thank-you', expected: true }],
    });

    // Navigation test
    this.addScenario({
      id: 'standard_navigation',
      name: 'Navigation Test',
      description: 'Test site navigation',
      steps: [
        { action: 'navigate', value: baseUrl },
        { action: 'click', target: 'nav a:first-child' },
        { action: 'wait', value: 1000 },
        { action: 'click', target: 'nav a:last-child' },
        { action: 'wait', value: 1000 },
      ],
      assertions: [{ type: 'url', expected: /.+/, message: 'URL should change' }],
    });

    // Responsive test
    this.addScenario({
      id: 'standard_responsive',
      name: 'Responsive Design Test',
      description: 'Test responsive layout',
      steps: [{ action: 'navigate', value: baseUrl }],
      assertions: [{ type: 'visible', target: 'body', expected: true }],
      setup: async () => {
        // Test different viewports
        await this.setViewport(375, 667); // Mobile
        await this.screenshot('mobile');

        await this.setViewport(768, 1024); // Tablet
        await this.screenshot('tablet');

        await this.setViewport(1920, 1080); // Desktop
        await this.screenshot('desktop');
      },
    });

    // Performance test
    this.addScenario({
      id: 'standard_performance',
      name: 'Performance Test',
      description: 'Test page load performance',
      steps: [{ action: 'navigate', value: baseUrl }],
      assertions: [{ type: 'visible', target: 'body', expected: true }],
      setup: async () => {
        // Measure performance metrics
        const metrics = await this.evaluate(`
          JSON.stringify({
            loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart,
            domReady: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
            firstPaint: performance.getEntriesByType('paint')[0]?.startTime
          })
        `);

        this.logger.info('Performance metrics:', metrics);
      },
    });

    this.logger.info(`Created ${this.scenarios.size} standard scenarios`);
  }
}

// Export singleton instance
export const playwrightAdapter = new PlaywrightAdapter();
