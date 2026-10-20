import { once } from 'node:events';
import type { AddressInfo, Server as TcpServer } from 'node:net';
import minecraftData from 'minecraft-data';
import minecraftProtocol from 'minecraft-protocol';

export interface FixtureOptions {
  version?: string;
  invalidStatus?: boolean;
  invalidPong?: boolean;
  invalidIdentity?: boolean;
}

export async function startFixture(options: FixtureOptions = {}): Promise<{
  port: number;
  close(): Promise<void>;
}> {
  const version = options.version ?? '1.21.1';
  const server = minecraftProtocol.createServer({
    host: '127.0.0.1', port: 0, version,
    'online-mode': false, enforceSecureProfile: false, hideErrors: true,
    beforePing(response) {
      if (options.invalidStatus) response.players.online = -1;
      return response;
    },
    beforeLogin(client) {
      if (options.invalidIdentity) client.uuid = '00000000-0000-0000-0000-000000000000';
    },
  });
  server.on('connection', (client) => {
    if (!options.invalidPong) return;
    client.on('ping_start', () => {
      client.removeAllListeners('ping');
      client.once('ping', () => {
        client.write('ping', { time: 0n });
        client.end();
      });
    });
  });
  server.on('playerJoin', (client: minecraftProtocol.ServerClient) => {
    client.write('login', {
      ...minecraftData(version).loginPacket,
      entityId: client.id, isHardcore: false, gameMode: 0, previousGameMode: 1,
      hashedSeed: [0, 0], maxPlayers: 20, viewDistance: 2,
      reducedDebugInfo: false, enableRespawnScreen: true, isDebug: false, isFlat: true,
      enforcesSecureChat: false,
    });
  });
  await once(server, 'listening');
  // The upstream declaration omits the socketServer property exposed by its Server.
  const socketServer = (server as unknown as { socketServer: TcpServer }).socketServer;
  const { port } = socketServer.address() as AddressInfo;
  return {
    port,
    async close() {
      const closed = once(server, 'close');
      const clients = Object.values(server.clients);
      server.close();
      for (const client of clients) client.socket.destroy();
      await closed;
    },
  };
}
