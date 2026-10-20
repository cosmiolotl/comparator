import { countEntities, natureCase } from './helpers.js';

export const cases = [
  ...['cow', 'pig', 'sheep'].map((animal) => natureCase(
    `breeding.${animal}-offspring`, `Two willing adult ${animal}s produce one baby and enter breeding cooldown`,
    async (world) => {
      await world.command('fill ~-2 ~ ~-2 ~3 ~2 ~3 glass hollow', 'fill ~-1 ~ ~-1 ~2 ~1 ~2 air',
        `summon ${animal} ~0.25 ~ ~0.5 {Tags:["parent"],Age:0,InLove:600,PersistenceRequired:1b}`,
        `summon ${animal} ~1.25 ~ ~0.5 {Tags:["parent"],Age:0,InLove:600,PersistenceRequired:1b}`);
      await countEntities(world, `@e[type=${animal},tag=parent,distance=..8]`, 2);
      await world.step(80);
      await countEntities(world, `@e[type=${animal},distance=..8]`, 3);
      await countEntities(world, `@e[type=${animal},tag=!parent,distance=..8]`, 1);
      await world.command(`execute as @e[tag=parent] store result score @s cts run data get entity @s Age`);
      await countEntities(world, '@e[tag=parent,scores={cts=5900..6000}]', 2);
      await world.command('execute as @e[tag=parent] store result score @s cts run data get entity @s InLove');
      await countEntities(world, '@e[tag=parent,scores={cts=0}]', 2);
      await world.command(`execute as @e[type=${animal},tag=!parent,distance=..8] store result score @s cts run data get entity @s Age`);
      await countEntities(world, `@e[type=${animal},tag=!parent,scores={cts=-24000..-23900},distance=..8]`, 1);
    },
  )),
  natureCase('breeding.single-willing-parent', 'One willing parent cannot breed with another adult outside love mode', async (world) => {
    await world.command('summon cow ~0.5 ~ ~0.5 {Tags:["parent"],Age:6000,InLove:0,PersistenceRequired:1b}',
      'summon cow ~1.5 ~ ~0.5 {Tags:["parent"],Age:0,InLove:600,PersistenceRequired:1b}');
    await world.step(80);
    await countEntities(world, '@e[type=cow,distance=..16]', 2);
    await world.expect('unless entity @e[type=cow,tag=!parent,distance=..16]');
  }),
  natureCase('breeding.different-species', 'Willing cows and pigs do not produce cross-species offspring', async (world) => {
    await world.command('summon cow ~0.5 ~ ~0.5 {Tags:["parent"],Age:0,InLove:600,PersistenceRequired:1b}',
      'summon pig ~1.5 ~ ~0.5 {Tags:["parent"],Age:0,InLove:600,PersistenceRequired:1b}');
    await world.step(80);
    await countEntities(world, '@e[tag=parent,distance=..16]', 2);
    await world.expect('unless entity @e[type=cow,tag=!parent,distance=..16] unless entity @e[type=pig,tag=!parent,distance=..16]');
  }),
  natureCase('breeding.ai-disabled', 'Love timers alone do not breed animals while AI is disabled', async (world) => {
    await world.command('summon cow ~0.5 ~ ~0.5 {Tags:["parent"],Age:0,InLove:600,NoAI:1b}',
      'summon cow ~1.5 ~ ~0.5 {Tags:["parent"],Age:0,InLove:600,NoAI:1b}');
    await world.step(80);
    await countEntities(world, '@e[type=cow,distance=..8]', 2);
    await world.command('execute as @e[tag=parent] run data merge entity @s {NoAI:0b}');
    await world.step(80);
    await countEntities(world, '@e[type=cow,distance=..16]', 3);
  }),
];
