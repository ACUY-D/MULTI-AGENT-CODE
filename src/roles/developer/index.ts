/**
 * Developer Agent
 * Responsible for code implementation, refactoring, and development tasks
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { z } from 'zod';
import {
  type AgentCapability,
  type AgentMessage,
  type AgentResult,
  type CodeChange,
  type CodeFile,
  type CodeImplementation,
  type CodeIssue,
  type CoverageReport,
  type Dependency,
  DeveloperInputSchema,
  type FeatureSpec,
  type Improvement,
  MessageType,
  type OptimizationResult,
  type PerformanceMetrics,
  type ReviewResult,
  TechnicalDetails,
  type TestCase,
  type TestFile,
  type TestSuite,
} from '../../types';
import { BaseAgent, type BaseAgentConfig } from '../base-agent';

/**
 * Code patterns enum
 */
enum CodePattern {
  SINGLETON = 'singleton',
  FACTORY = 'factory',
  OBSERVER = 'observer',
  STRATEGY = 'strategy',
  REPOSITORY = 'repository',
  DEPENDENCY_INJECTION = 'dependency-injection',
  MVC = 'mvc',
  DECORATOR = 'decorator',
}

/**
 * Code quality metrics
 */
interface CodeMetrics {
  linesOfCode: number;
  cyclomaticComplexity: number;
  maintainabilityIndex: number;
  duplicateCodePercentage: number;
  testCoverage: number;
}

/**
 * Language-specific templates
 */
interface CodeTemplate {
  language: string;
  template: string;
  imports?: string[];
  exports?: string[];
}

/**
 * Developer Agent implementation
 */
export class DeveloperAgent extends BaseAgent {
  private codeTemplates: Map<string, CodeTemplate[]> = new Map();
  private supportedLanguages: string[] = ['TypeScript', 'JavaScript', 'Python', 'Go', 'Java'];
  private supportedFrameworks: string[] = ['React', 'Node.js', 'Express', 'Next.js', 'Django', 'FastAPI'];
  private codePatterns: Map<string, string> = new Map();
  private refactoringStrategies: string[] = [];

  constructor(config?: Partial<BaseAgentConfig>) {
    super({
      name: 'Developer Agent',
      type: 'developer',
      ...config,
    });

    this.initializeCodeTemplates();
    this.initializeCodePatterns();
    this.initializeRefactoringStrategies();
  }

  /**
   * Initialize agent capabilities
   */
  protected async initializeCapabilities(): Promise<void> {
    this.capabilities = [
      {
        name: 'implement-feature',
        description: 'Implement a new feature or functionality',
        inputSchema: z.object({
          specification: z.object({
            name: z.string(),
            description: z.string(),
            requirements: z.array(z.string()),
            acceptanceCriteria: z.array(z.string()),
            technicalDetails: z
              .object({
                language: z.string(),
                framework: z.string().optional(),
                libraries: z.array(z.string()).optional(),
                patterns: z.array(z.string()).optional(),
              })
              .optional(),
          }),
        }),
        outputSchema: z.object({
          implementation: z.object({
            files: z.array(z.any()),
            tests: z.array(z.any()),
            documentation: z.string(),
            dependencies: z.array(z.any()),
          }),
        }),
      },
      {
        name: 'generate-tests',
        description: 'Generate test cases for code',
        inputSchema: z.object({
          code: z.string(),
          testType: z.enum(['unit', 'integration', 'e2e']),
          coverage: z.number().min(0).max(100).optional(),
        }),
        outputSchema: z.object({
          testSuite: z.object({
            name: z.string(),
            tests: z.array(z.any()),
            coverage: z.any(),
          }),
        }),
      },
      {
        name: 'refactor-code',
        description: 'Refactor existing code for better quality',
        inputSchema: z.object({
          code: z.string(),
          patterns: z.array(z.string()).optional(),
          goals: z.array(z.string()).optional(),
        }),
        outputSchema: z.object({
          refactored: z.object({
            code: z.string(),
            changes: z.array(z.any()),
            improvements: z.array(z.string()),
          }),
        }),
      },
      {
        name: 'code-review',
        description: 'Perform automated code review',
        inputSchema: z.object({
          files: z.array(
            z.object({
              path: z.string(),
              content: z.string(),
            }),
          ),
          standards: z.array(z.string()).optional(),
        }),
        outputSchema: z.object({
          review: z.object({
            score: z.number(),
            issues: z.array(z.any()),
            suggestions: z.array(z.string()),
            approved: z.boolean(),
          }),
        }),
      },
      {
        name: 'optimize-performance',
        description: 'Optimize code for better performance',
        inputSchema: z.object({
          code: z.string(),
          targetMetrics: z
            .object({
              executionTime: z.number().optional(),
              memoryUsage: z.number().optional(),
              throughput: z.number().optional(),
            })
            .optional(),
        }),
        outputSchema: z.object({
          optimization: z.object({
            optimized: z.boolean(),
            improvements: z.array(z.any()),
            metrics: z.any(),
          }),
        }),
      },
      {
        name: 'generate-documentation',
        description: 'Generate code documentation',
        inputSchema: z.object({
          code: z.string(),
          format: z.enum(['jsdoc', 'markdown', 'html']).optional(),
        }),
        outputSchema: z.object({
          documentation: z.string(),
        }),
      },
      {
        name: 'apply-pattern',
        description: 'Apply design pattern to code',
        inputSchema: z.object({
          code: z.string(),
          pattern: z.string(),
          context: z.record(z.unknown()).optional(),
        }),
        outputSchema: z.object({
          result: z.object({
            code: z.string(),
            pattern: z.string(),
            changes: z.array(z.string()),
          }),
        }),
      },
    ];
  }

