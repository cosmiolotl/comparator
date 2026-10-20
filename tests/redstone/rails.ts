import { redstoneCase } from './helpers.js';

export const cases = [
  ...['powered_rail', 'activator_rail'].map((block) => redstoneCase(`rail.${block}-propagation-limit`, `${block} transmits power to eight further rails but not a ninth`, async (world) => {
    await world.command(`fill ~ ~ ~ ~9 ~ ~ minecraft:${block}[shape=east_west]`, 'setblock ~ ~-1 ~ minecraft:redstone_block');
    await world.expect(`if block ~ ~ ~ minecraft:${block}[powered=true]`);
    await world.expect(`if block ~8 ~ ~ minecraft:${block}[powered=true]`);
    await world.expect(`if block ~9 ~ ~ minecraft:${block}[powered=false]`);
  })),
  redstoneCase('rail.power-removal-propagates', 'Removing a rail power source depowers its full connected line', async (world) => {
    await world.command('fill ~ ~ ~ ~8 ~ ~ minecraft:powered_rail[shape=east_west]', 'setblock ~ ~-1 ~ minecraft:redstone_block');
    await world.expect('if block ~8 ~ ~ minecraft:powered_rail[powered=true]');
    await world.command('setblock ~ ~-1 ~ minecraft:stone');
    await world.expect('if block ~ ~ ~ minecraft:powered_rail[powered=false]');
    await world.expect('if block ~8 ~ ~ minecraft:powered_rail[powered=false]');
  }),
  redstoneCase('rail.mixed-types-break-transmission', 'An activator rail interrupts powered rail transmission', async (world) => {
    await world.command(
      'setblock ~ ~ ~ minecraft:powered_rail[shape=east_west]',
      'setblock ~1 ~ ~ minecraft:activator_rail[shape=east_west]',
      'setblock ~2 ~ ~ minecraft:powered_rail[shape=east_west]',
      'setblock ~ ~-1 ~ minecraft:redstone_block',
    );
    await world.expect('if block ~ ~ ~ minecraft:powered_rail[powered=true]');
    await world.expect('if block ~1 ~ ~ minecraft:activator_rail[powered=false]');
    await world.expect('if block ~2 ~ ~ minecraft:powered_rail[powered=false]');
  }),
  redstoneCase('rail.detector-detects-cart', 'A minecart activates a detector rail and its adjacent dust', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:detector_rail', 'setblock ~1 ~ ~ minecraft:redstone_wire', 'summon minecraft:minecart ~0.5 ~0.1 ~0.5 {Tags:["cts_cart"],NoGravity:1b}');
    await world.step(1);
    await world.expect('if block ~ ~ ~ minecraft:detector_rail[powered=true]');
    await world.expect('if block ~1 ~ ~ minecraft:redstone_wire[power=15]');
  }),
  redstoneCase('rail.detector-release-delay', 'A detector rail rechecks its missing cart after twenty game ticks', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:detector_rail', 'summon minecraft:minecart ~0.5 ~0.1 ~0.5 {Tags:["cts_cart"],NoGravity:1b}');
    await world.step(1);
    await world.expect('if block ~ ~ ~ minecraft:detector_rail[powered=true]');
    await world.command('kill @e[tag=cts_cart]');
    await world.step(19);
    await world.expect('if block ~ ~ ~ minecraft:detector_rail[powered=true]');
    await world.step(1);
    await world.expect('if block ~ ~ ~ minecraft:detector_rail[powered=false]');
  }),
];
