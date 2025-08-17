/**
 * Unit tests for Checkpoint Manager
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type CheckpointConfig,
  type CheckpointData,
  CheckpointInfo,
  CheckpointManager,
  getCheckpointManager,
  resetCheckpointManager,
} from '../../../src/core/checkpoint';
import { CheckpointError } from '../../../src/core/errors';

// Mock fs module
vi.mock('fs/promises', () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  readFile: vi.fn(),
  unlink: vi.fn(),
  readdir: vi.fn(),
  stat: vi.fn(),
}));

describe('CheckpointManager', () => {
  let checkpointManager: CheckpointManager;
  let config: CheckpointConfig;
  const testCheckpointDir = '/test/.kilo/checkpoints';

  beforeEach(() => {
    config = {
      baseDir: '/test/.kilo',
      maxCheckpoints: 5,
      compressionEnabled: false,
      autoRotate: true,
      retentionDays: 7,
      filePrefix: 'test-checkpoint',
    };

    checkpointManager = new CheckpointManager(config);

    // Mock fs methods
    (fs.mkdir as any).mockResolvedValue(undefined);
    (fs.writeFile as any).mockResolvedValue(undefined);
    (fs.readFile as any).mockResolvedValue(Buffer.from('{}'));
    (fs.unlink as any).mockResolvedValue(undefined);
    (fs.readdir as any).mockResolvedValue([]);
    (fs.stat as any).mockResolvedValue({ size: 1024 });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize checkpoint directory', async () => {
      await checkpointManager.initialize();

      expect(fs.mkdir).toHaveBeenCalledWith(path.join(config.baseDir!, 'checkpoints'), { recursive: true });
    });

    it('should handle initialization errors', async () => {
      (fs.mkdir as any).mockRejectedValue(new Error('Permission denied'));

      await expect(checkpointManager.initialize()).rejects.toThrow(CheckpointError);
    });

    it('should rotate checkpoints on initialization if enabled', async () => {
      const oldCheckpoints = [
        'test-checkpoint_2024-01-01T00-00-00-000Z_pipeline1_abc123.json',
        'test-checkpoint_2024-01-02T00-00-00-000Z_pipeline1_def456.json',
      ];

      (fs.readdir as any).mockResolvedValue(oldCheckpoints);

      await checkpointManager.initialize();

      expect(fs.readdir).toHaveBeenCalled();
    });
  });

  describe('save checkpoint', () => {
    const testData: CheckpointData = {
      id: 'test-id',
      pipelineId: 'pipeline-123',
      timestamp: new Date(),
      version: '1.0.0',
      state: {
        phase: 'testing',
        status: 'active',
        progress: 50,
        context: { test: 'data' },
      },
      tasks: {
        completed: ['task1'],
        inProgress: ['task2'],
        pending: ['task3'],
        failed: [],
      },
      artifacts: { artifact1: 'value1' },
      metrics: {
        startTime: new Date(),
        duration: 1000,
      },
    };

    beforeEach(async () => {
      await checkpointManager.initialize();
    });

    it('should save checkpoint data', async () => {
      const checkpointId = await checkpointManager.save(testData);

      expect(checkpointId).toBeDefined();
      expect(fs.writeFile).toHaveBeenCalled();

      const [filePath, content] = (fs.writeFile as any).mock.calls[0];
      expect(filePath).toContain('test-checkpoint');
      expect(filePath).toContain(testData.pipelineId);
    });

    it('should compress checkpoint if enabled', async () => {
      const compressedConfig = {
        ...config,
        compressionEnabled: true,
      };

      const cm = new CheckpointManager(compressedConfig);
      await cm.initialize();

      const checkpointId = await cm.save(testData);

      expect(checkpointId).toBeDefined();
      const [filePath] = (fs.writeFile as any).mock.calls[0];
      expect(filePath).toContain('.json.gz');
    });

    it('should handle save errors', async () => {
      (fs.writeFile as any).mockRejectedValue(new Error('Disk full'));

      await expect(checkpointManager.save(testData)).rejects.toThrow(CheckpointError);
    });

    it('should trigger rotation after save', async () => {
      // Create multiple checkpoints to trigger rotation
      for (let i = 0; i < 6; i++) {
        await checkpointManager.save(testData);
      }

      // Should have called readdir to check existing checkpoints
      expect(fs.readdir).toHaveBeenCalled();
    });
  });

  describe('load checkpoint', () => {
    const checkpointId = '2024-01-01T00-00-00-000Z_pipeline-123_abc123';
    const checkpointFile = `test-checkpoint_${checkpointId}.json`;
    const checkpointData: CheckpointData = {
      id: checkpointId,
      pipelineId: 'pipeline-123',
      timestamp: new Date(),
      version: '1.0.0',
      state: {
        phase: 'testing',
        status: 'active',
        progress: 50,
        context: {},
      },
      tasks: {
        completed: [],
        inProgress: [],
        pending: [],
        failed: [],
      },
      artifacts: {},
      metrics: {
        startTime: new Date(),
        duration: 1000,
      },
    };

    beforeEach(async () => {
      await checkpointManager.initialize();
      (fs.readdir as any).mockResolvedValue([checkpointFile]);
      (fs.readFile as any).mockResolvedValue(Buffer.from(JSON.stringify(checkpointData)));
    });

    it('should load checkpoint by ID', async () => {
      const loaded = await checkpointManager.load(checkpointId);

      expect(loaded).toBeDefined();
      expect(loaded.id).toBe(checkpointId);
      expect(loaded.pipelineId).toBe('pipeline-123');
    });

    it('should handle checkpoint not found', async () => {
      (fs.readdir as any).mockResolvedValue([]);

      await expect(checkpointManager.load('non-existent')).rejects.toThrow(CheckpointError);
    });

    it('should handle corrupted checkpoint data', async () => {
      (fs.readFile as any).mockResolvedValue(Buffer.from('invalid json'));

      await expect(checkpointManager.load(checkpointId)).rejects.toThrow();
    });

    it('should decompress compressed checkpoints', async () => {
      const compressedFile = `test-checkpoint_${checkpointId}.json.gz`;
      (fs.readdir as any).mockResolvedValue([compressedFile]);

      // Mock compressed data (in real scenario, this would be gzipped)
      (fs.readFile as any).mockResolvedValue(Buffer.from(JSON.stringify(checkpointData)));

      const loaded = await checkpointManager.load(checkpointId);
      expect(loaded).toBeDefined();
    });
  });

  describe('delete checkpoint', () => {
    const checkpointId = '2024-01-01T00-00-00-000Z_pipeline-123_abc123';
    const checkpointFile = `test-checkpoint_${checkpointId}.json`;

    beforeEach(async () => {
      await checkpointManager.initialize();
      (fs.readdir as any).mockResolvedValue([checkpointFile]);
    });

    it('should delete checkpoint by ID', async () => {
      await checkpointManager.delete(checkpointId);

      expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining(checkpointFile));
    });

    it('should handle checkpoint not found gracefully', async () => {
      (fs.readdir as any).mockResolvedValue([]);

      await expect(checkpointManager.delete('non-existent')).resolves.not.toThrow();
    });

    it('should handle delete errors', async () => {
      (fs.unlink as any).mockRejectedValue(new Error('Permission denied'));

      await expect(checkpointManager.delete(checkpointId)).rejects.toThrow(CheckpointError);
    });
  });

  describe('list checkpoints', () => {
    const checkpoints = [
      'test-checkpoint_2024-01-01T00-00-00-000Z_pipeline1_abc123.json',
      'test-checkpoint_2024-01-02T00-00-00-000Z_pipeline1_def456.json',
      'test-checkpoint_2024-01-03T00-00-00-000Z_pipeline2_ghi789.json',
    ];

    beforeEach(async () => {
      await checkpointManager.initialize();
      (fs.readdir as any).mockResolvedValue(checkpoints);
      (fs.stat as any).mockResolvedValue({ size: 1024 });
    });

    it('should list all checkpoints', async () => {
      const list = await checkpointManager.list();

      expect(list).toHaveLength(3);
      expect(list[0]).toHaveProperty('id');
      expect(list[0]).toHaveProperty('pipelineId');
      expect(list[0]).toHaveProperty('timestamp');
      expect(list[0]).toHaveProperty('size');
    });

    it('should filter checkpoints by pipeline ID', async () => {
      const list = await checkpointManager.list('pipeline1');

      expect(list).toHaveLength(2);
      expect(list.every((cp) => cp.pipelineId === 'pipeline1')).toBe(true);
    });

    it('should sort checkpoints by timestamp (newest first)', async () => {
      const list = await checkpointManager.list();

      expect(list[0].timestamp.getTime()).toBeGreaterThanOrEqual(list[list.length - 1].timestamp.getTime());
    });

    it('should handle empty checkpoint directory', async () => {
      (fs.readdir as any).mockResolvedValue([]);

      const list = await checkpointManager.list();

      expect(list).toHaveLength(0);
    });
  });

  describe('get latest checkpoint', () => {
    const checkpoints = [
      'test-checkpoint_2024-01-01T00-00-00-000Z_pipeline1_abc123.json',
      'test-checkpoint_2024-01-03T00-00-00-000Z_pipeline1_ghi789.json',
      'test-checkpoint_2024-01-02T00-00-00-000Z_pipeline1_def456.json',
    ];

    beforeEach(async () => {
      await checkpointManager.initialize();
      (fs.readdir as any).mockResolvedValue(checkpoints);
      (fs.stat as any).mockResolvedValue({ size: 1024 });
    });

    it('should get latest checkpoint for pipeline', async () => {
      const checkpointData = {
        id: '2024-01-03T00-00-00-000Z_pipeline1_ghi789',
        pipelineId: 'pipeline1',
        timestamp: new Date('2024-01-03'),
      };

      (fs.readFile as any).mockResolvedValue(Buffer.from(JSON.stringify(checkpointData)));

      const latest = await checkpointManager.getLatest('pipeline1');

      expect(latest).toBeDefined();
      expect(latest?.id).toContain('2024-01-03');
    });

    it('should return null if no checkpoints exist', async () => {
      (fs.readdir as any).mockResolvedValue([]);

      const latest = await checkpointManager.getLatest('pipeline1');

      expect(latest).toBeNull();
    });

    it('should handle corrupted latest checkpoint', async () => {
      (fs.readFile as any).mockRejectedValue(new Error('Read error'));

      const latest = await checkpointManager.getLatest('pipeline1');

      expect(latest).toBeNull();
    });
  });

  describe('checkpoint rotation', () => {
    beforeEach(async () => {
      await checkpointManager.initialize();
    });

    it('should remove checkpoints exceeding max count', async () => {
      const oldCheckpoints = [];
      for (let i = 0; i < 10; i++) {
        oldCheckpoints.push(`test-checkpoint_2024-01-0${i}T00-00-00-000Z_pipeline1_${i}.json`);
      }

      (fs.readdir as any).mockResolvedValue(oldCheckpoints);
      (fs.stat as any).mockResolvedValue({ size: 1024 });

      await checkpointManager.rotateCheckpoints();

      // Should delete checkpoints beyond maxCheckpoints (5)
      expect(fs.unlink).toHaveBeenCalledTimes(5);
    });

    it('should remove checkpoints older than retention days', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10); // 10 days old

      const oldCheckpoint = `test-checkpoint_${oldDate.toISOString().replace(/[:.]/g, '-')}_pipeline1_old.json`;

      (fs.readdir as any).mockResolvedValue([oldCheckpoint]);
      (fs.stat as any).mockResolvedValue({ size: 1024 });

      await checkpointManager.rotateCheckpoints();

      expect(fs.unlink).toHaveBeenCalled();
    });

    it('should remove checkpoints when size limit exceeded', async () => {
      const checkpoints = [];
      for (let i = 0; i < 5; i++) {
        checkpoints.push(`test-checkpoint_2024-01-0${i}T00-00-00-000Z_pipeline1_${i}.json`);
      }

      (fs.readdir as any).mockResolvedValue(checkpoints);
      (fs.stat as any).mockResolvedValue({ size: 30 * 1024 * 1024 }); // 30MB each

      await checkpointManager.rotateCheckpoints();

      // Should delete some checkpoints to stay under size limit
      expect(fs.unlink).toHaveBeenCalled();
    });
  });

  describe('utility methods', () => {
    beforeEach(async () => {
      await checkpointManager.initialize();
    });

    it('should clear all checkpoints', async () => {
      const checkpoints = [
        'test-checkpoint_2024-01-01T00-00-00-000Z_pipeline1_abc123.json',
        'test-checkpoint_2024-01-02T00-00-00-000Z_pipeline2_def456.json',
      ];

      (fs.readdir as any).mockResolvedValue(checkpoints);
      (fs.stat as any).mockResolvedValue({ size: 1024 });

      await checkpointManager.clearAll();

      expect(fs.unlink).toHaveBeenCalledTimes(2);
    });

    it('should validate checkpoint', async () => {
      const validData = {
        id: 'test-id',
        pipelineId: 'pipeline-123',
        timestamp: new Date(),
        version: '1.0.0',
        state: { phase: 'test', status: 'active', progress: 50, context: {} },
        tasks: { completed: [], inProgress: [], pending: [], failed: [] },
        metrics: { startTime: new Date(), duration: 1000 },
      };

      (fs.readdir as any).mockResolvedValue(['test-checkpoint_test-id.json']);
      (fs.readFile as any).mockResolvedValue(Buffer.from(JSON.stringify(validData)));

      const isValid = await checkpointManager.validate('test-id');
      expect(isValid).toBe(true);
    });

    it('should export checkpoint to file', async () => {
      const checkpointData = {
        id: 'test-id',
        pipelineId: 'pipeline-123',
        timestamp: new Date(),
      };

      (fs.readdir as any).mockResolvedValue(['test-checkpoint_test-id.json']);
      (fs.readFile as any).mockResolvedValue(Buffer.from(JSON.stringify(checkpointData)));

      await checkpointManager.export('test-id', '/export/path.json');

      expect(fs.writeFile).toHaveBeenCalledWith('/export/path.json', expect.any(String), 'utf8');
    });

    it('should import checkpoint from file', async () => {
      const importData = {
        id: 'old-id',
        pipelineId: 'pipeline-123',
        timestamp: new Date(),
        version: '1.0.0',
        state: { phase: 'test', status: 'active', progress: 50, context: {} },
        tasks: { completed: [], inProgress: [], pending: [], failed: [] },
        metrics: { startTime: new Date(), duration: 1000 },
      };

      (fs.readFile as any).mockResolvedValue(Buffer.from(JSON.stringify(importData)));

      const newId = await checkpointManager.import('/import/path.json');

      expect(newId).toBeDefined();
      expect(newId).not.toBe('old-id'); // Should generate new ID
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe('singleton instance', () => {
    afterEach(() => {
      resetCheckpointManager();
    });

    it('should return same instance', () => {
      const instance1 = getCheckpointManager(config);
      const instance2 = getCheckpointManager();

      expect(instance1).toBe(instance2);
    });

    it('should reset singleton instance', () => {
      const instance1 = getCheckpointManager(config);
      resetCheckpointManager();
      const instance2 = getCheckpointManager(config);

      expect(instance1).not.toBe(instance2);
    });
  });
});
