import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import test from 'node:test';
import { startControlFixture } from './control-fixture.js';
import { createHarness } from './harness.js';

for (const mode of ['clean', 'crash'] as const) {
  test(`Persistence CLI saves, requests ${mode}, reconnects and verifies retained state`, async (context) => {
    const fixture = await startControlFixture();
    context.after(() => fixture.close());
    let calls = 0;
    let commandCountAtRestart = 0;
    const control = createServer((request, response) => {
      assert.equal(request.method, 'POST');
      assert.equal(request.headers['x-comparator-mode'], mode);
      assert.equal(request.headers.authorization, 'Bearer fixture-lifecycle-token');
      assert.ok(fixture.commands.includes('execute store result score #actual cts run save-all flush'));
      commandCountAtRestart = fixture.commands.length;
      calls++;
      response.writeHead(204).end();
    });
    control.listen(0, '127.0.0.1');
    await once(control, 'listening');
    context.after(() => new Promise<void>((done) => control.close(() => done())));
    process.env.COMPARATOR_E2E_PASSWORD = 'persist-fixture';
    process.env.COMPARATOR_LIFECYCLE_URL = `http://127.0.0.1:${(control.address() as AddressInfo).port}/restart`;
    process.env.COMPARATOR_LIFECYCLE_TOKEN = 'fixture-lifecycle-token';
    context.after(() => {
      delete process.env.COMPARATOR_E2E_PASSWORD;
      delete process.env.COMPARATOR_LIFECYCLE_URL;
      delete process.env.COMPARATOR_LIFECYCLE_TOKEN;
    });
    const harness = await createHarness(context, 1, {
      capabilities: ['world', 'restart', 'crashRecovery'],
      control: { host: '127.0.0.1', port: fixture.port, passwordEnv: 'COMPARATOR_E2E_PASSWORD' },
      adapter: resolve('implementors/managed-vanilla.ts'), timeoutMs: 3000,
    });
    const execution = await harness.run('--filter', `java.persistence.${mode}.storage-scores`, '--strict');
    assert.equal(execution.code, 0, execution.stdout + execution.stderr);
    assert.equal(calls, 1, 'A restart is never retried');
    const afterRestart = fixture.commands.slice(commandCountAtRestart);
    assert.ok(afterRestart.includes('tick freeze'));
    assert.ok(afterRestart.includes('forceload add ~-16 ~-16 ~31 ~31'));
    assert.ok(!afterRestart.some((command) => command.startsWith('scoreboard players reset *')),
      'Restart must not reset the state being verified');
    const { result } = await harness.report();
    assert.deepEqual(result.summary, { passed: 1, failed: 0, skipped: 0 });
    assert.ok(!JSON.stringify(result).includes('fixture-lifecycle-token'));
  });
}

test('A declared restart capability fails when its adapter has no restart operation', async (context) => {
  const fixture = await startControlFixture();
  context.after(() => fixture.close());
  process.env.COMPARATOR_E2E_PASSWORD = 'missing-restart';
  context.after(() => { delete process.env.COMPARATOR_E2E_PASSWORD; });
  const harness = await createHarness(context, 1, {
    capabilities: ['world', 'restart'],
    control: { host: '127.0.0.1', port: fixture.port, passwordEnv: 'COMPARATOR_E2E_PASSWORD' },
  });
  const execution = await harness.run('--filter', 'java.persistence.clean.storage-scores', '--strict');
  assert.equal(execution.code, 1, execution.stdout + execution.stderr);
  const { result } = await harness.report();
  assert.match(result.cases[0]?.reason ?? '', /requires adapter.restart/);
  assert.ok(fixture.commands.some((command) => command.includes('forceload remove')));
});

test('Restart cannot pass after the control peer loses its saved state', async (context) => {
  const fixture = await startControlFixture();
  context.after(() => fixture.close());
  const control = createServer((_request, response) => {
    fixture.forgetSavedState();
    response.writeHead(204).end();
  });
  control.listen(0, '127.0.0.1');
  await once(control, 'listening');
  context.after(() => new Promise<void>((done) => control.close(() => done())));
  process.env.COMPARATOR_E2E_PASSWORD = 'lost-state';
  process.env.COMPARATOR_LIFECYCLE_URL = `http://127.0.0.1:${(control.address() as AddressInfo).port}/restart`;
  process.env.COMPARATOR_LIFECYCLE_TOKEN = 'fixture-lifecycle-token';
  context.after(() => {
    delete process.env.COMPARATOR_E2E_PASSWORD;
    delete process.env.COMPARATOR_LIFECYCLE_URL;
    delete process.env.COMPARATOR_LIFECYCLE_TOKEN;
  });
  const harness = await createHarness(context, 1, {
    capabilities: ['world', 'restart'],
    control: { host: '127.0.0.1', port: fixture.port, passwordEnv: 'COMPARATOR_E2E_PASSWORD' },
    adapter: resolve('implementors/managed-vanilla.ts'), timeoutMs: 3000,
  });
  const execution = await harness.run('--filter', 'java.persistence.clean.storage-scores', '--strict');
  assert.equal(execution.code, 1, execution.stdout + execution.stderr);
  const { result } = await harness.report();
  assert.match(result.cases[0]?.reason ?? '', /saved observation token must survive restart/i);
});
