import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { Rcon } from '../control/rcon.js';

export class World {
  readonly trace: string[] = [];
  private readonly token = randomUUID();
  private assertionCount = 0;

  constructor(
    private readonly connection: Rcon,
    readonly origin: { x: number; y: number; z: number },
    private readonly signal: AbortSignal,
  ) {}

  async raw(command: string): Promise<string> {
    this.signal.throwIfAborted();
    const { x, y, z } = this.origin;
    this.trace.push(command);
    if (this.trace.length > 80) this.trace.shift();
    const response = await this.connection.command(
      `execute in minecraft:overworld positioned ${x}.0 ${y}.0 ${z}.0 run ${command}`,
    );
    assert.ok(!response.includes('<--[HERE]'), `Invalid fixture command: ${command}\n${response}`);
    return response;
  }

  async command(...commands: string[]): Promise<void> {
    for (const command of commands) await this.raw(command);
  }

  async expect(condition: string, message = condition): Promise<void> {
    assert.match(condition, /^(if|unless) /, 'Use an execute if/unless condition');
    const response = await this.raw(`execute ${condition} run data get storage comparator:harness token`);
    assert.ok(response.includes(this.token), `${message}\nObservation: ${response}`);
    this.assertionCount++;
  }

  async result(command: string, expected: number): Promise<void> {
    assert.ok(Number.isInteger(expected), 'Command result must be an integer');
    await this.command(
      'scoreboard players reset #actual cts',
      `execute store result score #actual cts run ${command}`,
    );
    await this.expect(`if score #actual cts matches ${expected}`, `${command} must return ${expected}`);
  }

  async value(command: string): Promise<number> {
    await this.command('data remove storage comparator:harness value',
      `execute store result storage comparator:harness value int 1 run ${command}`);
    const response = await this.raw('data get storage comparator:harness value');
    // Read the trailing SNBT integer, independent of the command feedback's prose.
    const match = response.match(/(?:^|\s)(-?\d+)$/);
    assert.ok(match, `Missing integer result for ${command}: ${response}`);
    return Number(match[1]);
  }

  async step(ticks: number): Promise<void> {
    assert.ok(Number.isInteger(ticks) && ticks > 0 && ticks <= 10000, 'Step between 1 and 10000 ticks');
    const before = await this.value('time query gametime');
    await this.command(`tick step ${ticks}`);
    const modulus = 2147483647;
    while (true) {
      const current = await this.value('time query gametime');
      const elapsed = (current - before + modulus) % modulus;
      assert.ok(elapsed <= ticks, `Tick stepping overshot: requested ${ticks}, observed ${elapsed}`);
      if (elapsed === ticks) return;
      await delay(5, undefined, { signal: this.signal });
    }
  }

  async initialize(): Promise<void> {
    await this.command(
      'tick freeze',
      'tick rate 1000',
      'scoreboard objectives add cts dummy',
      'scoreboard players reset * cts',
      `data merge storage comparator:harness {token:"${this.token}"}`,
      'gamerule randomTickSpeed 0',
      'gamerule doMobSpawning false',
      'gamerule doDaylightCycle false',
      'gamerule doWeatherCycle false',
      'gamerule doFireTick false',
      'gamerule mobGriefing false',
      'gamerule doTileDrops true',
      'gamerule doMobLoot true',
      'gamerule doEntityDrops true',
      'gamerule waterSourceConversion true',
      'gamerule lavaSourceConversion false',
      'difficulty normal',
      'time set 6000',
      'weather clear',
      'forceload add ~-16 ~-16 ~31 ~31',
    );
    // Force-load tickets are asynchronous; each of the nine chunks must be ready.
    await this.waitForLoad(true);
    await this.command(
      'fill ~-16 ~ ~-16 ~31 ~11 ~31 air',
      'fill ~-16 ~12 ~-16 ~31 ~23 ~31 air',
      'fill ~-16 ~24 ~-16 ~31 ~31 ~31 air',
      'fill ~-16 ~-1 ~-16 ~31 ~-1 ~31 stone',
      'kill @e[type=!minecraft:player,distance=..80]',
    );
    this.assertionCount = 0;
  }

  async cycleChunkTickets(): Promise<void> {
    await this.command('save-all flush', 'forceload remove ~-16 ~-16 ~31 ~31');
    await this.waitForLoad(false);
    await this.command('forceload add ~-16 ~-16 ~31 ~31');
    await this.waitForLoad(true);
  }

  private async waitForLoad(loaded: boolean): Promise<void> {
    const condition = loaded ? 'if' : 'unless';
    const offsets = [-16, 0, 16];
    const conditions = offsets.flatMap((x) => offsets.map((z) => `${condition} loaded ~${x} ~ ~${z}`)).join(' ');
    while (true) {
      const response = await this.raw(`execute ${conditions} run data get storage comparator:harness token`);
      if (response.includes(this.token)) return;
      await delay(10, undefined, { signal: this.signal });
    }
  }

  verifyAssertions(): void {
    assert.ok(this.assertionCount > 0, 'A gameplay case must make an observable assertion');
  }

  close(): void {
    this.connection.close();
  }
}
