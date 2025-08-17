/**
 * Resources Schemas (Zod)
 * Definiciones de tipos y esquemas para Resources MCP (mcp://...)
 * - Validación de URIs, parámetros y resultados
 * - Estructuras para listados y lecturas (texto o binario/base64)
 */

import { z } from 'zod';

/**
 * URI de recurso MCP
 * Debe comenzar con "mcp://"
 */
export const McpUriSchema = z
  .string()
  .min(8)
  .refine((v) => v.startsWith('mcp://'), {
    message: 'URI inválida: debe comenzar con mcp://',
  });

/**
 * Descriptor básico de un recurso para resources/list
 */
export const ResourceDescriptorSchema = z.object({
  uri: McpUriSchema,
  name: z.string().min(1),
  description: z.string().min(1).optional(),
  mimeType: z.string().min(1).optional(),
});

export type ResourceDescriptor = z.infer<typeof ResourceDescriptorSchema>;

/**
 * Entrada de directorio (para listados recursivos o navegables)
 */
export const DirectoryEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  type: z.enum(['file', 'directory']),
  size: z.number().int().nonnegative().optional(),
  mimeType: z.string().optional(),
  modifiedAt: z.string().datetime().optional(),
});

export type DirectoryEntry = z.infer<typeof DirectoryEntrySchema>;

/**
 * Parámetros para resources/read
 */
export const ResourceReadParamsSchema = z.object({
  uri: McpUriSchema,
  options: z
    .object({
      // Permite futuras extensiones, p.ej. rangos, formato, etc.
    })
    .passthrough()
    .optional(),
});

export type ResourceReadParams = z.infer<typeof ResourceReadParamsSchema>;

/**
 * Resultado de lectura de un recurso:
 * - Texto UTF-8 (text)
 * - Binario en base64 (base64), con indicador isBase64=true
 */
export const TextContentSchema = z.object({
  uri: McpUriSchema,
  mimeType: z.string().min(1),
  text: z.string(),
  isBase64: z.literal(false).optional(),
});

export const BinaryContentSchema = z.object({
  uri: McpUriSchema,
  mimeType: z.string().min(1),
  base64: z.string().min(1),
  isBase64: z.literal(true).default(true),
});

/**
 * Resultado de lectura unificado
 */
export const ResourceReadContentSchema = z.union([TextContentSchema, BinaryContentSchema]);

export type ResourceReadResult = z.infer<typeof ResourceReadContentSchema>;

/**
 * Resultado de listado de resources
 */
export const ResourcesListResultSchema = z.object({
  resources: z.array(ResourceDescriptorSchema),
});

export type ResourcesListResult = z.infer<typeof ResourcesListResultSchema>;

/**
 * Resultado genérico para listados de directorios como recurso (JSON serializado)
 * Se devuelve como text/ JSON (application/json) para clientes MCP.
 */
export const DirectoryListingPayloadSchema = z.object({
  uri: McpUriSchema,
  entries: z.array(DirectoryEntrySchema),
  basePath: z.string(),
});

export type DirectoryListingPayload = z.infer<typeof DirectoryListingPayloadSchema>;
