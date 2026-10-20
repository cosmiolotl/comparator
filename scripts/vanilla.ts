import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { VanillaProcess } from './vanilla-process.js';
import { lifecycleControl } from './lifecycle-control.js';

const project = resolve(import.meta.dirname, '..');
const serverHash = '59353fb40c36d304f2035d51e7d6e6baa98dc05c';
const serverUrl = `https://piston-data.mojang.com/v1/objects/${serverHash}/server.jar`;

async function availablePort(): Promise<number> {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as AddressInfo).port;
  const closed = once(server, 'close');
  server.close();
  await closed;
  return port;
}

async function downloadServer(): Promise<string> {
  const jar = resolve(project, '.local/mojang-1.21.1-server.jar');
  let data = await readFile(jar).catch(() => undefined);
  if (!data || createHash('sha1').update(data).digest('hex') !== serverHash) {
    const response = await fetch(serverUrl, { signal: AbortSignal.timeout(120000) });
    if (!response.ok) throw new Error(`Server download failed: HTTP ${response.status}`);
    data = Buffer.from(await response.arrayBuffer());
    if (createHash('sha1').update(data).digest('hex') !== serverHash) throw new Error('Mojang server SHA-1 mismatch');
    await writeFile(jar, data);
  }
  return jar;
}

async function runCli(config: string, profile: string, filter: string | undefined, signal: AbortSignal): Promise<number> {
  const arguments_ = ['--import', 'tsx', 'src/cli.ts', '--config', config, '--profile', profile, '--strict'];
  if (filter) arguments_.push('--filter', filter);
  const child = spawn(process.execPath, arguments_, { cwd: project, stdio: 'inherit', windowsHide: true });
  let forceTimer: ReturnType<typeof setTimeout> | undefined;
  const onAbort = (): void => {
    child.kill('SIGTERM');
    forceTimer ??= setTimeout(() => child.kill('SIGKILL'), 10000);
  };
  signal.addEventListener('abort', onAbort, { once: true });
  if (signal.aborted) onAbort();
  const timer = setTimeout(onAbort, 1800000);
  try {
    const [code] = await once(child, 'exit') as [number | null, string | null];
    return code ?? 1;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
    clearTimeout(forceTimer);
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: {
    'accept-eula': { type: 'boolean', default: false },
    repeat: { type: 'string', default: '1' },
    filter: { type: 'string' },
    profile: { type: 'string', default: 'all' },
  } });
  if (!values['accept-eula']) {
    throw new Error('Pass --accept-eula only if you agree to https://aka.ms/MinecraftEULA. No server was started.');
  }
  const repeat = Number(values.repeat);
  if (!Number.isInteger(repeat) || repeat < 1 || repeat > 10) throw new Error('--repeat must be 1 through 10');
  if (!['all', 'live', 'protocol', 'world', 'persistence'].includes(values.profile)) throw new Error('Unknown baseline profile');
  await mkdir(resolve(project, '.local'), { recursive: true });
  const jar = await downloadServer();
  const directory = await mkdtemp(resolve(project, '.local/vanilla-run-'));
  const port = await availablePort();
  let controlPort = await availablePort();
  while (controlPort === port) controlPort = await availablePort();
  const password = createHash('sha256').update(directory).digest('hex');
  const properties = {
    'server-ip': '127.0.0.1', 'server-port': port, 'online-mode': false,
    'enforce-secure-profile': false, 'enable-status': true, 'white-list': false,
    'spawn-protection': 0, 'view-distance': 2, 'simulation-distance': 2,
    'enable-rcon': true, 'rcon.port': controlPort, 'rcon.password': password,
    'broadcast-rcon-to-ops': false, 'level-type': 'minecraft:flat',
    'generator-settings': JSON.stringify({ layers: [{ block: 'minecraft:bedrock', height: 1 }], biome: 'minecraft:plains' }),
    'generate-structures': false, 'level-seed': 1, 'max-tick-time': -1,
  };
  await writeFile(resolve(directory, 'server.properties'), Object.entries(properties).map(([key, value]) => `${key}=${value}`).join('\n'));
  await writeFile(resolve(directory, 'eula.txt'), 'eula=true\n');
  const config = resolve(directory, 'comparator.json');
  await writeFile(config, JSON.stringify({
    implementation: 'mojang-1.21.1',
    target: { edition: 'java', host: '127.0.0.1', port, version: '1.21.1' },
    capabilities: ['status', 'login', 'play', 'world', 'restart', 'crashRecovery'],
    adapter: resolve(project, 'implementors/managed-vanilla.ts'),
    control: { host: '127.0.0.1', port: controlPort, passwordEnv: 'COMPARATOR_VANILLA_RCON_PASSWORD' },
    timeoutMs: 90000, reportDirectory: resolve(project, 'reports/vanilla'),
  }, null, 2));
  await writeFile(resolve(directory, 'provenance.json'), JSON.stringify({ version: '1.21.1', serverUrl, serverHash }, null, 2));
  const previousPassword = process.env.COMPARATOR_VANILLA_RCON_PASSWORD;
  process.env.COMPARATOR_VANILLA_RCON_PASSWORD = password;
  const controller = new AbortController();
  const interrupt = (): void => controller.abort();
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  const server = new VanillaProcess(directory, jar, controller);
  const lifecycle = await lifecycleControl(server);
  const previousUrl = process.env.COMPARATOR_LIFECYCLE_URL;
  const previousToken = process.env.COMPARATOR_LIFECYCLE_TOKEN;
  process.env.COMPARATOR_LIFECYCLE_URL = lifecycle.url;
  process.env.COMPARATOR_LIFECYCLE_TOKEN = lifecycle.token;
  console.log(`Verified vanilla 1.21.1; logs and world: ${directory}`);
  try {
    await server.start();
    for (let iteration = 1; iteration <= repeat; iteration++) {
      controller.signal.throwIfAborted();
      console.log(`Vanilla baseline ${iteration}/${repeat}`);
      const code = await runCli(config, values.profile, values.filter, controller.signal);
      if (code !== 0) { process.exitCode = code; break; }
    }
  } finally {
    try {
      try { await lifecycle.close(); } finally { await server.close(); }
    } finally {
      if (previousUrl === undefined) delete process.env.COMPARATOR_LIFECYCLE_URL;
      else process.env.COMPARATOR_LIFECYCLE_URL = previousUrl;
      if (previousToken === undefined) delete process.env.COMPARATOR_LIFECYCLE_TOKEN;
      else process.env.COMPARATOR_LIFECYCLE_TOKEN = previousToken;
      process.removeListener('SIGINT', interrupt);
      process.removeListener('SIGTERM', interrupt);
      if (previousPassword === undefined) delete process.env.COMPARATOR_VANILLA_RCON_PASSWORD;
      else process.env.COMPARATOR_VANILLA_RCON_PASSWORD = previousPassword;
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
