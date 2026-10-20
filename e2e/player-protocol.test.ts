import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo, Server as TcpServer } from 'node:net';
import test from 'node:test';
import type { TestContext } from 'node:test';
import minecraftData from 'minecraft-data';
import minecraftProtocol from 'minecraft-protocol';
import { runSuite } from '../src/runner.js';
import type { ConformanceCase } from '../src/suite.js';

async function fixture(context: TestContext): Promise<number> {
  const server = minecraftProtocol.createServer({
    host: '127.0.0.1', port: 0, version: '1.21.1',
    'online-mode': false, enforceSecureProfile: false, hideErrors: true,
  });
  server.on('playerJoin', (client: minecraftProtocol.ServerClient) => {
    client.write('login', {
      ...minecraftData('1.21.1').loginPacket, entityId: client.id,
      isHardcore: false, gameMode: 0, previousGameMode: 1, hashedSeed: [0, 0],
      maxPlayers: 20, viewDistance: 2, reducedDebugInfo: false,
      enableRespawnScreen: true, isDebug: false, isFlat: true, enforcesSecureChat: false,
    });
    client.on('client_command', () => {
      client.write('bundle_delimiter', {});
      client.write('statistics', { entries: [] });
      client.write('bundle_delimiter', {});
    });
    client.on('position', () => {
      client.write('kick_disconnect', {
        reason: { type: 'compound', value: { translate: { type: 'string', value: 'multiplayer.disconnect.invalid_player_movement' } } },
      });
      client.end();
    });
  });
  await once(server, 'listening');
  context.after(async () => {
    const closed = once(server, 'close');
    server.close();
    for (const client of Object.values(server.clients)) client.socket.destroy();
    await closed;
  });
  const socketServer = (server as unknown as { socketServer: TcpServer }).socketServer;
  return (socketServer.address() as AddressInfo).port;
}

async function run(port: number, runCase: ConformanceCase['run']) {
  return runSuite([{
    id: 'fixture.player.protocol', title: 'Player protocol harness fixture',
    requires: ['login', 'play'], reference: 'docs/research-player.md#player-input', run: runCase,
  }], {
    implementation: 'tcp-fixture', target: { edition: 'java', host: '127.0.0.1', port, version: '1.21.1' },
    capabilities: ['login', 'play'], timeoutMs: 5000, reportDirectory: '.local/unused',
  }, { name: 'external' }, 'test', AbortSignal.timeout(10000), () => {});
}

for (const callback of ['observer', 'predicate'] as const) {
  test(`Runner reports a ${callback} failure from a live packet and cleans up`, { timeout: 15000 }, async (context) => {
    const port = await fixture(context);
    const report = await run(port, async ({ protocol, username }) => {
      const session = protocol.login(username);
      await session.waitFor('login', 'play');
      if (callback === 'observer') session.observe((packet) => {
        if (packet.name === 'statistics') throw new Error('Malformed observed statistics');
      });
      const received = session.waitFor('statistics', 'play', () => {
        if (callback === 'predicate') throw new Error('Malformed predicate statistics');
        return true;
      });
      session.write('client_command', { actionId: 'request_stats' });
      await received;
    });
    assert.deepEqual(report.summary, { passed: 0, failed: 1, skipped: 0 });
    assert.match(report.cases[0]?.reason ?? '', /Malformed (observed|predicate) statistics/);
    assert.equal(report.errors.length, 0);
  });
}

test('Runner accepts empty bundle delimiters and explicitly expected disconnect packets', { timeout: 15000 }, async (context) => {
  const port = await fixture(context);
  const report = await run(port, async ({ protocol, username }) => {
    const session = protocol.login(username);
    await session.waitFor('login', 'play');
    const statistics = session.waitFor('statistics', 'play');
    session.write('client_command', { actionId: 'request_stats' });
    assert.deepEqual((await statistics).data.entries, []);
    const disconnected = session.waitForDisconnect();
    session.write('position', { x: Number.NaN, y: 64, z: 0, onGround: true });
    assert.match(JSON.stringify((await disconnected).data.reason), /invalid_player_movement/);
  });
  assert.deepEqual(report.summary, { passed: 1, failed: 0, skipped: 0 });
});
