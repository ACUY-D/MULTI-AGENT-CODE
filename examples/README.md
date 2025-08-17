# MCP Dev Orchestrator Examples

This directory contains practical examples demonstrating how to use MCP Dev Orchestrator for various development scenarios.

## 📚 Available Examples

### 1. Todo App (`todo-app/`)
A complete TODO application with React frontend and Node.js backend.

**Features:**
- User authentication with JWT
- CRUD operations for todos
- Responsive design
- PostgreSQL database
- RESTful API

**Run the example:**
```bash
cd todo-app
npm install
npm run example
```

### 2. REST API (`rest-api/`)
A comprehensive REST API for a blog platform with authentication and advanced features.

**Features:**
- JWT authentication
- Complete CRUD operations
- Rate limiting
- API versioning
- Swagger documentation
- Elasticsearch integration
- Redis caching

**Run the example:**
```bash
cd rest-api
npm install
npm run example
```

### 3. Full-Stack E-Commerce (`full-stack-app/`)
A production-ready e-commerce platform demonstrating the full power of MCP Dev Orchestrator.

**Features:**
- Microservices architecture
- Next.js frontend
- NestJS backend
- PostgreSQL + Redis
- Kubernetes deployment
- Complete CI/CD pipeline

**Run the example:**
```bash
cd full-stack-app
npm install
npm run example
```

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18.0.0
- API Keys configured in `.env`:
  ```env
  OPENAI_API_KEY=sk-...
  ANTHROPIC_API_KEY=sk-ant-...
  ```

### Running Examples

1. **Install MCP Dev Orchestrator:**
   ```bash
   npm install -g @mcp/dev-orchestrator
   ```

2. **Choose an example:**
   ```bash
   cd examples/todo-app  # or rest-api, full-stack-app
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Run the example:**
   ```bash
   npm run example
   # or
   node index.js
   ```

## 📖 Example Structure

Each example follows this structure:
```
example-name/
├── index.js           # Main example file
├── package.json       # Dependencies and scripts
├── config.json        # Configuration (optional)
├── README.md          # Specific documentation
└── output/           # Generated code (after running)
```

## 💡 Common Patterns

### Basic Pipeline Execution
```javascript
import { OrchestratorRunTool } from '@mcp/dev-orchestrator';

const result = await OrchestratorRunTool.execute({
  objective: "Your project objective",
  mode: "semi",  // or "auto", "dry-run"
  context: {
    requirements: [...],
    technology: [...]
  }
});
```

### Using Individual Agents
```javascript
import { 
  ArchitectPlanTool,
  DeveloperImplementTool,
  TesterValidateTool 
} from '@mcp/dev-orchestrator';

// Architecture planning
const plan = await ArchitectPlanTool.execute({...});

// Implementation
const code = await DeveloperImplementTool.execute({...});

// Testing
const tests = await TesterValidateTool.execute({...});
```

### Custom Pipeline Configuration
```javascript
const config = {
  pipeline: {
    phases: {
      business: { enabled: true, timeout: 30 },
      models: { enabled: true, timeout: 45 },
      actions: { enabled: true, parallel: true },
      deliverables: { enabled: true }
    }
  },
  agents: {
    architect: { model: "gpt-4-turbo" },
    developer: { model: "claude-3-opus" }
  }
};
```

## 🎯 Use Cases

### When to use each example:

| Example | Best For | Complexity | Time |
|---------|----------|------------|------|
| **Todo App** | Learning basics, simple CRUD apps | Low | ~5 min |
| **REST API** | API development, microservices | Medium | ~10 min |
| **Full-Stack** | Complete applications, production systems | High | ~20 min |

## 📝 Creating Your Own Examples

To create a new example:

1. **Create directory:**
   ```bash
   mkdir examples/my-example
   cd examples/my-example
   ```

2. **Create `package.json`:**
   ```json
   {
     "name": "my-example",
     "type": "module",
     "scripts": {
       "example": "node index.js"
     },
     "dependencies": {
       "@mcp/dev-orchestrator": "^1.0.0"
     }
   }
   ```

3. **Create `index.js`:**
   ```javascript
   import { OrchestratorRunTool } from '@mcp/dev-orchestrator';
   
   async function runExample() {
     const result = await OrchestratorRunTool.execute({
       objective: "Your objective here",
       mode: "semi"
     });
     
     console.log('Result:', result);
   }
   
   runExample().catch(console.error);
   ```

## 🤝 Contributing Examples

We welcome new examples! To contribute:

1. Create your example following the structure above
2. Ensure it demonstrates a unique use case
3. Include clear documentation
4. Test thoroughly
5. Submit a PR with your example

## 📚 Additional Resources

- [User Guide](../docs/USER-GUIDE.md)
- [API Documentation](../docs/API.md)
- [Configuration Guide](../docs/CONFIGURATION.md)
- [Developer Guide](../docs/DEVELOPER-GUIDE.md)

## ❓ FAQ

**Q: Can I modify the examples?**
A: Yes! Feel free to modify and experiment with the examples.

**Q: Do examples work in production?**
A: Examples are for demonstration. Adapt them for production use.

**Q: How do I debug examples?**
A: Set `LOG_LEVEL=debug` in your environment variables.

**Q: Can I use different AI models?**
A: Yes, configure models in the agent settings.

## 🐛 Troubleshooting

### Common Issues:

1. **API Key errors:**
   - Ensure `.env` file exists with valid keys
   - Check key format and permissions

2. **Timeout errors:**
   - Increase timeout in configuration
   - Use checkpointing for long operations

3. **Memory issues:**
   - Increase Node.js memory: `NODE_OPTIONS="--max-old-space-size=4096"`

## 📞 Support

- GitHub Issues: [Report problems](https://github.com/mcp-team/mcp-dev-orchestrator/issues)
- Discord: [Join community](https://discord.gg/mcp-orchestrator)
- Documentation: [Full docs](https://docs.mcp-orchestrator.dev)

---

Happy coding! 🚀