/**
 * Orchestrator Resources Resolver
 * Soporta URIs mcp://orchestrator/* con fallbacks y listados de ARTIFACTS
 *
 * URIs:
 * - mcp://orchestrator/PLAN.md            → .kilo/plans/PLAN.md; fallback ./PLAN.md o ./docs/PLAN.md
 * - mcp://orchestrator/TASKPLAN.md        → ./TASKPLAN.md; fallback ./.kilo/plans/TASKPLAN.md
 * - mcp://orchestrator/ARCH.md            → ./ARCH.md; fallback ./docs/ARCH.md
 * - mcp://orchestrator/DECISIONS.md       → ./DECISIONS.md; fallback ./docs/DECISIONS.md
 * - mcp://orchestrator/STATE.json         → .kilo/state/STATE.json (si no existe, generar snapshot mínimo)
 * - mcp://orchestrator/TEST-REPORT.md     → .kilo/artifacts/TEST-REPORT.md; fallback ./docs/TEST-REPORT.md
 * - mcp://orchestrator/ARTIFACTS/         → Listado navegable del directorio .kilo/artifacts/
 * - mcp://orchestrator/ARTIFACTS/<path> → Lectura de archivo dentro de .kilo/artifacts/
 */

import { promises as fs, existsSync } from 'fs';
import path from 'path';
import { OrchestratorError, ValidationError } from '@core/errors';
import { ResourceRegistry } from '@resources/registry';
import { ResourceReadContentSchema, type ResourceReadResult } from '@resources/schemas';
import { createLogger } from '@utils/logger';

const logger = createLogger('orchestrator-resources');

const ORCH_PREFIX = 'mcp://orchestrator/';
const ARTIFACTS_PREFIX = `${ORCH_PREFIX}ARTIFACTS/`;

const KILO_DIR = '.kilo';
const KILO_PLANS = path.join(KILO_DIR, 'plans');
const KILO_STATE = path.join(KILO_DIR, 'state');
const KILO_ARTIFACTS = path.join(KILO_DIR, 'artifacts');

/**
 * Asegura estructura mínima en .kilo
 */
async function ensureKiloStructure(): Promise<void> {
  const dirs = [KILO_DIR, KILO_PLANS, KILO_STATE, KILO_ARTIFACTS];
  for (const d of dirs) {
    const abs = path.resolve(process.cwd(), d);
    try {
      await fs.mkdir(abs, { recursive: true });
    } catch {
      // ignore
    }
  }
}

/**
 * Genera snapshot mínimo de STATE.json
 */
async function ensureStateJson(): Promise<string> {
  await ensureKiloStructure();
  const abs = path.resolve(process.cwd(), KILO_STATE, 'STATE.json');
  if (!existsSync(abs)) {
    const snapshot = {
      status: 'unknown',
      updatedAt: new Date().toISOString(),
      pipelines: [],
      agents: [],
    };
    await fs.writeFile(abs, JSON.stringify(snapshot, null, 2), 'utf8');
  }
  return abs;
}

/**
 * Resuelve ruta con fallbacks (primera existente)
 */
async function resolveWithFallbacks(candidates: string[]): Promise<string | null> {
  for (const rel of candidates) {
    const abs = path.resolve(process.cwd(), rel);
    if (existsSync(abs)) {
      return abs;
    }
  }
  return null;
}

/**
 * Resolver para URIs de documentos markdown/json
 */
async function resolveSimpleDoc(uri: string): Promise<ResourceReadResult> {
  const helpers = ResourceRegistry.helpers;

  switch (uri) {
    case `${ORCH_PREFIX}PLAN.md`: {
      const target =
        (await resolveWithFallbacks([path.join(KILO_PLANS, 'PLAN.md')])) ??
        (await resolveWithFallbacks(['PLAN.md', path.join('docs', 'PLAN.md')]));
      if (!target) {
        // placeholder
        const placeholder = '# PLAN.md\n\nNo se encontró PLAN.md en .kilo/plans, ./ o ./docs';
        return ResourceReadContentSchema.parse({
          uri,
          mimeType: 'text/markdown',
          text: placeholder,
          isBase64: false,
        });
      }
      return helpers.readFileAsContent(target, uri);
    }
    case `${ORCH_PREFIX}TASKPLAN.md`: {
      const target =
        (await resolveWithFallbacks(['TASKPLAN.md'])) ??
        (await resolveWithFallbacks([path.join(KILO_PLANS, 'TASKPLAN.md')]));
      if (!target) {
        const placeholder = '# TASKPLAN.md\n\nNo se encontró TASKPLAN.md en ./ o .kilo/plans';
        return ResourceReadContentSchema.parse({
          uri,
          mimeType: 'text/markdown',
          text: placeholder,
          isBase64: false,
        });
      }
      return helpers.readFileAsContent(target, uri);
    }
    case `${ORCH_PREFIX}ARCH.md`: {
      const target =
        (await resolveWithFallbacks(['ARCH.md'])) ?? (await resolveWithFallbacks([path.join('docs', 'ARCH.md')]));
      if (!target) {
        const placeholder = '# ARCH.md\n\nNo se encontró ARCH.md en ./ o ./docs';
        return ResourceReadContentSchema.parse({
          uri,
          mimeType: 'text/markdown',
          text: placeholder,
          isBase64: false,
        });
      }
      return helpers.readFileAsContent(target, uri);
    }
    case `${ORCH_PREFIX}DECISIONS.md`: {
      const target =
        (await resolveWithFallbacks(['DECISIONS.md'])) ??
        (await resolveWithFallbacks([path.join('docs', 'DECISIONS.md')]));
      if (!target) {
        const placeholder = '# DECISIONS.md\n\nNo se encontró DECISIONS.md en ./ o ./docs';
        return ResourceReadContentSchema.parse({
          uri,
          mimeType: 'text/markdown',
          text: placeholder,
          isBase64: false,
        });
      }
      return helpers.readFileAsContent(target, uri);
    }
    case `${ORCH_PREFIX}STATE.json`: {
      const abs = await ensureStateJson();
      return helpers.readFileAsContent(abs, uri);
    }
    case `${ORCH_PREFIX}TEST-REPORT.md`: {
      const target =
        (await resolveWithFallbacks([path.join(KILO_ARTIFACTS, 'TEST-REPORT.md')])) ??
        (await resolveWithFallbacks([path.join('docs', 'TEST-REPORT.md')]));
      if (!target) {
        const placeholder = '# TEST-REPORT.md\n\nNo se encontró TEST-REPORT.md en .kilo/artifacts o ./docs';
        return ResourceReadContentSchema.parse({
          uri,
          mimeType: 'text/markdown',
          text: placeholder,
          isBase64: false,
        });
      }
      return helpers.readFileAsContent(target, uri);
    }
    default:
      throw new OrchestratorError(`Recurso no soportado: ${uri}`, 'RESOURCE_UNSUPPORTED');
  }
}

