import http from 'http';
import { createLogger } from '@utils/logger';

export interface HTTPServerOptions {
  host: string;
  port: number;
}

export interface HTTPServer {
  start(): Promise<void>;
  stop(): Promise<void>;
}

/**
 * Basic HTTP server implementation used for MCP operations.
 * Provides start and stop helpers and a minimal health endpoint.
 */
export function createHTTPServer(options: HTTPServerOptions): HTTPServer {
  const logger = createLogger('http-server');

  const server = http.createServer((req, res) => {
    // Simple health check endpoint
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  return {
    async start(): Promise<void> {
      await new Promise<void>((resolve, reject) => {
        server.listen(options.port, options.host, () => {
          logger.info(
            { host: options.host, port: options.port },
            'HTTP server listening',
          );
          resolve();
        });
        server.on('error', (err) => {
          logger.error({ err }, 'Error starting HTTP server');
          reject(err);
        });
      });
    },

    async stop(): Promise<void> {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) {
            logger.error({ err }, 'Error stopping HTTP server');
            reject(err);
          } else {
            logger.info('HTTP server stopped');
            resolve();
          }
        });
      });
    },
  };
}
