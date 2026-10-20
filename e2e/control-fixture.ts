import { once } from 'node:events';
import { createServer } from 'node:net';
import type { AddressInfo, Socket } from 'node:net';

interface Options {
  wrongArithmetic?: boolean;
  missingObservation?: boolean;
  rejectAuthentication?: boolean;
  malformedFrame?: boolean;
  overshootTicks?: boolean;
  stallAfterOperation?: boolean;
}

function frame(id: number, type: number, body: string): Buffer {
  const payload = Buffer.from(body, 'utf8');
  const result = Buffer.alloc(payload.length + 14);
  result.writeInt32LE(payload.length + 10, 0);
  result.writeInt32LE(id, 4);
  result.writeInt32LE(type, 8);
  payload.copy(result, 12);
  return result;
}

export async function startControlFixture(options: Options = {}) {
  const sockets = new Set<Socket>();
  const commands: string[] = [];
  const scores = new Map<string, number>();
  let token = '';
  let gameTime = 100;
  let storedValue: number | undefined;
  let stalled = false;

  function execute(wrapped: string): string {
    const command = wrapped.replace(/^execute in minecraft:overworld positioned -?\d+\.0 -?\d+\.0 -?\d+\.0 run /, '');
    commands.push(command);
    const tokenMatch = command.match(/^data merge storage comparator:harness \{token:"([^"]+)"\}/);
    if (tokenMatch) token = tokenMatch[1]!;
    if (command === 'scoreboard players reset * cts') scores.clear();
    const reset = command.match(/^scoreboard players reset (\S+) cts$/);
    if (reset) scores.delete(reset[1]!);
    if (command === 'data remove storage comparator:harness value') storedValue = undefined;
    if (command === 'execute store result storage comparator:harness value int 1 run time query gametime') storedValue = gameTime;
    if (command === 'data get storage comparator:harness value') return `Numeric observation: ${storedValue}`;
    const storedTime = command.match(/^execute store result score (\S+) cts run time query gametime$/);
    if (storedTime) scores.set(storedTime[1]!, gameTime);
    const tickStep = command.match(/^tick step (\d+)$/);
    if (tickStep) gameTime += Number(tickStep[1]) + (options.overshootTicks ? 1 : 0);
    const scoreQuery = command.match(/^scoreboard players get (\S+) cts$/);
    if (scoreQuery) return `${scoreQuery[1]} has ${scores.get(scoreQuery[1]!) ?? 0} [cts]`;
    const assignment = command.match(/^scoreboard players set (\S+) cts (-?\d+)$/);
    if (assignment) scores.set(assignment[1]!, Number(assignment[2]));
    const operation = command.match(/^scoreboard players operation (\S+) cts \*= (\S+) cts$/);
    if (operation) {
      const left = scores.get(operation[1]!) ?? 0;
      const right = scores.get(operation[2]!) ?? 0;
      scores.set(operation[1]!, options.wrongArithmetic ? 1 : (left * right) | 0);
    }
    if (command.endsWith('run data get storage comparator:harness token')) {
      if (options.missingObservation && !command.includes('if loaded')) return '';
      const conditions = [...command.matchAll(/if score (\S+) cts matches (-?\d+)/g)];
      const matches = conditions.every((condition) => scores.get(condition[1]!) === Number(condition[2]));
      return matches ? `comparator:harness has the following contents: "${token}"` : 'Test failed';
    }
    return 'Fixture command completed';
  }

  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on('error', () => {});
    socket.once('close', () => sockets.delete(socket));
    let buffered: Buffer = Buffer.alloc(0);
    socket.on('data', (chunk: Buffer) => {
      buffered = Buffer.concat([buffered, chunk]);
      while (buffered.length >= 4) {
        const size = buffered.readInt32LE(0);
        if (size < 10 || size > 2048) { socket.destroy(); return; }
        if (buffered.length < size + 4) return;
        const packet = buffered.subarray(0, size + 4);
        buffered = buffered.subarray(size + 4);
        const id = packet.readInt32LE(4);
        const type = packet.readInt32LE(8);
        if (type === 3) {
          socket.write(frame(options.rejectAuthentication ? -1 : id, 2, ''));
          continue;
        }
        if (options.malformedFrame) {
          socket.write(Buffer.from([2, 0, 0, 0]));
          continue;
        }
        const command = packet.subarray(12, size + 2).toString('utf8');
        if (options.stallAfterOperation && (stalled || command.includes('operation #left'))) {
          stalled = true;
          continue;
        }
        const response = execute(command);
        const midpoint = Math.floor(response.length / 2);
        // Exercise fragmented TCP headers and multiple RCON response frames, including empty replies.
        const first = frame(id, 0, response.slice(0, midpoint));
        const second = frame(id, 0, response.slice(midpoint));
        socket.write(first.subarray(0, 2));
        socket.write(Buffer.concat([first.subarray(2), second]));
      }
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return {
    port: (server.address() as AddressInfo).port,
    commands,
    async close() {
      const closed = once(server, 'close');
      server.close();
      for (const socket of sockets) socket.destroy();
      await closed;
    },
  };
}
