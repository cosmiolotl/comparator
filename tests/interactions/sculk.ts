import type { World } from '../../src/world/world.js';
import { interactionCase } from './helpers.js';

async function openTrapdoor(world: World, distance = 3): Promise<void> {
  await world.command(`setblock ~${distance} ~ ~ oak_trapdoor[facing=east,half=bottom,open=false]`);
  await world.step(2);
  await world.command(`setblock ~${distance + 1} ~ ~ redstone_block`);
}

export const cases = [
  ...[{ block: 'sculk_sensor', duration: 30 }, { block: 'calibrated_sculk_sensor', duration: 10 }].map(({ block, duration }) => interactionCase(
    `sculk.${block}-phases`, `${block} has a ${duration}-tick active phase and a ten-tick cooldown`,
    async (world) => {
      await world.command(`setblock ~ ~ ~ ${block}`);
      await openTrapdoor(world);
      await world.step(2);
      await world.expect(`if block ~ ~ ~ ${block}[sculk_sensor_phase=inactive,power=0]`);
      await world.step(1);
      await world.expect(`if block ~ ~ ~ ${block}[sculk_sensor_phase=active]`);
      await world.result('data get block ~ ~ ~ last_vibration_frequency', 10);
      await world.step(duration - 1);
      await world.expect(`if block ~ ~ ~ ${block}[sculk_sensor_phase=active]`);
      await world.step(1);
      await world.expect(`if block ~ ~ ~ ${block}[sculk_sensor_phase=cooldown,power=0]`);
      await world.step(9);
      await world.expect(`if block ~ ~ ~ ${block}[sculk_sensor_phase=cooldown,power=0]`);
      await world.step(1);
      await world.expect(`if block ~ ~ ~ ${block}[sculk_sensor_phase=inactive,power=0]`);
    },
  )),
  ...[{ distance: 2, power: 12 }, { distance: 7, power: 2 }, { distance: 8, power: 1 }].map(({ distance, power }) => interactionCase(
    `sculk.travel-${distance}`, `A vibration ${distance} blocks away arrives after ${distance} ticks with strength ${power}`,
    async (world) => {
      await world.command('setblock ~ ~ ~ sculk_sensor');
      await openTrapdoor(world, distance);
      await world.step(distance - 1);
      await world.expect('if block ~ ~ ~ sculk_sensor[sculk_sensor_phase=inactive,power=0]');
      await world.step(1);
      await world.expect(`if block ~ ~ ~ sculk_sensor[sculk_sensor_phase=active,power=${power}]`);
    },
  )),
  ...['white_wool', 'stone'].map((barrier) => interactionCase(
    `sculk.occlusion-${barrier}`, `${barrier} ${barrier === 'white_wool' ? 'occludes' : 'does not occlude'} a trapdoor vibration`,
    async (world) => {
      await world.command('setblock ~ ~ ~ sculk_sensor', `fill ~1 ~ ~-1 ~1 ~2 ~1 ${barrier}`);
      await openTrapdoor(world);
      await world.expect('if block ~3 ~ ~ oak_trapdoor[open=true]');
      await world.step(4);
      const phase = barrier === 'white_wool' ? 'inactive' : 'active';
      await world.expect(`if block ~ ~ ~ sculk_sensor[sculk_sensor_phase=${phase}]`);
      if (barrier === 'white_wool') {
        await world.command('fill ~1 ~ ~-1 ~1 ~2 ~1 air', 'setblock ~4 ~ ~ air');
        await world.step(3);
        await world.expect('if block ~ ~ ~ sculk_sensor[sculk_sensor_phase=active]');
        await world.result('data get block ~ ~ ~ last_vibration_frequency', 9);
      }
    },
  )),
  interactionCase('sculk.waterlogged-detects-vibration', 'A waterlogged sensor still detects and transmits vibrations', async (world) => {
    await world.command('setblock ~ ~ ~ sculk_sensor[waterlogged=true]');
    await openTrapdoor(world);
    await world.step(3);
    await world.expect('if block ~ ~ ~ sculk_sensor[waterlogged=true,sculk_sensor_phase=active,power=10]');
    await world.result('data get block ~ ~ ~ last_vibration_frequency', 10);
  }),
  ...[9, 10].map((filter) => interactionCase(
    `sculk.calibrated-filter-${filter}`, `A calibrated filter of ${filter} ${filter === 10 ? 'accepts' : 'rejects'} a block-open event`,
    async (world) => {
      await world.command('setblock ~ ~ ~ calibrated_sculk_sensor[facing=east]',
        `fill ~-1 ~ ~ ~-${16 - filter} ~ ~ redstone_wire`, `setblock ~-${17 - filter} ~ ~ redstone_block`);
      await world.expect(`if block ~-1 ~ ~ redstone_wire[power=${filter}]`);
      await openTrapdoor(world);
      await world.step(3);
      await world.expect(`if block ~ ~ ~ calibrated_sculk_sensor[sculk_sensor_phase=${filter === 10 ? 'active' : 'inactive'}]`);
    },
  )),
  interactionCase('sculk.comparator-reads-frequency', 'A comparator reads the vibration frequency independently of sensor signal strength', async (world) => {
    await world.command('setblock ~ ~ ~ sculk_sensor', 'setblock ~-1 ~ ~ comparator[facing=east]');
    await openTrapdoor(world, 7);
    await world.step(9);
    await world.expect('if block ~ ~ ~ sculk_sensor[sculk_sensor_phase=active,power=2]');
    await world.result('data get block ~-1 ~ ~ OutputSignal', 10);
  }),
  interactionCase('sculk.same-tick-nearest-event', 'The nearer vibration wins when the farther event is emitted first in the same tick', async (world) => {
    await world.command('setblock ~ ~ ~ sculk_sensor',
      'setblock ~3 ~ ~ oak_trapdoor[open=false]', 'setblock ~ ~ ~6 oak_trapdoor[open=false]');
    await world.step(2);
    await world.command('setblock ~ ~ ~7 redstone_block', 'setblock ~4 ~ ~ redstone_block');
    await world.step(2);
    await world.expect('if block ~ ~ ~ sculk_sensor[sculk_sensor_phase=inactive]');
    await world.step(1);
    await world.expect('if block ~ ~ ~ sculk_sensor[sculk_sensor_phase=active,power=10]');
  }),
  interactionCase('sculk.active-events-not-queued', 'Events received during sensor activity are discarded instead of replayed after cooldown', async (world) => {
    await world.command('setblock ~ ~ ~ sculk_sensor');
    await openTrapdoor(world);
    await world.step(3);
    await world.expect('if block ~ ~ ~ sculk_sensor[sculk_sensor_phase=active]');
    await world.command('setblock ~4 ~ ~ air');
    await world.step(41);
    await world.expect('if block ~ ~ ~ sculk_sensor[sculk_sensor_phase=inactive,power=0]');
    await world.result('data get block ~ ~ ~ last_vibration_frequency', 10);
    await world.command('setblock ~4 ~ ~ redstone_block');
    await world.step(3);
    await world.expect('if block ~ ~ ~ sculk_sensor[sculk_sensor_phase=active]');
  }),
];
