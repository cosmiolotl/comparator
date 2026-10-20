import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { startControlFixture } from './control-fixture.js';
import { createHarness } from './harness.js';
import { cases } from '../tests/index.js';

for (const options of [{}, { wrongArithmetic: true }, { missingObservation: true }]) {
  const shouldPass = Object.keys(options).length === 0;
  test(`World CLI ${shouldPass ? 'passes fragmented replies' : `rejects ${Object.keys(options)[0]}`}`, async (context) => {
    const fixture = await startControlFixture(options);
    context.after(() => fixture.close());
    process.env.COMPARATOR_E2E_PASSWORD = 'private-fixture-value';
    context.after(() => { delete process.env.COMPARATOR_E2E_PASSWORD; });
    const harness = await createHarness(context, 1, {
      capabilities: ['world'],
      control: { host: '127.0.0.1', port: fixture.port, passwordEnv: 'COMPARATOR_E2E_PASSWORD' },
      timeoutMs: 3000,
    });
    const execution = await harness.run('--filter', 'java.world.scoreboard.multiply-overflow', '--strict');
    assert.equal(execution.code, shouldPass ? 0 : 1, execution.stdout + execution.stderr);
    const { result, junit } = await harness.report();
    assert.deepEqual(result.summary, { passed: shouldPass ? 1 : 0, failed: shouldPass ? 0 : 1, skipped: 0 });
    assert.equal(fixture.commands.filter((command) => command.includes('operation #left')).length, 1, 'No retry hides a deviation');
    assert.ok(fixture.commands.some((command) => command.includes('forceload remove')), 'Arena cleanup ran');
    assert.ok(fixture.commands.includes('tick unfreeze'), 'Suite restored a running clock');
    if (!shouldPass) {
      assert.ok(result.cases[0]?.commands?.some((command) => command.includes('operation')));
      assert.match(junit, /<failure/);
    }
    assert.ok(!JSON.stringify(result).includes('private-fixture-value'));
  });
}

for (const option of ['rejectAuthentication', 'malformedFrame'] as const) {
  test(`World CLI reports ${option} without hanging or leaking credentials`, async (context) => {
    const fixture = await startControlFixture({ [option]: true });
    context.after(() => fixture.close());
    process.env.COMPARATOR_E2E_PASSWORD = 'never-log-this-secret';
    context.after(() => { delete process.env.COMPARATOR_E2E_PASSWORD; });
    const harness = await createHarness(context, 1, {
      capabilities: ['world'],
      control: { host: '127.0.0.1', port: fixture.port, passwordEnv: 'COMPARATOR_E2E_PASSWORD' },
      timeoutMs: 1000,
    });
    const execution = await harness.run('--filter', 'java.world.scoreboard.multiply-overflow');
    assert.notEqual(execution.code, 0);
    const { result } = await harness.report();
    assert.equal(result.summary.failed, 1);
    assert.match(result.cases[0]?.reason ?? '', option === 'rejectAuthentication' ? /authentication rejected/ : /frame length/);
    assert.ok(!JSON.stringify(result).includes('never-log-this-secret'));
  });
}

for (const overshootTicks of [false, true]) {
  test(`Tick fence ${overshootTicks ? 'rejects an extra simulation tick' : 'accepts exact advancement'}`, async (context) => {
    const fixture = await startControlFixture({ overshootTicks });
    context.after(() => fixture.close());
    process.env.COMPARATOR_E2E_PASSWORD = 'clock-fixture';
    context.after(() => { delete process.env.COMPARATOR_E2E_PASSWORD; });
    const harness = await createHarness(context, 1, {
      capabilities: ['world'],
      control: { host: '127.0.0.1', port: fixture.port, passwordEnv: 'COMPARATOR_E2E_PASSWORD' },
      timeoutMs: 3000,
    });
    const execution = await harness.run('--filter', 'java.world.ticks.single-step', '--strict');
    assert.equal(execution.code, overshootTicks ? 1 : 0, execution.stdout + execution.stderr);
    const { result } = await harness.report();
    if (overshootTicks) assert.match(result.cases[0]?.reason ?? '', /Tick stepping overshot/);
  });
}

test('Catalog lists every registered case once and exposes unavailable world coverage', async (context) => {
  const harness = await createHarness(context, 1);
  const listed = await harness.run('--list');
  assert.equal(listed.code, 0, listed.stderr);
  const ids = listed.stdout.split(/\r?\n/).filter((line) => line.startsWith('java.')).map((line) => line.split(' ')[0]);
  assert.equal(ids.length, cases.length);
  assert.equal(new Set(ids).size, cases.length);
  assert.match(listed.stdout, /SKIP: Undeclared capabilities: world/);
});

test('World cases are version gated and strict runs cannot count skips as passes', async (context) => {
  const harness = await createHarness(context, 1, {
    target: { edition: 'java', host: '127.0.0.1', port: 1, version: '1.20.1' },
    capabilities: ['status', 'login', 'play', 'world', 'restart', 'crashRecovery'],
    control: { host: '127.0.0.1', port: 1, passwordEnv: 'UNSET_COMPARATOR_PASSWORD' },
  });
  const execution = await harness.run('--profile', 'world', '--strict');
  assert.equal(execution.code, 1, execution.stdout + execution.stderr);
  const { result } = await harness.report();
  assert.deepEqual(result.summary, { passed: 0, failed: 0, skipped: cases.filter((entry) => entry.requires.includes('world')).length });
  assert.match(result.cases[0]?.reason ?? '', /does not cover Java 1.20.1/);
});

test('Adapter cleanup still runs after both a case and its RCON cleanup time out', async (context) => {
  const fixture = await startControlFixture({ stallAfterOperation: true });
  context.after(() => fixture.close());
  process.env.COMPARATOR_E2E_PASSWORD = 'cleanup-fixture';
  context.after(() => { delete process.env.COMPARATOR_E2E_PASSWORD; });
  const harness = await createHarness(context, 1, {
    capabilities: ['world'],
    control: { host: '127.0.0.1', port: fixture.port, passwordEnv: 'COMPARATOR_E2E_PASSWORD' },
    adapter: './adapter.mjs', timeoutMs: 300,
  });
  await writeFile(join(harness.directory, 'adapter.mjs'), `
import { writeFile } from 'node:fs/promises';
export default {
  name: 'cleanup-fixture',
  afterEach: () => writeFile(new URL('./cleanup-marker', import.meta.url), 'cleaned'),
};
`);
  const execution = await harness.run('--filter', 'java.world.scoreboard.multiply-overflow');
  assert.equal(execution.code, 2, execution.stdout + execution.stderr);
  assert.equal(await readFile(join(harness.directory, 'cleanup-marker'), 'utf8'), 'cleaned');
  const { result } = await harness.report();
  assert.equal(result.summary.failed, 1);
  assert.match(result.cases[0]?.reason ?? '', /world cleanup.*timed out/);
  assert.match(result.errors[0] ?? '', /World clock cleanup.*timed out/);
});
