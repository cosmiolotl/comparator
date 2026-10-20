import { expectEmpty, expectStack, inventory, mechanicsCase, stack, type MechanicsWorld } from './helpers.js';
import { expectLooseItems } from './item-counts.js';

const potion = (slot: number, name = 'water', item = 'potion', extra = '') =>
  stack(slot, item, 1, `{"minecraft:potion_contents":{potion:"minecraft:${name}"}${extra}}`);

async function stand(world: MechanicsWorld, ingredient = 'nether_wart', bottles = 1) {
  await world.command(`setblock ~ ~ ~ minecraft:brewing_stand${inventory([
    ...Array.from({ length: bottles }, (_, slot) => potion(slot)), stack(3, ingredient, 2), stack(4, 'blaze_powder', 2),
  ])}`);
}

async function expectPotion(world: MechanicsWorld, slot: number, name: string, item = 'potion', position = '~ ~ ~') {
  await world.expect(`if data block ${position} Items[${potion(slot, name, item)}]`);
}

export const cases = [
  mechanicsCase('brewing.ignition', 'Brewing consumes one powder and reserves one of its twenty fuel charges at start', 'brewing', async (world) => {
    await stand(world);
    await world.step(1);
    await world.result('data get block ~ ~ ~ BrewTime', 400);
    await world.result('data get block ~ ~ ~ Fuel', 19);
    await expectStack(world, '~ ~ ~', 4, 'blaze_powder');
    await expectStack(world, '~ ~ ~', 3, 'nether_wart', 2);
  }),
  mechanicsCase('brewing.completion_boundary', 'Brewing completes four hundred ticks after the start tick', 'brewing', async (world) => {
    await stand(world);
    await world.step(400);
    await world.result('data get block ~ ~ ~ BrewTime', 1);
    await expectPotion(world, 0, 'water');
    await world.step(1);
    await expectPotion(world, 0, 'awkward');
    await expectStack(world, '~ ~ ~', 3, 'nether_wart');
    await world.result('data get block ~ ~ ~ BrewTime', 0);
  }),
  mechanicsCase('brewing.three_bottles_one_ingredient', 'One ingredient and one fuel charge transform all three bottles', 'brewing', async (world) => {
    await stand(world, 'nether_wart', 3);
    await world.step(401);
    for (let slot = 0; slot < 3; slot++) await expectPotion(world, slot, 'awkward');
    await expectStack(world, '~ ~ ~', 3, 'nether_wart');
    await world.result('data get block ~ ~ ~ Fuel', 19);
  }),
  mechanicsCase('brewing.no_fuel', 'Valid brewing ingredients remain unchanged without fuel', 'brewing', async (world) => {
    await world.command(`setblock ~ ~ ~ minecraft:brewing_stand${inventory([potion(0), stack(3, 'nether_wart')])}`);
    await world.step(410);
    await expectPotion(world, 0, 'water');
    await expectStack(world, '~ ~ ~', 3, 'nether_wart');
    await world.result('data get block ~ ~ ~ BrewTime', 0);
  }),
  mechanicsCase('brewing.invalid_ingredient', 'An invalid ingredient does not reserve a brewing fuel charge', 'brewing', async (world) => {
    await stand(world, 'dirt');
    await world.step(5);
    await expectPotion(world, 0, 'water');
    await expectStack(world, '~ ~ ~', 3, 'dirt', 2);
    await world.result('data get block ~ ~ ~ Fuel', 20);
    await world.result('data get block ~ ~ ~ BrewTime', 0);
  }),
  mechanicsCase('brewing.cancel_removed_ingredient', 'Removing the ingredient cancels brewing without refunding its reserved charge', 'brewing', async (world) => {
    await stand(world);
    await world.step(100);
    await world.command('item replace block ~ ~ ~ container.3 with minecraft:air');
    await world.step(1);
    await world.result('data get block ~ ~ ~ BrewTime', 0);
    await world.result('data get block ~ ~ ~ Fuel', 19);
    await expectPotion(world, 0, 'water');
  }),
  mechanicsCase('brewing.cancel_removed_bottles', 'Removing the last compatible bottle cancels brewing and preserves the ingredient', 'brewing', async (world) => {
    await stand(world);
    await world.step(100);
    await world.command('item replace block ~ ~ ~ container.0 with minecraft:air');
    await world.step(1);
    await world.result('data get block ~ ~ ~ BrewTime', 0);
    await expectStack(world, '~ ~ ~', 3, 'nether_wart', 2);
  }),
  mechanicsCase('brewing.replace_ingredient', 'Changing ingredient identity cancels the old brew before starting a new timer', 'brewing', async (world) => {
    await stand(world);
    await world.step(100);
    await world.command('item replace block ~ ~ ~ container.3 with minecraft:fermented_spider_eye');
    await world.step(1);
    await world.result('data get block ~ ~ ~ BrewTime', 0);
    await expectPotion(world, 0, 'water');
    await world.step(1);
    await world.result('data get block ~ ~ ~ BrewTime', 400);
    await world.result('data get block ~ ~ ~ Fuel', 18);
  }),
  mechanicsCase('brewing.components_reset', 'Java 1.21.1 brewing constructs a new potion stack without unrelated custom components', 'brewing', async (world) => {
    await world.command(`setblock ~ ~ ~ minecraft:brewing_stand${inventory([
      potion(0, 'water', 'potion', ',"minecraft:custom_data":{kept:1}'), stack(3, 'nether_wart'), stack(4, 'blaze_powder'),
    ])}`);
    await world.expect('if data block ~ ~ ~ Items[{Slot:0b,components:{"minecraft:custom_data":{kept:1}}}]');
    await world.step(401);
    await expectPotion(world, 0, 'awkward');
    await world.expect('unless data block ~ ~ ~ Items[{Slot:0b}].components."minecraft:custom_data"');
  }),
  mechanicsCase('brewing.top_ingredient', 'A top hopper inserts brewing ingredients into the ingredient slot', 'brewing', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:brewing_stand',
      `setblock ~ ~1 ~ minecraft:hopper${inventory([stack(0, 'nether_wart', 2)])}`);
    await world.step(1);
    await expectStack(world, '~ ~ ~', 3, 'nether_wart');
    await expectStack(world, '~ ~1 ~', 0, 'nether_wart');
  }),
  mechanicsCase('brewing.side_potion', 'A side hopper inserts potion bottles into bottle slots', 'brewing', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:brewing_stand',
      `setblock ~-1 ~ ~ minecraft:hopper[facing=east]${inventory([potion(0)])}`);
    await world.step(1);
    await expectPotion(world, 0, 'water');
    await expectEmpty(world, '~-1 ~ ~');
  }),
  mechanicsCase('brewing.side_ingredient_rejected', 'Side insertion rejects ingredient items and keeps them in the hopper', 'brewing', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:brewing_stand',
      `setblock ~-1 ~ ~ minecraft:hopper[facing=east]${inventory([stack(0, 'nether_wart')])}`);
    await world.step(10);
    await expectEmpty(world, '~ ~ ~');
    await expectStack(world, '~-1 ~ ~', 0, 'nether_wart');
  }),
  mechanicsCase('brewing.bottom_extract', 'A bottom hopper extracts a bottle without removing ingredient or blaze powder', 'brewing', async (world) => {
    await world.command(`setblock ~ ~1 ~ minecraft:brewing_stand${inventory([potion(0), stack(3, 'dirt'), stack(4, 'blaze_powder', 2)])}`,
      'setblock ~ ~ ~ minecraft:hopper[facing=east]');
    await world.step(10);
    await expectPotion(world, 0, 'water', 'potion');
    await expectStack(world, '~ ~1 ~', 3, 'dirt');
    await expectStack(world, '~ ~1 ~', 4, 'blaze_powder');
    await world.result('data get block ~ ~ ~ Items', 1);
  }),
  ...([
    ['extend', 'swiftness', 'redstone', 'long_swiftness'],
    ['amplify', 'swiftness', 'glowstone_dust', 'strong_swiftness'],
    ['corrupt', 'swiftness', 'fermented_spider_eye', 'slowness'],
  ] as const).map(([id, input, ingredient, output]) =>
    mechanicsCase(`brewing.${id}`, `Brewing ${ingredient} transforms ${input} into ${output}`, 'brewing', async (world) => {
      await world.command(`setblock ~ ~ ~ minecraft:brewing_stand${inventory([potion(0, input), stack(3, ingredient), stack(4, 'blaze_powder')])}`);
      await world.step(401);
      await expectPotion(world, 0, output);
      await world.expect('unless data block ~ ~ ~ Items[{Slot:3b}]');
    })),
  mechanicsCase('brewing.splash_conversion', 'Gunpowder changes the bottle type while retaining its potion recipe', 'brewing', async (world) => {
    await world.command(`setblock ~ ~ ~ minecraft:brewing_stand${inventory([potion(0, 'swiftness'), stack(3, 'gunpowder'), stack(4, 'blaze_powder')])}`);
    await world.step(401);
    await expectPotion(world, 0, 'swiftness', 'splash_potion');
  }),
  mechanicsCase('brewing.last_dragon_breath', 'Java 1.21.1 consumes the last dragon breath without producing a glass bottle', 'brewing', async (world) => {
    await world.command(`setblock ~ ~ ~ minecraft:brewing_stand${inventory([potion(0, 'swiftness', 'splash_potion'), stack(3, 'dragon_breath'), stack(4, 'blaze_powder')])}`);
    await world.step(401);
    await expectPotion(world, 0, 'swiftness', 'lingering_potion');
    await world.expect('unless data block ~ ~ ~ Items[{Slot:3b}]');
    await world.expect('unless entity @e[type=minecraft:item,nbt={Item:{id:"minecraft:glass_bottle"}}]');
  }),
  mechanicsCase('brewing.stacked_dragon_breath', 'Consuming dragon breath from a larger stack ejects one glass bottle remainder', 'brewing', async (world) => {
    await world.command(`setblock ~ ~ ~ minecraft:brewing_stand${inventory([potion(0, 'swiftness', 'splash_potion'), stack(3, 'dragon_breath', 2), stack(4, 'blaze_powder')])}`);
    await world.step(401);
    await expectPotion(world, 0, 'swiftness', 'lingering_potion');
    await expectStack(world, '~ ~ ~', 3, 'dragon_breath');
    await expectLooseItems(world, 'glass_bottle', 1);
    await world.result('execute if items block ~ ~ ~ container.* minecraft:glass_bottle', 0);
  }),
];
