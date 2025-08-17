import { CheckpointManager } from '@/core/checkpoint';
import { Orchestrator } from '@/core/orchestrator';
import { Pipeline } from '@/core/pipeline';
import { PipelineStateMachine } from '@/core/state-machine';
import { AgentCoordinator } from '@/roles/agent-coordinator';
import type { CheckpointData, OrchestratorOptions, PipelinePhase, PipelineResult } from '@/types';
import { expectPhasesInOrder, expectToCompleteWithin, expectValidPipelineResult } from '@tests/helpers/assertions';
import { fixtures } from '@tests/helpers/fixtures';
import {
  MockAgentCoordinator,
  MockArchitectAgent,
  MockDebuggerAgent,
  MockDeveloperAgent,
  MockTesterAgent,
} from '@tests/mocks/agents';
import { testUtils } from '@tests/setup';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('Pipeline Integration', () => {
  let orchestrator: Orchestrator;
  let pipeline: Pipeline;
  let checkpointManager: CheckpointManager;
  let stateMachine: PipelineStateMachine;
  let coordinator: MockAgentCoordinator;

  beforeEach(async () => {
    // Setup test environment
    testUtils.createTestDirs();

    // Initialize components
    coordinator = new MockAgentCoordinator();
    checkpointManager = new CheckpointManager({
      directory: testUtils.checkpointsDir,
    });

    stateMachine = new PipelineStateMachine();

    pipeline = new Pipeline({
      coordinator,
      checkpointManager,
      stateMachine,
    });

    orchestrator = new Orchestrator({
      pipeline,
      coordinator,
      checkpointManager,
    });
  });

  afterEach(async () => {
    // Cleanup
    await stateMachine.stop();
    testUtils.cleanTestDirs();
    vi.clearAllMocks();
  });

  describe('Full BMAD Pipeline Execution', () => {
    it('should execute complete BMAD pipeline successfully', async () => {
      const options: OrchestratorOptions = {
        objective: fixtures.validObjective,
        mode: 'dry-run',
      };

      const result = await orchestrator.run(options);

      expectValidPipelineResult(result);
      expect(result.success).toBe(true);
      expect(result.phasesCompleted).toHaveLength(4);
      expect(result.phasesCompleted).toEqual(['brainstorming', 'architect', 'development', 'testing']);
    });

    it('should execute phases in correct order', async () => {
      const options: OrchestratorOptions = {
        objective: fixtures.validObjective,
        mode: 'semi',
      };

      const phaseExecutions: PipelinePhase[] = [];

      // Track phase executions
      pipeline.on('phase:start', (phase: PipelinePhase) => {
        phaseExecutions.push(phase);
      });

      await orchestrator.run(options);

      expectPhasesInOrder(phaseExecutions);
    });

    it('should generate artifacts for each phase', async () => {
      const options: OrchestratorOptions = {
        objective: fixtures.validObjective,
        mode: 'dry-run',
      };

      const result = await orchestrator.run(options);

      expect(result.artifacts).toBeDefined();
      expect(result.artifacts.length).toBeGreaterThanOrEqual(4);

      // Verify artifacts from each phase
      const phaseArtifacts = result.artifacts.reduce(
        (acc, artifact) => {
          acc[artifact.phase] = (acc[artifact.phase] || 0) + 1;
          return acc;
        },
        {} as Record<PipelinePhase, number>,
      );

      expect(phaseArtifacts.brainstorming).toBeGreaterThanOrEqual(1);
      expect(phaseArtifacts.architect).toBeGreaterThanOrEqual(1);
      expect(phaseArtifacts.development).toBeGreaterThanOrEqual(1);
      expect(phaseArtifacts.testing).toBeGreaterThanOrEqual(1);
    });

    it('should respect timeout configuration', async () => {
      const options: OrchestratorOptions = {
        objective: fixtures.validObjective,
        mode: 'dry-run',
        config: {
          timeout: 5000,
        },
      };

      await expectToCompleteWithin(
        () => orchestrator.run(options),
        5500, // Allow small buffer
      );
    });
  });

  describe('Checkpoint Management', () => {
    it('should create checkpoints at configured intervals', async () => {
      const options: OrchestratorOptions = {
        objective: fixtures.validObjective,
        mode: 'dry-run',
        config: {
          checkpointInterval: 1, // Create checkpoint after each phase
        },
      };

      const checkpoints: CheckpointData[] = [];

      checkpointManager.on('checkpoint:saved', (checkpoint: CheckpointData) => {
        checkpoints.push(checkpoint);
      });

      await orchestrator.run(options);

      expect(checkpoints.length).toBeGreaterThanOrEqual(4);
      checkpoints.forEach((checkpoint) => {
        expect(checkpoint.pipelineId).toBeDefined();
        expect(checkpoint.phase).toBeDefined();
        expect(checkpoint.state).toBeDefined();
      });
    });

    it('should resume from checkpoint', async () => {
      // First run - partial completion
      const options1: OrchestratorOptions = {
        objective: fixtures.validObjective,
        mode: 'dry-run',
      };

      // Simulate failure after architect phase
      let phaseCount = 0;
      pipeline.on('phase:complete', () => {
        phaseCount++;
        if (phaseCount === 2) {
          throw new Error('Simulated failure');
        }
      });

      let result1: PipelineResult;
      try {
        result1 = await orchestrator.run(options1);
      } catch (error) {
        // Expected failure
      }

      // Get latest checkpoint
      const checkpoints = await checkpointManager.list();
      expect(checkpoints.length).toBeGreaterThan(0);

      const latestCheckpoint = checkpoints[0];

      // Resume from checkpoint
      const options2: OrchestratorOptions = {
        objective: fixtures.validObjective,
        mode: 'dry-run',
        checkpoint: latestCheckpoint.id,
      };

      // Remove error simulation
      pipeline.removeAllListeners('phase:complete');

      const result2 = await orchestrator.run(options2);

      expect(result2.success).toBe(true);
      expect(result2.phasesCompleted).toContain('development');
      expect(result2.phasesCompleted).toContain('testing');
    });

    it('should rotate old checkpoints', async () => {
      const options: OrchestratorOptions = {
        objective: fixtures.validObjective,
        mode: 'dry-run',
        config: {
          checkpointInterval: 1,
          maxCheckpoints: 3,
        },
      };

      // Run multiple times to generate checkpoints
      for (let i = 0; i < 5; i++) {
        await orchestrator.run(options);
      }

      const checkpoints = await checkpointManager.list();
      expect(checkpoints.length).toBeLessThanOrEqual(3);
    });
  });

  describe('State Machine Integration', () => {
    it('should transition through all pipeline states', async () => {
      const options: OrchestratorOptions = {
        objective: fixtures.validObjective,
        mode: 'dry-run',
      };

      const stateTransitions: string[] = [];

      stateMachine.on('transition', (state: string) => {
        stateTransitions.push(state);
      });

      await orchestrator.run(options);

      expect(stateTransitions).toContain('pipeline.idle');
      expect(stateTransitions).toContain('pipeline.initializing');
      expect(stateTransitions).toContain('pipeline.brainstorming');
      expect(stateTransitions).toContain('pipeline.architect');
      expect(stateTransitions).toContain('pipeline.development');
      expect(stateTransitions).toContain('pipeline.testing');
      expect(stateTransitions).toContain('pipeline.completed');
    });

    it('should handle pause and resume', async () => {
      const options: OrchestratorOptions = {
        objective: fixtures.validObjective,
        mode: 'semi',
      };

      // Start pipeline
      const runPromise = orchestrator.run(options);

      // Wait for first phase to start
      await stateMachine.waitForState('pipeline.brainstorming', 1000);

      // Pause
      await orchestrator.pause();
      expect(stateMachine.isInState('pipeline.paused')).toBe(true);

      // Resume
      await orchestrator.resume();
      expect(stateMachine.isInState('pipeline.paused')).toBe(false);

      // Complete execution
      const result = await runPromise;
      expect(result.success).toBe(true);
    });

    it('should handle cancellation', async () => {
      const options: OrchestratorOptions = {
        objective: fixtures.validObjective,
        mode: 'dry-run',
      };

      // Start pipeline
      const runPromise = orchestrator.run(options);

      // Wait for first phase to start
      await stateMachine.waitForState('pipeline.brainstorming', 1000);

      // Cancel
      await orchestrator.cancel();

      const result = await runPromise;
      expect(result.success).toBe(false);
      expect(result.cancelled).toBe(true);
      expect(stateMachine.isInState('pipeline.cancelled')).toBe(true);
    });
  });

  describe('Agent Coordination', () => {
    it('should coordinate agents across phases', async () => {
      const options: OrchestratorOptions = {
        objective: fixtures.validObjective,
        mode: 'dry-run',
      };

      const agentExecutions: Map<string, number> = new Map();

      coordinator.on('agent:execute', (agentId: string) => {
        agentExecutions.set(agentId, (agentExecutions.get(agentId) || 0) + 1);
      });

      await orchestrator.run(options);

      expect(agentExecutions.get('architect')).toBeGreaterThanOrEqual(1);
      expect(agentExecutions.get('developer')).toBeGreaterThanOrEqual(1);
      expect(agentExecutions.get('tester')).toBeGreaterThanOrEqual(1);
    });

    it('should pass context between agents', async () => {
      const options: OrchestratorOptions = {
        objective: fixtures.validObjective,
        mode: 'dry-run',
      };

      const agentContexts: Map<string, any> = new Map();

      coordinator.on('agent:execute', (agentId: string, message: any) => {
        agentContexts.set(agentId, message.content.context);
      });

      await orchestrator.run(options);

      // Developer should receive architect's output
      const developerContext = agentContexts.get('developer');
      expect(developerContext).toBeDefined();
      expect(developerContext.architecture).toBeDefined();

      // Tester should receive developer's output
      const testerContext = agentContexts.get('tester');
      expect(testerContext).toBeDefined();
      expect(testerContext.implementation).toBeDefined();
    });

    it('should handle agent failures with retry', async () => {
      const options: OrchestratorOptions = {
        objective: fixtures.validObjective,
        mode: 'dry-run',
        config: {
          maxRetries: 3,
        },
      };

      // Make architect fail twice then succeed
      let architectAttempts = 0;
      const originalArchitect = coordinator.getAgent('architect');

      coordinator.getAgent('architect').execute = vi.fn(async (message) => {
        architectAttempts++;
        if (architectAttempts < 3) {
          throw new Error('Transient failure');
        }
        return originalArchitect.execute(message);
      });

      const result = await orchestrator.run(options);

      expect(result.success).toBe(true);
      expect(architectAttempts).toBe(3);
      expect(result.metrics?.retries).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle phase failures gracefully', async () => {
      const options: OrchestratorOptions = {
        objective: fixtures.validObjective,
        mode: 'dry-run',
        config: {
          maxRetries: 1,
        },
      };

      // Make development phase fail
      coordinator.getAgent('developer').execute = vi.fn(async () => {
        throw new Error('Development failed');
      });

      const result = await orchestrator.run(options);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Development failed');
      expect(result.failedPhase).toBe('development');
      expect(result.phasesCompleted).toContain('brainstorming');
      expect(result.phasesCompleted).toContain('architect');
    });

    it('should create error checkpoint on failure', async () => {
      const options: OrchestratorOptions = {
        objective: fixtures.validObjective,
        mode: 'dry-run',
      };

      // Make testing phase fail
      coordinator.getAgent('tester').execute = vi.fn(async () => {
        throw new Error('Tests failed');
      });

      const result = await orchestrator.run(options);

      expect(result.success).toBe(false);
      expect(result.checkpoint).toBeDefined();

      // Verify checkpoint was created
      const checkpoint = await checkpointManager.load(result.checkpoint);
      expect(checkpoint).toBeDefined();
      expect(checkpoint.phase).toBe('testing');
      expect(checkpoint.state.error).toContain('Tests failed');
    });

    it('should handle initialization errors', async () => {
      const options: OrchestratorOptions = {
        objective: '', // Invalid objective
        mode: 'dry-run',
      };

      const result = await orchestrator.run(options);

      expect(result.success).toBe(false);
      expect(result.error).toContain('objective');
      expect(result.phasesCompleted).toHaveLength(0);
    });
  });

  describe('Mode-Specific Behavior', () => {
    it('should run in auto mode without intervention', async () => {
      const options: OrchestratorOptions = {
        objective: fixtures.validObjective,
        mode: 'auto',
      };

      const result = await orchestrator.run(options);

      expect(result.success).toBe(true);
      expect(result.mode).toBe('auto');
      expect(result.userInterventions).toBeUndefined();
    });

    it('should require confirmation in semi mode', async () => {
      const options: OrchestratorOptions = {
        objective: fixtures.validObjective,
        mode: 'semi',
      };

      // Mock user confirmations
      pipeline.on('confirmation:required', (callback: Function) => {
        callback(true); // Auto-approve for testing
      });

      const result = await orchestrator.run(options);

      expect(result.success).toBe(true);
      expect(result.mode).toBe('semi');
    });

    it('should not make actual changes in dry-run mode', async () => {
      const options: OrchestratorOptions = {
        objective: fixtures.validObjective,
        mode: 'dry-run',
      };

      const result = await orchestrator.run(options);

      expect(result.success).toBe(true);
      expect(result.mode).toBe('dry-run');
      expect(result.dryRun).toBe(true);

      // Verify no actual files were created
      const artifactFiles = result.artifacts.filter((a) => a.type === 'file');
      artifactFiles.forEach((artifact) => {
        expect(artifact.virtual).toBe(true);
      });
    });
  });

  describe('Metrics and Telemetry', () => {
    it('should collect comprehensive metrics', async () => {
      const options: OrchestratorOptions = {
        objective: fixtures.validObjective,
        mode: 'dry-run',
        config: {
          collectMetrics: true,
        },
      };

      const result = await orchestrator.run(options);

      expect(result.metrics).toBeDefined();
      expect(result.metrics.duration).toBeGreaterThan(0);
      expect(result.metrics.tokensUsed).toBeGreaterThanOrEqual(0);
      expect(result.metrics.retries).toBeGreaterThanOrEqual(0);
      expect(result.metrics.phases).toBeDefined();

      // Phase-specific metrics
      expect(result.metrics.phases.brainstorming).toBeGreaterThan(0);
      expect(result.metrics.phases.architect).toBeGreaterThan(0);
      expect(result.metrics.phases.development).toBeGreaterThan(0);
      expect(result.metrics.phases.testing).toBeGreaterThan(0);
    });

    it('should track memory usage', async () => {
      const options: OrchestratorOptions = {
        objective: fixtures.validObjective,
        mode: 'dry-run',
        config: {
          trackMemory: true,
        },
      };

      const result = await orchestrator.run(options);

      if (result.metrics?.memory) {
        expect(result.metrics.memory.peak).toBeGreaterThan(0);
        expect(result.metrics.memory.average).toBeGreaterThan(0);
      }
    });
  });

  describe('Parallel Execution', () => {
    it('should execute independent phases in parallel when configured', async () => {
      const options: OrchestratorOptions = {
        objective: fixtures.validObjective,
        mode: 'dry-run',
        config: {
          parallel: true,
        },
      };

      const startTime = Date.now();
      const result = await orchestrator.run(options);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);

      // Parallel execution should be faster than sequential
      const sequentialOptions: OrchestratorOptions = {
        ...options,
        config: { parallel: false },
      };

      const sequentialStart = Date.now();
      await orchestrator.run(sequentialOptions);
      const sequentialDuration = Date.now() - sequentialStart;

      // Parallel should be at least 20% faster (accounting for overhead)
      expect(duration).toBeLessThan(sequentialDuration * 0.8);
    });
  });
});
