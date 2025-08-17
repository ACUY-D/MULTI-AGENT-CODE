/**
 * Global TypeScript type definitions
 * Shared types and interfaces used across the application
 */

import { z } from 'zod';

/**
 * Agent types
 */
export type AgentType = 'architect' | 'developer' | 'tester' | 'debugger';

/**
 * Pipeline phase types
 */
export type PipelinePhase = 'business' | 'models' | 'actions' | 'deliverables';

/**
 * Task status
 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

/**
 * Base task interface
 */
export interface BaseTask {
  id: string;
  name: string;
  description: string;
  status: TaskStatus;
  createdAt: Date;
  updatedAt: Date;
  assignedAgent?: AgentType;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  dependencies?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Agent task interface
 */
export interface AgentTask extends BaseTask {
  type: string;
  input: unknown;
  output?: unknown;
  error?: Error;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
}

/**
 * Pipeline configuration
 */
export interface PipelineConfig {
  id: string;
  name: string;
  version: string;
  description?: string;
  phases: PipelinePhase[];
  parallel?: boolean;
  timeout?: number;
  retryPolicy?: {
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier?: number;
  };
}

/**
 * Execution context
 */
export interface ExecutionContext {
  pipelineId: string;
  executionId: string;
  environment: 'development' | 'staging' | 'production';
  variables: Record<string, unknown>;
  secrets?: Record<string, string>;
  artifacts: Map<string, unknown>;
  logs: string[];
}

/**
 * Agent response
 */
export interface AgentResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  metadata?: {
    duration: number;
    retries?: number;
    warnings?: string[];
  };
}

/**
 * MCP message types
 */
export interface MCPRequest {
  id: string;
  method: string;
  params?: unknown;
  metadata?: Record<string, unknown>;
}

