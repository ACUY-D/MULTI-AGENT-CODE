import { ValidationError } from '@core/errors';
import { registerOrchestratorPrompts } from '@prompts/definitions/orchestrator.prompts';
import { getPromptRegistry } from '@prompts/registry';
import { beforeAll, describe, expect, it } from 'vitest';

describe('MCP Prompts - Orchestrator definitions', () => {
  const registry = getPromptRegistry();

  beforeAll(() => {
    // Registrar definiciones antes de las pruebas
    registerOrchestratorPrompts(registry);
  });

  it('lista prompts disponibles (/kickoff, /hand_off, /status, /resume)', () => {
    const list = registry.list();
    const names = list.map((p) => p.name);
    expect(names).toContain('/kickoff');
    expect(names).toContain('/hand_off');
    expect(names).toContain('/status');
    expect(names).toContain('/resume');
  });

  it('get de /kickoff con objective válido retorna mensajes y suggestedTools', async () => {
    const built = await registry.build('/kickoff', {
      objective: 'Construir una API RESTful para gestión de tareas con autenticación.',
      mode: 'semi',
    });

    expect(built.name).toBe('/kickoff');
    expect(built.messages.length).toBeGreaterThan(0);
    expect(built.suggestedTools?.[0]?.name).toBe('orchestrator.run');
    // Variables respetadas
    expect(built.variables).toMatchObject({
      objective: expect.any(String),
      mode: expect.stringMatching(/auto|semi|dry-run/),
    });
  });

  it('get de /hand_off con role inválido falla validación (ValidationError)', async () => {
    await expect(
      registry.build('/hand_off', {
        // @ts-expect-error - intentionally invalid role for test
        role: 'manager',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('get de /status sin params funciona', async () => {
    const built = await registry.build('/status', {});
    expect(built.name).toBe('/status');
    expect(built.messages.length).toBeGreaterThan(0);
    expect(built.variables).toEqual({});
    expect(built.suggestedTools ?? []).toHaveLength(0);
  });
});