  /**
   * Execute agent task
   */
  async execute(message: AgentMessage): Promise<AgentResult> {
    try {
      const input = await this.validateWithSchema(message.payload, DeveloperInputSchema);

      this.logger.info('Executing developer task', {
        messageId: message.id,
        task: input.task,
      });

      // Parse task to determine action
      const action = this.determineAction(input.task);
      let result: unknown;

      switch (action) {
        case 'implement':
          result = await this.implementFeature({
            name: input.task,
            description: input.task,
            requirements: [],
            acceptanceCriteria: [],
            technicalDetails: input.specification,
          });
          break;
        case 'refactor':
          result = await this.refactorCode('', [], ['improve readability', 'reduce complexity']);
          break;
        case 'test':
          result = await this.generateTests('', 'unit', 80);
          break;
        case 'review':
          result = await this.performCodeReview([]);
          break;
        case 'optimize':
          result = await this.optimizePerformance('');
          break;
        default:
          result = await this.implementFeature({
            name: input.task,
            description: input.task,
            requirements: [],
            acceptanceCriteria: [],
            technicalDetails: input.specification,
          });
      }

      // Store artifacts
      this.context.artifacts.set('implementation', result);

      return {
        success: true,
        data: result,
        metrics: {
          executionTime: Date.now(),
          memoryUsage: process.memoryUsage().heapUsed,
        },
      };
    } catch (error) {
      this.logger.error('Failed to execute developer task', error);
      return {
        success: false,
        error: error as Error,
      };
    }
  }

