import { randomBytes, randomInt } from 'node:crypto';
import type { ServerAdapter } from './adapter.js';
import type { SuiteConfig } from './config.js';
import { withDeadline } from './deadline.js';
import { JavaProtocol } from './protocol/java.js';
import { skipReason } from './suite.js';
import type { CaseResult, ConformanceCase } from './suite.js';
import { createWorld, releaseWorld, restoreClock } from './world/fixtures.js';
import type { World } from './world/world.js';

export interface RunResult {
  schemaVersion: 1;
  suiteVersion: string;
  implementation: string;
  adapter: string;
  target: SuiteConfig['target'];
  capabilities: SuiteConfig['capabilities'];
  timeoutMs: number;
  runner: { node: string; platform: string; architecture: string };
  startedAt: string;
  durationMs: number;
  outcome: 'passed' | 'failed' | 'partial';
  summary: { passed: number; failed: number; skipped: number };
  errors: string[];
  cases: CaseResult[];
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.stack ?? error.message;
  return String(error);
}

async function runCase(
  test: ConformanceCase,
  config: SuiteConfig,
  adapter: ServerAdapter,
  username: string,
  parent: AbortSignal,
  arena: number,
): Promise<CaseResult> {
  const startedAt = performance.now();
  const result: CaseResult = {
    id: test.id, title: test.title, reference: test.reference, status: 'passed', durationMs: 0,
  };
  let protocol: JavaProtocol | undefined;
  let world: World | undefined;
  try {
    await withDeadline(config.timeoutMs, test.id, async (signal) => {
      await adapter.beforeEach?.(test.id, signal);
      signal.throwIfAborted();
      protocol = new JavaProtocol(config.target, signal);
      if (test.requires.includes('world')) {
        world = await createWorld(config, signal, arena);
        await world.initialize();
      }
      await test.run({ config, protocol, signal, username, ...(world ? { world } : {}) });
    }, parent);
  } catch (error) {
    result.status = 'failed';
    result.reason = errorMessage(error);
  } finally {
    protocol?.close();
    world?.close();
    const cleanups: Array<{ label: string; run(signal: AbortSignal): Promise<void> }> = [];
    const completedWorld = world;
    if (completedWorld) cleanups.push({ label: 'world cleanup', run: (signal) => releaseWorld(config, completedWorld, signal) });
    cleanups.push({ label: 'adapter cleanup', run: async (signal) => { await adapter.afterEach?.(test.id, signal); } });
    for (const cleanup of cleanups) {
      try {
        // Each cleanup has a fresh deadline; one failing phase cannot suppress another.
        await withDeadline(config.timeoutMs, `${test.id} ${cleanup.label}`, cleanup.run);
      } catch (error) {
        result.status = 'failed';
        result.reason = [result.reason, `${cleanup.label}: ${errorMessage(error)}`].filter(Boolean).join('\n');
      }
    }
  }
  if (result.status === 'failed') result.trace = protocol?.snapshot() ?? [];
  if (result.status === 'failed' && world) result.commands = [...world.trace];
  result.durationMs = Math.round(performance.now() - startedAt);
  return result;
}

export async function runSuite(
  tests: readonly ConformanceCase[],
  config: SuiteConfig,
  adapter: ServerAdapter,
  suiteVersion: string,
  signal: AbortSignal,
  onResult: (result: CaseResult) => void,
): Promise<RunResult> {
  if (!tests.length) throw new Error('No test cases selected');
  if (new Set(tests.map((test) => test.id)).size !== tests.length) {
    throw new Error('Conformance case IDs must be unique');
  }
  const startedAt = new Date();
  const start = performance.now();
  const cases: CaseResult[] = [];
  const errors: string[] = [];
  const usernamePrefix = `cts_A${randomBytes(4).toString('hex')}`;
  const firstArena = randomInt(0, 100000);
  let usedWorld = false;
  try {
    await withDeadline(config.timeoutMs, 'Adapter setup', async (setupSignal) => {
      await adapter.setup?.(config, setupSignal);
    }, signal);
    for (const [index, test] of tests.entries()) {
      signal.throwIfAborted();
      const reason = skipReason(test, config);
      let result: CaseResult;
      if (reason) {
        result = {
          id: test.id, title: test.title, reference: test.reference,
          status: 'skipped', reason, durationMs: 0,
        };
      } else {
        usedWorld ||= test.requires.includes('world');
        result = await runCase(test, config, adapter, `${usernamePrefix}${index.toString(36)}`, signal, firstArena + index);
      }
      cases.push(result);
      onResult(result);
    }
  } catch (error) {
    errors.push(errorMessage(error));
  } finally {
    if (usedWorld) {
      try {
        await withDeadline(config.timeoutMs, 'World clock cleanup', (cleanupSignal) => restoreClock(config, cleanupSignal));
      } catch (error) {
        errors.push(errorMessage(error));
      }
    }
    try {
      await withDeadline(config.timeoutMs, 'Adapter teardown', async (teardownSignal) => {
        await adapter.teardown?.(teardownSignal);
      });
    } catch (error) {
      errors.push(errorMessage(error));
    }
  }
  for (const test of tests.slice(cases.length)) {
    const result: CaseResult = {
      id: test.id, title: test.title, reference: test.reference,
      status: 'skipped', reason: 'Run interrupted by a harness error', durationMs: 0,
    };
    cases.push(result);
    onResult(result);
  }
  const summary = { passed: 0, failed: 0, skipped: 0 };
  for (const result of cases) summary[result.status]++;
  let outcome: RunResult['outcome'] = 'passed';
  if (summary.skipped > 0) outcome = 'partial';
  if (summary.failed > 0 || errors.length > 0 || summary.passed === 0) outcome = 'failed';
  return {
    schemaVersion: 1, suiteVersion, implementation: config.implementation,
    adapter: adapter.name, target: config.target, capabilities: config.capabilities, timeoutMs: config.timeoutMs,
    runner: { node: process.version, platform: process.platform, architecture: process.arch },
    startedAt: startedAt.toISOString(), durationMs: Math.round(performance.now() - start),
    outcome, summary, errors, cases,
  };
}
