/**
 * Checkpoint management system for pipeline state persistence
 * Handles saving, loading, and rotation of checkpoint files
 */

import * as path from 'path';
import { promisify } from 'util';
import * as zlib from 'zlib';
import * as fs from 'fs/promises';
import { createLogger } from '../utils/logger';
import { CheckpointError } from './errors';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

/**
 * Checkpoint data structure
 */
export interface CheckpointData {
  id: string;
  pipelineId: string;
  timestamp: Date;
  version: string;
  state: {
    phase: string;
    status: string;
    progress: number;
    context: Record<string, unknown>;
  };
  tasks: {
    completed: string[];
    inProgress: string[];
    pending: string[];
    failed: string[];
  };
  artifacts: Record<string, unknown>;
  metrics: {
    startTime: Date;
    duration: number;
    resourceUsage?: {
      cpu: number;
      memory: number;
      disk: number;
    };
  };
  metadata?: Record<string, unknown>;
}

/**
 * Checkpoint configuration
 */
export interface CheckpointConfig {
  baseDir?: string;
  maxCheckpoints?: number;
  compressionEnabled?: boolean;
  compressionLevel?: number;
  autoRotate?: boolean;
  rotationSize?: number; // in MB
  retentionDays?: number;
  filePrefix?: string;
}

/**
 * Checkpoint info for listing
 */
export interface CheckpointInfo {
  id: string;
  pipelineId: string;
  timestamp: Date;
  filepath: string;
  size: number;
  compressed: boolean;
}

/**
 * Checkpoint manager class
 */
export class CheckpointManager {
  private logger;
  private config: Required<CheckpointConfig>;
  private checkpointDir: string;

  constructor(config?: CheckpointConfig) {
    this.config = {
      baseDir: '.kilo',
      maxCheckpoints: 10,
      compressionEnabled: true,
      compressionLevel: 6,
      autoRotate: true,
      rotationSize: 100, // 100 MB
      retentionDays: 30,
      filePrefix: 'checkpoint',
      ...config,
    };

    this.checkpointDir = path.join(this.config.baseDir, 'checkpoints');
    this.logger = createLogger('checkpoint-manager');
  }

  /**
   * Initialize checkpoint directory
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.checkpointDir, { recursive: true });
      this.logger.info(`Checkpoint directory initialized at ${this.checkpointDir}`);

      // Clean up old checkpoints on initialization
      if (this.config.autoRotate) {
        await this.rotateCheckpoints();
      }
    } catch (error) {
      throw new CheckpointError(
        `Failed to initialize checkpoint directory: ${(error as Error).message}`,
        undefined,
        'save',
        true,
        { dir: this.checkpointDir },
      );
    }
  }

  /**
   * Save a checkpoint
   */
  async save(data: CheckpointData): Promise<string> {
    const checkpointId = this.generateCheckpointId(data.pipelineId);
    const filename = this.getCheckpointFilename(checkpointId, data.pipelineId);
    const filepath = path.join(this.checkpointDir, filename);

    try {
      this.logger.debug(`Saving checkpoint ${checkpointId} to ${filepath}`);

      // Prepare checkpoint data
      const checkpointData = {
        ...data,
        id: checkpointId,
        timestamp: new Date(),
        version: '1.0.0',
      };

      // Convert to JSON
      let content = Buffer.from(JSON.stringify(checkpointData, null, 2));

      // Compress if enabled
      if (this.config.compressionEnabled) {
        content = await gzip(content, { level: this.config.compressionLevel });
      }

      // Write to file
      await fs.writeFile(filepath, content);

      // Get file stats for logging
      const stats = await fs.stat(filepath);
      this.logger.info(`Checkpoint ${checkpointId} saved successfully`, {
        size: stats.size,
        compressed: this.config.compressionEnabled,
        filepath,
      });

      // Rotate if needed
      if (this.config.autoRotate) {
        await this.rotateCheckpoints();
      }

      return checkpointId;
    } catch (error) {
      throw new CheckpointError(`Failed to save checkpoint: ${(error as Error).message}`, checkpointId, 'save', true, {
        filepath,
      });
    }
  }

  /**
   * Load a checkpoint
   */
  async load(checkpointId: string): Promise<CheckpointData> {
    try {
      this.logger.debug(`Loading checkpoint ${checkpointId}`);

      // Find checkpoint file
      const checkpointFile = await this.findCheckpointFile(checkpointId);
      if (!checkpointFile) {
        throw new Error(`Checkpoint ${checkpointId} not found`);
      }

      const filepath = path.join(this.checkpointDir, checkpointFile);

      // Read file
      let content = await fs.readFile(filepath);

      // Decompress if needed
      if (this.isCompressedFile(checkpointFile)) {
        content = await gunzip(content);
      }

      // Parse JSON
      const data = JSON.parse(content.toString()) as CheckpointData;

      // Convert date strings back to Date objects
      data.timestamp = new Date(data.timestamp);
      data.metrics.startTime = new Date(data.metrics.startTime);

      this.logger.info(`Checkpoint ${checkpointId} loaded successfully`);
      return data;
    } catch (error) {
      throw new CheckpointError(`Failed to load checkpoint: ${(error as Error).message}`, checkpointId, 'load', true);
    }
  }

