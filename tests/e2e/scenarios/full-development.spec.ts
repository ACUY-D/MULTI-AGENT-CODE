import { exec } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { promisify } from 'util';
import { Page, expect, test } from '@playwright/test';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';

const execAsync = promisify(exec);

// Test configuration
const TEST_PROJECT_DIR = join(process.cwd(), '.tmp-e2e-test');
const CLI_PATH = join(process.cwd(), 'dist', 'cli', 'index.js');

test.describe('Full Development Workflow E2E', () => {
  // Setup and teardown
  test.beforeAll(async () => {
    // Build the project
    await execAsync('npm run build');

    // Create test directory
    if (!existsSync(TEST_PROJECT_DIR)) {
      await mkdir(TEST_PROJECT_DIR, { recursive: true });
    }
  });

  test.afterAll(async () => {
    // Cleanup test directory
    if (existsSync(TEST_PROJECT_DIR)) {
      await rm(TEST_PROJECT_DIR, { recursive: true, force: true });
    }
  });

  test('complete development workflow from init to deployment', async ({ page }) => {
    // Step 1: Initialize project
    const initResult = await execAsync(`node ${CLI_PATH} init --template typescript --name test-project`, {
      cwd: TEST_PROJECT_DIR,
    });

    expect(initResult.stdout).toContain('Project initialized successfully');
    expect(existsSync(join(TEST_PROJECT_DIR, 'mcp-orchestrator.config.json'))).toBe(true);

    // Step 2: Configure project
    const config = {
      name: 'test-project',
      objective: 'Build a TODO API with authentication',
      mode: 'dry-run',
      agents: {
        architect: { enabled: true },
        developer: { enabled: true },
        tester: { enabled: true },
        debugger: { enabled: true },
      },
      github: {
        enabled: false, // Disable for testing
      },
    };

    await writeFile(join(TEST_PROJECT_DIR, 'mcp-orchestrator.config.json'), JSON.stringify(config, null, 2));

    // Step 3: Run BMAD pipeline
    const runResult = await execAsync(`node ${CLI_PATH} run --mode dry-run --verbose`, {
      cwd: TEST_PROJECT_DIR,
      timeout: 120000, // 2 minutes timeout
    });

    expect(runResult.stdout).toContain('Pipeline started');
    expect(runResult.stdout).toContain('Brainstorming phase completed');
    expect(runResult.stdout).toContain('Architecture phase completed');
    expect(runResult.stdout).toContain('Development phase completed');
    expect(runResult.stdout).toContain('Testing phase completed');
    expect(runResult.stdout).toContain('Pipeline completed successfully');

    // Step 4: Verify artifacts
    const artifactsDir = join(TEST_PROJECT_DIR, 'artifacts');
    expect(existsSync(artifactsDir)).toBe(true);

    // Check architecture artifacts
    expect(existsSync(join(artifactsDir, 'architecture', 'overview.md'))).toBe(true);
    expect(existsSync(join(artifactsDir, 'architecture', 'adrs'))).toBe(true);

    // Check development artifacts
    expect(existsSync(join(artifactsDir, 'src'))).toBe(true);
    expect(existsSync(join(artifactsDir, 'tests'))).toBe(true);

    // Step 5: Check status
    const statusResult = await execAsync(`node ${CLI_PATH} status --format json`, { cwd: TEST_PROJECT_DIR });

    const status = JSON.parse(statusResult.stdout);
    expect(status.lastRun).toBeDefined();
    expect(status.lastRun.success).toBe(true);
    expect(status.lastRun.phasesCompleted).toHaveLength(4);

    // Step 6: Run tests
    const testResult = await execAsync(`node ${CLI_PATH} test --suite all`, { cwd: TEST_PROJECT_DIR });

    expect(testResult.stdout).toContain('Tests completed');

    // Step 7: Build project
    const buildResult = await execAsync(`node ${CLI_PATH} build`, { cwd: TEST_PROJECT_DIR });

    expect(buildResult.stdout).toContain('Build completed');
    expect(existsSync(join(TEST_PROJECT_DIR, 'dist'))).toBe(true);
  });

  test('interactive mode with user confirmations', async ({ page }) => {
    // Navigate to web UI (if available)
    await page.goto('http://localhost:3000');

    // Step 1: Create new project
    await page.click('[data-testid="new-project-btn"]');

    // Fill project details
    await page.fill('[data-testid="project-name"]', 'interactive-test');
    await page.fill('[data-testid="project-objective"]', 'Build a blog platform with CMS');
    await page.selectOption('[data-testid="project-mode"]', 'semi');

    await page.click('[data-testid="create-project-btn"]');

    // Step 2: Start pipeline
    await page.click('[data-testid="run-pipeline-btn"]');

    // Step 3: Brainstorming phase
    await expect(page.locator('[data-testid="current-phase"]')).toContainText('Brainstorming');
    await expect(page.locator('[data-testid="phase-status"]')).toContainText('In Progress');

    // Wait for confirmation prompt
    await expect(page.locator('[data-testid="confirmation-dialog"]')).toBeVisible();
    await page.click('[data-testid="confirm-btn"]');

    // Step 4: Architecture phase
    await expect(page.locator('[data-testid="current-phase"]')).toContainText('Architecture');

    // Review architecture
    await expect(page.locator('[data-testid="architecture-diagram"]')).toBeVisible();
    await expect(page.locator('[data-testid="component-list"]')).toBeVisible();

    // Confirm architecture
    await page.click('[data-testid="approve-architecture-btn"]');

    // Step 5: Development phase
    await expect(page.locator('[data-testid="current-phase"]')).toContainText('Development');

    // Monitor progress
    await expect(page.locator('[data-testid="files-created"]')).toBeVisible();
    const filesCount = await page.locator('[data-testid="files-count"]').textContent();
    expect(Number.parseInt(filesCount || '0')).toBeGreaterThan(0);

    // Step 6: Testing phase
    await expect(page.locator('[data-testid="current-phase"]')).toContainText('Testing');

    // View test results
    await expect(page.locator('[data-testid="test-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="test-passed"]')).toBeVisible();

    // Step 7: Completion
    await expect(page.locator('[data-testid="pipeline-status"]')).toContainText('Completed');

    // Verify summary
    await expect(page.locator('[data-testid="summary-artifacts"]')).toBeVisible();
    await expect(page.locator('[data-testid="summary-metrics"]')).toBeVisible();

    // Download artifacts
    await page.click('[data-testid="download-artifacts-btn"]');
    const download = await page.waitForEvent('download');
    expect(download.suggestedFilename()).toContain('artifacts');
  });

  test('real-time monitoring and logs', async ({ page }) => {
    // Start a long-running pipeline
    const pipelinePromise = execAsync(`node ${CLI_PATH} run --mode auto --verbose`, { cwd: TEST_PROJECT_DIR });

    // Navigate to monitoring page
    await page.goto('http://localhost:3000/monitor');

    // Verify real-time updates
    await expect(page.locator('[data-testid="pipeline-running"]')).toBeVisible();

    // Check log streaming
    const logContainer = page.locator('[data-testid="log-container"]');
    await expect(logContainer).toBeVisible();

    // Verify logs are updating
    const initialLogCount = await logContainer.locator('.log-entry').count();
    await page.waitForTimeout(2000);
    const updatedLogCount = await logContainer.locator('.log-entry').count();
    expect(updatedLogCount).toBeGreaterThan(initialLogCount);

    // Check phase progress indicators
    await expect(page.locator('[data-testid="phase-progress-bar"]')).toBeVisible();

    // Monitor metrics
    await expect(page.locator('[data-testid="tokens-used"]')).toBeVisible();
    await expect(page.locator('[data-testid="execution-time"]')).toBeVisible();

    // Wait for completion
    await pipelinePromise;
  });

  test('multi-project management', async ({ page }) => {
    // Create multiple projects
    const projects = [
      { name: 'api-service', objective: 'REST API with GraphQL' },
      { name: 'web-app', objective: 'React dashboard application' },
      { name: 'mobile-app', objective: 'React Native mobile app' },
    ];

    for (const project of projects) {
      await execAsync(`node ${CLI_PATH} init --name ${project.name}`, { cwd: TEST_PROJECT_DIR });
    }

    // Navigate to projects dashboard
    await page.goto('http://localhost:3000/projects');

    // Verify all projects are listed
    for (const project of projects) {
      await expect(page.locator(`[data-testid="project-${project.name}"]`)).toBeVisible();
    }

    // Run pipeline for each project
    for (const project of projects) {
      await page.click(`[data-testid="project-${project.name}"]`);
      await page.click('[data-testid="run-pipeline-btn"]');

      // Wait for completion
      await expect(page.locator('[data-testid="pipeline-status"]')).toContainText('Completed', {
        timeout: 60000,
      });

      // Go back to projects list
      await page.click('[data-testid="back-to-projects"]');
    }

    // Verify all projects completed
    const completedProjects = await page.locator('.project-completed').count();
    expect(completedProjects).toBe(projects.length);
  });

  test('GitHub integration workflow', async ({ page }) => {
    // Skip if no GitHub token
    if (!process.env.GITHUB_TOKEN) {
      test.skip();
      return;
    }

    // Configure GitHub integration
    const config = {
      github: {
        enabled: true,
        owner: 'test-owner',
        repo: 'test-repo',
        branch: 'main',
        createPR: true,
      },
    };

    await writeFile(join(TEST_PROJECT_DIR, 'mcp-orchestrator.config.json'), JSON.stringify(config, null, 2));

    // Run pipeline with GitHub integration
    const result = await execAsync(`node ${CLI_PATH} run --mode auto --generate-pr`, {
      cwd: TEST_PROJECT_DIR,
      env: { ...process.env, GITHUB_TOKEN: process.env.GITHUB_TOKEN },
    });

    expect(result.stdout).toContain('Pull request created');

    // Extract PR URL from output
    const prUrlMatch = result.stdout.match(/https:\/\/github\.com\/.*\/pull\/\d+/);
    expect(prUrlMatch).toBeTruthy();

    if (prUrlMatch) {
      // Navigate to PR
      await page.goto(prUrlMatch[0]);

      // Verify PR details
      await expect(page.locator('.js-issue-title')).toContainText('feat:');
      await expect(page.locator('.js-navigation-item')).toBeVisible();
    }
  });

  test('performance and scalability', async () => {
    // Test with large objective
    const largeObjective = `
      Build a comprehensive e-commerce platform with the following features:
      - Multi-vendor marketplace
      - Real-time inventory management
      - Payment processing with multiple gateways
      - Order tracking and logistics
      - Customer reviews and ratings
      - Recommendation engine
      - Admin dashboard
      - Mobile applications
      - API for third-party integrations
      - Analytics and reporting
    `;

    const startTime = Date.now();

    const result = await execAsync(`node ${CLI_PATH} run --mode dry-run`, {
      cwd: TEST_PROJECT_DIR,
      input: largeObjective,
      timeout: 300000, // 5 minutes
    });

    const duration = Date.now() - startTime;

    expect(result.stdout).toContain('Pipeline completed');
    expect(duration).toBeLessThan(300000); // Should complete within timeout

    // Parse metrics
    const metricsMatch = result.stdout.match(/Metrics: ({.*})/);
    if (metricsMatch) {
      const metrics = JSON.parse(metricsMatch[1]);

      // Verify performance metrics
      expect(metrics.tokensUsed).toBeLessThan(100000);
      expect(metrics.memoryPeak).toBeLessThan(1024 * 1024 * 1024); // Less than 1GB
    }
  });

  test('error recovery and resilience', async ({ page }) => {
    // Simulate network failure
    await page.route('**/api/**', (route) => {
      if (Math.random() > 0.7) {
        route.abort('failed');
      } else {
        route.continue();
      }
    });

    // Start pipeline
    await page.goto('http://localhost:3000');
    await page.click('[data-testid="run-pipeline-btn"]');

    // Verify retry mechanism
    await expect(page.locator('[data-testid="retry-indicator"]')).toBeVisible();

    // Should eventually complete despite failures
    await expect(page.locator('[data-testid="pipeline-status"]')).toContainText('Completed', {
      timeout: 120000,
    });

    // Check metrics for retries
    const retryCount = await page.locator('[data-testid="retry-count"]').textContent();
    expect(Number.parseInt(retryCount || '0')).toBeGreaterThan(0);
  });
});
