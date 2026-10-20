import { playerScenario } from './scenario.js';

export const cases = [
  playerScenario('crafting.personal_recipe', 'Taking a personal crafting result consumes input and yields four planks', async (p) => {
    await p.held('oak_log');
    await p.click(36);
    await p.click(1);
    p.inventory.expect(0, 'oak_planks', 4);
    await p.click(0);
    p.inventory.expect(-1, 'oak_planks', 4);
    p.inventory.expect(1, 'air', 0);
    await p.click(36);
    await p.world.expect(`if data entity ${p.name} Inventory[{Slot:0b,id:"minecraft:oak_planks",count:4}]`);
  }),
  playerScenario('crafting.shift_output', 'Shift-clicking a crafting output repeats the recipe until input runs out', async (p) => {
    await p.held('oak_log', 3);
    await p.click(36);
    await p.click(1);
    await p.click(0, 0, 1);
    p.inventory.expect(1, 'air', 0);
    await p.world.expect(`if data entity ${p.name} Inventory[{id:"minecraft:oak_planks",count:12}]`);
    await p.world.expect(`unless data entity ${p.name} Inventory[{id:"minecraft:oak_log"}]`);
  }),
  playerScenario('crafting.shaped_recipe', 'A shaped personal recipe requires and consumes all four inputs', async (p) => {
    await p.held('oak_planks', 4);
    await p.click(36);
    for (const slot of [1, 2, 3]) await p.click(slot, 1);
    p.inventory.expect(0, 'air', 0);
    await p.click(4);
    p.inventory.expect(0, 'crafting_table', 1);
    await p.click(0);
    await p.click(36);
    await p.world.expect(`if data entity ${p.name} Inventory[{Slot:0b,id:"minecraft:crafting_table",count:1}]`);
  }),
  playerScenario('crafting.close_inputs', 'Closing a crafting table returns unfinished ingredients to inventory', async (p) => {
    await p.world.command('setblock ~ ~ ~ crafting_table');
    await p.held('diamond', 3);
    await p.open();
    await p.click(37);
    await p.click(1);
    await p.closeContainer();
    await p.world.expect(`if data entity ${p.name} Inventory[{id:"minecraft:diamond",count:3}]`);
    await p.world.expect('unless entity @e[type=item,distance=..6]');
  }),
  playerScenario('crafting.recipe_remainders', 'Crafting cake returns all three milk buckets as empty buckets', async (p) => {
    await p.world.command('setblock ~ ~ ~ crafting_table');
    const items = ['milk_bucket', 'milk_bucket', 'milk_bucket', 'sugar', 'egg', 'sugar', 'wheat', 'wheat', 'wheat'];
    for (const [slot, item] of items.entries()) await p.world.command(`item replace entity ${p.name} hotbar.${slot} with ${item}`);
    await p.open();
    for (let slot = 0; slot < items.length; slot++) {
      await p.click(37 + slot);
      await p.click(1 + slot);
    }
    p.inventory.expect(0, 'cake', 1);
    await p.click(0);
    p.inventory.expect(-1, 'cake', 1);
    for (const slot of [1, 2, 3]) p.inventory.expect(slot, 'bucket', 1);
    await p.closeContainer();
    await p.world.expect(`if data entity ${p.name} Inventory[{id:"minecraft:bucket",count:3}]`);
    await p.world.expect(`if data entity ${p.name} Inventory[{id:"minecraft:cake",count:1}]`);
  }),
];
