import { scenario } from '../../src/world/scenario.js';

type World = Parameters<Parameters<typeof scenario>[0]['run']>[0];
const rider = '@e[tag=cts_rider,limit=1]';
const vehicle = '@e[tag=cts_vehicle,limit=1]';
const third = '@e[tag=cts_third,limit=1]';

function relationCase(id: string, title: string, run: (world: World) => Promise<void>) {
  return scenario({
    id: `java.entities.relationships.${id}`, title,
    reference: 'docs/research-entities.md#relationships',
    run: async (world) => {
      await world.command(
        'summon minecraft:cow ~ ~ ~ {Tags:["cts_rider"],NoAI:1b,NoGravity:1b}',
        'summon minecraft:boat ~2 ~ ~ {Tags:["cts_vehicle"],NoGravity:1b}',
      );
      await world.expect('if entity @e[tag=cts_rider]');
      await world.expect('if entity @e[tag=cts_vehicle]');
      await run(world);
    },
  });
}

async function addThird(world: World) {
  await world.command('summon minecraft:pig ~4 ~ ~ {Tags:["cts_third"],NoAI:1b,NoGravity:1b}');
}

async function relationCount(world: World, selection: string, expected: number) {
  // An empty relation never invokes execute-store; count successful branches explicitly.
  await world.command('scoreboard players set #relations cts 0');
  await world.command(`${selection} run scoreboard players add #relations cts 1`);
  await world.expect(`if score #relations cts matches ${expected}`);
}

export const cases = [
  relationCase('mount', 'Mounting records the passenger on the vehicle', async (world) => {
    await world.command(`ride ${rider} mount ${vehicle}`);
    await world.expect('if entity @e[tag=cts_vehicle,nbt={Passengers:[{Tags:["cts_rider"]}]}]');
  }),
  relationCase('dismount', 'Dismounting removes the passenger relationship', async (world) => {
    await world.command(`ride ${rider} mount ${vehicle}`, `ride ${rider} dismount`);
    await world.expect('unless entity @e[tag=cts_vehicle,nbt={Passengers:[{Tags:["cts_rider"]}]}]');
    await relationCount(world, `execute as ${rider} on vehicle if entity @s`, 0);
  }),
  relationCase('self-mount-rejected', 'An entity cannot ride itself', async (world) => {
    await world.result(`ride ${rider} mount ${rider}`, 0);
    await relationCount(world, `execute as ${rider} on vehicle if entity @s`, 0);
  }),
  relationCase('already-mounted-rejected', 'Mounting an already mounted entity fails without changing its vehicle', async (world) => {
    await addThird(world);
    await world.command(`ride ${rider} mount ${vehicle}`);
    await world.result(`ride ${rider} mount ${third}`, 0);
    await relationCount(world, `execute as ${rider} on vehicle if entity @s[tag=cts_vehicle]`, 1);
  }),
  relationCase('direct-cycle-rejected', 'A vehicle cannot mount its own passenger', async (world) => {
    await world.command(`ride ${rider} mount ${vehicle}`);
    await world.result(`ride ${vehicle} mount ${rider}`, 0);
    await relationCount(world, `execute as ${rider} on vehicle if entity @s[tag=cts_vehicle]`, 1);
  }),
  relationCase('indirect-cycle-rejected', 'Mounting rejects cycles through indirect passengers', async (world) => {
    await addThird(world);
    await world.command(`ride ${rider} mount ${vehicle}`, `ride ${third} mount ${rider}`);
    await world.result(`ride ${vehicle} mount ${third}`, 0);
    await relationCount(world, `execute as ${third} on vehicle on vehicle if entity @s[tag=cts_vehicle]`, 1);
  }),
  relationCase('vehicle-context', 'The vehicle relation changes the executing entity to its mount', async (world) => {
    await world.command(`ride ${rider} mount ${vehicle}`);
    await relationCount(world, `execute as ${rider} on vehicle if entity @s[tag=cts_vehicle]`, 1);
  }),
  relationCase('multiple-passengers', 'Passenger traversal visits every direct passenger', async (world) => {
    await addThird(world);
    await world.command(`ride ${rider} mount ${vehicle}`, `ride ${third} mount ${vehicle}`);
    await world.command('scoreboard players set #passengers cts 0');
    await world.command(`execute as ${vehicle} on passengers run scoreboard players add #passengers cts 1`);
    await world.expect('if score #passengers cts matches 2');
  }),
  relationCase('passengers-not-recursive', 'Passenger traversal excludes indirect passengers', async (world) => {
    await addThird(world);
    await world.command(`ride ${rider} mount ${vehicle}`, `ride ${third} mount ${rider}`);
    await relationCount(world, `execute as ${vehicle} on passengers if entity @s[tag=cts_rider]`, 1);
    await relationCount(world, `execute as ${vehicle} on passengers if entity @s[tag=cts_third]`, 0);
  }),
  relationCase('boat-controller', 'The first living boat passenger is its controller', async (world) => {
    await addThird(world);
    await world.command(`ride ${rider} mount ${vehicle}`, `ride ${third} mount ${vehicle}`);
    await relationCount(world, `execute as ${vehicle} on controller if entity @s[tag=cts_rider]`, 1);
  }),
  relationCase('projectile-origin', 'Projectile origin resolves its shooter UUID', async (world) => {
    await world.command('summon minecraft:arrow ~ ~2 ~ {Tags:["cts_projectile"],NoGravity:1b}');
    await world.command(`data modify entity @e[tag=cts_projectile,limit=1] Owner set from entity ${rider} UUID`);
    await relationCount(world, 'execute as @e[tag=cts_projectile] on origin if entity @s[tag=cts_rider]', 1);
  }),
  relationCase('item-origin', 'Dropped-item origin resolves its thrower UUID', async (world) => {
    await world.command('summon minecraft:item ~ ~2 ~ {Tags:["cts_item"],NoGravity:1b,Item:{id:"minecraft:stone",count:1}}');
    await world.command(`data modify entity @e[tag=cts_item,limit=1] Thrower set from entity ${rider} UUID`);
    await relationCount(world, 'execute as @e[tag=cts_item] on origin if entity @s[tag=cts_rider]', 1);
  }),
  relationCase('cloud-origin', 'Area effect cloud origin resolves its owner UUID', async (world) => {
    await world.command('summon minecraft:area_effect_cloud ~ ~ ~ {Tags:["cts_cloud"],Radius:2f,Duration:20}');
    await world.command(`data modify entity @e[tag=cts_cloud,limit=1] Owner set from entity ${rider} UUID`);
    await relationCount(world, 'execute as @e[tag=cts_cloud] on origin if entity @s[tag=cts_rider]', 1);
  }),
  relationCase('last-attacker', 'Attributed damage updates the living entity attacker relation', async (world) => {
    await addThird(world);
    await world.command(`damage ${rider} 1 minecraft:mob_attack by ${third}`);
    await relationCount(world, `execute as ${rider} on attacker if entity @s[tag=cts_third]`, 1);
  }),
  relationCase('absent-relation', 'Entities without a vehicle produce no vehicle relation results', async (world) => {
    await relationCount(world, `execute as ${rider} on vehicle if entity @s`, 0);
    await relationCount(world, `execute as ${vehicle} on passengers if entity @s`, 0);
  }),
];
