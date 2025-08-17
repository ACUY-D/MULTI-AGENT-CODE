/**
 * Architect Plan Tool
 * Tool para planificación y arquitectura de proyectos
 */

import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { AgentFactory, createAgent } from '../roles/agent-factory';
import type { ArchitectAgent } from '../roles/architect';
import type { Architecture, Requirements, RiskAssessment, WorkBreakdownStructure } from '../types';
import { createLogger } from '../utils/logger';

const logger = createLogger('architect-plan-tool');

/**
 * Schema de entrada con validación Zod completa
 */
export const ArchitectPlanInputSchema = z.object({
  objective: z.string().describe('Objetivo del sistema a diseñar'),
  constraints: z.array(z.string()).optional().describe('Restricciones técnicas o de negocio'),
  techStack: z
    .object({
      language: z.string(),
      framework: z.string().optional(),
      database: z.string().optional(),
      infrastructure: z.string().optional(),
    })
    .optional(),
  acceptanceCriteria: z.array(z.string()).optional(),
  existingCodebase: z
    .object({
      path: z.string(),
      analysis: z.boolean().default(true),
    })
    .optional(),
});

/**
 * Schema de salida con validación Zod completa
 */
export const ArchitectPlanOutputSchema = z.object({
  architecture: z.object({
    diagram: z.string().describe('Diagrama Mermaid'),
    components: z.array(
      z.object({
        name: z.string(),
        type: z.string(),
        responsibilities: z.array(z.string()),
        dependencies: z.array(z.string()),
      }),
    ),
    patterns: z.array(z.string()).describe('Patrones de diseño aplicados'),
  }),
  decisions: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      status: z.enum(['proposed', 'accepted', 'deprecated']),
      context: z.string(),
      decision: z.string(),
      consequences: z.string(),
    }),
  ),
  wbs: z.object({
    tasks: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string(),
        estimatedHours: z.number(),
        dependencies: z.array(z.string()),
        assignedTo: z.string().optional(),
      }),
    ),
    milestones: z.array(
      z.object({
        name: z.string(),
        date: z.string(),
        deliverables: z.array(z.string()),
      }),
    ),
  }),
  testStrategy: z.object({
    levels: z.array(z.enum(['unit', 'integration', 'e2e', 'performance', 'security'])),
    coverage: z.number().min(0).max(100),
    tools: z.array(z.string()),
  }),
  riskAssessment: z.array(
    z.object({
      risk: z.string(),
      probability: z.enum(['low', 'medium', 'high']),
      impact: z.enum(['low', 'medium', 'high']),
      mitigation: z.string(),
    }),
  ),
  filesGenerated: z.array(z.string()).describe('Archivos markdown generados'),
});

type ArchitectPlanInput = z.infer<typeof ArchitectPlanInputSchema>;
type ArchitectPlanOutput = z.infer<typeof ArchitectPlanOutputSchema>;

/**
 * Architect Plan Tool Class
 */
export class ArchitectPlanTool {
  static metadata = {
    name: 'architect.plan',
    description: 'Genera planificación completa y arquitectura para un proyecto de software',
    inputSchema: ArchitectPlanInputSchema,
    outputSchema: ArchitectPlanOutputSchema,
  };

  private agent: ArchitectAgent | null = null;
  private agentFactory: AgentFactory;

  constructor() {
    this.agentFactory = AgentFactory.getInstance();
  }

