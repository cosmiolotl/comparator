import { expectEmpty, mechanicsCase, subject, testSubject } from './helpers.js';

export const cases = [
  mechanicsCase('defense.armor_resistance_absorption', 'Armor, resistance, and absorption reduce damage in their vanilla order', 'equipment-and-combat', async (world) => {
    await testSubject(world);
    await world.command(`attribute ${subject} minecraft:generic.armor base set 20`,
      `effect give ${subject} minecraft:resistance 20 2 true`,
      `effect give ${subject} minecraft:absorption 20 0 true`,
      `damage ${subject} 25 minecraft:mob_attack`);
    await world.expect('if entity @e[tag=cts_subject,nbt={Health:97f,AbsorptionAmount:0f}]');
  }),
  mechanicsCase('defense.absorption_after_armor', 'Damage absorbed by armor leaves the unused absorption amount intact', 'equipment-and-combat', async (world) => {
    await testSubject(world);
    await world.command(`attribute ${subject} minecraft:generic.armor base set 20`,
      `effect give ${subject} minecraft:absorption 20 1 true`,
      `damage ${subject} 10 minecraft:mob_attack`);
    await world.expect('if entity @e[tag=cts_subject,nbt={Health:100f,AbsorptionAmount:4f}]');
  }),
  ...([
    ['protection', 'magic', 4, 79],
    ['fire_protection', 'in_fire', 4, 83],
    ['blast_protection', 'explosion', 4, 83],
    ['projectile_protection', 'arrow', 4, 83],
    ['feather_falling', 'fall', 4, 87],
    ['protection', 'magic', 255, 95],
  ] as const).map(([enchantment, damage, level, health]) =>
    mechanicsCase(`defense.enchantment_${enchantment}_${level}`, `Equipped ${enchantment} ${level} changes actual ${damage} damage`, 'equipment-and-combat', async (world) => {
      await testSubject(world);
      const slot = enchantment === 'feather_falling' ? 'armor.feet' : 'armor.head';
      const item = enchantment === 'feather_falling' ? 'diamond_boots' : 'diamond_helmet';
      // An empty modifier list falls back to the item's default armor in 1.21.1.
      await world.command(`item replace entity ${subject} ${slot} with minecraft:${item}[attribute_modifiers={modifiers:[{type:"minecraft:generic.armor",id:"cts:zero",amount:0,operation:"add_value"}]},enchantments={levels:{"minecraft:${enchantment}":${level}}}]`);
      await world.step(1);
      await world.result(`attribute ${subject} minecraft:generic.armor get`, 0);
      await world.command(`damage ${subject} 25 minecraft:${damage}`);
      await world.expect(`if entity @e[tag=cts_subject,nbt={Health:${health}f}]`);
    })),
  mechanicsCase('defense.stored_enchantment_inert', 'Stored enchantments do not protect an entity wearing the item', 'equipment-and-combat', async (world) => {
    await testSubject(world);
    await world.command(`item replace entity ${subject} armor.head with minecraft:diamond_helmet[attribute_modifiers={modifiers:[]},stored_enchantments={levels:{"minecraft:protection":4}}]`);
    await world.step(1);
    await world.command(`damage ${subject} 25 minecraft:magic`);
    await world.expect('if entity @e[tag=cts_subject,nbt={Health:75f}]');
  }),
  mechanicsCase('defense.enchantment_wrong_damage', 'Projectile protection does not reduce magic damage', 'equipment-and-combat', async (world) => {
    await testSubject(world);
    await world.command(`item replace entity ${subject} armor.head with minecraft:diamond_helmet[enchantments={levels:{"minecraft:projectile_protection":4}}]`);
    await world.step(1);
    await world.command(`damage ${subject} 25 minecraft:magic`);
    await world.expect('if entity @e[tag=cts_subject,nbt={Health:75f}]');
  }),
  mechanicsCase('defense.unbreakable_dispenser', 'A dispenser uses an unbreakable flint and steel without reducing durability', 'equipment-and-combat', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:dispenser[facing=east]',
      'item replace block ~ ~ ~ container.0 with minecraft:flint_and_steel[damage=12,unbreakable={}]',
      'setblock ~-1 ~ ~ minecraft:redstone_block');
    await world.step(4);
    await world.expect('if block ~1 ~ ~ minecraft:fire');
    await world.expect('if items block ~ ~ ~ container.0 minecraft:flint_and_steel[damage=12,unbreakable={}]');
  }),
  mechanicsCase('defense.last_durability_dispenser', 'A dispenser consumes a flint and steel on its last durability point', 'equipment-and-combat', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:dispenser[facing=east]',
      'item replace block ~ ~ ~ container.0 with minecraft:flint_and_steel[damage=63]',
      'setblock ~-1 ~ ~ minecraft:redstone_block');
    await world.step(4);
    await world.expect('if block ~1 ~ ~ minecraft:fire');
    await expectEmpty(world, '~ ~ ~');
  }),
  mechanicsCase('defense.failed_tool_use', 'A dispenser flint and steel loses no durability when the facing block cannot ignite', 'equipment-and-combat', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:dispenser[facing=east]',
      'item replace block ~ ~ ~ container.0 with minecraft:flint_and_steel[damage=12]',
      'setblock ~1 ~ ~ minecraft:stone', 'setblock ~-1 ~ ~ minecraft:redstone_block');
    await world.step(4);
    await world.expect('if block ~1 ~ ~ minecraft:stone');
    await world.expect('if items block ~ ~ ~ container.0 minecraft:flint_and_steel[damage=12]');
  }),
];
