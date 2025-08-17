import type {
  AgentMessage,
  AgentResult,
  CheckpointData,
  OrchestratorOptions,
  PipelineConfig,
  PipelinePhase,
  PipelineResult,
  ToolResult,
} from '@/types';
import { vi } from 'vitest';

/**
 * Test fixtures for pipeline and orchestrator tests
 */
export const fixtures = {
  // Valid test data
  validObjective: 'Build a REST API with authentication and user management',
  invalidObjective: 'x',

  // Mock pipeline configuration
  mockPipelineConfig: {
    id: 'test-pipeline-123',
    name: 'Test Pipeline',
    objective: 'Build test feature',
    mode: 'dry-run' as const,
    phases: ['brainstorming', 'architect', 'development', 'testing'] as PipelinePhase[],
    config: {
      maxRetries: 3,
      timeout: 30000,
      checkpointInterval: 5,
    },
  } as PipelineConfig,

  // Mock checkpoint data
  mockCheckpoint: {
    id: 'checkpoint-test-123',
    pipelineId: 'test-pipeline-123',
    phase: 'architect' as PipelinePhase,
    state: {
      currentPhase: 'architect',
      completedPhases: ['brainstorming'],
      context: {
        objective: 'Build test feature',
        artifacts: [],
      },
    },
    timestamp: new Date('2024-01-01T00:00:00.000Z'),
    metadata: {
      version: '1.0.0',
      compressed: false,
    },
  } as CheckpointData,

  // Mock agent message
  mockAgentMessage: {
    id: 'msg-123',
    from: 'orchestrator',
    to: 'architect',
    type: 'task',
    content: {
      task: 'Design system architecture',
      context: {
        objective: 'Build REST API',
      },
    },
    timestamp: new Date(),
  } as AgentMessage,

  // Mock agent result
  mockAgentResult: {
    success: true,
    agentId: 'architect',
    data: {
      architecture: {
        components: ['API Gateway', 'Auth Service', 'User Service'],
        diagram: 'architecture.md',
      },
    },
    metadata: {
      duration: 5000,
      tokens: 1500,
    },
  } as AgentResult,

  // Mock tool result
  mockToolResult: {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success: true,
          pipelineId: 'test-pipeline-123',
          result: 'Pipeline executed successfully',
        }),
      },
    ],
    isError: false,
  } as ToolResult,

  // Mock orchestrator options
  mockOrchestratorOptions: {
    objective: 'Build test feature',
    mode: 'dry-run' as const,
    config: {
      maxRetries: 3,
      timeout: 30000,
      checkpointInterval: 5,
      verbose: false,
    },
  } as OrchestratorOptions,

  // Mock pipeline result
  mockPipelineResult: {
    success: true,
    pipelineId: 'test-pipeline-123',
    phasesCompleted: ['brainstorming', 'architect', 'development', 'testing'],
    artifacts: [
      {
        type: 'architecture',
        path: '/artifacts/architecture.md',
        phase: 'architect',
      },
      {
        type: 'code',
        path: '/artifacts/src',
        phase: 'development',
      },
      {
        type: 'tests',
        path: '/artifacts/tests',
        phase: 'testing',
      },
    ],
    metrics: {
      duration: 120000,
      tokensUsed: 50000,
      retries: 0,
    },
  } as PipelineResult,

  // Mock architecture data for ArchitectAgent
  mockArchitectureData: {
    overview: 'Microservices architecture with event-driven communication',
    components: [
      {
        name: 'API Gateway',
        type: 'service',
        responsibilities: ['Request routing', 'Authentication', 'Rate limiting'],
      },
      {
        name: 'Auth Service',
        type: 'service',
        responsibilities: ['User authentication', 'Token management', 'Authorization'],
      },
      {
        name: 'User Service',
        type: 'service',
        responsibilities: ['User CRUD operations', 'Profile management'],
      },
    ],
    adrs: [
      {
        id: 'ADR-001',
        title: 'Use JWT for authentication',
        status: 'accepted',
        context: 'Need stateless authentication for microservices',
        decision: 'Use JWT tokens with RS256 signing',
        consequences: 'Stateless auth, but need token refresh strategy',
      },
    ],
    riskAssessment: {
      risks: [
        {
          id: 'RISK-001',
          description: 'Single point of failure at API Gateway',
          likelihood: 'medium',
          impact: 'high',
          mitigation: 'Implement multiple gateway instances with load balancing',
        },
      ],
    },
    estimatedResources: {
      development: '4-6 weeks',
      team: '2 backend, 1 frontend, 1 DevOps',
      infrastructure: 'Kubernetes cluster with 3 nodes',
    },
  },

  // Error scenarios
  errorScenarios: {
    networkError: new Error('Network request failed'),
    validationError: new Error('Invalid input: objective is required'),
    timeoutError: new Error('Operation timed out after 30000ms'),
    checkpointError: new Error('Failed to save checkpoint'),
    agentError: new Error('Agent execution failed'),
  },

  // Test file paths
  testPaths: {
    validFile: '/test/valid-file.ts',
    invalidFile: '/test/nonexistent.ts',
    directory: '/test/src',
    outputDir: '/test/output',
  },
};

/**
 * Factory functions for creating test data
 */
export const createMockPipeline = (overrides?: Partial<PipelineConfig>): PipelineConfig => ({
  ...fixtures.mockPipelineConfig,
  ...overrides,
});

export const createMockCheckpoint = (overrides?: Partial<CheckpointData>): CheckpointData => ({
  ...fixtures.mockCheckpoint,
  ...overrides,
});

export const createMockAgentMessage = (overrides?: Partial<AgentMessage>): AgentMessage => ({
  ...fixtures.mockAgentMessage,
  ...overrides,
});

export const createMockAgentResult = (overrides?: Partial<AgentResult>): AgentResult => ({
  ...fixtures.mockAgentResult,
  ...overrides,
});

/**
 * Utility to create a series of mock checkpoints for testing
 */
export const createCheckpointSeries = (count: number, pipelineId: string): CheckpointData[] => {
  const phases: PipelinePhase[] = ['brainstorming', 'architect', 'development', 'testing'];
  return Array.from({ length: count }, (_, i) => ({
    id: `checkpoint-${i}`,
    pipelineId,
    phase: phases[i % phases.length],
    state: {
      currentPhase: phases[i % phases.length],
      completedPhases: phases.slice(0, i % phases.length),
      context: {
        objective: 'Test objective',
        artifacts: [],
      },
    },
    timestamp: new Date(Date.now() - (count - i) * 3600000), // 1 hour apart
    metadata: {
      version: '1.0.0',
      compressed: false,
    },
  }));
};

/**
 * Mock timers utility
 */
export const mockTimers = {
  setup() {
    vi.useFakeTimers();
    return {
      advance: (ms: number) => vi.advanceTimersByTime(ms),
      runAll: () => vi.runAllTimers(),
      restore: () => vi.useRealTimers(),
    };
  },
};