  /**
   * Execute the tool
   */
  async execute(input: ArchitectPlanInput): Promise<ArchitectPlanOutput> {
    logger.info('Starting architect planning', { objective: input.objective });

    try {
      // Validate input
      const validatedInput = ArchitectPlanInputSchema.parse(input);

      // Create architect agent
      this.agent = (await this.agentFactory.createAgent('architect')) as ArchitectAgent;

      // Analyze existing codebase if provided
      let codebaseAnalysis = null;
      if (validatedInput.existingCodebase && validatedInput.existingCodebase.analysis) {
        codebaseAnalysis = await this.analyzeCodebase(validatedInput.existingCodebase.path);
      }

      // Generate requirements
      const requirements = await this.generateRequirements(
        validatedInput.objective,
        validatedInput.constraints,
        validatedInput.acceptanceCriteria,
      );

      // Design architecture
      const architecture = await this.designArchitecture(requirements, validatedInput.techStack, codebaseAnalysis);

      // Generate architectural decisions
      const decisions = await this.generateDecisions(architecture, validatedInput.techStack);

      // Create work breakdown structure
      const wbs = await this.createWBS(validatedInput.objective, architecture);

      // Define test strategy
      const testStrategy = await this.defineTestStrategy(architecture, validatedInput.acceptanceCriteria);

      // Assess risks
      const riskAssessment = await this.assessRisks(architecture, validatedInput.techStack);

      // Generate documentation files
      const filesGenerated = await this.generateDocumentation(
        architecture,
        decisions,
        wbs,
        testStrategy,
        riskAssessment,
      );

      const output: ArchitectPlanOutput = {
        architecture: {
          diagram: this.generateMermaidDiagram(architecture),
          components: this.extractComponents(architecture),
          patterns: this.extractPatterns(architecture),
        },
        decisions: this.formatDecisions(decisions),
        wbs: this.formatWBS(wbs),
        testStrategy: this.formatTestStrategy(testStrategy),
        riskAssessment: this.formatRiskAssessment(riskAssessment),
        filesGenerated,
      };

      // Validate output
      return ArchitectPlanOutputSchema.parse(output);
    } catch (error) {
      logger.error('Architect planning failed', error);
      throw error;
    } finally {
      // Cleanup
      if (this.agent) {
        await this.agent.shutdown();
      }
    }
  }

  /**
   * Analyze existing codebase
   */
  private async analyzeCodebase(path: string): Promise<any> {
    logger.debug('Analyzing codebase', { path });

    // This would analyze the existing codebase structure
    return {
      structure: 'analyzed',
      patterns: ['MVC', 'Repository'],
      technologies: ['TypeScript', 'Node.js'],
    };
  }

  /**
   * Generate requirements from objectives
   */
  private async generateRequirements(
    objective: string,
    constraints?: string[],
    acceptanceCriteria?: string[],
  ): Promise<Requirements> {
    logger.debug('Generating requirements');

    const requirements: Requirements = {
      functional: ['System shall ' + objective, ...(acceptanceCriteria || [])],
      nonFunctional: ['System shall be scalable', 'System shall be maintainable', 'System shall have 99.9% uptime'],
      constraints: constraints || [],
      assumptions: ['Users have modern browsers', 'Internet connectivity is reliable'],
      dependencies: [],
    };

    if (this.agent) {
      // Use agent to refine requirements
      const refined = await this.agent.execute('analyze_requirements', {
        objective,
        initial: requirements,
      });
      if (refined.success && refined.data) {
        return refined.data as Requirements;
      }
    }

    return requirements;
  }

  /**
   * Design system architecture
   */
  private async designArchitecture(
    requirements: Requirements,
    techStack?: any,
    codebaseAnalysis?: any,
  ): Promise<Architecture> {
    logger.debug('Designing architecture');

    const architecture: Architecture = {
      components: [
        {
          name: 'API Gateway',
          type: 'api',
          responsibilities: ['Route requests', 'Authentication', 'Rate limiting'],
          interfaces: ['REST', 'GraphQL'],
          dependencies: [],
        },
        {
          name: 'Business Logic',
          type: 'service',
          responsibilities: ['Process business rules', 'Orchestrate workflows'],
          interfaces: ['Service interfaces'],
          dependencies: ['API Gateway'],
        },
        {
          name: 'Data Layer',
          type: 'database',
          responsibilities: ['Persist data', 'Query optimization'],
          interfaces: ['Repository pattern'],
          dependencies: ['Business Logic'],
        },
      ],
      patterns: ['Microservices', 'Event-driven', 'CQRS'],
      technologies: [
        techStack?.language || 'TypeScript',
        techStack?.framework || 'Express',
        techStack?.database || 'PostgreSQL',
      ],
      diagrams: [],
      decisions: [],
    };

    if (this.agent) {
      // Use agent to create detailed architecture
      const detailed = await this.agent.execute('design_architecture', {
        requirements,
        techStack,
        existing: codebaseAnalysis,
      });
      if (detailed.success && detailed.data) {
        return detailed.data as Architecture;
      }
    }

    return architecture;
  }

