import { natureCase } from './helpers.js';

export const cases = [
  ...['oak', 'birch'].map((tree) => natureCase(
    `generation.${tree}-feature`, `The configured ${tree} feature creates a trunk and canopy on valid ground`,
    async (world) => {
      await world.command('fill ~-6 ~-1 ~-6 ~6 ~-1 ~6 grass_block');
      await world.result(`place feature minecraft:${tree} ~ ~ ~`, 1);
      await world.expect(`if block ~ ~ ~ ${tree}_log if block ~ ~1 ~ ${tree}_log`);
      await world.command(`execute store result score #leaves cts run fill ~-6 ~ ~-6 ~6 ~15 ~6 stone replace ${tree}_leaves`);
      await world.expect('if score #leaves cts matches 1..');
    },
  )),
  ...['oak', 'birch'].map((tree) => natureCase(
    `generation.${tree}-obstructed`, `The configured ${tree} feature rejects a fully obstructed growth volume`,
    async (world) => {
      await world.command('fill ~-6 ~-1 ~-6 ~6 ~-1 ~6 grass_block', 'fill ~-6 ~ ~-6 ~6 ~15 ~6 stone');
      await world.result(`place feature minecraft:${tree} ~ ~ ~`, 0);
      await world.expect('if block ~ ~ ~ stone if block ~ ~1 ~ stone');
    },
  )),
];
