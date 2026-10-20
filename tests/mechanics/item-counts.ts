import type { MechanicsWorld } from './helpers.js';

export async function expectLooseItems(
  world: MechanicsWorld, item: string, expected: number, players: readonly string[] = [],
): Promise<void> {
  const selector = `@e[type=minecraft:item,distance=..80,nbt={Item:{id:"minecraft:${item}"}}]`;
  await world.command('scoreboard players set #loose_total cts 0',
    `execute as ${selector} store result score @s cts run data get entity @s Item.count`,
    `execute as ${selector} run scoreboard players operation #loose_total cts += @s cts`);
  for (const player of players) {
    await world.expect(`if entity ${player}`);
    // A zero-count clear observes every inventory stack without consuming picked-up rewards.
    await world.command(`execute store result score #held_total cts run clear ${player} minecraft:${item} 0`,
      'scoreboard players operation #loose_total cts += #held_total cts');
  }
  await world.expect(`if score #loose_total cts matches ${expected}`,
    `Dropped and held ${item} must total exactly ${expected}`);
}