  /**
   * Delete a checkpoint
   */
  async delete(checkpointId: string): Promise<void> {
    try {
      this.logger.debug(`Deleting checkpoint ${checkpointId}`);

      const checkpointFile = await this.findCheckpointFile(checkpointId);
      if (!checkpointFile) {
        this.logger.warn(`Checkpoint ${checkpointId} not found for deletion`);
        return;
      }

      const filepath = path.join(this.checkpointDir, checkpointFile);
      await fs.unlink(filepath);

      this.logger.info(`Checkpoint ${checkpointId} deleted successfully`);
    } catch (error) {
      throw new CheckpointError(
        `Failed to delete checkpoint: ${(error as Error).message}`,
        checkpointId,
        'delete',
        true,
      );
    }
  }

  /**
   * List all checkpoints
   */
  async list(pipelineId?: string): Promise<CheckpointInfo[]> {
    try {
      const files = await fs.readdir(this.checkpointDir);
      const checkpoints: CheckpointInfo[] = [];

      for (const file of files) {
        if (!this.isCheckpointFile(file)) {
          continue;
        }

        // Filter by pipeline ID if provided
        if (pipelineId && !file.includes(pipelineId)) {
          continue;
        }

        const filepath = path.join(this.checkpointDir, file);
        const stats = await fs.stat(filepath);

        // Parse checkpoint info from filename
        const info = this.parseCheckpointFilename(file);
        if (info) {
          checkpoints.push({
            ...info,
            filepath,
            size: stats.size,
            compressed: this.isCompressedFile(file),
          });
        }
      }

      // Sort by timestamp (newest first)
      checkpoints.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      return checkpoints;
    } catch (error) {
      throw new CheckpointError(`Failed to list checkpoints: ${(error as Error).message}`, undefined, 'load', true);
    }
  }

  /**
   * Get the latest checkpoint for a pipeline
   */
  async getLatest(pipelineId: string): Promise<CheckpointData | null> {
    try {
      const checkpoints = await this.list(pipelineId);

      if (checkpoints.length === 0) {
        this.logger.info(`No checkpoints found for pipeline ${pipelineId}`);
        return null;
      }

      // Try to load the latest checkpoint
      for (const checkpoint of checkpoints) {
        try {
          return await this.load(checkpoint.id);
        } catch (error) {
          this.logger.warn(`Failed to load checkpoint ${checkpoint.id}, trying next`, {
            error: (error as Error).message,
          });
        }
      }

      return null;
    } catch (error) {
      throw new CheckpointError(
        `Failed to get latest checkpoint: ${(error as Error).message}`,
        undefined,
        'load',
        true,
        { pipelineId },
      );
    }
  }

  /**
   * Rotate old checkpoints
   */
  async rotateCheckpoints(): Promise<void> {
    try {
      this.logger.debug('Starting checkpoint rotation');

      const checkpoints = await this.list();

      // Remove checkpoints exceeding max count
      if (checkpoints.length > this.config.maxCheckpoints) {
        const toDelete = checkpoints.slice(this.config.maxCheckpoints);

        for (const checkpoint of toDelete) {
          await this.delete(checkpoint.id);
          this.logger.info(`Rotated old checkpoint ${checkpoint.id}`);
        }
      }

      // Remove checkpoints older than retention days
      const retentionDate = new Date();
      retentionDate.setDate(retentionDate.getDate() - this.config.retentionDays);

      for (const checkpoint of checkpoints) {
        if (checkpoint.timestamp < retentionDate) {
          await this.delete(checkpoint.id);
          this.logger.info(`Rotated expired checkpoint ${checkpoint.id}`, { age: `${this.config.retentionDays} days` });
        }
      }

      // Check total size and remove oldest if exceeding limit
      const totalSize = checkpoints.reduce((sum, cp) => sum + cp.size, 0);
      const maxSize = this.config.rotationSize * 1024 * 1024; // Convert MB to bytes

      if (totalSize > maxSize) {
        let currentSize = totalSize;
        const sortedByAge = [...checkpoints].reverse(); // Oldest first

        for (const checkpoint of sortedByAge) {
          if (currentSize <= maxSize) {
            break;
          }

          await this.delete(checkpoint.id);
          currentSize -= checkpoint.size;
          this.logger.info(`Rotated checkpoint ${checkpoint.id} due to size limit`, {
            totalSize: `${(totalSize / 1024 / 1024).toFixed(2)}MB`,
          });
        }
      }

      this.logger.debug('Checkpoint rotation completed');
    } catch (error) {
      this.logger.error('Failed to rotate checkpoints', error);
      // Don't throw - rotation failure shouldn't stop normal operations
    }
  }

