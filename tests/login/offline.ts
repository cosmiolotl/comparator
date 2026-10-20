import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import type { ConformanceCase } from '../../src/suite.js';

function offlineUuid(username: string): string {
  const digest = createHash('md5').update(`OfflinePlayer:${username}`, 'utf8').digest();
  digest[6] = (digest[6]! & 0x0f) | 0x30;
  digest[8] = (digest[8]! & 0x3f) | 0x80;
  const hex = digest.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export default {
  id: 'java.login.offline',
  title: 'Offline login preserves the username and assigns its offline UUID',
  requires: ['login'],
  reference: 'docs/conformance.md#javaloginoffline',
  async run({ protocol, username }) {
    const connection = protocol.login(username);
    const success = await connection.waitFor('success', 'login');
    assert.equal(success.data.username, username, 'Login success must preserve the username');
    assert.equal(success.data.uuid, offlineUuid(username), 'UUID must use the offline identity algorithm');
  },
} satisfies ConformanceCase;
