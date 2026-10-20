import type { World } from '../../src/world/world.js';
import { countEntities, natureCase, playerNatureCase } from './helpers.js';

async function spawner(world: World, delay = 0, maximum = 6): Promise<void> {
  const { x, y, z } = world.origin;
  await world.command(`setblock ~ ~ ~ spawner{Delay:${delay}s,MinSpawnDelay:20s,MaxSpawnDelay:20s,SpawnCount:1s,MaxNearbyEntities:${maximum}s,RequiredPlayerRange:16s,SpawnRange:4s,SpawnData:{custom_spawn_rules:{},entity:{id:"minecraft:zombie",Tags:["spawned"],NoAI:1b,Pos:[${x + 4.5}d,${y}.0d,${z + 0.5}d]}}}`);
  await world.expect('if block ~ ~ ~ spawner');
}

export const cases = [
  natureCase('spawners.no-nearby-player', 'A spawner countdown does not advance without an eligible nearby player', async (world) => {
    await spawner(world, 5);
    await world.step(20);
    await world.result('data get block ~ ~ ~ Delay', 5);
    await world.expect('unless entity @e[tag=spawned]');
  }),
  playerNatureCase('spawners.mob-spawning-rule-independent', 'A spawner creates its configured mob even when natural mob spawning is disabled', async (player) => {
    const world = player.world;
    await world.command('gamerule doMobSpawning false');
    await spawner(world);
    await world.step(1);
    await countEntities(world, '@e[type=zombie,tag=spawned,distance=..10]', 1);
    await world.result('data get block ~ ~ ~ Delay', 20);
  }),
  playerNatureCase('spawners.nearby-entity-cap', 'A spawner rejects additional mobs when its nearby count reaches the configured cap', async (player) => {
    const world = player.world;
    await spawner(world, 0, 1);
    await world.command('summon zombie ~2.5 ~ ~0.5 {Tags:["existing"],NoAI:1b}');
    await world.step(1);
    await countEntities(world, '@e[type=zombie,distance=..10]', 1);
    await world.expect('if entity @e[tag=existing] unless entity @e[tag=spawned]');
    await world.result('data get block ~ ~ ~ Delay', 20);
  }),
  playerNatureCase('spawners.peaceful-rejects-hostiles', 'A spawner cannot create hostile zombies in peaceful difficulty', async (player) => {
    const world = player.world;
    try {
      await world.command('difficulty peaceful');
      await spawner(world);
      await world.step(2);
      await world.expect('unless entity @e[type=zombie,tag=spawned]');
      await world.command('difficulty normal');
      await world.step(1);
      await world.expect('if entity @e[type=zombie,tag=spawned]');
    } finally {
      await world.command('difficulty normal');
    }
  }),
  playerNatureCase('spawners.player-range', 'Spawner countdown resumes only after the player returns inside its activation range', async (player) => {
    const world = player.world;
    await spawner(world, 5);
    await player.teleport(20.5, 0, 0.5);
    await world.step(10);
    await world.result('data get block ~ ~ ~ Delay', 5);
    await player.teleport(4.5, 0, 0.5);
    await world.step(1);
    await world.result('data get block ~ ~ ~ Delay', 4);
  }),
];
