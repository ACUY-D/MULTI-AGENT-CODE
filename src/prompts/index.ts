/**
 * Prompts MCP - Punto de entrada (wrapper)
 * - Reexporta el registro de prompts y las definiciones del orquestador
 * - Expone initializeAllPrompts(server?) para registrar definiciones y handlers MCP
 *
 * Nota: Este archivo reemplaza la versión previa basada en plantillas estáticas.
 * Ahora toda la gestión de prompts se realiza vía PromptRegistry + Zod validation.
 */

import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { createLogger } from '@utils/logger';
import { registerOrchestratorPrompts } from './definitions/orchestrator.prompts';
import { getPromptRegistry, initializePrompts } from './registry';

const logger = createLogger('mcp-prompts-index');

/**
 * Inicializa todas las definiciones y registra handlers MCP (prompts/list, prompts/get)
 */
export async function initializeAllPrompts(server?: Server): Promise<void> {
  // Registrar definiciones de prompts del orquestador
  registerOrchestratorPrompts(getPromptRegistry());

  // Instalar handlers MCP
  await initializePrompts(server);

  logger.info('Prompts inicializados y handlers MCP registrados');
}

// Reexports útiles para uso externo
export { initializePrompts, getPromptRegistry } from './registry';
export { registerOrchestratorPrompts } from './definitions/orchestrator.prompts';
