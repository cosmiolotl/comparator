import { expectEmpty, expectStack, inventory, stack, storageCase, type StorageWorld } from './helpers.js';

const hopper = (items: readonly string[] = []) =>
  `minecraft:hopper[facing=down]{TransferCooldown:0,Items:[${items.join(',')}]}`;
const stone = (count = 1, slot = 0) => stack(slot, 'stone', count);
async function fullChest(world: StorageWorld, lastCount = 64) {
  await world.command('setblock ~ ~ ~ minecraft:chest');
  for (let slot = 0; slot < 27; slot++) {
    await world.command(`item replace block ~ ~ ~ container.${slot} with minecraft:stone ${slot === 26 ? lastCount : 64}`);
  }
}

export const hopperCases = [
  storageCase('hopper.push_one', 'A hopper pushes exactly one item per transfer', 'hoppers', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:chest', `setblock ~ ~1 ~ ${hopper([stone(3)])}`);
    await world.step(1);
    await expectStack(world, '~ ~ ~', 0, 'stone');
    await expectStack(world, '~ ~1 ~', 0, 'stone', 2);
  }),
  storageCase('hopper.pull_one', 'A hopper pulls exactly one item from an inventory above', 'hoppers', async (world) => {
    await world.command(`setblock ~ ~1 ~ minecraft:chest${inventory([stone(3)])}`, `setblock ~ ~ ~ ${hopper()}`);
    await world.step(1);
    await expectStack(world, '~ ~ ~', 0, 'stone');
    await expectStack(world, '~ ~1 ~', 0, 'stone', 2);
  }),
  storageCase('hopper.cooldown_reset', 'Successful hopper output sets an eight tick cooldown', 'hoppers', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:chest', `setblock ~ ~1 ~ ${hopper([stone(3)])}`);
    await world.step(1);
    await world.result('data get block ~ ~1 ~ TransferCooldown', 8);
  }),
  storageCase('hopper.cooldown_boundary', 'Seven ticks after a transfer do not permit another output', 'hoppers', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:chest', `setblock ~ ~1 ~ ${hopper([stone(3)])}`);
    await world.step(8);
    await expectStack(world, '~ ~ ~', 0, 'stone');
    await world.result('data get block ~ ~1 ~ TransferCooldown', 1);
  }),
  storageCase('hopper.cooldown_expiry', 'A second hopper transfer occurs on the ninth active tick', 'hoppers', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:chest', `setblock ~ ~1 ~ ${hopper([stone(3)])}`);
    await world.step(9);
    await expectStack(world, '~ ~ ~', 0, 'stone', 2);
  }),
  storageCase('hopper.lock_output', 'Redstone power prevents hopper output', 'hoppers', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:chest', 'setblock ~1 ~1 ~ minecraft:redstone_block', `setblock ~ ~1 ~ ${hopper([stone()])}`);
    await world.step(10);
    await expectEmpty(world, '~ ~ ~');
    await expectStack(world, '~ ~1 ~', 0, 'stone');
  }),
  storageCase('hopper.lock_input', 'Redstone power prevents pulling from containers', 'hoppers', async (world) => {
    await world.command(`setblock ~ ~1 ~ minecraft:chest${inventory([stone()])}`, 'setblock ~1 ~ ~ minecraft:redstone_block', `setblock ~ ~ ~ ${hopper()}`);
    await world.step(10);
    await expectEmpty(world, '~ ~ ~');
    await expectStack(world, '~ ~1 ~', 0, 'stone');
  }),
  storageCase('hopper.lock_pickup', 'A locked hopper leaves loose items uncollected', 'hoppers', async (world) => {
    await world.command('setblock ~1 ~ ~ minecraft:redstone_block', `setblock ~ ~ ~ ${hopper()}`,
      'summon minecraft:item ~0.5 ~1 ~0.5 {Tags:["cts_pickup"],NoGravity:1b,Item:{id:"minecraft:stone",count:3}}');
    await world.step(10);
    await expectEmpty(world, '~ ~ ~');
    await world.expect('if entity @e[type=minecraft:item,tag=cts_pickup,nbt={Item:{count:3}}]');
  }),
  storageCase('hopper.unlock', 'Removing power allows a hopper to transfer again', 'hoppers', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:chest', 'setblock ~1 ~1 ~ minecraft:redstone_block', `setblock ~ ~1 ~ ${hopper([stone()])}`);
    await world.step(2);
    await world.command('setblock ~1 ~1 ~ minecraft:air');
    await world.step(1);
    await expectStack(world, '~ ~ ~', 0, 'stone');
  }),
  storageCase('hopper.no_ejection', 'A hopper facing air retains its items', 'hoppers', async (world) => {
    await world.command(`setblock ~ ~1 ~ ${hopper([stone(2)])}`);
    await world.step(10);
    await expectStack(world, '~ ~1 ~', 0, 'stone', 2);
    await world.expect('unless entity @e[type=minecraft:item,distance=..4]');
  }),
  storageCase('hopper.facing', 'Horizontal hopper output follows its facing rather than gravity', 'hoppers', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:chest', 'setblock ~1 ~1 ~ minecraft:barrel',
      `setblock ~ ~1 ~ minecraft:hopper[facing=east]${inventory([stone(2)])}`);
    await world.step(1);
    await expectStack(world, '~1 ~1 ~', 0, 'stone');
    await expectEmpty(world, '~ ~ ~');
  }),
  storageCase('hopper.source_slot_order', 'Hoppers extract the lowest occupied source slot first', 'hoppers', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:chest', `setblock ~ ~1 ~ ${hopper([stack(3, 'dirt'), stone(1, 1)])}`);
    await world.step(1);
    await expectStack(world, '~ ~ ~', 0, 'stone');
    await expectStack(world, '~ ~1 ~', 3, 'dirt');
  }),
  storageCase('hopper.merge_stack', 'Hopper output merges with a compatible partial stack', 'hoppers', async (world) => {
    await world.command(`setblock ~ ~ ~ minecraft:chest${inventory([stone(10)])}`, `setblock ~ ~1 ~ ${hopper([stone()])}`);
    await world.step(1);
    await expectStack(world, '~ ~ ~', 0, 'stone', 11);
    await world.result('data get block ~ ~ ~ Items', 1);
  }),
  storageCase('hopper.free_slot', 'Hoppers insert into the first available destination slot', 'hoppers', async (world) => {
    await world.command(`setblock ~ ~ ~ minecraft:chest${inventory([stack(0, 'dirt', 64), stone(64, 2)])}`, `setblock ~ ~1 ~ ${hopper([stone()])}`);
    await world.step(1);
    await expectStack(world, '~ ~ ~', 1, 'stone');
    await expectStack(world, '~ ~ ~', 2, 'stone', 64);
  }),
  storageCase('hopper.full_destination', 'A full destination leaves the source item intact', 'hoppers', async (world) => {
    await fullChest(world);
    await world.command(`setblock ~ ~1 ~ ${hopper([stone()])}`);
    await world.step(10);
    await expectStack(world, '~ ~1 ~', 0, 'stone');
    await world.result('execute if items block ~ ~ ~ container.* minecraft:stone', 1728);
  }),
  storageCase('hopper.last_capacity', 'Hoppers find the single remaining space in a full inventory', 'hoppers', async (world) => {
    await fullChest(world, 63);
    await world.command(`setblock ~ ~1 ~ ${hopper([stone(2)])}`);
    await world.step(9);
    await expectStack(world, '~ ~ ~', 26, 'stone', 64);
    await expectStack(world, '~ ~1 ~', 0, 'stone');
  }),
  storageCase('hopper.component_identity', 'Stacks with different custom data do not merge', 'hoppers', async (world) => {
    await world.command(`setblock ~ ~ ~ minecraft:chest${inventory([stack(0, 'stone', 1, '{"minecraft:custom_data":{key:1}}')])}`, `setblock ~ ~1 ~ ${hopper([stone()])}`);
    await world.step(1);
    await expectStack(world, '~ ~ ~', 0, 'stone');
    await expectStack(world, '~ ~ ~', 1, 'stone');
  }),
  storageCase('hopper.push_and_pull', 'A hopper pushes and pulls during the same transfer tick', 'hoppers', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:barrel', `setblock ~ ~2 ~ minecraft:chest${inventory([stack(0, 'dirt', 2)])}`, `setblock ~ ~1 ~ ${hopper([stone(2)])}`);
    await world.step(1);
    await expectStack(world, '~ ~ ~', 0, 'stone');
    await expectStack(world, '~ ~1 ~', 0, 'stone');
    await expectStack(world, '~ ~1 ~', 1, 'dirt');
  }),
  storageCase('hopper.empty_pull_not_forwarded', 'An initially empty hopper does not forward a pulled item on the same tick', 'hoppers', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:barrel', `setblock ~ ~2 ~ minecraft:chest${inventory([stone()])}`, `setblock ~ ~1 ~ ${hopper()}`);
    await world.step(1);
    await expectEmpty(world, '~ ~ ~');
    await expectStack(world, '~ ~1 ~', 0, 'stone');
  }),
  storageCase('hopper.full_push_before_pull', 'A full hopper can replace the item it outputs in the same tick', 'hoppers', async (world) => {
    const fullHopper = Array.from({ length: 5 }, (_, slot) => stone(64, slot));
    await world.command('setblock ~ ~ ~ minecraft:barrel', `setblock ~ ~2 ~ minecraft:chest${inventory([stone()])}`, `setblock ~ ~1 ~ ${hopper(fullHopper)}`);
    await world.step(1);
    await expectEmpty(world, '~ ~2 ~');
    await world.result('execute if items block ~ ~1 ~ container.* minecraft:stone', 320);
  }),
  storageCase('hopper.item_stack_pickup', 'Loose item pickup collects the entire available stack', 'hoppers', async (world) => {
    await world.command(`setblock ~ ~ ~ ${hopper()}`, 'summon minecraft:item ~0.5 ~1 ~0.5 {Tags:["cts_pickup"],NoGravity:1b,Item:{id:"minecraft:stone",count:23}}');
    await world.step(1);
    await expectStack(world, '~ ~ ~', 0, 'stone', 23);
    await world.expect('unless entity @e[tag=cts_pickup]');
  }),
  storageCase('hopper.pickup_partial_capacity', 'Item pickup preserves the portion that cannot fit', 'hoppers', async (world) => {
    const slots = Array.from({ length: 5 }, (_, slot) => stone(slot === 4 ? 63 : 64, slot));
    await world.command(`setblock ~ ~ ~ ${hopper(slots)}`, 'summon minecraft:item ~0.5 ~1 ~0.5 {Tags:["cts_pickup"],NoGravity:1b,Item:{id:"minecraft:stone",count:3}}');
    await world.step(1);
    await expectStack(world, '~ ~ ~', 4, 'stone', 64);
    await world.expect('if entity @e[tag=cts_pickup,nbt={Item:{count:2}}]');
  }),
  storageCase('hopper.solid_occlusion', 'An item resting above a full solid block is outside hopper pickup reach', 'hoppers', async (world) => {
    await world.command(`setblock ~ ~ ~ ${hopper()}`, 'setblock ~ ~1 ~ minecraft:stone',
      'summon minecraft:item ~0.5 ~2 ~0.5 {Tags:["cts_pickup"],NoGravity:1b,Item:{id:"minecraft:stone",count:1}}');
    await world.step(10);
    await expectEmpty(world, '~ ~ ~');
    await world.expect('if entity @e[tag=cts_pickup]');
  }),
  storageCase('hopper.pickup_delay_ignored', 'Hoppers collect item entities despite player pickup delay', 'hoppers', async (world) => {
    await world.command(`setblock ~ ~ ~ ${hopper()}`, 'summon minecraft:item ~0.5 ~1 ~0.5 {PickupDelay:32767s,NoGravity:1b,Item:{id:"minecraft:stone",count:2}}');
    await world.step(1);
    await expectStack(world, '~ ~ ~', 0, 'stone', 2);
  }),
  storageCase('hopper.furnace_top', 'Top insertion targets the furnace input slot', 'hoppers', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:furnace', `setblock ~ ~1 ~ ${hopper([stack(0, 'raw_iron')])}`);
    await world.step(1);
    await expectStack(world, '~ ~ ~', 0, 'raw_iron');
  }),
  storageCase('hopper.furnace_side_fuel', 'Side insertion targets the furnace fuel slot', 'hoppers', async (world) => {
    await world.command('setblock ~1 ~ ~ minecraft:furnace', `setblock ~ ~ ~ minecraft:hopper[facing=east]${inventory([stack(0, 'coal')])}`);
    await world.step(1);
    await expectStack(world, '~1 ~ ~', 1, 'coal');
  }),
  storageCase('hopper.furnace_side_reject', 'Furnace sides reject items that are not fuel', 'hoppers', async (world) => {
    await world.command('setblock ~1 ~ ~ minecraft:furnace', `setblock ~ ~ ~ minecraft:hopper[facing=east]${inventory([stack(0, 'raw_iron')])}`);
    await world.step(10);
    await expectEmpty(world, '~1 ~ ~');
    await expectStack(world, '~ ~ ~', 0, 'raw_iron');
  }),
  storageCase('hopper.furnace_output', 'Bottom extraction takes furnace output', 'hoppers', async (world) => {
    await world.command(`setblock ~ ~1 ~ minecraft:furnace${inventory([stack(2, 'iron_ingot', 2)])}`, `setblock ~ ~ ~ ${hopper()}`);
    await world.step(1);
    await expectStack(world, '~ ~ ~', 0, 'iron_ingot');
  }),
  storageCase('hopper.furnace_input_protected', 'Bottom extraction cannot take furnace input or usable fuel', 'hoppers', async (world) => {
    await world.command(`setblock ~ ~1 ~ minecraft:furnace${inventory([stack(0, 'dirt'), stack(1, 'coal')])}`, `setblock ~ ~ ~ ${hopper()}`);
    await world.step(10);
    await expectEmpty(world, '~ ~ ~');
    await expectStack(world, '~ ~1 ~', 0, 'dirt');
    await expectStack(world, '~ ~1 ~', 1, 'coal');
  }),
  storageCase('hopper.furnace_bucket', 'Bottom extraction can remove an empty bucket from the fuel slot', 'hoppers', async (world) => {
    await world.command(`setblock ~ ~1 ~ minecraft:furnace${inventory([stack(1, 'bucket')])}`, `setblock ~ ~ ~ ${hopper()}`);
    await world.step(1);
    await expectStack(world, '~ ~ ~', 0, 'bucket');
  }),
  storageCase('hopper.shulker_nesting_rejected', 'Hoppers cannot insert a shulker box into a shulker box', 'hoppers', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:shulker_box', `setblock ~ ~1 ~ ${hopper([stack(0, 'shulker_box')])}`);
    await world.step(10);
    await world.expect('if block ~ ~ ~ minecraft:shulker_box');
    await world.expect('unless data block ~ ~ ~ Items[]');
    await expectStack(world, '~ ~1 ~', 0, 'shulker_box');
  }),
  storageCase('hopper.item_stack_limit', 'Hopper output respects sixteen item stack limits', 'hoppers', async (world) => {
    await world.command(`setblock ~ ~ ~ minecraft:chest${inventory([stack(0, 'snowball', 16)])}`, `setblock ~ ~1 ~ ${hopper([stack(0, 'snowball', 2)])}`);
    await world.step(1);
    await expectStack(world, '~ ~ ~', 0, 'snowball', 16);
    await expectStack(world, '~ ~ ~', 1, 'snowball');
  }),
];
