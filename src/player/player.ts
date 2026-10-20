import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import type { CaseContext } from '../suite.js';
import type { PacketSession } from '../protocol/session.js';
import type { World } from '../world/world.js';
import { Inventory } from './inventory.js';

export class Player {
  readonly session: PacketSession;
  readonly inventory: Inventory;
  readonly world: World;
  entityId = 0;
  position = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
  confirmTeleports = true;
  teleportId = 0;
  private sequence = 0;
  private readonly chunks = new Set<string>();

  constructor(readonly context: CaseContext, readonly name: string) {
    assert.ok(context.world, 'Player scenarios require a world fixture');
    this.world = context.world;
    this.session = context.protocol.login(name);
    this.inventory = new Inventory(this.session);
    this.session.observe((packet) => {
      if (packet.name === 'respawn') this.chunks.clear();
      if (packet.name === 'map_chunk') this.chunks.add(`${packet.data.x},${packet.data.z}`);
      if (packet.name === 'unload_chunk') this.chunks.delete(`${packet.data.chunkX},${packet.data.chunkZ}`);
      if (packet.name === 'chunk_batch_finished') this.session.write('chunk_batch_received', { chunksPerTick: 64 });
      if (packet.name !== 'position' || packet.state !== 'play') return;
      const flags = packet.data.flags as Record<string, boolean>;
      for (const axis of ['x', 'y', 'z', 'yaw', 'pitch'] as const) {
        this.position[axis] = Number(packet.data[axis]) + (flags[axis] ? this.position[axis] : 0);
      }
      this.teleportId = Number(packet.data.teleportId);
      if (this.confirmTeleports) {
        this.session.write('teleport_confirm', { teleportId: this.teleportId });
        this.session.write('position_look', { ...this.position, onGround: true });
      }
    });
  }

  static async join(context: CaseContext, suffix = ''): Promise<Player> {
    await context.world?.command('tick rate 20');
    const requestedName = `${context.username}${suffix}`;
    const name = requestedName.length <= 16 ? requestedName
      : `cts_${createHash('sha256').update(requestedName).digest('hex').slice(0, 12)}`;
    const player = new Player(context, name);
    const login = await player.session.waitFor('login', 'play');
    player.entityId = Number(login.data.entityId);
    await player.session.waitFor('position', 'play');
    await player.world.command(
      `gamemode survival ${player.name}`, `clear ${player.name}`,
      `effect clear ${player.name}`, `effect give ${player.name} minecraft:saturation infinite 1 true`,
    );
    await player.teleport(0.5, 0, 3.5);
    await player.world.expect(`if entity ${player.name}`, 'Player must exist in the server world');
    return player;
  }

  async fence(): Promise<void> {
    // Vanilla handles REQUEST_STATS on the server thread and always sends a reply.
    // This orders earlier gameplay packets without wall-clock sleeps or operator privileges.
    this.session.discard('statistics');
    const reply = this.session.waitFor('statistics', 'play');
    this.session.write('client_command', { actionId: 'request_stats' });
    await reply;
  }

  async teleport(x: number, y: number, z: number): Promise<void> {
    this.session.discard('position');
    const reply = this.session.waitFor('position', 'play');
    await this.world.command(`tp ${this.name} ~${x} ~${y} ~${z} 180 0`);
    await reply;
    const chunkX = Math.floor((this.world.origin.x + x) / 16);
    const chunkZ = Math.floor((this.world.origin.z + z) / 16);
    const key = `${chunkX},${chunkZ}`;
    if (!this.chunks.has(key)) {
      await this.session.waitFor('map_chunk', 'play', ({ data }) => {
        return data.x === chunkX && data.z === chunkZ && this.chunks.has(key);
      });
    }
    await this.fence();
  }

  location(x: number, y: number, z: number): { x: number; y: number; z: number } {
    const origin = this.world.origin;
    return { x: origin.x + x, y: origin.y + y, z: origin.z + z };
  }

  async useBlock(x: number, y: number, z: number, direction = 1, hand = 0): Promise<void> {
    this.session.write('block_place', {
      hand, location: this.location(x, y, z), direction,
      cursorX: 0.5, cursorY: 0.5, cursorZ: 0.5, insideBlock: false, sequence: ++this.sequence,
    });
    await this.fence();
  }

  async open(x = 0, y = 0, z = 0): Promise<void> {
    this.session.discard('open_window');
    const opened = this.session.waitFor('open_window', 'play');
    await this.useBlock(x, y, z);
    await opened;
    await this.fence();
    assert.ok(this.inventory.windowId > 0, 'Server must open a container');
    assert.ok(this.inventory.slots.length > 0, 'Server must synchronize container contents');
  }

  async click(slot: number, button = 0, mode = 0, stateId?: number): Promise<void> {
    this.inventory.click(slot, button, mode, stateId);
    await this.fence();
  }

  async closeContainer(): Promise<void> {
    this.session.write('close_window', { windowId: this.inventory.windowId });
    this.inventory.windowId = 0;
    await this.fence();
  }

  async dig(x: number, y: number, z: number, status = 0): Promise<void> {
    this.session.write('block_dig', { status, location: this.location(x, y, z), face: 1, sequence: ++this.sequence });
    await this.fence();
  }

  async held(item: string, count = 1): Promise<void> {
    await this.world.command(`item replace entity ${this.name} hotbar.0 with ${item} ${count}`);
    this.session.write('held_item_slot', { slotId: 0 });
    await this.fence();
  }

  async attack(target: number): Promise<void> {
    this.session.write('use_entity', { target, mouse: 1, sneaking: false });
    await this.fence();
  }

  async respawn(): Promise<void> {
    this.session.discard('respawn');
    this.session.discard('position');
    const respawned = this.session.waitFor('respawn', 'play');
    this.session.write('client_command', { actionId: 'perform_respawn' });
    await respawned;
    await this.session.waitFor('position', 'play');
    await this.fence();
  }

  async move(x: number, y: number, z: number): Promise<void> {
    this.position = { ...this.position, ...this.location(x, y, z) };
    this.session.write('position', { x: this.position.x, y: this.position.y, z: this.position.z, onGround: true });
    await this.fence();
  }
}
