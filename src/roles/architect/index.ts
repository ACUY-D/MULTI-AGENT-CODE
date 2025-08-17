/**
 * Architect Agent
 * Responsible for system design, architecture decisions, and technical planning
 */

import { z } from 'zod';
import {
  type ADRDocument,
  type AgentCapability,
  type AgentMessage,
  type AgentResult,
  ArchitectInputSchema,
  type ArchitecturalDecision,
  type Architecture,
  type ComponentDesign,
  type Diagram,
  MessageType,
  type Milestone,
  type Mitigation,
  type Requirements,
  type Risk,
  type RiskAssessment,
  type WBSPhase,
  WBSTask,
  type WorkBreakdownStructure,
} from '../../types';
import { BaseAgent, type BaseAgentConfig } from '../base-agent';

/**
 * Architecture patterns enum
 */
enum ArchitecturePattern {
  MICROSERVICES = 'microservices',
  MONOLITHIC = 'monolithic',
  SERVERLESS = 'serverless',
  EVENT_DRIVEN = 'event-driven',
  LAYERED = 'layered',
  MVC = 'mvc',
  CQRS = 'cqrs',
  HEXAGONAL = 'hexagonal',
}

/**
 * Technology stack categories
 */
interface TechnologyStack {
  frontend?: string[];
  backend?: string[];
  database?: string[];
  infrastructure?: string[];
  tools?: string[];
}

/**
 * Architect Agent implementation
 */
export class ArchitectAgent extends BaseAgent {
  private adrCounter = 1;
  private designPatterns: Map<string, string> = new Map();
  private technologyStacks: Map<string, TechnologyStack> = new Map();
  private riskRegistry: Risk[] = [];

  constructor(config?: Partial<BaseAgentConfig>) {
    super({
      name: 'Architect Agent',
      type: 'architect',
      ...config,
    });

    this.initializeDesignPatterns();
    this.initializeTechnologyStacks();
  }

