import { natureCase } from './helpers.js';

export const cases = [
  natureCase('farming.solid-block-converts-farmland', 'A solid block above farmland converts it to dirt on its scheduled tick', async (world) => {
    await world.command('setblock ~ ~ ~ farmland[moisture=7]', 'setblock ~ ~1 ~ stone');
    await world.expect('if block ~ ~ ~ farmland[moisture=7]');
    await world.step(1);
    await world.expect('if block ~ ~ ~ dirt');
  }),
  ...[false, true].map((griefing) => natureCase(
    `farming.mob-trampling-${griefing}`, `A sufficiently long cow fall ${griefing ? 'tramples' : 'does not trample'} farmland with mobGriefing=${griefing}`,
    async (world) => {
      try {
        await world.command(`gamerule mobGriefing ${griefing}`, 'setblock ~ ~-1 ~ farmland[moisture=7]',
          'setblock ~ ~ ~ wheat[age=0]', 'summon cow ~0.5 ~10 ~0.5 {Tags:["falling"],PersistenceRequired:1b}',
          'attribute @e[tag=falling,limit=1] minecraft:generic.movement_speed base set 0');
        await world.step(30);
        await world.expect('if entity @e[tag=falling]');
        await world.command('execute store result score #health cts run data get entity @e[tag=falling,limit=1] Health');
        await world.expect('if score #health cts matches 1..9');
        await world.expect(`if block ~ ~-1 ~ ${griefing ? 'dirt' : 'farmland[moisture=7]'}`);
        await world.expect(`if block ~ ~ ~ ${griefing ? 'air' : 'wheat[age=0]'}`);
        if (griefing) await world.expect('if entity @e[type=item,nbt={Item:{id:"minecraft:wheat_seeds",count:1}},distance=..5]');
      } finally {
        await world.command('gamerule mobGriefing false');
      }
    },
  )),
];
