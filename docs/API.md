# 📚 MCP Dev Orchestrator API Documentation

## Table of Contents

- [Overview](#overview)
- [MCP Tools](#mcp-tools)
- [MCP Resources](#mcp-resources)
- [MCP Prompts](#mcp-prompts)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Authentication](#authentication)
- [Examples](#examples)

## Overview

The MCP Dev Orchestrator exposes a comprehensive API through the Model Context Protocol (MCP) standard. This API provides tools, resources, and prompts for automated software development using multi-agent orchestration.

### Base Configuration

```json
{
  "mcpServers": {
    "dev-orchestrator": {
      "command": "npx",
      "args": ["@mcp/dev-orchestrator", "--stdio"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

### Communication Modes

- **STDIO**: Standard input/output (recommended for local development)
- **HTTP**: REST API server (for remote access)
- **WebSocket**: Real-time bidirectional communication (coming soon)

## MCP Tools

Tools are the primary way to execute actions in the orchestrator. Each tool accepts specific parameters and returns structured results.

### 📋 orchestrator.run

Execute a complete BMAD pipeline for software development.

#### Input Schema

```typescript
{
  objective: string;           // Required: Project objective (min 10 chars)
  mode?: "auto" | "semi" | "dry-run";  // Execution mode (default: "semi")
  context?: {
    requirements?: string[];   // Business requirements
    constraints?: string[];    // Technical constraints
    technology?: string[];     // Technology stack
    budget?: number;          // Time budget in hours
  };
  agents?: {
    architect?: {
      enabled: boolean;
      model?: string;
      temperature?: number;
    };
    developer?: {
      enabled: boolean;
      model?: string;
      temperature?: number;
    };
    tester?: {
      enabled: boolean;
      model?: string;
      temperature?: number;
    };
    debugger?: {
      enabled: boolean;
      model?: string;
      temperature?: number;
    };
  };
  checkpoint?: {
    enabled: boolean;
    interval?: number;        // Minutes between checkpoints
    strategy?: "phase" | "step";
  };
}
```

#### Output Schema

```typescript
{
  success: boolean;
  pipelineId: string;
  status: "completed" | "failed" | "paused";
  phases: {
    business: {
      status: string;
      artifacts: string[];
      duration: number;
    };
    models: {
      status: string;
      artifacts: string[];
      duration: number;
    };
    actions: {
      status: string;
      artifacts: string[];
      duration: number;
    };
    deliverables: {
      status: string;
      artifacts: string[];
      duration: number;
    };
  };
  artifacts: {
    code: string[];
    tests: string[];
    docs: string[];
    configs: string[];
  };
  metrics: {
    totalDuration: number;
    linesOfCode: number;
    testCoverage: number;
    filesCreated: number;
  };
  checkpoint?: string;        // Checkpoint ID if saved
  errors?: Array<{
    phase: string;
    message: string;
    stack?: string;
  }>;
}
```

#### Example

```javascript
// MCP Client call
const result = await client.callTool('orchestrator.run', {
  objective: "Build a REST API for task management",
  mode: "semi",
  context: {
    requirements: [
      "User authentication with JWT",
      "CRUD operations for tasks",
      "Task assignment to users"
    ],
    technology: ["Node.js", "Express", "PostgreSQL"]
  }
});
```

### 🏛️ architect.plan

Generate comprehensive architecture and technical planning.

#### Input Schema

```typescript
{
  objective: string;          // Required: Project objective
  constraints?: string[];     // Technical constraints
  patterns?: string[];        // Design patterns to use
  scope?: "mvp" | "full" | "enterprise";
  deliverables?: string[];    // Expected deliverables
}
```

#### Output Schema

```typescript
{
  success: boolean;
  planId: string;
  architecture: {
    type: string;             // e.g., "microservices", "monolithic"
    components: Array<{
      name: string;
      type: string;
      responsibility: string;
      dependencies: string[];
    }>;
    dataFlow: Array<{
      from: string;
      to: string;
      protocol: string;
    }>;
  };
  technology: {
    frontend?: string[];
    backend?: string[];
    database?: string[];
    infrastructure?: string[];
  };
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    priority: "high" | "medium" | "low";
    estimatedHours: number;
    dependencies: string[];
  }>;
  risks: Array<{
    description: string;
    impact: "high" | "medium" | "low";
    mitigation: string;
  }>;
  timeline: {
    phases: Array<{
      name: string;
      startWeek: number;
      duration: number;
    }>;
    totalWeeks: number;
  };
}
```

#### Example

```javascript
const plan = await client.callTool('architect.plan', {
  objective: "Design e-commerce platform",
  constraints: [
    "Must handle 10k concurrent users",
    "PCI compliance required"
  ],
  patterns: ["Repository", "Factory", "Observer"],
  scope: "mvp"
});
```

### 💻 developer.implement

Implement code features based on specifications.

#### Input Schema

```typescript
{
  taskIds?: string[];         // Task IDs to implement
  specification?: string;     // Direct specification
  language?: string;          // Programming language
  framework?: string;         // Framework to use
  style?: {
    naming?: "camelCase" | "snake_case" | "PascalCase";
    indentation?: 2 | 4;
    quotes?: "single" | "double";
  };
  testDriven?: boolean;       // Write tests first
}
```

#### Output Schema

```typescript
{
  success: boolean;
  implementationId: string;
  files: Array<{
    path: string;
    content: string;
    language: string;
    linesOfCode: number;
    type: "source" | "test" | "config";
  }>;
  dependencies: {
    production: Record<string, string>;
    development: Record<string, string>;
  };
  commands: {
    install: string;
    build?: string;
    start: string;
    test?: string;
  };
  documentation: {
    readme?: string;
    api?: string;
    comments: number;         // Number of inline comments
  };
  metrics: {
    filesCreated: number;
    totalLines: number;
    testCoverage?: number;
    complexity?: number;
  };
}
```

#### Example

```javascript
const implementation = await client.callTool('developer.implement', {
  specification: "RESTful API with user authentication",
  language: "TypeScript",
  framework: "Express",
  style: {
    naming: "camelCase",
    indentation: 2
  },
  testDriven: true
});
```

### 🧪 tester.validate

Run comprehensive testing and validation.

#### Input Schema

```typescript
{
  suites?: Array<"unit" | "integration" | "e2e" | "performance">;
  targetPath?: string;        // Path to test
  coverage?: {
    threshold?: number;       // Minimum coverage percentage
    reportFormat?: "html" | "json" | "text";
  };
  parallel?: boolean;         // Run tests in parallel
  watch?: boolean;           // Watch mode
  generateMissing?: boolean; // Generate missing tests
}
```

#### Output Schema

```typescript
{
  success: boolean;
  testRunId: string;
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;         // milliseconds
  };
  suites: Array<{
    name: string;
    type: string;
    tests: Array<{
      name: string;
      status: "passed" | "failed" | "skipped";
      duration: number;
      error?: {
        message: string;
        stack: string;
      };
    }>;
  }>;
  coverage?: {
    lines: number;
    branches: number;
    functions: number;
    statements: number;
    uncoveredFiles?: string[];
  };
  performance?: {
    responseTime: {
      p50: number;
      p95: number;
      p99: number;
    };
    throughput: number;
  };
  recommendations: string[];
}
```

#### Example

```javascript
const validation = await client.callTool('tester.validate', {
  suites: ['unit', 'integration'],
  coverage: {
    threshold: 80,
    reportFormat: 'html'
  },
  parallel: true,
  generateMissing: true
});
```

### 🐛 debugger.fix

Analyze and automatically fix errors.

#### Input Schema

```typescript
{
  failureRef?: string;        // Reference to failure
  error?: {
    message: string;
    stack?: string;
    file?: string;
    line?: number;
  };
  context?: {
    recentChanges?: string[];
    environment?: Record<string, string>;
    logs?: string[];
  };
  autoFix?: boolean;          // Attempt automatic fix
  maxAttempts?: number;       // Max fix attempts
}
```

#### Output Schema

```typescript
{
  success: boolean;
  debugSessionId: string;
  diagnosis: {
    rootCause: string;
    category: "syntax" | "runtime" | "logic" | "performance" | "security";
    severity: "critical" | "high" | "medium" | "low";
    affectedFiles: string[];
  };
  fixes: Array<{
    file: string;
    changes: Array<{
      line: number;
      original: string;
      fixed: string;
      explanation: string;
    }>;
    applied: boolean;
  }>;
  verification: {
    testsRun: boolean;
    testsPassed: boolean;
    buildSuccessful: boolean;
  };
  recommendations: Array<{
    action: string;
    priority: "high" | "medium" | "low";
    rationale: string;
  }>;
}
```

#### Example

```javascript
const fix = await client.callTool('debugger.fix', {
  error: {
    message: "Cannot read property 'id' of undefined",
    stack: "at UserService.getUser (user.service.ts:45)",
    file: "src/services/user.service.ts",
    line: 45
  },
  autoFix: true,
  maxAttempts: 3
});
```

## MCP Resources

Resources provide access to orchestrator state and information. They are read-only endpoints that return current data.

### 📊 orchestrator://state/project

Current project state and metadata.

#### URI Pattern
```
orchestrator://state/project[/{projectId}]
```

#### Response Schema

```typescript
{
  uri: string;
  mimeType: "application/json";
  text: {
    projectId: string;
    name: string;
    status: "active" | "paused" | "completed";
    currentPhase: string;
    progress: number;         // 0-100
    startedAt: string;       // ISO 8601
    updatedAt: string;       // ISO 8601
    agents: {
      active: string[];
      completed: string[];
    };
    metrics: {
      filesCreated: number;
      linesWritten: number;
      testsRun: number;
      errorCount: number;
    };
  };
}
```

#### Example

```javascript
const state = await client.readResource('orchestrator://state/project');
console.log(JSON.parse(state.text));
```

### 📜 orchestrator://history/pipelines

Pipeline execution history.

#### URI Pattern
```
orchestrator://history/pipelines[?limit=10&status=completed]
```

#### Response Schema

```typescript
{
  uri: string;
  mimeType: "application/json";
  text: {
    pipelines: Array<{
      id: string;
      objective: string;
      status: string;
      mode: string;
      startedAt: string;
      completedAt?: string;
      duration: number;
      phases: {
        business: { status: string; duration: number };
        models: { status: string; duration: number };
        actions: { status: string; duration: number };
        deliverables: { status: string; duration: number };
      };
      artifacts: number;
      success: boolean;
    }>;
    total: number;
    page: number;
    pageSize: number;
  };
}
```

### 🤖 orchestrator://capabilities/agents

Available agents and their capabilities.

#### URI Pattern
```
orchestrator://capabilities/agents[/{agentType}]
```

#### Response Schema

```typescript
{
  uri: string;
  mimeType: "application/json";
  text: {
    agents: Array<{
      type: string;
      name: string;
      description: string;
      capabilities: string[];
      models: string[];
      status: "available" | "busy" | "offline";
      statistics: {
        tasksCompleted: number;
        successRate: number;
        averageDuration: number;
      };
    }>;
  };
}
```

### 🧠 orchestrator://knowledge/graph

Knowledge graph of accumulated project information.

#### URI Pattern
```
orchestrator://knowledge/graph[?format=json|cypher]
```

#### Response Schema

```typescript
{
  uri: string;
  mimeType: "application/json";
  text: {
    nodes: Array<{
      id: string;
      type: "concept" | "technology" | "pattern" | "component";
      label: string;
      properties: Record<string, any>;
    }>;
    edges: Array<{
      from: string;
      to: string;
      relationship: string;
      properties?: Record<string, any>;
    }>;
    statistics: {
      totalNodes: number;
      totalEdges: number;
      lastUpdated: string;
    };
  };
}
```

### 🧪 orchestrator://results/tests

Test execution results and reports.

#### URI Pattern
```
orchestrator://results/tests[/{testRunId}]
```

#### Response Schema

```typescript
{
  uri: string;
  mimeType: "application/json";
  text: {
    testRuns: Array<{
      id: string;
      timestamp: string;
      suite: string;
      total: number;
      passed: number;
      failed: number;
      skipped: number;
      duration: number;
      coverage?: {
        lines: number;
        branches: number;
        functions: number;
        statements: number;
      };
      failures?: Array<{
        test: string;
        error: string;
        stack?: string;
      }>;
    }>;
  };
}
```

## MCP Prompts

Prompts provide guided templates for common orchestrator operations. They help structure complex requests with proper context.

### 🚀 /kickoff

Start a new development project with guided setup.

#### Variables

```typescript
{
  objective: string;          // Required: Project objective (min 10 chars)
  mode?: "auto" | "semi" | "dry-run";  // Execution mode (default: "semi")
}
```

#### Generated Messages

```typescript
[
  {
    role: "system",
    content: "You are an expert software development orchestrator..."
  },
  {
    role: "user",
    content: "Start a new project: {objective} in {mode} mode..."
  }
]
```

#### Suggested Tools

```typescript
[
  {
    name: "orchestrator.run",
    arguments: {
      objective: "{objective}",
      mode: "{mode}"
    }
  }
]
```

#### Example

```javascript
const prompt = await client.getPrompt('/kickoff', {
  objective: "Build a real-time chat application",
  mode: "semi"
});
```

### 🤝 /hand_off

Transfer control between agents with context.

#### Variables

```typescript
{
  role: "architect" | "developer" | "tester" | "debugger";  // Target agent
  context?: string;           // Additional context
}
```

#### Generated Messages

```typescript
[
  {
    role: "system",
    content: "Facilitating handoff to {role} agent..."
  },
  {
    role: "user",
    content: "Transfer current work to {role}: {context}"
  }
]
```

#### Example

```javascript
const handoff = await client.getPrompt('/hand_off', {
  role: "tester",
  context: "Implementation complete, ready for validation"
});
```

### 📊 /status

Get current orchestrator status.

#### Variables

```typescript
{}  // No required variables
```

#### Generated Messages

```typescript
[
  {
    role: "system",
    content: "Orchestrator status monitor active..."
  },
  {
    role: "user",
    content: "Provide current status of all active operations"
  }
]
```

### ⏯️ /resume

Resume from a checkpoint.

#### Variables

```typescript
{
  checkpointId?: string;      // Specific checkpoint ID
  strategy?: "latest" | "specific";  // Resume strategy (default: "latest")
}
```

#### Generated Messages

```typescript
[
  {
    role: "system",
    content: "Checkpoint recovery system ready..."
  },
  {
    role: "user",
    content: "Resume from checkpoint using {strategy} strategy..."
  }
]
```

## Error Handling

The API uses standard HTTP status codes and MCP error formats.

### Error Response Schema

```typescript
{
  error: {
    code: string;             // Error code
    message: string;          // Human-readable message
    details?: {
      tool?: string;          // Tool that failed
      phase?: string;         // Pipeline phase
      validation?: string[];  // Validation errors
    };
  };
  isRetryable: boolean;       // Can be retried
  retryAfter?: number;        // Seconds to wait
}
```

### Common Error Codes

| Code | Description | HTTP Status | Retryable |
|------|-------------|-------------|-----------|
| `INVALID_INPUT` | Invalid input parameters | 400 | No |
| `UNAUTHORIZED` | Missing or invalid API key | 401 | No |
| `FORBIDDEN` | Insufficient permissions | 403 | No |
| `NOT_FOUND` | Resource not found | 404 | No |
| `CONFLICT` | Resource conflict | 409 | No |
| `RATE_LIMITED` | Too many requests | 429 | Yes |
| `INTERNAL_ERROR` | Server error | 500 | Yes |
| `SERVICE_UNAVAILABLE` | Service temporarily down | 503 | Yes |
| `TIMEOUT` | Operation timeout | 504 | Yes |

### Error Handling Example

```javascript
try {
  const result = await client.callTool('orchestrator.run', {
    objective: "Build app"
  });
} catch (error) {
  if (error.code === 'RATE_LIMITED') {
    // Wait and retry
    await sleep(error.retryAfter * 1000);
    // Retry operation
  } else if (error.code === 'INVALID_INPUT') {
    // Fix input and retry
    console.error('Validation errors:', error.details.validation);
  } else {
    // Handle other errors
    console.error('Operation failed:', error.message);
  }
}
```

## Rate Limiting

The API implements rate limiting to ensure fair usage and system stability.

### Rate Limits

| Endpoint Type | Limit | Window | Headers |
|--------------|-------|--------|---------|
| Tools | 100 requests | 1 minute | `X-RateLimit-Tool-*` |
| Resources | 1000 requests | 1 minute | `X-RateLimit-Resource-*` |
| Prompts | 500 requests | 1 minute | `X-RateLimit-Prompt-*` |

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1234567890
X-RateLimit-RetryAfter: 30
```

### Handling Rate Limits

```javascript
async function callWithRateLimit(tool, params) {
  const maxRetries = 3;
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      return await client.callTool(tool, params);
    } catch (error) {
      if (error.code === 'RATE_LIMITED') {
        const waitTime = error.retryAfter || 60;
        console.log(`Rate limited. Waiting ${waitTime}s...`);
        await sleep(waitTime * 1000);
        retries++;
      } else {
        throw error;
      }
    }
  }
  
  throw new Error('Max retries exceeded');
}
```

## Authentication

The orchestrator supports multiple authentication methods.

### API Key Authentication

```javascript
{
  "mcpServers": {
    "dev-orchestrator": {
      "command": "npx",
      "args": ["@mcp/dev-orchestrator", "--stdio"],
      "env": {
        "MCP_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### OAuth 2.0 (Coming Soon)

```javascript
const token = await getOAuthToken();
client.setAuthHeader(`Bearer ${token}`);
```

### JWT Authentication

```javascript
const jwt = generateJWT({
  sub: 'user-id',
  exp: Date.now() + 3600000,
  scope: ['tools:execute', 'resources:read']
});

client.setAuthHeader(`JWT ${jwt}`);
```

## Examples

### Complete Project Development

```javascript
// Full pipeline execution
async function developProject() {
  const client = new MCPClient({
    server: 'dev-orchestrator',
    apiKey: process.env.MCP_API_KEY
  });

  try {
    // 1. Create architecture
    const plan = await client.callTool('architect.plan', {
      objective: "E-commerce platform with microservices",
      constraints: ["AWS deployment", "PostgreSQL", "React frontend"],
      scope: "mvp"
    });

    console.log(`Architecture created: ${plan.planId}`);

    // 2. Implement features
    const implementation = await client.callTool('developer.implement', {
      taskIds: plan.tasks.map(t => t.id),
      language: "TypeScript",
      testDriven: true
    });

    console.log(`Code implemented: ${implementation.files.length} files`);

    // 3. Run tests
    const validation = await client.callTool('tester.validate', {
      suites: ['unit', 'integration', 'e2e'],
      coverage: { threshold: 80 }
    });

    console.log(`Tests passed: ${validation.summary.passed}/${validation.summary.total}`);

    // 4. Fix any issues
    if (validation.summary.failed > 0) {
      const fixes = await client.callTool('debugger.fix', {
        failureRef: validation.testRunId,
        autoFix: true
      });

      console.log(`Issues fixed: ${fixes.fixes.length}`);
    }

    // 5. Get final state
    const state = await client.readResource('orchestrator://state/project');
    console.log('Project completed:', JSON.parse(state.text));

  } catch (error) {
    console.error('Pipeline failed:', error);
    
    // Resume from checkpoint
    const checkpoint = error.checkpoint;
    if (checkpoint) {
      await client.getPrompt('/resume', {
        checkpointId: checkpoint,
        strategy: 'specific'
      });
    }
  }
}
```

### Stream Pipeline Progress

```javascript
// Real-time progress monitoring
async function streamProgress(pipelineId) {
  const client = new MCPClient({
    server: 'dev-orchestrator',
    streaming: true
  });

  const stream = client.streamResource(
    `orchestrator://state/project/${pipelineId}`
  );

  for await (const update of stream) {
    const state = JSON.parse(update.text);
    console.log(`Progress: ${state.progress}% - ${state.currentPhase}`);

    if (state.status === 'completed') {
      break;
    }
  }
}
```

### Batch Operations

```javascript
// Execute multiple tools in parallel
async function batchOperations() {
  const client = new MCPClient({ server: 'dev-orchestrator' });

  const operations = [
    client.callTool('architect.plan', { objective: "API Gateway" }),
    client.callTool('architect.plan', { objective: "Auth Service" }),
    client.callTool('architect.plan', { objective: "Data Service" })
  ];

  const results = await Promise.all(operations);
  
  // Merge plans
  const masterPlan = mergePlans(results);
  
  // Execute unified implementation
  return client.callTool('developer.implement', {
    specification: masterPlan
  });
}
```

### Custom Agent Chain

```javascript
// Create custom workflow
async function customWorkflow(requirement) {
  const client = new MCPClient({ server: 'dev-orchestrator' });

  // Start with architect
  let context = await client.getPrompt('/hand_off', {
    role: 'architect',
    context: requirement
  });

  // Chain through agents
  const chain = ['architect', 'developer', 'tester', 'debugger'];
  
  for (const agent of chain) {
    const result = await executeAgent(client, agent, context);
    
    if (result.success) {
      context = result.output;
    } else {
      // Handle failure
      console.error(`${agent} failed:`, result.error);
      break;
    }
  }

  return context;
}
```

## Best Practices

1. **Always handle errors gracefully** - Use try-catch and check error codes
2. **Implement retry logic** - For transient failures and rate limits
3. **Use checkpoints** - Enable recovery from failures
4. **Monitor progress** - Stream updates for long-running operations
5. **Batch when possible** - Reduce API calls by batching operations
6. **Cache resources** - Resources are read-only and can be cached
7. **Validate inputs** - Check parameters before making API calls
8. **Use appropriate timeouts** - Set timeouts for long operations
9. **Log operations** - Maintain audit trail of API usage
10. **Follow rate limits** - Respect rate limits to avoid throttling

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Tool not found" | Invalid tool name | Check tool name against documentation |
| "Invalid input" | Schema validation failure | Validate input against schema |
| "Timeout error" | Operation took too long | Increase timeout or use checkpoints |
| "Rate limited" | Too many requests | Implement exponential backoff |
| "Checkpoint not found" | Invalid checkpoint ID | List available checkpoints |
| "Agent unavailable" | Agent is busy or offline | Wait and retry or use different agent |

### Debug Mode

Enable debug mode for detailed logging:

```javascript
const client = new MCPClient({
  server: 'dev-orchestrator',
  debug: true,
  logLevel: 'debug'
});
```

### Health Check

```javascript
// Check orchestrator health
async function healthCheck() {
  const client = new MCPClient({ server: 'dev-orchestrator' });
  
  try {
    const capabilities = await client.readResource(
      'orchestrator://capabilities/agents'
    );
    
    const agents = JSON.parse(capabilities.text).agents;
    const healthy = agents.every(a => a.status !== 'offline');
    
    return {
      healthy,
      agents: agents.map(a => ({
        type: a.type,
        status: a.status
      }))
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message
    };
  }
}
```

## API Versioning

The API follows semantic versioning (SemVer).

### Version Header

```http
X-API-Version: 1.0.0
```

### Version Compatibility

| Client Version | Server Version | Compatibility |
|---------------|----------------|---------------|
| 1.0.x | 1.0.x | ✅ Full |
| 1.0.x | 1.1.x | ✅ Backward compatible |
| 1.x.x | 2.0.0 | ⚠️ Breaking changes |

### Deprecation Policy

- Features are deprecated with 3 months notice
- Deprecated features include warning headers
- Migration guides provided for breaking changes

---

## Support

For API support and questions:

- 📧 Email: api-support@mcp-orchestrator.dev
- 📖 Documentation: https://docs.mcp-orchestrator.dev/api
- 🐛 Issues: https://github.com/mcp-team/mcp-dev-orchestrator/issues
- 💬 Discord: https://discord.gg/mcp-orchestrator

---

*Last updated: 2024-01-17*