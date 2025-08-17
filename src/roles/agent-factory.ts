/**
 * Agent Factory
 * Factory pattern implementation for creating and managing agent instances
 */

import type { AgentContext, AgentInfo, AgentType } from '../types';
import { createLogger } from '../utils/logger';
import { ArchitectAgent } from './architect';
import type { BaseAgent } from './base-agent';
import { DebuggerAgent } from './debugger';
import { DeveloperAgent } from './developer';
import { TesterAgent } from './tester';

/**
 * Agent configuration interface
 */
export interface AgentFactoryConfig {
  maxAgentsPerType?: number;
  reuseAgents?: boolean;
  defaultTimeout?: number;
  checkpointEnabled?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Agent registry entry
 */
interface AgentRegistryEntry {
  agent: BaseAgent;
  type: AgentType;
  created: Date;
  lastUsed: Date;
  usageCount: number;
  status: 'idle' | 'busy' | 'error' | 'offline';
}

/**
 * Agent Factory class
 * Implements Factory and Singleton patterns
 */
export class AgentFactory {
  private static instance: AgentFactory | null = null;
  private agents: Map<string, AgentRegistryEntry> = new Map();
  private agentsByType: Map<AgentType, Set<string>> = new Map();
  private config: AgentFactoryConfig;
  private logger = createLogger('agent-factory');
  private nextAgentId = 1;

  /**
   * Private constructor for singleton pattern
   */
  private constructor(config?: AgentFactoryConfig) {
    this.config = {
      maxAgentsPerType: 5,
      reuseAgents: true,
      defaultTimeout: 300000, // 5 minutes
      checkpointEnabled: true,
      logLevel: 'info',
      ...config,
    };

    // Initialize agent type sets
    this.agentsByType.set('architect', new Set());
    this.agentsByType.set('developer', new Set());
    this.agentsByType.set('tester', new Set());
    this.agentsByType.set('debugger', new Set());

    this.logger.info('Agent Factory initialized', this.config);
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: AgentFactoryConfig): AgentFactory {
    if (!AgentFactory.instance) {
      AgentFactory.instance = new AgentFactory(config);
    }
    return AgentFactory.instance;
  }

  /**
   * Create a new agent instance
   */
  async createAgent(type: AgentType, context?: Partial<AgentContext>): Promise<BaseAgent> {
    this.logger.debug(`Creating agent of type: ${type}`);

    // Check if we should reuse an existing agent
    if (this.config.reuseAgents) {
      const existingAgent = this.findAvailableAgent(type);
      if (existingAgent) {
        this.logger.info(`Reusing existing ${type} agent: ${existingAgent.id}`);
        this.updateAgentUsage(existingAgent.id);

        // Update context if provided
        if (context) {
          existingAgent.agent.updateContext(context);
        }

        return existingAgent.agent;
      }
    }

    // Check if we've reached the maximum number of agents for this type
    const agentsOfType = this.agentsByType.get(type)?.size || 0;
    if (agentsOfType >= (this.config.maxAgentsPerType || 5)) {
      throw new Error(`Maximum number of ${type} agents (${this.config.maxAgentsPerType}) reached`);
    }

    // Create new agent instance
    const agentId = `${type}-${this.nextAgentId++}`;
    const agent = await this.instantiateAgent(type, agentId);

    // Initialize agent
    await agent.initialize();

    // Update context if provided
    if (context) {
      agent.updateContext(context);
    }

    // Register agent
    this.registerAgent(agentId, agent, type);

    this.logger.info(`Created new ${type} agent: ${agentId}`);
    return agent;
  }

  /**
   * Get an existing agent by ID
   */
  getAgent(id: string): BaseAgent | undefined {
    const entry = this.agents.get(id);
    if (entry) {
      this.updateAgentUsage(id);
      return entry.agent;
    }
    return undefined;
  }

  /**
   * Get all agents of a specific type
   */
  getAgentsByType(type: AgentType): BaseAgent[] {
    const agentIds = this.agentsByType.get(type);
    if (!agentIds) {
      return [];
    }

    const agents: BaseAgent[] = [];
    for (const id of agentIds) {
      const entry = this.agents.get(id);
      if (entry) {
        agents.push(entry.agent);
      }
    }
    return agents;
  }

  /**
   * Register an agent
   */
  registerAgent(id: string, agent: BaseAgent, type: AgentType): void {
    const entry: AgentRegistryEntry = {
      agent,
      type,
      created: new Date(),
      lastUsed: new Date(),
      usageCount: 0,
      status: 'idle',
    };

    this.agents.set(id, entry);
    this.agentsByType.get(type)?.add(id);

    // Subscribe to agent status changes
    agent.on('agent.status.changed', (event, data) => {
      const statusData = data as { status: string };
      this.updateAgentStatus(id, statusData.status as any);
    });

    this.logger.debug(`Agent registered: ${id}`);
  }

