import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';

// Test directories
const TEST_TEMP_DIR = join(__dirname, '..', '.tmp-test');
const TEST_ARTIFACTS_DIR = join(TEST_TEMP_DIR, 'artifacts');
const TEST_CHECKPOINTS_DIR = join(TEST_TEMP_DIR, 'checkpoints');

// Global test utilities
export const testUtils = {
  tempDir: TEST_TEMP_DIR,
  artifactsDir: TEST_ARTIFACTS_DIR,
  checkpointsDir: TEST_CHECKPOINTS_DIR,

  createTestDirs() {
    [TEST_TEMP_DIR, TEST_ARTIFACTS_DIR, TEST_CHECKPOINTS_DIR].forEach((dir) => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    });
  },

  cleanTestDirs() {
    if (existsSync(TEST_TEMP_DIR)) {
      rmSync(TEST_TEMP_DIR, { recursive: true, force: true });
    }
  },
};

// Setup test database/storage mock
export const setupTestDatabase = async () => {
  // Create test directories
  testUtils.createTestDirs();

  // Set environment variables for test
  process.env.NODE_ENV = 'test';
  process.env.ORCHESTRATOR_MODE = 'dry-run';
  process.env.LOG_LEVEL = 'error'; // Reduce noise during tests
  process.env.ARTIFACTS_DIR = TEST_ARTIFACTS_DIR;
  process.env.CHECKPOINTS_DIR = TEST_CHECKPOINTS_DIR;
};

// Global test lifecycle hooks
beforeAll(async () => {
  // Setup test environment
  await setupTestDatabase();

  // Suppress console during tests unless DEBUG is set
  if (!process.env.DEBUG) {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  }
});

afterAll(async () => {
  // Cleanup test directories
  testUtils.cleanTestDirs();

  // Restore all mocks
  vi.restoreAllMocks();

  // Clear all timers
  vi.clearAllTimers();
});

beforeEach(() => {
  // Reset mocks before each test
  vi.clearAllMocks();

  // Create fresh test directories
  testUtils.createTestDirs();

  // Reset module cache to ensure clean state
  vi.resetModules();
});

afterEach(() => {
  // Clear all timers
  vi.clearAllTimers();

  // Clear test directories content but keep structure
  if (existsSync(TEST_ARTIFACTS_DIR)) {
    rmSync(TEST_ARTIFACTS_DIR, { recursive: true, force: true });
    mkdirSync(TEST_ARTIFACTS_DIR, { recursive: true });
  }

  if (existsSync(TEST_CHECKPOINTS_DIR)) {
    rmSync(TEST_CHECKPOINTS_DIR, { recursive: true, force: true });
    mkdirSync(TEST_CHECKPOINTS_DIR, { recursive: true });
  }
});

// Custom matchers
expect.extend({
  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);

    return {
      pass,
      message: () => (pass ? `expected ${received} not to be a valid UUID` : `expected ${received} to be a valid UUID`),
    };
  },

  toBeValidPipelineResult(received: any) {
    const pass =
      received &&
      typeof received === 'object' &&
      'success' in received &&
      'pipelineId' in received &&
      'phasesCompleted' in received &&
      Array.isArray(received.phasesCompleted);

    return {
      pass,
      message: () =>
        pass
          ? `expected ${JSON.stringify(received)} not to be a valid pipeline result`
          : `expected ${JSON.stringify(received)} to be a valid pipeline result`,
    };
  },
});

// Type declarations for custom matchers
declare global {
  namespace Vi {
    interface Assertion {
      toBeValidUUID(): void;
      toBeValidPipelineResult(): void;
    }
    interface AsymmetricMatchersContaining {
      toBeValidUUID(): void;
      toBeValidPipelineResult(): void;
    }
  }
}
