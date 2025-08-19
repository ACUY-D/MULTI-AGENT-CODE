# ⚙️ MCP Dev Orchestrator Configuration Guide

## Table of Contents

1. [Overview](#overview)
2. [Environment Variables](#environment-variables)
3. [Configuration Files](#configuration-files)
4. [MCP Server Configuration](#mcp-server-configuration)
5. [Agent Configuration](#agent-configuration)
6. [Pipeline Configuration](#pipeline-configuration)
7. [Integration Configuration](#integration-configuration)
8. [Security Configuration](#security-configuration)
9. [Performance Tuning](#performance-tuning)
10. [Advanced Configuration](#advanced-configuration)
11. [Configuration Examples](#configuration-examples)
12. [Troubleshooting](#troubleshooting)

## Overview

The MCP Dev Orchestrator supports multiple configuration methods to adapt to different environments and use cases:

1. **Environment Variables**: For sensitive data and environment-specific settings
2. **Configuration Files**: For complex configurations and project settings
3. **Command-line Arguments**: For runtime overrides
4. **Default Values**: Built-in sensible defaults

### Configuration Priority

Configuration sources are applied in the following order (highest to lowest priority):

1. Command-line arguments
2. Environment variables
3. Configuration files
4. Default values

## Environment Variables

### Core Configuration

```bash
# Required
OPENAI_API_KEY=sk-...              # OpenAI API key for GPT models
ANTHROPIC_API_KEY=sk-ant-...       # Anthropic API key for Claude models

# Optional Core Settings
NODE_ENV=production                # Environment: development, production, test
LOG_LEVEL=info                      # Log level: debug, info, warn, error
PORT=3001                           # Server port for HTTP mode
HOST=localhost                      # Server host

# Performance
MAX_WORKERS=4                       # Maximum parallel workers
MEMORY_LIMIT=2048                   # Memory limit in MB
TIMEOUT_SECONDS=300                 # Global timeout in seconds
```

### Agent Configuration

```bash
# Model Selection
ARCHITECT_MODEL=gpt-4-turbo        # Architect agent model
DEVELOPER_MODEL=claude-3-opus      # Developer agent model
TESTER_MODEL=gpt-4                 # Tester agent model
DEBUGGER_MODEL=claude-3-opus       # Debugger agent model

# Model Parameters
ARCHITECT_TEMPERATURE=0.7           # Creativity level (0.0-1.0)
DEVELOPER_TEMPERATURE=0.3           # Code generation precision
TESTER_TEMPERATURE=0.5              # Test generation balance
DEBUGGER_TEMPERATURE=0.2            # Debugging accuracy

# Token Limits
ARCHITECT_MAX_TOKENS=4096          # Maximum response tokens
DEVELOPER_MAX_TOKENS=8192          
TESTER_MAX_TOKENS=4096
DEBUGGER_MAX_TOKENS=4096
```

### Integration Services

```bash
# GitHub Integration
GITHUB_TOKEN=ghp_...               # GitHub personal access token
GITHUB_ORG=my-org                  # GitHub organization
GITHUB_DEFAULT_BRANCH=main         # Default branch name

# Memory Server
MEMORY_SERVER_URL=http://localhost:3002
MEMORY_SERVER_API_KEY=mem_...

# Sequential Thinking Server
SEQUENTIAL_SERVER_URL=http://localhost:3003
SEQUENTIAL_SERVER_API_KEY=seq_...

# Playwright Server
PLAYWRIGHT_SERVER_URL=http://localhost:3004
PLAYWRIGHT_HEADLESS=true           # Run browser in headless mode
```

### Storage and Paths

```bash
# File Paths
WORKSPACE_DIR=/path/to/workspace   # Working directory for projects
CHECKPOINT_DIR=/path/to/checkpoints # Checkpoint storage directory
ARTIFACT_DIR=/path/to/artifacts    # Generated artifacts directory
CACHE_DIR=/path/to/cache          # Cache directory

# Storage Options
ENABLE_CACHE=true                  # Enable caching
CACHE_TTL=3600                     # Cache TTL in seconds
MAX_CHECKPOINT_AGE=7               # Days to keep checkpoints
AUTO_CLEANUP=true                  # Auto cleanup old files
```

## Configuration Files

### Main Configuration File

Create `mcp-orchestrator.config.json` in your project root:

```json
{
  "$schema": "https://mcp-orchestrator.dev/schema/config.json",
  "version": "1.0.0",
  "project": {
    "name": "my-project",
    "type": "fullstack",
    "description": "Project description",
    "author": "Your Name",
    "license": "MIT"
  },
  "server": {
    "mode": "stdio",
    "port": 3001,
    "host": "localhost",
    "cors": {
      "enabled": true,
      "origins": ["http://localhost:3000"]
    }
  },
  "pipeline": {
    "defaultMode": "semi",
    "phases": {
      "business": {
        "enabled": true,
        "timeout": 30
      },
      "models": {
        "enabled": true,
        "timeout": 45
      },
      "actions": {
        "enabled": true,
        "timeout": 120,
        "parallel": true
      },
      "deliverables": {
        "enabled": true,
        "timeout": 30
      }
    },
    "checkpoints": {
      "enabled": true,
      "strategy": "phase",
      "interval": 5
    },
    "errorHandling": {
      "maxRetries": 3,
      "retryDelay": 1000,
      "fallbackMode": "manual"
    }
  },
  "agents": {
    "architect": {
      "model": "gpt-4-turbo",
      "temperature": 0.7,
      "maxTokens": 4096,
      "systemPrompt": "custom/prompts/architect.md"
    },
    "developer": {
      "model": "claude-3-opus",
      "temperature": 0.3,
      "maxTokens": 8192,
      "languages": ["typescript", "python"],
      "frameworks": ["react", "express", "django"]
    },
    "tester": {
      "model": "gpt-4",
      "temperature": 0.5,
      "maxTokens": 4096,
      "testFrameworks": ["jest", "vitest", "playwright"],
      "coverageThreshold": 80
    },
    "debugger": {
      "model": "claude-3-opus",
      "temperature": 0.2,
      "maxTokens": 4096,
      "autoFix": true
    }
  },
  "integrations": {
    "github": {
      "enabled": true,
      "autoCommit": false,
      "branchStrategy": "feature",
      "prTemplate": ".github/pull_request_template.md"
    },
    "memory": {
      "enabled": true,
      "persistenceStrategy": "local",
      "syncInterval": 60
    },
    "sequential": {
      "enabled": true,
      "maxThoughts": 20
    },
    "playwright": {
      "enabled": false,
      "browsers": ["chromium"],
      "viewport": {
        "width": 1280,
        "height": 720
      }
    }
  },
  "features": {
    "autoDocumentation": true,
    "codeReview": true,
    "securityScanning": true,
    "performanceAnalysis": false,
    "telemetry": false
  },
  "output": {
    "format": "structured",
    "prettify": true,
    "includeMetadata": true,
    "artifactNaming": "{phase}_{timestamp}_{hash}"
  }
}
```

### YAML Configuration Alternative

You can also use YAML format (`mcp-orchestrator.config.yaml`):

```yaml
version: "1.0.0"

project:
  name: my-project
  type: fullstack
  description: Project description

server:
  mode: stdio
  port: 3001

pipeline:
  defaultMode: semi
  phases:
    business:
      enabled: true
      timeout: 30
    models:
      enabled: true
      timeout: 45
    actions:
      enabled: true
      timeout: 120
      parallel: true
    deliverables:
      enabled: true
      timeout: 30

agents:
  architect:
    model: gpt-4-turbo
    temperature: 0.7
  developer:
    model: claude-3-opus
    temperature: 0.3
    languages:
      - typescript
      - python
  tester:
    model: gpt-4
    temperature: 0.5
  debugger:
    model: claude-3-opus
    temperature: 0.2

integrations:
  github:
    enabled: true
    autoCommit: false
  memory:
    enabled: true
    persistenceStrategy: local
```

## MCP Server Configuration

### For Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mcp-dev-orchestrator": {
      "command": "npx",
      "args": [
        "@mcp/dev-orchestrator",
        "--stdio"
      ],
      "env": {
        "OPENAI_API_KEY": "sk-...",
        "ANTHROPIC_API_KEY": "sk-ant-...",
        "LOG_LEVEL": "info",
        "NODE_ENV": "production"
      },
      "cwd": "/path/to/workspace"
    }
  }
}
```

### For VS Code

Add to `.vscode/settings.json`:

```json
{
  "mcp.servers": {
    "dev-orchestrator": {
      "command": "node",
      "args": [
        "./node_modules/@mcp/dev-orchestrator/dist/index.js",
        "--stdio"
      ],
      "env": {
        "OPENAI_API_KEY": "${env:OPENAI_API_KEY}",
        "ANTHROPIC_API_KEY": "${env:ANTHROPIC_API_KEY}"
      }
    }
  }
}
```

### For Custom MCP Clients

```javascript
// client-config.js
export const config = {
  servers: [
    {
      name: 'dev-orchestrator',
      transport: 'stdio',
      command: 'mcp-orchestrator',
      args: ['--stdio'],
      env: process.env,
      capabilities: {
        tools: true,
        resources: true,
        prompts: true
      }
    }
  ]
};
```

## Agent Configuration

### Custom Agent Profiles

Create agent profiles in `.orchestrator/agents/`:

```json
// .orchestrator/agents/architect.json
{
  "name": "architect",
  "model": "gpt-4-turbo",
  "temperature": 0.7,
  "maxTokens": 4096,
  "systemPrompt": "You are an expert software architect...",
  "capabilities": [
    "system-design",
    "api-design",
    "database-design",
    "architecture-patterns"
  ],
  "specializations": {
    "cloud": ["aws", "gcp", "azure"],
    "patterns": ["microservices", "event-driven", "serverless"],
    "frameworks": ["react", "vue", "angular", "nextjs"]
  },
  "constraints": {
    "maxComplexity": "high",
    "preferredStack": "modern",
    "securityLevel": "enterprise"
  }
}
```

### Dynamic Agent Configuration

```javascript
// dynamic-agent-config.js
export function getAgentConfig(context) {
  return {
    architect: {
      model: context.complexity > 8 ? 'gpt-4-turbo' : 'gpt-4',
      temperature: context.creative ? 0.8 : 0.6
    },
    developer: {
      model: context.language === 'python' ? 'claude-3-opus' : 'gpt-4',
      temperature: 0.3
    }
  };
}
```

## Pipeline Configuration

### Pipeline Templates

Create reusable pipeline templates:

```json
// .orchestrator/pipelines/web-app.json
{
  "name": "web-app-pipeline",
  "description": "Standard web application pipeline",
  "phases": [
    {
      "name": "business",
      "tasks": [
        "gather-requirements",
        "define-user-stories",
        "create-acceptance-criteria"
      ],
      "timeout": 30
    },
    {
      "name": "models",
      "tasks": [
        "design-architecture",
        "create-data-models",
        "define-api-contracts"
      ],
      "timeout": 45
    },
    {
      "name": "actions",
      "tasks": [
        "implement-backend",
        "implement-frontend",
        "write-tests"
      ],
      "parallel": true,
      "timeout": 120
    },
    {
      "name": "deliverables",
      "tasks": [
        "generate-documentation",
        "create-deployment-config",
        "prepare-release"
      ],
      "timeout": 30
    }
  ],
  "hooks": {
    "beforePhase": "validate-prerequisites",
    "afterPhase": "save-checkpoint",
    "onError": "rollback-changes"
  }
}
```

### Conditional Pipeline Configuration

```yaml
# conditional-pipeline.yaml
pipeline:
  conditions:
    - if: project.type == "api"
      phases:
        actions:
          tasks:
            - implement-endpoints
            - add-authentication
            - setup-rate-limiting
    
    - if: project.type == "frontend"
      phases:
        actions:
          tasks:
            - setup-routing
            - implement-components
            - add-state-management
    
    - if: project.scale == "enterprise"
      phases:
        models:
          additional_tasks:
            - design-microservices
            - plan-scalability
            - security-assessment
```

## Integration Configuration

### GitHub Integration

```json
{
  "integrations": {
    "github": {
      "enabled": true,
      "authentication": {
        "type": "token",
        "token": "${GITHUB_TOKEN}"
      },
      "repository": {
        "owner": "my-org",
        "name": "my-repo",
        "defaultBranch": "main"
      },
      "workflow": {
        "autoCommit": false,
        "commitMessage": "feat: {task_description}",
        "branchNaming": "feature/{task_id}",
        "pullRequest": {
          "autoCreate": true,
          "template": ".github/PULL_REQUEST_TEMPLATE.md",
          "reviewers": ["@team-lead"],
          "labels": ["auto-generated"]
        }
      },
      "hooks": {
        "onPush": "run-ci",
        "onMerge": "deploy-staging"
      }
    }
  }
}
```

### Memory Server Integration

```json
{
  "integrations": {
    "memory": {
      "enabled": true,
      "server": {
        "url": "http://localhost:3002",
        "apiKey": "${MEMORY_API_KEY}"
      },
      "storage": {
        "type": "persistent",
        "backend": "sqlite",
        "path": "./data/memory.db"
      },
      "sync": {
        "enabled": true,
        "interval": 60,
        "batchSize": 100
      },
      "retention": {
        "maxAge": 30,
        "maxSize": "1GB",
        "compressionEnabled": true
      }
    }
  }
}
```

## Security Configuration

### API Key Management

```json
{
  "security": {
    "apiKeys": {
      "storage": "environment",
      "encryption": true,
      "rotation": {
        "enabled": true,
        "interval": 90
      }
    },
    "authentication": {
      "required": true,
      "methods": ["api-key", "jwt"],
      "rateLimit": {
        "enabled": true,
        "requests": 100,
        "window": 900
      }
    },
    "authorization": {
      "rbac": true,
      "roles": {
        "admin": ["*"],
        "developer": ["run", "status", "logs"],
        "viewer": ["status", "logs"]
      }
    }
  }
}
```

### Secure Communication

```json
{
  "security": {
    "transport": {
      "tls": {
        "enabled": true,
        "cert": "/path/to/cert.pem",
        "key": "/path/to/key.pem",
        "ca": "/path/to/ca.pem"
      },
      "cors": {
        "enabled": true,
        "origins": ["https://trusted-domain.com"],
        "credentials": true
      }
    },
    "encryption": {
      "atRest": true,
      "inTransit": true,
      "algorithm": "AES-256-GCM"
    }
  }
}
```

## Performance Tuning

### Resource Limits

```json
{
  "performance": {
    "resources": {
      "cpu": {
        "limit": "2",
        "request": "0.5"
      },
      "memory": {
        "limit": "4Gi",
        "request": "1Gi"
      },
      "disk": {
        "limit": "10Gi"
      }
    },
    "concurrency": {
      "maxWorkers": 4,
      "maxParallelPipelines": 2,
      "queueSize": 100
    },
    "timeouts": {
      "global": 3600,
      "phase": 600,
      "task": 300,
      "api": 30
    }
  }
}
```

### Caching Configuration

```json
{
  "performance": {
    "cache": {
      "enabled": true,
      "type": "redis",
      "connection": {
        "host": "localhost",
        "port": 6379,
        "password": "${REDIS_PASSWORD}"
      },
      "strategies": {
        "models": {
          "ttl": 3600,
          "maxSize": "100MB"
        },
        "artifacts": {
          "ttl": 86400,
          "maxSize": "1GB"
        },
        "api": {
          "ttl": 300,
          "maxSize": "10MB"
        }
      },
      "invalidation": {
        "onUpdate": true,
        "scheduled": "0 0 * * *"
      }
    }
  }
}
```

### Optimization Settings

```json
{
  "optimization": {
    "lazyLoading": true,
    "bundleSize": {
      "maxChunkSize": "500KB",
      "splitChunks": true
    },
    "compression": {
      "enabled": true,
      "algorithm": "gzip",
      "level": 6
    },
    "minification": {
      "js": true,
      "css": true,
      "html": true
    },
    "parallelization": {
      "enabled": true,
      "strategy": "adaptive",
      "maxThreads": 8
    }
  }
}
```

## Advanced Configuration

### Feature Flags

```json
{
  "features": {
    "flags": {
      "newArchitecture": {
        "enabled": true,
        "rollout": 100
      },
      "experimentalOptimizer": {
        "enabled": false,
        "rollout": 0,
        "allowlist": ["user1", "user2"]
      },
      "betaFeatures": {
        "enabled": true,
        "rollout": 50,
        "conditions": {
          "environment": ["staging", "development"]
        }
      }
    },
    "experiments": {
      "abTesting": true,
      "canary": {
        "enabled": true,
        "percentage": 10
      }
    }
  }
}
```

### Monitoring and Telemetry

```json
{
  "monitoring": {
    "metrics": {
      "enabled": true,
      "provider": "prometheus",
      "endpoint": "http://localhost:9090",
      "interval": 60
    },
    "logging": {
      "level": "info",
      "format": "json",
      "outputs": [
        {
          "type": "console",
          "level": "info"
        },
        {
          "type": "file",
          "path": "/var/log/orchestrator.log",
          "level": "debug",
          "rotation": {
            "maxSize": "100MB",
            "maxFiles": 10
          }
        },
        {
          "type": "elasticsearch",
          "url": "http://localhost:9200",
          "index": "orchestrator-logs"
        }
      ]
    },
    "tracing": {
      "enabled": true,
      "provider": "jaeger",
      "endpoint": "http://localhost:14268",
      "sampling": 0.1
    },
    "healthcheck": {
      "enabled": true,
      "endpoint": "/health",
      "interval": 30
    }
  }
}
```

### Multi-Environment Configuration

```json
// config.development.json
{
  "extends": "./config.base.json",
  "environment": "development",
  "server": {
    "port": 3001,
    "debug": true
  },
  "logging": {
    "level": "debug"
  }
}

// config.production.json
{
  "extends": "./config.base.json",
  "environment": "production",
  "server": {
    "port": 8080,
    "cluster": true
  },
  "logging": {
    "level": "error"
  },
  "security": {
    "strict": true
  }
}
```

## Configuration Examples

### Minimal Configuration

```json
{
  "project": {
    "name": "my-app"
  },
  "agents": {
    "developer": {
      "model": "gpt-4"
    }
  }
}
```

### Full-Stack Application

```json
{
  "project": {
    "name": "e-commerce",
    "type": "fullstack"
  },
  "pipeline": {
    "defaultMode": "semi",
    "phases": {
      "business": { "timeout": 45 },
      "models": { "timeout": 60 },
      "actions": { "timeout": 180, "parallel": true },
      "deliverables": { "timeout": 45 }
    }
  },
  "agents": {
    "architect": {
      "model": "gpt-4-turbo",
      "specialization": "microservices"
    },
    "developer": {
      "model": "claude-3-opus",
      "languages": ["typescript", "python"],
      "frameworks": ["nextjs", "fastapi"]
    },
    "tester": {
      "model": "gpt-4",
      "coverageThreshold": 85
    }
  },
  "integrations": {
    "github": { "enabled": true },
    "memory": { "enabled": true }
  }
}
```

### API-Only Project

```yaml
project:
  name: rest-api
  type: api

pipeline:
  phases:
    business:
      focus: api-requirements
    models:
      focus: data-models
    actions:
      tasks:
        - implement-endpoints
        - add-validation
        - write-tests

agents:
  developer:
    model: claude-3-opus
    frameworks:
      - express
      - fastify
    databases:
      - postgresql
      - redis

features:
  autoDocumentation: true
  openApiGeneration: true
```

## Troubleshooting

### Configuration Validation

```bash
# Validate configuration file
mcp-orchestrator config validate

# Check effective configuration
mcp-orchestrator config show --effective

# Test configuration
mcp-orchestrator config test
```

### Common Issues

#### Issue: Configuration Not Loading

```bash
# Check file location
ls -la mcp-orchestrator.config.{json,yaml,yml}

# Verify syntax
mcp-orchestrator config validate --file ./config.json

# Check environment variables
env | grep ORCHESTRATOR
```

#### Issue: Agent Model Not Available

```json
{
  "agents": {
    "architect": {
      "model": "gpt-4-turbo",
      "fallback": "gpt-4"
    }
  }
}
```

#### Issue: Performance Problems

```json
{
  "performance": {
    "debug": true,
    "profiling": true,
    "metrics": {
      "detailed": true
    }
  }
}
```

### Configuration Best Practices

1. **Use Environment Variables for Secrets**
   - Never commit API keys
   - Use `.env.example` as template

2. **Version Your Configuration**
   - Include version field
   - Track changes in git

3. **Validate Before Deployment**
   - Run validation tests
   - Check all integrations

4. **Use Appropriate Defaults**
   - Set sensible fallbacks
   - Document requirements

5. **Monitor Configuration Changes**
   - Log configuration loads
   - Track configuration errors

## Migration Guide

### From v0.x to v1.0

```javascript
// migration-script.js
const oldConfig = require('./old-config.json');
const newConfig = {
  version: '1.0.0',
  project: oldConfig.name ? { name: oldConfig.name } : {},
  agents: Object.entries(oldConfig.agents || {}).reduce((acc, [key, value]) => {
    acc[key] = {
      model: value.model_name || value.model,
      temperature: value.temp || value.temperature
    };
    return acc;
  }, {})
};

fs.writeFileSync('./mcp-orchestrator.config.json', JSON.stringify(newConfig, null, 2));
```

---

## Support

For configuration assistance:

- 📖 [Configuration Schema](https://mcp-orchestrator.dev/schema)
- 💬 [Discord #configuration](https://discord.gg/mcp-orchestrator)
- 🐛 [Report Issues](https://github.com/mcp-team/mcp-dev-orchestrator/issues)

---

*Last updated: 2024-01-17 | Version: 1.0.0*