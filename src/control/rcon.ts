import { createConnection } from 'node:net';
import type { Socket } from 'node:net';

interface PendingRequest {
  id: number;
  fence: number;
  authentication: boolean;
  fenceSent: boolean;
  chunks: string[];
  resolve(value: string): void;
  reject(error: Error): void;
}

export class Rcon {
  private readonly socket: Socket;
  private buffer: Buffer = Buffer.alloc(0);
  private nextId = 1;
  private pending: PendingRequest | undefined;
  private failure: Error | undefined;

  private constructor(host: string, port: number, private readonly signal: AbortSignal) {
    this.socket = createConnection({ host, port });
    this.socket.setNoDelay(true);
    this.socket.on('data', (chunk: Buffer) => this.receive(chunk));
    this.socket.on('error', (error) => this.fail(error));
    this.socket.on('close', () => this.fail(new Error('RCON connection closed')));
    signal.addEventListener('abort', this.abort, { once: true });
  }

  static async connect(host: string, port: number, password: string, signal: AbortSignal): Promise<Rcon> {
    signal.throwIfAborted();
    const connection = new Rcon(host, port, signal);
    try {
      await connection.request(password, true);
      return connection;
    } catch (error) {
      connection.close();
      throw error;
    }
  }

  private readonly abort = (): void => {
    const reason: unknown = this.signal.reason;
    this.fail(reason instanceof Error ? reason : new Error('RCON aborted'));
    this.close();
  };

  private fail(error: Error): void {
    this.failure ??= error;
    this.pending?.reject(this.failure);
    this.pending = undefined;
  }

  private send(id: number, type: number, text: string): void {
    const body = Buffer.from(text, 'utf8');
    if (body.length > 1400 || body.includes(0)) {
      throw new Error('RCON commands must fit 1400 UTF-8 bytes and contain no NUL');
    }
    const frame = Buffer.alloc(body.length + 14);
    frame.writeInt32LE(body.length + 10, 0);
    frame.writeInt32LE(id, 4);
    frame.writeInt32LE(type, 8);
    body.copy(frame, 12);
    this.socket.write(frame);
  }

  private request(command: string, authentication = false): Promise<string> {
    this.signal.throwIfAborted();
    if (this.failure) return Promise.reject(this.failure);
    if (this.pending) return Promise.reject(new Error('RCON commands must be sequential'));
    const id = this.nextId++;
    const fence = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending = { id, fence, authentication, fenceSent: false, chunks: [], resolve, reject };
      try {
        this.send(id, authentication ? 3 : 2, command);
      } catch (error) {
        this.fail(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private receive(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 4) {
      const size = this.buffer.readInt32LE(0);
      if (size < 10 || size > 1024 * 1024) {
        this.fail(new Error(`Invalid RCON frame length: ${size}`));
        this.close();
        return;
      }
      if (this.buffer.length < size + 4) return;
      const frame = this.buffer.subarray(0, size + 4);
      this.buffer = this.buffer.subarray(size + 4);
      if (frame[size + 2] !== 0 || frame[size + 3] !== 0) {
        this.fail(new Error('Invalid RCON frame terminator'));
        this.close();
        return;
      }
      this.handle(frame.readInt32LE(4), frame.readInt32LE(8), frame.subarray(12, size + 2).toString('utf8'));
    }
  }

  private handle(id: number, type: number, body: string): void {
    const pending = this.pending;
    if (!pending) return;
    if (id === -1) {
      this.fail(new Error('RCON authentication rejected'));
      return;
    }
    if (pending.authentication) {
      if (id !== pending.id || type !== 2) return;
      this.pending = undefined;
      pending.resolve('');
      return;
    }
    if (type !== 0) {
      this.fail(new Error(`Unexpected RCON response type: ${type}`));
      return;
    }
    if (id === pending.id) {
      pending.chunks.push(body);
      if (pending.chunks.join('').length > 1024 * 1024) this.fail(new Error('RCON response exceeds 1 MiB'));
      // Vanilla expects one request per read. Wait for its first response before sending
      // the fence; its reply still follows every chunk of the original response.
      if (!pending.fenceSent) {
        pending.fenceSent = true;
        this.send(pending.fence, 2, 'list');
      }
      return;
    }
    if (id !== pending.fence) return;
    this.pending = undefined;
    pending.resolve(pending.chunks.join(''));
  }

  command(command: string): Promise<string> {
    return this.request(command);
  }

  close(): void {
    this.signal.removeEventListener('abort', this.abort);
    this.fail(new Error('RCON closed by test harness'));
    this.socket.destroy();
  }
}
