import { scenario } from '../../src/world/scenario.js';

type World = Parameters<Parameters<typeof scenario>[0]['run']>[0];
const subject = '@e[tag=cts_subject,limit=1]';

function physicsCase(id: string, title: string, run: (world: World) => Promise<void>) {
  return scenario({ id: `java.entities.physics.${id}`, title, reference: 'docs/research-entities.md#physics', run });
}

async function item(world: World, fields = '') {
  await world.command(`summon minecraft:item ~ ~10 ~ {Tags:["cts_subject"],Item:{id:"minecraft:stone",count:1},Motion:[0d,0d,0d]${fields}}`);
  await world.expect('if entity @e[tag=cts_subject]');
}

async function cow(world: World) {
  await world.command('summon minecraft:cow ~ ~10 ~ {Tags:["cts_subject"],Motion:[0d,0d,0d],attributes:[{id:"minecraft:generic.movement_speed",base:0d}]}');
  await world.expect('if entity @e[tag=cts_subject]');
}

export const cases = [
  physicsCase('item-gravity', 'Item gravity accelerates downward before applying vertical drag', async (world) => {
    await item(world);
    await world.step(1);
    await world.result(`data get entity ${subject} Motion[1] 1000`, -40);
    await world.command('execute positioned ~ ~9.96 ~ run tag @e[tag=cts_subject,distance=..0.000001] add cts_position_match');
    await world.expect('if entity @e[tag=cts_position_match]');
  }),
  physicsCase('item-no-gravity', 'NoGravity prevents a stationary item from falling', async (world) => {
    await item(world, ',NoGravity:1b');
    await world.step(5);
    await world.result(`data get entity ${subject} Motion[1] 1000`, 0);
    await world.command('execute positioned ~ ~10 ~ run tag @e[tag=cts_subject,distance=..0.000001] add cts_position_match');
    await world.expect('if entity @e[tag=cts_position_match]');
  }),
  physicsCase('item-vertical-drag', 'NoGravity items still apply vertical velocity drag after moving', async (world) => {
    await item(world, ',NoGravity:1b');
    await world.command(`data merge entity ${subject} {Motion:[0d,1d,0d]}`);
    await world.step(1);
    await world.expect('if entity @e[tag=cts_subject,nbt={Motion:[0d,0.98d,0d]}]');
    await world.command('execute positioned ~ ~11 ~ run tag @e[tag=cts_subject,distance=..0.000001] add cts_position_match');
    await world.expect('if entity @e[tag=cts_position_match]');
  }),
  physicsCase('item-horizontal-drag', 'Airborne items apply horizontal velocity drag', async (world) => {
    await item(world, ',NoGravity:1b');
    await world.command(`data merge entity ${subject} {Motion:[1d,0d,0d]}`);
    await world.step(1);
    await world.result(`data get entity ${subject} Motion[0] 100`, 98);
    await world.command('execute positioned ~1 ~10 ~ run tag @e[tag=cts_subject,distance=..0.000001] add cts_position_match');
    await world.expect('if entity @e[tag=cts_position_match]');
  }),
  physicsCase('item-floor-collision', 'Falling items settle on the solid floor rather than passing through it', async (world) => {
    await item(world);
    await world.step(80);
    await world.command('execute positioned ~ ~ ~ run tag @e[tag=cts_subject,distance=..0.000001] add cts_position_match');
    await world.expect('if entity @e[tag=cts_position_match,nbt={OnGround:1b}]');
  }),
  physicsCase('living-gravity', 'Living-entity gravity accelerates before applying vertical drag', async (world) => {
    await cow(world);
    await world.step(1);
    await world.result(`data get entity ${subject} Motion[1] 1000`, -79);
  }),
  physicsCase('zero-gravity-attribute', 'A zero gravity attribute prevents downward acceleration', async (world) => {
    await cow(world);
    await world.command(`attribute ${subject} minecraft:generic.gravity base set 0`);
    await world.step(3);
    await world.result(`data get entity ${subject} Motion[1] 1000`, 0);
    await world.command('execute positioned ~ ~10 ~ run tag @e[tag=cts_subject,distance=..0.000001] add cts_position_match');
    await world.expect('if entity @e[tag=cts_position_match]');
  }),
  physicsCase('increased-gravity-attribute', 'The gravity attribute scales downward acceleration', async (world) => {
    await cow(world);
    await world.command(`attribute ${subject} minecraft:generic.gravity base set 0.16`);
    await world.step(1);
    await world.result(`data get entity ${subject} Motion[1] 1000`, -157);
  }),
  physicsCase('arrow-block-collision', 'Arrows become embedded when their path intersects a solid block', async (world) => {
    await world.command('fill ~2 ~ ~-1 ~2 ~4 ~1 stone');
    await world.command('summon minecraft:arrow ~ ~2 ~ {Tags:["cts_subject"],NoGravity:1b,Motion:[1d,0d,0d]}');
    await world.step(3);
    await world.expect('if entity @e[tag=cts_subject,nbt={inGround:1b}]');
  }),
  physicsCase('snowball-block-collision', 'Snowballs are removed when their path intersects a solid block', async (world) => {
    await world.command('fill ~2 ~ ~-1 ~2 ~4 ~1 stone');
    await world.command('summon minecraft:snowball ~ ~2 ~ {Tags:["cts_subject"],NoGravity:1b,Motion:[1d,0d,0d]}');
    await world.expect('if entity @e[tag=cts_subject]');
    await world.step(3);
    await world.expect('unless entity @e[tag=cts_subject]');
  }),
];
