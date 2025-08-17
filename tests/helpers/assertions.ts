import type { AgentMessage, AgentResult, CheckpointData, PipelinePhase, PipelineResult } from '@/types';
import { expect } from 'vitest';

/**
 * Custom assertions for testing
 */

/**
 * Assert that a value is a valid pipeline result
 */
export function expectValidPipelineResult(result: unknown): asserts result is PipelineResult {
  expect(result).toBeDefined();
  expect(result).toMatchObject({
    success: expect.any(Boolean),
    pipelineId: expect.stringMatching(/^[0-9a-f-]{36}$/),
    phasesCompleted: expect.any(Array),
  });

  const typedResult = result as PipelineResult;
  expect(typedResult.phasesCompleted).toEqual(
    expect.arrayContaining([expect.stringMatching(/^(brainstorming|architect|development|testing)$/)]),
  );

  if (typedResult.artifacts) {
    expect(typedResult.artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: expect.any(String),
          path: expect.any(String),
          phase: expect.stringMatching(/^(brainstorming|architect|development|testing)$/),
        }),
      ]),
    );
  }

  if (typedResult.metrics) {
    expect(typedResult.metrics).toMatchObject({
      duration: expect.any(Number),
      tokensUsed: expect.any(Number),
      retries: expect.any(Number),
    });
  }
}

/**
 * Assert that a value is a valid agent result
 */
export function expectValidAgentResult(result: unknown): asserts result is AgentResult {
  expect(result).toBeDefined();
  expect(result).toMatchObject({
    success: expect.any(Boolean),
    agentId: expect.any(String),
    data: expect.any(Object),
  });

  if ((result as AgentResult).metadata) {
    expect((result as AgentResult).metadata).toMatchObject({
      duration: expect.any(Number),
    });
  }
}

/**
 * Assert that a value is a valid checkpoint
 */
export function expectValidCheckpoint(checkpoint: unknown): asserts checkpoint is CheckpointData {
  expect(checkpoint).toBeDefined();
  expect(checkpoint).toMatchObject({
    id: expect.any(String),
    pipelineId: expect.any(String),
    phase: expect.stringMatching(/^(brainstorming|architect|development|testing)$/),
    state: expect.objectContaining({
      currentPhase: expect.any(String),
      completedPhases: expect.any(Array),
      context: expect.any(Object),
    }),
    timestamp: expect.any(Date),
    metadata: expect.objectContaining({
      version: expect.any(String),
      compressed: expect.any(Boolean),
    }),
  });
}

/**
 * Assert that a value is a valid agent message
 */
export function expectValidAgentMessage(message: unknown): asserts message is AgentMessage {
  expect(message).toBeDefined();
  expect(message).toMatchObject({
    id: expect.any(String),
    from: expect.any(String),
    to: expect.any(String),
    type: expect.stringMatching(/^(task|response|error|info)$/),
    content: expect.any(Object),
    timestamp: expect.any(Date),
  });
}

/**
 * Assert that an array contains phases in the correct order
 */
export function expectPhasesInOrder(phases: PipelinePhase[]): void {
  const expectedOrder: PipelinePhase[] = ['brainstorming', 'architect', 'development', 'testing'];
  const phaseIndices = phases.map((phase) => expectedOrder.indexOf(phase));

  for (let i = 1; i < phaseIndices.length; i++) {
    expect(phaseIndices[i]).toBeGreaterThanOrEqual(phaseIndices[i - 1]);
  }
}

/**
 * Assert that a promise rejects with a specific error
 */
export async function expectToRejectWith(
  promise: Promise<any>,
  errorType: new (...args: any[]) => Error,
  messagePattern?: string | RegExp,
): Promise<void> {
  try {
    await promise;
    expect.fail('Expected promise to reject');
  } catch (error) {
    expect(error).toBeInstanceOf(errorType);
    if (messagePattern) {
      if (typeof messagePattern === 'string') {
        expect((error as Error).message).toContain(messagePattern);
      } else {
        expect((error as Error).message).toMatch(messagePattern);
      }
    }
  }
}

/**
 * Assert that a value matches a UUID format
 */
export function expectUUID(value: string): void {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  expect(value).toMatch(uuidRegex);
}

/**
 * Assert that timestamps are in chronological order
 */
export function expectChronologicalOrder(timestamps: Date[]): void {
  for (let i = 1; i < timestamps.length; i++) {
    expect(timestamps[i].getTime()).toBeGreaterThanOrEqual(timestamps[i - 1].getTime());
  }
}

/**
 * Assert that a duration is within expected range
 */
export function expectDurationInRange(actualMs: number, expectedMs: number, tolerancePercent = 10): void {
  const tolerance = expectedMs * (tolerancePercent / 100);
  expect(actualMs).toBeGreaterThanOrEqual(expectedMs - tolerance);
  expect(actualMs).toBeLessThanOrEqual(expectedMs + tolerance);
}

/**
 * Assert that an object has required environment variables
 */
export function expectEnvironmentVariables(requiredVars: string[]): void {
  for (const varName of requiredVars) {
    expect(process.env[varName], `Missing environment variable: ${varName}`).toBeDefined();
  }
}

/**
 * Assert that a file path exists
 */
export function expectFileExists(path: string): void {
  const fs = require('fs');
  expect(fs.existsSync(path), `File not found: ${path}`).toBe(true);
}

/**
 * Assert that an array has unique values
 */
export function expectUniqueValues<T>(array: T[]): void {
  const uniqueSet = new Set(array);
  expect(uniqueSet.size).toBe(array.length);
}

/**
 * Assert that a value is within a numeric range
 */
export function expectInRange(value: number, min: number, max: number): void {
  expect(value).toBeGreaterThanOrEqual(min);
  expect(value).toBeLessThanOrEqual(max);
}

/**
 * Assert that an async operation completes within timeout
 */
export async function expectToCompleteWithin(operation: () => Promise<any>, timeoutMs: number): Promise<void> {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs),
  );

  await Promise.race([operation(), timeoutPromise]);
}

/**
 * Assert deep equality with custom comparison
 */
export function expectDeepEqualWithCustom<T>(
  actual: T,
  expected: T,
  customComparator?: (a: any, b: any) => boolean,
): void {
  const deepEqual = (a: any, b: any): boolean => {
    if (customComparator && customComparator(a, b)) {
      return true;
    }

    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== 'object' || typeof b !== 'object') return false;

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!deepEqual(a[key], b[key])) return false;
    }

    return true;
  };

  expect(deepEqual(actual, expected)).toBe(true);
}

/**
 * Assert that a function is called with specific arguments
 */
export function expectCalledWithArgs(mockFn: any, expectedArgs: any[], callIndex = 0): void {
  expect(mockFn).toHaveBeenCalled();
  const calls = mockFn.mock.calls;
  expect(calls.length).toBeGreaterThan(callIndex);
  expect(calls[callIndex]).toEqual(expectedArgs);
}

/**
 * Assert that an error has expected properties
 */
export function expectErrorProperties(error: Error, properties: Record<string, any>): void {
  for (const [key, value] of Object.entries(properties)) {
    expect((error as any)[key]).toEqual(value);
  }
}

/**
 * Helper to create a matcher for partial objects
 */
export function expectPartialMatch<T>(actual: T, expected: Partial<T>): void {
  for (const [key, value] of Object.entries(expected)) {
    expect((actual as any)[key]).toEqual(value);
  }
}
