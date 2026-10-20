import { expectEmpty, expectStack, inventory, pulse, stack, storageCase, type StorageWorld } from './helpers.js';

async function device(world: StorageWorld, block: 'dropper' | 'dispenser', item: string, count = 1) {
  await world.command(`setblock ~ ~1 ~ minecraft:${block}[facing=east]${inventory([stack(0, item, count)])}`);
}

export const dispenserCases = [
  storageCase('dropper.delay', 'A dropper waits four game ticks before dispensing', 'dispensers', async (world) => {
    await device(world, 'dropper', 'stone');
    await world.command('setblock ~1 ~1 ~ minecraft:chest');
    await pulse(world, 3);
    await expectEmpty(world, '~1 ~1 ~');
    await expectStack(world, '~ ~1 ~', 0, 'stone');
    await world.step(1);
    await expectStack(world, '~1 ~1 ~', 0, 'stone');
  }),
  storageCase('dropper.container_transfer', 'A dropper inserts into the inventory directly in front', 'dispensers', async (world) => {
    await device(world, 'dropper', 'stone', 3);
    await world.command('setblock ~1 ~1 ~ minecraft:chest');
    await pulse(world);
    await expectStack(world, '~1 ~1 ~', 0, 'stone');
    await expectStack(world, '~ ~1 ~', 0, 'stone', 2);
  }),
  storageCase('dropper.loose_item', 'A dropper facing air emits an item entity', 'dispensers', async (world) => {
    await device(world, 'dropper', 'stone');
    await pulse(world);
    await expectEmpty(world, '~ ~1 ~');
    await world.expect('if entity @e[type=minecraft:item,distance=..4,nbt={Item:{id:"minecraft:stone",count:1}}]');
  }),
  storageCase('dropper.sustained_power', 'Continuous power produces only one dropper activation', 'dispensers', async (world) => {
    await device(world, 'dropper', 'stone', 3);
    await world.command('setblock ~1 ~1 ~ minecraft:chest');
    await pulse(world, 20);
    await expectStack(world, '~1 ~1 ~', 0, 'stone');
    await expectStack(world, '~ ~1 ~', 0, 'stone', 2);
  }),
  storageCase('dropper.rearm', 'Removing and restoring power rearms a dropper', 'dispensers', async (world) => {
    await device(world, 'dropper', 'stone', 3);
    await world.command('setblock ~1 ~1 ~ minecraft:chest');
    await pulse(world);
    await world.command('setblock ~-1 ~1 ~ minecraft:air');
    await world.step(1);
    await pulse(world);
    await expectStack(world, '~1 ~1 ~', 0, 'stone', 2);
    await expectStack(world, '~ ~1 ~', 0, 'stone');
  }),
  storageCase('dropper.full_inventory', 'A full destination prevents both transfer and item ejection', 'dispensers', async (world) => {
    await device(world, 'dropper', 'stone');
    await world.command(`setblock ~1 ~1 ~ minecraft:hopper[enabled=false]${inventory(Array.from({ length: 5 }, (_, slot) => stack(slot, 'stone', 64)))}`);
    await pulse(world);
    await expectStack(world, '~ ~1 ~', 0, 'stone');
    await world.expect('unless entity @e[type=minecraft:item,distance=..4]');
  }),
  storageCase('dropper.sided_inventory_rules', 'A dropper obeys furnace side fuel insertion rules', 'dispensers', async (world) => {
    await device(world, 'dropper', 'raw_iron');
    await world.command('setblock ~1 ~1 ~ minecraft:furnace');
    await pulse(world);
    await expectEmpty(world, '~1 ~1 ~');
    await expectStack(world, '~ ~1 ~', 0, 'raw_iron');
  }),
  storageCase('dropper.preserve_components', 'Dropper transfer preserves custom item components', 'dispensers', async (world) => {
    await device(world, 'dropper', 'stone');
    await world.command('setblock ~1 ~1 ~ minecraft:chest',
      'item replace block ~ ~1 ~ container.0 with minecraft:stone[custom_data={cts_marker:17}]');
    await pulse(world);
    await world.expect('if data block ~1 ~1 ~ Items[{Slot:0b,components:{"minecraft:custom_data":{cts_marker:17}}}]');
  }),
  storageCase('dropper.bucket_is_item', 'Droppers eject water buckets as items without placing water', 'dispensers', async (world) => {
    await device(world, 'dropper', 'water_bucket');
    await pulse(world);
    await world.expect('if block ~1 ~1 ~ minecraft:air');
    await world.expect('if entity @e[type=minecraft:item,distance=..4,nbt={Item:{id:"minecraft:water_bucket"}}]');
  }),
  storageCase('dispenser.water_placement', 'Dispensing a water bucket creates a source and returns a bucket', 'dispensers', async (world) => {
    await device(world, 'dispenser', 'water_bucket');
    await pulse(world);
    await world.expect('if block ~1 ~1 ~ minecraft:water[level=0]');
    await expectStack(world, '~ ~1 ~', 0, 'bucket');
  }),
  storageCase('dispenser.water_collection', 'An empty bucket collects a water source into the dispenser', 'dispensers', async (world) => {
    await device(world, 'dispenser', 'bucket');
    await world.command('setblock ~1 ~1 ~ minecraft:water[level=0]');
    await pulse(world);
    await world.expect('if block ~1 ~1 ~ minecraft:air');
    await expectStack(world, '~ ~1 ~', 0, 'water_bucket');
  }),
  storageCase('dispenser.blocked_bucket', 'A blocked dispenser ejects its filled bucket without replacing the solid block', 'dispensers', async (world) => {
    await device(world, 'dispenser', 'water_bucket');
    await world.command('setblock ~1 ~1 ~ minecraft:stone');
    await pulse(world);
    await world.expect('if block ~1 ~1 ~ minecraft:stone');
    await expectEmpty(world, '~ ~1 ~');
    await world.expect('if entity @e[type=minecraft:item,distance=..4,nbt={Item:{id:"minecraft:water_bucket"}}]');
  }),
  storageCase('dispenser.bone_meal_no_effect', 'Bone meal is not consumed when the target crop is fully grown', 'dispensers', async (world) => {
    await device(world, 'dispenser', 'bone_meal', 2);
    await world.command('setblock ~1 ~ ~ minecraft:farmland[moisture=7]', 'setblock ~1 ~1 ~ minecraft:wheat[age=7]');
    await pulse(world);
    await expectStack(world, '~ ~1 ~', 0, 'bone_meal', 2);
    await world.expect('if block ~1 ~1 ~ minecraft:wheat[age=7]');
  }),
  storageCase('dispenser.shear_sheep', 'Dispensed shears shear an adult sheep and consume one durability', 'dispensers', async (world) => {
    await device(world, 'dispenser', 'shears');
    await world.command('summon minecraft:sheep ~1.5 ~1 ~0.5 {Tags:["cts_sheep"],NoAI:1b,NoGravity:1b,Sheared:0b,Age:0}');
    await pulse(world);
    await world.expect('if entity @e[tag=cts_sheep,nbt={Sheared:1b}]');
    await world.expect('if data block ~ ~1 ~ Items[{Slot:0b,components:{"minecraft:damage":1}}]');
  }),
  storageCase('dispenser.ignite', 'Flint and steel creates fire and consumes durability', 'dispensers', async (world) => {
    await device(world, 'dispenser', 'flint_and_steel');
    await world.command('setblock ~1 ~ ~ minecraft:stone');
    await pulse(world);
    await world.expect('if block ~1 ~1 ~ minecraft:fire');
    await world.expect('if data block ~ ~1 ~ Items[{Slot:0b,components:{"minecraft:damage":1}}]');
  }),
  storageCase('dispenser.prime_tnt', 'A dispenser emits primed TNT rather than a TNT item', 'dispensers', async (world) => {
    await device(world, 'dispenser', 'tnt');
    await pulse(world);
    await expectEmpty(world, '~ ~1 ~');
    await world.expect('if entity @e[type=minecraft:tnt,distance=..4]');
    await world.expect('unless entity @e[type=minecraft:item,distance=..4]');
  }),
  storageCase('dispenser.arrow_projectile', 'A dispenser launches an arrow entity and consumes one arrow', 'dispensers', async (world) => {
    await device(world, 'dispenser', 'arrow', 2);
    await pulse(world);
    await expectStack(world, '~ ~1 ~', 0, 'arrow');
    await world.expect('if entity @e[type=minecraft:arrow,distance=..5]');
  }),
  storageCase('dispenser.armor_stand', 'An armor stand item is placed as an entity by a dispenser', 'dispensers', async (world) => {
    await device(world, 'dispenser', 'armor_stand');
    await pulse(world);
    await expectEmpty(world, '~ ~1 ~');
    await world.expect('if entity @e[type=minecraft:armor_stand,distance=..4]');
  }),
];
