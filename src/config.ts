import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import minecraftData from 'minecraft-data';

export const capabilities = ['status', 'login', 'play', 'world', 'restart', 'crashRecovery'] as const;
export type Capability = (typeof capabilities)[number];

export interface Target {
  edition: 'java';
  host: string;
  port: number;
  version: string;
}

export interface SuiteConfig {
  implementation: string;
  target: Target;
  capabilities: Capability[];
  timeoutMs: number;
  reportDirectory: string;
  adapter?: string;
  control?: { host: string; port: number; passwordEnv: string };
}

export function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} must be a nonempty string`);
  }
  return value;
}

function integer(value: unknown, label: string, maximum: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${label} must be an integer between 1 and ${maximum}`);
  }
  return value;
}

function rejectUnknownKeys(value: Record<string, unknown>, allowed: string[], label: string): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new Error(`Unknown ${label} option: ${key}`);
  }
}

export async function loadConfig(
  filename: string,
  overrides: { host?: string; port?: string; version?: string; reports?: string },
): Promise<SuiteConfig> {
  const source: unknown = JSON.parse(await readFile(filename, 'utf8'));
  const config = record(source, 'Configuration');
  rejectUnknownKeys(config, [
    'implementation', 'target', 'capabilities', 'timeoutMs', 'reportDirectory', 'adapter', 'control',
  ], 'configuration');
  const target = record(config.target, 'target');
  rejectUnknownKeys(target, ['edition', 'host', 'port', 'version'], 'target');
  if (target.edition !== 'java') throw new Error('Only the Java Edition protocol is implemented');
  const version = string(overrides.version ?? target.version, 'target.version');
  const data = minecraftData(version);
  if (!data || !minecraftData.versions.pc.some((entry) => entry.minecraftVersion === version)) {
    throw new Error(`Unknown Java Edition version: ${version}. Use an exact release version.`);
  }
  if (!Array.isArray(config.capabilities) || config.capabilities.length === 0) {
    throw new Error('capabilities must be a nonempty array');
  }
  const declared = config.capabilities.map((entry: unknown) => {
    if (!capabilities.some((capability) => capability === entry)) {
      throw new Error(`Unknown capability: ${String(entry)}`);
    }
    return entry as Capability;
  });
  if (new Set(declared).size !== declared.length) throw new Error('Duplicate capabilities');
  if (declared.includes('play') && !declared.includes('login')) {
    throw new Error('The play capability requires login');
  }
  if (declared.includes('restart') && !declared.includes('world')) {
    throw new Error('The restart capability requires world');
  }
  if (declared.includes('crashRecovery') && !declared.includes('restart')) {
    throw new Error('The crashRecovery capability requires restart');
  }
  const configDirectory = dirname(resolve(filename));
  const result: SuiteConfig = {
    implementation: string(config.implementation, 'implementation'),
    target: {
      edition: 'java',
      host: string(overrides.host ?? target.host, 'target.host'),
      port: integer(overrides.port === undefined ? target.port : Number(overrides.port), 'target.port', 65535),
      version,
    },
    capabilities: declared,
    timeoutMs: integer(config.timeoutMs ?? 10000, 'timeoutMs', 300000),
    reportDirectory: overrides.reports === undefined
      ? resolve(configDirectory, string(config.reportDirectory ?? 'reports', 'reportDirectory'))
      : resolve(overrides.reports),
  };
  if (config.adapter !== undefined) {
    result.adapter = resolve(configDirectory, string(config.adapter, 'adapter'));
  }
  if (config.control !== undefined) {
    const control = record(config.control, 'control');
    rejectUnknownKeys(control, ['host', 'port', 'passwordEnv'], 'control');
    result.control = {
      host: string(control.host ?? result.target.host, 'control.host'),
      port: integer(control.port, 'control.port', 65535),
      passwordEnv: string(control.passwordEnv, 'control.passwordEnv'),
    };
  }
  if (declared.includes('world') && !result.control) {
    throw new Error('The world capability requires RCON control configuration');
  }
  return result;
}
