import { Orchestrator } from '@/core/orchestrator';
import { OrchestratorRunTool } from '@/tools/orchestrator-run.tool';
import type { ToolCallParams, ToolResult } from '@/types';
import { expectValidPipelineResult } from '@tests/helpers/assertions';
import { createMockPipeline, fixtures } from '@tests/helpers/fixtures';
import { MockAgentCoordinator } from '@tests/mocks/agents';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the Orchestrator module
vi.mock('@/core/orchestrator', () => ({
  Orchestrator: vi.fn(),
}));

describe('OrchestratorRunTool', () => {
  let tool: OrchestratorRunTool;
  let mockOrchestrator: any;
  let mockCoordinator: MockAgentCoordinator;

  beforeEach(() => {
    // Setup mock orchestrator
    mockOrchestrator = {
      run: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      cancel: vi.fn(),
      getStatus: vi.fn(),
      getMetrics: vi.fn(),
    };

    // Setup mock coordinator
    mockCoordinator = new MockAgentCoordinator();

    // Configure Orchestrator mock
    (Orchestrator as any).mockImplementation(() => mockOrchestrator);

    tool = new OrchestratorRunTool();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create tool instance with correct metadata', () => {
      expect(tool.name).toBe('orchestrator_run');
      expect(tool.description).toContain('Execute the BMAD pipeline');
    });

    it('should define input schema', () => {
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.inputSchema.properties).toHaveProperty('objective');
      expect(tool.inputSchema.properties).toHaveProperty('mode');
      expect(tool.inputSchema.properties).toHaveProperty('config');
      expect(tool.inputSchema.required).toContain('objective');
    });

    it('should validate required parameters', () => {
      const schema = tool.inputSchema;
      expect(schema.properties.objective.type).toBe('string');
      expect(schema.properties.objective.minLength).toBe(10);
      expect(schema.properties.mode.enum).toContain('auto');
      expect(schema.properties.mode.enum).toContain('semi');
      expect(schema.properties.mode.enum).toContain('dry-run');
    });
  });

  describe('execute', () => {
    it('should execute orchestrator with valid parameters', async () => {
      const params: ToolCallParams = {
        arguments: {
          objective: fixtures.validObjective,
          mode: 'dry-run',
          config: {
            verbose: true,
            checkpointInterval: 5,
          },
        },
      };

      mockOrchestrator.run.mockResolvedValue(fixtures.mockPipelineResult);

      const result = await tool.execute(params);

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.isError).toBe(false);
      expect(mockOrchestrator.run).toHaveBeenCalledWith({
        objective: fixtures.validObjective,
        mode: 'dry-run',
        config: expect.objectContaining({
          verbose: true,
          checkpointInterval: 5,
        }),
      });
    });

    it('should handle successful pipeline execution', async () => {
      const params: ToolCallParams = {
        arguments: {
          objective: 'Build a REST API with authentication',
        },
      };

      mockOrchestrator.run.mockResolvedValue({
        success: true,
        pipelineId: 'test-123',
        phasesCompleted: ['brainstorming', 'architect', 'development', 'testing'],
        artifacts: [{ type: 'architecture', path: '/artifacts/arch.md', phase: 'architect' }],
        metrics: {
          duration: 120000,
          tokensUsed: 50000,
          retries: 0,
        },
      });

      const result = await tool.execute(params);
      const content = JSON.parse(result.content[0].text);

      expect(content.success).toBe(true);
      expect(content.pipelineId).toBe('test-123');
      expect(content.phasesCompleted).toHaveLength(4);
      expect(content.artifacts).toHaveLength(1);
    });

    it('should use default mode when not specified', async () => {
      const params: ToolCallParams = {
        arguments: {
          objective: fixtures.validObjective,
        },
      };

      mockOrchestrator.run.mockResolvedValue(fixtures.mockPipelineResult);

      await tool.execute(params);

      expect(mockOrchestrator.run).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'semi', // Default mode
        }),
      );
    });

    it('should pass through configuration options', async () => {
      const params: ToolCallParams = {
        arguments: {
          objective: fixtures.validObjective,
          mode: 'auto',
          config: {
            maxRetries: 5,
            timeout: 60000,
            checkpointInterval: 10,
            verbose: false,
            parallel: true,
            skipTests: false,
          },
        },
      };

      mockOrchestrator.run.mockResolvedValue(fixtures.mockPipelineResult);

      await tool.execute(params);

      expect(mockOrchestrator.run).toHaveBeenCalledWith({
        objective: fixtures.validObjective,
        mode: 'auto',
        config: expect.objectContaining({
          maxRetries: 5,
          timeout: 60000,
          checkpointInterval: 10,
          verbose: false,
          parallel: true,
          skipTests: false,
        }),
      });
    });

    it('should handle checkpoint parameter', async () => {
      const params: ToolCallParams = {
        arguments: {
          objective: fixtures.validObjective,
          checkpoint: 'checkpoint-123',
        },
      };

      mockOrchestrator.run.mockResolvedValue(fixtures.mockPipelineResult);

      await tool.execute(params);

      expect(mockOrchestrator.run).toHaveBeenCalledWith(
        expect.objectContaining({
          checkpoint: 'checkpoint-123',
        }),
      );
    });

    it('should format result as JSON text content', async () => {
      const params: ToolCallParams = {
        arguments: {
          objective: fixtures.validObjective,
        },
      };

      mockOrchestrator.run.mockResolvedValue(fixtures.mockPipelineResult);

      const result = await tool.execute(params);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const parsed = JSON.parse(result.content[0].text);
      expectValidPipelineResult(parsed);
    });

    it('should include metadata in result', async () => {
      const params: ToolCallParams = {
        arguments: {
          objective: fixtures.validObjective,
          mode: 'dry-run',
        },
      };

      const pipelineResult = {
        ...fixtures.mockPipelineResult,
        metadata: {
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          version: '1.0.0',
        },
      };

      mockOrchestrator.run.mockResolvedValue(pipelineResult);

      const result = await tool.execute(params);
      const content = JSON.parse(result.content[0].text);

      expect(content.metadata).toBeDefined();
      expect(content.metadata.version).toBe('1.0.0');
    });
  });

  describe('validation', () => {
    it('should reject empty objective', async () => {
      const params: ToolCallParams = {
        arguments: {
          objective: '',
        },
      };

      const result = await tool.execute(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('objective');
    });

    it('should reject short objective', async () => {
      const params: ToolCallParams = {
        arguments: {
          objective: 'short',
        },
      };

      const result = await tool.execute(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('at least 10 characters');
    });

    it('should reject invalid mode', async () => {
      const params: ToolCallParams = {
        arguments: {
          objective: fixtures.validObjective,
          mode: 'invalid-mode',
        },
      };

      const result = await tool.execute(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('mode');
    });

    it('should validate config schema', async () => {
      const params: ToolCallParams = {
        arguments: {
          objective: fixtures.validObjective,
          config: {
            maxRetries: -1, // Invalid: negative number
            timeout: 'invalid', // Invalid: should be number
            verbose: 'yes', // Invalid: should be boolean
          },
        },
      };

      const result = await tool.execute(params);

      expect(result.isError).toBe(true);
    });

    it('should validate checkpoint format', async () => {
      const params: ToolCallParams = {
        arguments: {
          objective: fixtures.validObjective,
          checkpoint: 123, // Invalid: should be string
        },
      };

      const result = await tool.execute(params);

      expect(result.isError).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle orchestrator execution errors', async () => {
      const params: ToolCallParams = {
        arguments: {
          objective: fixtures.validObjective,
        },
      };

      const error = new Error('Pipeline execution failed');
      mockOrchestrator.run.mockRejectedValue(error);

      const result = await tool.execute(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Pipeline execution failed');
    });

    it('should handle timeout errors', async () => {
      const params: ToolCallParams = {
        arguments: {
          objective: fixtures.validObjective,
          config: { timeout: 100 },
        },
      };

      mockOrchestrator.run.mockRejectedValue(new Error('Operation timed out after 100ms'));

      const result = await tool.execute(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('timed out');
    });

    it('should handle checkpoint not found errors', async () => {
      const params: ToolCallParams = {
        arguments: {
          objective: fixtures.validObjective,
          checkpoint: 'non-existent-checkpoint',
        },
      };

      mockOrchestrator.run.mockRejectedValue(new Error('Checkpoint not found: non-existent-checkpoint'));

      const result = await tool.execute(params);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Checkpoint not found');
    });

    it('should handle partial pipeline failures', async () => {
      const params: ToolCallParams = {
        arguments: {
          objective: fixtures.validObjective,
        },
      };

      mockOrchestrator.run.mockResolvedValue({
        success: false,
        pipelineId: 'test-123',
        phasesCompleted: ['brainstorming', 'architect'],
        error: 'Development phase failed',
        failedPhase: 'development',
        checkpoint: 'checkpoint-recovery-123',
      });

      const result = await tool.execute(params);
      const content = JSON.parse(result.content[0].text);

      expect(content.success).toBe(false);
      expect(content.phasesCompleted).toHaveLength(2);
      expect(content.error).toContain('Development phase failed');
      expect(content.checkpoint).toBe('checkpoint-recovery-123');
    });

    it('should handle invalid JSON in response', async () => {
      const params: ToolCallParams = {
        arguments: {
          objective: fixtures.validObjective,
        },
      };

      // Return an object that can't be serialized to JSON
      const circularRef: any = { prop: null };
      circularRef.prop = circularRef;

      mockOrchestrator.run.mockResolvedValue(circularRef);

      const result = await tool.execute(params);

      // Should handle gracefully, likely by catching JSON.stringify error
      expect(result).toBeDefined();
    });
  });

  describe('PR creation', () => {
    it('should create PR when generatePR is true', async () => {
      const params: ToolCallParams = {
        arguments: {
          objective: fixtures.validObjective,
          mode: 'auto',
          generatePR: true,
          prConfig: {
            title: 'feat: Add new feature',
            branch: 'feature/new-feature',
            description: 'This PR adds a new feature',
          },
        },
      };

      mockOrchestrator.run.mockResolvedValue({
        ...fixtures.mockPipelineResult,
        pr: {
          url: 'https://github.com/user/repo/pull/123',
          number: 123,
          branch: 'feature/new-feature',
          status: 'open',
        },
      });

      const result = await tool.execute(params);
      const content = JSON.parse(result.content[0].text);

      expect(content.pr).toBeDefined();
      expect(content.pr.url).toContain('github.com');
      expect(content.pr.number).toBe(123);
    });

    it('should skip PR creation in dry-run mode', async () => {
      const params: ToolCallParams = {
        arguments: {
          objective: fixtures.validObjective,
          mode: 'dry-run',
          generatePR: true,
        },
      };

      mockOrchestrator.run.mockResolvedValue(fixtures.mockPipelineResult);

      const result = await tool.execute(params);
      const content = JSON.parse(result.content[0].text);

      expect(content.pr).toBeUndefined();
    });
  });

  describe('metrics and telemetry', () => {
    it('should capture execution metrics', async () => {
      const params: ToolCallParams = {
        arguments: {
          objective: fixtures.validObjective,
          config: { collectMetrics: true },
        },
      };

      const startTime = Date.now();

      mockOrchestrator.run.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return {
          ...fixtures.mockPipelineResult,
          metrics: {
            duration: Date.now() - startTime,
            tokensUsed: 50000,
            retries: 0,
            phases: {
              brainstorming: 10000,
              architect: 15000,
              development: 20000,
              testing: 5000,
            },
          },
        };
      });

      const result = await tool.execute(params);
      const content = JSON.parse(result.content[0].text);

      expect(content.metrics).toBeDefined();
      expect(content.metrics.duration).toBeGreaterThanOrEqual(100);
      expect(content.metrics.phases).toBeDefined();
      expect(content.metrics.tokensUsed).toBe(50000);
    });

    it('should track retry attempts', async () => {
      const params: ToolCallParams = {
        arguments: {
          objective: fixtures.validObjective,
          config: { maxRetries: 3 },
        },
      };

      mockOrchestrator.run.mockResolvedValue({
        ...fixtures.mockPipelineResult,
        metrics: {
          ...fixtures.mockPipelineResult.metrics,
          retries: 2,
          retriedPhases: ['development', 'testing'],
        },
      });

      const result = await tool.execute(params);
      const content = JSON.parse(result.content[0].text);

      expect(content.metrics.retries).toBe(2);
      expect(content.metrics.retriedPhases).toContain('development');
      expect(content.metrics.retriedPhases).toContain('testing');
    });
  });
});
