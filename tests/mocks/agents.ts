import { BaseAgent } from '@/roles/base-agent';
import type { AgentConfig, AgentMessage, AgentResult } from '@/types';
import { vi } from 'vitest';
import { fixtures } from '../helpers/fixtures';

/**
 * Mock implementation of BaseAgent for testing
 */
export class MockAgent extends BaseAgent {
  public executeCallCount = 0;
  public mockResult: AgentResult | null = null;
  public mockError: Error | null = null;

  constructor(id = 'mock-agent', config: Partial<AgentConfig> = {}) {
    super(id, 'Mock Agent', {
      maxRetries: 3,
      timeout: 5000,
      ...config,
    });
  }

  async execute(message: AgentMessage): Promise<AgentResult> {
    this.executeCallCount++;

    if (this.mockError) {
      throw this.mockError;
    }

    if (this.mockResult) {
      return this.mockResult;
    }

    return {
      success: true,
      agentId: this.id,
      data: {
        message: 'Mock execution successful',
        input: message,
      },
      metadata: {
        duration: 100,
        tokens: 50,
      },
    };
  }

  setMockResult(result: AgentResult): void {
    this.mockResult = result;
  }

  setMockError(error: Error): void {
    this.mockError = error;
  }

  reset(): void {
    this.executeCallCount = 0;
    this.mockResult = null;
    this.mockError = null;
  }
}

/**
 * Mock ArchitectAgent for testing
 */
export class MockArchitectAgent extends BaseAgent {
  constructor() {
    super('architect', 'Mock Architect Agent', {
      maxRetries: 3,
      timeout: 30000,
    });
  }

  async execute(message: AgentMessage): Promise<AgentResult> {
    return {
      success: true,
      agentId: this.id,
      data: fixtures.mockArchitectureData,
      metadata: {
        duration: 5000,
        tokens: 2000,
      },
    };
  }
}

/**
 * Mock DeveloperAgent for testing
 */
export class MockDeveloperAgent extends BaseAgent {
  constructor() {
    super('developer', 'Mock Developer Agent', {
      maxRetries: 3,
      timeout: 60000,
    });
  }

  async execute(message: AgentMessage): Promise<AgentResult> {
    return {
      success: true,
      agentId: this.id,
      data: {
        filesCreated: ['src/index.ts', 'src/api/auth.ts', 'src/api/users.ts'],
        linesOfCode: 500,
        testsCreated: 10,
      },
      metadata: {
        duration: 10000,
        tokens: 5000,
      },
    };
  }
}

/**
 * Mock TesterAgent for testing
 */
export class MockTesterAgent extends BaseAgent {
  constructor() {
    super('tester', 'Mock Tester Agent', {
      maxRetries: 3,
      timeout: 45000,
    });
  }

  async execute(message: AgentMessage): Promise<AgentResult> {
    return {
      success: true,
      agentId: this.id,
      data: {
        testResults: {
          total: 25,
          passed: 23,
          failed: 2,
          skipped: 0,
        },
        coverage: {
          lines: 85,
          functions: 90,
          branches: 75,
          statements: 88,
        },
        failedTests: [
          {
            name: 'Auth Service > login > should handle invalid credentials',
            error: 'Expected 401 but got 500',
          },
          {
            name: 'User Service > update > should validate email format',
            error: 'Validation not implemented',
          },
        ],
      },
      metadata: {
        duration: 8000,
        tokens: 1000,
      },
    };
  }
}

/**
 * Mock DebuggerAgent for testing
 */
export class MockDebuggerAgent extends BaseAgent {
  constructor() {
    super('debugger', 'Mock Debugger Agent', {
      maxRetries: 5,
      timeout: 30000,
    });
  }

  async execute(message: AgentMessage): Promise<AgentResult> {
    return {
      success: true,
      agentId: this.id,
      data: {
        issuesFound: 2,
        issuesFixed: 2,
        fixes: [
          {
            file: 'src/api/auth.ts',
            line: 45,
            issue: 'Incorrect status code',
            fix: 'Changed from 500 to 401',
          },
          {
            file: 'src/api/users.ts',
            line: 78,
            issue: 'Missing email validation',
            fix: 'Added email format validation',
          },
        ],
      },
      metadata: {
        duration: 6000,
        tokens: 1500,
      },
    };
  }
}

/**
 * Mock AgentCoordinator for testing
 */
export class MockAgentCoordinator {
  private agents: Map<string, BaseAgent> = new Map();
  public executeCallCount = 0;
  public lastMessage: AgentMessage | null = null;

  constructor() {
    this.agents.set('architect', new MockArchitectAgent());
    this.agents.set('developer', new MockDeveloperAgent());
    this.agents.set('tester', new MockTesterAgent());
    this.agents.set('debugger', new MockDebuggerAgent());
  }

  async execute(agentId: string, message: AgentMessage): Promise<AgentResult> {
    this.executeCallCount++;
    this.lastMessage = message;

    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    return agent.execute(message);
  }

  registerAgent(agent: BaseAgent): void {
    this.agents.set(agent.id, agent);
  }

  getAgent(agentId: string): BaseAgent | undefined {
    return this.agents.get(agentId);
  }

  reset(): void {
    this.executeCallCount = 0;
    this.lastMessage = null;
  }
}

/**
 * Create mock agent factory
 */
export function createMockAgentFactory() {
  const agents = new Map<string, MockAgent>();

  return {
    create: vi.fn((type: string) => {
      const agent = new MockAgent(`${type}-agent`);
      agents.set(type, agent);
      return agent;
    }),

    get: (type: string) => agents.get(type),

    getAll: () => agents,

    reset: () => {
      agents.clear();
    },
  };
}

/**
 * Mock agent execution with delay
 */
export async function mockAgentExecutionWithDelay(agent: MockAgent, delayMs = 100): Promise<AgentResult> {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  return agent.execute(fixtures.mockAgentMessage);
}

/**
 * Create a failing mock agent
 */
export function createFailingMockAgent(errorMessage = 'Agent execution failed'): MockAgent {
  const agent = new MockAgent('failing-agent');
  agent.setMockError(new Error(errorMessage));
  return agent;
}

/**
 * Create a slow mock agent
 */
export function createSlowMockAgent(delayMs = 5000): MockAgent {
  const agent = new MockAgent('slow-agent');
  const originalExecute = agent.execute.bind(agent);

  agent.execute = async (message: AgentMessage) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return originalExecute(message);
  };

  return agent;
}

/**
 * Mock agent with configurable responses
 */
export class ConfigurableMockAgent extends MockAgent {
  private responses: AgentResult[] = [];
  private currentIndex = 0;

  constructor(id = 'configurable-agent') {
    super(id);
  }

  addResponse(result: AgentResult): void {
    this.responses.push(result);
  }

  async execute(message: AgentMessage): Promise<AgentResult> {
    if (this.responses.length === 0) {
      return super.execute(message);
    }

    const result = this.responses[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.responses.length;
    return result;
  }

  reset(): void {
    super.reset();
    this.responses = [];
    this.currentIndex = 0;
  }
}
