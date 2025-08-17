# Contributing to MCP Dev Orchestrator

First off, thank you for considering contributing to MCP Dev Orchestrator! It's people like you that make MCP Dev Orchestrator such a great tool. 🎉

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Getting Started](#getting-started)
- [Development Process](#development-process)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)
- [Community](#community)

## Code of Conduct

### Our Pledge

We as members, contributors, and leaders pledge to make participation in our community a harassment-free experience for everyone, regardless of age, body size, visible or invisible disability, ethnicity, sex characteristics, gender identity and expression, level of experience, education, socio-economic status, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Our Standards

Examples of behavior that contributes to creating a positive environment include:

* Using welcoming and inclusive language
* Being respectful of differing viewpoints and experiences
* Gracefully accepting constructive criticism
* Focusing on what is best for the community
* Showing empathy towards other community members

Examples of unacceptable behavior include:

* The use of sexualized language or imagery and unwelcome sexual attention or advances
* Trolling, insulting/derogatory comments, and personal or political attacks
* Public or private harassment
* Publishing others' private information without explicit permission
* Other conduct which could reasonably be considered inappropriate in a professional setting

### Enforcement

Instances of abusive, harassing, or otherwise unacceptable behavior may be reported by contacting the project team at conduct@mcp-orchestrator.dev. All complaints will be reviewed and investigated promptly and fairly.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

#### Before Submitting A Bug Report

* **Check the [debugging guide](docs/DEVELOPER-GUIDE.md#debugging-tips)**
* **Check the [FAQs](docs/USER-GUIDE.md#faqs)** for common questions
* **Search existing [issues](https://github.com/mcp-team/mcp-dev-orchestrator/issues)**
* **Check if the issue has been fixed** in the latest version

#### How Do I Submit A Good Bug Report?

Create an issue on the repository and provide the following information:

* **Use a clear and descriptive title**
* **Describe the exact steps to reproduce the problem**
* **Provide specific examples to demonstrate the steps**
* **Describe the behavior you observed and what you expected**
* **Include screenshots and animated GIFs** if possible
* **Include your configuration files** (remove sensitive data)
* **Include crash reports or error messages**
* **Include your environment details:**
  * OS and version
  * Node.js version
  * Package version
  * AI model being used

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

* **Use a clear and descriptive title**
* **Provide a detailed description of the suggested enhancement**
* **Provide specific examples to demonstrate the use case**
* **Describe the current behavior and expected behavior**
* **Explain why this enhancement would be useful**
* **List any alternative solutions you've considered**

### Your First Code Contribution

Unsure where to begin? You can start by looking through these issues:

* `good first issue` - issues which should only require a few lines of code
* `help wanted` - issues which need extra attention
* `documentation` - issues related to documentation improvements

### Pull Requests

The process described here has several goals:

- Maintain code quality
- Fix problems that are important to users
- Engage the community in working toward the best possible MCP Dev Orchestrator
- Enable a sustainable system for maintainers to review contributions

## Getting Started

### Prerequisites

1. **Node.js** >= 18.0.0
2. **pnpm** (recommended) or npm
3. **Git**
4. **TypeScript** knowledge
5. **API Keys** for testing (OpenAI/Anthropic)

### Development Setup

1. **Fork the repository**

   Click the "Fork" button at the top of the repository page.

2. **Clone your fork**

   ```bash
   git clone https://github.com/YOUR_USERNAME/mcp-dev-orchestrator.git
   cd mcp-dev-orchestrator
   ```

3. **Add upstream remote**

   ```bash
   git remote add upstream https://github.com/mcp-team/mcp-dev-orchestrator.git
   ```

4. **Install dependencies**

   ```bash
   pnpm install
   ```

5. **Set up environment**

   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

6. **Run tests to verify setup**

   ```bash
   pnpm test
   ```

## Development Process

### 1. Create a Branch

```bash
# Update main branch
git checkout main
git pull upstream main

# Create feature branch
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-number
```

### 2. Make Your Changes

Follow our [coding standards](#coding-standards) and ensure:

- Code is properly formatted
- Tests are added/updated
- Documentation is updated
- Commit messages follow conventions

### 3. Commit Your Changes

We use [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Format: <type>(<scope>): <subject>

git commit -m "feat(agents): add custom agent support"
git commit -m "fix(pipeline): resolve timeout issue"
git commit -m "docs(api): update tool documentation"
git commit -m "test(core): add orchestrator tests"
git commit -m "refactor(tools): improve error handling"
git commit -m "style(cli): format command output"
git commit -m "perf(cache): optimize cache strategy"
git commit -m "chore(deps): update dependencies"
```

#### Commit Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Test changes
- `perf`: Performance improvements
- `chore`: Maintenance tasks
- `ci`: CI/CD changes
- `build`: Build system changes

### 4. Run Tests

```bash
# Run all tests
pnpm test

# Run specific test suite
pnpm test:unit
pnpm test:integration
pnpm test:e2e

# Check coverage
pnpm test:coverage
```

### 5. Update Documentation

If your changes affect:
- Public APIs: Update [API.md](docs/API.md)
- User experience: Update [USER-GUIDE.md](docs/USER-GUIDE.md)
- Development: Update [DEVELOPER-GUIDE.md](docs/DEVELOPER-GUIDE.md)
- Configuration: Update [CONFIGURATION.md](docs/CONFIGURATION.md)

### 6. Push Changes

```bash
git push origin feature/your-feature-name
```

## Pull Request Process

### Before Submitting

- [ ] Code follows the style guidelines
- [ ] Self-review of code performed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests added that prove fix/feature works
- [ ] All tests pass locally
- [ ] Dependent changes merged

### PR Template

When you create a PR, use this template:

```markdown
## Description
Brief description of what this PR does.

## Related Issue
Fixes #(issue number)

## Type of Change
- [ ] Bug fix (non-breaking change)
- [ ] New feature (non-breaking change)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## How Has This Been Tested?
Describe the tests you ran to verify your changes.

## Checklist
- [ ] My code follows the style guidelines
- [ ] I have performed a self-review
- [ ] I have commented my code where necessary
- [ ] I have updated the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix/feature works
- [ ] All tests pass locally
- [ ] Any dependent changes have been merged

## Screenshots (if appropriate)
```

### Review Process

1. **Automated Checks**: CI/CD runs automatically
2. **Code Review**: At least one maintainer review required
3. **Testing**: All tests must pass
4. **Documentation**: Must be updated if needed
5. **Approval**: Maintainer approval required
6. **Merge**: Squash and merge to main

## Coding Standards

### TypeScript Style Guide

```typescript
// ✅ Good
export class OrchestratorService {
  private readonly config: Config;
  
  constructor(config: Config) {
    this.config = config;
  }
  
  async execute(task: Task): Promise<Result> {
    // Implementation
  }
}

// ❌ Bad
export class orchestrator_service {
  config: any;
  
  constructor(config) {
    this.config = config
  }
  
  execute(task) {
    // Implementation
  }
}
```

### File Naming

- **Files**: `kebab-case.ts`
- **Classes**: `PascalCase`
- **Interfaces**: `IPascalCase` or `PascalCase`
- **Functions**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Test files**: `*.test.ts` or `*.spec.ts`

### Code Organization

```
src/
├── core/           # Core functionality
├── roles/          # Agent implementations
├── adapters/       # External integrations
├── tools/          # MCP tools
├── resources/      # MCP resources
├── prompts/        # Prompt templates
├── types/          # TypeScript types
└── utils/          # Utility functions
```

### Best Practices

1. **Use TypeScript strict mode**
   ```json
   {
     "compilerOptions": {
       "strict": true
     }
   }
   ```

2. **Handle errors properly**
   ```typescript
   try {
     await riskyOperation();
   } catch (error) {
     logger.error('Operation failed', error);
     throw new CustomError('Descriptive message', error);
   }
   ```

3. **Use async/await over callbacks**
   ```typescript
   // ✅ Good
   const data = await fetchData();
   
   // ❌ Bad
   fetchData((err, data) => {
     // ...
   });
   ```

4. **Document complex logic**
   ```typescript
   /**
    * Calculates the optimal batch size based on available memory
    * @param totalItems Total number of items to process
    * @param memoryLimit Available memory in MB
    * @returns Optimal batch size
    */
   function calculateBatchSize(totalItems: number, memoryLimit: number): number {
     // Complex calculation
   }
   ```

5. **Write pure functions when possible**
   ```typescript
   // ✅ Good - Pure function
   function add(a: number, b: number): number {
     return a + b;
   }
   
   // ❌ Bad - Side effects
   let total = 0;
   function add(a: number): void {
     total += a;
   }
   ```

## Testing Guidelines

### Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('ComponentName', () => {
  describe('methodName', () => {
    it('should do something when condition is met', () => {
      // Arrange
      const input = 'test';
      
      // Act
      const result = doSomething(input);
      
      // Assert
      expect(result).toBe('expected');
    });
  });
});
```

### Test Coverage Requirements

- **Minimum**: 80% overall coverage
- **New code**: Must have tests
- **Critical paths**: 100% coverage required
- **Edge cases**: Must be tested

### Test Types

1. **Unit Tests** (`tests/unit/`)
   - Test individual functions/methods
   - Mock external dependencies
   - Fast execution

2. **Integration Tests** (`tests/integration/`)
   - Test component interactions
   - Use real dependencies when possible
   - Moderate execution time

3. **E2E Tests** (`tests/e2e/`)
   - Test complete workflows
   - Use real environment
   - Slower execution

### Writing Good Tests

```typescript
// ✅ Good - Descriptive, isolated, specific
it('should return user data when valid ID is provided', async () => {
  const userId = '123';
  const expectedUser = { id: '123', name: 'John' };
  
  mockDatabase.findUser.mockResolvedValue(expectedUser);
  
  const result = await userService.getUser(userId);
  
  expect(result).toEqual(expectedUser);
  expect(mockDatabase.findUser).toHaveBeenCalledWith(userId);
});

// ❌ Bad - Vague, multiple assertions, no mocking
it('test user', async () => {
  const result = await userService.getUser('123');
  expect(result).toBeDefined();
  expect(result.name).toBe('John');
  expect(result.email).toBe('john@example.com');
});
```

## Documentation

### Code Documentation

Every public API should be documented:

```typescript
/**
 * Orchestrates the execution of development pipelines
 * 
 * @example
 * ```typescript
 * const orchestrator = new Orchestrator(config);
 * const result = await orchestrator.run({
 *   objective: "Build web app",
 *   mode: "auto"
 * });
 * ```
 * 
 * @public
 */
export class Orchestrator {
  /**
   * Executes a pipeline with the given configuration
   * 
   * @param config - Pipeline configuration object
   * @returns Promise resolving to execution result
   * @throws {OrchestratorError} When pipeline fails
   * 
   * @example
   * ```typescript
   * const result = await orchestrator.run({
   *   objective: "Build REST API",
   *   mode: "semi"
   * });
   * ```
   */
  async run(config: PipelineConfig): Promise<PipelineResult> {
    // Implementation
  }
}
```

### README Documentation

Each module should have a README:

```markdown
# Module Name

## Purpose
What this module does and why it exists.

## Installation
How to install/setup this module.

## Usage
Basic usage examples.

## API Reference
Link to detailed API documentation.

## Testing
How to test this module.

## Contributing
Specific contribution guidelines for this module.
```

### Changelog Updates

Update CHANGELOG.md for notable changes:

```markdown
## [Unreleased]

### Added
- New feature X
- Support for Y

### Changed
- Updated Z behavior

### Fixed
- Bug in component A

### Removed
- Deprecated feature B
```

## Community

### Getting Help

- **Discord**: [Join our server](https://discord.gg/mcp-orchestrator)
- **GitHub Discussions**: [Ask questions](https://github.com/mcp-team/mcp-dev-orchestrator/discussions)
- **Stack Overflow**: Tag with `mcp-orchestrator`

### Communication Channels

- **General Discussion**: Discord #general
- **Development**: Discord #development
- **Support**: Discord #support
- **Announcements**: Discord #announcements

### Code Reviews

We appreciate thorough code reviews:

1. **Be Constructive**: Offer suggestions, not just criticism
2. **Be Specific**: Point to exact lines and explain why
3. **Be Respectful**: Remember there's a person behind the code
4. **Be Thorough**: Check logic, style, tests, and documentation

### Recognition

Contributors are recognized in:
- [README.md](README.md) Contributors section
- [CHANGELOG.md](CHANGELOG.md) for significant contributions
- GitHub contributors page
- Annual contributor spotlight (for major contributors)

## Release Process

### Versioning

We use [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Checklist

- [ ] All tests passing
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped in package.json
- [ ] Git tag created
- [ ] GitHub release created
- [ ] NPM package published
- [ ] Announcement posted

## Legal

### License

By contributing, you agree that your contributions will be licensed under the MIT License.

### Developer Certificate of Origin

By contributing, you certify that:

1. The contribution was created by you and you have the right to submit it under the MIT license
2. The contribution is based upon previous work that is covered under an appropriate open source license
3. The contribution was provided directly to you by someone who certified 1 or 2 and you have not modified it
4. You understand and agree that this project and the contribution are public

## Questions?

Feel free to:
- Open an issue for questions
- Ask in Discord
- Email maintainers at contribute@mcp-orchestrator.dev

## Thank You! 🙏

Your contributions make MCP Dev Orchestrator better for everyone. We appreciate your time and effort in improving this project!

---

*Last updated: 2024-01-17*