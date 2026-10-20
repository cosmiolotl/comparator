import assert from 'node:assert/strict';
import { playerScenario } from './scenario.js';

export const cases = [
  playerScenario('movement.accepted', 'A grounded position packet updates the authoritative player position', async (p) => {
    await p.move(1.5, 0, 3.5);
    await p.world.result(`data get entity ${p.name} Pos[0] 2`, (p.world.origin.x + 1.5) * 2);
    await p.world.result(`data get entity ${p.name} Pos[1]`, p.world.origin.y);
  }),
  playerScenario('movement.collision', 'A movement packet cannot move the player through a solid wall', async (p) => {
    await p.world.command('fill ~1 ~ ~2 ~1 ~2 ~4 stone');
    await p.move(1.5, 0, 3.5);
    await p.world.result(`data get entity ${p.name} Pos[0] 2`, (p.world.origin.x + 0.5) * 2);
  }),
  playerScenario('movement.teleport_ack', 'Movement is ignored until the pending teleport is acknowledged', async (p) => {
    p.confirmTeleports = false;
    await p.teleport(2.5, 0, 3.5);
    await p.move(3.5, 0, 3.5);
    await p.world.result(`data get entity ${p.name} Pos[0] 2`, (p.world.origin.x + 2.5) * 2);
    p.session.write('teleport_confirm', { teleportId: p.teleportId });
    p.confirmTeleports = true;
    await p.move(3.5, 0, 3.5);
    await p.world.result(`data get entity ${p.name} Pos[0] 2`, (p.world.origin.x + 3.5) * 2);
  }),
  playerScenario('lifecycle.death_respawn', 'The respawn request restores health at the configured spawnpoint', async (p) => {
    await p.world.command(`spawnpoint ${p.name} ~2 ~ ~2`, `kill ${p.name}`);
    await p.respawn();
    await p.world.result(`data get entity ${p.name} Health`, 20);
    await p.world.expect(`if entity @a[name=${p.name},distance=..5]`);
  }),
  playerScenario('lifecycle.death_inventory', 'Death drops inventory and respawn does not duplicate it', async (p) => {
    await p.world.command('gamerule keepInventory false', `spawnpoint ${p.name} ~2 ~ ~2`);
    await p.held('diamond', 3);
    await p.world.command(`kill ${p.name}`);
    await p.respawn();
    await p.world.expect(`unless data entity ${p.name} Inventory[{id:"minecraft:diamond"}]`);
    await p.world.expect('if entity @e[type=item,distance=..6,nbt={Item:{id:"minecraft:diamond",count:3}}]');
    await p.world.result('execute if entity @e[type=item,distance=..80,nbt={Item:{id:"minecraft:diamond"}}]', 1);
  }),
  playerScenario('lifecycle.keep_inventory', 'Keep-inventory preserves items and experience through death and respawn', async (p) => {
    await p.world.command('gamerule keepInventory true', `spawnpoint ${p.name} ~2 ~ ~2`,
      `experience set ${p.name} 7 levels`);
    try {
      await p.held('diamond', 3);
      await p.world.command(`kill ${p.name}`);
      await p.respawn();
      await p.world.expect(`if data entity ${p.name} Inventory[{id:"minecraft:diamond",count:3}]`);
      await p.world.result(`experience query ${p.name} levels`, 7);
      await p.world.expect('unless entity @e[type=item,distance=..6,nbt={Item:{id:"minecraft:diamond"}}]');
    } finally {
      await p.world.command('gamerule keepInventory false');
    }
  }),
  playerScenario('lifecycle.nether_transition', 'A cross-dimension teleport emits respawn and preserves inventory', async (p) => {
    await p.held('diamond', 3);
    p.session.discard('respawn');
    p.session.discard('position');
    const changed = p.session.waitFor('respawn', 'play');
    await p.world.command(`execute in minecraft:the_nether run tp ${p.name} 0.5 128 0.5`);
    await changed;
    await p.session.waitFor('position', 'play');
    await p.fence();
    await p.world.expect(`if entity @a[name=${p.name},nbt={Dimension:"minecraft:the_nether"}]`);
    await p.world.expect(`if data entity ${p.name} Inventory[{id:"minecraft:diamond",count:3}]`);
    await p.teleport(0.5, 0, 3.5);
    await p.world.expect(`if entity @a[name=${p.name},nbt={Dimension:"minecraft:overworld"}]`);
  }),
  playerScenario('lifecycle.play_ping', 'Play-state ping echoes an exact signed 64-bit payload', async (p) => {
    const payload = -9223372036854775791n;
    const reply = p.session.waitFor('ping_response', 'play');
    p.session.write('ping_request', { id: payload });
    const packet = await reply;
    assert.equal(BigInt(String(packet.data.id)), payload);
    await p.world.expect(`if entity ${p.name}`);
  }),
];
