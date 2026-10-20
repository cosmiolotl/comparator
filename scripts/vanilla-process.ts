import { spawn, type ChildProcess } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { once } from 'node:events';
import { resolve } from 'node:path';

export class VanillaProcess {
  private process: ChildProcess | undefined;
  private stopping = false;
  private readonly log;

  constructor(private readonly directory: string, private readonly jar: string, private readonly controller: AbortController) {
    this.log = createWriteStream(resolve(directory, 'server.log'));
    this.log.on('error', (error: Error) => controller.abort(error));
  }

  async start(): Promise<void> {
    this.controller.signal.throwIfAborted();
    if (this.process) throw new Error('The owned vanilla process is already running');
    this.stopping = false;
    const server = spawn(process.env.COMPARATOR_JAVA ?? 'java', ['-Xms256M', '-Xmx2G', '-jar', this.jar, 'nogui'], {
      cwd: this.directory, windowsHide: true, stdio: 'pipe',
    });
    this.process = server;
    const fail = (error: Error): void => this.controller.abort(error);
    server.stdin?.on('error', fail);
    server.stdout?.on('error', fail);
    server.stderr?.on('error', fail);
    server.stdout?.pipe(this.log, { end: false });
    server.stderr?.pipe(this.log, { end: false });
    server.on('error', fail);
    server.once('exit', () => {
      if (!this.stopping) this.controller.abort(new Error('Owned vanilla process exited unexpectedly'));
    });
    await this.waitUntilReady(server);
  }

  private async waitUntilReady(server: ChildProcess): Promise<void> {
    await new Promise<void>((resolveReady, reject) => {
      let output = '';
      const signal = this.controller.signal;
      const finish = (error?: Error): void => {
        clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
        server.removeListener('error', onError);
        server.removeListener('exit', onExit);
        server.stdout?.removeListener('data', onData);
        if (error) reject(error);
        else resolveReady();
      };
      const onError = (error: Error): void => finish(error);
      const onExit = (): void => finish(new Error('Vanilla exited before readiness'));
      const onAbort = (): void => finish(new Error('Vanilla startup interrupted', { cause: signal.reason }));
      const onData = (chunk: Buffer): void => {
        output = (output + chunk.toString('utf8')).slice(-4096);
        if (output.includes('Done (') && output.includes('RCON running on')) finish();
      };
      const timer = setTimeout(() => finish(new Error('Vanilla startup timed out')), 90000);
      server.once('error', onError);
      server.once('exit', onExit);
      server.stdout?.on('data', onData);
      signal.addEventListener('abort', onAbort, { once: true });
      if (signal.aborted) onAbort();
    });
  }

  async stop(mode: 'clean' | 'crash' = 'clean'): Promise<void> {
    const server = this.process;
    if (!server) return;
    this.stopping = true;
    if (server.exitCode !== null || server.signalCode !== null || !server.pid) {
      this.process = undefined;
      return;
    }
    const exit = once(server, 'exit');
    let forced = false;
    if (mode === 'crash') server.kill('SIGKILL');
    else if (!server.stdin?.destroyed) server.stdin?.write('stop\n');
    const timer = setTimeout(() => { forced = true; server.kill('SIGKILL'); }, 15000);
    let termination: [number | null, string | null];
    try { termination = await exit as [number | null, string | null]; } finally {
      clearTimeout(timer);
      this.process = undefined;
    }
    if (mode === 'clean' && (forced || termination[0] !== 0 || termination[1] !== null)) {
      throw new Error(`Orderly vanilla shutdown failed${forced ? '; the owned process was forcibly stopped after 15 seconds' : ''}`);
    }
  }

  async restart(mode: 'clean' | 'crash'): Promise<void> {
    await this.stop(mode);
    await this.start();
  }

  async close(): Promise<void> {
    try { await this.stop(); } finally { this.log.end(); }
  }
}