  /**
   * Unregister an agent
   */
  async unregisterAgent(id: string): Promise<void> {
    const entry = this.agents.get(id);
    if (!entry) {
      return;
    }

    // Shutdown agent
    await entry.agent.shutdown();

    // Remove from registries
    this.agents.delete(id);
    this.agentsByType.get(entry.type)?.delete(id);

    this.logger.info(`Agent unregistered: ${id}`);
  }

  /**
   * List all registered agents
   */
  listAgents(): AgentInfo[] {
    const agentInfos: AgentInfo[] = [];

    for (const [id, entry] of this.agents.entries()) {
      const info = entry.agent.getInfo();
      agentInfos.push({
        ...info,
        id,
        metrics: {
          ...info.metrics,
          uptime: Date.now() - entry.created.getTime(),
        },
      });
    }

    return agentInfos;
  }

  /**
   * Get factory statistics
   */
  getStatistics(): {
    totalAgents: number;
    agentsByType: Record<AgentType, number>;
    activeAgents: number;
    idleAgents: number;
    errorAgents: number;
    totalUsage: number;
    averageUptime: number;
  } {
    let activeAgents = 0;
    let idleAgents = 0;
    let errorAgents = 0;
    let totalUsage = 0;
    let totalUptime = 0;

    const agentsByType: Record<AgentType, number> = {
      architect: 0,
      developer: 0,
      tester: 0,
      debugger: 0,
    };

    for (const entry of this.agents.values()) {
      agentsByType[entry.type]++;
      totalUsage += entry.usageCount;
      totalUptime += Date.now() - entry.created.getTime();

      switch (entry.status) {
        case 'busy':
          activeAgents++;
          break;
        case 'idle':
          idleAgents++;
          break;
        case 'error':
          errorAgents++;
          break;
      }
    }

    return {
      totalAgents: this.agents.size,
      agentsByType,
      activeAgents,
      idleAgents,
      errorAgents,
      totalUsage,
      averageUptime: this.agents.size > 0 ? totalUptime / this.agents.size : 0,
    };
  }

  /**
   * Cleanup idle agents
   */
  async cleanupIdleAgents(maxIdleTime = 600000): Promise<number> {
    this.logger.debug('Cleaning up idle agents');

    const now = Date.now();
    const agentsToRemove: string[] = [];

    for (const [id, entry] of this.agents.entries()) {
      const idleTime = now - entry.lastUsed.getTime();
      if (entry.status === 'idle' && idleTime > maxIdleTime) {
        agentsToRemove.push(id);
      }
    }

    for (const id of agentsToRemove) {
      await this.unregisterAgent(id);
    }

    this.logger.info(`Cleaned up ${agentsToRemove.length} idle agents`);
    return agentsToRemove.length;
  }

  /**
   * Reset factory (remove all agents)
   */
  async reset(): Promise<void> {
    this.logger.info('Resetting agent factory');

    // Shutdown all agents
    const shutdownPromises: Promise<void>[] = [];
    for (const entry of this.agents.values()) {
      shutdownPromises.push(entry.agent.shutdown());
    }
    await Promise.all(shutdownPromises);

    // Clear registries
    this.agents.clear();
    for (const set of this.agentsByType.values()) {
      set.clear();
    }

    this.nextAgentId = 1;
    this.logger.info('Agent factory reset complete');
  }

  /**
   * Health check for all agents
   */
  async healthCheck(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const [id, entry] of this.agents.entries()) {
      try {
        const healthy = await entry.agent.healthCheck();
        results.set(id, healthy);

        if (!healthy) {
          this.updateAgentStatus(id, 'error');
        }
      } catch (error) {
        this.logger.error(`Health check failed for agent ${id}`, error);
        results.set(id, false);
        this.updateAgentStatus(id, 'error');
      }
    }

    return results;
  }

  /**
   * Find an available agent of the specified type
   */
  private findAvailableAgent(type: AgentType): AgentRegistryEntry | undefined {
    const agentIds = this.agentsByType.get(type);
    if (!agentIds) {
      return undefined;
    }

    for (const id of agentIds) {
      const entry = this.agents.get(id);
      if (entry && entry.status === 'idle') {
        return entry;
      }
    }

    return undefined;
  }

  /**
   * Instantiate a new agent based on type
   */
  private async instantiateAgent(type: AgentType, id: string): Promise<BaseAgent> {
    const config = {
      id,
      timeout: this.config.defaultTimeout,
      checkpointEnabled: this.config.checkpointEnabled,
      logLevel: this.config.logLevel,
    };

    switch (type) {
      case 'architect':
        return new ArchitectAgent(config);
      case 'developer':
        return new DeveloperAgent(config);
      case 'tester':
        return new TesterAgent(config);
      case 'debugger':
        return new DebuggerAgent(config);
      default:
        throw new Error(`Unknown agent type: ${type}`);
    }
  }