  /**
   * Generate architectural decisions
   */
  private async generateDecisions(architecture: Architecture, techStack?: any): Promise<any[]> {
    logger.debug('Generating architectural decisions');

    const decisions = [
      {
        id: 'ADR-001',
        title: 'Use Microservices Architecture',
        status: 'accepted',
        context: 'Need for scalability and independent deployments',
        decision: 'Adopt microservices pattern for system design',
        consequences: 'Increased complexity but better scalability',
      },
      {
        id: 'ADR-002',
        title: `Use ${techStack?.language || 'TypeScript'} as primary language`,
        status: 'accepted',
        context: 'Need for type safety and developer productivity',
        decision: `${techStack?.language || 'TypeScript'} provides strong typing and good ecosystem`,
        consequences: 'Team needs TypeScript expertise',
      },
    ];

    return decisions;
  }

  /**
   * Create work breakdown structure
   */
  private async createWBS(objective: string, architecture: Architecture): Promise<WorkBreakdownStructure> {
    logger.debug('Creating work breakdown structure');

    const wbs: WorkBreakdownStructure = {
      phases: [
        {
          name: 'Planning',
          tasks: [
            {
              id: 'TASK-001',
              name: 'Requirements gathering',
              description: 'Gather and document all requirements',
              assignee: 'architect',
              estimate: 8,
              priority: 'high',
            },
            {
              id: 'TASK-002',
              name: 'Architecture design',
              description: 'Design system architecture',
              assignee: 'architect',
              estimate: 16,
              priority: 'high',
            },
          ],
          duration: 24,
          dependencies: [],
        },
        {
          name: 'Development',
          tasks: [
            {
              id: 'TASK-003',
              name: 'API implementation',
              description: 'Implement REST API endpoints',
              assignee: 'developer',
              estimate: 40,
              priority: 'high',
            },
            {
              id: 'TASK-004',
              name: 'Database setup',
              description: 'Setup and configure database',
              assignee: 'developer',
              estimate: 16,
              priority: 'high',
            },
          ],
          duration: 56,
          dependencies: ['Planning'],
        },
      ],
      milestones: [
        {
          name: 'Architecture Complete',
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          deliverables: ['Architecture document', 'ADRs'],
          criteria: ['All decisions documented', 'Stakeholder approval'],
        },
        {
          name: 'MVP Ready',
          date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          deliverables: ['Working application', 'API documentation'],
          criteria: ['All core features working', 'Tests passing'],
        },
      ],
      totalEstimate: 80,
    };

    return wbs;
  }

  /**
   * Define test strategy
   */
  private async defineTestStrategy(architecture: Architecture, acceptanceCriteria?: string[]): Promise<any> {
    logger.debug('Defining test strategy');

    return {
      levels: ['unit', 'integration', 'e2e'],
      coverage: 80,
      tools: ['Jest', 'Supertest', 'Playwright'],
      approach: 'Test-driven development',
      acceptanceCriteria: acceptanceCriteria || [],
    };
  }

  /**
   * Assess project risks
   */
  private async assessRisks(architecture: Architecture, techStack?: any): Promise<RiskAssessment> {
    logger.debug('Assessing risks');

    const risks: RiskAssessment = {
      risks: [
        {
          id: 'RISK-001',
          category: 'technical',
          description: 'Technology stack learning curve',
          probability: 0.3,
          impact: 0.5,
          severity: 0.4,
        },
        {
          id: 'RISK-002',
          category: 'operational',
          description: 'Deployment complexity',
          probability: 0.4,
          impact: 0.6,
          severity: 0.5,
        },
      ],
      mitigations: [
        {
          riskId: 'RISK-001',
          strategy: 'Provide team training',
          actions: ['Schedule training sessions', 'Create documentation'],
          owner: 'Tech Lead',
        },
        {
          riskId: 'RISK-002',
          strategy: 'Implement CI/CD early',
          actions: ['Setup pipelines', 'Automate deployments'],
          owner: 'DevOps',
        },
      ],
      overallRisk: 'medium',
    };

    return risks;
  }