  /**
   * Clear all checkpoints
   */
  async clearAll(): Promise<void> {
    try {
      const checkpoints = await this.list();

      for (const checkpoint of checkpoints) {
        await this.delete(checkpoint.id);
      }

      this.logger.info(`Cleared ${checkpoints.length} checkpoints`);
    } catch (error) {
      throw new CheckpointError(`Failed to clear checkpoints: ${(error as Error).message}`, undefined, 'delete', false);
    }
  }

  /**
   * Validate a checkpoint
   */
  async validate(checkpointId: string): Promise<boolean> {
    try {
      const data = await this.load(checkpointId);

      // Basic validation checks
      if (!data.id || !data.pipelineId || !data.timestamp) {
        return false;
      }

      if (!data.state || !data.tasks || !data.metrics) {
        return false;
      }

      if (!data.version) {
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(`Checkpoint ${checkpointId} validation failed`, error);
      return false;
    }
  }

  /**
   * Export checkpoint to external file
   */
  async export(checkpointId: string, outputPath: string): Promise<void> {
    try {
      const data = await this.load(checkpointId);
      const content = JSON.stringify(data, null, 2);

      await fs.writeFile(outputPath, content, 'utf8');
      this.logger.info(`Checkpoint ${checkpointId} exported to ${outputPath}`);
    } catch (error) {
      throw new CheckpointError(
        `Failed to export checkpoint: ${(error as Error).message}`,
        checkpointId,
        'save',
        false,
        { outputPath },
      );
    }
  }

  /**
   * Import checkpoint from external file
   */
  async import(inputPath: string): Promise<string> {
    try {
      const content = await fs.readFile(inputPath, 'utf8');
      const data = JSON.parse(content) as CheckpointData;

      // Override ID to avoid conflicts
      data.id = this.generateCheckpointId(data.pipelineId);

      const checkpointId = await this.save(data);
      this.logger.info(`Checkpoint imported from ${inputPath} as ${checkpointId}`);

      return checkpointId;
    } catch (error) {
      throw new CheckpointError(`Failed to import checkpoint: ${(error as Error).message}`, undefined, 'load', false, {
        inputPath,
      });
    }
  }

  /**
   * Generate checkpoint ID
   */
  private generateCheckpointId(pipelineId: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const shortId = Math.random().toString(36).substring(2, 8);
    return `${timestamp}_${pipelineId}_${shortId}`;
  }

  /**
   * Get checkpoint filename
   */
  private getCheckpointFilename(checkpointId: string, pipelineId: string): string {
    const base = `${this.config.filePrefix}_${checkpointId}`;
    return this.config.compressionEnabled ? `${base}.json.gz` : `${base}.json`;
  }

  /**
   * Check if file is a checkpoint file
   */
  private isCheckpointFile(filename: string): boolean {
    return filename.startsWith(this.config.filePrefix) && (filename.endsWith('.json') || filename.endsWith('.json.gz'));
  }

  /**
   * Check if file is compressed
   */
  private isCompressedFile(filename: string): boolean {
    return filename.endsWith('.gz');
  }

  /**
   * Parse checkpoint info from filename
   */
  private parseCheckpointFilename(filename: string): Omit<CheckpointInfo, 'filepath' | 'size' | 'compressed'> | null {
    try {
      // Remove prefix and extension
      let name = filename.replace(this.config.filePrefix + '_', '');
      name = name.replace('.json.gz', '').replace('.json', '');

      // Parse components: timestamp_pipelineId_shortId
      const parts = name.split('_');
      if (parts.length < 3) {
        return null;
      }

      // Reconstruct timestamp
      const timestampStr = parts[0].replace(/-/g, ':');
      const timestamp = new Date(timestampStr);

      // Extract pipeline ID (everything except first and last part)
      const pipelineId = parts.slice(1, -1).join('_');

      return {
        id: name,
        pipelineId,
        timestamp,
      };
    } catch (error) {
      this.logger.warn(`Failed to parse checkpoint filename: ${filename}`, error);
      return null;
    }
  }

  /**
   * Find checkpoint file by ID
   */
  private async findCheckpointFile(checkpointId: string): Promise<string | null> {
    try {
      const files = await fs.readdir(this.checkpointDir);

      for (const file of files) {
        if (file.includes(checkpointId)) {
          return file;
        }
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to find checkpoint file for ${checkpointId}`, error);
      return null;
    }
  }
}

/**
 * Create a singleton instance
 */
let instance: CheckpointManager | null = null;

/**
 * Get or create checkpoint manager instance
 */
export function getCheckpointManager(config?: CheckpointConfig): CheckpointManager {
  if (!instance) {
    instance = new CheckpointManager(config);
  }
  return instance;
}

/**
 * Reset checkpoint manager instance (for testing)
 */
export function resetCheckpointManager(): void {
  instance = null;
}
