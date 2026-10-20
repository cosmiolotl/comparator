import { interactionCase } from './helpers.js';

const impacts = [
  { id: 'center', height: 0.5, z: 0.5, expected: 15 },
  { id: 'quarter-offset', height: 0.75, z: 0.5, expected: 8 },
  { id: 'edge', height: 0.99, z: 0.5, expected: 1 },
  { id: 'corner', height: 0.75, z: 0.75, expected: 8 },
];

export const cases = [
  ...impacts.map(({ id, height, z, expected }) => interactionCase(
    `targets.arrow-strength-${id}`, `An arrow at the target's ${id} produces signal ${expected}`,
    async (world) => {
      await world.command('setblock ~ ~3 ~ target', 'setblock ~1 ~2 ~ stone', 'setblock ~1 ~3 ~ redstone_wire',
        `summon arrow ~-1 ~${3 + height} ~${z} {NoGravity:1b,Motion:[2.0d,0.0d,0.0d]}`);
      await world.step(1);
      await world.expect(`if block ~ ~3 ~ target[power=${expected}] if block ~1 ~3 ~ redstone_wire[power=${expected}]`);
    },
  )),
  ...[{ type: 'arrow', ticks: 20 }, { type: 'snowball', ticks: 8 }].map(({ type, ticks }) => interactionCase(
    `targets.${type}-duration`, `A target's ${type} pulse lasts exactly ${ticks} game ticks`,
    async (world) => {
      await world.command('setblock ~ ~3 ~ target',
        `summon ${type} ~-1 ~3.5 ~0.5 {NoGravity:1b,Motion:[2.0d,0.0d,0.0d]}`);
      await world.step(1);
      await world.expect('if block ~ ~3 ~ target[power=15]');
      await world.step(ticks - 1);
      await world.expect('if block ~ ~3 ~ target[power=15]');
      await world.step(1);
      await world.expect('if block ~ ~3 ~ target[power=0]');
    },
  )),
  interactionCase('targets.hit-does-not-refresh-pulse', 'A second hit cannot replace the strength or extend a pending target pulse', async (world) => {
    await world.command('setblock ~ ~3 ~ target',
      'summon arrow ~-1 ~3.75 ~0.5 {NoGravity:1b,Motion:[2.0d,0.0d,0.0d]}');
    await world.step(1);
    await world.expect('if block ~ ~3 ~ target[power=8]');
    await world.step(10);
    await world.command('summon arrow ~-1 ~3.5 ~0.5 {NoGravity:1b,Motion:[2.0d,0.0d,0.0d]}');
    await world.step(1);
    await world.expect('if block ~ ~3 ~ target[power=8]');
    await world.step(9);
    await world.expect('if block ~ ~3 ~ target[power=0]');
  }),
];
