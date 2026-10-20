import { scenario } from '../../src/world/scenario.js';

type World = Parameters<Parameters<typeof scenario>[0]['run']>[0];
const subject = '@e[tag=cts_subject,limit=1]';

function itemCase(id: string, title: string, run: (world: World) => Promise<void>) {
  return scenario({ id: `java.entities.items.${id}`, title, reference: 'docs/research-entities.md#item-entities', run });
}

async function item(world: World, fields = '', stack = '{id:"minecraft:stone",count:1}') {
  await world.command(`summon minecraft:item ~ ~2 ~ {Tags:["cts_subject"],NoGravity:1b,Motion:[0d,0d,0d],Health:5s,Item:${stack}${fields}}`);
  await world.expect('if entity @e[tag=cts_subject]');
}

async function count(world: World, expected: number) {
  await world.result('execute if entity @e[tag=cts_subject]', expected);
}

export const cases = [
  itemCase('age-ticks', 'Dropped item age advances once per simulation tick', async (world) => {
    await item(world, ',Age:10s');
    await world.step(3);
    await world.result(`data get entity ${subject} Age`, 13);
  }),
  itemCase('despawn-boundary', 'Dropped items despawn at age six thousand', async (world) => {
    await item(world, ',Age:5998s');
    await world.step(1);
    await world.result(`data get entity ${subject} Age`, 5999);
    await world.step(1);
    await world.expect('unless entity @e[tag=cts_subject]');
  }),
  itemCase('infinite-age', 'The infinite item-age sentinel does not increment', async (world) => {
    await item(world, ',Age:-32768s');
    await world.step(5);
    await world.result(`data get entity ${subject} Age`, -32768);
  }),
  itemCase('negative-age', 'Ordinary negative item ages still advance toward zero', async (world) => {
    await item(world, ',Age:-1s');
    await world.step(2);
    await world.result(`data get entity ${subject} Age`, 1);
  }),
  itemCase('pickup-delay-ticks', 'Item pickup delay decreases once per tick', async (world) => {
    await item(world, ',PickupDelay:10s');
    await world.step(3);
    await world.result(`data get entity ${subject} PickupDelay`, 7);
  }),
  itemCase('pickup-delay-zero', 'Item pickup delay stops at zero', async (world) => {
    await item(world, ',PickupDelay:1s');
    await world.step(2);
    await world.result(`data get entity ${subject} PickupDelay`, 0);
  }),
  itemCase('infinite-pickup-delay', 'The never-pick-up sentinel remains unchanged while ticking', async (world) => {
    await item(world, ',PickupDelay:32767s');
    await world.step(5);
    await world.result(`data get entity ${subject} PickupDelay`, 32767);
  }),
  itemCase('merge-counts', 'Compatible nearby item entities combine their item counts', async (world) => {
    await item(world, '', '{id:"minecraft:stone",count:2}');
    await item(world, '', '{id:"minecraft:stone",count:3}');
    await world.step(40);
    await count(world, 1);
    await world.result(`data get entity ${subject} Item.count`, 5);
  }),
  itemCase('different-items-no-merge', 'Different item types do not merge', async (world) => {
    await item(world);
    await item(world, '', '{id:"minecraft:dirt",count:1}');
    await world.step(40);
    await count(world, 2);
  }),
  itemCase('components-no-merge', 'Items with different custom-data components do not merge', async (world) => {
    await item(world, '', '{id:"minecraft:stone",count:1,components:{"minecraft:custom_data":{test:1}}}');
    await item(world, '', '{id:"minecraft:stone",count:1,components:{"minecraft:custom_data":{test:2}}}');
    await world.step(40);
    await count(world, 2);
  }),
  itemCase('overflow-no-partial-merge', 'Item entities whose combined count exceeds stack size do not partially merge', async (world) => {
    await item(world, '', '{id:"minecraft:stone",count:40}');
    await item(world, '', '{id:"minecraft:stone",count:40}');
    await world.step(40);
    await count(world, 2);
    await world.result('execute if entity @e[tag=cts_subject,nbt={Item:{count:40}}]', 2);
  }),
  itemCase('sixteen-stack-limit', 'Item merging honors the sixteen-item limit of snowballs', async (world) => {
    await item(world, '', '{id:"minecraft:snowball",count:10}');
    await item(world, '', '{id:"minecraft:snowball",count:10}');
    await world.step(40);
    await count(world, 2);
  }),
  itemCase('unstackable-no-merge', 'Unstackable equipment remains separate item entities', async (world) => {
    await item(world, '', '{id:"minecraft:iron_sword",count:1}');
    await item(world, '', '{id:"minecraft:iron_sword",count:1}');
    await world.step(40);
    await count(world, 2);
  }),
  itemCase('infinite-age-no-merge', 'Infinite-lifetime item entities do not merge with ordinary items', async (world) => {
    await item(world, ',Age:-32768s');
    await item(world);
    await world.step(40);
    await count(world, 2);
  }),
  itemCase('never-pickup-no-merge', 'Never-pick-up item entities do not merge with ordinary items', async (world) => {
    await item(world, ',PickupDelay:32767s');
    await item(world);
    await world.step(40);
    await count(world, 2);
  }),
  itemCase('owner-mismatch-no-merge', 'Item entities with different owners do not merge', async (world) => {
    await item(world, ',Owner:[I;1,2,3,4]');
    await item(world, ',Owner:[I;5,6,7,8]');
    await world.step(40);
    await count(world, 2);
  }),
  itemCase('damage-health', 'Damage reduces dropped-item health', async (world) => {
    await item(world);
    await world.command(`damage ${subject} 2 minecraft:generic`);
    await world.result(`data get entity ${subject} Health`, 3);
  }),
  itemCase('damage-removal', 'Dropped items disappear immediately when their health is exhausted', async (world) => {
    await item(world);
    await world.command(`damage ${subject} 5 minecraft:generic`);
    await world.expect('unless entity @e[tag=cts_subject]');
  }),
  itemCase('fractional-damage-truncation', 'Dropped-item health truncates the result of fractional damage to an integer', async (world) => {
    await item(world);
    await world.command(`damage ${subject} 0.5 minecraft:generic`);
    await world.result(`data get entity ${subject} Health`, 4);
  }),
  itemCase('fire-resistant-item', 'Netherite items reject fire damage through their fire-resistant component', async (world) => {
    await item(world, '', '{id:"minecraft:netherite_ingot",count:1}');
    await world.command(`damage ${subject} 100 minecraft:in_fire`);
    await world.result(`data get entity ${subject} Health`, 5);
  }),
];
