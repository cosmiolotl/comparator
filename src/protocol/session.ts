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
  predicate(packet: Packet): boolean;
  resolve(packet: Packet): void;
  reject(error: Error): void;
}

export class PacketSession {
  readonly trace: PacketTrace[] = [];
  private readonly packets: Packet[] = [];
  private readonly waiters = new Set<Waiter>();
  private readonly observers = new Set<(packet: Packet) => void>();
  private readonly disconnectWaiters = new Set<{ resolve(packet: Packet): void; reject(error: Error): void }>();
  private disconnectPacket: Packet | undefined;
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
    // Empty protocol packets (including bundle delimiters) decode as undefined.
    if (data === undefined) data = {};
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
      this.disconnectPacket = packet;
      for (const waiter of this.disconnectWaiters) waiter.resolve(packet);
      this.disconnectWaiters.clear();
      this.fail(new Error(`Server disconnected: ${JSON.stringify(packet.data.reason)}`));
      return;
    }
    try {
      for (const observer of this.observers) observer(packet);
      const waiter = [...this.waiters].find((entry) => {
        return entry.name === packet.name && entry.state === packet.state && entry.predicate(packet);
      });
      if (waiter) {
        this.waiters.delete(waiter);
        waiter.resolve(packet);
        return;
      }
    } catch (error) {
      this.fail(error instanceof Error ? error : new Error(String(error)));
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
    for (const waiter of this.disconnectWaiters) waiter.reject(this.failure);
    this.disconnectWaiters.clear();
  };

  waitFor(name: string, state: string, predicate: (packet: Packet) => boolean = () => true): Promise<Packet> {
    this.signal.throwIfAborted();
    const index = this.packets.findIndex((packet) => packet.name === name && packet.state === state && predicate(packet));
    if (index >= 0) return Promise.resolve(this.packets.splice(index, 1)[0]!);
    if (this.failure) return Promise.reject(this.failure);
    return new Promise((resolve, reject) => {
      this.waiters.add({ name, state, predicate, resolve, reject });
    });
  }

  observe(observer: (packet: Packet) => void): () => void {
    this.observers.add(observer);
    return () => this.observers.delete(observer);
  }

  waitForDisconnect(): Promise<Packet> {
    this.signal.throwIfAborted();
    if (this.disconnectPacket) return Promise.resolve(this.disconnectPacket);
    if (this.failure) return Promise.reject(this.failure);
    return new Promise((resolve, reject) => this.disconnectWaiters.add({ resolve, reject }));
  }

  discard(name: string, state = 'play'): void {
    for (let index = this.packets.length - 1; index >= 0; index--) {
      const packet = this.packets[index]!;
      if (packet.name === name && packet.state === state) this.packets.splice(index, 1);
    }
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
    this.observers.clear();
  }
}
