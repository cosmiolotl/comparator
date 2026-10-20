import assert from 'node:assert/strict';
import test from 'node:test';
import type { TestContext } from 'node:test';
import type { SuiteConfig } from '../src/config.js';
import { Rcon } from '../src/control/rcon.js';
import { runSuite } from '../src/runner.js';
import type { ConformanceCase } from '../src/suite.js';
import { startControlFixture } from './control-fixture.js';

function configuration(context: TestContext, port: number): SuiteConfig {
  const passwordEnv = 'COMPARATOR_CLEANUP_E2E_PASSWORD';
  const previous = process.env[passwordEnv];
  process.env[passwordEnv] = 'cleanup-fixture';
  context.after(() => {
    if (previous === undefined) delete process.env[passwordEnv];
    else process.env[passwordEnv] = previous;
  });
  return {
    implementation: 'rcon-cleanup-fixture',
    target: { edition: 'java', host: '127.0.0.1', port: 1, version: '1.21.1' },
    capabilities: ['world'], timeoutMs: 1500, reportDirectory: '.local/unused',
    control: { host: '127.0.0.1', port, passwordEnv },
  };
}

function latch() {
  let release: () => void = () => {};
  const ready = new Promise<void>((resolve) => { release = resolve; });
  return { ready, release };
}

async function command(port: number, signal: AbortSignal, text: string): Promise<string> {
  const connection = await Rcon.connect('127.0.0.1', port, 'cleanup-fixture', signal);
  try {
    return await connection.command(text);
  } finally {
    connection.close();
  }
}

test('Timed-out RCON cases await registered cleanup before adapter cleanup and the next case', { timeout: 10000 }, async (context) => {
  const fixture = await startControlFixture();
  context.after(() => fixture.close());
  const stalled = await startControlFixture({ stallAfterOperation: true });
  context.after(() => stalled.close());
  const config = configuration(context, fixture.port);
  const cleanupStarted = latch();
  const allowCleanup = latch();
  const events: string[] = [];
  let rejectedLateRegistration = false;
  let ranLateCleanup = false;
  const cases: ConformanceCase[] = [{
    id: 'fixture.cleanup.case-timeout', title: 'A stalled RCON case owns deferred cleanup',
    requires: ['world'], reference: 'src/runner.ts',
    async run({ signal, deferCleanup, world }) {
      assert.ok(world);
      await world.command('scoreboard players set #case_started cts 1');
      deferCleanup('remote resource cleanup', async (cleanupSignal) => {
        assert.notEqual(cleanupSignal, signal);
        assert.equal(cleanupSignal.aborted, false);
        await command(fixture.port, cleanupSignal, 'scoreboard players set #cleanup_started cts 1');
        events.push('cleanup started');
        cleanupStarted.release();
        await allowCleanup.ready;
        await command(fixture.port, cleanupSignal, 'scoreboard players set #cleanup_finished cts 1');
        events.push('cleanup finished');
      });
      try {
        await command(stalled.port, signal, 'scoreboard players operation #left cts *= #right cts');
      } finally {
        try {
          deferCleanup('too late', async () => { ranLateCleanup = true; });
        } catch {
          rejectedLateRegistration = true;
        }
      }
    },
  }, {
    id: 'fixture.cleanup.next-case', title: 'The next case observes the completed cleanup',
    requires: [], reference: 'src/runner.ts',
    async run({ signal }) {
      events.push('next case');
      assert.match(await command(fixture.port, signal, 'scoreboard players get #cleanup_finished cts'), /has 1 \[cts\]/);
    },
  }];
  const completion = runSuite(cases, config, {
    name: 'cleanup-order-fixture',
    async afterEach(caseId, signal) {
      events.push(`adapter ${caseId}`);
      assert.match(await command(fixture.port, signal, 'scoreboard players get #cleanup_finished cts'), /has 1 \[cts\]/);
    },
  }, 'test', context.signal, () => {});
  try {
    await Promise.race([
      cleanupStarted.ready,
      completion.then(() => { throw new Error('The suite completed before deferred cleanup started'); }),
    ]);
    assert.deepEqual(events, ['cleanup started']);
    assert.ok(!fixture.commands.some((entry) => entry.includes('forceload remove')), 'World cleanup must also await deferred cleanup');
  } finally {
    allowCleanup.release();
  }
  const report = await completion;
  assert.deepEqual(report.summary, { passed: 1, failed: 1, skipped: 0 });
  assert.match(report.cases[0]?.reason ?? '', /case-timeout timed out after 1500 ms/);
  assert.deepEqual(report.errors, []);
  assert.equal(rejectedLateRegistration, true);
  assert.equal(ranLateCleanup, false);
  assert.deepEqual(events, [
    'cleanup started', 'cleanup finished', 'adapter fixture.cleanup.case-timeout',
    'next case', 'adapter fixture.cleanup.next-case',
  ]);
  assert.ok(fixture.commands.some((entry) => entry.includes('forceload remove')), 'World cleanup still ran');
  assert.ok(fixture.commands.includes('tick unfreeze'), 'The suite restored the clock');
});

test('A timed-out deferred RCON cleanup fails the case and still runs later, world, and adapter cleanup', { timeout: 10000 }, async (context) => {
  const fixture = await startControlFixture();
  context.after(() => fixture.close());
  const stalled = await startControlFixture({ stallAfterOperation: true });
  context.after(() => stalled.close());
  const config = configuration(context, fixture.port);
  const events: string[] = [];
  const report = await runSuite([{
    id: 'fixture.cleanup.cleanup-timeout', title: 'Each cleanup receives its own deadline',
    requires: ['world'], reference: 'src/runner.ts',
    async run({ deferCleanup, world }) {
      assert.ok(world);
      await world.command('scoreboard players set #case_completed cts 1');
      deferCleanup('stalled remote cleanup', async (signal) => {
        events.push('stalled cleanup');
        await command(stalled.port, signal, 'scoreboard players operation #left cts *= #right cts');
      });
      deferCleanup('remaining remote cleanup', async (signal) => {
        assert.equal(signal.aborted, false);
        await command(fixture.port, signal, 'scoreboard players set #remaining_cleanup cts 1');
        events.push('remaining cleanup');
      });
    },
  }], config, {
    name: 'cleanup-failure-fixture',
    async afterEach(_, signal) {
      assert.match(await command(fixture.port, signal, 'scoreboard players get #remaining_cleanup cts'), /has 1 \[cts\]/);
      assert.ok(fixture.commands.some((entry) => entry.includes('forceload remove')));
      events.push('adapter cleanup');
    },
  }, 'test', context.signal, () => {});
  assert.deepEqual(report.summary, { passed: 0, failed: 1, skipped: 0 });
  assert.match(report.cases[0]?.reason ?? '', /stalled remote cleanup:.*stalled remote cleanup timed out after 1500 ms/);
  assert.deepEqual(report.errors, []);
  assert.deepEqual(events, ['stalled cleanup', 'remaining cleanup', 'adapter cleanup']);
  const remaining = fixture.commands.indexOf('scoreboard players set #remaining_cleanup cts 1');
  const worldRelease = fixture.commands.findIndex((entry) => entry.includes('forceload remove'));
  assert.ok(remaining >= 0 && worldRelease > remaining, 'Deferred cleanup completed before the world was released');
  assert.ok(fixture.commands.includes('tick unfreeze'));
});
