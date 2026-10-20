import { expectEmpty, expectStack, inventory, stack, storageCase, type StorageWorld } from './helpers.js';

async function itemInChest(world: StorageWorld, item: string, count = 1) {
  await world.command('setblock ~ ~ ~ minecraft:chest', `item replace block ~ ~ ~ container.0 with minecraft:${item} ${count}`);
}

export const componentCases = [
  storageCase('item.default_count', 'An omitted serialized item count is normalized to one', 'item-components', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:chest{Items:[{Slot:0b,id:"minecraft:stone"}]}');
    await expectStack(world, '~ ~ ~', 0, 'stone');
  }),
  storageCase('item.count_integer', 'Serialized item counts use an integer rather than a byte', 'item-components', async (world) => {
    await itemInChest(world, 'stone', 3);
    await world.expect('if data block ~ ~ ~ Items[{count:3}]');
    await world.expect('unless data block ~ ~ ~ Items[{count:3b}]');
  }),
  storageCase('item.default_component_elision', 'Default damage is available to predicates but omitted from serialized patches', 'item-components', async (world) => {
    await itemInChest(world, 'diamond_sword[damage=0]');
    await world.expect('if items block ~ ~ ~ container.0 minecraft:diamond_sword[damage=0]');
    await world.expect('unless data block ~ ~ ~ Items[0].components."minecraft:damage"');
  }),
  storageCase('item.custom_data_types', 'Custom data preserves nested NBT and numeric tag types', 'item-components', async (world) => {
    await itemInChest(world, 'stick[custom_data={flag:1b,nested:{value:7L},list:[1,2]}]');
    await world.expect('if data block ~ ~ ~ Items[{components:{"minecraft:custom_data":{flag:1b,nested:{value:7L},list:[I;1,2]}}}]');
  }),
  storageCase('item.damage_patch', 'Nonzero durability damage is serialized as an item component', 'item-components', async (world) => {
    await itemInChest(world, 'diamond_sword[damage=17]');
    await world.result('data get block ~ ~ ~ Items[0].components."minecraft:damage"', 17);
  }),
  storageCase('item.enchantments', 'Enchantment level maps survive inventory serialization', 'item-components', async (world) => {
    await itemInChest(world, 'diamond_sword[enchantments={levels:{"minecraft:sharpness":3,"minecraft:unbreaking":2}}]');
    await world.expect('if items block ~ ~ ~ container.0 minecraft:diamond_sword[enchantments={levels:{"minecraft:sharpness":3,"minecraft:unbreaking":2}}]');
  }),
  storageCase('item.component_removal', 'Explicit component removal overrides an item default', 'item-components', async (world) => {
    await itemInChest(world, 'diamond_sword[!attribute_modifiers]');
    await world.expect('if items block ~ ~ ~ container.0 minecraft:diamond_sword[!attribute_modifiers]');
    await world.expect('if data block ~ ~ ~ Items[0].components."!minecraft:attribute_modifiers"');
  }),
  storageCase('item.unbreakable', 'The unbreakable component retains its tooltip visibility setting', 'item-components', async (world) => {
    await itemInChest(world, 'diamond_sword[unbreakable={show_in_tooltip:false}]');
    await world.expect('if data block ~ ~ ~ Items[{components:{"minecraft:unbreakable":{show_in_tooltip:0b}}}]');
  }),
  storageCase('item.custom_stack_limit', 'A custom stack size changes hopper insertion capacity', 'item-components', async (world) => {
    await itemInChest(world, 'stone[max_stack_size=2]', 2);
    await world.command('setblock ~ ~1 ~ minecraft:hopper[facing=down]',
      'item replace block ~ ~1 ~ container.0 with minecraft:stone[max_stack_size=2]');
    await world.step(1);
    await expectStack(world, '~ ~ ~', 0, 'stone', 2);
    await expectStack(world, '~ ~ ~', 1, 'stone');
  }),
  storageCase('item.container_component', 'Shulker item contents retain nested item counts and components', 'item-components', async (world) => {
    await itemInChest(world, 'shulker_box[container=[{slot:4,item:{id:"minecraft:stone",count:7,components:{"minecraft:custom_data":{marker:1}}}}]]');
    await world.expect('if items block ~ ~ ~ container.0 minecraft:shulker_box[container~{items:{contains:[{items:"minecraft:stone",count:7,predicates:{"minecraft:custom_data":{marker:1}}}]}}]');
  }),
  storageCase('item.copy_independence', 'Copying an inventory slot produces an independent stack with preserved components', 'item-components', async (world) => {
    await itemInChest(world, 'stick[custom_data={marker:7}]', 3);
    await world.command('setblock ~1 ~ ~ minecraft:barrel', 'item replace block ~1 ~ ~ container.2 from block ~ ~ ~ container.0',
      'item replace block ~ ~ ~ container.0 with minecraft:dirt');
    await world.expect('if items block ~1 ~ ~ container.2 minecraft:stick[count=3,custom_data={marker:7}]');
    await expectStack(world, '~ ~ ~', 0, 'dirt');
  }),
  storageCase('item.air_clears_slot', 'Replacing an inventory slot with air removes its serialized entry', 'item-components', async (world) => {
    await itemInChest(world, 'stone');
    await world.command('item replace block ~ ~ ~ container.0 with minecraft:air');
    await expectEmpty(world, '~ ~ ~');
  }),
  storageCase('item.predicate_exact_data', 'Exact custom data matching rejects additional keys', 'item-components', async (world) => {
    await itemInChest(world, 'stick[custom_data={one:1,two:2}]');
    await world.expect('unless items block ~ ~ ~ container.0 minecraft:stick[custom_data={one:1}]');
    await world.expect('if items block ~ ~ ~ container.0 minecraft:stick[custom_data={one:1,two:2}]');
  }),
  storageCase('item.predicate_partial_data', 'Partial custom data matching accepts additional nested keys', 'item-components', async (world) => {
    await itemInChest(world, 'stick[custom_data={nested:{one:1,two:2}}]');
    await world.expect('if items block ~ ~ ~ container.0 minecraft:stick[custom_data~{nested:{one:1}}]');
    await world.expect('unless items block ~ ~ ~ container.0 minecraft:stick[custom_data~{nested:{one:2}}]');
  }),
  storageCase('item.predicate_list_subset', 'Partial custom data list matching ignores order and accepts extra elements', 'item-components', async (world) => {
    await itemInChest(world, 'stick[custom_data={values:["one","two","three"]}]');
    await world.expect('if items block ~ ~ ~ container.0 minecraft:stick[custom_data~{values:["three","one"]}]');
    await world.expect('unless items block ~ ~ ~ container.0 minecraft:stick[custom_data~{values:["four"]}]');
  }),
  storageCase('item.predicate_count_range', 'Item count predicates apply to each individual stack', 'item-components', async (world) => {
    await world.command(`setblock ~ ~ ~ minecraft:chest${inventory([stack(0, 'stone', 3), stack(1, 'stone', 8)])}`);
    await world.result('execute if items block ~ ~ ~ container.* minecraft:stone[count~{min:2,max:4}]', 3);
  }),
  storageCase('item.predicate_disjunction', 'Item predicate alternatives accept absent or zero damage while rejecting damaged tools', 'item-components', async (world) => {
    await itemInChest(world, 'stone');
    await world.command('item replace block ~ ~ ~ container.1 with minecraft:diamond_sword',
      'item replace block ~ ~ ~ container.2 with minecraft:diamond_sword[damage=1]');
    await world.result('execute if items block ~ ~ ~ container.* *[!damage|damage=0]', 2);
  }),
  storageCase('item.slot_range_sum', 'The container slot range counts items rather than occupied slots', 'item-components', async (world) => {
    await world.command(`setblock ~ ~ ~ minecraft:chest${inventory([stack(0, 'stone', 3), stack(26, 'stone', 7), stack(8, 'dirt', 9)])}`);
    await world.result('execute if items block ~ ~ ~ container.* minecraft:stone', 10);
  }),
  storageCase('item.empty_source_copy', 'Copying an empty inventory slot clears the destination', 'item-components', async (world) => {
    await itemInChest(world, 'stone');
    await world.command('item replace block ~ ~ ~ container.0 from block ~ ~ ~ container.1');
    await expectEmpty(world, '~ ~ ~');
  }),
  storageCase('item.inline_modifier', 'An inline item modifier changes count while preserving custom data', 'item-components', async (world) => {
    await itemInChest(world, 'stick[custom_data={marker:9}]');
    await world.command('item modify block ~ ~ ~ container.0 {function:"minecraft:set_count",count:5,add:false}');
    await world.expect('if items block ~ ~ ~ container.0 minecraft:stick[count=5,custom_data={marker:9}]');
  }),
];
