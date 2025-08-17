import { ArchitectAgent } from '@/roles/architect';
import type { AgentMessage, AgentResult } from '@/types';
import { expectPartialMatch, expectToRejectWith, expectValidAgentResult } from '@tests/helpers/assertions';
import { createMockAgentMessage, createMockAgentResult, fixtures } from '@tests/helpers/fixtures';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('ArchitectAgent', () => {
  let architectAgent: ArchitectAgent;
  let mockMessage: AgentMessage;

  beforeEach(() => {
    architectAgent = new ArchitectAgent();
    mockMessage = createMockAgentMessage({
      to: 'architect',
      type: 'task',
      content: {
        task: 'Design system architecture',
        context: {
          objective: fixtures.validObjective,
          requirements: ['RESTful API', 'Authentication system', 'Database integration', 'Scalable architecture'],
        },
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create ArchitectAgent instance', () => {
      expect(architectAgent).toBeDefined();
      expect(architectAgent.id).toBe('architect');
      expect(architectAgent.name).toBe('Architect Agent');
    });

    it('should have correct configuration', () => {
      expect(architectAgent.config).toMatchObject({
        maxRetries: expect.any(Number),
        timeout: expect.any(Number),
      });
      expect(architectAgent.config.timeout).toBeGreaterThanOrEqual(30000);
    });

    it('should initialize with correct capabilities', () => {
      expect(architectAgent.capabilities).toContain('architecture-design');
      expect(architectAgent.capabilities).toContain('adr-creation');
      expect(architectAgent.capabilities).toContain('risk-assessment');
      expect(architectAgent.capabilities).toContain('resource-estimation');
    });
  });

  describe('execute', () => {
    it('should analyze requirements and generate architecture', async () => {
      const result = await architectAgent.execute(mockMessage);

      expectValidAgentResult(result);
      expect(result.success).toBe(true);
      expect(result.agentId).toBe('architect');
      expect(result.data).toBeDefined();
    });

    it('should generate architecture overview', async () => {
      const result = await architectAgent.execute(mockMessage);

      expect(result.data.overview).toBeDefined();
      expect(result.data.overview).toBeTypeOf('string');
      expect(result.data.overview.length).toBeGreaterThan(50);
    });

    it('should identify system components', async () => {
      const result = await architectAgent.execute(mockMessage);

      expect(result.data.components).toBeDefined();
      expect(Array.isArray(result.data.components)).toBe(true);
      expect(result.data.components.length).toBeGreaterThan(0);

      result.data.components.forEach((component: any) => {
        expect(component).toMatchObject({
          name: expect.any(String),
          type: expect.any(String),
          responsibilities: expect.any(Array),
        });
      });
    });

    it('should create Architecture Decision Records (ADRs)', async () => {
      const result = await architectAgent.execute(mockMessage);

      expect(result.data.adrs).toBeDefined();
      expect(Array.isArray(result.data.adrs)).toBe(true);
      expect(result.data.adrs.length).toBeGreaterThan(0);

      result.data.adrs.forEach((adr: any) => {
        expect(adr).toMatchObject({
          id: expect.stringMatching(/^ADR-\d{3}$/),
          title: expect.any(String),
          status: expect.stringMatching(/^(proposed|accepted|deprecated|superseded)$/),
          context: expect.any(String),
          decision: expect.any(String),
          consequences: expect.any(String),
        });
      });
    });

    it('should perform risk assessment', async () => {
      const result = await architectAgent.execute(mockMessage);

      expect(result.data.riskAssessment).toBeDefined();
      expect(result.data.riskAssessment.risks).toBeDefined();
      expect(Array.isArray(result.data.riskAssessment.risks)).toBe(true);

      result.data.riskAssessment.risks.forEach((risk: any) => {
        expect(risk).toMatchObject({
          id: expect.stringMatching(/^RISK-\d{3}$/),
          description: expect.any(String),
          likelihood: expect.stringMatching(/^(low|medium|high)$/),
          impact: expect.stringMatching(/^(low|medium|high)$/),
          mitigation: expect.any(String),
        });
      });
    });

    it('should estimate required resources', async () => {
      const result = await architectAgent.execute(mockMessage);

      expect(result.data.estimatedResources).toBeDefined();
      expect(result.data.estimatedResources).toMatchObject({
        development: expect.any(String),
        team: expect.any(String),
        infrastructure: expect.any(String),
      });
    });

    it('should handle complex requirements', async () => {
      mockMessage.content.context.requirements = [
        'Microservices architecture',
        'Event-driven communication',
        'CQRS pattern',
        'GraphQL API',
        'Multi-tenancy support',
        'Real-time notifications',
        'Horizontal scaling',
      ];

      const result = await architectAgent.execute(mockMessage);

      expect(result.success).toBe(true);
      expect(result.data.components.length).toBeGreaterThanOrEqual(5);
      expect(result.data.adrs.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle missing requirements gracefully', async () => {
      delete mockMessage.content.context.requirements;

      const result = await architectAgent.execute(mockMessage);

      expect(result.success).toBe(true);
      expect(result.data.overview).toContain(fixtures.validObjective);
    });

    it('should include metadata in result', async () => {
      const result = await architectAgent.execute(mockMessage);

      expect(result.metadata).toBeDefined();
      expect(result.metadata.duration).toBeTypeOf('number');
      expect(result.metadata.duration).toBeGreaterThan(0);

      if (result.metadata.tokens) {
        expect(result.metadata.tokens).toBeTypeOf('number');
        expect(result.metadata.tokens).toBeGreaterThan(0);
      }
    });
  });

  describe('analyzeRequirements', () => {
    it('should extract functional requirements', async () => {
      const analysis = await architectAgent.analyzeRequirements(mockMessage.content.context);

      expect(analysis).toBeDefined();
      expect(analysis.functional).toBeDefined();
      expect(Array.isArray(analysis.functional)).toBe(true);
      expect(analysis.functional.length).toBeGreaterThan(0);
    });

    it('should identify non-functional requirements', async () => {
      const analysis = await architectAgent.analyzeRequirements(mockMessage.content.context);

      expect(analysis.nonFunctional).toBeDefined();
      expect(Array.isArray(analysis.nonFunctional)).toBe(true);
      expect(analysis.nonFunctional).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/performance|security|scalability|reliability|maintainability/i),
        ]),
      );
    });

    it('should detect architectural patterns', async () => {
      const analysis = await architectAgent.analyzeRequirements(mockMessage.content.context);

      expect(analysis.patterns).toBeDefined();
      expect(Array.isArray(analysis.patterns)).toBe(true);

      if (analysis.patterns.length > 0) {
        expect(analysis.patterns).toEqual(
          expect.arrayContaining([expect.stringMatching(/MVC|REST|microservices|layered|event-driven/i)]),
        );
      }
    });
  });

  describe('generateArchitecture', () => {
    it('should create component diagram', async () => {
      const architecture = await architectAgent.generateArchitecture(mockMessage.content.context);

      expect(architecture.diagram).toBeDefined();
      expect(architecture.diagram).toBeTypeOf('string');
      expect(architecture.diagram).toContain('```');
    });

    it('should define interfaces between components', async () => {
      const architecture = await architectAgent.generateArchitecture(mockMessage.content.context);

      expect(architecture.interfaces).toBeDefined();
      expect(Array.isArray(architecture.interfaces)).toBe(true);

      architecture.interfaces.forEach((iface: any) => {
        expect(iface).toMatchObject({
          from: expect.any(String),
          to: expect.any(String),
          protocol: expect.any(String),
          description: expect.any(String),
        });
      });
    });

    it('should specify technology stack', async () => {
      const architecture = await architectAgent.generateArchitecture(mockMessage.content.context);

      expect(architecture.techStack).toBeDefined();
      expect(architecture.techStack).toMatchObject({
        backend: expect.any(Array),
        frontend: expect.any(Array),
        database: expect.any(Array),
        infrastructure: expect.any(Array),
      });
    });
  });

  describe('createADRs', () => {
    it('should create ADR for authentication strategy', async () => {
      const adrs = await architectAgent.createADRs(mockMessage.content.context);

      const authADR = adrs.find(
        (adr) => adr.title.toLowerCase().includes('authentication') || adr.title.toLowerCase().includes('auth'),
      );

      expect(authADR).toBeDefined();
      expect(authADR?.decision).toContain('JWT');
    });

    it('should create ADR for database choice', async () => {
      const adrs = await architectAgent.createADRs(mockMessage.content.context);

      const dbADR = adrs.find(
        (adr) => adr.title.toLowerCase().includes('database') || adr.title.toLowerCase().includes('data'),
      );

      expect(dbADR).toBeDefined();
      expect(dbADR?.decision).toMatch(/PostgreSQL|MongoDB|MySQL|Redis/i);
    });

    it('should number ADRs sequentially', async () => {
      const adrs = await architectAgent.createADRs(mockMessage.content.context);

      const ids = adrs.map((adr) => adr.id);
      expect(ids).toEqual(expect.arrayContaining(['ADR-001', 'ADR-002', 'ADR-003']));
    });
  });

  describe('assessRisks', () => {
    it('should identify technical risks', async () => {
      const assessment = await architectAgent.assessRisks(mockMessage.content.context);

      const techRisks = assessment.risks.filter((risk) => risk.category === 'technical');

      expect(techRisks.length).toBeGreaterThan(0);
      techRisks.forEach((risk) => {
        expect(risk.mitigation).toBeDefined();
        expect(risk.mitigation.length).toBeGreaterThan(10);
      });
    });

    it('should identify security risks', async () => {
      const assessment = await architectAgent.assessRisks(mockMessage.content.context);

      const securityRisks = assessment.risks.filter(
        (risk) => risk.category === 'security' || risk.description.toLowerCase().includes('security'),
      );

      expect(securityRisks.length).toBeGreaterThan(0);
    });

    it('should calculate overall risk level', async () => {
      const assessment = await architectAgent.assessRisks(mockMessage.content.context);

      expect(assessment.overallRisk).toBeDefined();
      expect(assessment.overallRisk).toMatch(/^(low|medium|high)$/);
    });

    it('should provide risk matrix', async () => {
      const assessment = await architectAgent.assessRisks(mockMessage.content.context);

      if (assessment.matrix) {
        expect(assessment.matrix).toMatchObject({
          high: expect.any(Array),
          medium: expect.any(Array),
          low: expect.any(Array),
        });
      }
    });
  });

  describe('estimateResources', () => {
    it('should estimate development timeline', async () => {
      const estimate = await architectAgent.estimateResources(mockMessage.content.context);

      expect(estimate.timeline).toBeDefined();
      expect(estimate.timeline).toMatchObject({
        minimum: expect.any(String),
        expected: expect.any(String),
        maximum: expect.any(String),
      });
    });

    it('should estimate team composition', async () => {
      const estimate = await architectAgent.estimateResources(mockMessage.content.context);

      expect(estimate.team).toBeDefined();
      expect(estimate.team.roles).toBeDefined();
      expect(Array.isArray(estimate.team.roles)).toBe(true);

      estimate.team.roles.forEach((role: any) => {
        expect(role).toMatchObject({
          title: expect.any(String),
          count: expect.any(Number),
          level: expect.stringMatching(/^(junior|mid|senior|lead)$/),
        });
      });
    });

    it('should estimate infrastructure costs', async () => {
      const estimate = await architectAgent.estimateResources(mockMessage.content.context);

      if (estimate.infrastructure.cost) {
        expect(estimate.infrastructure.cost).toMatchObject({
          monthly: expect.any(Number),
          yearly: expect.any(Number),
          currency: expect.stringMatching(/^(USD|EUR|GBP)$/),
        });
      }
    });
  });

  describe('error handling', () => {
    it('should handle invalid message format', async () => {
      const invalidMessage = createMockAgentMessage({
        content: {},
      });

      const result = await architectAgent.execute(invalidMessage);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle timeout gracefully', async () => {
      // Mock a long-running operation
      architectAgent.config.timeout = 100; // Set very short timeout

      const slowMessage = createMockAgentMessage({
        content: {
          task: 'Complex architecture requiring extensive analysis',
          context: {
            objective: 'Build enterprise-scale distributed system',
            requirements: Array(100).fill('Complex requirement'),
          },
        },
      });

      const result = await architectAgent.execute(slowMessage);

      // Should either complete or fail gracefully
      expect(result).toBeDefined();
      expect(result.agentId).toBe('architect');
    });

    it('should retry on transient failures', async () => {
      let attempts = 0;
      const originalExecute = architectAgent.execute.bind(architectAgent);

      architectAgent.execute = vi.fn(async (msg) => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Transient error');
        }
        return originalExecute(msg);
      });

      const result = await architectAgent.executeWithRetry(mockMessage);

      expect(attempts).toBe(2);
      expect(result.success).toBe(true);
    });
  });
});
