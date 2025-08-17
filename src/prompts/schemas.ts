/**
 * Prompts Schemas (Zod)
 * Definiciones de variables, mensajes y resultados para Prompts MCP
 */

import { z } from 'zod';

/**
 * Tipos de mensajes para prompts/get
 */
export const PromptMessageRoleSchema = z.enum(['system', 'user', 'assistant']);
export type PromptMessageRole = z.infer<typeof PromptMessageRoleSchema>;

export const PromptMessageSchema = z.object({
  role: PromptMessageRoleSchema,
  content: z.string(),
});
export type PromptMessage = z.infer<typeof PromptMessageSchema>;

/**
 * Sugerencias de tool calls desde un prompt
 */
export const SuggestedToolSchema = z.object({
  name: z.string(),
  arguments: z.record(z.unknown()).optional(),
});
export type SuggestedTool = z.infer<typeof SuggestedToolSchema>;

/**
 * Resultado de prompts/get
 */
export const PromptBuildResultSchema = z.object({
  name: z.string(),
  description: z.string(),
  variables: z.record(z.unknown()).optional(),
  messages: z.array(PromptMessageSchema),
  suggestedTools: z.array(SuggestedToolSchema).optional(),
});
export type PromptBuildResult = z.infer<typeof PromptBuildResultSchema>;

/**
 * Schemas de variables por prompt
 */

// /kickoff
export const KickoffVarsSchema = z.object({
  objective: z.string().min(10, 'objective debe tener al menos 10 caracteres'),
  mode: z.enum(['auto', 'semi', 'dry-run']).default('semi'),
});

// /hand_off
export const HandOffVarsSchema = z.object({
  role: z.enum(['architect', 'developer', 'tester', 'debugger']),
  context: z.string().optional(),
});

// /status
export const StatusVarsSchema = z.object({}).optional().default({});

// /resume
export const ResumeVarsSchema = z.object({
  checkpointId: z.string().optional(),
  strategy: z.enum(['latest', 'specific']).default('latest'),
});

/**
 * Descriptores de argumentos (para prompts/list)
 */
export const PromptArgumentDescriptorSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  required: z.boolean().default(false),
  enum: z.array(z.string()).optional(),
  default: z.unknown().optional(),
});
export type PromptArgumentDescriptor = z.infer<typeof PromptArgumentDescriptorSchema>;

/**
 * Descriptor de prompt (listado)
 */
export const PromptDescriptorSchema = z.object({
  name: z.string(),
  description: z.string(),
  arguments: z.array(PromptArgumentDescriptorSchema).default([]),
});
export type PromptDescriptor = z.infer<typeof PromptDescriptorSchema>;
