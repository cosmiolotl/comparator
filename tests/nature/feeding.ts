import minecraftData from 'minecraft-data';
import { playerNatureCase } from './helpers.js';

const ages = [
  { id: 'adult', subject: 'an adult cow', age: 0, expectedAge: 0, expectedLove: 600, remainingFood: 2 },
  { id: 'cooldown', subject: 'a cow on cooldown', age: 6000, expectedAge: 6000, expectedLove: 0, remainingFood: 3 },
  { id: 'baby', subject: 'a baby cow', age: -24000, expectedAge: -21600, expectedLove: 0, remainingFood: 2 },
];

export const cases = ages.map(({ id, subject, age, expectedAge, expectedLove, remainingFood }) => playerNatureCase(
  `feeding.${id}-cow`, `Feeding ${subject} applies its breeding or growth rules and correct food consumption`,
  async (player) => {
    const world = player.world;
    await world.command('tick rate 20', `gamemode survival ${player.name}`);
    await player.held('wheat', 3);
    const spawn = player.session.waitFor('spawn_entity', 'play', ({ data }) => {
      return data.type === minecraftData('1.21.1').entitiesByName.cow?.id;
    });
    await world.command(`summon cow ~0.5 ~ ~1.5 {Tags:["fed"],NoAI:1b,Age:${age}}`);
    const target = Number((await spawn).data.entityId);
    player.session.write('use_entity', { target, mouse: 0, hand: 0, sneaking: false });
    await player.fence();
    await world.result('data get entity @e[tag=fed,limit=1] Age', expectedAge);
    await world.result('data get entity @e[tag=fed,limit=1] InLove', expectedLove);
    await world.result(`clear ${player.name} wheat 0`, remainingFood);
  },
));
