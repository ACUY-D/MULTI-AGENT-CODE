/**
 * CLI Configuration Manager
 * Handles configuration loading from multiple sources
 */

import path from 'path';
import { createLogger } from '@utils/logger';
import fs from 'fs/promises';
import { z } from 'zod';

const logger = createLogger('cli-config');

/**
 * CLI Configuration Schema
 */
const ConfigSchema = z.object({
  // Server configuration
  server: z
    .object({
      mode: z.enum(['stdio', 'http']).default('stdio'),
      port: z.number().default(3000),
      host: z.string().default('localhost'),
    })
    .default({}),

  // Project configuration
  project: z
    .object({
      name: z.string().optional(),
      type: z.enum(['node', 'python', 'go', 'typescript']).default('typescript'),
      rootDir: z.string().default(process.cwd()),
      kiloDir: z.string().default('.kilo'),
    })
    .default({}),

  // Pipeline configuration
  pipeline: z
    .object({
      mode: z.enum(['auto', 'semi', 'dry-run']).default('semi'),
      maxRetries: z.number().default(3),
      timeout: z.number().default(300),
      checkpointInterval: z.number().default(5),
    })
    .default({}),

  // Development configuration
  dev: z
    .object({
      watch: z.boolean().default(false),
      hotReload: z.boolean().default(false),
      port: z.number().default(3001),
    })
    .default({}),

  // Testing configuration
  test: z
    .object({
      suite: z.enum(['unit', 'integration', 'e2e', 'all']).default('all'),
      coverage: z.boolean().default(false),
      watch: z.boolean().default(false),
    })
    .default({}),

  // Build configuration
  build: z
    .object({
      production: z.boolean().default(false),
      sourcemaps: z.boolean().default(true),
      minify: z.boolean().default(false),
    })
    .default({}),

  // Logging configuration
  logging: z
    .object({
      level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
      format: z.enum(['json', 'pretty']).default('pretty'),
      file: z.string().optional(),
    })
    .default({}),

  // Environment
  environment: z.enum(['development', 'staging', 'production']).default('development'),
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Configuration file paths in order of priority (lowest to highest).
 * The official configuration filename is `mcp-orchestrator.config.json`.
 */
const CONFIG_FILES = [
  'mcp-orchestrator.config.json',
  'mcp-orchestrator.config.js',
  '.mcp-orchestrator.json',
  '.kilorc.json',
  '.kilorc',
];

export class CLIConfig {
  private static instance: CLIConfig;
  private config: Config;
  private configPath?: string;

  private constructor() {
    this.config = this.getDefaults();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): CLIConfig {
    if (!CLIConfig.instance) {
      CLIConfig.instance = new CLIConfig();
    }
    return CLIConfig.instance;
  }

  /**
   * Load configuration from multiple sources
   */
  static async load(options?: Partial<Config>): Promise<Config> {
    const instance = CLIConfig.getInstance();

    // 1. Start with defaults
    let config = instance.getDefaults();

    // 2. Load from config file
    const fileConfig = await instance.loadFromFile();
    if (fileConfig) {
      config = instance.mergeConfig(config, fileConfig);
    }

    // 3. Load from environment variables
    const envConfig = instance.loadFromEnv();
    config = instance.mergeConfig(config, envConfig);

    // 4. Apply CLI options (highest priority)
    if (options) {
      config = instance.mergeConfig(config, options);
    }

    // Validate final configuration
    try {
      config = ConfigSchema.parse(config);
      instance.config = config;
      logger.debug({ config }, 'Configuration loaded');
      return config;
    } catch (error) {
      logger.error({ error }, 'Invalid configuration');
      throw new Error(`Configuration validation failed: ${error}`);
    }
  }

  /**
   * Save configuration to file
   */
  static async save(config: Partial<Config>, filePath?: string): Promise<void> {
    const instance = CLIConfig.getInstance();
    const targetPath = filePath || instance.configPath || CONFIG_FILES[0];

    try {
      // Merge with existing config
      const mergedConfig = instance.mergeConfig(instance.config, config);

      // Validate
      const validConfig = ConfigSchema.parse(mergedConfig);

      // Save to file
      await fs.writeFile(targetPath, JSON.stringify(validConfig, null, 2), 'utf-8');

      instance.config = validConfig;
      instance.configPath = targetPath;

      logger.info(`Configuration saved to ${targetPath}`);
    } catch (error) {
      logger.error({ error }, 'Failed to save configuration');
      throw error;
    }
  }

  /**
   * Get default configuration
   */
  static getDefaults(): Config {
    return ConfigSchema.parse({});
  }

  /**
   * Get current configuration
   */
  static get(): Config {
    return CLIConfig.getInstance().config;
  }

  /**
   * Get specific configuration value
   */
  static getValue<K extends keyof Config>(key: K): Config[K] {
    return CLIConfig.getInstance().config[key];
  }

  /**
   * Set specific configuration value
   */
  static setValue<K extends keyof Config>(key: K, value: Config[K]): void {
    const instance = CLIConfig.getInstance();
    instance.config[key] = value;
  }

  /**
   * Reset to default configuration
   */
  static reset(): void {
    const instance = CLIConfig.getInstance();
    instance.config = instance.getDefaults();
    instance.configPath = undefined;
  }

  /**
   * Load configuration from file
   */
  private async loadFromFile(): Promise<Partial<Config> | null> {
    for (const filename of CONFIG_FILES) {
      const filePath = path.join(process.cwd(), filename);

      try {
        const stat = await fs.stat(filePath);
        if (stat.isFile()) {
          const content = await fs.readFile(filePath, 'utf-8');

          // Handle different file formats
          let config: any;
          if (filename.endsWith('.js')) {
            // Dynamic import for JS config files
            const module = await import(filePath);
            config = module.default || module;
          } else {
            // Parse JSON
            config = JSON.parse(content);
          }

          this.configPath = filePath;
          logger.debug({ filePath }, 'Configuration file loaded');
          return config;
        }
      } catch (error) {
        // File doesn't exist or is not readable, continue to next
        continue;
      }
    }

    return null;
  }

  /**
   * Load configuration from environment variables
   */
  private loadFromEnv(): Partial<Config> {
    const config: any = {};

    // Server configuration
    if (process.env.MCP_SERVER_MODE) {
      config.server = config.server || {};
      config.server.mode = process.env.MCP_SERVER_MODE;
    }
    if (process.env.MCP_SERVER_PORT) {
      config.server = config.server || {};
      config.server.port = Number.parseInt(process.env.MCP_SERVER_PORT, 10);
    }

    // Pipeline configuration
    if (process.env.MCP_PIPELINE_MODE) {
      config.pipeline = config.pipeline || {};
      config.pipeline.mode = process.env.MCP_PIPELINE_MODE;
    }
    if (process.env.MCP_MAX_RETRIES) {
      config.pipeline = config.pipeline || {};
      config.pipeline.maxRetries = Number.parseInt(process.env.MCP_MAX_RETRIES, 10);
    }

    // Logging configuration
    if (process.env.MCP_LOG_LEVEL) {
      config.logging = config.logging || {};
      config.logging.level = process.env.MCP_LOG_LEVEL;
    }

    // Environment
    if (process.env.NODE_ENV) {
      const envMap: Record<string, string> = {
        dev: 'development',
        prod: 'production',
        development: 'development',
        staging: 'staging',
        production: 'production',
      };
      const env = envMap[process.env.NODE_ENV.toLowerCase()];
      if (env) {
        config.environment = env;
      }
    }

    return config;
  }

  /**
   * Merge configurations (deep merge)
   */
  private mergeConfig(base: Config, override: Partial<Config>): Config {
    const merged = { ...base };

    for (const key in override) {
      const value = override[key as keyof Config];
      if (value !== undefined) {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          // Deep merge for objects
          merged[key as keyof Config] = {
            ...(base[key as keyof Config] as any),
            ...(value as any),
          };
        } else {
          // Direct assignment for primitives and arrays
          merged[key as keyof Config] = value as any;
        }
      }
    }

    return merged;
  }

  /**
   * Get defaults (instance method)
   */
  private getDefaults(): Config {
    return ConfigSchema.parse({});
  }
}

/**
 * Export convenience functions
 */
export const loadConfig = CLIConfig.load;
export const saveConfig = CLIConfig.save;
export const getConfig = CLIConfig.get;
export const getConfigValue = CLIConfig.getValue;
export const setConfigValue = CLIConfig.setValue;
export const resetConfig = CLIConfig.reset;
export const getDefaultConfig = CLIConfig.getDefaults;
