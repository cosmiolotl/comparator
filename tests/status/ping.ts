import assert from 'node:assert/strict';
import type { ConformanceCase } from '../../src/suite.js';

export default {
  id: 'java.status.ping',
  title: 'Status ping echoes the complete signed 64-bit payload',
  requires: ['status'],
  reference: 'docs/conformance.md#javastatusping',
  async run({ protocol }) {
    const connection = protocol.status();
    await connection.waitFor('server_info', 'status');
    const payload = -0x123456789abcden;
    connection.write('ping', { time: payload });
    const pong = await connection.waitFor('ping', 'status');
    assert.equal(BigInt(String(pong.data.time)), payload, 'Pong payload must match the ping exactly');
  },
} satisfies ConformanceCase;