/**
 * Listado del directorio de artifacts en JSON
 */
async function listArtifactsDir(uri: string): Promise<ResourceReadResult> {
  await ensureKiloStructure();
  const base = path.resolve(process.cwd(), KILO_ARTIFACTS);
  const entries: Array<{
    name: string;
    path: string;
    type: 'file' | 'directory';
    size?: number;
    mimeType?: string;
    modifiedAt?: string;
  }> = [];

  try {
    const dirents = await fs.readdir(base, { withFileTypes: true });
    for (const d of dirents) {
      const abs = path.join(base, d.name);
      const st = await fs.stat(abs);
      entries.push({
        name: d.name,
        path: `ARTIFACTS/${d.name}`,
        type: d.isDirectory() ? 'directory' : 'file',
        size: d.isDirectory() ? undefined : st.size,
        mimeType: d.isDirectory() ? undefined : ResourceRegistry.helpers.inferMimeType(abs),
        modifiedAt: st.mtime.toISOString(),
      });
    }
  } catch {
    // si no existe, entries vacío
  }

  const payload = {
    uri,
    entries,
    basePath: '.kilo/artifacts',
  };

  return ResourceReadContentSchema.parse({
    uri,
    mimeType: 'application/json',
    text: JSON.stringify(payload, null, 2),
    isBase64: false,
  });
}

/**
 * Lectura de un archivo específico bajo ARTIFACTS/
 */
async function readArtifactFile(uri: string): Promise<ResourceReadResult> {
  // uri: mcp://orchestrator/ARTIFACTS/<subpath>
  if (!uri.startsWith(ARTIFACTS_PREFIX)) {
    throw new ValidationError('URI inválida para ARTIFACTS', 'uri', uri, 'prefix-required');
  }
  const sub = uri.substring(ARTIFACTS_PREFIX.length);
  if (!sub || sub.includes('..')) {
    throw new ValidationError('Ruta de ARTIFACT inválida', 'uri', uri, 'no-parent-navigation');
  }

  const abs = await ResourceRegistry.helpers.safeJoinWithinCwd(KILO_ARTIFACTS, sub);
  if (!existsSync(abs)) {
    throw new OrchestratorError(`Artifact no encontrado: ${sub}`, 'RESOURCE_NOT_FOUND', false, { uri });
  }

  return ResourceRegistry.helpers.readFileAsContent(abs, uri);
}

/**
 * Resolver principal para URIs mcp://orchestrator/*
 */
export async function orchestratorResourceResolver(uri: string): Promise<ResourceReadResult> {
  if (uri === `${ORCH_PREFIX}ARTIFACTS/`) {
    return listArtifactsDir(uri);
  }
  if (uri.startsWith(ARTIFACTS_PREFIX)) {
    return readArtifactFile(uri);
  }
  return resolveSimpleDoc(uri);
}

/**
 * Registro de descriptores soportados por este resolver
 */
export function getOrchestratorResourceDescriptors() {
  return [
    {
      uri: `${ORCH_PREFIX}PLAN.md`,
      name: 'PLAN.md',
      description: 'Plan del proyecto (preferencia .kilo/plans/PLAN.md)',
      mimeType: 'text/markdown',
    },
    {
      uri: `${ORCH_PREFIX}TASKPLAN.md`,
      name: 'TASKPLAN.md',
      description: 'Plan de tareas (./TASKPLAN.md o .kilo/plans/TASKPLAN.md)',
      mimeType: 'text/markdown',
    },
    {
      uri: `${ORCH_PREFIX}ARCH.md`,
      name: 'ARCH.md',
      description: 'Documento de arquitectura',
      mimeType: 'text/markdown',
    },
    {
      uri: `${ORCH_PREFIX}DECISIONS.md`,
      name: 'DECISIONS.md',
      description: 'Decisiones de arquitectura (ADR/ADR-like)',
      mimeType: 'text/markdown',
    },
    {
      uri: `${ORCH_PREFIX}STATE.json`,
      name: 'STATE.json',
      description: 'Estado actual del Orchestrator/Pipeline',
      mimeType: 'application/json',
    },
    {
      uri: `${ORCH_PREFIX}TEST-REPORT.md`,
      name: 'TEST-REPORT.md',
      description: 'Reporte de tests más reciente',
      mimeType: 'text/markdown',
    },
    {
      uri: `${ORCH_PREFIX}ARTIFACTS/`,
      name: 'ARTIFACTS/',
      description: 'Listado navegable de .kilo/artifacts/',
      mimeType: 'application/json',
    },
  ];
}
