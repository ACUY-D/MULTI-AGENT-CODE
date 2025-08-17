import { OrchestratorError } from '@core/errors';
import { initializeResources } from '@resources/index';
import { listResources, readResource } from '@resources/registry';
import { beforeAll, describe, expect, it } from 'vitest';

describe('MCP Resources - Orchestrator namespace', () => {
  beforeAll(async () => {
    // Inicializa y registra los resources en el registry (sin server)
    await initializeResources();
  });

  it('lista recursos soportados', async () => {
    const resources = listResources();
    // Debe incluir los recursos del orquestador
    const uris = resources.map((r) => r.uri);
    expect(uris).toContain('mcp://orchestrator/PLAN.md');
    expect(uris).toContain('mcp://orchestrator/TASKPLAN.md');
    expect(uris).toContain('mcp://orchestrator/ARCH.md');
    expect(uris).toContain('mcp://orchestrator/DECISIONS.md');
    expect(uris).toContain('mcp://orchestrator/STATE.json');
    expect(uris).toContain('mcp://orchestrator/TEST-REPORT.md');
    expect(uris).toContain('mcp://orchestrator/ARTIFACTS/');
  });

  it('lee ARCH.md (con fallback o placeholder) con mime text/markdown', async () => {
    const res = await readResource('mcp://orchestrator/ARCH.md');
    expect(res.uri).toBe('mcp://orchestrator/ARCH.md');
    expect(res.mimeType).toBe('text/markdown');
    expect('text' in res).toBe(true);
    if ('text' in res) {
      expect(res.text.length).toBeGreaterThan(0);
    }
  });

  it('lee/crea STATE.json con mime application/json', async () => {
    const res = await readResource('mcp://orchestrator/STATE.json');
    expect(res.uri).toBe('mcp://orchestrator/STATE.json');
    expect(res.mimeType).toBe('application/json');
    expect('text' in res || 'base64' in res).toBe(true);
    if ('text' in res) {
      const parsed = JSON.parse(res.text);
      expect(parsed).toHaveProperty('status');
      expect(parsed).toHaveProperty('updatedAt');
    }
  });

  it('lista ARTIFACTS/ (JSON con entries)', async () => {
    const res = await readResource('mcp://orchestrator/ARTIFACTS/');
    expect(res.uri).toBe('mcp://orchestrator/ARTIFACTS/');
    expect(res.mimeType).toBe('application/json');
    expect('text' in res).toBe(true);
    if ('text' in res) {
      const payload = JSON.parse(res.text);
      expect(payload).toHaveProperty('entries');
      expect(Array.isArray(payload.entries)).toBe(true);
      expect(payload).toHaveProperty('basePath');
    }
  });

  it('fallo controlado al leer artifact inexistente', async () => {
    await expect(readResource('mcp://orchestrator/ARTIFACTS/no-existe.txt')).rejects.toBeInstanceOf(OrchestratorError);
  });
});
