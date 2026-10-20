import { expectStack, inventory, stack, storageCase, type StorageWorld } from './helpers.js';

async function loadedFurnace(world: StorageWorld, block = 'furnace', input = 'raw_iron', fuel = 'coal') {
  await world.command(`setblock ~ ~ ~ minecraft:${block}`,
    `item replace block ~ ~ ~ container.0 with minecraft:${input} 2`,
    `item replace block ~ ~ ~ container.1 with minecraft:${fuel} 2`);
}

export const furnaceCases = [
  storageCase('furnace.before_completion', 'A furnace has no output after 199 cooking ticks', 'furnaces', async (world) => {
    await loadedFurnace(world);
    await world.step(199);
    await world.expect('unless data block ~ ~ ~ Items[{Slot:2b}]');
    await world.result('data get block ~ ~ ~ CookTime', 199);
  }),
  storageCase('furnace.completion', 'A furnace completes its first recipe on cooking tick 200', 'furnaces', async (world) => {
    await loadedFurnace(world);
    await world.step(200);
    await expectStack(world, '~ ~ ~', 2, 'iron_ingot');
    await expectStack(world, '~ ~ ~', 0, 'raw_iron');
    await world.result('data get block ~ ~ ~ CookTime', 0);
  }),
  storageCase('furnace.fuel_start', 'A furnace consumes one coal and starts with 1600 burn ticks', 'furnaces', async (world) => {
    await loadedFurnace(world);
    await world.step(1);
    await expectStack(world, '~ ~ ~', 1, 'coal');
    await world.result('data get block ~ ~ ~ BurnTime', 1600);
    await world.expect('if block ~ ~ ~ minecraft:furnace[lit=true]');
  }),
  storageCase('furnace.first_tick_cooking', 'Fuel ignition also advances cooking during the same tick', 'furnaces', async (world) => {
    await loadedFurnace(world);
    await world.step(1);
    await world.result('data get block ~ ~ ~ CookTime', 1);
    await world.result('data get block ~ ~ ~ CookTimeTotal', 200);
  }),
  storageCase('blast_furnace.completion', 'A blast furnace completes an ore recipe in 100 ticks', 'furnaces', async (world) => {
    await loadedFurnace(world, 'blast_furnace');
    await world.step(99);
    await world.expect('unless data block ~ ~ ~ Items[{Slot:2b}]');
    await world.step(1);
    await expectStack(world, '~ ~ ~', 2, 'iron_ingot');
  }),
  storageCase('smoker.completion', 'A smoker completes a food recipe in 100 ticks', 'furnaces', async (world) => {
    await loadedFurnace(world, 'smoker', 'beef');
    await world.step(99);
    await world.expect('unless data block ~ ~ ~ Items[{Slot:2b}]');
    await world.step(1);
    await expectStack(world, '~ ~ ~', 2, 'cooked_beef');
  }),
  storageCase('blast_furnace.reject_food', 'Blast furnaces leave food and fuel untouched', 'furnaces', async (world) => {
    await loadedFurnace(world, 'blast_furnace', 'beef');
    await world.step(110);
    await expectStack(world, '~ ~ ~', 0, 'beef', 2);
    await expectStack(world, '~ ~ ~', 1, 'coal', 2);
    await world.result('data get block ~ ~ ~ BurnTime', 0);
  }),
  storageCase('smoker.reject_ore', 'Smokers leave ore and fuel untouched', 'furnaces', async (world) => {
    await loadedFurnace(world, 'smoker');
    await world.step(110);
    await expectStack(world, '~ ~ ~', 0, 'raw_iron', 2);
    await expectStack(world, '~ ~ ~', 1, 'coal', 2);
    await world.result('data get block ~ ~ ~ CookTime', 0);
  }),
  storageCase('furnace.invalid_input', 'A non-smeltable input does not ignite fuel', 'furnaces', async (world) => {
    await loadedFurnace(world, 'furnace', 'dirt');
    await world.step(10);
    await expectStack(world, '~ ~ ~', 1, 'coal', 2);
    await world.expect('if block ~ ~ ~ minecraft:furnace[lit=false]');
  }),
  storageCase('furnace.output_mismatch', 'An incompatible output prevents fuel consumption', 'furnaces', async (world) => {
    await loadedFurnace(world);
    await world.command('item replace block ~ ~ ~ container.2 with minecraft:gold_ingot');
    await world.step(10);
    await expectStack(world, '~ ~ ~', 1, 'coal', 2);
    await expectStack(world, '~ ~ ~', 2, 'gold_ingot');
    await world.result('data get block ~ ~ ~ CookTime', 0);
  }),
  storageCase('furnace.output_full', 'A full output stack prevents a cold furnace from igniting', 'furnaces', async (world) => {
    await loadedFurnace(world);
    await world.command('item replace block ~ ~ ~ container.2 with minecraft:iron_ingot 64');
    await world.step(10);
    await expectStack(world, '~ ~ ~', 1, 'coal', 2);
    await world.result('data get block ~ ~ ~ BurnTime', 0);
  }),
  storageCase('furnace.resume_capacity', 'Clearing output space resumes a blocked furnace', 'furnaces', async (world) => {
    await loadedFurnace(world);
    await world.command('item replace block ~ ~ ~ container.2 with minecraft:iron_ingot 64');
    await world.step(2);
    await world.command('item replace block ~ ~ ~ container.2 with minecraft:iron_ingot 63');
    await world.step(200);
    await expectStack(world, '~ ~ ~', 2, 'iron_ingot', 64);
    await expectStack(world, '~ ~ ~', 0, 'raw_iron');
  }),
  storageCase('furnace.burn_without_input', 'An already burning furnace continues consuming burn time without input', 'furnaces', async (world) => {
    await loadedFurnace(world);
    await world.step(1);
    await world.command('item replace block ~ ~ ~ container.0 with minecraft:air');
    await world.step(20);
    await world.result('data get block ~ ~ ~ BurnTime', 1580);
    await world.result('data get block ~ ~ ~ CookTime', 0);
  }),
  storageCase('furnace.cooling_decay', 'Unfueled cooking progress decays by two per tick', 'furnaces', async (world) => {
    await world.command(`setblock ~ ~ ~ minecraft:furnace{CookTime:10s,CookTimeTotal:200s,Items:[${stack(0, 'raw_iron')}]}`);
    await world.step(1);
    await world.result('data get block ~ ~ ~ CookTime', 8);
    await world.step(4);
    await world.result('data get block ~ ~ ~ CookTime', 0);
  }),
  storageCase('furnace.no_input_no_fuel', 'Fuel alone cannot light a furnace', 'furnaces', async (world) => {
    await world.command(`setblock ~ ~ ~ minecraft:furnace${inventory([stack(1, 'coal')])}`);
    await world.step(10);
    await expectStack(world, '~ ~ ~', 1, 'coal');
    await world.result('data get block ~ ~ ~ BurnTime', 0);
  }),
  storageCase('furnace.lava_remainder', 'Lava fuel leaves an empty bucket in the fuel slot', 'furnaces', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:furnace', 'item replace block ~ ~ ~ container.0 with minecraft:raw_iron',
      'item replace block ~ ~ ~ container.1 with minecraft:lava_bucket');
    await world.step(1);
    await expectStack(world, '~ ~ ~', 1, 'bucket');
    await world.result('data get block ~ ~ ~ BurnTime', 20000);
  }),
  storageCase('furnace.wet_sponge_bucket', 'Smelting wet sponge fills an empty bucket left by lava fuel', 'furnaces', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:furnace', 'item replace block ~ ~ ~ container.0 with minecraft:wet_sponge',
      'item replace block ~ ~ ~ container.1 with minecraft:lava_bucket');
    await world.step(200);
    await expectStack(world, '~ ~ ~', 1, 'water_bucket');
    await expectStack(world, '~ ~ ~', 2, 'sponge');
  }),
  storageCase('furnace.insufficient_fuel', 'A single stick cannot complete a 200 tick furnace recipe', 'furnaces', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:furnace', 'item replace block ~ ~ ~ container.0 with minecraft:raw_iron',
      'item replace block ~ ~ ~ container.1 with minecraft:stick');
    await world.step(1);
    await world.result('data get block ~ ~ ~ BurnTime', 100);
    await world.step(200);
    await expectStack(world, '~ ~ ~', 0, 'raw_iron');
    await world.expect('unless data block ~ ~ ~ Items[{Slot:2b}]');
    await world.result('data get block ~ ~ ~ CookTime', 0);
  }),
  storageCase('blast_furnace.fuel_duration', 'Blast furnaces halve coal burn duration to 800 ticks', 'furnaces', async (world) => {
    await loadedFurnace(world, 'blast_furnace');
    await world.step(1);
    await world.result('data get block ~ ~ ~ BurnTime', 800);
  }),
  storageCase('furnace.recipe_ledger', 'A furnace records completed recipe counts while outputs accumulate', 'furnaces', async (world) => {
    await loadedFurnace(world);
    await world.step(400);
    await expectStack(world, '~ ~ ~', 2, 'iron_ingot', 2);
    await world.expect('unless data block ~ ~ ~ Items[{Slot:0b}]');
    await world.result('data get block ~ ~ ~ RecipesUsed."minecraft:iron_ingot_from_smelting_raw_iron"', 2);
  }),
];
