# 👨‍💻 MCP Dev Orchestrator Developer Guide

## Table of Contents

1. [Introduction](#introduction)
2. [Architecture Overview](#architecture-overview)
3. [Development Setup](#development-setup)
4. [Core Components](#core-components)
5. [Extending the System](#extending-the-system)
6. [Creating Custom Agents](#creating-custom-agents)
7. [Building Adapters](#building-adapters)
8. [Writing Tools](#writing-tools)
9. [Testing Strategy](#testing-strategy)
10. [Debugging Tips](#debugging-tips)
11. [Performance Optimization](#performance-optimization)
12. [Best Practices](#best-practices)
13. [Contributing](#contributing)

## Introduction

This guide is for developers who want to understand, extend, or contribute to the MCP Dev Orchestrator. Whether you're adding new features, creating custom agents, or integrating new services, this guide provides the technical details you need.

### Prerequisites

- **TypeScript**: Strong understanding of TypeScript and async programming
- **Node.js**: Experience with Node.js ecosystem and npm packages
- **MCP Protocol**: Familiarity with Model Context Protocol specification
- **AI/LLM**: Basic understanding of LLM interactions and prompt engineering
- **Testing**: Experience with unit and integration testing

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         MCP Client                          │
└─────────────────────┬───────────────────────────────────────┘
                      │ MCP Protocol
┌─────────────────────▼───────────────────────────────────────┐
│                      MCP Server Layer                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  Tools   │  │Resources │  │ Prompts  │  │  Events  │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
└───────┼──────────────┼──────────────┼──────────────┼───────┘
        │              │              │              │
┌───────▼──────────────▼──────────────▼──────────────▼───────┐
│                    Core Orchestrator                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              State Machine & Pipeline                │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            Checkpoint & Recovery System              │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                     Agent Coordinator                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │Architect │  │Developer │  │  Tester  │  │ Debugger │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
└───────┼──────────────┼──────────────┼──────────────┼───────┘
        │              │              │              │
┌───────▼──────────────▼──────────────▼──────────────▼───────┐
│                    Adapter Layer                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  GitHub  │  │  Memory  │  │Sequential│  │Playwright│  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Key Design Patterns

| Pattern | Usage | Location |
|---------|-------|----------|
| **Factory** | Agent creation | `src/roles/agent-factory.ts` |
| **Strategy** | Execution modes | `src/core/pipeline.ts` |
| **Observer** | Event handling | `src/core/orchestrator.ts` |
| **State Machine** | Pipeline flow | `src/core/state-machine.ts` |
| **Adapter** | External services | `src/adapters/*.adapter.ts` |
| **Singleton** | Registry management | `src/tools/registry.ts` |
| **Command** | Tool execution | `src/tools/*.tool.ts` |
| **Template Method** | Base agent behavior | `src/roles/base-agent.ts` |

## Development Setup

### Environment Setup

1. **Clone Repository**

```bash
git clone https://github.com/mcp-team/mcp-dev-orchestrator.git
cd mcp-dev-orchestrator
```

2. **Install Dependencies**

```bash
# Use pnpm for faster installation
pnpm install

# Or npm
npm install
```

3. **Configure Environment**

```bash
# Copy environment template
cp .env.example .env

# Edit with your API keys
nano .env
```

Required environment variables:
```env
# Development Mode
NODE_ENV=development
LOG_LEVEL=debug

# API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Optional Services
GITHUB_TOKEN=ghp_...
```

4. **Setup Pre-commit Hooks**

```bash
# Install husky
pnpm prepare

# Verify hooks
ls -la .husky/
```

### Development Commands

```bash
# Start development server with hot reload
pnpm dev

# Run TypeScript compiler in watch mode
pnpm tsc:watch

# Run tests in watch mode
pnpm test:watch

# Lint and format code
pnpm lint
pnpm format

# Build for production
pnpm build

# Clean all artifacts
pnpm clean
```

### VS Code Setup

Recommended extensions:
```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-tsd",
    "orta.vscode-jest",
    "streetsidesoftware.code-spell-checker",
    "eamodio.gitlens",
    "usernamehw.errorlens"
  ]
}
```

Settings (`.vscode/settings.json`):
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "jest.autoRun": {
    "watch": true
  }
}
```

## Core Components

### 1. Orchestrator Core

Location: `src/core/orchestrator.ts`

```typescript
export class Orchestrator {
  private stateMachine: StateMachine;
  private pipeline: Pipeline;
  private checkpointManager: CheckpointManager;
  private eventEmitter: EventEmitter;

  async runPipeline(config: PipelineConfig): Promise<PipelineResult> {
    // 1. Initialize state machine
    this.stateMachine.initialize(config);
    
    // 2. Create pipeline instance
    const pipeline = this.pipeline.create(config);
    
    // 3. Execute phases
    for (const phase of pipeline.phases) {
      // Save checkpoint
      await this.checkpointManager.save(phase);
      
      // Execute phase
      const result = await this.executePhase(phase);
      
      // Emit events
      this.eventEmitter.emit('phase:complete', result);
    }
    
    return pipeline.getResult();
  }

  private async executePhase(phase: Phase): Promise<PhaseResult> {
    // Phase execution logic
  }
}
```

Key responsibilities:
- Pipeline orchestration
- State management
- Event coordination
- Error handling

### 2. State Machine

Location: `src/core/state-machine.ts`

```typescript
export class StateMachine {
  private currentState: State;
  private transitions: Map<string, Transition>;
  
  transition(event: string): void {
    const transition = this.transitions.get(
      `${this.currentState}:${event}`
    );
    
    if (!transition) {
      throw new InvalidTransitionError();
    }
    
    this.currentState = transition.to;
    transition.action?.();
  }
}
```

States:
- `IDLE`: Initial state
- `BUSINESS`: Business phase
- `MODELS`: Models phase
- `ACTIONS`: Actions phase
- `DELIVERABLES`: Deliverables phase
- `COMPLETED`: Final state
- `FAILED`: Error state
- `PAUSED`: Paused state

### 3. Pipeline Engine

Location: `src/core/pipeline.ts`

```typescript
export class Pipeline {
  private phases: Phase[] = [];
  private mode: ExecutionMode;
  
  async execute(): Promise<PipelineResult> {
    for (const phase of this.phases) {
      if (this.mode === 'semi') {
        await this.requestApproval(phase);
      }
      
      const result = await phase.execute();
      
      if (!result.success && !phase.optional) {
        throw new PipelineError(result.error);
      }
    }
  }
}
```

### 4. Agent System

Location: `src/roles/base-agent.ts`

```typescript
export abstract class BaseAgent {
  protected model: string;
  protected temperature: number;
  
  abstract getName(): string;
  abstract getCapabilities(): string[];
  
  async execute(task: Task): Promise<TaskResult> {
    // Pre-execution hooks
    await this.beforeExecute(task);
    
    // Main execution
    const result = await this.performTask(task);
    
    // Post-execution hooks
    await this.afterExecute(result);
    
    return result;
  }
  
  protected abstract performTask(task: Task): Promise<TaskResult>;
}
```

## Extending the System

### Adding New Features

1. **Create Feature Module**

```typescript
// src/features/my-feature/index.ts
export class MyFeature {
  constructor(private orchestrator: Orchestrator) {}
  
  async initialize(): Promise<void> {
    // Register with orchestrator
    this.orchestrator.registerFeature(this);
  }
  
  async execute(context: Context): Promise<Result> {
    // Feature implementation
  }
}
```

2. **Register Feature**

```typescript
// src/features/registry.ts
import { MyFeature } from './my-feature';

export function registerFeatures(orchestrator: Orchestrator) {
  const myFeature = new MyFeature(orchestrator);
  await myFeature.initialize();
}
```

3. **Add Configuration**

```typescript
// src/types/index.ts
export interface FeatureConfig {
  myFeature?: {
    enabled: boolean;
    options?: MyFeatureOptions;
  };
}
```

### Creating Custom Pipelines

```typescript
// src/pipelines/custom-pipeline.ts
import { Pipeline, Phase } from '../core/pipeline';

export class CustomPipeline extends Pipeline {
  constructor() {
    super();
    
    this.addPhase(new CustomPhase1());
    this.addPhase(new CustomPhase2());
    this.addPhase(new CustomPhase3());
  }
  
  protected async validate(): Promise<boolean> {
    // Custom validation logic
    return true;
  }
  
  protected async onComplete(result: PipelineResult): Promise<void> {
    // Custom completion logic
  }
}
```

## Creating Custom Agents

### Step 1: Define Agent Class

```typescript
// src/roles/custom/index.ts
import { BaseAgent } from '../base-agent';
import { Task, TaskResult } from '../../types';

export class CustomAgent extends BaseAgent {
  getName(): string {
    return 'custom';
  }
  
  getCapabilities(): string[] {
    return [
      'custom-analysis',
      'specialized-generation',
      'domain-specific-tasks'
    ];
  }
  
  protected async performTask(task: Task): Promise<TaskResult> {
    // Implement your agent logic
    const prompt = this.buildPrompt(task);
    const response = await this.callModel(prompt);
    
    return {
      success: true,
      output: this.processResponse(response),
      metrics: this.collectMetrics()
    };
  }
  
  private buildPrompt(task: Task): string {
    return `
      You are a specialized agent for ${task.type}.
      
      Task: ${task.description}
      Context: ${JSON.stringify(task.context)}
      
      Please provide: ${task.expectedOutput}
    `;
  }
}
```

### Step 2: Register Agent

```typescript
// src/roles/agent-factory.ts
import { CustomAgent } from './custom';

export class AgentFactory {
  static create(type: string): BaseAgent {
    switch (type) {
      case 'custom':
        return new CustomAgent();
      // ... other agents
    }
  }
}
```

### Step 3: Add Configuration

```typescript
// src/types/index.ts
export type AgentType = 'architect' | 'developer' | 'tester' | 'debugger' | 'custom';

export interface AgentConfig {
  custom?: {
    model: string;
    temperature: number;
    specialization?: string;
  };
}
```

### Step 4: Create Tests

```typescript
// tests/unit/roles/custom.test.ts
import { describe, it, expect, vi } from 'vitest';
import { CustomAgent } from '../../../src/roles/custom';

describe('CustomAgent', () => {
  it('should execute custom tasks', async () => {
    const agent = new CustomAgent();
    const task = {
      type: 'custom-analysis',
      description: 'Analyze data'
    };
    
    const result = await agent.execute(task);
    
    expect(result.success).toBe(true);
    expect(result.output).toBeDefined();
  });
});
```

## Building Adapters

### Adapter Interface

```typescript
// src/adapters/base.adapter.ts
export interface Adapter<T = any> {
  name: string;
  initialize(): Promise<void>;
  execute(action: string, params: any): Promise<T>;
  healthCheck(): Promise<boolean>;
  cleanup(): Promise<void>;
}
```

### Creating Custom Adapter

```typescript
// src/adapters/custom.adapter.ts
import { Adapter } from './base.adapter';

export class CustomAdapter implements Adapter {
  private client: CustomClient;
  
  get name(): string {
    return 'custom-service';
  }
  
  async initialize(): Promise<void> {
    this.client = new CustomClient({
      apiKey: process.env.CUSTOM_API_KEY,
      endpoint: process.env.CUSTOM_ENDPOINT
    });
    
    await this.client.connect();
  }
  
  async execute(action: string, params: any): Promise<any> {
    switch (action) {
      case 'fetch':
        return this.client.fetch(params);
      case 'update':
        return this.client.update(params);
      case 'delete':
        return this.client.delete(params);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }
  
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }
  
  async cleanup(): Promise<void> {
    await this.client.disconnect();
  }
}
```

### Registering Adapter

```typescript
// src/adapters/registry.ts
import { CustomAdapter } from './custom.adapter';

export class AdapterRegistry {
  private adapters = new Map<string, Adapter>();
  
  async register(adapter: Adapter): Promise<void> {
    await adapter.initialize();
    this.adapters.set(adapter.name, adapter);
  }
  
  get(name: string): Adapter | undefined {
    return this.adapters.get(name);
  }
}
```

## Writing Tools

### Tool Structure

```typescript
// src/tools/custom.tool.ts
import { z } from 'zod';
import { Tool, ToolMetadata } from './registry';

// Define input schema
const InputSchema = z.object({
  param1: z.string().min(1),
  param2: z.number().optional(),
  options: z.object({
    flag: z.boolean().default(false)
  }).optional()
});

// Define output schema
const OutputSchema = z.object({
  success: z.boolean(),
  result: z.any(),
  metadata: z.record(z.any()).optional()
});

export class CustomTool implements Tool {
  readonly metadata: ToolMetadata = {
    name: 'custom.tool',
    description: 'Performs custom operation',
    inputSchema: InputSchema,
    outputSchema: OutputSchema,
    examples: [
      {
        input: { param1: 'test', param2: 42 },
        output: { success: true, result: 'processed' }
      }
    ]
  };
  
  async execute(input: unknown): Promise<unknown> {
    // Validate input
    const validated = InputSchema.parse(input);
    
    // Perform operation
    const result = await this.performOperation(validated);
    
    // Validate output
    return OutputSchema.parse(result);
  }
  
  private async performOperation(input: z.infer<typeof InputSchema>) {
    // Implementation logic
    return {
      success: true,
      result: `Processed: ${input.param1}`,
      metadata: {
        timestamp: Date.now()
      }
    };
  }
}
```

### Registering Tool

```typescript
// src/tools/registry.ts
import { CustomTool } from './custom.tool';

export async function registerTools() {
  const registry = getToolRegistry();
  
  // Register custom tool
  await registry.register(new CustomTool());
}
```

### Testing Tools

```typescript
// tests/unit/tools/custom.tool.test.ts
import { describe, it, expect } from 'vitest';
import { CustomTool } from '../../../src/tools/custom.tool';

describe('CustomTool', () => {
  const tool = new CustomTool();
  
  it('should validate input', async () => {
    const invalidInput = { param1: '' };
    
    await expect(tool.execute(invalidInput))
      .rejects.toThrow('Validation error');
  });
  
  it('should execute successfully', async () => {
    const input = { param1: 'test', param2: 42 };
    const result = await tool.execute(input);
    
    expect(result).toMatchObject({
      success: true,
      result: expect.stringContaining('test')
    });
  });
});
```

## Testing Strategy

### Test Structure

```
tests/
├── unit/           # Unit tests
│   ├── core/      # Core component tests
│   ├── roles/     # Agent tests
│   ├── tools/     # Tool tests
│   └── adapters/  # Adapter tests
├── integration/    # Integration tests
│   ├── pipeline.test.ts
│   └── resources.test.ts
├── e2e/           # End-to-end tests
│   └── scenarios/
├── fixtures/      # Test data
├── mocks/        # Mock implementations
└── helpers/      # Test utilities
```

### Writing Unit Tests

```typescript
// tests/unit/example.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MyClass } from '../../src/my-class';

describe('MyClass', () => {
  let instance: MyClass;
  
  beforeEach(() => {
    instance = new MyClass();
  });
  
  it('should perform operation', async () => {
    const spy = vi.spyOn(instance, 'method');
    const result = await instance.performOperation();
    
    expect(spy).toHaveBeenCalled();
    expect(result).toBeDefined();
  });
});
```

### Writing Integration Tests

```typescript
// tests/integration/pipeline.test.ts
import { describe, it, expect } from 'vitest';
import { Orchestrator } from '../../src/core/orchestrator';

describe('Pipeline Integration', () => {
  it('should execute complete pipeline', async () => {
    const orchestrator = new Orchestrator();
    
    const result = await orchestrator.runPipeline({
      objective: 'Test objective',
      mode: 'dry-run'
    });
    
    expect(result.success).toBe(true);
    expect(result.phases).toHaveLength(4);
  });
});
```

### Writing E2E Tests

```typescript
// tests/e2e/scenarios/full-development.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Full Development Workflow', () => {
  test('should complete project from start to finish', async ({ page }) => {
    // Start orchestrator
    await page.goto('http://localhost:3001');
    
    // Initialize project
    await page.fill('#objective', 'Build TODO app');
    await page.click('#start');
    
    // Wait for completion
    await page.waitForSelector('.status-complete', {
      timeout: 300000 // 5 minutes
    });
    
    // Verify results
    const artifacts = await page.$$('.artifact');
    expect(artifacts).toHaveLength(greaterThan(5));
  });
});
```

### Test Coverage

Maintain minimum coverage thresholds:

```javascript
// vitest.config.ts
export default {
  test: {
    coverage: {
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80,
      exclude: [
        'tests/**',
        '**/*.test.ts',
        '**/*.spec.ts'
      ]
    }
  }
};
```

## Debugging Tips

### Enable Debug Logging

```typescript
// Set environment variable
process.env.DEBUG = 'mcp:*';
process.env.LOG_LEVEL = 'debug';

// Or in code
import { createLogger } from './utils/logger';

const logger = createLogger('module-name');
logger.debug('Debug message', { data });
```

### Using VS Code Debugger

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Orchestrator",
      "program": "${workspaceFolder}/src/index.ts",
      "runtimeArgs": ["-r", "ts-node/register"],
      "env": {
        "NODE_ENV": "development",
        "DEBUG": "mcp:*"
      }
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
      "args": ["run", "${file}"],
      "console": "integratedTerminal"
    }
  ]
}
```

### Common Debugging Scenarios

#### Debugging Agent Execution

```typescript
// Add breakpoints in agent code
export class ArchitectAgent extends BaseAgent {
  protected async performTask(task: Task): Promise<TaskResult> {
    // Add debug logging
    this.logger.debug('Starting task', { task });
    
    // Set breakpoint here
    debugger;
    
    const result = await this.processTask(task);
    
    this.logger.debug('Task completed', { result });
    return result;
  }
}
```

#### Debugging Pipeline Flow

```typescript
// Trace pipeline execution
export class Pipeline {
  async execute(): Promise<PipelineResult> {
    console.trace('Pipeline execution started');
    
    for (const [index, phase] of this.phases.entries()) {
      console.log(`Phase ${index + 1}/${this.phases.length}: ${phase.name}`);
      
      try {
        await phase.execute();
      } catch (error) {
        console.error(`Phase failed: ${phase.name}`, error);
        throw error;
      }
    }
  }
}
```

#### Memory Leak Detection

```typescript
// Monitor memory usage
setInterval(() => {
  const usage = process.memoryUsage();
  console.log('Memory Usage:', {
    rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
    heap: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`
  });
}, 10000);
```

## Performance Optimization

### Optimization Strategies

1. **Caching**

```typescript
// Implement caching layer
class CacheManager {
  private cache = new Map<string, CacheEntry>();
  
  async get<T>(key: string, factory: () => Promise<T>): Promise<T> {
    if (this.cache.has(key)) {
      const entry = this.cache.get(key)!;
      if (entry.expiry > Date.now()) {
        return entry.value as T;
      }
    }
    
    const value = await factory();
    this.cache.set(key, {
      value,
      expiry: Date.now() + 3600000 // 1 hour
    });
    
    return value;
  }
}
```

2. **Parallel Execution**

```typescript
// Execute tasks in parallel
async function executeParallel(tasks: Task[]): Promise<TaskResult[]> {
  const chunks = chunk(tasks, MAX_PARALLEL);
  const results: TaskResult[] = [];
  
  for (const chunk of chunks) {
    const chunkResults = await Promise.all(
      chunk.map(task => executeTask(task))
    );
    results.push(...chunkResults);
  }
  
  return results;
}
```

3. **Resource Pooling**

```typescript
// Connection pool for adapters
class ConnectionPool {
  private pool: Connection[] = [];
  private available: Connection[] = [];
  
  async acquire(): Promise<Connection> {
    if (this.available.length > 0) {
      return this.available.pop()!;
    }
    
    if (this.pool.length < MAX_CONNECTIONS) {
      const conn = await this.createConnection();
      this.pool.push(conn);
      return conn;
    }
    
    // Wait for available connection
    return this.waitForConnection();
  }
  
  release(conn: Connection): void {
    this.available.push(conn);
  }
}
```

4. **Lazy Loading**

```typescript
// Lazy load heavy modules
class LazyLoader {
  private modules = new Map<string, any>();
  
  async load(moduleName: string): Promise<any> {
    if (!this.modules.has(moduleName)) {
      const module = await import(moduleName);
      this.modules.set(moduleName, module);
    }
    return this.modules.get(moduleName);
  }
}
```

### Performance Monitoring

```typescript
// Add performance monitoring
import { performance } from 'perf_hooks';

export function measurePerformance(name: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const start = performance.now();
      
      try {
        const result = await originalMethod.apply(this, args);
        const duration = performance.now() - start;
        
        logger.info(`${name} took ${duration.toFixed(2)}ms`);
        
        return result;
      } catch (error) {
        const duration = performance.now() - start;
        logger.error(`${name} failed after ${duration.toFixed(2)}ms`);
        throw error;
      }
    };
    
    return descriptor;
  };
}

// Usage
class MyService {
  @measurePerformance('Heavy Operation')
  async performHeavyOperation() {
    // Implementation
  }
}
```

## Best Practices

### Code Style

1. **TypeScript Strict Mode**

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true
  }
}
```

2. **Error Handling**

```typescript
// Always use custom error classes
export class OrchestratorError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'OrchestratorError';
  }
}

// Handle errors properly
try {
  await riskyOperation();
} catch (error) {
  if (error instanceof OrchestratorError) {
    logger.error('Orchestrator error', {
      code: error.code,
      details: error.details
    });
    // Handle specific error
  } else {
    logger.error('Unexpected error', error);
    // Handle generic error
  }
}
```

3. **Async/Await Patterns**

```typescript
// Use async/await instead of callbacks
// ❌ Bad
function loadData(callback: (err: Error | null, data?: any) => void) {
  fs.readFile('data.json', (err, data) => {
    if (err) return callback(err);
    callback(null, JSON.parse(data.toString()));
  });
}

// ✅ Good
async function loadData(): Promise<any> {
  const data = await fs.promises.readFile('data.json', 'utf-8');
  return JSON.parse(data);
}
```

4. **Dependency Injection**

```typescript
// Use dependency injection for testability
export class Service {
  constructor(
    private database: Database,
    private cache: Cache,
    private logger: Logger
  ) {}
  
  async getData(id: string): Promise<Data> {
    // Use injected dependencies
    const cached = await this.cache.get(id);
    if (cached) return cached;
    
    const data = await this.database.find(id);
    await this.cache.set(id, data);
    
    return data;
  }
}
```

### Security

1. **Input Validation**

```typescript
// Always validate input
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

function validateInput(input: unknown) {
  return schema.parse(input);
}
```

2. **Secret Management**

```typescript
// Never hardcode secrets
// ❌ Bad
const apiKey = 'sk-abc123';

// ✅ Good
const apiKey = process.env.API_KEY;
if (!apiKey) {
  throw new Error('API_KEY environment variable is required');
}
```

3. **Rate Limiting**

```typescript
// Implement rate limiting
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
```

### Documentation

1. **Code Documentation**

```typescript
/**
 * Orchestrates the execution of a multi-phase pipeline
 * @class Orchestrator
 * @example
 * const orchestrator = new Orchestrator();
 * const result = await orchestrator.runPipeline({
 *   objective: "Build application",
 *   mode: "auto"
 * });
 */
export class Orchestrator {
  /**
   * Runs a complete pipeline
   * @param {PipelineConfig} config - Pipeline configuration
   * @returns {Promise<PipelineResult>} Pipeline execution result
   * @throws {OrchestratorError} When pipeline fails
   */
  async runPipeline(config: PipelineConfig): Promise<PipelineResult> {
    // Implementation
  }
}
```

2. **README Files**

Every module should have a README:

```markdown
# Module Name

## Purpose
Brief description of what this module does

## Usage
How to use this module

## API
Public API documentation

## Testing
How to test this module

## Dependencies
List of dependencies and why they're needed
```

## Contributing

### Getting Started

1. **Fork the Repository**

```bash
# Fork on GitHub, then:
git clone https://github.com/YOUR_USERNAME/mcp-dev-orchestrator.git
cd mcp-dev-orchestrator
git remote add upstream https://github.com/mcp-team/mcp-dev-orchestrator.git
```

2. **Create Feature Branch**

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-number
```

3. **Make Changes**

Follow the coding standards and ensure tests pass:

```bash
# Run tests
pnpm test

# Check linting
pnpm lint

# Format code
pnpm format
```

4. **Commit Changes**

Use conventional commits:

```bash
git commit -m "feat: add new feature"
git commit -m "fix: resolve issue #123"
git commit -m "docs: update API documentation"
git commit -m "test: add unit tests for X"
git commit -m "refactor: improve performance of Y"
```

5. **Push and Create PR**

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

### Code Review Process

1. **PR Requirements**
   - Clear description of changes
   - Link to related issue(s)
   - Tests for new features
   - Documentation updates
   - No failing CI checks

2. **Review Checklist**
   - Code follows style guidelines
   - Tests are comprehensive
   - Documentation is updated
   - No security vulnerabilities
   - Performance impact considered

### Release Process

1. **Version Bumping**

```bash
# Patch release (1.0.0 -> 1.0.1)
pnpm version patch

# Minor release (1.0.0 -> 1.1.0)
pnpm version minor

# Major release (1.0.0 -> 2.0.0)
pnpm version major
```

2. **Creating Release**

```bash
# Create release branch
git checkout -b release/v1.2.3

# Update CHANGELOG.md
# Update version in package.json
# Create release commit
git commit -m "chore: release v1.2.3"

# Tag release
git tag v1.2.3

# Push to repository
git push origin release/v1.2.3 --tags
```

3. **Publishing to NPM**

```bash
# Build the package
pnpm build

# Run tests
pnpm test

# Publish to NPM
pnpm publish --access public
```

## Resources

### Internal Documentation

- [Architecture Overview](./ARCHITECTURE.md)
- [API Reference](./API.md)
- [Testing Guide](./TESTING.md)
- [Configuration Guide](./CONFIGURATION.md)

### External Resources

- [Model Context Protocol Spec](https://modelcontextprotocol.org)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [Clean Code JavaScript](https://github.com/ryanmcdermott/clean-code-javascript)

### Tools and Libraries

- **Testing**: [Vitest](https://vitest.dev/)
- **E2E Testing**: [Playwright](https://playwright.dev/)
- **Linting**: [Biome](https://biomejs.dev/)
- **Schema Validation**: [Zod](https://zod.dev/)
- **State Management**: [XState](https://xstate.js.org/)
- **Logging**: [Pino](https://getpino.io/)

### Community

- **Discord**: [Join our server](https://discord.gg/mcp-orchestrator)
- **GitHub Discussions**: [Ask questions](https://github.com/mcp-team/mcp-dev-orchestrator/discussions)
- **Stack Overflow**: Tag with `mcp-orchestrator`
- **Twitter**: [@MCPOrchestrator](https://twitter.com/MCPOrchestrator)

## Troubleshooting Development Issues

### Common Development Problems

#### TypeScript Compilation Errors

```bash
# Clear TypeScript cache
rm -rf node_modules/.cache
rm -rf dist
pnpm tsc --build --clean

# Reinstall dependencies
rm -rf node_modules
pnpm install
```

#### Test Failures

```bash
# Run tests in debug mode
DEBUG=* pnpm test

# Run single test file
pnpm test tests/unit/specific.test.ts

# Update snapshots
pnpm test -u
```

#### Module Resolution Issues

```typescript
// Check tsconfig.json paths
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@tests/*": ["./tests/*"]
    }
  }
}
```

#### Memory Issues

```bash
# Increase Node memory
NODE_OPTIONS="--max-old-space-size=4096" pnpm test

# Profile memory usage
node --inspect-brk node_modules/.bin/vitest
```

### Getting Help

If you're stuck:

1. Check existing issues on GitHub
2. Search Discord for similar problems
3. Create a minimal reproduction
4. Ask in #development channel on Discord
5. Open a GitHub issue with details

## Summary

This developer guide provides the foundation for understanding and extending the MCP Dev Orchestrator. Key takeaways:

1. **Architecture**: Modular, extensible design with clear separation of concerns
2. **Extensibility**: Easy to add agents, adapters, tools, and features
3. **Testing**: Comprehensive testing strategy with high coverage requirements
4. **Performance**: Built-in optimization strategies and monitoring
5. **Best Practices**: Follow established patterns and conventions
6. **Community**: Active development with community support

For more specific implementation details, refer to the source code and inline documentation. Happy coding!

---

*Last updated: 2024-01-17 | Version: 1.0.0*