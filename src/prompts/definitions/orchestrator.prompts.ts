/**
 * Orchestrator Prompts Definitions
 * Define /kickoff, /hand_off, /status, /resume y su registro en el PromptRegistry
 */

import type { PromptDefinition, PromptRegistry } from '@prompts/registry';
import {
  HandOffVarsSchema,
  KickoffVarsSchema,
  type PromptBuildResult,
  ResumeVarsSchema,
  StatusVarsSchema,
} from '@prompts/schemas';
import { createLogger } from '@utils/logger';
import type { z } from 'zod';

const logger = createLogger('orchestrator-prompts-def');

/**
 * /kickoff {objective, mode}
 */
const kickoffDef: PromptDefinition<typeof KickoffVarsSchema> = {
  name: '/kickoff',
  description: 'Inicia el pipeline BMAD con un objetivo dado',
  args: [
    { name: 'objective', description: 'Objetivo detallado del proyecto (min 10 chars)', required: true },
    {
      name: 'mode',
      description: "Modo de ejecución ('auto'|'semi'|'dry-run')",
      required: false,
      enum: ['auto', 'semi', 'dry-run'],
      default: 'semi',
    },
  ],
  varsSchema: KickoffVarsSchema,
  build: async (vars): Promise<PromptBuildResult> => {
    const messages = [
      { role: 'system' as const, content: 'Inicia un pipeline BMAD de forma segura y trazable.' },
      { role: 'user' as const, content: `Objetivo: ${vars.objective}\nModo: ${vars.mode}` },
      { role: 'assistant' as const, content: 'Preparando ejecución del Orchestrator.' },
    ];

    return {
      name: '/kickoff',
      description: 'Inicia el pipeline BMAD con un objetivo dado',
      variables: vars,
      messages,
      suggestedTools: [
        {
          name: 'orchestrator.run',
          arguments: {
            objective: vars.objective,
            mode: vars.mode,
          },
        },
      ],
    };
  },
};

/**
 * /hand_off {role, context?}
 */
const handOffDef: PromptDefinition<typeof HandOffVarsSchema> = {
  name: '/hand_off',
  description: 'Delegación explicita a un rol (architect|developer|tester|debugger)',
  args: [
    {
      name: 'role',
      description: 'Rol de destino',
      required: true,
      enum: ['architect', 'developer', 'tester', 'debugger'],
    },
    { name: 'context', description: 'Contexto adicional', required: false },
  ],
  varsSchema: HandOffVarsSchema,
  build: async (vars): Promise<PromptBuildResult> => {
    const baseMsg = `Delegando al rol ${vars.role}.`;
    const contextMsg = vars.context ? `\nContexto: ${vars.context}` : '';

    const roleTool = (() => {
      switch (vars.role) {
        case 'architect':
          return 'architect.plan';
        case 'developer':
          return 'developer.implement';
        case 'tester':
          return 'tester.validate';
        case 'debugger':
          return 'debugger.fix';
      }
    })();

    return {
      name: '/hand_off',
      description: 'Delegación explicita a un rol',
      variables: vars,
      messages: [
        { role: 'system', content: 'Realiza handoff seguro entre agentes/roles.' },
        { role: 'user', content: baseMsg + contextMsg },
      ],
      suggestedTools: [
        {
          name: roleTool,
          arguments: {},
        },
      ],
    };
  },
};

/**
 * /status
 */
const statusDef: PromptDefinition<typeof StatusVarsSchema> = {
  name: '/status',
  description: 'Consulta estado actual del pipeline/orquestador',
  args: [],
  // Vars vacías
  varsSchema: StatusVarsSchema as unknown as z.ZodTypeAny,
  build: async (_vars): Promise<PromptBuildResult> => {
    return {
      name: '/status',
      description: 'Consulta estado actual del pipeline/orquestador',
      variables: {},
      messages: [
        { role: 'system', content: 'Consultar estado en STATE.json y snapshot del pipeline.' },
        { role: 'assistant', content: 'Para obtener el estado, leer el recurso mcp://orchestrator/STATE.json.' },
      ],
      // En esta fase no se llama una tool; el cliente puede leer el resource.
    };
  },
};

/**
 * /resume {checkpointId?, strategy}
 */
const resumeDef: PromptDefinition<typeof ResumeVarsSchema> = {
  name: '/resume',
  description: 'Reanuda desde último checkpoint o uno específico',
  args: [
    { name: 'checkpointId', description: 'ID de checkpoint', required: false },
    {
      name: 'strategy',
      description: "Estrategia de reanudación ('latest'|'specific')",
      required: false,
      enum: ['latest', 'specific'],
      default: 'latest',
    },
  ],
  varsSchema: ResumeVarsSchema,
  build: async (vars): Promise<PromptBuildResult> => {
    const detail =
      vars.strategy === 'specific' && vars.checkpointId
        ? `Reanudar desde checkpoint ${vars.checkpointId}`
        : 'Reanudar desde el último checkpoint disponible';
    return {
      name: '/resume',
      description: 'Reanuda desde último checkpoint o uno específico',
      variables: vars,
      messages: [
        { role: 'system', content: 'Reanudación controlada del pipeline desde checkpoint.' },
        { role: 'user', content: detail },
      ],
      // Podría sugerir una tool de orquestación específica si existiera.
    };
  },
};

/**
 * Registro público
 */
export function registerOrchestratorPrompts(registry: PromptRegistry): void {
  logger.info('Registrando prompts del orchestrator (/kickoff, /hand_off, /status, /resume)');
  registry.register(kickoffDef);
  registry.register(handOffDef);
  registry.register(statusDef);
  registry.register(resumeDef);
}
