import { expectEmpty, expectStack, inventory, mechanicsCase, stack, type MechanicsWorld } from './helpers.js';
import { expectLooseItems } from './item-counts.js';

async function crafter(world: MechanicsWorld, entries: readonly string[] = [], disabled: readonly number[] = []) {
  await world.command('setblock ~1 ~ ~ minecraft:barrel',
    `setblock ~ ~ ~ minecraft:crafter[orientation=east_up]{Items:[${entries.join(',')}],disabled_slots:[I;${disabled.join(',')}]}`);
}

async function power(world: MechanicsWorld, ticks = 4) {
  await world.command('setblock ~-1 ~ ~ minecraft:redstone_block');
  await world.step(ticks);
}

async function inputHopper(world: MechanicsWorld, count: number) {
  await world.command(`setblock ~ ~1 ~ minecraft:hopper[facing=down]{TransferCooldown:0,Items:[${stack(0, 'oak_planks', count)}]}`);
}

export const cases = [
  mechanicsCase('crafter.before_tick', 'A powered crafter does not craft before the fourth scheduled tick', 'crafters', async (world) => {
    await crafter(world, [stack(0, 'oak_log', 2)]);
    await power(world, 3);
    await expectEmpty(world, '~1 ~ ~');
    await expectStack(world, '~ ~ ~', 0, 'oak_log', 2);
    await world.step(1);
    await expectStack(world, '~1 ~ ~', 0, 'oak_planks', 4);
  }),
  mechanicsCase('crafter.one_craft_per_edge', 'Continuous power crafts once and preserves remaining ingredients', 'crafters', async (world) => {
    await crafter(world, [stack(0, 'oak_log', 3)]);
    await power(world, 30);
    await expectStack(world, '~1 ~ ~', 0, 'oak_planks', 4);
    await expectStack(world, '~ ~ ~', 0, 'oak_log', 2);
  }),
  mechanicsCase('crafter.retrigger', 'A new power edge starts a second crafting operation', 'crafters', async (world) => {
    await crafter(world, [stack(0, 'oak_log', 3)]);
    await power(world);
    await world.command('setblock ~-1 ~ ~ minecraft:air');
    await world.step(6);
    await power(world);
    await expectStack(world, '~1 ~ ~', 0, 'oak_planks', 8);
    await expectStack(world, '~ ~ ~', 0, 'oak_log');
  }),
  mechanicsCase('crafter.no_recipe', 'A powered invalid recipe preserves all ingredients and emits nothing', 'crafters', async (world) => {
    await crafter(world, [stack(0, 'dirt')]);
    await power(world);
    await expectStack(world, '~ ~ ~', 0, 'dirt');
    await expectEmpty(world, '~1 ~ ~');
    await world.expect('unless entity @e[type=minecraft:item,distance=..4]');
  }),
  mechanicsCase('crafter.shaped_recipe', 'Crafter grid positions select a shaped stick recipe and consume each input once', 'crafters', async (world) => {
    await crafter(world, [stack(0, 'oak_planks', 2), stack(3, 'oak_planks', 2)]);
    await power(world);
    await expectStack(world, '~1 ~ ~', 0, 'stick', 4);
    await expectStack(world, '~ ~ ~', 0, 'oak_planks');
    await expectStack(world, '~ ~ ~', 3, 'oak_planks');
  }),
  mechanicsCase('crafter.recipe_remainders', 'Cake crafting emits the result and all three milk bucket remainders', 'crafters', async (world) => {
    const items = ['milk_bucket', 'milk_bucket', 'milk_bucket', 'sugar', 'egg', 'sugar', 'wheat', 'wheat', 'wheat'];
    await crafter(world, items.map((id, slot) => stack(slot, id)));
    await power(world);
    await world.result('execute if items block ~1 ~ ~ container.* minecraft:cake', 1);
    await world.result('execute if items block ~1 ~ ~ container.* minecraft:bucket', 3);
    await expectEmpty(world, '~ ~ ~');
    await world.expect('unless entity @e[type=minecraft:item,distance=..4]');
  }),
  mechanicsCase('crafter.full_destination_spill', 'Crafter output becomes item entities when its destination is full', 'crafters', async (world) => {
    await crafter(world, [stack(0, 'oak_log')]);
    await world.command(`setblock ~1 ~ ~ minecraft:dropper${inventory(Array.from({ length: 9 }, (_, slot) => stack(slot, 'stone', 64)))}`);
    await power(world);
    await expectLooseItems(world, 'oak_planks', 4);
    await expectEmpty(world, '~ ~ ~');
    await world.result('execute if items block ~1 ~ ~ container.* minecraft:stone', 576);
    await world.result('execute if items block ~1 ~ ~ container.* minecraft:oak_planks', 0);
  }),
  mechanicsCase('crafter.partial_destination', 'Crafter inserts available output and spills only the excess', 'crafters', async (world) => {
    await crafter(world, [stack(0, 'oak_log')]);
    const slots = Array.from({ length: 9 }, (_, slot) => stack(slot, slot === 8 ? 'oak_planks' : 'stone', slot === 8 ? 63 : 64));
    await world.command(`setblock ~1 ~ ~ minecraft:dropper${inventory(slots)}`);
    await power(world);
    await expectStack(world, '~1 ~ ~', 8, 'oak_planks', 64);
    await world.result('execute if items block ~1 ~ ~ container.* minecraft:oak_planks', 64);
    await expectLooseItems(world, 'oak_planks', 3);
    await expectEmpty(world, '~ ~ ~');
  }),
  mechanicsCase('crafter.air_output', 'An unobstructed crafter ejects a complete crafted stack', 'crafters', async (world) => {
    await crafter(world, [stack(0, 'oak_log')]);
    await world.command('setblock ~1 ~ ~ minecraft:air');
    await power(world);
    await expectLooseItems(world, 'oak_planks', 4);
    await expectEmpty(world, '~ ~ ~');
  }),
  mechanicsCase('crafter.disabled_slot_input', 'Hopper insertion skips disabled crafter slots', 'crafters', async (world) => {
    await crafter(world, [], [0, 1]);
    await inputHopper(world, 2);
    await world.step(9);
    await expectStack(world, '~ ~ ~', 2, 'oak_planks');
    await expectStack(world, '~ ~ ~', 3, 'oak_planks');
    await world.expect('unless data block ~ ~ ~ Items[{Slot:0b}]');
    await world.expect('unless data block ~ ~ ~ Items[{Slot:1b}]');
  }),
  mechanicsCase('crafter.all_slots_disabled', 'A fully disabled crafter rejects hopper input without consuming it', 'crafters', async (world) => {
    await crafter(world, [], [0, 1, 2, 3, 4, 5, 6, 7, 8]);
    await inputHopper(world, 2);
    await world.step(10);
    await expectEmpty(world, '~ ~ ~');
    await expectStack(world, '~ ~1 ~', 0, 'oak_planks', 2);
  }),
  mechanicsCase('crafter.input_balancing', 'Hoppers fill every available crafter slot before increasing a stack', 'crafters', async (world) => {
    await crafter(world);
    await inputHopper(world, 10);
    await world.step(73);
    await expectStack(world, '~ ~ ~', 0, 'oak_planks', 2);
    for (let slot = 1; slot < 9; slot++) await expectStack(world, '~ ~ ~', slot, 'oak_planks');
    await expectEmpty(world, '~ ~1 ~');
  }),
  mechanicsCase('crafter.least_filled_slot', 'Insertion fills a smaller compatible stack before an earlier larger stack', 'crafters', async (world) => {
    await crafter(world, [stack(0, 'oak_planks', 3), stack(1, 'oak_planks')], [2, 3, 4, 5, 6, 7, 8]);
    await inputHopper(world, 1);
    await world.step(1);
    await expectStack(world, '~ ~ ~', 0, 'oak_planks', 3);
    await expectStack(world, '~ ~ ~', 1, 'oak_planks', 2);
  }),
  mechanicsCase('crafter.disabled_recipe_slots', 'Disabled empty slots still permit a recipe using the remaining cells', 'crafters', async (world) => {
    await crafter(world, [stack(0, 'oak_log')], [1, 2, 3, 4, 5, 6, 7, 8]);
    await power(world);
    await expectStack(world, '~1 ~ ~', 0, 'oak_planks', 4);
    await expectEmpty(world, '~ ~ ~');
  }),
  mechanicsCase('crafter.analog_disabled_occupied', 'Crafter comparator strength counts occupied and disabled cells rather than stack fullness', 'crafters', async (world) => {
    await crafter(world, [stack(0, 'stone', 64), stack(1, 'stone')], [2, 3, 4]);
    await world.command('setblock ~ ~ ~1 minecraft:comparator[facing=north]', 'setblock ~ ~ ~2 minecraft:redstone_wire');
    await world.step(4);
    await world.expect('if block ~ ~ ~2 minecraft:redstone_wire[power=5]');
  }),
  mechanicsCase('crafter.analog_full_disabled', 'Disabling all nine crafter cells produces signal nine', 'crafters', async (world) => {
    await crafter(world, [], [0, 1, 2, 3, 4, 5, 6, 7, 8]);
    await world.command('setblock ~ ~ ~1 minecraft:comparator[facing=north]', 'setblock ~ ~ ~2 minecraft:redstone_wire');
    await world.step(4);
    await world.expect('if block ~ ~ ~2 minecraft:redstone_wire[power=9]');
  }),
];
