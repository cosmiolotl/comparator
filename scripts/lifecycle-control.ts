import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { VanillaProcess } from './vanilla-process.js';

export async function lifecycleControl(process: VanillaProcess) {
  const token = randomBytes(32).toString('hex');
  let active: Promise<void> | undefined;
  let closing = false;
  const server = createServer((request, response) => {
    if (request.method !== 'POST' || request.url !== '/restart'
      || request.headers.authorization !== `Bearer ${token}`) {
      response.writeHead(403).end();
      return;
    }
    const mode = request.headers['x-comparator-mode'];
    if (mode !== 'clean' && mode !== 'crash') { response.writeHead(400).end(); return; }
    if (closing || active) { response.writeHead(409).end(); return; }
    active = process.restart(mode).then(
      () => { response.writeHead(204).end(); },
      (error: unknown) => { response.writeHead(500).end(error instanceof Error ? error.message : 'Restart failed'); },
    ).finally(() => { active = undefined; });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/restart`,
    token,
    async close(): Promise<void> {
      closing = true;
      await active;
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    },
  };
}
