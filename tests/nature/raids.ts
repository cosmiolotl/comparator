import type { World } from '../../src/world/world.js';
import { playerNatureCase } from './helpers.js';

async function village(world: World): Promise<void> {
  await world.command('setblock ~2 ~ ~ red_bed[part=foot,facing=east]',
    'setblock ~3 ~ ~ red_bed[part=head,facing=east]',
    'summon villager ~1.5 ~ ~0.5 {Tags:["resident"],VillagerData:{type:"minecraft:plains",profession:"minecraft:none",level:1}}');
  await world.step(200);
  await world.expect('if data entity @e[tag=resident,limit=1] Brain.memories."minecraft:home"');
}

export const cases = [
  playerNatureCase('raids.village-converts-bad-omen', 'Entering a village with Bad Omen converts it to Raid Omen', async (player) => {
    const world = player.world;
    await village(world);
    await world.command('tick rate 20');
    try {
      await world.command(`effect give ${player.name} bad_omen infinite 0 true`);
      await world.step(2);
      await world.expect(`if entity @a[name=${player.name},nbt={active_effects:[{id:"minecraft:raid_omen"}]}]`);
      await world.expect(`unless entity @a[name=${player.name},nbt={active_effects:[{id:"minecraft:bad_omen"}]}]`);
    } finally {
      await world.command(`effect clear ${player.name} bad_omen`, `effect clear ${player.name} raid_omen`,
        'setblock ~2 ~ ~ air', 'setblock ~3 ~ ~ air');
    }
  }),
  playerNatureCase('raids.peaceful-prevents-omen-conversion', 'Peaceful difficulty prevents village entry from converting Bad Omen', async (player) => {
    const world = player.world;
    await village(world);
    try {
      await world.command('difficulty peaceful', 'tick rate 20', `effect give ${player.name} bad_omen infinite 0 true`);
      await world.step(2);
      await world.expect(`if entity @a[name=${player.name},nbt={active_effects:[{id:"minecraft:bad_omen"}]}]`);
      await world.expect(`unless entity @a[name=${player.name},nbt={active_effects:[{id:"minecraft:raid_omen"}]}]`);
    } finally {
      await world.command(`effect clear ${player.name} bad_omen`, `effect clear ${player.name} raid_omen`, 'difficulty normal',
        'setblock ~2 ~ ~ air', 'setblock ~3 ~ ~ air');
    }
  }),
  playerNatureCase('raids.spectator-prevents-omen-conversion', 'A spectator entering a village retains Bad Omen without triggering Raid Omen', async (player) => {
    const world = player.world;
    await village(world);
    try {
      await world.command(`gamemode spectator ${player.name}`, 'tick rate 20', `effect give ${player.name} bad_omen infinite 0 true`);
      await world.step(2);
      await world.expect(`if entity @a[name=${player.name},nbt={active_effects:[{id:"minecraft:bad_omen"}]}]`);
      await world.expect(`unless entity @a[name=${player.name},nbt={active_effects:[{id:"minecraft:raid_omen"}]}]`);
    } finally {
      await world.command(`effect clear ${player.name} bad_omen`, `effect clear ${player.name} raid_omen`,
        'setblock ~2 ~ ~ air', 'setblock ~3 ~ ~ air');
    }
  }),
];

