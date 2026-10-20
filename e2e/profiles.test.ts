import assert from 'node:assert/strict';
import test from 'node:test';
import { createHarness } from './harness.js';

test('CLI separates live gameplay from process-control cases without connecting', async (context) => {
  const harness = await createHarness(context, 1);
  const live = await harness.run('--profile', 'live', '--list');
  assert.equal(live.code, 0, live.stderr);
  assert.match(live.stdout, /java\.status\.response/);
  assert.match(live.stdout, /java\.world\.scoreboard\.assign/);
  assert.match(live.stdout, /java\.player\.multiplayer\.last_item/);
  assert.doesNotMatch(live.stdout, /java\.persistence\./);

  const persistence = await harness.run('--profile', 'persistence', '--list');
  assert.equal(persistence.code, 0, persistence.stderr);
  const lines = persistence.stdout.split(/\r?\n/).filter((line) => line.startsWith('java.'));
  assert.equal(lines.length, 20);
  assert.ok(lines.every((line) => line.startsWith('java.persistence.')));
  assert.match(persistence.stdout, /java\.persistence\.clean\.player-inventories/);
  assert.match(persistence.stdout, /java\.persistence\.crash\.scheduled-fluid/);
});