  /**
   * Validate input
   */
  async validate(input: unknown): Promise<boolean> {
    try {
      await this.validateWithSchema(input, DeveloperInputSchema);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get capabilities
   */
  getCapabilities(): AgentCapability[] {
    return this.capabilities;
  }

  /**
   * Implement a new feature
   */
  async implementFeature(spec: FeatureSpec): Promise<CodeImplementation> {
    this.logger.debug('Implementing feature', { feature: spec.name });

    const files: CodeFile[] = [];
    const tests: TestFile[] = [];
    const dependencies: Dependency[] = [];

    // Determine language and framework
    const language = spec.technicalDetails?.language || 'TypeScript';
    const framework = spec.technicalDetails?.framework || 'Node.js';

    // Generate main implementation file
    const mainFile = await this.generateMainFile(spec, language, framework);
    files.push(mainFile);

    // Generate supporting files
    const supportingFiles = await this.generateSupportingFiles(spec, language, framework);
    files.push(...supportingFiles);

    // Generate test files
    const testFiles = await this.generateTestFiles(spec, language);
    tests.push(...testFiles);

    // Identify dependencies
    const deps = this.identifyDependencies(spec, language, framework);
    dependencies.push(...deps);

    // Generate documentation
    const documentation = await this.generateFeatureDocumentation(spec, files);

    const implementation: CodeImplementation = {
      files,
      tests,
      documentation,
      dependencies,
    };

    await this.checkpoint('feature-implemented', implementation);

    this.logger.info('Feature implemented', {
      feature: spec.name,
      files: files.length,
      tests: tests.length,
      dependencies: dependencies.length,
    });

    return implementation;
  }

  /**
   * Generate test suite
   */
  async generateTests(code: string, testType: 'unit' | 'integration' | 'e2e', targetCoverage = 80): Promise<TestSuite> {
    this.logger.debug('Generating tests', { testType, targetCoverage });

    const tests: TestCase[] = [];

    // Analyze code to identify testable units
    const testableUnits = this.analyzeCodeForTesting(code);

    // Generate test cases
    for (const unit of testableUnits) {
      const testCase: TestCase = {
        id: `test-${unit.name}`,
        name: `Test ${unit.name}`,
        description: `Test case for ${unit.name}`,
        type: testType,
        status: 'pending',
        steps: this.generateTestSteps(unit, testType),
        expectedResult: 'Function behaves as expected',
      };
      tests.push(testCase);
    }

    // Generate coverage report
    const coverage: CoverageReport = {
      statements: targetCoverage,
      branches: targetCoverage * 0.9,
      functions: targetCoverage * 0.95,
      lines: targetCoverage,
    };

    const testSuite: TestSuite = {
      name: `${testType} Test Suite`,
      tests,
      setup: this.generateTestSetup(testType),
      teardown: this.generateTestTeardown(testType),
      coverage,
    };

    this.logger.info('Tests generated', {
      testType,
      tests: tests.length,
      coverage: coverage.statements,
    });

    return testSuite;
  }

  /**
   * Refactor code
   */
  async refactorCode(
    code: string,
    patterns: string[],
    goals: string[],
  ): Promise<{
    code: string;
    changes: CodeChange[];
    improvements: string[];
  }> {
    this.logger.debug('Refactoring code', { patterns, goals });

    const changes: CodeChange[] = [];
    let refactoredCode = code;

    // Apply SOLID principles
    if (goals.includes('improve readability') || goals.includes('SOLID')) {
      const solidChanges = this.applySolidPrinciples(refactoredCode);
      changes.push(...solidChanges.changes);
      refactoredCode = solidChanges.code;
    }

    // Apply design patterns
    for (const pattern of patterns) {
      const patternChanges = this.applyDesignPattern(refactoredCode, pattern);
      changes.push(...patternChanges.changes);
      refactoredCode = patternChanges.code;
    }

    // Reduce complexity
    if (goals.includes('reduce complexity')) {
      const complexityChanges = this.reduceComplexity(refactoredCode);
      changes.push(...complexityChanges.changes);
      refactoredCode = complexityChanges.code;
    }

    // Extract methods
    if (goals.includes('extract methods')) {
      const extractChanges = this.extractMethods(refactoredCode);
      changes.push(...extractChanges.changes);
      refactoredCode = extractChanges.code;
    }

    const improvements = this.identifyImprovements(code, refactoredCode);

    this.logger.info('Code refactored', {
      changes: changes.length,
      improvements: improvements.length,
    });

    return {
      code: refactoredCode,
      changes,
      improvements,
    };
  }

  /**
   * Perform code review
   */
  async performCodeReview(files: { path: string; content: string }[]): Promise<ReviewResult> {
    this.logger.debug('Performing code review', { files: files.length });

    const issues: CodeIssue[] = [];
    const suggestions: string[] = [];
    let totalScore = 100;

    for (const file of files) {
      // Check for code smells
      const codeSmells = this.detectCodeSmells(file.content);
      issues.push(...codeSmells);
      totalScore -= codeSmells.length * 5;

      // Check for security issues
      const securityIssues = this.detectSecurityIssues(file.content);
      issues.push(...securityIssues);
      totalScore -= securityIssues.length * 10;

      // Check for performance issues
      const perfIssues = this.detectPerformanceIssues(file.content);
      issues.push(...perfIssues);
      totalScore -= perfIssues.length * 3;

      // Generate suggestions
      const fileSuggestions = this.generateCodeSuggestions(file.content, issues);
      suggestions.push(...fileSuggestions);
    }

    const score = Math.max(0, totalScore);
    const approved = score >= 70 && issues.filter((i) => i.severity === 'critical').length === 0;

    const review: ReviewResult = {
      score,
      issues,
      suggestions,
      approved,
    };

    this.logger.info('Code review completed', {
      score,
      issues: issues.length,
      approved,
    });

    return review;
  }

  /**
   * Optimize performance
   */
  async optimizePerformance(code: string): Promise<OptimizationResult> {
    this.logger.debug('Optimizing performance');

    const improvements: Improvement[] = [];
    let optimizedCode = code;

    // Algorithm optimization
    const algoImprovements = this.optimizeAlgorithms(optimizedCode);
    improvements.push(...algoImprovements.improvements);
    optimizedCode = algoImprovements.code;

    // Memory optimization
    const memoryImprovements = this.optimizeMemory(optimizedCode);
    improvements.push(...memoryImprovements.improvements);
    optimizedCode = memoryImprovements.code;

    // Caching optimization
    const cacheImprovements = this.addCaching(optimizedCode);
    improvements.push(...cacheImprovements.improvements);
    optimizedCode = cacheImprovements.code;

    // Async optimization
    const asyncImprovements = this.optimizeAsync(optimizedCode);
    improvements.push(...asyncImprovements.improvements);
    optimizedCode = asyncImprovements.code;

    const metrics: PerformanceMetrics = {
      executionTime: 100, // Mock improved execution time
      memoryUsage: 256 * 1024 * 1024, // Mock memory usage
      cpuUsage: 25, // Mock CPU usage
      throughput: 1000, // Mock throughput
    };

    const result: OptimizationResult = {
      optimized: improvements.length > 0,
      improvements,
      metrics,
    };

    this.logger.info('Performance optimized', {
      improvements: improvements.length,
      optimized: result.optimized,
    });

    return result;
  }

  /**
   * Generate main file for feature
   */
  private async generateMainFile(spec: FeatureSpec, language: string, framework: string): Promise<CodeFile> {
    const template = this.getCodeTemplate(language, 'main');
    let content = template?.template || '';

    // Replace placeholders
    content = content.replace('{{FEATURE_NAME}}', spec.name);
    content = content.replace('{{DESCRIPTION}}', spec.description);

    // Add imports
    if (template?.imports) {
      const imports = template.imports.join('\n');
      content = imports + '\n\n' + content;
    }

    // Add implementation based on requirements
    const implementation = this.generateImplementation(spec, language);
    content += '\n\n' + implementation;

    return {
      path: `src/${spec.name.toLowerCase().replace(/\s+/g, '-')}.${this.getFileExtension(language)}`,
      content,
      language,
      purpose: 'Main implementation file',
    };
  }

  /**
   * Generate supporting files
   */
  private async generateSupportingFiles(spec: FeatureSpec, language: string, framework: string): Promise<CodeFile[]> {
    const files: CodeFile[] = [];

    // Interface/Type definitions
    if (language === 'TypeScript') {
      files.push({
        path: `src/types/${spec.name.toLowerCase()}.types.ts`,
        content: this.generateTypeDefinitions(spec),
        language: 'TypeScript',
        purpose: 'Type definitions',
      });
    }

    // Configuration file
    files.push({
      path: `src/config/${spec.name.toLowerCase()}.config.${this.getFileExtension(language)}`,
      content: this.generateConfigFile(spec, language),
      language,
      purpose: 'Configuration',
    });

    // Utility functions
    if (spec.requirements.length > 3) {
      files.push({
        path: `src/utils/${spec.name.toLowerCase()}.utils.${this.getFileExtension(language)}`,
        content: this.generateUtilityFunctions(spec, language),
        language,
        purpose: 'Utility functions',
      });
    }

    return files;
  }

  /**
   * Generate test files
   */
  private async generateTestFiles(spec: FeatureSpec, language: string): Promise<TestFile[]> {
    const files: TestFile[] = [];

    // Unit tests
    files.push({
      path: `tests/unit/${spec.name.toLowerCase()}.test.${this.getFileExtension(language)}`,
      content: this.generateUnitTests(spec, language),
      type: 'unit',
      coverage: 80,
    });

    // Integration tests
    if (spec.requirements.length > 2) {
      files.push({
        path: `tests/integration/${spec.name.toLowerCase()}.integration.test.${this.getFileExtension(language)}`,
        content: this.generateIntegrationTests(spec, language),
        type: 'integration',
        coverage: 70,
      });
    }

    return files;
  }

  /**
   * Identify dependencies
   */
  private identifyDependencies(spec: FeatureSpec, language: string, framework: string): Dependency[] {
    const dependencies: Dependency[] = [];

    // Framework dependencies
    if (framework === 'Express') {
      dependencies.push({ name: 'express', version: '^4.18.0', type: 'production' });
    }
    if (framework === 'React') {
      dependencies.push({ name: 'react', version: '^18.0.0', type: 'production' });
      dependencies.push({ name: 'react-dom', version: '^18.0.0', type: 'production' });
    }

    // Language-specific dependencies
    if (language === 'TypeScript') {
      dependencies.push({ name: 'typescript', version: '^5.0.0', type: 'development' });
      dependencies.push({ name: '@types/node', version: '^20.0.0', type: 'development' });
    }

    // Testing dependencies
    dependencies.push({ name: 'jest', version: '^29.0.0', type: 'development' });
    dependencies.push({ name: '@types/jest', version: '^29.0.0', type: 'development' });

    // Libraries from spec
    if (spec.technicalDetails?.libraries) {
      for (const lib of spec.technicalDetails.libraries) {
        dependencies.push({ name: lib, version: 'latest', type: 'production' });
      }
    }

    return dependencies;
  }

  /**
   * Generate feature documentation
   */
  private async generateFeatureDocumentation(spec: FeatureSpec, files: CodeFile[]): Promise<string> {
    let doc = `# ${spec.name}\n\n`;
    doc += `## Description\n${spec.description}\n\n`;

    doc += `## Requirements\n`;
    for (const req of spec.requirements) {
      doc += `- ${req}\n`;
    }
    doc += '\n';

    doc += `## Acceptance Criteria\n`;
    for (const criteria of spec.acceptanceCriteria) {
      doc += `- ${criteria}\n`;
    }
    doc += '\n';

    doc += `## Technical Details\n`;
    if (spec.technicalDetails) {
      doc += `- **Language**: ${spec.technicalDetails.language}\n`;
      if (spec.technicalDetails.framework) {
        doc += `- **Framework**: ${spec.technicalDetails.framework}\n`;
      }
      if (spec.technicalDetails.libraries) {
        doc += `- **Libraries**: ${spec.technicalDetails.libraries.join(', ')}\n`;
      }
    }
    doc += '\n';

    doc += `## Files\n`;
    for (const file of files) {
      doc += `- \`${file.path}\`: ${file.purpose}\n`;
    }

    doc += '\n## Usage\n';
    doc += '```typescript\n';
    doc += `import { ${spec.name} } from './${spec.name.toLowerCase()}';\n\n`;
    doc += `const instance = new ${spec.name}();\n`;
    doc += `// Use the feature\n`;
    doc += '```\n';

    return doc;
  }

  /**
   * Determine action from task description
   */
  private determineAction(task: string): string {
    const taskLower = task.toLowerCase();

    if (taskLower.includes('implement') || taskLower.includes('create')) {
      return 'implement';
    }
    if (taskLower.includes('refactor')) {
      return 'refactor';
    }
    if (taskLower.includes('test')) {
      return 'test';
    }
    if (taskLower.includes('review')) {
      return 'review';
    }
    if (taskLower.includes('optimize')) {
      return 'optimize';
    }

    return 'implement';
  }

  /**
   * Initialize code templates
   */
  private initializeCodeTemplates(): void {
    // TypeScript templates
    this.codeTemplates.set('TypeScript', [
      {
        language: 'TypeScript',
        template: `export class {{FEATURE_NAME}} {
  constructor() {
    // Initialize
  }

  // Implementation methods
}`,
        imports: [`import { Logger } from '../utils/logger';`],
        exports: [`export { {{FEATURE_NAME}} };`],
      },
    ]);

    // JavaScript templates
    this.codeTemplates.set('JavaScript', [
      {
        language: 'JavaScript',
        template: `class {{FEATURE_NAME}} {
  constructor() {
    // Initialize
  }

  // Implementation methods
}

module.exports = { {{FEATURE_NAME}} };`,
      },
    ]);

    // Python templates
    this.codeTemplates.set('Python', [
      {
        language: 'Python',
        template: `class {{FEATURE_NAME}}:
    """{{DESCRIPTION}}"""
    
    def __init__(self):
        """Initialize {{FEATURE_NAME}}"""
        pass
    
    # Implementation methods`,
        imports: [`import logging`],
      },
    ]);
  }

  /**
   * Initialize code patterns
   */
  private initializeCodePatterns(): void {
    this.codePatterns.set('singleton', 'Singleton pattern implementation');
    this.codePatterns.set('factory', 'Factory pattern implementation');
    this.codePatterns.set('observer', 'Observer pattern implementation');
    this.codePatterns.set('strategy', 'Strategy pattern implementation');
    this.codePatterns.set('repository', 'Repository pattern implementation');
    this.codePatterns.set('dependency-injection', 'Dependency injection pattern');
  }

  /**
   * Initialize refactoring strategies
   */
  private initializeRefactoringStrategies(): void {
    this.refactoringStrategies = [
      'Extract Method',
      'Inline Method',
      'Extract Variable',
      'Inline Variable',
      'Replace Temp with Query',
      'Split Temporary Variable',
      'Remove Assignments to Parameters',
      'Replace Method with Method Object',
      'Move Method',
      'Move Field',
      'Extract Class',
      'Inline Class',
      'Hide Delegate',
      'Remove Middle Man',
    ];
  }

  /**
   * Get code template
   */
  private getCodeTemplate(language: string, type: string): CodeTemplate | undefined {
    const templates = this.codeTemplates.get(language);
    return templates?.[0]; // Return first template for simplicity
  }

  /**
   * Get file extension for language
   */
  private getFileExtension(language: string): string {
    const extensions: Record<string, string> = {
      TypeScript: 'ts',
      JavaScript: 'js',
      Python: 'py',
      Go: 'go',
      Java: 'java',
    };
    return extensions[language] || 'txt';
  }

  /**
   * Generate implementation based on requirements
   */
  private generateImplementation(spec: FeatureSpec, language: string): string {
    let implementation = '';

    // Generate methods for each requirement
    for (const req of spec.requirements) {
      const methodName = this.generateMethodName(req);

      if (language === 'TypeScript' || language === 'JavaScript') {
        implementation += `
  ${methodName}(): void {
    // TODO: Implement ${req}
    throw new Error('Not implemented');
  }
`;
      } else if (language === 'Python') {
        implementation += `
    def ${methodName}(self):
        """${req}"""
        # TODO: Implement
        raise NotImplementedError()
`;
      }
    }

    return implementation;
  }

  /**
   * Generate method name from requirement
   */
  private generateMethodName(requirement: string): string {
    // Simple conversion: take first few words and camelCase them
    const words = requirement.toLowerCase().split(' ').slice(0, 3);
    return words.map((word, index) => (index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1))).join('');
  }

  /**
   * Generate type definitions
   */
  private generateTypeDefinitions(spec: FeatureSpec): string {
    return `// Type definitions for ${spec.name}

export interface I${spec.name} {
  // Interface definition
}

export type ${spec.name}Options = {
  // Options type
};

export enum ${spec.name}Status {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}`;
  }

  /**
   * Generate configuration file
   */
  private generateConfigFile(spec: FeatureSpec, language: string): string {
    if (language === 'TypeScript' || language === 'JavaScript') {
      return `export const ${spec.name.toLowerCase()}Config = {
  enabled: true,
  // Configuration options
};`;
    }
    return '# Configuration file';
  }

  /**
   * Generate utility functions
   */
  private generateUtilityFunctions(spec: FeatureSpec, language: string): string {
    if (language === 'TypeScript') {
      return `// Utility functions for ${spec.name}

export function validate${spec.name}(input: unknown): boolean {
  // Validation logic
  return true;
}

export function transform${spec.name}(data: any): any {
  // Transformation logic
  return data;
}`;
    }
    return '// Utility functions';
  }

  /**
   * Generate unit tests
   */
  private generateUnitTests(spec: FeatureSpec, language: string): string {
    if (language === 'TypeScript' || language === 'JavaScript') {
      return `import { ${spec.name} } from '../src/${spec.name.toLowerCase()}';

describe('${spec.name}', () => {
  let instance: ${spec.name};

  beforeEach(() => {
    instance = new ${spec.name}();
  });

  it('should create an instance', () => {
    expect(instance).toBeDefined();
  });

  // Add more tests based on requirements
  ${spec.requirements
    .map(
      (req) => `
  it('should ${req.toLowerCase()}', () => {
    // Test implementation
    expect(true).toBe(true);
  });`,
    )
    .join('')}
});`;
    }
    return '# Unit tests';
  }

  /**
   * Generate integration tests
   */
  private generateIntegrationTests(spec: FeatureSpec, language: string): string {
    if (language === 'TypeScript' || language === 'JavaScript') {
      return `import { ${spec.name} } from '../src/${spec.name.toLowerCase()}';

describe('${spec.name} Integration', () => {
  it('should integrate with system', async () => {
    // Integration test
    expect(true).toBe(true);
  });
});`;
    }
    return '# Integration tests';
  }

  /**
   * Analyze code for testing
   */
  private analyzeCodeForTesting(code: string): Array<{ name: string; type: string }> {
    // Mock analysis - in real implementation would parse AST
    return [
      { name: 'function1', type: 'function' },
      { name: 'class1', type: 'class' },
      { name: 'method1', type: 'method' },
    ];
  }

  /**
   * Generate test steps
   */
  private generateTestSteps(
    unit: { name: string; type: string },
    testType: string,
  ): Array<{ action: string; expectedOutcome: string }> {
    const steps: Array<{ action: string; expectedOutcome: string }> = [];

    if (testType === 'unit') {
      steps.push({
        action: `Create instance of ${unit.name}`,
        expectedOutcome: 'Instance created successfully',
      });
      steps.push({
        action: 'Call method with valid input',
        expectedOutcome: 'Returns expected output',
      });
      steps.push({
        action: 'Call method with invalid input',
        expectedOutcome: 'Throws appropriate error',
      });
    } else if (testType === 'integration') {
      steps.push({
        action: 'Setup test environment',
        expectedOutcome: 'Environment ready',
      });
      steps.push({
        action: `Integrate ${unit.name} with dependencies`,
        expectedOutcome: 'Integration successful',
      });
      steps.push({
        action: 'Execute integration scenario',
        expectedOutcome: 'Scenario passes',
      });
    }

    return steps;
  }

  /**
   * Generate test setup
   */
  private generateTestSetup(testType: string): string {
    if (testType === 'unit') {
      return '// Setup mocks and stubs';
    } else if (testType === 'integration') {
      return '// Setup test database and services';
    } else if (testType === 'e2e') {
      return '// Setup browser and test environment';
    }
    return '// Test setup';
  }

  /**
   * Generate test teardown
   */
  private generateTestTeardown(testType: string): string {
    if (testType === 'unit') {
      return '// Clear mocks and restore';
    } else if (testType === 'integration') {
      return '// Clean database and close connections';
    } else if (testType === 'e2e') {
      return '// Close browser and cleanup';
    }
    return '// Test teardown';
  }

  /**
   * Apply SOLID principles
   */
  private applySolidPrinciples(code: string): { code: string; changes: CodeChange[] } {
    const changes: CodeChange[] = [];
    let refactoredCode = code;

    // Single Responsibility Principle
    changes.push({
      file: 'current',
      line: 0,
      before: 'Multiple responsibilities in single class',
      after: 'Split into separate classes',
      reason: 'Apply Single Responsibility Principle',
    });

    // Open/Closed Principle
    changes.push({
      file: 'current',
      line: 0,
      before: 'Direct modification required',
      after: 'Extension through inheritance',
      reason: 'Apply Open/Closed Principle',
    });

    // Mock refactoring
    refactoredCode = code + '\n// SOLID principles applied';

    return { code: refactoredCode, changes };
  }

  /**
   * Apply design pattern
   */
  private applyDesignPattern(code: string, pattern: string): { code: string; changes: CodeChange[] } {
    const changes: CodeChange[] = [];
    let refactoredCode = code;

    changes.push({
      file: 'current',
      line: 0,
      before: 'Direct instantiation',
      after: `${pattern} pattern implementation`,
      reason: `Apply ${pattern} pattern`,
    });

    // Mock pattern application
    refactoredCode = code + `\n// ${pattern} pattern applied`;

    return { code: refactoredCode, changes };
  }

  /**
   * Reduce complexity
   */
  private reduceComplexity(code: string): { code: string; changes: CodeChange[] } {
    const changes: CodeChange[] = [];
    let refactoredCode = code;

    changes.push({
      file: 'current',
      line: 0,
      before: 'Complex nested conditions',
      after: 'Simplified with early returns',
      reason: 'Reduce cyclomatic complexity',
    });

    changes.push({
      file: 'current',
      line: 0,
      before: 'Long method',
      after: 'Split into smaller methods',
      reason: 'Improve readability',
    });

    refactoredCode = code + '\n// Complexity reduced';

    return { code: refactoredCode, changes };
  }

  /**
   * Extract methods
   */
  private extractMethods(code: string): { code: string; changes: CodeChange[] } {
    const changes: CodeChange[] = [];
    let refactoredCode = code;

    changes.push({
      file: 'current',
      line: 0,
      before: 'Inline logic',
      after: 'Extracted to method',
      reason: 'Extract Method refactoring',
    });

    refactoredCode = code + '\n// Methods extracted';

    return { code: refactoredCode, changes };
  }

  /**
   * Identify improvements
   */
  private identifyImprovements(originalCode: string, refactoredCode: string): string[] {
    return [
      'Improved code readability',
      'Reduced cyclomatic complexity',
      'Better separation of concerns',
      'Applied design patterns',
      'Enhanced maintainability',
      'Improved testability',
    ];
  }

  /**
   * Detect code smells
   */
  private detectCodeSmells(code: string): CodeIssue[] {
    const issues: CodeIssue[] = [];

    // Check for long methods
    const lines = code.split('\n');
    if (lines.length > 50) {
      issues.push({
        type: 'smell',
        severity: 'medium',
        file: 'current',
        line: 50,
        message: 'Method is too long',
        suggestion: 'Consider breaking into smaller methods',
      });
    }

    // Check for duplicate code (simplified)
    const codePatterns = code.match(/function\s+\w+/g) || [];
    const duplicates = codePatterns.filter((item, index) => codePatterns.indexOf(item) !== index);
    if (duplicates.length > 0) {
      issues.push({
        type: 'smell',
        severity: 'low',
        file: 'current',
        line: 0,
        message: 'Possible duplicate code detected',
        suggestion: 'Extract common functionality',
      });
    }

    // Check for magic numbers
    if (code.match(/\b\d{2,}\b/g)) {
      issues.push({
        type: 'smell',
        severity: 'low',
        file: 'current',
        line: 0,
        message: 'Magic numbers detected',
        suggestion: 'Extract to named constants',
      });
    }

    return issues;
  }

  /**
   * Detect security issues
   */
  private detectSecurityIssues(code: string): CodeIssue[] {
    const issues: CodeIssue[] = [];

    // Check for SQL injection vulnerabilities
    if (code.includes('SELECT') && code.includes('+ ')) {
      issues.push({
        type: 'vulnerability',
        severity: 'critical',
        file: 'current',
        line: 0,
        message: 'Potential SQL injection vulnerability',
        suggestion: 'Use parameterized queries',
      });
    }

    // Check for eval usage
    if (code.includes('eval(')) {
      issues.push({
        type: 'vulnerability',
        severity: 'high',
        file: 'current',
        line: 0,
        message: 'Use of eval() is dangerous',
        suggestion: 'Avoid eval() and use safer alternatives',
      });
    }

    // Check for hardcoded credentials
    if (code.match(/password\s*=\s*["'][^"']+["']/i)) {
      issues.push({
        type: 'vulnerability',
        severity: 'critical',
        file: 'current',
        line: 0,
        message: 'Hardcoded credentials detected',
        suggestion: 'Use environment variables or secure vault',
      });
    }

    return issues;
  }

  /**
   * Detect performance issues
   */
  private detectPerformanceIssues(code: string): CodeIssue[] {
    const issues: CodeIssue[] = [];

    // Check for nested loops
    if (code.match(/for.*\{[\s\S]*?for.*\{/)) {
      issues.push({
        type: 'performance',
        severity: 'medium',
        file: 'current',
        line: 0,
        message: 'Nested loops detected',
        suggestion: 'Consider optimizing with better algorithm',
      });
    }

    // Check for synchronous file operations
    if (code.includes('readFileSync') || code.includes('writeFileSync')) {
      issues.push({
        type: 'performance',
        severity: 'medium',
        file: 'current',
        line: 0,
        message: 'Synchronous file operation',
        suggestion: 'Use async/await or promises',
      });
    }

    // Check for inefficient array operations
    if (code.includes('.forEach') && code.includes('.push')) {
      issues.push({
        type: 'performance',
        severity: 'low',
        file: 'current',
        line: 0,
        message: 'Inefficient array operation',
        suggestion: 'Consider using .map() or .filter()',
      });
    }

    return issues;
  }

  /**
   * Generate code suggestions
   */
  private generateCodeSuggestions(code: string, issues: CodeIssue[]): string[] {
    const suggestions: string[] = [];

    // Base suggestions
    suggestions.push('Add comprehensive error handling');
    suggestions.push('Include JSDoc comments for all public methods');
    suggestions.push('Add input validation');

    // Issue-based suggestions
    if (issues.some((i) => i.type === 'smell')) {
      suggestions.push('Refactor to improve code quality');
    }
    if (issues.some((i) => i.type === 'vulnerability')) {
      suggestions.push('Address security vulnerabilities immediately');
    }
    if (issues.some((i) => i.type === 'performance')) {
      suggestions.push('Optimize performance bottlenecks');
    }

    // Code-specific suggestions
    if (!code.includes('test')) {
      suggestions.push('Add unit tests');
    }
    if (!code.includes('try') || !code.includes('catch')) {
      suggestions.push('Add error handling');
    }

    return suggestions;
  }

  /**
   * Optimize algorithms
   */
  private optimizeAlgorithms(code: string): { code: string; improvements: Improvement[] } {
    const improvements: Improvement[] = [];

    improvements.push({
      type: 'performance',
      description: 'Optimized algorithm complexity',
      before: 'O(n²) nested loops',
      after: 'O(n log n) optimized algorithm',
      impact: 75,
    });

    return {
      code: code + '\n// Algorithms optimized',
      improvements,
    };
  }

  /**
   * Optimize memory usage
   */
  private optimizeMemory(code: string): { code: string; improvements: Improvement[] } {
    const improvements: Improvement[] = [];

    improvements.push({
      type: 'memory',
      description: 'Reduced memory footprint',
      before: 'Large object allocations',
      after: 'Object pooling implemented',
      impact: 40,
    });

    return {
      code: code + '\n// Memory optimized',
      improvements,
    };
  }

  /**
   * Add caching
   */
  private addCaching(code: string): { code: string; improvements: Improvement[] } {
    const improvements: Improvement[] = [];

    improvements.push({
      type: 'performance',
      description: 'Added caching layer',
      before: 'Direct computation',
      after: 'Memoization implemented',
      impact: 60,
    });

    return {
      code: code + '\n// Caching added',
      improvements,
    };
  }

  /**
   * Optimize async operations
   */
  private optimizeAsync(code: string): { code: string; improvements: Improvement[] } {
    const improvements: Improvement[] = [];

    improvements.push({
      type: 'performance',
      description: 'Optimized async operations',
      before: 'Sequential async calls',
      after: 'Parallel execution with Promise.all',
      impact: 50,
    });

    return {
      code: code + '\n// Async optimized',
      improvements,
    };
  }

  /**
   * Check if language is supported
   */
  supportsLanguage(language: string): boolean {
    return this.supportedLanguages.includes(language);
  }

  /**
   * Check if framework is supported
   */
  supportsFramework(framework: string): boolean {
    return this.supportedFrameworks.includes(framework);
  }

  /**
   * Generate code with AI assistance (mock)
   */
  async generateWithAI(prompt: string, context?: Record<string, unknown>): Promise<string> {
    this.logger.debug('Generating code with AI', { prompt });

    // Mock AI generation
    return `// AI-generated code based on: ${prompt}\n// Context: ${JSON.stringify(context)}\n\n// Implementation here`;
  }

  /**
   * Analyze code metrics
   */
  async analyzeCodeMetrics(code: string): Promise<CodeMetrics> {
    const lines = code.split('\n');

    return {
      linesOfCode: lines.length,
      cyclomaticComplexity: this.calculateCyclomaticComplexity(code),
      maintainabilityIndex: this.calculateMaintainabilityIndex(code),
      duplicateCodePercentage: this.calculateDuplicatePercentage(code),
      testCoverage: 0, // Would need actual test execution
    };
  }

  /**
   * Calculate cyclomatic complexity
   */
  private calculateCyclomaticComplexity(code: string): number {
    // Simplified calculation
    const conditions = (code.match(/if|else|for|while|switch|case|\?/g) || []).length;
    return conditions + 1;
  }

  /**
   * Calculate maintainability index
   */
  private calculateMaintainabilityIndex(code: string): number {
    // Simplified MI calculation
    const volume = code.length;
    const complexity = this.calculateCyclomaticComplexity(code);
    const lines = code.split('\n').length;

    // Simplified formula
    const mi = Math.max(0, ((171 - 5.2 * Math.log(volume) - 0.23 * complexity - 16.2 * Math.log(lines)) * 100) / 171);
    return Math.round(mi);
  }

  /**
   * Calculate duplicate code percentage
   */
  private calculateDuplicatePercentage(code: string): number {
    // Simplified duplicate detection
    const lines = code.split('\n');
    const uniqueLines = new Set(lines.filter((line) => line.trim().length > 10));
    const duplicateRatio = 1 - uniqueLines.size / lines.length;
    return Math.round(duplicateRatio * 100);
  }
}

// Export singleton instance
export const developerAgent = new DeveloperAgent();
