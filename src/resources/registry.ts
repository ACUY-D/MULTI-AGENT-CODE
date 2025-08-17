/**
 * Resource Registry (MCP)
 * - Registro centralizado de recursos mcp://
 * - Validación con Zod
 * - Normalización y seguridad de rutas
 * - Lectura de contenidos (texto/base64) con inferencia de MIME
 */

import { promises as fs, existsSync } from 'fs';
import path from 'path';
import { OrchestratorError, ValidationError } from '@core/errors';
import { createLogger } from '@utils/logger';
import { z } from 'zod';
import {
  McpUriSchema,
  type ResourceDescriptor,
  ResourceDescriptorSchema,
  ResourceReadContentSchema,
  ResourceReadParamsSchema,
  type ResourceReadResult,
  ResourcesListResultSchema,
} from './schemas';

const logger = createLogger('resource-registry');

type Resolver = (uri: string) => Promise<ResourceReadResult>;

interface RegistryEntry {
  descriptor: ResourceDescriptor;
  resolver: Resolver;
  registeredAt: Date;
}

/**
 * Util: inferir MIME por extensión
 */
function inferMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.md':
      return 'text/markdown';
    case '.json':
      return 'application/json';
    case '.txt':
      return 'text/plain';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.svg':
      return 'image/svg+xml';
    case '.pdf':
      return 'application/pdf';
    case '.zip':
      return 'application/zip';
    case '.csv':
      return 'text/csv';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Util: determinar si extensión es de texto
 */
function isTextExt(filePath: string): boolean {
  const textExts = new Set([
    '.md',
    '.txt',
    '.json',
    '.csv',
    '.xml',
    '.yml',
    '.yaml',
    '.js',
    '.ts',
    '.tsx',
    '.css',
    '.html',
    '.svg',
  ]);
  return textExts.has(path.extname(filePath).toLowerCase());
}

/**
 * Seguridad: asegura que no haya path traversal en URIs (no usar .. en el componente de ruta)
 */
function validateNoPathTraversal(uri: string): void {
  if (uri.includes('..')) {
    throw new ValidationError('Path traversal detectado en URI', 'uri', uri, 'no-parent-navigation');
  }
}

/**
 * Normaliza y valida URI
 */
function normalizeUri(raw: string): string {
  const uri = McpUriSchema.parse(raw.trim());
  validateNoPathTraversal(uri);
  return uri;
}

/**
 * Resultado de lectura (helpers)
 */
async function readFileAsContent(absPath: string, uri: string): Promise<ResourceReadResult> {
  const mimeType = inferMimeType(absPath);
  if (isTextExt(absPath)) {
    const text = await fs.readFile(absPath, 'utf8');
    return ResourceReadContentSchema.parse({
      uri,
      mimeType,
      text,
      isBase64: false,
    });
  }
  const buf = await fs.readFile(absPath);
  const base64 = buf.toString('base64');
  return ResourceReadContentSchema.parse({
    uri,
    mimeType,
    base64,
    isBase64: true,
  });
}

/**
 * ResourceRegistry: Singleton
 */
export class ResourceRegistry {
  private static instance: ResourceRegistry | null = null;
  private map = new Map<string, RegistryEntry>();

  private constructor() {
    logger.info('ResourceRegistry creado');
  }

  static getInstance(): ResourceRegistry {
    if (!this.instance) this.instance = new ResourceRegistry();
    return this.instance;
  }

  /**
   * Alta de recurso
   */
  register(descriptor: ResourceDescriptor, resolver: Resolver): void {
    const desc = ResourceDescriptorSchema.parse(descriptor);
    const key = normalizeUri(desc.uri);
    this.map.set(key, {
      descriptor: { ...desc, uri: key },
      resolver,
      registeredAt: new Date(),
    });
    logger.info({ uri: key, name: desc.name }, 'Recurso registrado');
  }

  /**
   * Baja de recurso
   */
  unregister(uri: string): boolean {
    const key = normalizeUri(uri);
    return this.map.delete(key);
  }

  /**
   * Listado de recursos
   */
  list(): ResourceDescriptor[] {
    const list = Array.from(this.map.values()).map((e) => e.descriptor);
    return ResourcesListResultSchema.shape.resources.parse(list);
  }

  /**
   * Lectura de un recurso via resolver
   */
  async read(params: unknown): Promise<ResourceReadResult> {
    const { uri } = ResourceReadParamsSchema.parse(params);
    const key = normalizeUri(uri);
    const entry = this.map.get(key);
    if (!entry) {
      throw new OrchestratorError(`Recurso no registrado: ${key}`, 'RESOURCE_NOT_REGISTERED');
    }
    try {
      const result = await entry.resolver(key);
      return ResourceReadContentSchema.parse(result);
    } catch (error) {
      logger.error({ error, uri: key }, 'Fallo al leer recurso');
      if (error instanceof ValidationError || error instanceof OrchestratorError) {
        throw error;
      }
      throw new OrchestratorError((error as Error).message, 'RESOURCE_READ_ERROR', false, { uri: key });
    }
  }

  /**
   * Helpers expuestos para resolvers
   */
  static helpers = {
    inferMimeType,
    isTextExt,
    readFileAsContent,
    safeJoinWithinCwd: async (...segments: string[]): Promise<string> => {
      const cwd = process.cwd();
      const abs = path.resolve(cwd, ...segments);
      // Asegurar que el path final esté dentro de CWD
      const rel = path.relative(cwd, abs);
      if (rel.startsWith('..') || (path.isAbsolute(rel) === false && rel.includes('..'))) {
        throw new ValidationError('Acceso fuera del workspace denegado', 'path', abs, 'workspace-only');
      }
      return abs;
    },
    exists: (p: string) => existsSync(p),
  };
}

/**
 * Factoría/instancia
 */
export function getResourceRegistry(): ResourceRegistry {
  return ResourceRegistry.getInstance();
}

/**
 * API simple para pruebas
 */
export async function readResource(uri: string): Promise<ResourceReadResult> {
  const registry = getResourceRegistry();
  return registry.read({ uri });
}

export function listResources(): ResourceDescriptor[] {
  const registry = getResourceRegistry();
  return registry.list();
}

/**
 * Export utilidades (por si son útiles en resolvers)
 */
export const ResourceUtils = ResourceRegistry.helpers;
