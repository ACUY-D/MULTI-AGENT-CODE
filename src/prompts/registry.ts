/**
 * Prompt Registry (MCP)
 * - Registro y construcción de prompts tipados con Zod
 * - Soporta prompts/list y prompts/get vía initializePrompts(server?)
 */

import { OrchestratorError, ValidationError } from '@core/errors';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { createLogger } from '@utils/logger';
import { z } from 'zod';
import {
  type PromptArgumentDescriptor,
  PromptArgumentDescriptorSchema,
  type PromptBuildResult,
  PromptBuildResultSchema,
  type PromptDescriptor,
  PromptDescriptorSchema,
} from './schemas';

const logger = createLogger('prompt-registry');

export interface PromptDefinition<Vars extends z.ZodTypeAny> {
  name: string;
  description: string;
  args: PromptArgumentDescriptor[];
  varsSchema: Vars;
  build: (vars: z.infer<Vars>) => Promise<PromptBuildResult> | PromptBuildResult;
}

interface RegistryEntry {
  def: PromptDefinition<any>;
  registeredAt: Date;
}

export class PromptRegistry {
  private static instance: PromptRegistry | null = null;
  private map = new Map<string, RegistryEntry>();

  private constructor() {
    logger.info('PromptRegistry creado');
  }

  static getInstance(): PromptRegistry {
    if (!this.instance) this.instance = new PromptRegistry();
    return this.instance;
  }

  register<Vars extends z.ZodTypeAny>(def: PromptDefinition<Vars>): void {
    const desc: PromptDescriptor = PromptDescriptorSchema.parse({
      name: def.name,
      description: def.description,
      arguments: def.args?.map((a) => PromptArgumentDescriptorSchema.parse(a)) ?? [],
    });
    this.map.set(def.name, {
      def: { ...def, name: desc.name, description: desc.description, args: desc.arguments },
      registeredAt: new Date(),
    });
    logger.info({ name: def.name }, 'Prompt registrado');
  }

  list(): PromptDescriptor[] {
    const list = Array.from(this.map.values()).map((e) => ({
      name: e.def.name,
      description: e.def.description,
      arguments: e.def.args,
    }));
    return z.array(PromptDescriptorSchema).parse(list);
  }

  async build(name: string, variables: unknown): Promise<PromptBuildResult> {
    const entry = this.map.get(name);
    if (!entry) {
      throw new OrchestratorError(`Prompt no encontrado: ${name}`, 'PROMPT_NOT_FOUND');
    }
    try {
      const vars = entry.def.varsSchema.parse(variables ?? {});
      const result = await entry.def.build(vars);
      return PromptBuildResultSchema.parse({
        ...result,
        name: entry.def.name,
        description: entry.def.description,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Validación de variables de prompt falló', 'variables', variables, 'zod-validation');
      }
      throw error;
    }
  }
}

export function getPromptRegistry(): PromptRegistry {
  return PromptRegistry.getInstance();
}

export async function initializePrompts(server?: Server): Promise<void> {
  if (!server) return;
  const registry = PromptRegistry.getInstance();

  server.setRequestHandler('prompts/list', async () => {
    const prompts = registry.list();
    return { prompts };
  });

  server.setRequestHandler('prompts/get', async (request) => {
    const { name, arguments: args } = (request.params || {}) as {
      name: string;
      arguments?: Record<string, unknown>;
    };

    logger.info({ prompt: name }, 'Solicitud prompts/get');

    const built = await registry.build(name, args || {});
    const messages = built.messages.map((m) => ({
      role: m.role,
      content: [{ type: 'text', text: m.content }],
    }));

    const response: any = {
      name: built.name,
      description: built.description,
      messages,
    };

    if (built.suggestedTools?.length) {
      response.suggestedTools = built.suggestedTools;
    }

    return response;
  });

  logger.info('Handlers MCP de prompts registrados');
}
