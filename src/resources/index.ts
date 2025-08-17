/**
 * Resources MCP - Punto de entrada
 * - Registra descriptores y resolvers en el ResourceRegistry
 * - Expone initializeResources(server?) para instalar handlers MCP (resources/list, resources/read)
 */

import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { createLogger } from '@utils/logger';
import {
  ResourceUtils,
  getResourceRegistry,
  listResources as registryList,
  readResource as registryRead,
} from './registry';
import { getOrchestratorResourceDescriptors, orchestratorResourceResolver } from './resolvers/orchestrator.resources';
import { ResourceReadParamsSchema, type ResourceReadResult, ResourcesListResultSchema } from './schemas';

const logger = createLogger('mcp-resources-index');

/**
 * Registra todos los recursos soportados en el registry
 */
function registerAllResources(): void {
  const registry = getResourceRegistry();

  // Registros del namespace orchestrator/*
  const orchestratorDescriptors = getOrchestratorResourceDescriptors();
  for (const desc of orchestratorDescriptors) {
    registry.register(desc, orchestratorResourceResolver);
  }

  logger.info({ total: registryList().length }, 'Resources registrados en el registry');
}

/**
 * Inicializa y opcionalmente instala handlers MCP en el server
 */
export async function initializeResources(server?: Server): Promise<void> {
  // Registrar descriptores y resolvers
  registerAllResources();

  if (!server) {
    return;
  }

  // Handler: resources/list
  server.setRequestHandler('resources/list', async () => {
    const resources = registryList();
    // Validar salida
    const result = ResourcesListResultSchema.parse({ resources });
    return result;
  });

  // Handler: resources/read
  server.setRequestHandler('resources/read', async (request) => {
    const params = ResourceReadParamsSchema.parse(request.params);
    logger.info({ uri: params.uri }, 'Solicitud de lectura de recurso');

    const content = await registryRead(params.uri);

    // Mapear al formato MCP esperado
    const mcpContent: any = {
      uri: content.uri,
      mimeType: content.mimeType,
    };

    if ('text' in content) {
      mcpContent.text = content.text;
    } else if ('base64' in content) {
      mcpContent.base64 = content.base64;
    }

    const response = {
      contents: [mcpContent],
    };

    return response;
  });

  logger.info('Handlers MCP de resources registrados');
}

/**
 * Utilidades re-exportadas
 */
export { getResourceRegistry } from './registry';
export { ResourceUtils } from './registry';
