import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import type { TestContext } from 'node:test';
import type { SuiteConfig } from '../src/config.js';
import type { RunResult } from '../src/runner.js';

const exec = promisify(execFile);
const project = resolve(import.meta.dirname, '..');

export async function createHarness(
  context: TestContext,
  port: number,
  overrides: Partial<SuiteConfig> = {},
) {
  const directory = await mkdtemp(join(tmpdir(), 'comparator-e2e-'));
  context.after(async () => {
    if (dirname(directory) !== resolve(tmpdir()) || !basename(directory).startsWith('comparator-e2e-')) {
      throw new Error(`Refusing to remove an unexpected temporary directory: ${directory}`);
    }
    await rm(directory, { recursive: true, force: true });
  });
  const reports = join(directory, 'reports');
  const config: SuiteConfig = {
    implementation: 'protocol-fixture',
    target: { edition: 'java', host: '127.0.0.1', port, version: '1.21.1' },
    capabilities: ['status', 'login', 'play'], timeoutMs: 5000,
    reportDirectory: reports,
    ...overrides,
  };
  const configPath = join(directory, 'config.json');
  await writeFile(configPath, JSON.stringify(config));
  return {
    directory,
    async run(...arguments_: string[]) {
      try {
        const { stdout, stderr } = await exec(process.execPath, [
          '--import', 'tsx', 'src/cli.ts', '--config', configPath, ...arguments_,
        ], { cwd: project, timeout: 30000, windowsHide: true });
        return { code: 0, stdout, stderr };
      } catch (error) {
        const failure = error as Error & {
          code?: number | string; stdout?: string; stderr?: string; killed?: boolean;
        };
        if (failure.killed || typeof failure.code !== 'number') throw error;
        return { code: failure.code, stdout: failure.stdout ?? '', stderr: failure.stderr ?? '' };
      }
    },
    async report() {
      const directories = await readdir(reports);
      if (directories.length !== 1) throw new Error(`Expected one report, found ${directories.length}`);
      const destination = join(reports, directories[0]!);
      const result = JSON.parse(await readFile(join(destination, 'results.json'), 'utf8')) as RunResult;
      const junit = await readFile(join(destination, 'junit.xml'), 'utf8');
      return { result, junit };
    },
  };
}
