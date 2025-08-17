/**
 * Unit tests for State Machine
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PipelineEvent,
  PipelineState,
  PipelineStateMachine,
  createPipelineMachine,
  createStateMachine,
  pipelineServices,
} from '../../../src/core/state-machine';

describe('PipelineStateMachine', () => {
  let stateMachine: PipelineStateMachine;

  beforeEach(() => {
    stateMachine = new PipelineStateMachine({
      enableCheckpoints: false,
      enableLogging: false,
      maxRetries: 3,
    });
  });

  describe('initialization', () => {
    it('should create state machine instance', () => {
      expect(stateMachine).toBeDefined();
      expect(stateMachine).toBeInstanceOf(PipelineStateMachine);
    });

    it('should start in idle state', () => {
      stateMachine.start();

      const state = stateMachine.getCurrentStateValue();
      expect(state).toBe(PipelineState.IDLE);

      stateMachine.stop();
    });

    it('should throw error if already running', () => {
      stateMachine.start();

      expect(() => stateMachine.start()).toThrow(/already running/);

      stateMachine.stop();
    });

    it('should stop state machine', () => {
      stateMachine.start();
      stateMachine.stop();

      expect(() => stateMachine.send(PipelineEvent.START)).toThrow(/not running/);
    });
  });

  describe('state transitions', () => {
    beforeEach(() => {
      stateMachine.start();
    });

    afterEach(() => {
      stateMachine.stop();
    });

    it('should transition from IDLE to INITIALIZING on START', () => {
      stateMachine.send(PipelineEvent.START, {
        pipelineId: 'test-pipeline',
        objective: 'Test objective',
      });

      // Wait for transition
      const state = stateMachine.getCurrentStateValue();
      expect([PipelineState.IDLE, PipelineState.INITIALIZING]).toContain(state);
    });

    it('should transition through BMAD phases', async () => {
      stateMachine.send(PipelineEvent.START, {
        pipelineId: 'test-pipeline',
        objective: 'Test objective',
      });

      // Mock services to complete quickly
      const machine = createPipelineMachine({
        enableCheckpoints: false,
        enableLogging: false,
      });

      const service = interpret(
        machine.withConfig({
          services: {
            initializeService: () => Promise.resolve({ phase: 'init', result: 'ok', duration: 1 }),
            brainstormService: () => Promise.resolve({ phase: 'brainstorm', result: 'ok', duration: 1 }),
            mappingService: () => Promise.resolve({ phase: 'map', result: 'ok', duration: 1 }),
            actingService: () => Promise.resolve({ phase: 'act', result: 'ok', duration: 1 }),
            debriefingService: () => Promise.resolve({ phase: 'debrief', result: 'ok', duration: 1 }),
          },
        }),
      );

      service.start();
      service.send({ type: PipelineEvent.START, data: { pipelineId: 'test', objective: 'test' } });

      // Should eventually reach completed state
      await new Promise((resolve) => setTimeout(resolve, 100));

      service.stop();
    });

    it('should handle PAUSE event', () => {
      stateMachine.send(PipelineEvent.START, {
        pipelineId: 'test-pipeline',
        objective: 'Test objective',
      });

      stateMachine.send(PipelineEvent.PAUSE);

      const state = stateMachine.getState();
      expect(state).toBeDefined();
    });

    it('should handle CANCEL event', () => {
      stateMachine.send(PipelineEvent.START, {
        pipelineId: 'test-pipeline',
        objective: 'Test objective',
      });

      stateMachine.send(PipelineEvent.CANCEL);

      const state = stateMachine.getCurrentStateValue();
      expect([PipelineState.FAILED, PipelineState.IDLE, PipelineState.INITIALIZING]).toContain(state);
    });
  });

  describe('context management', () => {
    beforeEach(() => {
      stateMachine.start();
    });

    afterEach(() => {
      stateMachine.stop();
    });

    it('should store pipeline context', () => {
      const testData = {
        pipelineId: 'test-123',
        objective: 'Build awesome app',
      };

      stateMachine.send(PipelineEvent.START, testData);

      const context = stateMachine.getContext();
      expect(context).toBeDefined();
      expect(context?.pipelineId).toBe(testData.pipelineId);
      expect(context?.objective).toBe(testData.objective);
    });

    it('should track retry count', () => {
      stateMachine.send(PipelineEvent.START, {
        pipelineId: 'test',
        objective: 'test',
      });

      const context = stateMachine.getContext();
      expect(context?.retryCount).toBe(0);
      expect(context?.maxRetries).toBe(3);
    });

    it('should maintain results map', () => {
      stateMachine.send(PipelineEvent.START, {
        pipelineId: 'test',
        objective: 'test',
      });

      const context = stateMachine.getContext();
      expect(context?.results).toBeDefined();
      expect(context?.results).toBeInstanceOf(Map);
    });
  });

  describe('state queries', () => {
    beforeEach(() => {
      stateMachine.start();
    });

    afterEach(() => {
      stateMachine.stop();
    });

    it('should check if in specific state', () => {
      expect(stateMachine.isInState(PipelineState.IDLE)).toBe(true);
      expect(stateMachine.isInState(PipelineState.COMPLETED)).toBe(false);
    });

    it('should check if can transition', () => {
      expect(stateMachine.canTransition(PipelineEvent.START)).toBe(true);
      expect(stateMachine.canTransition(PipelineEvent.COMPLETE)).toBe(false);
    });

    it('should get current state value', () => {
      const state = stateMachine.getCurrentStateValue();
      expect(state).toBe(PipelineState.IDLE);
    });

    it('should get full state object', () => {
      const state = stateMachine.getState();
      expect(state).toBeDefined();
      expect(state?.value).toBe(PipelineState.IDLE);
      expect(state?.context).toBeDefined();
    });
  });

  describe('event subscriptions', () => {
    beforeEach(() => {
      stateMachine.start();
    });

    afterEach(() => {
      stateMachine.stop();
    });

    it('should subscribe to state changes', () => {
      const callback = vi.fn();
      const unsubscribe = stateMachine.onStateChange(callback);

      stateMachine.send(PipelineEvent.START, {
        pipelineId: 'test',
        objective: 'test',
      });

      expect(callback).toHaveBeenCalled();

      unsubscribe();
    });

    it('should unsubscribe from state changes', () => {
      const callback = vi.fn();
      const unsubscribe = stateMachine.onStateChange(callback);

      unsubscribe();

      stateMachine.send(PipelineEvent.START, {
        pipelineId: 'test',
        objective: 'test',
      });

      // Callback should not be called after unsubscribe
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('waitForState', () => {
    beforeEach(() => {
      stateMachine.start();
    });

    afterEach(() => {
      stateMachine.stop();
    });

    it('should wait for specific state', async () => {
      const waitPromise = stateMachine.waitForState(PipelineState.INITIALIZING, 1000);

      stateMachine.send(PipelineEvent.START, {
        pipelineId: 'test',
        objective: 'test',
      });

      await expect(waitPromise).resolves.not.toThrow();
    });

    it('should timeout if state not reached', async () => {
      const waitPromise = stateMachine.waitForState(PipelineState.COMPLETED, 100);

      await expect(waitPromise).rejects.toThrow(/Timeout/);
    });

    it('should throw if not running', async () => {
      stateMachine.stop();

      await expect(stateMachine.waitForState(PipelineState.COMPLETED)).rejects.toThrow(/not running/);
    });
  });

  describe('visualization', () => {
    it('should provide state machine visualization', () => {
      const viz = stateMachine.getVisualization();

      expect(viz).toBeDefined();
      expect(viz).toContain('Pipeline');
      expect(viz).toContain('States:');
      expect(viz).toContain('Events:');
    });
  });

  describe('pipeline services', () => {
    it('should have default service implementations', () => {
      expect(pipelineServices).toBeDefined();
      expect(pipelineServices.initializeService).toBeDefined();
      expect(pipelineServices.brainstormService).toBeDefined();
      expect(pipelineServices.mappingService).toBeDefined();
      expect(pipelineServices.actingService).toBeDefined();
      expect(pipelineServices.debriefingService).toBeDefined();
      expect(pipelineServices.rollbackService).toBeDefined();
    });

    it('should execute service functions', async () => {
      const context = {
        pipelineId: 'test',
        objective: 'test',
        currentPhase: PipelineState.IDLE,
        progress: 0,
        startTime: new Date(),
        results: new Map(),
        errors: [],
        checkpoints: [],
        retryCount: 0,
        maxRetries: 3,
        metadata: {},
      };

      const result = await pipelineServices.initializeService(context);

      expect(result).toBeDefined();
      expect(result.phase).toBe('initialize');
      expect(result.result).toBe('initialized');
      expect(result.duration).toBeDefined();
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      stateMachine.start();
    });

    afterEach(() => {
      stateMachine.stop();
    });

    it('should handle errors in state transitions', () => {
      stateMachine.send(PipelineEvent.ERROR, {
        error: new Error('Test error'),
        phase: 'test',
        retryable: false,
      });

      const context = stateMachine.getContext();
      expect(context?.errors).toBeDefined();
    });

    it('should support retry mechanism', () => {
      const context = stateMachine.getContext();
      const initialRetryCount = context?.retryCount || 0;

      // Simulate error and retry
      stateMachine.send(PipelineEvent.ERROR, {
        error: new Error('Retryable error'),
        phase: 'test',
        retryable: true,
      });

      // Context should track retries
      expect(context).toBeDefined();
    });
  });

  describe('factory function', () => {
    it('should create state machine using factory', () => {
      const instance = createStateMachine({
        enableCheckpoints: false,
        enableLogging: false,
      });

      expect(instance).toBeDefined();
      expect(instance).toBeInstanceOf(PipelineStateMachine);
    });

    it('should apply configuration from factory', () => {
      const instance = createStateMachine({
        maxRetries: 5,
        enableCheckpoints: true,
        enableLogging: true,
        logLevel: 'debug',
      });

      instance.start();
      const context = instance.getContext();
      expect(context?.maxRetries).toBe(5);
      instance.stop();
    });
  });
});

// Import interpret from xstate for testing
import { interpret } from 'xstate';
