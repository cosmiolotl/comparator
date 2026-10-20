import { expectEmpty, expectStack, inventory, mechanicsCase, stack, type MechanicsWorld } from './helpers.js';

const cart = '@e[tag=cts_cart,limit=1]';

async function summonCart(world: MechanicsWorld, entity = 'hopper_minecart', items: readonly string[] = []) {
  await world.command('setblock ~ ~ ~ minecraft:rail[shape=east_west]',
    `summon minecraft:${entity} ~0.5 ~0.0625 ~0.5 {Tags:["cts_cart"],NoGravity:1b,Items:[${items.join(',')}]}`);
  await world.expect('if entity @e[tag=cts_cart]');
}

export const cases = [
  mechanicsCase('minecart.pull_rate', 'A stationary hopper minecart pulls one chest item each tick', 'container-minecarts', async (world) => {
    await summonCart(world);
    await world.command(`setblock ~ ~1 ~ minecraft:chest${inventory([stack(0, 'diamond', 8)])}`);
    await world.step(3);
    await world.expect('if data entity @e[tag=cts_cart,limit=1] Items[{Slot:0b,id:"minecraft:diamond",count:3}]');
    await expectStack(world, '~ ~1 ~', 0, 'diamond', 5);
  }),
  mechanicsCase('minecart.loose_stack', 'A hopper minecart collects a complete loose item stack', 'container-minecarts', async (world) => {
    await summonCart(world);
    await world.command('summon minecraft:item ~0.5 ~0.8 ~0.5 {Tags:["cts_loose"],NoGravity:1b,Item:{id:"minecraft:diamond",count:23}}');
    await world.step(1);
    await world.expect('if data entity @e[tag=cts_cart,limit=1] Items[{Slot:0b,id:"minecraft:diamond",count:23}]');
    await world.expect('unless entity @e[tag=cts_loose]');
  }),
  mechanicsCase('minecart.activator_lock', 'A powered activator rail disables hopper minecart collection', 'container-minecarts', async (world) => {
    await summonCart(world);
    await world.command('setblock ~1 ~ ~ minecraft:redstone_block', 'setblock ~ ~ ~ minecraft:activator_rail[shape=east_west]',
      `setblock ~ ~1 ~ minecraft:chest${inventory([stack(0, 'diamond', 8)])}`);
    await world.step(3);
    await world.expect('if entity @e[tag=cts_cart,nbt={Enabled:0b}]');
    await world.result(`data get entity ${cart} Items`, 0);
    await expectStack(world, '~ ~1 ~', 0, 'diamond', 8);
  }),
  mechanicsCase('minecart.activator_unlock', 'An unpowered activator rail re-enables collection immediately', 'container-minecarts', async (world) => {
    await summonCart(world);
    await world.command('setblock ~1 ~ ~ minecraft:redstone_block', 'setblock ~ ~ ~ minecraft:activator_rail[shape=east_west]',
      `setblock ~ ~1 ~ minecraft:chest${inventory([stack(0, 'diamond', 8)])}`);
    await world.step(2);
    await world.expect('if entity @e[tag=cts_cart,nbt={Enabled:0b}]');
    await world.command('setblock ~1 ~ ~ minecraft:air');
    await world.step(1);
    await world.expect('if entity @e[tag=cts_cart,nbt={Enabled:1b}]');
    await world.expect('if data entity @e[tag=cts_cart,limit=1] Items[{Slot:0b,id:"minecraft:diamond",count:1}]');
  }),
  mechanicsCase('minecart.chest_extraction', 'A block hopper extracts from a stationary chest minecart above it', 'container-minecarts', async (world) => {
    await summonCart(world, 'chest_minecart', [stack(0, 'diamond', 3)]);
    await world.command('setblock ~ ~-1 ~ minecraft:hopper[facing=east]');
    await world.step(1);
    await expectStack(world, '~ ~-1 ~', 0, 'diamond');
    await world.expect('if data entity @e[tag=cts_cart,limit=1] Items[{Slot:0b,id:"minecraft:diamond",count:2}]');
  }),
  mechanicsCase('minecart.hopper_extraction', 'A block hopper extracts from a disabled hopper minecart', 'container-minecarts', async (world) => {
    await summonCart(world, 'hopper_minecart', [stack(0, 'diamond', 3)]);
    await world.command(`data merge entity ${cart} {Enabled:0b}`, 'setblock ~ ~-1 ~ minecraft:hopper[facing=east]');
    await world.step(1);
    await expectStack(world, '~ ~-1 ~', 0, 'diamond');
    await world.expect('if data entity @e[tag=cts_cart,limit=1] Items[{Slot:0b,id:"minecraft:diamond",count:2}]');
  }),
  mechanicsCase('minecart.component_extraction', 'Minecart to hopper transfer preserves nested item components', 'container-minecarts', async (world) => {
    await summonCart(world, 'chest_minecart', [stack(0, 'diamond', 2, '{"minecraft:custom_data":{minecart:{value:7}}}')]);
    await world.command('setblock ~ ~-1 ~ minecraft:hopper[facing=east]');
    await world.step(1);
    await world.expect('if data block ~ ~-1 ~ Items[{Slot:0b,id:"minecraft:diamond",count:1,components:{"minecraft:custom_data":{minecart:{value:7}}}}]');
    await world.expect('if data entity @e[tag=cts_cart,limit=1] Items[{Slot:0b,id:"minecraft:diamond",count:1}]');
  }),
  mechanicsCase('minecart.full_hopper', 'A full receiving block hopper leaves minecart contents untouched', 'container-minecarts', async (world) => {
    await summonCart(world, 'chest_minecart', [stack(0, 'diamond', 3)]);
    await world.command(`setblock ~ ~-1 ~ minecraft:hopper[facing=east]${inventory(Array.from({ length: 5 }, (_, slot) => stack(slot, 'stone', 64)))}`);
    await world.step(10);
    await world.expect('if data entity @e[tag=cts_cart,limit=1] Items[{Slot:0b,id:"minecraft:diamond",count:3}]');
    await world.result('execute if items block ~ ~-1 ~ container.* minecraft:stone', 320);
  }),
  mechanicsCase('minecart.no_automatic_output', 'A hopper minecart collects but does not independently push into a chest beneath', 'container-minecarts', async (world) => {
    await summonCart(world, 'hopper_minecart', [stack(0, 'diamond', 3)]);
    await world.command('setblock ~ ~-1 ~ minecraft:chest');
    await world.step(10);
    await expectEmpty(world, '~ ~-1 ~');
    await world.expect('if data entity @e[tag=cts_cart,limit=1] Items[{Slot:0b,id:"minecraft:diamond",count:3}]');
  }),
  mechanicsCase('minecart.destroy_contents', 'Destroying a chest minecart drops both its inventory and the combined vehicle item', 'container-minecarts', async (world) => {
    await summonCart(world, 'chest_minecart', [stack(0, 'diamond', 13, '{"minecraft:custom_data":{kept:1}}')]);
    await world.command(`damage ${cart} 100 minecraft:generic`);
    await world.expect('unless entity @e[tag=cts_cart]');
    await world.expect('if entity @e[type=minecraft:item,nbt={Item:{id:"minecraft:chest_minecart",count:1}}]');
    await world.command('scoreboard players set #diamonds cts 0',
      'execute as @e[type=minecraft:item,nbt={Item:{id:"minecraft:diamond",components:{"minecraft:custom_data":{kept:1}}}}] store result score @s cts run data get entity @s Item.count',
      'execute as @e[type=minecraft:item,nbt={Item:{id:"minecraft:diamond",components:{"minecraft:custom_data":{kept:1}}}}] run scoreboard players operation #diamonds cts += @s cts');
    await world.expect('if score #diamonds cts matches 13');
  }),
];
