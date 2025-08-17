# 🧪 Testing Guide - MCP Development Orchestrator

## 📋 Tabla de Contenidos

- [Visión General](#visión-general)
- [Estructura de Tests](#estructura-de-tests)
- [Ejecutar Tests](#ejecutar-tests)
- [Escribir Tests](#escribir-tests)
- [Coverage](#coverage)
- [CI/CD](#cicd)
- [Best Practices](#best-practices)
- [Debugging](#debugging)

## 🎯 Visión General

El sistema de testing de MCP Development Orchestrator está diseñado para asegurar la calidad y confiabilidad del código a través de múltiples niveles de testing:

- **Unit Tests**: Validan componentes individuales en aislamiento
- **Integration Tests**: Verifican la interacción entre componentes
- **E2E Tests**: Prueban flujos completos de usuario

### Stack de Testing

- **Vitest**: Framework de testing unitario y de integración
- **Playwright**: Testing E2E y automatización de browser
- **Coverage**: Análisis de cobertura con V8
- **GitHub Actions**: CI/CD automatizado

## 📁 Estructura de Tests

```
tests/
├── unit/                    # Tests unitarios
│   ├── core/               # Core components
│   ├── roles/              # Agent tests
│   ├── tools/              # Tool tests
│   └── cli/                # CLI tests
├── integration/            # Tests de integración
│   ├── pipeline.test.ts   # Pipeline completo
│   ├── agents.test.ts     # Coordinación de agentes
│   └── mcp.test.ts        # Servidor MCP
├── e2e/                    # Tests end-to-end
│   └── scenarios/          # Escenarios E2E
├── helpers/                # Utilidades de testing
│   ├── fixtures.ts         # Datos de prueba
│   └── assertions.ts       # Custom assertions
├── mocks/                  # Mocks y stubs
│   ├── agents.ts          # Agent mocks
│   └── fs.ts              # File system mocks
└── setup.ts               # Setup global
```

## 🚀 Ejecutar Tests

### Comandos Básicos

```bash
# Ejecutar todos los tests
npm test

# Tests unitarios
npm run test:unit

# Tests de integración
npm run test:integration

# Tests E2E
npm run test:e2e

# Watch mode (re-ejecuta tests al cambiar archivos)
npm run test:watch

# Con coverage
npm run test:coverage

# UI interactiva
npm run test:ui
```

### Ejecutar Tests Específicos

```bash
# Test específico por nombre
npm test -- orchestrator

# Tests de un archivo
npm test -- tests/unit/core/orchestrator.test.ts

# Tests con pattern matching
npm test -- --grep "should execute pipeline"

# Solo tests marcados con .only
npm test -- --only
```

### Tests E2E

```bash
# Ejecutar E2E tests
npm run test:e2e

# Con browser visible
npm run e2e:headed

# Modo debug
npm run e2e:debug

# Generar código de test
npm run e2e:codegen

# Ver reporte HTML
npm run e2e:report
```

## ✍️ Escribir Tests

### Test Unitario Básico

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MyComponent } from '@/components/MyComponent';

describe('MyComponent', () => {
  let component: MyComponent;
  
  beforeEach(() => {
    component = new MyComponent();
  });
  
  it('should initialize correctly', () => {
    expect(component).toBeDefined();
    expect(component.isReady).toBe(true);
  });
  
  it('should handle errors gracefully', async () => {
    const mockError = new Error('Test error');
    vi.spyOn(component, 'process').mockRejectedValue(mockError);
    
    const result = await component.execute();
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Test error');
  });
});
```

### Test de Integración

```typescript
import { describe, it, expect } from 'vitest';
import { Orchestrator } from '@/core/orchestrator';
import { fixtures } from '@tests/helpers/fixtures';

describe('Pipeline Integration', () => {
  it('should execute full BMAD pipeline', async () => {
    const orchestrator = new Orchestrator();
    
    const result = await orchestrator.run({
      objective: fixtures.validObjective,
      mode: 'dry-run'
    });
    
    expect(result.success).toBe(true);
    expect(result.phasesCompleted).toHaveLength(4);
  });
});
```

### Test E2E

```typescript
import { test, expect } from '@playwright/test';

test('complete development workflow', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  // Iniciar proyecto
  await page.click('[data-testid="new-project"]');
  await page.fill('[name="objective"]', 'Build TODO app');
  await page.click('[data-testid="run-pipeline"]');
  
  // Verificar resultado
  await expect(page.locator('[data-testid="status"]'))
    .toContainText('Completed');
});
```

### Usando Fixtures y Helpers

```typescript
import { fixtures, createMockPipeline } from '@tests/helpers/fixtures';
import { expectValidPipelineResult } from '@tests/helpers/assertions';

it('should validate pipeline result', async () => {
  const pipeline = createMockPipeline({
    objective: 'Custom objective'
  });
  
  const result = await pipeline.run();
  
  expectValidPipelineResult(result);
});
```

### Mocking

```typescript
import { vi } from 'vitest';
import { MockAgent } from '@tests/mocks/agents';

it('should handle agent failure', async () => {
  const agent = new MockAgent();
  agent.setMockError(new Error('Agent failed'));
  
  const result = await agent.execute(message);
  
  expect(result.success).toBe(false);
});
```

## 📊 Coverage

### Configuración de Coverage

El proyecto está configurado para mantener los siguientes umbrales de cobertura:

- **Lines**: 80%
- **Functions**: 80%
- **Branches**: 70%
- **Statements**: 80%

### Ejecutar Coverage

```bash
# Generar reporte de coverage
npm run coverage

# Ver reporte HTML
npm run coverage:html

# Coverage solo para tests unitarios
npm run test:unit -- --coverage
```

### Interpretar Reportes

```
--------------------|---------|----------|---------|---------|-------------------
File                | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
--------------------|---------|----------|---------|---------|-------------------
All files           |   85.42 |    72.15 |   88.31 |   85.42 |
 core/              |   92.15 |    85.71 |   95.45 |   92.15 |
  orchestrator.ts   |   94.12 |    87.50 |  100.00 |   94.12 | 145-147,203
  pipeline.ts       |   90.18 |    83.93 |   90.91 |   90.18 | 78,123-125
--------------------|---------|----------|---------|---------|-------------------
```

## 🔄 CI/CD

### GitHub Actions Workflow

El proyecto incluye un pipeline CI/CD completo que se ejecuta en cada push y PR:

1. **Lint**: Verifica formato y estilo de código
2. **Unit Tests**: Ejecuta tests unitarios con coverage
3. **Integration Tests**: Ejecuta tests de integración
4. **E2E Tests**: Ejecuta tests E2E en múltiples browsers
5. **Build**: Compila el proyecto
6. **Security Audit**: Verifica vulnerabilidades

### Configuración Local para CI

```bash
# Simular CI localmente
npm run test:ci

# Verificar antes de push
npm run prepublishOnly
```

## 📚 Best Practices

### 1. Estructura de Tests

- Usa `describe` para agrupar tests relacionados
- Nombres descriptivos que expliquen QUÉ se está testeando
- Un assert por test cuando sea posible
- Tests independientes que no dependan del orden

### 2. Setup y Teardown

```typescript
beforeAll(async () => {
  // Setup global una vez
});

beforeEach(() => {
  // Setup antes de cada test
});

afterEach(() => {
  // Cleanup después de cada test
});

afterAll(async () => {
  // Cleanup global final
});
```

### 3. Async Testing

```typescript
// ✅ Correcto
it('should handle async operation', async () => {
  const result = await asyncOperation();
  expect(result).toBe(expected);
});

// ❌ Incorrecto - falta await
it('should handle async operation', () => {
  const result = asyncOperation(); // Missing await!
  expect(result).toBe(expected);
});
```

### 4. Mocking Best Practices

```typescript
// Mock solo lo necesario
vi.mock('@/external-service', () => ({
  fetchData: vi.fn(() => mockData)
}));

// Restaurar mocks después de cada test
afterEach(() => {
  vi.clearAllMocks();
});
```

### 5. Test Data

```typescript
// Usar fixtures para datos reutilizables
import { fixtures } from '@tests/helpers/fixtures';

// Crear builders para datos complejos
const user = createUserBuilder()
  .withName('Test User')
  .withRole('admin')
  .build();
```

## 🐛 Debugging

### Debug en VSCode

```json
// .vscode/launch.json
{
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["test", "--", "--no-coverage"],
      "console": "integratedTerminal"
    }
  ]
}
```

### Debug E2E Tests

```bash
# Ejecutar con inspector de Playwright
npm run e2e:debug

# Con browser visible
npm run e2e:headed

# Pausar en un punto específico
await page.pause(); // En el test
```

### Logs y Output

```typescript
// Habilitar logs en tests
process.env.DEBUG = 'true';

// O usar console.log temporalmente
it('debug test', () => {
  console.log('Value:', someValue);
  expect(someValue).toBe(expected);
});
```

### Tips de Debugging

1. **Usa `test.only`** para ejecutar solo un test
2. **Aumenta timeout** para tests lentos: `test.timeout(60000)`
3. **Screenshots en E2E**: Se guardan automáticamente en failures
4. **Trace viewer**: `npx playwright show-trace trace.zip`

## 🔗 Recursos Adicionales

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [GitHub Actions Documentation](https://docs.github.com/actions)

## 🤝 Contribuir

Al agregar nuevas features, asegúrate de:

1. ✅ Escribir tests unitarios para nueva lógica
2. ✅ Agregar tests de integración si hay interacción entre componentes
3. ✅ Actualizar tests E2E si cambia el flujo de usuario
4. ✅ Mantener coverage por encima del 80%
5. ✅ Verificar que todos los tests pasen antes de hacer PR

## 📝 Comandos Rápidos

```bash
# Development workflow
npm test          # Ejecutar todos los tests
npm run test:watch # Watch mode
npm run coverage  # Ver coverage
npm run test:ui   # UI interactiva

# Pre-commit
npm run lint      # Verificar linting
npm run type-check # Verificar tipos
npm run test:ci   # CI completo local

# Debugging
npm run test -- --grep "specific test"
npm run e2e:debug
npm run e2e:codegen
```

---

*Para más información sobre el proyecto, consulta el [README principal](../README.md)*