  /**
   * Initialize agent capabilities
   */
  protected async initializeCapabilities(): Promise<void> {
    this.capabilities = [
      {
        name: 'analyze-requirements',
        description: 'Analyze and structure project requirements',
        inputSchema: z.object({
          objective: z.string(),
          constraints: z.array(z.string()).optional(),
          stakeholders: z.array(z.string()).optional(),
        }),
        outputSchema: z.object({
          requirements: z.object({
            functional: z.array(z.string()),
            nonFunctional: z.array(z.string()),
            constraints: z.array(z.string()),
            assumptions: z.array(z.string()),
            dependencies: z.array(z.string()),
          }),
        }),
      },
      {
        name: 'design-architecture',
        description: 'Design system architecture',
        inputSchema: z.object({
          requirements: z.object({
            functional: z.array(z.string()),
            nonFunctional: z.array(z.string()),
          }),
          preferences: z
            .object({
              pattern: z.string().optional(),
              stack: z.string().optional(),
            })
            .optional(),
        }),
        outputSchema: z.object({
          architecture: z.object({
            components: z.array(z.any()),
            patterns: z.array(z.string()),
            technologies: z.array(z.string()),
            diagrams: z.array(z.any()),
            decisions: z.array(z.any()),
          }),
        }),
      },
      {
        name: 'generate-adr',
        description: 'Generate Architecture Decision Record',
        inputSchema: z.object({
          title: z.string(),
          context: z.string(),
          decision: z.string(),
          consequences: z.array(z.string()),
          alternatives: z.array(z.string()).optional(),
        }),
        outputSchema: z.object({
          adr: z.object({
            number: z.number(),
            title: z.string(),
            date: z.date(),
            status: z.string(),
            content: z.string(),
          }),
        }),
      },
      {
        name: 'create-wbs',
        description: 'Create Work Breakdown Structure',
        inputSchema: z.object({
          architecture: z.any(),
          timeline: z
            .object({
              startDate: z.string(),
              endDate: z.string(),
            })
            .optional(),
        }),
        outputSchema: z.object({
          wbs: z.object({
            phases: z.array(z.any()),
            milestones: z.array(z.any()),
            totalEstimate: z.number(),
          }),
        }),
      },
      {
        name: 'assess-risks',
        description: 'Assess project risks',
        inputSchema: z.object({
          architecture: z.any(),
          context: z.record(z.unknown()).optional(),
        }),
        outputSchema: z.object({
          assessment: z.object({
            risks: z.array(z.any()),
            mitigations: z.array(z.any()),
            overallRisk: z.enum(['low', 'medium', 'high', 'critical']),
          }),
        }),
      },
      {
        name: 'create-diagram',
        description: 'Create architecture diagram',
        inputSchema: z.object({
          type: z.enum(['component', 'sequence', 'class', 'deployment']),
          components: z.array(z.string()),
          relationships: z
            .array(
              z.object({
                from: z.string(),
                to: z.string(),
                type: z.string(),
              }),
            )
            .optional(),
        }),
        outputSchema: z.object({
          diagram: z.object({
            type: z.string(),
            format: z.string(),
            content: z.string(),
            title: z.string(),
          }),
        }),
      },
      {
        name: 'estimate-effort',
        description: 'Estimate development effort',
        inputSchema: z.object({
          components: z.array(z.any()),
          complexity: z.enum(['low', 'medium', 'high']),
          teamSize: z.number().optional(),
        }),
        outputSchema: z.object({
          estimate: z.object({
            totalHours: z.number(),
            breakdown: z.record(z.number()),
            confidence: z.number(),
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
      const input = await this.validateWithSchema(message.payload, ArchitectInputSchema);

      this.logger.info('Executing architect task', {
        messageId: message.id,
        objective: input.objective,
      });

      // Analyze requirements
      const requirements = await this.analyzeRequirements(input.objective);
      await this.checkpoint('requirements-analyzed', requirements);

      // Design architecture
      const architecture = await this.designArchitecture(requirements);
      await this.checkpoint('architecture-designed', architecture);

      // Create WBS
      const wbs = await this.createWBS(architecture);
      await this.checkpoint('wbs-created', wbs);

      // Assess risks
      const riskAssessment = await this.assessRisks(architecture);
      await this.checkpoint('risks-assessed', riskAssessment);

      // Generate documentation
      const documentation = await this.generateDocumentation(requirements, architecture, wbs, riskAssessment);

      // Store artifacts
      this.context.artifacts.set('requirements', requirements);
      this.context.artifacts.set('architecture', architecture);
      this.context.artifacts.set('wbs', wbs);
      this.context.artifacts.set('risks', riskAssessment);
      this.context.artifacts.set('documentation', documentation);

      return {
        success: true,
        data: {
          requirements,
          architecture,
          wbs,
          riskAssessment,
          documentation,
        },
        metrics: {
          executionTime: Date.now(),
          memoryUsage: process.memoryUsage().heapUsed,
          customMetrics: {
            componentsDesigned: architecture.components.length,
            risksIdentified: riskAssessment.risks.length,
            estimatedHours: wbs.totalEstimate,
          },
        },
      };
    } catch (error) {
      this.logger.error('Failed to execute architect task', error);
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
      await this.validateWithSchema(input, ArchitectInputSchema);
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
   * Analyze requirements
   */
  private async analyzeRequirements(objective: string): Promise<Requirements> {
    this.logger.debug('Analyzing requirements', { objective });

    // Parse objective to extract requirements
    const requirements: Requirements = {
      functional: [],
      nonFunctional: [],
      constraints: [],
      assumptions: [],
      dependencies: [],
    };

    // Extract functional requirements from objective
    requirements.functional = this.extractFunctionalRequirements(objective);

    // Identify non-functional requirements
    requirements.nonFunctional = this.identifyNonFunctionalRequirements(objective);

    // Identify constraints
    requirements.constraints = this.identifyConstraints(objective);

    // Make assumptions
    requirements.assumptions = this.makeAssumptions(objective);

    // Identify dependencies
    requirements.dependencies = this.identifyDependencies(objective);

    this.logger.info('Requirements analyzed', {
      functional: requirements.functional.length,
      nonFunctional: requirements.nonFunctional.length,
    });

    return requirements;
  }

  /**
   * Design architecture
   */
  private async designArchitecture(requirements: Requirements): Promise<Architecture> {
    this.logger.debug('Designing architecture');

    // Select architecture pattern
    const pattern = this.selectArchitecturePattern(requirements);

    // Design components
    const components = await this.designComponents(requirements, pattern);

    // Select technologies
    const technologies = this.selectTechnologies(requirements, pattern);

    // Create architecture diagrams
    const diagrams = await this.createArchitectureDiagrams(components);

    // Make architecture decisions
    const decisions = await this.makeArchitectureDecisions(requirements, pattern, technologies);

    const architecture: Architecture = {
      components,
      patterns: [pattern],
      technologies,
      diagrams,
      decisions,
    };

    this.logger.info('Architecture designed', {
      components: components.length,
      pattern,
      technologies: technologies.length,
    });

    return architecture;
  }

  /**
   * Create Work Breakdown Structure
   */
  private async createWBS(architecture: Architecture): Promise<WorkBreakdownStructure> {
    this.logger.debug('Creating WBS');

    const phases: WBSPhase[] = [];
    let totalEstimate = 0;

    // Phase 1: Setup and Planning
    const setupPhase: WBSPhase = {
      name: 'Setup and Planning',
      tasks: [
        {
          id: 'setup-1',
          name: 'Environment Setup',
          description: 'Set up development environment and tools',
          assignee: 'developer',
          estimate: 8,
          priority: 'high',
        },
        {
          id: 'setup-2',
          name: 'Project Scaffolding',
          description: 'Create project structure and configuration',
          assignee: 'developer',
          estimate: 4,
          priority: 'high',
        },
      ],
      duration: 12,
      dependencies: [],
    };
    phases.push(setupPhase);
    totalEstimate += setupPhase.duration;

    // Phase 2: Implementation phases for each component
    for (const component of architecture.components) {
      const componentPhase: WBSPhase = {
        name: `Implement ${component.name}`,
        tasks: [
          {
            id: `impl-${component.name}-1`,
            name: `Design ${component.name} API`,
            description: `Design interfaces for ${component.name}`,
            assignee: 'architect',
            estimate: 4,
            priority: 'high',
          },
          {
            id: `impl-${component.name}-2`,
            name: `Implement ${component.name}`,
            description: `Implement core functionality`,
            assignee: 'developer',
            estimate: this.estimateComponentEffort(component),
            priority: 'high',
          },
          {
            id: `impl-${component.name}-3`,
            name: `Test ${component.name}`,
            description: `Write and execute tests`,
            assignee: 'tester',
            estimate: Math.ceil(this.estimateComponentEffort(component) * 0.3),
            priority: 'medium',
          },
        ],
        duration: 0,
        dependencies: ['setup-2'],
      };

      componentPhase.duration = componentPhase.tasks.reduce((sum, task) => sum + task.estimate, 0);

      phases.push(componentPhase);
      totalEstimate += componentPhase.duration;
    }

    // Phase 3: Integration and Testing
    const integrationPhase: WBSPhase = {
      name: 'Integration and Testing',
      tasks: [
        {
          id: 'int-1',
          name: 'System Integration',
          description: 'Integrate all components',
          assignee: 'developer',
          estimate: 16,
          priority: 'high',
        },
        {
          id: 'int-2',
          name: 'E2E Testing',
          description: 'End-to-end testing',
          assignee: 'tester',
          estimate: 24,
          priority: 'high',
        },
        {
          id: 'int-3',
          name: 'Performance Testing',
          description: 'Performance and load testing',
          assignee: 'tester',
          estimate: 16,
          priority: 'medium',
        },
      ],
      duration: 56,
      dependencies: architecture.components.map((c) => `impl-${c.name}-3`),
    };
    phases.push(integrationPhase);
    totalEstimate += integrationPhase.duration;

    // Create milestones
    const milestones: Milestone[] = [
      {
        name: 'Project Kickoff',
        date: new Date(),
        deliverables: ['Project plan', 'Architecture document'],
        criteria: ['All stakeholders aligned', 'Resources allocated'],
      },
      {
        name: 'Alpha Release',
        date: new Date(Date.now() + totalEstimate * 0.6 * 3600000),
        deliverables: ['Core features', 'Basic UI'],
        criteria: ['Core functionality working', 'Basic tests passing'],
      },
      {
        name: 'Beta Release',
        date: new Date(Date.now() + totalEstimate * 0.85 * 3600000),
        deliverables: ['All features', 'Documentation'],
        criteria: ['All tests passing', 'Performance targets met'],
      },
      {
        name: 'Production Release',
        date: new Date(Date.now() + totalEstimate * 3600000),
        deliverables: ['Production-ready system', 'Deployment guides'],
        criteria: ['Security review passed', 'All acceptance criteria met'],
      },
    ];

    const wbs: WorkBreakdownStructure = {
      phases,
      milestones,
      totalEstimate,
    };

    this.logger.info('WBS created', {
      phases: phases.length,
      totalEstimate,
      milestones: milestones.length,
    });

    return wbs;
  }

  /**
   * Assess risks
   */
  private async assessRisks(architecture: Architecture): Promise<RiskAssessment> {
    this.logger.debug('Assessing risks');

    const risks: Risk[] = [];
    const mitigations: Mitigation[] = [];

    // Technical risks
    if (architecture.technologies.length > 5) {
      const risk: Risk = {
        id: 'risk-tech-1',
        category: 'technical',
        description: 'Technology stack complexity may increase learning curve',
        probability: 0.7,
        impact: 0.6,
        severity: 0.7 * 0.6,
      };
      risks.push(risk);

      mitigations.push({
        riskId: risk.id,
        strategy: 'Provide team training and documentation',
        actions: ['Create technology guides', 'Conduct training sessions', 'Pair programming for knowledge transfer'],
        owner: 'Tech Lead',
      });
    }

    // Integration risks
    if (architecture.components.length > 3) {
      const risk: Risk = {
        id: 'risk-int-1',
        category: 'technical',
        description: 'Complex integration between multiple components',
        probability: 0.6,
        impact: 0.8,
        severity: 0.6 * 0.8,
      };
      risks.push(risk);

      mitigations.push({
        riskId: risk.id,
        strategy: 'Implement integration testing early',
        actions: ['Define clear interfaces', 'Create integration test suite', 'Use contract testing'],
        owner: 'Architect',
      });
    }

    // Security risks
    const risk: Risk = {
      id: 'risk-sec-1',
      category: 'security',
      description: 'Potential security vulnerabilities in external dependencies',
      probability: 0.5,
      impact: 0.9,
      severity: 0.5 * 0.9,
    };
    risks.push(risk);

    mitigations.push({
      riskId: risk.id,
      strategy: 'Implement security best practices',
      actions: ['Regular dependency updates', 'Security scanning in CI/CD', 'Code security reviews'],
      owner: 'Security Team',
    });

    // Calculate overall risk
    const averageSeverity = risks.reduce((sum, r) => sum + r.severity, 0) / risks.length;
    let overallRisk: 'low' | 'medium' | 'high' | 'critical';

    if (averageSeverity < 0.3) {
      overallRisk = 'low';
    } else if (averageSeverity < 0.5) {
      overallRisk = 'medium';
    } else if (averageSeverity < 0.7) {
      overallRisk = 'high';
    } else {
      overallRisk = 'critical';
    }

    // Store in risk registry
    this.riskRegistry.push(...risks);

    const assessment: RiskAssessment = {
      risks,
      mitigations,
      overallRisk,
    };

    this.logger.info('Risks assessed', {
      risksIdentified: risks.length,
      mitigations: mitigations.length,
      overallRisk,
    });

    return assessment;
  }

  /**
   * Generate ADR
   */
  async generateADR(decision: ArchitecturalDecision): Promise<ADRDocument> {
    const adr: ADRDocument = {
      number: this.adrCounter++,
      title: decision.title,
      date: new Date(),
      status: decision.status,
      content: this.formatADR(decision),
    };

    this.logger.info('ADR generated', {
      number: adr.number,
      title: adr.title,
    });

    return adr;
  }

  /**
   * Format ADR content
   */
  private formatADR(decision: ArchitecturalDecision): string {
    let content = `# ADR-${this.adrCounter}: ${decision.title}\n\n`;
    content += `## Status\n${decision.status}\n\n`;
    content += `## Context\n${decision.context}\n\n`;
    content += `## Decision\n${decision.decision}\n\n`;
    content += `## Consequences\n`;

    for (const consequence of decision.consequences) {
      content += `- ${consequence}\n`;
    }

    if (decision.alternatives && decision.alternatives.length > 0) {
      content += `\n## Alternatives Considered\n`;
      for (const alternative of decision.alternatives) {
        content += `- ${alternative}\n`;
      }
    }

    return content;
  }

  /**
   * Extract functional requirements
   */
  private extractFunctionalRequirements(objective: string): string[] {
    const requirements: string[] = [];

    // Basic parsing logic - in real implementation would use NLP
    const keywords = ['create', 'implement', 'build', 'develop', 'design', 'add', 'integrate'];
    const sentences = objective.split(/[.!?]+/);

    for (const sentence of sentences) {
      if (keywords.some((keyword) => sentence.toLowerCase().includes(keyword))) {
        requirements.push(sentence.trim());
      }
    }

    // Add default requirements if none found
    if (requirements.length === 0) {
      requirements.push('Implement core functionality as described');
      requirements.push('Provide user interface for interaction');
      requirements.push('Ensure data persistence');
    }

    return requirements;
  }

  /**
   * Identify non-functional requirements
   */
  private identifyNonFunctionalRequirements(objective: string): string[] {
    const requirements: string[] = [
      'System should respond within 2 seconds',
      'Support concurrent users',
      'Maintain 99.9% uptime',
      'Ensure data security and privacy',
      'Provide comprehensive logging',
    ];

    // Check for specific NFR keywords
    if (objective.toLowerCase().includes('performance')) {
      requirements.push('Optimize for high performance');
    }
    if (objective.toLowerCase().includes('scale')) {
      requirements.push('Design for horizontal scalability');
    }
    if (objective.toLowerCase().includes('secure')) {
      requirements.push('Implement security best practices');
    }

    return requirements;
  }

  /**
   * Identify constraints
   */
  private identifyConstraints(objective: string): string[] {
    const constraints: string[] = [];

    // Check for technology constraints
    if (objective.includes('TypeScript')) {
      constraints.push('Must use TypeScript');
    }
    if (objective.includes('cloud')) {
      constraints.push('Must be cloud-native');
    }

    // Add default constraints
    constraints.push('Follow coding standards');
    constraints.push('Maintain backward compatibility');

    return constraints;
  }

  /**
   * Make assumptions
   */
  private makeAssumptions(objective: string): string[] {
    return [
      'Development team has necessary skills',
      'Infrastructure resources are available',
      'Third-party services are reliable',
      'Requirements are stable',
    ];
  }

  /**
   * Identify dependencies
   */
  private identifyDependencies(objective: string): string[] {
    const dependencies: string[] = [];

    // Check for explicit dependencies
    if (objective.includes('API')) {
      dependencies.push('External API availability');
    }
    if (objective.includes('database')) {
      dependencies.push('Database system');
    }

    // Add common dependencies
    dependencies.push('Development environment');
    dependencies.push('CI/CD pipeline');

    return dependencies;
  }

  /**
   * Select architecture pattern
   */
  private selectArchitecturePattern(requirements: Requirements): string {
    // Simple heuristic for pattern selection
    const reqCount = requirements.functional.length;

    if (reqCount > 10) {
      return ArchitecturePattern.MICROSERVICES;
    } else if (requirements.nonFunctional.some((r) => r.includes('event'))) {
      return ArchitecturePattern.EVENT_DRIVEN;
    } else if (requirements.functional.some((r) => r.includes('API'))) {
      return ArchitecturePattern.LAYERED;
    }

    return ArchitecturePattern.MVC;
  }

  /**
   * Design components
   */
  private async designComponents(requirements: Requirements, pattern: string): Promise<ComponentDesign[]> {
    const components: ComponentDesign[] = [];

    // API Gateway
    components.push({
      name: 'API Gateway',
      type: 'api',
      responsibilities: ['Route requests', 'Authentication', 'Rate limiting', 'Request validation'],
      interfaces: ['REST API', 'WebSocket'],
      dependencies: [],
    });

    // Business Logic Service
    components.push({
      name: 'Business Logic Service',
      type: 'service',
      responsibilities: ['Process business rules', 'Orchestrate workflows', 'Data transformation'],
      interfaces: ['Service API'],
      dependencies: ['API Gateway'],
    });

    // Data Access Layer
    components.push({
      name: 'Data Access Layer',
      type: 'library',
      responsibilities: ['Database operations', 'Data caching', 'Query optimization'],
      interfaces: ['Repository Pattern'],
      dependencies: ['Business Logic Service'],
    });

    // Database
    components.push({
      name: 'Database',
      type: 'database',
      responsibilities: ['Data persistence', 'Data integrity', 'Backup and recovery'],
      interfaces: ['SQL', 'NoSQL'],
      dependencies: ['Data Access Layer'],
    });

    // Add pattern-specific components
    if (pattern === ArchitecturePattern.MICROSERVICES) {
      components.push({
        name: 'Service Registry',
        type: 'service',
        responsibilities: ['Service discovery', 'Health checking', 'Load balancing'],
        interfaces: ['Registry API'],
        dependencies: [],
      });
    }

    return components;
  }

  /**
   * Select technologies
   */
  private selectTechnologies(requirements: Requirements, pattern: string): string[] {
    const technologies: string[] = [];

    // Core technologies
    technologies.push('TypeScript', 'Node.js');

    // Pattern-specific technologies
    if (pattern === ArchitecturePattern.MICROSERVICES) {
      technologies.push('Docker', 'Kubernetes', 'gRPC');
    }

    // Database
    if (requirements.functional.some((r) => r.includes('real-time'))) {
      technologies.push('Redis', 'WebSocket');
    }
    technologies.push('PostgreSQL');

    // Framework
    technologies.push('Express.js', 'Jest');

    return technologies;
  }

  /**
   * Create architecture diagrams
   */
  private async createArchitectureDiagrams(components: ComponentDesign[]): Promise<Diagram[]> {
    const diagrams: Diagram[] = [];

    // Component diagram
    diagrams.push({
      type: 'component',
      format: 'mermaid',
      title: 'System Component Diagram',
      content: this.generateComponentDiagram(components),
    });

    // Deployment diagram
    diagrams.push({
      type: 'deployment',
      format: 'mermaid',
      title: 'Deployment Architecture',
      content: this.generateDeploymentDiagram(components),
    });

    return diagrams;
  }

  /**
   * Generate component diagram in Mermaid format
   */
  private generateComponentDiagram(components: ComponentDesign[]): string {
    let diagram = 'graph TB\n';

    for (const component of components) {
      const id = component.name.replace(/\s+/g, '');
      diagram += `    ${id}[${component.name}]\n`;
    }

    // Add relationships
    for (const component of components) {
      const id = component.name.replace(/\s+/g, '');
      for (const dep of component.dependencies) {
        const depId = dep.replace(/\s+/g, '');
        diagram += `    ${depId} --> ${id}\n`;
      }
    }

    return diagram;
  }

  /**
   * Generate deployment diagram
   */
  private generateDeploymentDiagram(components: ComponentDesign[]): string {
    let diagram = 'graph TB\n';
    diagram += '    subgraph "Cloud Infrastructure"\n';
    diagram += '        subgraph "Application Tier"\n';

    for (const component of components) {
      if (component.type !== 'database') {
        const id = component.name.replace(/\s+/g, '');
        diagram += `            ${id}[${component.name}]\n`;
      }
    }

    diagram += '        end\n';
    diagram += '        subgraph "Data Tier"\n';

    for (const component of components) {
      if (component.type === 'database') {
        const id = component.name.replace(/\s+/g, '');
        diagram += `            ${id}[(${component.name})]\n`;
      }
    }

    diagram += '        end\n';
    diagram += '    end\n';

    return diagram;
  }

  /**
   * Make architecture decisions
   */
  private async makeArchitectureDecisions(
    requirements: Requirements,
    pattern: string,
    technologies: string[],
  ): Promise<ArchitecturalDecision[]> {
    const decisions: ArchitecturalDecision[] = [];

    // Pattern decision
    decisions.push({
      id: 'adr-001',
      title: `Use ${pattern} Architecture Pattern`,
      status: 'accepted',
      context: `System requires ${requirements.functional.length} functional requirements`,
      decision: `Adopt ${pattern} pattern for system architecture`,
      consequences: ['Clear separation of concerns', 'Improved maintainability', 'Potential complexity increase'],
      alternatives: ['Monolithic', 'Serverless'],
    });

    // Technology stack decision
    decisions.push({
      id: 'adr-002',
      title: 'Technology Stack Selection',
      status: 'accepted',
      context: 'Need modern, scalable technology stack',
      decision: `Use ${technologies.slice(0, 3).join(', ')} as core technologies`,
      consequences: ['Team familiarity with stack', 'Good ecosystem support', 'Active community'],
    });

    // Database decision
    decisions.push({
      id: 'adr-003',
      title: 'Database Selection',
      status: 'accepted',
      context: 'Need reliable data persistence',
      decision: 'Use PostgreSQL for primary data storage',
      consequences: ['ACID compliance', 'Strong consistency', 'Requires database administration'],
      alternatives: ['MongoDB', 'MySQL'],
    });

    return decisions;
  }

  /**
   * Estimate component effort
   */
  private estimateComponentEffort(component: ComponentDesign): number {
    let baseEffort = 16; // Base hours

    // Adjust based on responsibilities
    baseEffort += component.responsibilities.length * 4;

    // Adjust based on interfaces
    baseEffort += component.interfaces.length * 8;

    // Adjust based on dependencies
    baseEffort += component.dependencies.length * 2;

    // Adjust based on type
    switch (component.type) {
      case 'service':
        baseEffort *= 1.5;
        break;
      case 'database':
        baseEffort *= 0.7;
        break;
      case 'api':
        baseEffort *= 1.3;
        break;
      case 'ui':
        baseEffort *= 1.8;
        break;
    }

    return Math.ceil(baseEffort);
  }

  /**
   * Generate documentation
   */
  private async generateDocumentation(
    requirements: Requirements,
    architecture: Architecture,
    wbs: WorkBreakdownStructure,
    riskAssessment: RiskAssessment,
  ): Promise<string> {
    let doc = '# System Architecture Documentation\n\n';

    // Executive Summary
    doc += '## Executive Summary\n\n';
    doc += `This document describes the architecture for a system with ${architecture.components.length} main components `;
    doc += `using ${architecture.patterns.join(', ')} pattern(s).\n\n`;

    // Requirements
    doc += '## Requirements\n\n';
    doc += '### Functional Requirements\n';
    for (const req of requirements.functional) {
      doc += `- ${req}\n`;
    }
    doc += '\n### Non-Functional Requirements\n';
    for (const req of requirements.nonFunctional) {
      doc += `- ${req}\n`;
    }

    // Architecture
    doc += '\n## Architecture\n\n';
    doc += `### Pattern: ${architecture.patterns.join(', ')}\n\n`;
    doc += '### Components\n';
    for (const component of architecture.components) {
      doc += `\n#### ${component.name}\n`;
      doc += `- **Type**: ${component.type}\n`;
      doc += `- **Responsibilities**: ${component.responsibilities.join(', ')}\n`;
      doc += `- **Interfaces**: ${component.interfaces.join(', ')}\n`;
      if (component.dependencies.length > 0) {
        doc += `- **Dependencies**: ${component.dependencies.join(', ')}\n`;
      }
    }

    // Technologies
    doc += '\n### Technology Stack\n';
    for (const tech of architecture.technologies) {
      doc += `- ${tech}\n`;
    }

    // Work Breakdown Structure
    doc += '\n## Project Plan\n\n';
    doc += `### Total Estimate: ${wbs.totalEstimate} hours\n\n`;
    doc += '### Phases\n';
    for (const phase of wbs.phases) {
      doc += `\n#### ${phase.name} (${phase.duration} hours)\n`;
      for (const task of phase.tasks) {
        doc += `- ${task.name}: ${task.estimate} hours (${task.priority} priority)\n`;
      }
    }

    // Milestones
    doc += '\n### Milestones\n';
    for (const milestone of wbs.milestones) {
      doc += `\n#### ${milestone.name}\n`;
      doc += `- **Date**: ${milestone.date.toISOString().split('T')[0]}\n`;
      doc += `- **Deliverables**: ${milestone.deliverables.join(', ')}\n`;
      doc += `- **Success Criteria**: ${milestone.criteria.join(', ')}\n`;
    }

    // Risk Assessment
    doc += '\n## Risk Assessment\n\n';
    doc += `### Overall Risk Level: ${riskAssessment.overallRisk.toUpperCase()}\n\n`;
    doc += '### Identified Risks\n';
    for (const risk of riskAssessment.risks) {
      doc += `\n#### ${risk.id}: ${risk.description}\n`;
      doc += `- **Category**: ${risk.category}\n`;
      doc += `- **Probability**: ${(risk.probability * 100).toFixed(0)}%\n`;
      doc += `- **Impact**: ${(risk.impact * 100).toFixed(0)}%\n`;
      doc += `- **Severity**: ${(risk.severity * 100).toFixed(0)}%\n`;

      // Find mitigation
      const mitigation = riskAssessment.mitigations.find((m) => m.riskId === risk.id);
      if (mitigation) {
        doc += `- **Mitigation**: ${mitigation.strategy}\n`;
        doc += `- **Actions**: ${mitigation.actions.join(', ')}\n`;
      }
    }

    // Architecture Decisions
    doc += '\n## Architecture Decisions\n';
    for (const decision of architecture.decisions) {
      doc += `\n### ${decision.id}: ${decision.title}\n`;
      doc += `- **Status**: ${decision.status}\n`;
      doc += `- **Context**: ${decision.context}\n`;
      doc += `- **Decision**: ${decision.decision}\n`;
      doc += `- **Consequences**: ${decision.consequences.join(', ')}\n`;
      if (decision.alternatives) {
        doc += `- **Alternatives**: ${decision.alternatives.join(', ')}\n`;
      }
    }

    // Diagrams
    doc += '\n## Diagrams\n';
    for (const diagram of architecture.diagrams) {
      doc += `\n### ${diagram.title}\n`;
      doc += '```' + diagram.format + '\n';
      doc += diagram.content;
      doc += '```\n';
    }

    return doc;
  }

  /**
   * Initialize design patterns
   */
  private initializeDesignPatterns(): void {
    this.designPatterns.set('singleton', 'Ensure a class has only one instance');
    this.designPatterns.set('factory', 'Create objects without specifying exact class');
    this.designPatterns.set('observer', 'Define one-to-many dependency between objects');
    this.designPatterns.set('strategy', 'Define family of algorithms and make them interchangeable');
    this.designPatterns.set('adapter', 'Allow incompatible interfaces to work together');
    this.designPatterns.set('facade', 'Provide unified interface to subsystem interfaces');
    this.designPatterns.set('repository', 'Encapsulate data access logic');
    this.designPatterns.set('dependency-injection', 'Inject dependencies rather than creating them');
  }

  /**
   * Initialize technology stacks
   */
  private initializeTechnologyStacks(): void {
    // MEAN Stack
    this.technologyStacks.set('mean', {
      frontend: ['Angular', 'TypeScript'],
      backend: ['Node.js', 'Express.js'],
      database: ['MongoDB'],
      tools: ['npm', 'webpack'],
    });

    // MERN Stack
    this.technologyStacks.set('mern', {
      frontend: ['React', 'JavaScript/TypeScript'],
      backend: ['Node.js', 'Express.js'],
      database: ['MongoDB'],
      tools: ['npm', 'webpack', 'babel'],
    });

    // JAMstack
    this.technologyStacks.set('jamstack', {
      frontend: ['React/Vue/Angular', 'JavaScript'],
      backend: ['Serverless Functions'],
      database: ['Headless CMS', 'API'],
      infrastructure: ['CDN', 'Static Hosting'],
      tools: ['Gatsby', 'Next.js', 'Nuxt.js'],
    });

    // Microservices Stack
    this.technologyStacks.set('microservices', {
      frontend: ['React', 'TypeScript'],
      backend: ['Node.js', 'Go', 'Python'],
      database: ['PostgreSQL', 'MongoDB', 'Redis'],
      infrastructure: ['Docker', 'Kubernetes', 'Service Mesh'],
      tools: ['gRPC', 'RabbitMQ', 'Prometheus'],
    });
  }

  /**
   * Create complexity analysis
   */
  async analyzeComplexity(architecture: Architecture): Promise<{
    cyclomaticComplexity: number;
    cognitiveComplexity: number;
    architecturalComplexity: number;
    recommendation: string;
  }> {
    // Calculate cyclomatic complexity (simplified)
    const cyclomaticComplexity =
      architecture.components.length + architecture.components.reduce((sum, c) => sum + c.dependencies.length, 0);

    // Calculate cognitive complexity
    const cognitiveComplexity = architecture.patterns.length * 10 + architecture.technologies.length * 2;

    // Calculate architectural complexity
    const architecturalComplexity = (cyclomaticComplexity + cognitiveComplexity) / 2;

    // Generate recommendation
    let recommendation: string;
    if (architecturalComplexity < 20) {
      recommendation = 'Low complexity - suitable for small teams';
    } else if (architecturalComplexity < 50) {
      recommendation = 'Medium complexity - requires experienced team';
    } else {
      recommendation = 'High complexity - consider simplification or larger team';
    }

    return {
      cyclomaticComplexity,
      cognitiveComplexity,
      architecturalComplexity,
      recommendation,
    };
  }

  /**
   * Suggest design patterns
   */
  suggestPatterns(requirements: Requirements): string[] {
    const suggestions: string[] = [];

    // Analyze requirements and suggest patterns
    const reqText = [...requirements.functional, ...requirements.nonFunctional].join(' ').toLowerCase();

    if (reqText.includes('single instance') || reqText.includes('global')) {
      suggestions.push('singleton');
    }
    if (reqText.includes('create') || reqText.includes('instantiate')) {
      suggestions.push('factory');
    }
    if (reqText.includes('notify') || reqText.includes('event')) {
      suggestions.push('observer');
    }
    if (reqText.includes('algorithm') || reqText.includes('strategy')) {
      suggestions.push('strategy');
    }
    if (reqText.includes('adapt') || reqText.includes('integrate')) {
      suggestions.push('adapter');
    }
    if (reqText.includes('simplify') || reqText.includes('interface')) {
      suggestions.push('facade');
    }
    if (reqText.includes('data') || reqText.includes('database')) {
      suggestions.push('repository');
    }

    return suggestions;
  }

  /**
   * Generate acceptance criteria
   */
  generateAcceptanceCriteria(requirements: Requirements): string[] {
    const criteria: string[] = [];

    // Generate criteria for functional requirements
    for (const req of requirements.functional) {
      criteria.push(`System successfully ${req.toLowerCase()}`);
      criteria.push(`User can verify that ${req.toLowerCase()}`);
    }

    // Generate criteria for non-functional requirements
    for (const req of requirements.nonFunctional) {
      if (req.includes('performance')) {
        criteria.push('Response time is under 2 seconds for 95% of requests');
      }
      if (req.includes('security')) {
        criteria.push('All data is encrypted in transit and at rest');
        criteria.push('Authentication and authorization are properly implemented');
      }
      if (req.includes('uptime')) {
        criteria.push('System maintains 99.9% availability');
      }
    }

    // Add general criteria
    criteria.push('All unit tests pass with >80% coverage');
    criteria.push('Integration tests pass successfully');
    criteria.push('Documentation is complete and accurate');
    criteria.push('Code review has been completed');
    return criteria;
  }
}

// Export singleton instance
export const architectAgent = new ArchitectAgent();
