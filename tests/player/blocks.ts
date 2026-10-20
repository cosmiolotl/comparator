import { playerScenario } from './scenario.js';

export const cases = [
  playerScenario('blocks.place_survival', 'Survival block placement consumes one item and updates the world', async (p) => {
    await p.held('stone', 2);
    await p.useBlock(0, -1, 0);
    await p.world.expect('if block ~ ~ ~ stone');
    await p.world.expect(`if data entity ${p.name} Inventory[{Slot:0b,id:"minecraft:stone",count:1}]`);
  }),
  playerScenario('blocks.place_creative', 'Creative block placement preserves the held stack', async (p) => {
    await p.world.command(`gamemode creative ${p.name}`);
    await p.held('stone', 2);
    await p.useBlock(0, -1, 0);
    await p.world.expect('if block ~ ~ ~ stone');
    await p.world.expect(`if data entity ${p.name} Inventory[{Slot:0b,count:2}]`);
  }),
  playerScenario('blocks.place_offhand', 'An offhand block placement consumes only the offhand stack', async (p) => {
    await p.world.command(`item replace entity ${p.name} weapon.offhand with oak_planks 2`);
    await p.useBlock(0, -1, 0, 1, 1);
    await p.world.expect('if block ~ ~ ~ oak_planks');
    await p.world.expect(`if data entity ${p.name} Inventory[{Slot:-106b,count:1}]`);
  }),
  playerScenario('blocks.place_collision', 'A block cannot be placed inside the player collision box', async (p) => {
    await p.held('stone', 2);
    await p.useBlock(0, -1, 3);
    await p.world.expect('if block ~ ~ ~3 air');
    await p.world.expect(`if data entity ${p.name} Inventory[{Slot:0b,count:2}]`);
  }),
  playerScenario('blocks.place_reach', 'An out-of-reach placement is ignored without consuming items', async (p) => {
    await p.held('stone', 2);
    await p.useBlock(10, -1, 0);
    await p.world.expect('if block ~10 ~ ~ air');
    await p.world.expect(`if data entity ${p.name} Inventory[{Slot:0b,count:2}]`);
  }),
  playerScenario('blocks.place_adventure', 'Adventure mode denies ordinary block placement', async (p) => {
    await p.world.command(`gamemode adventure ${p.name}`);
    await p.held('stone', 2);
    await p.useBlock(0, -1, 0);
    await p.world.expect('if block ~ ~ ~ air');
    await p.world.expect(`if data entity ${p.name} Inventory[{Slot:0b,count:2}]`);
  }),
  playerScenario('blocks.double_slab', 'Placing a matching slab on its lower half makes a double slab', async (p) => {
    await p.world.command('setblock ~ ~ ~ stone_slab[type=bottom]');
    await p.held('stone_slab', 2);
    await p.useBlock(0, 0, 0);
    await p.world.expect('if block ~ ~ ~ stone_slab[type=double]');
    await p.world.expect(`if data entity ${p.name} Inventory[{Slot:0b,count:1}]`);
  }),
  playerScenario('blocks.lever_use', 'A real use-block packet toggles a lever and powers adjacent dust', async (p) => {
    await p.world.command('setblock ~ ~ ~ lever[face=floor,powered=false]',
      'setblock ~1 ~ ~ redstone_wire');
    await p.useBlock(0, 0, 0);
    await p.world.expect('if block ~ ~ ~ lever[powered=true]');
    await p.world.expect('if block ~1 ~ ~ redstone_wire[power=15]');
  }),
  playerScenario('blocks.door_use', 'Interacting with a door synchronizes its two halves', async (p) => {
    await p.world.command('setblock ~ ~ ~ oak_door[half=lower,open=false]',
      'setblock ~ ~1 ~ oak_door[half=upper,open=false]');
    await p.useBlock(0, 0, 0);
    await p.world.expect('if block ~ ~ ~ oak_door[open=true]');
    await p.world.expect('if block ~ ~1 ~ oak_door[open=true]');
  }),
  playerScenario('blocks.sneak_place', 'Sneaking bypasses chest opening to place a block on it', async (p) => {
    await p.world.command('setblock ~ ~ ~ chest');
    await p.held('stone', 2);
    p.session.write('entity_action', { entityId: p.entityId, actionId: 'start_sneaking', jumpBoost: 0 });
    await p.useBlock(0, 0, 0);
    await p.world.expect('if block ~ ~1 ~ stone');
    await p.world.expect(`if data entity ${p.name} Inventory[{Slot:0b,count:1}]`);
  }),
  playerScenario('blocks.creative_break', 'Creative digging removes a block without spawning its drop', async (p) => {
    await p.world.command(`gamemode creative ${p.name}`, 'setblock ~ ~ ~ diamond_block');
    await p.dig(0, 0, 0);
    await p.world.expect('if block ~ ~ ~ air');
    await p.world.expect('unless entity @e[type=item,distance=..3]');
  }),
  playerScenario('blocks.adventure_break', 'Adventure mode denies breaking a block without a permitted tool', async (p) => {
    await p.world.command(`gamemode adventure ${p.name}`, 'setblock ~ ~ ~ torch');
    await p.dig(0, 0, 0);
    await p.world.expect('if block ~ ~ ~ torch');
    await p.world.expect('unless entity @e[type=item,distance=..3]');
  }),
  playerScenario('blocks.shears_durability', 'Shearing leaves drops the block and damages the shears once', async (p) => {
    await p.world.command('setblock ~ ~ ~ oak_leaves[persistent=true]');
    await p.held('shears');
    await p.dig(0, 0, 0);
    await p.world.step(2);
    await p.dig(0, 0, 0, 2);
    await p.world.expect('if block ~ ~ ~ air');
    await p.world.expect('if entity @e[type=item,distance=..3,nbt={Item:{id:"minecraft:oak_leaves",count:1}}]');
    await p.world.expect(`if data entity ${p.name} Inventory[{Slot:0b,components:{"minecraft:damage":1}}]`);
  }),
  playerScenario('blocks.unbreakable_tool', 'Unbreakable shears perform harvesting without losing durability', async (p) => {
    await p.world.command('setblock ~ ~ ~ oak_leaves[persistent=true]');
    await p.held('shears[unbreakable={}]');
    await p.dig(0, 0, 0);
    await p.world.step(2);
    await p.dig(0, 0, 0, 2);
    await p.world.expect('if block ~ ~ ~ air');
    await p.world.expect(`if items entity ${p.name} weapon.mainhand shears[damage=0]`);
    await p.world.expect(`if data entity ${p.name} Inventory[{Slot:0b,id:"minecraft:shears"}]`);
  }),
];
