import assert from 'node:assert/strict';
import { record } from '../../src/config.js';
import type { ConformanceCase } from '../../src/suite.js';

export default {
  id: 'java.status.response',
  title: 'Status describes the configured protocol and player counts',
  requires: ['status'],
  reference: 'docs/conformance.md#javastatusresponse',
  async run({ protocol }) {
    const connection = protocol.status();
    const packet = await connection.waitFor('server_info', 'status');
    assert.equal(typeof packet.data.response, 'string', 'Status response must contain JSON text');
    const response = record(JSON.parse(packet.data.response as string), 'Status response');
    const version = record(response.version, 'Status version');
    const players = record(response.players, 'Status players');
    assert.equal(version.protocol, protocol.protocolVersion, 'Advertised protocol must match the target');
    assert.equal(typeof version.name, 'string', 'Version name must be a string');
    for (const field of ['online', 'max']) {
      const count = players[field];
      assert.ok(typeof count === 'number' && Number.isInteger(count) && count >= 0,
        `players.${field} must be a nonnegative integer`);
    }
    const description = response.description;
    assert.ok(typeof description === 'string' || (description !== null && typeof description === 'object'),
      'MOTD must be a text component');
  },
} satisfies ConformanceCase;
