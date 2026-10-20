import { expectEmpty, expectStack, inventory, mechanicsCase, stack, type MechanicsWorld } from './helpers.js';
import { expectLooseItems } from './item-counts.js';

const hopper = (items: readonly string[] = [], facing = 'down') =>
  `minecraft:hopper[facing=${facing}]{TransferCooldown:0,Items:[${items.join(',')}]}`;

async function chain(world: MechanicsWorld, components?: string) {
  await world.command('setblock ~ ~ ~ minecraft:barrel',
    `setblock ~ ~1 ~ ${hopper()}`, `setblock ~ ~2 ~ ${hopper()}`,
    `setblock ~ ~3 ~ minecraft:chest${inventory([stack(0, 'stone', 3, components)])}`);
}

async function furnaceExtraction(world: MechanicsWorld) {
  await world.command('setblock ~ ~ ~ minecraft:barrel', `setblock ~ ~1 ~ ${hopper()}`,
    'setblock ~ ~2 ~ minecraft:furnace', 'item replace block ~ ~2 ~ container.0 with minecraft:raw_iron 2',
    'item replace block ~ ~2 ~ container.1 with minecraft:coal');
}

export const cases = [
  mechanicsCase('network.chain_delay', 'An empty two-hopper chain does not instantaneously forward a chest item', 'networks', async (world) => {
    await chain(world);
    await world.step(1);
    await expectEmpty(world, '~ ~ ~');
    await expectStack(world, '~ ~2 ~', 0, 'stone');
    await expectStack(world, '~ ~3 ~', 0, 'stone', 2);
  }),
  mechanicsCase('network.chain_conservation', 'A two-hopper chain delivers every item exactly once', 'networks', async (world) => {
    await chain(world);
    await world.step(40);
    await expectStack(world, '~ ~ ~', 0, 'stone', 3);
    await world.result('execute if items block ~ ~ ~ container.* minecraft:stone', 3);
    await expectLooseItems(world, 'stone', 0);
    for (const position of ['~ ~1 ~', '~ ~2 ~', '~ ~3 ~']) await expectEmpty(world, position);
  }),
  mechanicsCase('network.component_route', 'Custom components survive chest to two hoppers to barrel', 'networks', async (world) => {
    await chain(world, '{"minecraft:custom_data":{route:"kept",nested:{value:7}},"minecraft:max_stack_size":16}');
    await world.step(40);
    await world.expect('if data block ~ ~ ~ Items[{Slot:0b,id:"minecraft:stone",count:3,components:{"minecraft:custom_data":{route:"kept",nested:{value:7}},"minecraft:max_stack_size":16}}]');
    await world.result('data get block ~ ~ ~ Items', 1);
    await expectEmpty(world, '~ ~3 ~');
  }),
  mechanicsCase('network.middle_lock', 'Locking the middle of a hopper chain stops downstream delivery', 'networks', async (world) => {
    await chain(world);
    await world.command('setblock ~1 ~1 ~ minecraft:redstone_block');
    await world.step(30);
    await expectEmpty(world, '~ ~ ~');
    await expectStack(world, '~ ~1 ~', 0, 'stone', 3);
  }),
  mechanicsCase('network.middle_unlock', 'Unlocking a filled middle hopper drains the preserved queue', 'networks', async (world) => {
    await chain(world);
    await world.command('setblock ~1 ~1 ~ minecraft:redstone_block');
    await world.step(30);
    await expectEmpty(world, '~ ~ ~');
    await world.command('setblock ~1 ~1 ~ minecraft:air');
    await world.step(24);
    await expectStack(world, '~ ~ ~', 0, 'stone', 3);
    await expectEmpty(world, '~ ~1 ~');
  }),
  mechanicsCase('network.competing_last_slot', 'Two hoppers competing for one slot conserve the losing item', 'networks', async (world) => {
    const slots = Array.from({ length: 9 }, (_, index) => stack(index, 'stone', index === 8 ? 63 : 64));
    await world.command(`setblock ~ ~ ~ minecraft:dropper${inventory(slots)}`,
      `setblock ~-1 ~ ~ ${hopper([stack(0, 'stone')], 'east')}`,
      `setblock ~1 ~ ~ ${hopper([stack(0, 'stone')], 'west')}`);
    await world.step(1);
    await world.result('execute if items block ~ ~ ~ container.* minecraft:stone', 576);
    await world.command('scoreboard players set #remaining cts 0',
      'execute store result score #left cts run execute if items block ~-1 ~ ~ container.* minecraft:stone',
      'execute store result score #right cts run execute if items block ~1 ~ ~ container.* minecraft:stone',
      'scoreboard players operation #remaining cts += #left cts',
      'scoreboard players operation #remaining cts += #right cts');
    await world.expect('if score #remaining cts matches 1');
  }),
  mechanicsCase('network.competing_distinct', 'Simultaneous distinct inputs remain separate stacks in a shared destination', 'networks', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:barrel',
      `setblock ~-1 ~ ~ ${hopper([stack(0, 'stone', 2)], 'east')}`,
      `setblock ~1 ~ ~ ${hopper([stack(0, 'dirt', 2)], 'west')}`);
    await world.step(9);
    await world.result('execute if items block ~ ~ ~ container.* minecraft:stone', 2);
    await world.result('execute if items block ~ ~ ~ container.* minecraft:dirt', 2);
    await world.result('data get block ~ ~ ~ Items', 2);
  }),
  mechanicsCase('network.furnace_before_output', 'An extracting hopper cannot obtain a recipe before cooking finishes', 'networks', async (world) => {
    await furnaceExtraction(world);
    await world.step(199);
    await expectEmpty(world, '~ ~ ~');
    await expectEmpty(world, '~ ~1 ~');
    await world.result('data get block ~ ~2 ~ CookTime', 199);
  }),
  mechanicsCase('network.furnace_output_pipeline', 'A furnace feeds its output through a hopper without extracting input or fuel', 'networks', async (world) => {
    await furnaceExtraction(world);
    await world.step(220);
    await expectStack(world, '~ ~ ~', 0, 'iron_ingot');
    await expectStack(world, '~ ~2 ~', 0, 'raw_iron');
    await world.expect('unless data block ~ ~2 ~ Items[{Slot:2b}]');
    await world.result('data get block ~ ~2 ~ RecipesUsed."minecraft:iron_ingot_from_smelting_raw_iron"', 1);
  }),
  mechanicsCase('network.furnace_lava_bucket_route', 'A bottom hopper extracts the lava bucket remainder while the furnace keeps burning', 'networks', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:barrel', `setblock ~ ~1 ~ ${hopper()}`,
      'setblock ~ ~2 ~ minecraft:furnace', 'item replace block ~ ~2 ~ container.0 with minecraft:raw_iron',
      'item replace block ~ ~2 ~ container.1 with minecraft:lava_bucket');
    await world.step(20);
    await expectStack(world, '~ ~ ~', 0, 'bucket');
    await world.result('data get block ~ ~2 ~ BurnTime', 19981);
    await world.expect('unless data block ~ ~2 ~ Items[{Slot:1b}]');
  }),
  mechanicsCase('network.hopper_lock_boundary', 'Power arriving at cooldown expiry prevents the pending transfer', 'networks', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:barrel', `setblock ~ ~1 ~ ${hopper([stack(0, 'stone', 2)])}`);
    await world.step(8);
    await expectStack(world, '~ ~ ~', 0, 'stone');
    await world.command('setblock ~1 ~1 ~ minecraft:redstone_block');
    await world.step(1);
    await expectStack(world, '~ ~ ~', 0, 'stone');
    await expectStack(world, '~ ~1 ~', 0, 'stone');
    await world.command('setblock ~1 ~1 ~ minecraft:air');
    await world.step(1);
    await expectStack(world, '~ ~ ~', 0, 'stone', 2);
  }),
  mechanicsCase('network.component_filter', 'A full filter hopper accepts matching components while rejecting a distinct variant', 'networks', async (world) => {
    const tagged = '{"minecraft:custom_data":{filter:1}}';
    const slots = [stack(0, 'stone', 63, tagged), ...[1, 2, 3, 4].map((slot) => stack(slot, 'dirt', 64))];
    await world.command(`setblock ~ ~ ~ minecraft:hopper[facing=east]${inventory(slots)}`,
      `setblock ~ ~1 ~ minecraft:chest${inventory([stack(0, 'stone'), stack(1, 'stone', 2, tagged)])}`);
    await world.step(1);
    await world.expect('if data block ~ ~ ~ Items[{Slot:0b,id:"minecraft:stone",count:64,components:{"minecraft:custom_data":{filter:1}}}]');
    await expectStack(world, '~ ~1 ~', 0, 'stone');
    await expectStack(world, '~ ~1 ~', 1, 'stone');
  }),
];
