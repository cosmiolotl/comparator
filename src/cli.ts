import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { loadAdapter } from './adapter.js';
import { loadConfig, record } from './config.js';
import { printCase, writeReports } from './reporters.js';
import { runSuite } from './runner.js';
import { skipReason } from './suite.js';
import { cases } from '../tests/index.js';

const help = `Comparator — Minecraft Java Edition conformance suite

Usage: npm run cts -- [options]

  --config <path>    Implementor config (default: comparator.config.json)
  --host <host>      Override the target hostname
  --port <port>      Override the target TCP port
  --version <name>   Exact Minecraft release, such as 1.21.1
  --filter <text>    Run cases whose stable ID contains this text
  --profile <name>   all (default), protocol, or world
  --reports <path>   Report directory, relative to the working directory
  --list            List selected cases without connecting or loading adapters
  --strict          Return a failure if a selected case is skipped
  --help            Show this help

Exit codes: 0 successful selection; 1 failed/empty/strictly incomplete run;
            2 configuration, harness, or report error; 130 interrupted run.
`;

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      config: { type: 'string', default: 'comparator.config.json' },
      host: { type: 'string' }, port: { type: 'string' }, version: { type: 'string' },
      filter: { type: 'string' }, reports: { type: 'string' },
      profile: { type: 'string', default: 'all' },
      list: { type: 'boolean', default: false }, strict: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
    allowPositionals: false,
  });
  if (values.help) {
    console.log(help);
    return;
  }
  const overrides: { host?: string; port?: string; version?: string; reports?: string } = {};
  if (values.host !== undefined) overrides.host = values.host;
  if (values.port !== undefined) overrides.port = values.port;
  if (values.version !== undefined) overrides.version = values.version;
  if (values.reports !== undefined) overrides.reports = values.reports;
  const config = await loadConfig(values.config, overrides);
  if (!['all', 'protocol', 'world'].includes(values.profile)) throw new Error('Unknown profile; use all, protocol, or world');
  const selected = cases.filter((test) => {
    if (values.filter && !test.id.includes(values.filter)) return false;
    if (values.profile === 'protocol') return !test.requires.includes('world');
    if (values.profile === 'world') return test.requires.includes('world');
    return true;
  });
  if (!selected.length) {
    console.error('No cases matched the selection');
    process.exitCode = 1;
    return;
  }
  if (values.list) {
    for (const test of selected) {
      const reason = skipReason(test, config);
      console.log(`${test.id} — ${test.title}${reason ? ` [SKIP: ${reason}]` : ''}`);
    }
    return;
  }
  const adapter = await loadAdapter(config.adapter);
  const packageJson: unknown = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const version = record(packageJson, 'package.json').version;
  if (typeof version !== 'string') throw new Error('Missing suite version');
  const controller = new AbortController();
  const interrupt = (): void => controller.abort(new Error('Run interrupted'));
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  try {
    console.log(`${config.implementation}: Java ${config.target.version} at ${config.target.host}:${config.target.port}`);
    const result = await runSuite(selected, config, adapter, version, controller.signal, printCase);
    const destination = await writeReports(result, config.reportDirectory);
    const { passed, failed, skipped } = result.summary;
    console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped — ${result.outcome}`);
    for (const error of result.errors) console.error(error);
    console.log(`Reports: ${destination}`);
    process.exitCode = 0;
    if (result.outcome === 'failed' || (values.strict && skipped > 0)) process.exitCode = 1;
    if (result.errors.length) process.exitCode = 2;
    if (controller.signal.aborted) process.exitCode = 130;
  } finally {
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
});
