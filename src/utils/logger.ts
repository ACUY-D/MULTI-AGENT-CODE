/**
 * Logger utility using Pino for structured logging
 * Provides centralized logging for the entire application
 */

import pino from 'pino';

const logLevel = process.env.LOG_LEVEL || 'info';
const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = pino({
  level: logLevel,
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'pid,hostname',
          translateTime: 'SYS:standard',
        },
      }
    : undefined,
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// Child loggers for different modules
export const createLogger = (module: string) => {
  return logger.child({ module });
};

// Convenience methods
export const logInfo = (message: string, data?: unknown) => {
  logger.info(data, message);
};

export const logError = (message: string, error?: unknown) => {
  logger.error(error, message);
};

export const logWarn = (message: string, data?: unknown) => {
  logger.warn(data, message);
};

export const logDebug = (message: string, data?: unknown) => {
  logger.debug(data, message);
};