  /**
   * Update agent usage statistics
   */
  private updateAgentUsage(id: string): void {
    const entry = this.agents.get(id);
    if (entry) {
      entry.lastUsed = new Date();
      entry.usageCount++;
    }
  }

  /**
   * Update agent status
   */
  private updateAgentStatus(id: string, status: 'idle' | 'busy' | 'error' | 'offline'): void {
    const entry = this.agents.get(id);
    if (entry) {
      entry.status = status;
      this.logger.debug(`Agent ${id} status updated to: ${status}`);
    }
  }

  /**
   * Create agent pool for parallel processing
   */
  async createAgentPool(type: AgentType, size: number): Promise<BaseAgent[]> {
    this.logger.info(`Creating agent pool of ${size} ${type} agents`);

    const agents: BaseAgent[] = [];
    const createPromises: Promise<BaseAgent>[] = [];

    for (let i = 0; i < size; i++) {
      createPromises.push(this.createAgent(type));
    }

    try {
      const createdAgents = await Promise.all(createPromises);
      agents.push(...createdAgents);

      this.logger.info(`Agent pool created successfully with ${agents.length} agents`);
      return agents;
    } catch (error) {
      this.logger.error('Failed to create agent pool', error);

      // Cleanup any created agents
      for (const agent of agents) {
        await agent.shutdown();
      }

      throw error;
    }
  }

  /**
   * Get the best agent for a specific task
   */
  async getBestAgentForTask(taskType: string, requirements?: string[]): Promise<BaseAgent | null> {
    this.logger.debug(`Finding best agent for task: ${taskType}`);

    // Determine agent type based on task
    let agentType: AgentType;

    if (taskType.includes('design') || taskType.includes('architecture')) {
      agentType = 'architect';
    } else if (taskType.includes('implement') || taskType.includes('code')) {
      agentType = 'developer';
    } else if (taskType.includes('test') || taskType.includes('verify')) {
      agentType = 'tester';
    } else if (taskType.includes('debug') || taskType.includes('fix')) {
      agentType = 'debugger';
    } else {
      this.logger.warn(`No suitable agent type found for task: ${taskType}`);
      return null;
    }

    // Get all agents of the determined type
    const agents = this.getAgentsByType(agentType);

    if (agents.length === 0) {
      // Create a new agent if none exist
      return await this.createAgent(agentType);
    }

    // Find the best agent based on availability and capabilities
    let bestAgent: BaseAgent | null = null;
    let bestScore = -1;

    for (const agent of agents) {
      const info = agent.getInfo();
      let score = 0;

      // Check if agent is available
      if (info.status === 'idle') {
        score += 50;
      } else if (info.status === 'busy') {
        score += 10; // Can still be considered but with lower priority
      }

      // Check capabilities match
      if (requirements) {
        const matchingCapabilities = requirements.filter((req) =>
          info.capabilities.some((cap) => cap.toLowerCase().includes(req.toLowerCase())),
        );
        score += matchingCapabilities.length * 10;
      }

      // Consider success rate
      score += info.metrics.successRate;

      if (score > bestScore) {
        bestScore = score;
        bestAgent = agent;
      }
    }

    this.logger.info(`Best agent selected: ${bestAgent?.getInfo().id} with score: ${bestScore}`);
    return bestAgent;
  }

  /**
   * Monitor agent performance
   */
  getPerformanceMetrics(): Map<
    string,
    {
      tasksCompleted: number;
      successRate: number;
      averageExecutionTime: number;
      uptime: number;
    }
  > {
    const metrics = new Map();

    for (const [id, entry] of this.agents.entries()) {
      const agentMetrics = entry.agent.getMetrics();
      metrics.set(id, {
        tasksCompleted: agentMetrics.tasksCompleted,
        successRate: agentMetrics.successRate,
        averageExecutionTime: agentMetrics.averageExecutionTime,
        uptime: Date.now() - entry.created.getTime(),
      });
    }

    return metrics;
  }
}

/**
 * Factory function to get agent factory instance
 */
export function getAgentFactory(config?: AgentFactoryConfig): AgentFactory {
  return AgentFactory.getInstance(config);
}

/**
 * Helper function to create agent
 */
export async function createAgent(type: AgentType, context?: Partial<AgentContext>): Promise<BaseAgent> {
  const factory = getAgentFactory();
  return factory.createAgent(type, context);
}

/**
 * Helper function to get agent by ID
 */
export function getAgent(id: string): BaseAgent | undefined {
  const factory = getAgentFactory();
  return factory.getAgent(id);
}

/**
 * Helper function to list all agents
 */
export function listAgents(): AgentInfo[] {
  const factory = getAgentFactory();
  return factory.listAgents();
}
