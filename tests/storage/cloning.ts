import { expectEmpty, expectStack, inventory, stack, storageCase } from './helpers.js';

const cloneSingle = 'clone ~ ~ ~ ~ ~ ~ ~4 ~ ~';

export const cloningCases = [
  storageCase('clone.inventory', 'Cloning a chest copies its inventory while retaining the source', 'cloning', async (world) => {
    await world.command(`setblock ~ ~ ~ minecraft:chest${inventory([stack(5, 'diamond', 7)])}`, cloneSingle);
    await expectStack(world, '~4 ~ ~', 5, 'diamond', 7);
    await expectStack(world, '~ ~ ~', 5, 'diamond', 7);
  }),
  storageCase('clone.item_components', 'Cloning block entities preserves nested item components', 'cloning', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:chest', 'item replace block ~ ~ ~ container.0 with minecraft:diamond_sword[damage=17,custom_data={marker:3}]', cloneSingle);
    await world.expect('if items block ~4 ~ ~ container.0 minecraft:diamond_sword[damage=17,custom_data={marker:3}]');
  }),
  storageCase('clone.name_and_lock', 'Cloning retains a container name and lock value', 'cloning', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:barrel{CustomName:\'{"text":"Stored name"}\',Lock:"test key"}', cloneSingle,
      'data modify storage comparator:storage clone_name set from block ~ ~ ~ CustomName');
    await world.expect('if data block ~4 ~ ~ CustomName');
    await world.result('data modify storage comparator:storage clone_name set from block ~4 ~ ~ CustomName', 0);
    await world.expect('if data block ~4 ~ ~ {Lock:"test key"}');
  }),
  storageCase('clone.furnace_timers', 'Cloning a furnace preserves cooking and burn timers', 'cloning', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:furnace{BurnTime:100s,CookTime:19s,CookTimeTotal:200s}', cloneSingle);
    await world.expect('if data block ~4 ~ ~ {BurnTime:100s,CookTime:19s,CookTimeTotal:200s}');
  }),
  storageCase('clone.hopper_cooldown', 'Cloning a hopper preserves its transfer cooldown', 'cloning', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:hopper{TransferCooldown:7}', cloneSingle);
    await world.result('data get block ~4 ~ ~ TransferCooldown', 7);
  }),
  storageCase('clone.inventory_independence', 'Editing a cloned inventory does not alter its source', 'cloning', async (world) => {
    await world.command(`setblock ~ ~ ~ minecraft:chest${inventory([stack(0, 'stone', 8)])}`, cloneSingle,
      'item replace block ~4 ~ ~ container.0 with minecraft:dirt 2');
    await expectStack(world, '~ ~ ~', 0, 'stone', 8);
    await expectStack(world, '~4 ~ ~', 0, 'dirt', 2);
  }),
  storageCase('clone.move', 'Clone move relocates inventory without dropping its contents', 'cloning', async (world) => {
    await world.command(`setblock ~ ~ ~ minecraft:chest${inventory([stack(0, 'stone', 8)])}`, `${cloneSingle} replace move`);
    await world.expect('if block ~ ~ ~ minecraft:air');
    await expectStack(world, '~4 ~ ~', 0, 'stone', 8);
    await world.expect('unless entity @e[type=minecraft:item,distance=..8]');
  }),
  storageCase('clone.masked_air', 'Masked cloning leaves target blocks under source air unchanged', 'cloning', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:stone', 'setblock ~5 ~ ~ minecraft:gold_block',
      'clone ~ ~ ~ ~1 ~ ~ ~4 ~ ~ masked');
    await world.expect('if block ~4 ~ ~ minecraft:stone');
    await world.expect('if block ~5 ~ ~ minecraft:gold_block');
  }),
  storageCase('clone.replace_air', 'Replace cloning copies air over target blocks', 'cloning', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:stone', 'setblock ~5 ~ ~ minecraft:gold_block',
      'clone ~ ~ ~ ~1 ~ ~ ~4 ~ ~ replace');
    await world.expect('if block ~4 ~ ~ minecraft:stone');
    await world.expect('if block ~5 ~ ~ minecraft:air');
  }),
  storageCase('clone.filtered', 'Filtered cloning copies only blocks matching its predicate', 'cloning', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:stone', 'setblock ~1 ~ ~ minecraft:dirt',
      'setblock ~4 ~ ~ minecraft:gold_block', 'setblock ~5 ~ ~ minecraft:gold_block',
      'clone ~ ~ ~ ~1 ~ ~ ~4 ~ ~ filtered minecraft:stone');
    await world.expect('if block ~4 ~ ~ minecraft:stone');
    await world.expect('if block ~5 ~ ~ minecraft:gold_block');
  }),
  storageCase('clone.block_state', 'Cloning preserves block orientation and waterlogged state', 'cloning', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:chest[facing=west,waterlogged=true]', cloneSingle);
    await world.expect('if block ~4 ~ ~ minecraft:chest[facing=west,waterlogged=true]');
  }),
  storageCase('clone.excludes_entities', 'Clone copies blocks without duplicating entities in the source region', 'cloning', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:stone',
      'summon minecraft:armor_stand ~0.5 ~1 ~0.5 {Tags:["cts_clone"],NoGravity:1b}',
      'clone ~ ~ ~ ~ ~2 ~ ~4 ~ ~');
    await world.expect('if entity @e[tag=cts_clone,distance=..3]');
    await world.result('execute positioned ~4 ~ ~ if entity @e[tag=cts_clone,distance=..3]', 0);
  }),
  storageCase('clone.overwrite_inventory', 'Cloning onto an existing container replaces its old inventory', 'cloning', async (world) => {
    await world.command(`setblock ~ ~ ~ minecraft:chest${inventory([stack(0, 'stone')])}`,
      `setblock ~4 ~ ~ minecraft:chest${inventory([stack(9, 'diamond', 3)])}`, cloneSingle);
    await expectStack(world, '~4 ~ ~', 0, 'stone');
    await world.expect('unless data block ~4 ~ ~ Items[{id:"minecraft:diamond"}]');
    await world.result('data get block ~4 ~ ~ Items', 1);
  }),
  storageCase('block_entity.replace_clears_inventory', 'Replacing a container block with a different container creates a fresh inventory', 'cloning', async (world) => {
    await world.command(`setblock ~ ~ ~ minecraft:chest${inventory([stack(0, 'diamond', 3)])}`,
      'setblock ~ ~ ~ minecraft:barrel');
    await expectEmpty(world, '~ ~ ~');
    await world.expect('if block ~ ~ ~ minecraft:barrel');
  }),
  storageCase('clone.overlap_rejected', 'Normal clone rejects overlapping source and destination regions', 'cloning', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:stone', 'setblock ~1 ~ ~ minecraft:dirt');
    await world.result('clone ~ ~ ~ ~1 ~ ~ ~1 ~ ~ replace normal', 0);
    await world.expect('if block ~ ~ ~ minecraft:stone');
    await world.expect('if block ~1 ~ ~ minecraft:dirt');
    await world.expect('if block ~2 ~ ~ minecraft:air');
  }),
];
