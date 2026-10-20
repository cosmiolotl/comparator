import { pathToFileURL } from 'node:url';
import { record } from './config.js';
import type { SuiteConfig } from './config.js';

export interface ServerAdapter {
  name: string;
  setup?(config: SuiteConfig, signal: AbortSignal): Promise<void>;
  beforeEach?(caseId: string, signal: AbortSignal): Promise<void>;
  afterEach?(caseId: string, signal: AbortSignal): Promise<void>;
  teardown?(signal: AbortSignal): Promise<void>;
  restart?(mode: 'clean' | 'crash', signal: AbortSignal): Promise<void>;
}

export async function loadAdapter(filename?: string): Promise<ServerAdapter> {
  if (!filename) return { name: 'external' };
  const module: unknown = await import(pathToFileURL(filename).href);
  const adapter = record(record(module, 'Adapter module').default, 'Default adapter export');
  if (typeof adapter.name !== 'string' || !adapter.name.trim()) {
    throw new Error('An adapter must have a nonempty name');
  }
  for (const hook of ['setup', 'beforeEach', 'afterEach', 'teardown', 'restart']) {
    if (adapter[hook] !== undefined && typeof adapter[hook] !== 'function') {
      throw new Error(`Adapter ${hook} must be a function`);
    }
  }
  return adapter as unknown as ServerAdapter;
}
