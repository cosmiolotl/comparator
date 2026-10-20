import { setTimeout as delay } from 'node:timers/promises';
import type { World } from '../../src/world/world.js';
import { interactionCase } from './helpers.js';

async function waitForChunk(world: World, position: string, loaded: boolean): Promise<void> {
  // The server's chunk readiness is the fence; elapsed wall-clock time is not the assertion.
  while (await world.value(`execute if loaded ${position}`) !== Number(loaded)) await delay(5);
  await world.expect(`${loaded ? 'if' : 'unless'} loaded ${position}`);
}

export const cases = [
  interactionCase('chunks.block-ticking-repeater', 'A neighboring force-load keeps repeater ticks running when entity ticking has stopped', async (world) => {
    await world.command('setblock ~17 ~ ~17 repeater[facing=west,delay=4]', 'setblock ~16 ~ ~17 redstone_block');
    await world.step(3);
    await world.expect('if block ~17 ~ ~17 repeater[powered=false]');
    try {
      await world.command('forceload remove ~16 ~16 ~31 ~31');
      await waitForChunk(world, '~17 ~ ~17', false);
      await world.expect('if loaded ~ ~ ~');
      await world.step(4);
      await world.expect('if block ~17 ~ ~17 repeater[powered=false]');
      await world.step(1);
      await world.expect('if block ~17 ~ ~17 repeater[powered=true]');
    } finally {
      await world.command('forceload add ~16 ~16 ~31 ~31');
      await waitForChunk(world, '~17 ~ ~17', true);
    }
  }),
  interactionCase('chunks.block-ticking-fluid', 'A neighboring force-load keeps fluid ticks running when entity ticking has stopped', async (world) => {
    await world.command('setblock ~17 ~1 ~17 water');
    await world.step(3);
    try {
      await world.command('forceload remove ~16 ~16 ~31 ~31');
      await waitForChunk(world, '~17 ~ ~17', false);
      await world.step(1);
      await world.expect('if block ~17 ~ ~17 air');
      await world.step(1);
      await world.expect('if block ~17 ~ ~17 water[level=8]');
    } finally {
      await world.command('forceload add ~16 ~16 ~31 ~31');
      await waitForChunk(world, '~17 ~ ~17', true);
    }
  }),
  interactionCase('chunks.sculk-awaits-neighbor-readiness', 'A sculk vibration waits when its ticking chunk borders a chunk without block ticking', async (world) => {
    await world.command('setblock ~ ~ ~ sculk_sensor', 'setblock ~3 ~ ~ oak_trapdoor[open=false]');
    await world.step(2);
    try {
      await world.command('forceload remove ~-16 ~-16 ~31 ~31', 'forceload add ~-16 ~-16 ~-1 ~-1');
      await waitForChunk(world, '~-1 ~ ~-1', true);
      await waitForChunk(world, '~ ~ ~', false);
      await world.command('setblock ~4 ~ ~ redstone_block');
      await world.step(8);
      await world.expect('if block ~ ~ ~ sculk_sensor[sculk_sensor_phase=inactive,power=0]');
      await world.expect('if data block ~ ~ ~ listener.event');
    } finally {
      await world.command('forceload add ~-16 ~-16 ~31 ~31');
      for (const x of [-16, 0, 16]) {
        for (const z of [-16, 0, 16]) await waitForChunk(world, `~${x} ~ ~${z}`, true);
      }
    }
    await world.step(1);
    await world.expect('if block ~ ~ ~ sculk_sensor[sculk_sensor_phase=active,power=10]');
  }),
];
