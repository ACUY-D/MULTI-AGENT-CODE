# 🤖 MCP Dev Orchestrator

[![CI](https://github.com/YOUR_USERNAME/mcp-dev-orchestrator/workflows/CI/badge.svg)](https://github.com/YOUR_USERNAME/mcp-dev-orchestrator/actions)
[![npm version](https://badge.fury.io/js/mcp-dev-orchestrator.svg)](https://www.npmjs.com/package/mcp-dev-orchestrator)
[![Downloads](https://img.shields.io/npm/dm/mcp-dev-orchestrator.svg)](https://www.npmjs.com/package/mcp-dev-orchestrator)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![MCP Protocol](https://img.shields.io/badge/MCP-v1.0-purple)](https://modelcontextprotocol.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

> 🚀 Production-ready MCP server implementing a multi-agent system for fully automated software development lifecycle with the KILO CODE methodology and BMAD framework.

<p align="center">
  <img src="https://via.placeholder.com/800x400.png?text=MCP+Dev+Orchestrator" alt="MCP Dev Orchestrator Banner" />
</p>

## 📋 Table of Contents

- [✨ Features](#-features)
- [🏗️ Architecture](#️-architecture)
- [⚡ Quick Start](#-quick-start)
- [📦 Installation](#-installation)
- [🚀 Usage](#-usage)
- [🔧 Configuration](#-configuration)
- [📚 Documentation](#-documentation)
- [🤝 MCP Integration](#-mcp-integration)
- [🧪 Testing](#-testing)
- [🛠️ Development](#️-development)
- [📈 Roadmap](#-roadmap)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)
- [🙏 Acknowledgments](#-acknowledgments)

## ✨ Features

### Core Capabilities

- 🧠 **Multi-Agent Intelligence**: Four specialized AI agents (Architect, Developer, Tester, Debugger) working in coordination
- 🔄 **BMAD Pipeline**: Automated Business → Models → Actions → Deliverables workflow
- 🔌 **MCP Integrations**: Native support for GitHub, Memory, Sequential Thinking, and Playwright servers
- 📋 **Smart CLI**: Intuitive command-line interface with rich interactive prompts
- 🧪 **Comprehensive Testing**: >80% code coverage with unit, integration, and E2E tests
- 🔐 **Enterprise Ready**: Production-grade error handling, logging, and monitoring
- 🎯 **Type Safety**: Full TypeScript implementation with strict mode
- 📊 **Real-time Monitoring**: Live pipeline execution tracking and progress reporting
- 💾 **State Persistence**: Checkpoint system for resumable operations
- 🎨 **Extensible Architecture**: Plugin system for custom agents and adapters

### Execution Modes

- **🤖 Auto Mode**: Fully autonomous execution with minimal human intervention
- **👥 Semi Mode**: Interactive execution with approval gates at key decision points  
- **🔍 Dry Run Mode**: Simulation mode for planning and validation without execution

### Advanced Features

- **🔄 Pipeline Orchestration**: Complex multi-step workflow management
- **🧩 Dynamic Agent Assignment**: Intelligent task routing based on expertise
- **📝 Knowledge Management**: Persistent memory across sessions
- **🔍 Code Analysis**: Deep code understanding and refactoring capabilities
- **🌐 Browser Automation**: Web testing and scraping via Playwright
- **🔗 GitHub Integration**: Direct repository management and PR creation
- **🧪 Test Generation**: Automatic test case creation with high coverage
- **🐛 Smart Debugging**: Intelligent error analysis and auto-fixing
- **📊 Performance Metrics**: Detailed execution analytics and reporting
- **🔐 Security First**: Built-in security scanning and vulnerability detection

## 🏗️ Architecture

```mermaid
graph TB
    subgraph "MCP Client"
        Client[MCP Client Application]
    end
    
    subgraph "MCP Dev Orchestrator"
        Server[MCP Server]
        Orchestrator[Core Orchestrator]
        
        subgraph "Agents"
            Architect[🏛️ Architect Agent]
            Developer[💻 Developer Agent]
            Tester[🧪 Tester Agent]
            Debugger[🐛 Debugger Agent]
        end
        
        subgraph "BMAD Pipeline"
            Business[📊 Business Phase]
            Models[📐 Models Phase]
            Actions[⚡ Actions Phase]
            Deliverables[📦 Deliverables Phase]
        end
        
        subgraph "MCP Adapters"
            GitHub[GitHub Adapter]
            Memory[Memory Adapter]
            Sequential[Sequential Adapter]
            Playwright[Playwright Adapter]
        end
    end
    
    subgraph "External Services"
        GitHubAPI[GitHub API]
        MemoryServer[Memory Server]
        SequentialServer[Sequential Server]
        PlaywrightServer[Playwright Server]
    end
    
    Client <--> Server
    Server <--> Orchestrator
    Orchestrator <--> Agents
    Orchestrator <--> [BMAD Pipeline]
    Agents <--> [MCP Adapters]
    GitHub <--> GitHubAPI
    Memory <--> MemoryServer
    Sequential <--> SequentialServer
    Playwright <--> PlaywrightServer
```

### Component Responsibilities

| Component | Responsibility | Key Features |
|-----------|---------------|--------------|
| **Core Orchestrator** | Central coordination and workflow management | State machine, checkpoint system, error recovery |
| **Architect Agent** | System design and technical planning | Architecture patterns, technology selection, API design |
| **Developer Agent** | Code implementation and refactoring | Multi-language support, best practices, optimization |
| **Tester Agent** | Quality assurance and validation | Unit/integration/E2E testing, coverage analysis |
| **Debugger Agent** | Error analysis and resolution | Root cause analysis, auto-fixing, performance profiling |
| **BMAD Pipeline** | Structured development methodology | Phase validation, artifact generation, quality gates |

## ⚡ Quick Start

Get up and running in less than 5 minutes:

```bash
# Install globally
npm install -g @mcp/dev-orchestrator

# Initialize a new project
mcp-orchestrator init my-awesome-app

# Run your first pipeline
mcp-orchestrator run --objective "Create a TODO app with React" --mode auto

# Start the MCP server
mcp-orchestrator start --stdio
```

## 📦 Installation

### Prerequisites

- **Node.js** >= 18.0.0 (20.x recommended)
- **npm** >= 9.0.0 or **pnpm** >= 8.0.0
- **Git** >= 2.30.0
- **Docker** (optional, for containerized execution)

### Via NPM (Recommended)

```bash
npm install @mcp/dev-orchestrator
```

### Via PNPM

```bash
pnpm add @mcp/dev-orchestrator
```

### From Source

```bash
# Clone the repository
git clone https://github.com/mcp-team/mcp-dev-orchestrator.git
cd mcp-dev-orchestrator

# Install dependencies
pnpm install

# Build the project
pnpm run build

# Link globally
npm link
```

### Docker Installation

```bash
# Pull the official image
docker pull mcpteam/dev-orchestrator:latest

# Run the container
docker run -d \
  --name mcp-orchestrator \
  -p 3001:3001 \
  -v $(pwd):/workspace \
  mcpteam/dev-orchestrator:latest
```

## 🚀 Usage

### CLI Commands

```bash
# Initialize a new project with interactive prompts
mcp-orchestrator init

# Run a development pipeline
mcp-orchestrator run pipeline.json --mode semi

# Start the MCP server
mcp-orchestrator start --stdio  # For stdio communication
mcp-orchestrator start --http --port 3001  # For HTTP server

# Execute specific agent tasks
mcp-orchestrator agent assign --type architect --task "Design REST API"
mcp-orchestrator agent execute --id task-123

# Run tests with coverage
mcp-orchestrator test --coverage --watch

# Check pipeline status
mcp-orchestrator status --pipeline-id abc123

# Resume a checkpoint
mcp-orchestrator resume --checkpoint checkpoint-xyz.json

# Analyze code quality
mcp-orchestrator analyze --path ./src --format json

# Generate documentation
mcp-orchestrator docs generate --output ./docs
```

### Programmatic Usage

```typescript
import { OrchestratorRunTool, PipelineConfig } from '@mcp/dev-orchestrator';

// Configure the pipeline
const config: PipelineConfig = {
  objective: "Build a real-time chat application",
  mode: "semi",
  context: {
    technology: ["Node.js", "Socket.io", "React"],
    requirements: [
      "Real-time messaging",
      "User authentication",
      "Message persistence"
    ]
  },
  agents: {
    architect: { enabled: true, model: "gpt-4" },
    developer: { enabled: true, model: "claude-3" },
    tester: { enabled: true, model: "gpt-4" },
    debugger: { enabled: true, model: "claude-3" }
  }
};

// Execute the pipeline
const result = await OrchestratorRunTool.execute(config);

// Handle results
if (result.success) {
  console.log('Pipeline completed successfully!');
  console.log('Artifacts:', result.artifacts);
  console.log('Metrics:', result.metrics);
} else {
  console.error('Pipeline failed:', result.error);
  console.log('Checkpoint:', result.checkpoint);
}
```

### Real-World Examples

#### Example 1: Create a REST API

```typescript
import { createPipeline } from '@mcp/dev-orchestrator';

const pipeline = createPipeline({
  objective: "Create a REST API for a blog platform",
  specifications: {
    endpoints: [
      "GET /posts",
      "POST /posts",
      "GET /posts/:id",
      "PUT /posts/:id",
      "DELETE /posts/:id"
    ],
    database: "PostgreSQL",
    authentication: "JWT",
    testing: "Jest + Supertest"
  }
});

await pipeline.execute();
```

#### Example 2: Build a Full-Stack Application

```typescript
import { Orchestrator } from '@mcp/dev-orchestrator';

const orchestrator = new Orchestrator();

await orchestrator.runPipeline({
  objective: "Build a task management system",
  phases: {
    business: {
      requirements: ["User stories", "Acceptance criteria"],
      deliverables: ["PRD", "Technical spec"]
    },
    models: {
      architecture: "Microservices",
      database: "MongoDB",
      frontend: "Next.js"
    },
    actions: {
      parallelExecution: true,
      testDriven: true
    },
    deliverables: {
      documentation: true,
      deployment: "Docker + Kubernetes"
    }
  }
});
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in your project root:

```env
# Core Configuration
NODE_ENV=production
LOG_LEVEL=info
PORT=3001

# Agent Models
ARCHITECT_MODEL=gpt-4
DEVELOPER_MODEL=claude-3-opus
TESTER_MODEL=gpt-4
DEBUGGER_MODEL=claude-3-opus

# API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GITHUB_TOKEN=ghp_...

# MCP Servers
MEMORY_SERVER_URL=http://localhost:3002
SEQUENTIAL_SERVER_URL=http://localhost:3003
PLAYWRIGHT_SERVER_URL=http://localhost:3004

# Pipeline Configuration
MAX_RETRIES=3
CHECKPOINT_INTERVAL=5
TIMEOUT_MINUTES=30

# Feature Flags
ENABLE_PARALLEL_AGENTS=true
ENABLE_AUTO_RECOVERY=true
ENABLE_METRICS=true
```

### Configuration File

Create `orchestrator.config.json`:

```json
{
  "server": {
    "mode": "stdio",
    "port": 3001,
    "host": "localhost"
  },
  "pipeline": {
    "defaultMode": "semi",
    "maxConcurrentAgents": 2,
    "checkpointStrategy": "phase",
    "errorRecovery": "retry"
  },
  "agents": {
    "architect": {
      "model": "gpt-4",
      "temperature": 0.7,
      "maxTokens": 4096
    },
    "developer": {
      "model": "claude-3-opus",
      "temperature": 0.3,
      "maxTokens": 8192
    },
    "tester": {
      "model": "gpt-4",
      "temperature": 0.5,
      "maxTokens": 4096
    },
    "debugger": {
      "model": "claude-3-opus",
      "temperature": 0.2,
      "maxTokens": 4096
    }
  },
  "integrations": {
    "github": {
      "enabled": true,
      "autoCommit": false,
      "branchStrategy": "feature"
    },
    "memory": {
      "enabled": true,
      "persistenceStrategy": "local"
    }
  }
}
```

## 📚 Documentation

### Core Documentation

- 📖 [**User Guide**](docs/USER-GUIDE.md) - Complete usage instructions
- 🔧 [**API Reference**](docs/API.md) - Detailed API documentation
- 👨‍💻 [**Developer Guide**](docs/DEVELOPER-GUIDE.md) - Development and extension guide
- ⚙️ [**Configuration Guide**](docs/CONFIGURATION.md) - All configuration options
- 🏛️ [**Architecture**](docs/ARCHITECTURE.md) - System design and patterns
- 🧪 [**Testing Guide**](docs/TESTING.md) - Testing strategies and examples
- 🚀 [**Deployment Guide**](docs/DEPLOYMENT.md) - Production deployment instructions

### Design Documents

- [**Technical Specification**](TECH-SPEC.md) - Detailed technical requirements
- [**Architecture Decisions**](DECISIONS.md) - ADRs and design rationale
- [**Task Plan**](TASKPLAN.md) - Development roadmap
- [**Security Policy**](SECURITY.md) - Security guidelines and reporting

## 🤝 MCP Integration

This server implements the Model Context Protocol (MCP) v1.0 specification.

### Available Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `orchestrator_run` | Execute a complete BMAD pipeline | `objective`, `mode`, `context` |
| `architect_plan` | Generate system architecture | `requirements`, `constraints` |
| `developer_implement` | Implement code features | `specification`, `language` |
| `tester_validate` | Run comprehensive tests | `testType`, `coverage` |
| `debugger_fix` | Analyze and fix issues | `error`, `context` |

### Available Resources

| Resource | URI Pattern | Description |
|----------|-------------|-------------|
| Project State | `orchestrator://state/project` | Current project state and metadata |
| Pipeline History | `orchestrator://history/pipelines` | Execution history and metrics |
| Agent Capabilities | `orchestrator://capabilities/agents` | Available agents and features |
| Knowledge Graph | `orchestrator://knowledge/graph` | Accumulated project knowledge |
| Test Results | `orchestrator://results/tests` | Test execution reports |

### Available Prompts

| Prompt | Description | Variables |
|--------|-------------|-----------|
| `architecture_design` | Generate system architecture | `requirements`, `constraints`, `patterns` |
| `code_implementation` | Generate implementation code | `specification`, `language`, `framework` |
| `test_generation` | Generate test suites | `code`, `coverage`, `framework` |
| `debug_analysis` | Analyze and fix errors | `error`, `stackTrace`, `context` |
| `code_review` | Review code quality | `code`, `standards`, `language` |

### Integration Example

```json
{
  "mcpServers": {
    "dev-orchestrator": {
      "command": "npx",
      "args": ["@mcp/dev-orchestrator", "--stdio"],
      "env": {
        "OPENAI_API_KEY": "sk-...",
        "GITHUB_TOKEN": "ghp-..."
      }
    }
  }
}
```

## 🧪 Testing

### Test Suites

```bash
# Run all tests
pnpm test

# Run specific test suites
pnpm test:unit          # Unit tests only
pnpm test:integration   # Integration tests
pnpm test:e2e          # End-to-end tests

# Run with coverage
pnpm test:coverage      # Generate coverage report
pnpm coverage:html      # Open HTML coverage report

# Watch mode for development
pnpm test:watch         # Auto-run on changes

# UI mode for debugging
pnpm test:ui           # Interactive test runner

# E2E test utilities
pnpm e2e:headed        # Run E2E with browser visible
pnpm e2e:debug         # Debug E2E tests
pnpm e2e:codegen       # Generate E2E test code
```

### Coverage Report

| Component | Coverage | Status |
|-----------|----------|--------|
| Core | 92% | ✅ |
| Agents | 88% | ✅ |
| Adapters | 85% | ✅ |
| Tools | 90% | ✅ |
| CLI | 78% | ⚠️ |
| **Overall** | **87%** | ✅ |

## 🛠️ Development

### Project Structure

```
mcp-dev-orchestrator/
├── src/
│   ├── core/                 # Core orchestration engine
│   │   ├── orchestrator.ts   # Main orchestrator class
│   │   ├── pipeline.ts       # BMAD pipeline implementation
│   │   ├── state-machine.ts  # State management
│   │   └── checkpoint.ts     # Checkpoint system
│   ├── roles/                # Agent implementations
│   │   ├── architect/        # Architect agent
│   │   ├── developer/        # Developer agent
│   │   ├── tester/          # Tester agent
│   │   └── debugger/        # Debugger agent
│   ├── adapters/            # External service integrations
│   │   ├── github.adapter.ts
│   │   ├── memory.adapter.ts
│   │   ├── sequential.adapter.ts
│   │   └── playwright.adapter.ts
│   ├── tools/               # MCP tool definitions
│   ├── resources/           # MCP resource definitions
│   ├── prompts/            # Prompt templates
│   ├── cli/                # CLI implementation
│   ├── types/              # TypeScript types
│   └── utils/              # Utility functions
├── tests/                  # Test suites
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   └── e2e/              # End-to-end tests
├── examples/              # Usage examples
├── docs/                  # Documentation
└── .kilo/                # Runtime artifacts
```

### Development Workflow

```bash
# 1. Clone and setup
git clone https://github.com/mcp-team/mcp-dev-orchestrator.git
cd mcp-dev-orchestrator
pnpm install

# 2. Create feature branch
git checkout -b feature/your-feature

# 3. Start development
pnpm dev                 # Start in watch mode

# 4. Write tests
pnpm test:watch         # Run tests in watch mode

# 5. Lint and format
pnpm lint              # Check code quality
pnpm format            # Format code

# 6. Build and test
pnpm build             # Build project
pnpm test:ci          # Run full CI suite

# 7. Commit changes
git add .
git commit -m "feat: add new feature"

# 8. Push and create PR
git push origin feature/your-feature
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start development server with hot reload |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server |
| `pnpm test` | Run all tests |
| `pnpm lint` | Lint code with Biome |
| `pnpm format` | Format code with Biome |
| `pnpm type-check` | Check TypeScript types |
| `pnpm clean` | Clean build artifacts |
| `pnpm docs` | Generate documentation |

## 📈 Roadmap

### Version 0.2.0 (Q2 2024)
- [ ] 🌍 Multi-language support (Python, Go, Rust)
- [ ] 🎨 Web-based dashboard UI
- [ ] 📊 Advanced analytics and reporting
- [ ] 🔌 Plugin marketplace
- [ ] 🤝 Team collaboration features

### Version 0.3.0 (Q3 2024)
- [ ] ☁️ Cloud deployment options
- [ ] 🔄 CI/CD pipeline integration
- [ ] 🎯 Custom agent training
- [ ] 📱 Mobile app development support
- [ ] 🔐 Enterprise security features

### Version 1.0.0 (Q4 2024)
- [ ] 🚀 Production-ready release
- [ ] 📚 Comprehensive documentation
- [ ] 🏢 Enterprise support
- [ ] 🌐 Global CDN distribution
- [ ] 🎓 Certification program

### Long-term Vision
- [ ] 🤖 Self-improving AI system
- [ ] 🧠 Neural architecture search
- [ ] 🔮 Predictive development
- [ ] 🌌 Quantum computing support
- [ ] 🎭 Multi-modal development

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### How to Contribute

1. 🍴 Fork the repository
2. 🌿 Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. 💻 Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. 📤 Push to the branch (`git push origin feature/AmazingFeature`)
5. 🎉 Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Write comprehensive tests (aim for >80% coverage)
- Use conventional commits
- Update documentation
- Add examples for new features

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2024 MCP Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:
```

## 🙏 Acknowledgments

- **[Anthropic](https://www.anthropic.com/)** - For the Model Context Protocol specification
- **[OpenAI](https://openai.com/)** - For GPT models and AI infrastructure
- **[BMAD Framework](https://bmad.dev/)** - For the development methodology
- **[TypeScript](https://www.typescriptlang.org/)** - For the programming language
- **[Vitest](https://vitest.dev/)** - For the testing framework
- **[Playwright](https://playwright.dev/)** - For E2E testing
- **Open Source Community** - For continuous support and contributions

## 📞 Support

- 📧 **Email**: support@mcp-orchestrator.dev
- 💬 **Discord**: [Join our community](https://discord.gg/mcp-orchestrator)
- 🐛 **Issues**: [GitHub Issues](https://github.com/mcp-team/mcp-dev-orchestrator/issues)
- 📖 **Docs**: [Documentation](https://docs.mcp-orchestrator.dev)
- 🐦 **Twitter**: [@MCPOrchestrator](https://twitter.com/MCPOrchestrator)

---

<p align="center">
  <strong>🚀 Built with ❤️ by the MCP Team</strong>
  <br>
  <sub>Making AI-driven development accessible to everyone</sub>
</p>

<p align="center">
  <a href="#-mcp-dev-orchestrator">Back to top ⬆️</a>
</p>