  /**
   * Generate documentation files
   */
  private async generateDocumentation(
    architecture: Architecture,
    decisions: any[],
    wbs: WorkBreakdownStructure,
    testStrategy: any,
    riskAssessment: RiskAssessment,
  ): Promise<string[]> {
    logger.debug('Generating documentation');

    // In a real implementation, this would write actual files
    const files = [
      'docs/ARCHITECTURE.md',
      'docs/decisions/ADR-001.md',
      'docs/decisions/ADR-002.md',
      'docs/WBS.md',
      'docs/TEST-STRATEGY.md',
      'docs/RISK-ASSESSMENT.md',
    ];

    return files;
  }

  /**
   * Generate Mermaid diagram
   */
  private generateMermaidDiagram(architecture: Architecture): string {
    const diagram = `
graph TB
    subgraph "System Architecture"
        API[API Gateway]
        BL[Business Logic]
        DB[(Database)]
        
        API --> BL
        BL --> DB
    end
    
    Client[Client] --> API
    `;

    return diagram.trim();
  }

  /**
   * Extract components for output
   */
  private extractComponents(architecture: Architecture): any[] {
    return architecture.components.map((comp) => ({
      name: comp.name,
      type: comp.type,
      responsibilities: comp.responsibilities,
      dependencies: comp.dependencies,
    }));
  }

  /**
   * Extract patterns for output
   */
  private extractPatterns(architecture: Architecture): string[] {
    return architecture.patterns;
  }

  /**
   * Format decisions for output
   */
  private formatDecisions(decisions: any[]): any[] {
    return decisions.map((d) => ({
      id: d.id,
      title: d.title,
      status: d.status,
      context: d.context,
      decision: d.decision,
      consequences: d.consequences,
    }));
  }

  /**
   * Format WBS for output
   */
  private formatWBS(wbs: WorkBreakdownStructure): any {
    const allTasks = wbs.phases.flatMap((phase) =>
      phase.tasks.map((task) => ({
        id: task.id,
        name: task.name,
        description: task.description,
        estimatedHours: task.estimate,
        dependencies: [],
        assignedTo: task.assignee,
      })),
    );

    return {
      tasks: allTasks,
      milestones: wbs.milestones.map((m) => ({
        name: m.name,
        date: m.date.toString(),
        deliverables: m.deliverables,
      })),
    };
  }

  /**
   * Format test strategy for output
   */
  private formatTestStrategy(testStrategy: any): any {
    return {
      levels: testStrategy.levels,
      coverage: testStrategy.coverage,
      tools: testStrategy.tools,
    };
  }

  /**
   * Format risk assessment for output
   */
  private formatRiskAssessment(riskAssessment: RiskAssessment): any[] {
    return riskAssessment.risks.map((risk) => ({
      risk: risk.description,
      probability: this.mapProbability(risk.probability),
      impact: this.mapImpact(risk.impact),
      mitigation: riskAssessment.mitigations.find((m) => m.riskId === risk.id)?.strategy || 'To be defined',
    }));
  }

  /**
   * Map probability value to enum
   */
  private mapProbability(value: number): 'low' | 'medium' | 'high' {
    if (value < 0.33) return 'low';
    if (value < 0.66) return 'medium';
    return 'high';
  }

  /**
   * Map impact value to enum
   */
  private mapImpact(value: number): 'low' | 'medium' | 'high' {
    if (value < 0.33) return 'low';
    if (value < 0.66) return 'medium';
    return 'high';
  }
}

/**
 * Factory function to create tool instance
 */
export function createArchitectPlanTool(): ArchitectPlanTool {
  return new ArchitectPlanTool();
}
