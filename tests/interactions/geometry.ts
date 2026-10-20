import { interactionCase, position } from './helpers.js';

const placements = [
  { id: 'interior-east', x: 5, z: 5, dx: 1, dz: 0, facing: 'west' },
  { id: 'east-edge', x: 15, z: 5, dx: 1, dz: 0, facing: 'west' },
  { id: 'west-edge', x: 0, z: 5, dx: -1, dz: 0, facing: 'east' },
  { id: 'north-edge', x: 5, z: 0, dx: 0, dz: -1, facing: 'south' },
  { id: 'south-edge', x: 5, z: 15, dx: 0, dz: 1, facing: 'north' },
  { id: 'chunk-corner', x: 15, z: 15, dx: 1, dz: 0, facing: 'west' },
];

export const cases = [
  ...placements.map(({ id, x, z, dx, dz, facing }) => interactionCase(
    `geometry.repeater-${id}`, `A ${id} repeater sends a correctly delayed edge across its output boundary`,
    async (world) => {
      const input = position(x - dx, 0, z - dz);
      const repeater = position(x, 0, z);
      const output = position(x + dx, 0, z + dz);
      await world.command(`setblock ${repeater} repeater[facing=${facing},delay=2]`,
        `setblock ${output} redstone_wire`, `setblock ${input} redstone_block`);
      await world.step(3);
      await world.expect(`if block ${repeater} repeater[powered=false] if block ${output} redstone_wire[power=0]`);
      await world.step(1);
      await world.expect(`if block ${repeater} repeater[powered=true] if block ${output} redstone_wire[power=15]`);
    },
  )),
  ...placements.map(({ id, x, z, dx, dz }) => interactionCase(
    `geometry.water-${id}`, `Water spreads with level one at the ${id} boundary`,
    async (world) => {
      await world.command(`setblock ${position(x, 0, z)} water`);
      await world.step(4);
      await world.expect(`if block ${position(x + dx, 0, z + dz)} air`);
      await world.step(1);
      await world.expect(`if block ${position(x + dx, 0, z + dz)} water[level=1]`);
    },
  )),
  interactionCase('geometry.piston-section-boundary', 'A vertical piston moves a block across a 16-block section boundary', async (world) => {
    await world.command('setblock ~ ~14 ~ piston[facing=up]', 'setblock ~ ~15 ~ stone', 'setblock ~-1 ~14 ~ redstone_block');
    await world.step(4);
    await world.expect('if block ~ ~14 ~ piston[extended=true] if block ~ ~15 ~ piston_head[facing=up] if block ~ ~16 ~ stone');
  }),
  interactionCase('geometry.dust-corner-path', 'A dust path carries attenuation through a chunk corner', async (world) => {
    await world.command('setblock ~13 ~ ~15 redstone_block', 'fill ~14 ~ ~15 ~16 ~ ~15 redstone_wire',
      'fill ~16 ~ ~16 ~16 ~ ~18 redstone_wire');
    await world.expect('if block ~15 ~ ~15 redstone_wire[power=14] if block ~16 ~ ~16 redstone_wire[power=12] if block ~16 ~ ~18 redstone_wire[power=10]');
  }),
  ...[0, 15].map((offset) => interactionCase(
    `geometry.negative-chunk-edge-${offset}`, `A negative-coordinate repeater crosses the chunk edge at local offset ${offset}`,
    async (world) => {
      const direction = offset === 0 ? -1 : 1;
      await world.command(`setblock ~${offset} ~ ~ repeater[facing=${direction === 1 ? 'west' : 'east'},delay=2]`,
        `setblock ~${offset + direction} ~ ~ redstone_wire`, `setblock ~${offset - direction} ~ ~ redstone_block`);
      await world.step(3);
      await world.expect(`if block ~${offset + direction} ~ ~ redstone_wire[power=0]`);
      await world.step(1);
      await world.expect(`if block ~${offset + direction} ~ ~ redstone_wire[power=15]`);
    },
    { negative: true },
  )),
  interactionCase('geometry.negative-water-corner', 'Water spreads across both negative-coordinate chunk edges at a corner', async (world) => {
    await world.command('setblock ~ ~ ~ water');
    await world.step(5);
    await world.expect('if block ~-1 ~ ~ water[level=1] if block ~ ~ ~-1 water[level=1]');
    await world.step(5);
    await world.expect('if block ~-1 ~ ~-1 water[level=2]');
  }, { negative: true }),
];
