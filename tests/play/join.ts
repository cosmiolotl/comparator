import assert from 'node:assert/strict';
import type { ConformanceCase } from '../../src/suite.js';

export default {
  id: 'java.play.join',
  title: 'Login advances to play and assigns a valid entity ID',
  requires: ['login', 'play'],
  reference: 'docs/conformance.md#javaplayjoin',
  async run({ protocol, username }) {
    const connection = protocol.login(username);
    await connection.waitFor('success', 'login');
    const login = await connection.waitFor('login', 'play');
    const entityId = login.data.entityId;
    assert.ok(typeof entityId === 'number' && Number.isInteger(entityId), 'Entity ID must be an integer');
    assert.ok(entityId >= -2147483648 && entityId <= 2147483647, 'Entity ID must fit a signed 32-bit integer');
  },
} satisfies ConformanceCase;
