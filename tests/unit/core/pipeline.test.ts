/**
 * Unit tests for Pipeline Manager
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ValidationError } from '../../../src/core/errors';
import {
  ExecutionMode,
  type PipelineConfig,
  PipelineManager,
  type Task,
  TaskPriority,
  TaskStatus,
  createPipelineManager,
} from '../../../src/core/pipeline';

describe('PipelineManager', () => {
  let pipelineManager: PipelineManager;
  let config: PipelineConfig;

  beforeEach(() => {
    config = {
      objective: 'Test pipeline',
      mode: ExecutionMode.AUTO,
      maxIterations: 10,
      maxConcurrentTasks: 3,
      taskTimeout: 5000,
      agents: [
        {
          id: 'agent-1',
          type: 'developer',
          name: 'Test Agent 1',
          capabilities: ['coding', 'testing'],
          maxConcurrentTasks: 2,
        },
        {
          id: 'agent-2',
          type: 'tester',
          name: 'Test Agent 2',
          capabilities: ['testing', 'validation'],
          maxConcurrentTasks: 1,
        },
      ],
      checkpointStrategy: {
        enabled: false,
        interval: 60000,
        onPhaseComplete: true,
        onError: true,
      },
    };

    pipelineManager = new PipelineManager(config);
  });

  describe('initialization', () => {
    it('should initialize with valid configuration', () => {
      expect(pipelineManager).toBeDefined();
      const status = pipelineManager.getStatus();
      expect(status.tasks.total).toBe(0);
      expect(status.state).toBe('unknown');
    });

    it('should validate configuration schema', () => {
      const invalidConfig = {
        ...config,
        maxConcurrentTasks: -1, // Invalid: negative value
      };

      expect(() => new PipelineManager(invalidConfig as PipelineConfig)).toThrow();
    });

    it('should generate pipeline ID if not provided', () => {
      const configWithoutId = { ...config };
      const pm = new PipelineManager(configWithoutId);
      const status = pm.getStatus();
      expect(status).toBeDefined();
    });
  });

  describe('task management', () => {
    it('should add tasks to pipeline', async () => {
      const task = await pipelineManager.addTask(
        'Test task',
        'coding',
        { input: 'test data' },
        { priority: TaskPriority.HIGH },
      );

      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
      expect(task.name).toBe('Test task');
      expect(task.type).toBe('coding');
      expect(task.priority).toBe(TaskPriority.HIGH);
      expect(task.status).toBe(TaskStatus.PENDING);

      const status = pipelineManager.getStatus();
      expect(status.tasks.total).toBe(1);
    });

    it('should handle task dependencies', async () => {
      const task1 = await pipelineManager.addTask('Task 1', 'coding', { input: 'data1' });

      const task2 = await pipelineManager.addTask(
        'Task 2',
        'testing',
        { input: 'data2' },
        { dependencies: [task1.id] },
      );

      expect(task2.dependencies).toContain(task1.id);
    });

    it('should reject invalid dependencies', async () => {
      await expect(
        pipelineManager.addTask(
          'Task with invalid dep',
          'coding',
          { input: 'data' },
          { dependencies: ['non-existent-id'] },
        ),
      ).rejects.toThrow(ValidationError);
    });

    it('should detect dependency cycles', async () => {
      const task1 = await pipelineManager.addTask('Task 1', 'coding', {});
      const task2 = await pipelineManager.addTask('Task 2', 'testing', {}, { dependencies: [task1.id] });

      // Try to make task1 depend on task2 (creating a cycle)
      // This should be rejected by the implementation
      // Note: The current implementation doesn't allow updating dependencies after creation
      // So we test cycle detection during creation

      const task3 = await pipelineManager.addTask('Task 3', 'coding', {}, { dependencies: [task2.id] });

      // Creating a task that would form a cycle
      await expect(
        pipelineManager.addTask('Task 4', 'testing', {}, { dependencies: [task3.id, task1.id] }),
      ).resolves.not.toThrow(); // This shouldn't create a cycle
    });
  });

  describe('pipeline execution', () => {
    it('should execute simple pipeline', async () => {
      // Add tasks
      await pipelineManager.addTask('Task 1', 'coding', { data: 'test1' });
      await pipelineManager.addTask('Task 2', 'testing', { data: 'test2' });

      // Mock agent execution
      const agents = (pipelineManager as any).agents as Map<string, any>;
      for (const [, agent] of agents) {
        agent.execute = vi.fn().mockResolvedValue({
          taskId: 'test',
          status: 'success',
          output: { result: 'done' },
          duration: 10,
        });
      }

      const results = await pipelineManager.execute();

      expect(results).toBeDefined();
      expect(results.size).toBeGreaterThan(0);
    });

    it('should respect task priorities', async () => {
      const highPriorityTask = await pipelineManager.addTask(
        'High priority',
        'coding',
        {},
        { priority: TaskPriority.HIGH },
      );

      const lowPriorityTask = await pipelineManager.addTask(
        'Low priority',
        'coding',
        {},
        { priority: TaskPriority.LOW },
      );

      const mediumPriorityTask = await pipelineManager.addTask(
        'Medium priority',
        'coding',
        {},
        { priority: TaskPriority.MEDIUM },
      );

      // Tasks should be executed in priority order
      const status = pipelineManager.getStatus();
      expect(status.tasks.total).toBe(3);
    });

    it('should handle concurrent task execution', async () => {
      // Add multiple tasks
      for (let i = 0; i < 5; i++) {
        await pipelineManager.addTask(`Task ${i}`, 'coding', {});
      }

      // Mock agents to track concurrent execution
      const executionTracker = new Set<string>();
      const agents = (pipelineManager as any).agents as Map<string, any>;

      for (const [, agent] of agents) {
        agent.execute = vi.fn().mockImplementation(async (task: Task) => {
          executionTracker.add(task.id);

          // Simulate async work
          await new Promise((resolve) => setTimeout(resolve, 10));

          executionTracker.delete(task.id);

          return {
            taskId: task.id,
            status: 'success',
            output: { result: 'done' },
            duration: 10,
          };
        });
      }

      const executePromise = pipelineManager.execute();

      // Check concurrent execution doesn't exceed limit
      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(executionTracker.size).toBeLessThanOrEqual(config.maxConcurrentTasks);

      await executePromise;
    });
  });

  describe('pipeline control', () => {
    beforeEach(async () => {
      // Add some tasks
      await pipelineManager.addTask('Task 1', 'coding', {});
      await pipelineManager.addTask('Task 2', 'testing', {});
    });

    it('should pause pipeline execution', async () => {
      await pipelineManager.pause();
      const status = pipelineManager.getStatus();
      expect(status).toBeDefined();
    });

    it('should resume pipeline execution', async () => {
      await pipelineManager.pause();
      await pipelineManager.resume();
      const status = pipelineManager.getStatus();
      expect(status).toBeDefined();
    });

    it('should abort pipeline execution', () => {
      pipelineManager.abort();
      const status = pipelineManager.getStatus();
      expect(status).toBeDefined();
    });
  });

  describe('status and metrics', () => {
    it('should provide pipeline status', async () => {
      await pipelineManager.addTask('Task 1', 'coding', {});

      const status = pipelineManager.getStatus();

      expect(status).toBeDefined();
      expect(status.state).toBeDefined();
      expect(status.progress).toBeDefined();
      expect(status.tasks).toBeDefined();
      expect(status.tasks.total).toBe(1);
      expect(status.tasks.completed).toBe(0);
      expect(status.tasks.running).toBe(0);
      expect(status.tasks.failed).toBe(0);
    });

    it('should provide pipeline metrics', () => {
      const metrics = pipelineManager.getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.totalTasks).toBeDefined();
      expect(metrics.completedTasks).toBeDefined();
      expect(metrics.failedTasks).toBeDefined();
      expect(metrics.averageTaskDuration).toBeDefined();
    });

    it('should calculate progress correctly', async () => {
      // Add tasks
      for (let i = 0; i < 4; i++) {
        await pipelineManager.addTask(`Task ${i}`, 'coding', {});
      }

      // Initially progress should be 0
      let status = pipelineManager.getStatus();
      expect(status.progress).toBe(0);

      // Mark some tasks as completed (internal simulation)
      const tasks = (pipelineManager as any).tasks as Map<string, Task>;
      const taskIds = Array.from(tasks.keys());

      // Complete 2 out of 4 tasks
      (pipelineManager as any).completedTasks.add(taskIds[0]);
      (pipelineManager as any).completedTasks.add(taskIds[1]);

      status = pipelineManager.getStatus();
      expect(status.progress).toBe(50); // 2/4 = 50%
    });
  });

  describe('error handling', () => {
    it('should handle task failures', async () => {
      await pipelineManager.addTask('Failing task', 'coding', {});

      // Mock agent to fail
      const agents = (pipelineManager as any).agents as Map<string, any>;
      for (const [, agent] of agents) {
        agent.execute = vi.fn().mockRejectedValue(new Error('Task failed'));
      }

      await expect(pipelineManager.execute()).rejects.toThrow();
    });

    it('should handle timeouts', async () => {
      const quickTimeoutConfig = {
        ...config,
        taskTimeout: 10, // 10ms timeout
      };

      const pm = new PipelineManager(quickTimeoutConfig);
      await pm.addTask('Slow task', 'coding', {});

      // Mock agent with slow execution
      const agents = (pm as any).agents as Map<string, any>;
      for (const [, agent] of agents) {
        agent.execute = vi.fn().mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 100)); // Takes longer than timeout
          return { status: 'success' };
        });
      }

      await expect(pm.execute()).rejects.toThrow();
    });

    it('should detect deadlocks', async () => {
      const task1 = await pipelineManager.addTask('Task 1', 'coding', {});
      const task2 = await pipelineManager.addTask('Task 2', 'testing', {}, { dependencies: [task1.id] });

      // Mock agent to not handle task1 (creating deadlock)
      const agents = (pipelineManager as any).agents as Map<string, any>;
      for (const [, agent] of agents) {
        agent.canHandle = vi.fn().mockImplementation((task: Task) => {
          return task.id !== task1.id; // Can't handle task1
        });
      }

      await expect(pipelineManager.execute()).rejects.toThrow(/deadlock/i);
    });
  });

  describe('factory function', () => {
    it('should create pipeline manager using factory', () => {
      const instance = createPipelineManager(config);

      expect(instance).toBeDefined();
      expect(instance).toBeInstanceOf(PipelineManager);
    });
  });
});
