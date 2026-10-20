import type { Client, PacketMeta } from 'minecraft-protocol';

export interface Packet {
  name: string;
  state: string;
  data: Record<string, unknown>;
}

export interface PacketTrace {
  direction: 'received' | 'sent';
  name: string;
  state: string;
}

interface Waiter {
  name: string;
  state: string;
  resolve(packet: Packet): void;
  reject(error: Error): void;
}

export class PacketSession {
  readonly trace: PacketTrace[] = [];
  private readonly packets: Packet[] = [];
  private readonly waiters = new Set<Waiter>();
  private failure: Error | undefined;
  private disposed = false;

  constructor(private readonly client: Client, private readonly signal: AbortSignal) {
    client.on('packet', this.onPacket);
    client.on('error', this.fail);
    client.on('end', this.onEnd);
    signal.addEventListener('abort', this.onAbort, { once: true });
    if (signal.aborted) this.onAbort();
  }

  private readonly onPacket = (data: unknown, metadata: PacketMeta): void => {
    if (this.disposed) return;
    this.record('received', metadata.name, metadata.state);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      this.fail(new Error(`Invalid ${metadata.name} packet`));
      return;
    }
    const packet: Packet = {
      name: metadata.name,
      state: metadata.state,
      data: data as Record<string, unknown>,
    };
    if (['disconnect', 'kick_disconnect'].includes(packet.name)) {
      this.fail(new Error(`Server disconnected: ${JSON.stringify(packet.data.reason)}`));
      return;
    }
    const waiter = [...this.waiters].find((entry) => {
      return entry.name === packet.name && entry.state === packet.state;
    });
    if (waiter) {
      this.waiters.delete(waiter);
      waiter.resolve(packet);
      return;
    }
    this.packets.push(packet);
    if (this.packets.length > 64) this.packets.shift();
  };

  private record(direction: PacketTrace['direction'], name: string, state: string): void {
    this.trace.push({ direction, name, state });
    if (this.trace.length > 128) this.trace.shift();
  }

  private readonly onEnd = (reason: string): void => {
    this.fail(new Error(`Connection ended: ${reason}`));
  };

  private readonly onAbort = (): void => {
    const reason: unknown = this.signal.reason;
    this.fail(reason instanceof Error ? reason : new Error('Connection aborted'));
    this.close();
  };

  private readonly fail = (error: Error): void => {
    this.failure ??= error;
    for (const waiter of this.waiters) waiter.reject(this.failure);
    this.waiters.clear();
  };

  waitFor(name: string, state: string): Promise<Packet> {
    this.signal.throwIfAborted();
    const index = this.packets.findIndex((packet) => packet.name === name && packet.state === state);
    if (index >= 0) return Promise.resolve(this.packets.splice(index, 1)[0]!);
    if (this.failure) return Promise.reject(this.failure);
    return new Promise((resolve, reject) => {
      this.waiters.add({ name, state, resolve, reject });
    });
  }

  write(name: string, data: Record<string, unknown>): void {
    this.signal.throwIfAborted();
    if (this.failure) throw this.failure;
    this.record('sent', name, this.client.state);
    this.client.write(name, data);
  }

  close(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.signal.removeEventListener('abort', this.onAbort);
    this.fail(new Error('Connection closed by test harness'));
    if (!this.client.ended) this.client.end('Comparator case finished');
    this.client.socket?.destroy();
    this.packets.length = 0;
  }
}
