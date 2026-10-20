import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import type { AddressInfo, Socket } from 'node:net';
import { join } from 'node:path';
import test from 'node:test';
import { startFixture } from './fixture.js';
import { createHarness } from './harness.js';

for (const version of ['1.20.1', '1.21.1']) {
  test(`CLI passes the starter suite over TCP on Java ${version}`, { timeout: 45000 }, async (context) => {
    const fixture = await startFixture({ version });
    context.after(() => fixture.close());
    const harness = await createHarness(context, fixture.port, {
      target: { edition: 'java', host: '127.0.0.1', port: fixture.port, version },
    });
    const execution = await harness.run('--profile', 'protocol', '--strict');
    assert.equal(execution.code, 0, execution.stdout + execution.stderr);
    const { result, junit } = await harness.report();
    assert.deepEqual(result.summary, { passed: 4, failed: 0, skipped: 0 });
    assert.equal(result.target.version, version);
    assert.match(junit, /tests="4" failures="0" skipped="0" errors="0"/);
  });
}

test('Capability omissions are visible and strict runs reject partial coverage', async (context) => {
  const fixture = await startFixture();
  context.after(() => fixture.close());
  const harness = await createHarness(context, fixture.port, { capabilities: ['status'] });
  const execution = await harness.run('--profile', 'protocol', '--strict');
  assert.equal(execution.code, 1, execution.stdout + execution.stderr);
  const { result, junit } = await harness.report();
  assert.equal(result.outcome, 'partial');
  assert.deepEqual(result.summary, { passed: 2, failed: 0, skipped: 2 });
  assert.match(junit, /<skipped message="Undeclared capabilities:/);
});

for (const scenario of [
  { option: 'invalidStatus', filter: 'status.response', reason: /nonnegative integer/ },
  { option: 'invalidPong', filter: 'status.ping', reason: /Pong payload/ },
  { option: 'invalidIdentity', filter: 'login.offline', reason: /offline identity algorithm/ },
] as const) {
  test(`A server with ${scenario.option} fails conformance with diagnostics`, async (context) => {
    const fixture = await startFixture({ [scenario.option]: true });
    context.after(() => fixture.close());
    const harness = await createHarness(context, fixture.port, { implementation: 'broken <server> & fixture' });
    const execution = await harness.run('--filter', scenario.filter);
    assert.equal(execution.code, 1, execution.stdout + execution.stderr);
    const { result, junit } = await harness.report();
    assert.equal(result.summary.failed, 1);
    assert.match(result.cases[0]?.reason ?? '', scenario.reason);
    assert.ok(result.cases[0]?.trace?.[0]?.packets.length);
    assert.match(junit, /broken &lt;server&gt; &amp; fixture/);
    assert.match(junit, /<failure/);
  });
}

for (const disconnect of [false, true]) {
  test(`CLI cleans up a ${disconnect ? 'disconnected' : 'silent'} TCP peer`, async (context) => {
    const sockets = new Set<Socket>();
    const server = createServer((socket) => {
      sockets.add(socket);
      socket.on('error', () => {});
      socket.once('close', () => sockets.delete(socket));
      if (disconnect) socket.destroy();
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    context.after(async () => {
      const closed = once(server, 'close');
      server.close();
      for (const socket of sockets) socket.destroy();
      await closed;
    });
    const { port } = server.address() as AddressInfo;
    const harness = await createHarness(context, port, { timeoutMs: disconnect ? 2000 : 200 });
    const execution = await harness.run('--filter', 'status.response');
    assert.equal(execution.code, 1, execution.stdout + execution.stderr);
    const { result } = await harness.report();
    const expected = disconnect ? /Connection ended|ECONNRESET|ECONNABORTED|EPIPE/ : /timed out/;
    assert.match(result.cases[0]?.reason ?? '', expected);
  });
}

test('List and empty selections never connect to a target', async (context) => {
  const harness = await createHarness(context, 1);
  const listed = await harness.run('--list');
  assert.equal(listed.code, 0, listed.stderr);
  assert.match(listed.stdout, /java.play.join/);
  const empty = await harness.run('--filter', 'does-not-exist');
  assert.equal(empty.code, 1);
  assert.match(empty.stderr, /No cases matched/);
});

test('Unknown configuration options fail before connecting', async (context) => {
  const harness = await createHarness(context, 1);
  const configPath = join(harness.directory, 'config.json');
  const configuration: Record<string, unknown> = JSON.parse(await readFile(configPath, 'utf8'));
  configuration.capabilties = ['status'];
  await writeFile(configPath, JSON.stringify(configuration));
  const execution = await harness.run();
  assert.equal(execution.code, 2);
  assert.match(execution.stderr, /Unknown configuration option: capabilties/);
});

test('Implementor hooks run in order and teardown failures reach both reports', async (context) => {
  const fixture = await startFixture();
  context.after(() => fixture.close());
  const harness = await createHarness(context, fixture.port, { adapter: './adapter.mjs' });
  const hooksPath = join(harness.directory, 'hooks.log');
  await writeFile(join(harness.directory, 'adapter.mjs'), `
import { appendFile } from 'node:fs/promises';
const log = (value) => appendFile(new URL('./hooks.log', import.meta.url), value + '\\n');
export default {
  name: 'e2e-adapter',
  setup: () => log('setup'),
  beforeEach: (id) => log('before:' + id),
  afterEach: (id) => log('after:' + id),
  async teardown() {
    await log('teardown');
    throw new Error('teardown fixture failure');
  },
};
`);
  const execution = await harness.run('--filter', 'status.response');
  assert.equal(execution.code, 2, execution.stdout + execution.stderr);
  assert.equal(await readFile(hooksPath, 'utf8'),
    'setup\nbefore:java.status.response\nafter:java.status.response\nteardown\n');
  const { result, junit } = await harness.report();
  assert.equal(result.summary.passed, 1);
  assert.match(result.errors[0] ?? '', /teardown fixture failure/);
  assert.match(junit, /errors="1"/);
});
