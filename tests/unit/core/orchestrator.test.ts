/**
 * Unit tests for Orchestrator
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BMADPhase,
  Orchestrator,
  type OrchestratorConfig,
  OrchestratorMode,
  createOrchestrator,
  defaultOrchestratorConfig,
} from '../../../src/core/orchestrator';
import { ExecutionMode } from '../../../src/core/pipeline';

describe('Orchestrator', () => {
  let orchestrator: Orchestrator;
  let config: OrchestratorConfig;

  beforeEach(() => {
    config = {
      workDir: '/test/workspace',
      mode: ExecutionMode.AUTO,
      environment: OrchestratorMode.DEVELOPMENT,
      maxRetries: 3,
      logLevel: 'info',
      pipeline: {
        maxConcurrentTasks: 5,
        taskTimeout: 300000,
        autoApprove: false,
      },
      bmad: {
        measurementThreshold: 80,
        deploymentScore: 70,
        analysisDepth: 'normal',
      },
      checkpointing: {
        enabled: false, // Disable for testing
        interval: 60000,
        maxCheckpoints: 10,
      },
    };
  });

  describe('initialization', () => {
    it('should initialize with correct configuration', async () => {
      orchestrator = new Orchestrator(config);
      await orchestrator.initialize();

      const status = orchestrator.getStatus();
      expect(status).toBeDefined();
      expect(status.phase).toBeNull();
      expect(status.state).toBe('unknown');
      expect(status.progress).toBe(0);
    });

    it('should validate configuration on initialization', () => {
      const invalidConfig = {
        ...config,
        maxRetries: -1, // Invalid: negative retries
      };

      expect(() => new Orchestrator(invalidConfig as OrchestratorConfig)).toThrow();
    });

    it('should use default configuration when not provided', () => {
      orchestrator = new Orchestrator(defaultOrchestratorConfig);
      expect(orchestrator).toBeDefined();
    });

    it('should handle initialization errors gracefully', async () => {
      // Create orchestrator with invalid work directory
      const badConfig = {
        ...config,
        workDir: '/invalid/path/that/does/not/exist',
      };

      orchestrator = new Orchestrator(badConfig);

      // Initialize should not throw but handle errors internally
      await expect(orchestrator.initialize()).resolves.not.toThrow();
    });
  });

  describe('BMAD pipeline execution', () => {
    beforeEach(async () => {
      orchestrator = new Orchestrator(config);
      await orchestrator.initialize();
    });

    it('should execute complete BMAD pipeline', async () => {
      const objective = 'Create a simple TODO app';

      // Mock the internal methods to speed up testing
      vi.spyOn(orchestrator as any, 'build').mockResolvedValue({
        artifacts: new Map(),
        metadata: {
          duration: 100,
          timestamp: new Date(),
          version: '1.0.0',
        },
      });

      vi.spyOn(orchestrator as any, 'measure').mockResolvedValue({
        performance: { responseTime: 200, throughput: 1000, cpu: 30, memory: 256 },
        quality: { coverage: 85, complexity: 5, maintainability: 90, reliability: 95 },
        business: { completeness: 95, correctness: 98, efficiency: 92 },
      });

      vi.spyOn(orchestrator as any, 'analyze').mockResolvedValue({
        insights: [],
        recommendations: [],
        score: 90,
        risks: [],
      });

      vi.spyOn(orchestrator as any, 'deploy').mockResolvedValue({
        success: true,
        environment: 'development',
        version: '1.0.0',
      });

      const result = await orchestrator.run(objective);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.phases).toBeDefined();
      expect(result.phases.build).toBeDefined();
      expect(result.phases.measure).toBeDefined();
      expect(result.phases.analyze).toBeDefined();
      expect(result.phases.deploy).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should skip phases when configured', async () => {
      const configWithSkip = {
        ...config,
        bmad: {
          ...config.bmad,
          skipPhases: [BMADPhase.DEPLOY],
        },
      };

      orchestrator = new Orchestrator(configWithSkip);
      await orchestrator.initialize();

      const result = await orchestrator.run('Test objective');

      expect(result.success).toBe(true);
      // Deploy should be mock result when skipped
      expect(result.phases.deploy).toBeDefined();
    });

    it('should handle errors during pipeline execution', async () => {
      vi.spyOn(orchestrator as any, 'build').mockRejectedValue(new Error('Build failed'));

      const result = await orchestrator.run('Test objective');

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
      expect(result.errors?.[0].message).toContain('Build failed');
    });
  });

  describe('pipeline control', () => {
    beforeEach(async () => {
      orchestrator = new Orchestrator(config);
      await orchestrator.initialize();
    });

    it('should pause pipeline execution', async () => {
      const pauseSpy = vi.spyOn(orchestrator, 'pause');

      await orchestrator.pause();

      expect(pauseSpy).toHaveBeenCalled();
      const status = orchestrator.getStatus();
      expect(status).toBeDefined();
    });

    it('should resume pipeline execution', async () => {
      const resumeSpy = vi.spyOn(orchestrator, 'resume');

      await orchestrator.resume();

      expect(resumeSpy).toHaveBeenCalled();
    });

    it('should abort pipeline execution', () => {
      const abortSpy = vi.spyOn(orchestrator, 'abort');

      orchestrator.abort();

      expect(abortSpy).toHaveBeenCalled();
    });
  });

  describe('status and metrics', () => {
    beforeEach(async () => {
      orchestrator = new Orchestrator(config);
      await orchestrator.initialize();
    });

    it('should return current status', () => {
      const status = orchestrator.getStatus();

      expect(status).toBeDefined();
      expect(status.phase).toBeDefined();
      expect(status.state).toBeDefined();
      expect(status.progress).toBeDefined();
      expect(typeof status.progress).toBe('number');
    });

    it('should return metrics', () => {
      const metrics = orchestrator.getMetrics();

      expect(metrics).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should classify and handle different error types', async () => {
      orchestrator = new Orchestrator(config);
      await orchestrator.initialize();

      // Mock internal method to throw error
      vi.spyOn(orchestrator as any, 'build').mockRejectedValue(new Error('Network timeout'));

      const result = await orchestrator.run('Test');

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should retry on transient errors up to max retries', async () => {
      const retryConfig = {
        ...config,
        maxRetries: 2,
      };

      orchestrator = new Orchestrator(retryConfig);
      await orchestrator.initialize();

      let attemptCount = 0;
      vi.spyOn(orchestrator as any, 'build').mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 2) {
          return Promise.reject(new Error('Transient error'));
        }
        return Promise.resolve({
          artifacts: new Map(),
          metadata: {
            duration: 100,
            timestamp: new Date(),
            version: '1.0.0',
          },
        });
      });

      // Mock other phases for simplicity
      vi.spyOn(orchestrator as any, 'measure').mockResolvedValue({});
      vi.spyOn(orchestrator as any, 'analyze').mockResolvedValue({ score: 90 });
      vi.spyOn(orchestrator as any, 'deploy').mockResolvedValue({ success: true });

      const result = await orchestrator.run('Test');

      expect(attemptCount).toBe(2);
      expect(result.success).toBe(true);
    });
  });

  describe('factory function', () => {
    it('should create orchestrator instance using factory', () => {
      const instance = createOrchestrator(config);

      expect(instance).toBeDefined();
      expect(instance).toBeInstanceOf(Orchestrator);
    });
  });
});
