import { position, redstoneCase } from './helpers.js';

const attenuation = Array.from({ length: 16 }, (_, index) => index + 1).map((distance) =>
  redstoneCase(`wire.attenuation-${distance}`, `Dust has strength ${Math.max(16 - distance, 0)} at distance ${distance}`, async (world) => {
    await world.command(`fill ~1 ~ ~ ~${distance} ~ ~ minecraft:redstone_wire`);
    await world.command('setblock ~ ~ ~ minecraft:redstone_block');
    await world.expect(`if block ${position(distance)} minecraft:redstone_wire[power=${Math.max(16 - distance, 0)}]`);
  }),
);

export const cases = [
  ...attenuation,
  redstoneCase('wire.source-removal', 'Removing the only source depowers the entire dust line', async (world) => {
    await world.command('fill ~1 ~ ~ ~15 ~ ~ minecraft:redstone_wire', 'setblock ~ ~ ~ minecraft:redstone_block');
    await world.expect('if block ~15 ~ ~ minecraft:redstone_wire[power=1]');
    await world.command('setblock ~ ~ ~ minecraft:air');
    for (let distance = 1; distance <= 15; distance++) {
      await world.expect(`if block ${position(distance)} minecraft:redstone_wire[power=0]`);
    }
  }),
  redstoneCase('wire.solid-conduction', 'Dust pointing into a solid block powers a lamp beyond it', async (world) => {
    await world.command(
      'setblock ~2 ~ ~ minecraft:stone',
      'setblock ~3 ~ ~ minecraft:redstone_lamp',
      'setblock ~1 ~ ~ minecraft:redstone_wire',
      'setblock ~ ~ ~ minecraft:redstone_block',
    );
    await world.expect('if block ~3 ~ ~ minecraft:redstone_lamp[lit=true]');
  }),
  redstoneCase('wire.upward-step', 'Dust climbs a solid block when there is headroom', async (world) => {
    await world.command(
      'setblock ~2 ~ ~ minecraft:stone',
      'setblock ~2 ~1 ~ minecraft:redstone_wire',
      'setblock ~1 ~ ~ minecraft:redstone_wire',
      'setblock ~ ~ ~ minecraft:redstone_block',
    );
    await world.expect('if block ~1 ~ ~ minecraft:redstone_wire[east=up,power=15]');
    await world.expect('if block ~2 ~1 ~ minecraft:redstone_wire[power=14]');
  }),
  redstoneCase('wire.blocked-upward-step', 'A solid block above lower dust prevents upward transmission', async (world) => {
    await world.command(
      'setblock ~2 ~ ~ minecraft:stone',
      'setblock ~1 ~1 ~ minecraft:stone',
      'setblock ~2 ~1 ~ minecraft:redstone_wire',
      'setblock ~1 ~ ~ minecraft:redstone_wire',
      'setblock ~ ~ ~ minecraft:redstone_block',
    );
    await world.expect('if block ~1 ~ ~ minecraft:redstone_wire[power=15]');
    await world.expect('if block ~2 ~1 ~ minecraft:redstone_wire[power=0]');
  }),
];
