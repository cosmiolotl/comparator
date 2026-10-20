import assert from 'node:assert/strict';
import minecraftData from 'minecraft-data';
import { Player } from '../../src/player/player.js';
import { playerScenario } from './scenario.js';

async function boat(player: Player): Promise<number> {
  const spawned = player.session.waitFor('spawn_entity', 'play', ({ data }) => data.type === minecraftData('1.21.1').entitiesByName.boat?.id);
  await player.world.command('summon boat ~0.5 ~ ~1 {Tags:["player_boat"],NoGravity:1b}');
  return Number((await spawned).data.entityId);
}

async function mount(player: Player, entity: number): Promise<void> {
  const mounted = player.session.waitFor('set_passengers', 'play', ({ data }) => {
    return data.entityId === entity && (data.passengers as number[]).includes(player.entityId);
  });
  player.session.write('use_entity', { target: entity, mouse: 0, hand: 0, sneaking: false });
  await mounted;
  await player.fence();
}

export const cases = [
  playerScenario('vehicle.mount_dismount', 'Boat interaction mounts the player and sneaking dismounts', async (p) => {
    const entity = await boat(p);
    await mount(p, entity);
    await p.world.result(`execute as ${p.name} on vehicle if entity @s[tag=player_boat]`, 1);
    const dismounted = p.session.waitFor('set_passengers', 'play', ({ data }) => {
      return data.entityId === entity && (data.passengers as number[]).length === 0;
    });
    p.session.write('entity_action', { entityId: p.entityId, actionId: 'start_sneaking', jumpBoost: 0 });
    await dismounted;
    await p.world.command('scoreboard players set #riders cts 0',
      'execute as @e[tag=player_boat] on passengers run scoreboard players add #riders cts 1');
    await p.world.expect('if score #riders cts matches 0');
  }),
  playerScenario('vehicle.two_seats', 'A boat admits two players and rejects a third without duplicating passengers', async (p, context) => {
    const q = await Player.join(context, 'B');
    const r = await Player.join(context, 'C');
    const entity = await boat(p);
    await mount(p, entity);
    await mount(q, entity);
    r.session.write('use_entity', { target: entity, mouse: 0, hand: 0, sneaking: false });
    await r.fence();
    await p.world.command('scoreboard players set #riders cts 0',
      'execute as @e[tag=player_boat] on passengers run scoreboard players add #riders cts 1');
    await p.world.expect('if score #riders cts matches 2');
    const seats = await p.session.waitFor('set_passengers', 'play', ({ data }) => {
      return data.entityId === entity && (data.passengers as number[]).length === 2;
    });
    assert.deepEqual(new Set(seats.data.passengers as number[]), new Set([p.entityId, q.entityId]));
  }),
];
