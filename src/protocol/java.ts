import { createConnection } from 'node:net';
import minecraftData from 'minecraft-data';
import minecraftProtocol from 'minecraft-protocol';
import type { Target } from '../config.js';
import { PacketSession } from './session.js';

export class JavaProtocol {
  private readonly sessions: PacketSession[] = [];

  constructor(private readonly target: Target, private readonly signal: AbortSignal) {}

  get protocolVersion(): number {
    const version = minecraftData(this.target.version).version.version;
    if (version === undefined) throw new Error(`Missing protocol number for ${this.target.version}`);
    return version;
  }

  status(): PacketSession {
    this.signal.throwIfAborted();
    const client = new minecraftProtocol.Client(false, this.target.version);
    const session = this.track(client);
    client.on('connect', () => {
      if (this.signal.aborted) return;
      session.write('set_protocol', {
        protocolVersion: this.protocolVersion,
        serverHost: this.target.host,
        serverPort: this.target.port,
        nextState: 1,
      });
      client.state = minecraftProtocol.states.STATUS;
      session.write('ping_start', {});
    });
    this.connect(client);
    return session;
  }

  login(username: string): PacketSession {
    this.signal.throwIfAborted();
    if (!/^[A-Za-z0-9_]{1,16}$/.test(username)) throw new Error('Invalid offline username');
    const client = minecraftProtocol.createClient({
      host: this.target.host,
      port: this.target.port,
      version: this.target.version,
      username,
      auth: 'offline',
      profilesFolder: false,
      disableChatSigning: true,
      hideErrors: true,
      connect: (connection) => this.connect(connection),
    });
    return this.track(client);
  }

  private connect(client: minecraftProtocol.Client): void {
    // An explicit TCP endpoint prevents SRV lookup from silently changing the target.
    const socket = createConnection({ host: this.target.host, port: this.target.port });
    client.setSocket(socket);
    if (this.signal.aborted) socket.destroy();
  }

  private track(client: minecraftProtocol.Client): PacketSession {
    const session = new PacketSession(client, this.signal);
    this.sessions.push(session);
    return session;
  }

  snapshot(): { connection: number; packets: PacketSession['trace'] }[] {
    return this.sessions.map((session, connection) => ({ connection, packets: [...session.trace] }));
  }

  close(): void {
    for (const session of this.sessions) session.close();
  }
}
