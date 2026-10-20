import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RunResult } from './runner.js';
import type { CaseResult } from './suite.js';

function escapeXml(value: string): string {
  const escapes: Record<string, string> = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  };
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '')
    .replace(/[&<>"']/g, (character) => escapes[character]!);
}

function junitCase(result: CaseResult): string {
  const attributes = `name="${escapeXml(result.id)}" classname="minecraft.java" time="${result.durationMs / 1000}"`;
  let detail = '';
  if (result.status === 'skipped') detail = `<skipped message="${escapeXml(result.reason ?? '')}"/>`;
  if (result.status === 'failed') {
    detail = `<failure message="${escapeXml(result.title)}">${escapeXml(result.reason ?? '')}</failure>`;
  }
  return `  <testcase ${attributes}>${detail}</testcase>`;
}

function junit(result: RunResult): string {
  const attributes = [
    `name="${escapeXml(result.implementation)}"`,
    `tests="${result.cases.length + result.errors.length}"`,
    `failures="${result.summary.failed}"`,
    `skipped="${result.summary.skipped}"`,
    `errors="${result.errors.length}"`,
    `time="${result.durationMs / 1000}"`,
  ].join(' ');
  const errors = result.errors.map((error, index) => {
    return `  <testcase name="harness.${index}" classname="comparator"><error>${escapeXml(error)}</error></testcase>`;
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuite ${attributes}>`,
    ...result.cases.map(junitCase), ...errors,
    '</testsuite>', '',
  ].join('\n');
}

export function printCase(result: CaseResult): void {
  console.log(`${result.status.toUpperCase().padEnd(7)} ${result.id} (${result.durationMs} ms)`);
  if (result.reason) console.log(`  ${result.reason.split('\n').join('\n  ')}`);
}

export async function writeReports(result: RunResult, directory: string): Promise<string> {
  await mkdir(directory, { recursive: true });
  const destination = await mkdtemp(join(directory, 'run-'));
  await Promise.all([
    writeFile(join(destination, 'results.json'), `${JSON.stringify(result, null, 2)}\n`),
    writeFile(join(destination, 'junit.xml'), junit(result)),
  ]);
  return destination;
}
