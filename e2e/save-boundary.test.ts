import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import test from 'node:test';
import { startControlFixture } from './control-fixture.js';
import { createHarness } from './harness.js';

test('A rejected save flush fails the persistence case before restart', async (context) => {
  const fixture = await startControlFixture({ rejectSave: true });
  context.after(() => fixture.close());
  let calls = 0;
  const control = createServer((_request, response) => {
    calls++;
    response.writeHead(204).end();
  });
  control.listen(0, '127.0.0.1');
  await once(control, 'listening');
  context.after(() => new Promise<void>((done) => control.close(() => done())));
  process.env.COMPARATOR_E2E_PASSWORD = 'rejected-save';
  process.env.COMPARATOR_LIFECYCLE_URL = `http://127.0.0.1:${(control.address() as AddressInfo).port}/restart`;
  process.env.COMPARATOR_LIFECYCLE_TOKEN = 'save-fixture-token';
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
  assert.equal(calls, 0, 'A failed save must never authorize a restart');
  const { result } = await harness.report();
  assert.match(result.cases[0]?.reason ?? '', /save-all flush must return 1/);
});
