/**
 * Agent Coordinator
 * Manages communication and coordination between agents
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { AgentEvent, type AgentMessage, type AgentType, type EventHandler, MessageQueue, MessageType } from '../types';
import { createLogger } from '../utils/logger';
import { getAgentFactory } from './agent-factory';
import type { BaseAgent } from './base-agent';

/**
 * Message routing strategy
 */
enum RoutingStrategy {
  DIRECT = 'direct', // Direct message to specific agent
  BROADCAST = 'broadcast', // Send to all agents
  ROUND_ROBIN = 'round-robin', // Distribute evenly
  LEAST_BUSY = 'least-busy', // Send to least busy agent
  CAPABILITY = 'capability', // Route based on capabilities
}

/**
 * Coordination pattern
 */
enum CoordinationPattern {
  SEQUENTIAL = 'sequential', // Agents work in sequence
  PARALLEL = 'parallel', // Agents work in parallel
  PIPELINE = 'pipeline', // Pipeline pattern
  CONSENSUS = 'consensus', // Require consensus
  VOTING = 'voting', // Voting mechanism
}

/**
 * Message priority
 */
enum MessagePriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3,
}

/**
 * Conversation context
 */
interface ConversationContext {
  id: string;
  participants: string[];
  messages: AgentMessage[];
  startTime: Date;
  lastActivity: Date;
  status: 'active' | 'completed' | 'failed';
  metadata?: Record<string, unknown>;
}

/**
 * Collaboration session
 */
interface CollaborationSession {
  id: string;
  goal: string;
  agents: Map<string, BaseAgent>;
  pattern: CoordinationPattern;
  startTime: Date;
  endTime?: Date;
  results: Map<string, unknown>;
  status: 'planning' | 'executing' | 'completed' | 'failed';
}

/**
 * Agent Coordinator implementation
 */
export class AgentCoordinator extends EventEmitter {
  private messageQueue: AgentMessage[] = [];
  private agents: Map<string, BaseAgent> = new Map();
  private conversations: Map<string, ConversationContext> = new Map();
  private sessions: Map<string, CollaborationSession> = new Map();
  private messageHandlers: Map<string, (message: AgentMessage) => Promise<void>> = new Map();
  private eventHandlers: Map<AgentEvent, EventHandler[]> = new Map();
  private logger = createLogger('agent-coordinator');
  private isProcessing = false;
  private processingInterval?: NodeJS.Timeout;
  private metrics = {
    messagesRouted: 0,
    messagesDropped: 0,
    averageLatency: 0,
    activeConversations: 0,
    completedSessions: 0,
  };

  constructor() {
    super();
    this.initialize();
  }

  /**
   * Initialize coordinator
   */
  private initialize(): void {
    // Start message processing loop
    this.processingInterval = setInterval(() => {
      this.processMessageQueue();
    }, 100);

    // Register default handlers
    this.registerDefaultHandlers();

    this.logger.info('Agent Coordinator initialized');
  }

  /**
   * Register an agent with the coordinator
   */
  async registerAgent(agent: BaseAgent): Promise<void> {
    const agentInfo = agent.getInfo();
    const agentId = agentInfo.id;

    if (this.agents.has(agentId)) {
      this.logger.warn(`Agent ${agentId} already registered`);
      return;
    }

    this.agents.set(agentId, agent);

    // Subscribe to agent events
    agent.on(AgentEvent.MESSAGE_SENT, async (event, data) => {
      const message = data as AgentMessage;
      await this.handleAgentMessage(message);
    });

    agent.on(AgentEvent.COMPLETED, async (event, data) => {
      await this.handleAgentCompletion(agentId, data);
    });

    agent.on(AgentEvent.FAILED, async (event, data) => {
      await this.handleAgentFailure(agentId, data);
    });

    this.logger.info(`Agent registered: ${agentId}`, {
      type: agentInfo.type,
      capabilities: agentInfo.capabilities.length,
    });

    // Emit registration event
    this.emit('agent:registered', { agentId, agentInfo });
  }