export interface MCPResponse {
  id: string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * Knowledge graph types
 */
export interface KnowledgeEntity {
  id: string;
  name: string;
  type: string;
  properties: Record<string, unknown>;
  observations: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeRelation {
  id: string;
  from: string;
  to: string;
  type: string;
  properties?: Record<string, unknown>;
}

/**
 * Test result types
 */
export interface TestResult {
  suite: string;
  test: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: {
    message: string;
    stack?: string;
  };
  coverage?: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
}

/**
 * Artifact types
 */
export interface Artifact {
  id: string;
  name: string;
  type: 'file' | 'directory' | 'archive' | 'report';
  path: string;
  size: number;
  mimeType?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

/**
 * Configuration schema
 */
export const ConfigSchema = z.object({
  environment: z.enum(['development', 'staging', 'production']).default('development'),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  server: z
    .object({
      host: z.string().default('localhost'),
      port: z.number().default(3000),
    })
    .optional(),
  orchestrator: z
    .object({
      maxConcurrentTasks: z.number().default(5),
      taskTimeout: z.number().default(300000), // 5 minutes
      retryAttempts: z.number().default(3),
    })
    .optional(),
  adapters: z
    .object({
      github: z
        .object({
          token: z.string().optional(),
          owner: z.string().optional(),
          repo: z.string().optional(),
        })
        .optional(),
      memory: z
        .object({
          serverUrl: z.string().optional(),
        })
        .optional(),
      sequential: z
        .object({
          serverUrl: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Event types for event-driven architecture
 */
export interface OrchestratorEvent {
  type: string;
  timestamp: Date;
  source: string;
  data?: unknown;
}

export interface PipelineStartedEvent extends OrchestratorEvent {
  type: 'pipeline.started';
  data: {
    pipelineId: string;
    config: PipelineConfig;
  };
}

export interface PipelineCompletedEvent extends OrchestratorEvent {
  type: 'pipeline.completed';
  data: {
    pipelineId: string;
    executionId: string;
    duration: number;
    results: Map<string, unknown>;
  };
}

export interface AgentAssignedEvent extends OrchestratorEvent {
  type: 'agent.assigned';
  data: {
    agentType: AgentType;
    taskId: string;
  };
}

export interface TaskCompletedEvent extends OrchestratorEvent {
  type: 'task.completed';
  data: {
    taskId: string;
    result: unknown;
    duration: number;
  };
}

/**
 * Error types
 */
export class OrchestratorError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'OrchestratorError';
  }
}

export class PipelineError extends OrchestratorError {
  constructor(message: string, details?: unknown) {
    super(message, 'PIPELINE_ERROR', details);
    this.name = 'PipelineError';
  }
}

export class AgentError extends OrchestratorError {
  constructor(
    message: string,
    public agentType: AgentType,
    details?: unknown,
  ) {
    super(message, 'AGENT_ERROR', details);
    this.name = 'AgentError';
  }
}

export class AdapterError extends OrchestratorError {
  constructor(
    message: string,
    public adapterName: string,
    details?: unknown,
  ) {
    super(message, 'ADAPTER_ERROR', details);
    this.name = 'AdapterError';
  }
}

/**
 * Utility type helpers
 */
export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

export type Awaitable<T> = T | Promise<T>;

/**
 * Message types for agent communication
 */
export enum MessageType {
  REQUEST = 'request',
  RESPONSE = 'response',
  NOTIFICATION = 'notification',
  ERROR = 'error',
  STATUS = 'status',
  CHECKPOINT = 'checkpoint',
}

/**
 * Agent capability interface
 */
export interface AgentCapability {
  name: string;
  description: string;
  inputSchema: z.ZodSchema;
  outputSchema: z.ZodSchema;
  timeout?: number;
  retryable?: boolean;
}

/**
 * Agent context interface
 */
export interface AgentContext {
  pipelineId: string;
  executionId: string;
  environment: 'development' | 'staging' | 'production';
  variables: Record<string, unknown>;
  artifacts: Map<string, unknown>;
  history: AgentMessage[];
  checkpoints: string[];
}

/**
 * Agent message interface
 */
export interface AgentMessage {
  id: string;
  from: string;
  to: string;
  type: MessageType;
  payload: unknown;
  timestamp: Date;
  replyTo?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Agent result interface
 */
export interface AgentResult {
  success: boolean;
  data?: unknown;
  error?: Error;
  artifacts?: Artifact[];
  metrics?: Metrics;
  duration?: number;
  retries?: number;
}

/**
 * Metrics interface for agents
 */
export interface Metrics {
  executionTime: number;
  memoryUsage: number;
  cpuUsage?: number;
  customMetrics?: Record<string, number>;
}

/**
 * Agent event types
 */
export enum AgentEvent {
  STARTED = 'agent.started',
  COMPLETED = 'agent.completed',
  FAILED = 'agent.failed',
  MESSAGE_SENT = 'agent.message.sent',
  MESSAGE_RECEIVED = 'agent.message.received',
  CAPABILITY_EXECUTED = 'agent.capability.executed',
  CHECKPOINT_SAVED = 'agent.checkpoint.saved',
  STATUS_CHANGED = 'agent.status.changed',
}

/**
 * Event handler type
 */
export type EventHandler = (event: AgentEvent, data: unknown) => void | Promise<void>;

/**
 * Requirements interface for Architect
 */
export interface Requirements {
  functional: string[];
  nonFunctional: string[];
  constraints: string[];
  assumptions: string[];
  dependencies: string[];
}

/**
 * Architecture interface for Architect
 */
export interface Architecture {
  components: ComponentDesign[];
  patterns: string[];
  technologies: string[];
  diagrams: Diagram[];
  decisions: ArchitecturalDecision[];
}

/**
 * Component design interface
 */
export interface ComponentDesign {
  name: string;
  type: 'service' | 'library' | 'database' | 'ui' | 'api';
  responsibilities: string[];
  interfaces: string[];
  dependencies: string[];
}

/**
 * Diagram interface
 */
export interface Diagram {
  type: 'component' | 'sequence' | 'class' | 'deployment';
  format: 'mermaid' | 'plantuml' | 'svg';
  content: string;
  title: string;
}

/**
 * Architectural decision interface
 */
export interface ArchitecturalDecision {
  id: string;
  title: string;
  status: 'proposed' | 'accepted' | 'rejected' | 'deprecated';
  context: string;
  decision: string;
  consequences: string[];
  alternatives?: string[];
}

/**
 * ADR (Architecture Decision Record) document
 */
export interface ADRDocument {
  number: number;
  title: string;
  date: Date;
  status: string;
  content: string;
}

/**
 * Work breakdown structure
 */
export interface WorkBreakdownStructure {
  phases: WBSPhase[];
  milestones: Milestone[];
  totalEstimate: number;
}

/**
 * WBS Phase interface
 */
export interface WBSPhase {
  name: string;
  tasks: WBSTask[];
  duration: number;
  dependencies: string[];
}

/**
 * WBS Task interface
 */
export interface WBSTask {
  id: string;
  name: string;
  description: string;
  assignee?: AgentType;
  estimate: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Milestone interface
 */
export interface Milestone {
  name: string;
  date: Date;
  deliverables: string[];
  criteria: string[];
}

/**
 * Risk assessment interface
 */
export interface RiskAssessment {
  risks: Risk[];
  mitigations: Mitigation[];
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Risk interface
 */
export interface Risk {
  id: string;
  category: 'technical' | 'business' | 'operational' | 'security';
  description: string;
  probability: number;
  impact: number;
  severity: number;
}

/**
 * Mitigation interface
 */
export interface Mitigation {
  riskId: string;
  strategy: string;
  actions: string[];
  owner: string;
  deadline?: Date;
}

/**
 * Feature specification for Developer
 */
export interface FeatureSpec {
  name: string;
  description: string;
  requirements: string[];
  acceptanceCriteria: string[];
  technicalDetails?: TechnicalDetails;
}

/**
 * Technical details interface
 */
export interface TechnicalDetails {
  language: string;
  framework?: string;
  libraries: string[];
  patterns: string[];
}

/**
 * Code implementation interface
 */
export interface CodeImplementation {
  files: CodeFile[];
  tests: TestFile[];
  documentation: string;
  dependencies: Dependency[];
}

/**
 * Code file interface
 */
export interface CodeFile {
  path: string;
  content: string;
  language: string;
  purpose: string;
}

/**
 * Test file interface
 */
export interface TestFile {
  path: string;
  content: string;
  type: 'unit' | 'integration' | 'e2e';
  coverage: number;
}

/**
 * Dependency interface
 */
export interface Dependency {
  name: string;
  version: string;
  type: 'production' | 'development';
}

/**
 * Test suite interface
 */
export interface TestSuite {
  name: string;
  tests: TestCase[];
  setup?: string;
  teardown?: string;
  coverage: CoverageReport;
}

/**
 * Test case interface
 */
export interface TestCase {
  id: string;
  name: string;
  description: string;
  type: 'unit' | 'integration' | 'e2e' | 'performance' | 'security';
  status?: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  steps: TestStep[];
  expectedResult: string;
  actualResult?: string;
  duration?: number;
}

/**
 * Test step interface
 */
export interface TestStep {
  action: string;
  expectedOutcome: string;
  actualOutcome?: string;
}

/**
 * Coverage report interface
 */
export interface CoverageReport {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
  uncoveredLines?: number[];
}

/**
 * Review result interface
 */
export interface ReviewResult {
  score: number;
  issues: CodeIssue[];
  suggestions: string[];
  approved: boolean;
}

/**
 * Code issue interface
 */
export interface CodeIssue {
  type: 'bug' | 'vulnerability' | 'smell' | 'style' | 'performance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  file: string;
  line: number;
  column?: number;
  message: string;
  suggestion?: string;
}

/**
 * Optimization result interface
 */
export interface OptimizationResult {
  optimized: boolean;
  improvements: Improvement[];
  metrics: PerformanceMetrics;
}

/**
 * Improvement interface
 */
export interface Improvement {
  type: 'performance' | 'memory' | 'readability' | 'maintainability';
  description: string;
  before: string;
  after: string;
  impact: number;
}

/**
 * Performance metrics interface
 */
export interface PerformanceMetrics {
  executionTime: number;
  memoryUsage: number;
  cpuUsage: number;
  throughput?: number;
  latency?: number;
}

/**
 * Test specification for Tester
 */
export interface TestSpec {
  feature: string;
  scenarios: TestScenario[];
  requirements: string[];
  environment: TestEnvironment;
}

/**
 * Test scenario interface
 */
export interface TestScenario {
  name: string;
  preconditions: string[];
  steps: string[];
  expectedResults: string[];
}

/**
 * Test environment interface
 */
export interface TestEnvironment {
  os: string;
  browser?: string;
  runtime: string;
  dependencies: Record<string, string>;
}

/**
 * Test results interface
 */
export interface TestResults {
  summary: TestSummary;
  details: TestDetail[];
  coverage: CoverageReport;
  artifacts: TestArtifact[];
}

/**
 * Test summary interface
 */
export interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  successRate: number;
}

/**
 * Test detail interface
 */
export interface TestDetail {
  testId: string;
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: TestError;
  screenshots?: string[];
  logs?: string[];
}

/**
 * Test error interface
 */
export interface TestError {
  message: string;
  stack?: string;
  expected?: unknown;
  actual?: unknown;
}

/**
 * Test artifact interface
 */
export interface TestArtifact {
  type: 'screenshot' | 'video' | 'log' | 'report';
  path: string;
  timestamp: Date;
}

/**
 * E2E scenario interface
 */
export interface E2EScenario {
  name: string;
  userJourney: UserAction[];
  assertions: Assertion[];
}

/**
 * User action interface
 */
export interface UserAction {
  type: 'click' | 'type' | 'select' | 'hover' | 'scroll' | 'wait';
  target: string;
  value?: string;
  options?: Record<string, unknown>;
}

/**
 * Assertion interface
 */
export interface Assertion {
  type: 'exists' | 'visible' | 'text' | 'value' | 'attribute';
  target: string;
  expected: unknown;
}

/**
 * E2E results interface
 */
export interface E2EResults {
  scenarios: E2EScenarioResult[];
  screenshots: string[];
  videos?: string[];
}

/**
 * E2E scenario result interface
 */
export interface E2EScenarioResult {
  scenario: string;
  status: 'passed' | 'failed';
  duration: number;
  steps: E2EStepResult[];
}

/**
 * E2E step result interface
 */
export interface E2EStepResult {
  action: UserAction;
  status: 'passed' | 'failed';
  error?: string;
  screenshot?: string;
}

/**
 * Performance configuration interface
 */
export interface PerfConfig {
  url?: string;
  duration: number;
  users: number;
  rampUp: number;
  thresholds: PerfThresholds;
}

/**
 * Performance thresholds interface
 */
export interface PerfThresholds {
  responseTime: number;
  throughput: number;
  errorRate: number;
  cpuUsage?: number;
  memoryUsage?: number;
}

/**
 * Performance results interface
 */
export interface PerfResults {
  metrics: PerformanceMetrics;
  percentiles: Record<string, number>;
  errors: PerfError[];
  passed: boolean;
}

/**
 * Performance error interface
 */
export interface PerfError {
  timestamp: Date;
  type: string;
  message: string;
  count: number;
}

/**
 * Test report interface
 */
export interface TestReport {
  id: string;
  title: string;
  date: Date;
  summary: TestSummary;
  sections: ReportSection[];
  recommendations: string[];
}

/**
 * Report section interface
 */
export interface ReportSection {
  title: string;
  content: string;
  charts?: Chart[];
  tables?: Table[];
}

/**
 * Chart interface
 */
export interface Chart {
  type: 'line' | 'bar' | 'pie' | 'scatter';
  data: Record<string, unknown>;
  options?: Record<string, unknown>;
}

/**
 * Table interface
 */
export interface Table {
  headers: string[];
  rows: string[][];
}

/**
 * Error analysis for Debugger
 */
export interface ErrorAnalysis {
  error: Error;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context: ErrorContext;
  stackTrace: StackFrame[];
}

/**
 * Error context interface
 */
export interface ErrorContext {
  file?: string;
  line?: number;
  column?: number;
  function?: string;
  variables?: Record<string, unknown>;
  previousErrors?: Error[];
}

/**
 * Stack frame interface
 */
export interface StackFrame {
  file: string;
  line: number;
  column?: number;
  function: string;
  source?: string;
}

/**
 * Root cause interface
 */
export interface RootCause {
  identified: boolean;
  description: string;
  category: 'logic' | 'data' | 'integration' | 'environment' | 'unknown';
  evidence: string[];
  confidence: number;
}

/**
 * Fix interface
 */
export interface Fix {
  id: string;
  description: string;
  changes: CodeChange[];
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  tested: boolean;
}

/**
 * Code change interface
 */
export interface CodeChange {
  file: string;
  line: number;
  before: string;
  after: string;
  reason: string;
}

/**
 * Log analysis interface
 */
export interface LogAnalysis {
  patterns: LogPattern[];
  anomalies: Anomaly[];
  timeline: LogEvent[];
  summary: string;
}

/**
 * Log pattern interface
 */
export interface LogPattern {
  pattern: string;
  count: number;
  severity: string;
  examples: string[];
}

/**
 * Anomaly interface
 */
export interface Anomaly {
  timestamp: Date;
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  relatedLogs: string[];
}

/**
 * Log event interface
 */
export interface LogEvent {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  source: string;
  metadata?: Record<string, unknown>;
}

/**
 * Agent info interface
 */
export interface AgentInfo {
  id: string;
  type: AgentType;
  name: string;
  status: 'idle' | 'busy' | 'error' | 'offline';
  capabilities: string[];
  currentTasks: string[];
  metrics: AgentMetrics;
}

/**
 * Agent metrics interface
 */
export interface AgentMetrics {
  tasksCompleted: number;
  tasksFailed: number;
  averageExecutionTime: number;
  successRate: number;
  uptime: number;
}

/**
 * Message queue interface
 */
export interface MessageQueue {
  enqueue(message: AgentMessage): void;
  dequeue(): AgentMessage | undefined;
  peek(): AgentMessage | undefined;
  size(): number;
  clear(): void;
}

/**
 * Input schemas for agents using Zod
 */
export const ArchitectInputSchema = z.object({
  objective: z.string(),
  requirements: z.array(z.string()).optional(),
  constraints: z.array(z.string()).optional(),
  context: z.record(z.unknown()).optional(),
});

export const DeveloperInputSchema = z.object({
  task: z.string(),
  specification: z.object({
    language: z.string(),
    framework: z.string().optional(),
    dependencies: z.array(z.string()).optional(),
  }),
  architecture: z.record(z.unknown()).optional(),
});

export const TesterInputSchema = z.object({
  target: z.string(),
  testType: z.enum(['unit', 'integration', 'e2e', 'performance', 'security']),
  coverage: z.number().min(0).max(100).optional(),
  scenarios: z.array(z.string()).optional(),
});

export const DebuggerInputSchema = z.object({
  error: z.object({
    message: z.string(),
    stack: z.string().optional(),
    code: z.string().optional(),
  }),
  context: z.record(z.unknown()).optional(),
  logs: z.array(z.string()).optional(),
});
