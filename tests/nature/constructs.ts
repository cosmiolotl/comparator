import { countEntities, natureCase } from './helpers.js';

export const cases = [
  natureCase('constructs.snow-golem', 'Placing a carved pumpkin completes a snow golem and consumes the construction blocks', async (world) => {
    await world.command('setblock ~ ~ ~ snow_block', 'setblock ~ ~1 ~ snow_block', 'setblock ~ ~2 ~ carved_pumpkin');
    await countEntities(world, '@e[type=snow_golem,distance=..5]', 1);
    await world.expect('if block ~ ~ ~ air if block ~ ~1 ~ air if block ~ ~2 ~ air');
  }),
  natureCase('constructs.iron-golem', 'An iron T with a carved pumpkin creates a player-built golem even with natural spawning disabled', async (world) => {
    await world.command('setblock ~ ~ ~ iron_block', 'fill ~-1 ~1 ~ ~1 ~1 ~ iron_block', 'setblock ~ ~2 ~ carved_pumpkin');
    await countEntities(world, '@e[type=iron_golem,distance=..5]', 1);
    await world.expect('if entity @e[type=iron_golem,nbt={PlayerCreated:1b}]');
    await world.expect('if block ~ ~ ~ air if block ~-1 ~1 ~ air if block ~1 ~1 ~ air if block ~ ~2 ~ air');
  }),
  natureCase('constructs.incomplete-iron-golem', 'An iron golem with a missing arm is not constructed', async (world) => {
    await world.command('setblock ~ ~ ~ iron_block', 'fill ~ ~1 ~ ~1 ~1 ~ iron_block', 'setblock ~ ~2 ~ carved_pumpkin');
    await world.expect('unless entity @e[type=iron_golem]');
    await world.expect('if block ~ ~2 ~ carved_pumpkin if block ~ ~1 ~ iron_block');
    await world.command('setblock ~-1 ~1 ~ iron_block', 'setblock ~ ~2 ~ air', 'setblock ~ ~2 ~ carved_pumpkin');
    await countEntities(world, '@e[type=iron_golem,distance=..5]', 1);
  }),
  natureCase('constructs.uncarved-pumpkin', 'An uncarved pumpkin does not complete a snow golem', async (world) => {
    await world.command('setblock ~ ~ ~ snow_block', 'setblock ~ ~1 ~ snow_block', 'setblock ~ ~2 ~ pumpkin');
    await world.expect('unless entity @e[type=snow_golem]');
    await world.expect('if block ~ ~2 ~ pumpkin if block ~ ~1 ~ snow_block');
    await world.command('setblock ~ ~2 ~ carved_pumpkin');
    await countEntities(world, '@e[type=snow_golem,distance=..5]', 1);
  }),
];
