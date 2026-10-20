import { expectEmpty, expectStack, inventory, mechanicsCase, stack, type MechanicsWorld } from './helpers.js';

async function sorter(world: MechanicsWorld) {
  const filters = [stack(0, 'iron_ingot', 41), ...[1, 2, 3, 4].map((slot) =>
    stack(slot, 'stone', 1, '{"minecraft:custom_data":{filter:1}}'))];
  await world.command('fill ~-1 ~ ~-1 ~6 ~ ~3 minecraft:stone', 'setblock ~ ~-1 ~ minecraft:barrel',
    'setblock ~ ~ ~ minecraft:hopper[facing=down]',
    'setblock ~ ~1 ~ minecraft:hopper[facing=down]',
    `setblock ~ ~2 ~ minecraft:hopper[facing=west]${inventory(filters)}`,
    'fill ~1 ~1 ~ ~4 ~1 ~ minecraft:stone', 'setblock ~1 ~2 ~ minecraft:comparator[facing=west]',
    'fill ~2 ~2 ~ ~4 ~2 ~ minecraft:redstone_wire',
    'setblock ~5 ~1 ~ minecraft:redstone_wall_torch[facing=east]',
    'fill ~ ~1 ~2 ~5 ~1 ~2 minecraft:redstone_wire',
    'setblock ~5 ~1 ~1 minecraft:redstone_wire', 'setblock ~ ~1 ~1 minecraft:redstone_wire');
  await world.step(10);
  await world.expect('if block ~ ~1 ~ minecraft:hopper[enabled=false]');
  await world.result('data get block ~1 ~2 ~ OutputSignal', 2);
  await expectStack(world, '~ ~2 ~', 0, 'iron_ingot', 41);
}

export const cases = [
  mechanicsCase('sorter.matching_item', 'A comparator sorter unlocks at threshold and extracts only the surplus matching item', 'networks', async (world) => {
    await sorter(world);
    await world.command(`setblock ~ ~3 ~ minecraft:chest${inventory([stack(0, 'iron_ingot')])}`);
    await world.step(30);
    await expectStack(world, '~ ~ ~', 0, 'iron_ingot');
    await expectStack(world, '~ ~2 ~', 0, 'iron_ingot', 41);
    await expectEmpty(world, '~ ~3 ~');
    await world.expect('if block ~ ~1 ~ minecraft:hopper[enabled=false]');
    await world.result('data get block ~1 ~2 ~ OutputSignal', 2);
  }),
  mechanicsCase('sorter.reject_nonmatching', 'A comparator sorter leaves nonmatching input untouched and stays locked', 'networks', async (world) => {
    await sorter(world);
    await world.command(`setblock ~ ~3 ~ minecraft:chest${inventory([stack(0, 'gold_ingot')])}`);
    await world.step(30);
    await expectEmpty(world, '~ ~ ~');
    await expectStack(world, '~ ~2 ~', 0, 'iron_ingot', 41);
    await expectStack(world, '~ ~3 ~', 0, 'gold_ingot');
    await world.expect('if block ~ ~1 ~ minecraft:hopper[enabled=false]');
  }),
  mechanicsCase('sorter.component_mismatch', 'A sorter does not treat different item components as matching filter stock', 'networks', async (world) => {
    await sorter(world);
    await world.command(`setblock ~ ~3 ~ minecraft:chest${inventory([stack(0, 'iron_ingot', 1, '{"minecraft:custom_data":{special:1}}')])}`);
    await world.step(30);
    await expectEmpty(world, '~ ~ ~');
    await expectStack(world, '~ ~2 ~', 0, 'iron_ingot', 41);
    await world.expect('if data block ~ ~3 ~ Items[{Slot:0b,id:"minecraft:iron_ingot",count:1,components:{"minecraft:custom_data":{special:1}}}]');
  }),
];
