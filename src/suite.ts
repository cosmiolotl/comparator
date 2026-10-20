import type { Capability, SuiteConfig } from './config.js';
import type { JavaProtocol } from './protocol/java.js';
import type { World } from './world/world.js';

export interface CaseContext {
  config: SuiteConfig;
  protocol: JavaProtocol;
  signal: AbortSignal;
  username: string;
  world?: World;
}

export interface ConformanceCase {
  id: string;
  title: string;
  requires: readonly Capability[];
  reference: string;
  versions?: readonly string[];
  run(context: CaseContext): Promise<void>;
}

export interface CaseResult {
  id: string;
  title: string;
  reference: string;
  status: 'passed' | 'failed' | 'skipped';
  durationMs: number;
  reason?: string;
  trace?: ReturnType<JavaProtocol['snapshot']>;
  commands?: string[];
}

export function skipReason(test: ConformanceCase, config: SuiteConfig): string | undefined {
  const missing = test.requires.filter((capability) => !config.capabilities.includes(capability));
  if (missing.length) return `Undeclared capabilities: ${missing.join(', ')}`;
  if (test.versions && !test.versions.includes(config.target.version)) {
    return `Case does not cover Java ${config.target.version}`;
  }
  return undefined;
}