  /**
   * Unregister an agent
   */
  async unregisterAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return;
    }

    // Remove from active conversations
    for (const conversation of this.conversations.values()) {
      const index = conversation.participants.indexOf(agentId);
      if (index > -1) {
        conversation.participants.splice(index, 1);
      }
    }

    // Remove from sessions
    for (const session of this.sessions.values()) {
      session.agents.delete(agentId);
    }

    this.agents.delete(agentId);
    this.logger.info(`Agent unregistered: ${agentId}`);

    // Emit unregistration event
    this.emit('agent:unregistered', { agentId });
  }

  /**
   * Route a message between agents
   */
  async routeMessage(
    from: string,
    to: string | string[],
    content: unknown,
    options?: {
      type?: MessageType;
      priority?: MessagePriority;
      strategy?: RoutingStrategy;
      timeout?: number;
    },
  ): Promise<void> {
    const message: AgentMessage = {
      id: uuidv4(),
      from,
      to: Array.isArray(to) ? to[0] : to, // Primary recipient
      type: options?.type || MessageType.REQUEST,
      payload: content,
      timestamp: new Date(),
      correlationId: uuidv4(),
      metadata: {
        priority: options?.priority || MessagePriority.NORMAL,
        strategy: options?.strategy || RoutingStrategy.DIRECT,
        allRecipients: Array.isArray(to) ? to : [to],
      },
    };

    // Add to queue based on priority
    if (options?.priority === MessagePriority.CRITICAL) {
      this.messageQueue.unshift(message);
    } else {
      this.messageQueue.push(message);
    }

    this.logger.debug('Message queued for routing', {
      messageId: message.id,
      from,
      to: Array.isArray(to) ? to.join(', ') : to,
      priority: options?.priority,
    });

    // Emit message queued event
    this.emit('message:queued', message);
  }

  /**
   * Broadcast a message to all agents
   */
  async broadcastMessage(
    from: string,
    content: unknown,
    options?: {
      type?: MessageType;
      excludeAgents?: string[];
    },
  ): Promise<void> {
    const recipients: string[] = [];

    for (const agentId of this.agents.keys()) {
      if (agentId !== from && !options?.excludeAgents?.includes(agentId)) {
        recipients.push(agentId);
      }
    }

    if (recipients.length === 0) {
      this.logger.warn('No recipients for broadcast message');
      return;
    }

    await this.routeMessage(from, recipients, content, {
      type: options?.type,
      strategy: RoutingStrategy.BROADCAST,
    });

    this.logger.info('Broadcast message sent', {
      from,
      recipientCount: recipients.length,
    });
  }

  /**
   * Wait for a response to a message
   */
  async waitForResponse(requestId: string, timeout = 30000): Promise<AgentMessage | null> {
    return new Promise((resolve) => {
      const timeoutHandle = setTimeout(() => {
        this.removeListener(`response:${requestId}`, responseHandler);
        resolve(null);
      }, timeout);

      const responseHandler = (message: AgentMessage) => {
        clearTimeout(timeoutHandle);
        resolve(message);
      };

      this.once(`response:${requestId}`, responseHandler);
    });
  }

  /**
   * Start a collaboration session
   */
  async startCollaborationSession(
    goal: string,
    agentTypes: AgentType[],
    pattern: CoordinationPattern = CoordinationPattern.SEQUENTIAL,
  ): Promise<string> {
    const sessionId = uuidv4();
    const factory = getAgentFactory();
    const agents = new Map<string, BaseAgent>();

    // Create or get agents for the session
    for (const type of agentTypes) {
      const agent = await factory.createAgent(type);
      await this.registerAgent(agent);
      agents.set(agent.getInfo().id, agent);
    }

    const session: CollaborationSession = {
      id: sessionId,
      goal,
      agents,
      pattern,
      startTime: new Date(),
      results: new Map(),
      status: 'planning',
    };

    this.sessions.set(sessionId, session);

    this.logger.info('Collaboration session started', {
      sessionId,
      goal,
      agentCount: agents.size,
      pattern,
    });

    // Start session execution
    this.executeSession(sessionId);

    return sessionId;
  }

  /**
   * Execute a collaboration session
   */
  private async executeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    session.status = 'executing';

    try {
      switch (session.pattern) {
        case CoordinationPattern.SEQUENTIAL:
          await this.executeSequentialPattern(session);
          break;
        case CoordinationPattern.PARALLEL:
          await this.executeParallelPattern(session);
          break;
        case CoordinationPattern.PIPELINE:
          await this.executePipelinePattern(session);
          break;
        case CoordinationPattern.CONSENSUS:
          await this.executeConsensusPattern(session);
          break;
        case CoordinationPattern.VOTING:
          await this.executeVotingPattern(session);
          break;
      }

      session.status = 'completed';
      session.endTime = new Date();
      this.metrics.completedSessions++;

      this.logger.info('Collaboration session completed', {
        sessionId,
        duration: session.endTime.getTime() - session.startTime.getTime(),
        resultsCount: session.results.size,
      });

      // Emit completion event
      this.emit('session:completed', {
        sessionId,
        results: Object.fromEntries(session.results),
      });
    } catch (error) {
      session.status = 'failed';
      session.endTime = new Date();

      this.logger.error('Collaboration session failed', {
        sessionId,
        error: (error as Error).message,
      });

      // Emit failure event
      this.emit('session:failed', {
        sessionId,
        error,
      });
    }
  }

  /**
   * Execute sequential coordination pattern
   */
  private async executeSequentialPattern(session: CollaborationSession): Promise<void> {
    const agents = Array.from(session.agents.values());
    let previousResult: unknown = { goal: session.goal };

    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      const agentInfo = agent.getInfo();

      this.logger.debug(`Sequential execution: Agent ${i + 1}/${agents.length}`, {
        agentId: agentInfo.id,
        agentType: agentInfo.type,
      });

      // Create message for agent
      const message: AgentMessage = {
        id: uuidv4(),
        from: 'coordinator',
        to: agentInfo.id,
        type: MessageType.REQUEST,
        payload: {
          sessionId: session.id,
          step: i + 1,
          totalSteps: agents.length,
          previousResult,
          goal: session.goal,
        },
        timestamp: new Date(),
      };

      // Send message to agent
      await agent.receiveMessage(message);

      // Wait for response
      const response = await this.waitForResponse(message.id, 60000);

      if (response) {
        previousResult = response.payload;
        session.results.set(`step_${i + 1}_${agentInfo.type}`, previousResult);
      } else {
        throw new Error(`Agent ${agentInfo.id} did not respond in time`);
      }
    }
  }

  /**
   * Execute parallel coordination pattern
   */
  private async executeParallelPattern(session: CollaborationSession): Promise<void> {
    const agents = Array.from(session.agents.values());
    const promises: Promise<unknown>[] = [];

    for (const agent of agents) {
      const agentInfo = agent.getInfo();

      // Create message for agent
      const message: AgentMessage = {
        id: uuidv4(),
        from: 'coordinator',
        to: agentInfo.id,
        type: MessageType.REQUEST,
        payload: {
          sessionId: session.id,
          goal: session.goal,
        },
        timestamp: new Date(),
      };

      // Send message and collect promise
      const promise = agent.receiveMessage(message).then(() => {
        return this.waitForResponse(message.id, 60000);
      });

      promises.push(promise);
    }

    // Wait for all agents to complete
    const results = await Promise.all(promises);

    // Store results
    agents.forEach((agent, index) => {
      const agentInfo = agent.getInfo();
      session.results.set(`parallel_${agentInfo.type}`, results[index]);
    });
  }

  /**
   * Execute pipeline coordination pattern
   */
  private async executePipelinePattern(session: CollaborationSession): Promise<void> {
    const agents = Array.from(session.agents.values());
    const pipeline: unknown[] = [];

    // Create a pipeline where each agent processes and transforms data
    for (const agent of agents) {
      const agentInfo = agent.getInfo();

      const message: AgentMessage = {
        id: uuidv4(),
        from: 'coordinator',
        to: agentInfo.id,
        type: MessageType.REQUEST,
        payload: {
          sessionId: session.id,
          goal: session.goal,
          pipelineData: pipeline[pipeline.length - 1] || session.goal,
        },
        timestamp: new Date(),
      };

      await agent.receiveMessage(message);
      const response = await this.waitForResponse(message.id, 60000);

      if (response) {
        pipeline.push(response.payload);
        session.results.set(`pipeline_stage_${pipeline.length}_${agentInfo.type}`, response.payload);
      }
    }
  }

  /**
   * Execute consensus coordination pattern
   */
  private async executeConsensusPattern(session: CollaborationSession): Promise<void> {
    const agents = Array.from(session.agents.values());
    const proposals = new Map<string, unknown>();

    // Collect proposals from all agents
    for (const agent of agents) {
      const agentInfo = agent.getInfo();

      const message: AgentMessage = {
        id: uuidv4(),
        from: 'coordinator',
        to: agentInfo.id,
        type: MessageType.REQUEST,
        payload: {
          sessionId: session.id,
          goal: session.goal,
          action: 'propose',
        },
        timestamp: new Date(),
      };

      await agent.receiveMessage(message);
      const response = await this.waitForResponse(message.id, 60000);

      if (response) {
        proposals.set(agentInfo.id, response.payload);
      }
    }

    // Distribute proposals for consensus
    for (const agent of agents) {
      const agentInfo = agent.getInfo();

      const message: AgentMessage = {
        id: uuidv4(),
        from: 'coordinator',
        to: agentInfo.id,
        type: MessageType.REQUEST,
        payload: {
          sessionId: session.id,
          action: 'review',
          proposals: Array.from(proposals.values()),
        },
        timestamp: new Date(),
      };

      await agent.receiveMessage(message);
      const response = await this.waitForResponse(message.id, 60000);

      if (response) {
        session.results.set(`consensus_${agentInfo.type}`, response.payload);
      }
    }
  }

  /**
   * Execute voting coordination pattern
   */
  private async executeVotingPattern(session: CollaborationSession): Promise<void> {
    const agents = Array.from(session.agents.values());
    const votes = new Map<string, unknown>();

    // Collect votes from all agents
    for (const agent of agents) {
      const agentInfo = agent.getInfo();

      const message: AgentMessage = {
        id: uuidv4(),
        from: 'coordinator',
        to: agentInfo.id,
        type: MessageType.REQUEST,
        payload: {
          sessionId: session.id,
          goal: session.goal,
          action: 'vote',
        },
        timestamp: new Date(),
      };

      await agent.receiveMessage(message);
      const response = await this.waitForResponse(message.id, 60000);

      if (response) {
        votes.set(agentInfo.id, response.payload);
      }
    }

    // Calculate winner
    const voteCount = new Map<string, number>();
    for (const vote of votes.values()) {
      const option = JSON.stringify(vote);
      voteCount.set(option, (voteCount.get(option) || 0) + 1);
    }

    // Find winner
    let winner: string | null = null;
    let maxVotes = 0;
    for (const [option, count] of voteCount.entries()) {
      if (count > maxVotes) {
        maxVotes = count;
        winner = option;
      }
    }

    session.results.set('voting_result', {
      winner: winner ? JSON.parse(winner) : null,
      votes: Object.fromEntries(votes),
      voteCount: Object.fromEntries(voteCount),
    });
  }

  /**
   * Process message queue
   */
  private async processMessageQueue(): Promise<void> {
    if (this.isProcessing || this.messageQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift()!;
        await this.processMessage(message);
      }
    } catch (error) {
      this.logger.error('Error processing message queue', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single message
   */
  private async processMessage(message: AgentMessage): Promise<void> {
    const startTime = Date.now();

    try {
      const strategy = (message.metadata?.strategy as RoutingStrategy) || RoutingStrategy.DIRECT;

      switch (strategy) {
        case RoutingStrategy.DIRECT:
          await this.routeDirectMessage(message);
          break;
        case RoutingStrategy.BROADCAST:
          await this.routeBroadcastMessage(message);
          break;
        case RoutingStrategy.ROUND_ROBIN:
          await this.routeRoundRobinMessage(message);
          break;
        case RoutingStrategy.LEAST_BUSY:
          await this.routeLeastBusyMessage(message);
          break;
        case RoutingStrategy.CAPABILITY:
          await this.routeByCapability(message);
          break;
      }

      // Update metrics
      this.metrics.messagesRouted++;
      const latency = Date.now() - startTime;
      this.metrics.averageLatency =
        (this.metrics.averageLatency * (this.metrics.messagesRouted - 1) + latency) / this.metrics.messagesRouted;

      // Emit message routed event
      this.emit('message:routed', message);
    } catch (error) {
      this.logger.error('Failed to process message', {
        messageId: message.id,
        error: (error as Error).message,
      });

      this.metrics.messagesDropped++;

      // Emit message dropped event
      this.emit('message:dropped', { message, error });
    }
  }

  /**
   * Route direct message
   */
  private async routeDirectMessage(message: AgentMessage): Promise<void> {
    const targetAgent = this.agents.get(message.to);

    if (!targetAgent) {
      throw new Error(`Target agent ${message.to} not found`);
    }

    await targetAgent.receiveMessage(message);
  }

  /**
   * Route broadcast message
   */
  private async routeBroadcastMessage(message: AgentMessage): Promise<void> {
    const recipients = (message.metadata?.allRecipients as string[]) || [];

    for (const recipientId of recipients) {
      const agent = this.agents.get(recipientId);
      if (agent) {
        await agent.receiveMessage({
          ...message,
          to: recipientId,
        });
      }
    }
  }

  /**
   * Route round-robin message
   */
  private async routeRoundRobinMessage(message: AgentMessage): Promise<void> {
    const agentIds = Array.from(this.agents.keys());
    if (agentIds.length === 0) {
      throw new Error('No agents available');
    }

    // Simple round-robin: use message ID hash to select agent
    const index = Math.abs(this.hashCode(message.id)) % agentIds.length;
    const targetId = agentIds[index];
    const targetAgent = this.agents.get(targetId)!;

    await targetAgent.receiveMessage({
      ...message,
      to: targetId,
    });
  }

  /**
   * Route to least busy agent
   */
  private async routeLeastBusyMessage(message: AgentMessage): Promise<void> {
    let leastBusyAgent: BaseAgent | null = null;
    let minTasks = Number.POSITIVE_INFINITY;

    for (const agent of this.agents.values()) {
      const info = agent.getInfo();
      const taskCount = info.currentTasks.length;

      if (info.status === 'idle' || (info.status === 'busy' && taskCount < minTasks)) {
        leastBusyAgent = agent;
        minTasks = taskCount;
      }
    }

    if (!leastBusyAgent) {
      throw new Error('No available agents');
    }

    await leastBusyAgent.receiveMessage({
      ...message,
      to: leastBusyAgent.getInfo().id,
    });
  }

  /**
   * Route by capability
   */
  private async routeByCapability(message: AgentMessage): Promise<void> {
    const requiredCapability = message.metadata?.capability as string;

    if (!requiredCapability) {
      throw new Error('Capability not specified for capability-based routing');
    }

    // Find agents with the required capability
    const capableAgents: BaseAgent[] = [];

    for (const agent of this.agents.values()) {
      if (agent.hasCapability(requiredCapability)) {
        capableAgents.push(agent);
      }
    }

    if (capableAgents.length === 0) {
      throw new Error(`No agents with capability: ${requiredCapability}`);
    }

    // Select the best agent (currently just the first available)
    const targetAgent = capableAgents.find((a) => a.getStatus() === 'idle') || capableAgents[0];

    await targetAgent.receiveMessage({
      ...message,
      to: targetAgent.getInfo().id,
    });
  }

  /**
   * Handle agent message
   */
  private async handleAgentMessage(message: AgentMessage): Promise<void> {
    // Check if this is a response to a previous request
    if (message.type === MessageType.RESPONSE && message.metadata?.replyTo) {
      const requestId = message.metadata.replyTo as string;
      this.emit(`response:${requestId}`, message);
    }

    // Update conversation tracking
    this.updateConversation(message);

    // Custom message handling
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      await handler(message);
    }
  }

  /**
   * Handle agent completion
   */
  private async handleAgentCompletion(agentId: string, data: unknown): Promise<void> {
    this.logger.debug(`Agent ${agentId} completed task`, data);

    // Update session results if part of a session
    for (const session of this.sessions.values()) {
      if (session.agents.has(agentId)) {
        session.results.set(`${agentId}_result`, data);
      }
    }

    // Emit completion event
    this.emit('agent:completed', { agentId, data });
  }

  /**
   * Handle agent failure
   */
  private async handleAgentFailure(agentId: string, error: unknown): Promise<void> {
    this.logger.error(`Agent ${agentId} failed`, error);

    // Mark sessions as failed if critical agent fails
    for (const session of this.sessions.values()) {
      if (session.agents.has(agentId) && session.status === 'executing') {
        session.status = 'failed';
        session.endTime = new Date();
      }
    }

    // Emit failure event
    this.emit('agent:failed', { agentId, error });
  }

  /**
   * Update conversation tracking
   */
  private updateConversation(message: AgentMessage): void {
    const conversationId = (message.metadata?.conversationId as string) || message.correlationId || 'default';

    let conversation = this.conversations.get(conversationId);

    if (!conversation) {
      conversation = {
        id: conversationId,
        participants: [],
        messages: [],
        startTime: new Date(),
        lastActivity: new Date(),
        status: 'active',
      };
      this.conversations.set(conversationId, conversation);
      this.metrics.activeConversations++;
    }

    // Update participants
    if (!conversation.participants.includes(message.from)) {
      conversation.participants.push(message.from);
    }
    if (!conversation.participants.includes(message.to)) {
      conversation.participants.push(message.to);
    }

    // Add message
    conversation.messages.push(message);
    conversation.lastActivity = new Date();
  }

  /**
   * Register default handlers
   */
  private registerDefaultHandlers(): void {
    // Status request handler
    this.registerMessageHandler('status', async (message) => {
      const status = this.getStatus();
      await this.routeMessage('coordinator', message.from, status, {
        type: MessageType.RESPONSE,
      });
    });

    // Ping handler
    this.registerMessageHandler('ping', async (message) => {
      await this.routeMessage(
        'coordinator',
        message.from,
        { pong: true },
        {
          type: MessageType.RESPONSE,
        },
      );
    });
  }

  /**
   * Register a message handler
   */
  registerMessageHandler(type: string, handler: (message: AgentMessage) => Promise<void>): void {
    this.messageHandlers.set(type, handler);
  }

  /**
   * Get coordinator status
   */
  getStatus(): {
    agents: number;
    activeConversations: number;
    activeSessions: number;
    messageQueueSize: number;
    metrics: typeof this.metrics;
  } {
    return {
      agents: this.agents.size,
      activeConversations: this.conversations.size,
      activeSessions: Array.from(this.sessions.values()).filter((s) => s.status === 'executing').length,
      messageQueueSize: this.messageQueue.length,
      metrics: { ...this.metrics },
    };
  }

  /**
   * Get conversation by ID
   */
  getConversation(conversationId: string): ConversationContext | undefined {
    return this.conversations.get(conversationId);
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): CollaborationSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Complete a conversation
   */
  completeConversation(conversationId: string): void {
    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      conversation.status = 'completed';
      this.metrics.activeConversations--;

      // Clean up old conversations after some time
      setTimeout(() => {
        this.conversations.delete(conversationId);
      }, 300000); // 5 minutes
    }
  }

  /**
   * Get agent recommendations for a task
   */
  async getAgentRecommendations(
    taskDescription: string,
    requirements?: string[],
  ): Promise<Array<{ agentId: string; score: number; reason: string }>> {
    const recommendations: Array<{ agentId: string; score: number; reason: string }> = [];

    for (const agent of this.agents.values()) {
      const info = agent.getInfo();
      let score = 0;
      const reasons: string[] = [];

      // Check availability
      if (info.status === 'idle') {
        score += 30;
        reasons.push('Agent is available');
      }

      // Check capabilities
      if (requirements) {
        const matchingCapabilities = requirements.filter((req) =>
          info.capabilities.some((cap) => cap.toLowerCase().includes(req.toLowerCase())),
        );
        score += matchingCapabilities.length * 20;
        if (matchingCapabilities.length > 0) {
          reasons.push(`Matches capabilities: ${matchingCapabilities.join(', ')}`);
        }
      }

      // Check success rate
      if (info.metrics.successRate > 80) {
        score += 20;
        reasons.push(`High success rate: ${info.metrics.successRate.toFixed(1)}%`);
      }

      // Check task type affinity
      if (taskDescription.includes('design') && info.type === 'architect') {
        score += 25;
        reasons.push('Architect agent suitable for design tasks');
      } else if (taskDescription.includes('code') && info.type === 'developer') {
        score += 25;
        reasons.push('Developer agent suitable for coding tasks');
      } else if (taskDescription.includes('test') && info.type === 'tester') {
        score += 25;
        reasons.push('Tester agent suitable for testing tasks');
      } else if (taskDescription.includes('debug') && info.type === 'debugger') {
        score += 25;
        reasons.push('Debugger agent suitable for debugging tasks');
      }

      if (score > 0) {
        recommendations.push({
          agentId: info.id,
          score,
          reason: reasons.join('; '),
        });
      }
    }

    // Sort by score
    recommendations.sort((a, b) => b.score - a.score);

    return recommendations;
  }

  /**
   * Create agent team for complex task
   */
  async createAgentTeam(
    taskDescription: string,
    teamSize = 4,
  ): Promise<{
    teamId: string;
    agents: Array<{ id: string; type: AgentType; role: string }>;
  }> {
    const teamId = uuidv4();
    const team: Array<{ id: string; type: AgentType; role: string }> = [];
    const factory = getAgentFactory();

    // Determine required roles based on task
    const roles: Array<{ type: AgentType; role: string }> = [];

    // Always include an architect for planning
    roles.push({ type: 'architect', role: 'Lead Planner' });

    // Add other roles based on task
    if (taskDescription.includes('implement') || taskDescription.includes('build')) {
      roles.push({ type: 'developer', role: 'Implementation Lead' });
    }
    if (taskDescription.includes('test') || taskDescription.includes('verify')) {
      roles.push({ type: 'tester', role: 'Quality Assurance' });
    }
    if (taskDescription.includes('fix') || taskDescription.includes('issue')) {
      roles.push({ type: 'debugger', role: 'Issue Resolution' });
    }

    // Fill remaining slots with relevant agents
    while (roles.length < teamSize) {
      if (roles.filter((r) => r.type === 'developer').length < 2) {
        roles.push({ type: 'developer', role: `Developer ${roles.filter((r) => r.type === 'developer').length + 1}` });
      } else if (!roles.some((r) => r.type === 'tester')) {
        roles.push({ type: 'tester', role: 'Tester' });
      } else {
        roles.push({ type: 'architect', role: 'Assistant Architect' });
      }
    }

    // Create agents for the team
    for (const role of roles.slice(0, teamSize)) {
      const agent = await factory.createAgent(role.type);
      await this.registerAgent(agent);

      team.push({
        id: agent.getInfo().id,
        type: role.type,
        role: role.role,
      });
    }

    this.logger.info('Agent team created', {
      teamId,
      teamSize: team.length,
      roles: team.map((t) => t.role),
    });

    return { teamId, agents: team };
  }

  /**
   * Simple hash code function
   */
  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  /**
   * Shutdown coordinator
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Agent Coordinator');

    // Clear processing interval
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    // Complete all active conversations
    for (const conversation of this.conversations.values()) {
      if (conversation.status === 'active') {
        conversation.status = 'completed';
      }
    }

    // End all active sessions
    for (const session of this.sessions.values()) {
      if (session.status === 'executing') {
        session.status = 'completed';
        session.endTime = new Date();
      }
    }

    // Clear queues
    this.messageQueue = [];

    this.logger.info('Agent Coordinator shutdown complete');
  }
}

// Singleton instance
let coordinatorInstance: AgentCoordinator | null = null;

/**
 * Get or create coordinator instance
 */
export function getAgentCoordinator(): AgentCoordinator {
  if (!coordinatorInstance) {
    coordinatorInstance = new AgentCoordinator();
  }
  return coordinatorInstance;
}

/**
 * Helper function to start collaboration
 */
export async function startCollaboration(
  goal: string,
  agentTypes: AgentType[],
  pattern?: CoordinationPattern,
): Promise<string> {
  const coordinator = getAgentCoordinator();
  return coordinator.startCollaborationSession(goal, agentTypes, pattern);
}

/**
 * Helper function to broadcast message
 */
export async function broadcast(from: string, content: unknown): Promise<void> {
  const coordinator = getAgentCoordinator();
  return coordinator.broadcastMessage(from, content);
}
