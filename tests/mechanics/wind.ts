import { mechanicsCase, testSubject, type MechanicsWorld } from './helpers.js';

async function charge(world: MechanicsWorld, height = 0.5) {
  await world.command(`summon minecraft:wind_charge ~-1 ~${height} ~0.5 {Tags:["cts_wind"],Motion:[2d,0d,0d]}`);
  await world.expect('if entity @e[tag=cts_wind]');
  await world.step(2);
  await world.expect('unless entity @e[tag=cts_wind]');
}

export const cases = [
  ...([
    ['lever', 'lever[face=floor,facing=north,powered=false]', 'lever[powered=true]'],
    ['gate', 'oak_fence_gate[facing=east,open=false]', 'oak_fence_gate[open=true]'],
    ['button', 'stone_button[face=floor,facing=north,powered=false]', 'stone_button[powered=true]'],
    ['candle', 'candle[lit=true]', 'candle[lit=false]'],
  ] as const).map(([id, before, after]) =>
    mechanicsCase(`wind.${id}`, `Wind burst changes ${before} into ${after}`, 'wind-charges', async (world) => {
      await world.command('setblock ~1 ~ ~ minecraft:stone', `setblock ~ ~ ~ minecraft:${before}`);
      await world.expect(`if block ~ ~ ~ minecraft:${before}`);
      await charge(world);
      await world.expect(`if block ~ ~ ~ minecraft:${after}`);
    })),
  mechanicsCase('wind.wooden_trapdoor', 'Wind burst opens a closed wooden trapdoor', 'wind-charges', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:oak_trapdoor[half=bottom,open=false]');
    await charge(world, 0.1);
    await world.expect('if block ~ ~ ~ minecraft:oak_trapdoor[open=true]');
  }),
  mechanicsCase('wind.iron_trapdoor', 'Wind burst leaves an unpowered iron trapdoor closed', 'wind-charges', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:iron_trapdoor[half=bottom,open=false]');
    await charge(world, 0.1);
    await world.expect('if block ~ ~ ~ minecraft:iron_trapdoor[open=false,powered=false]');
  }),
  mechanicsCase('wind.powered_gate', 'Wind burst cannot close a gate held open by redstone power', 'wind-charges', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:oak_fence_gate[facing=east]', 'setblock ~1 ~ ~ minecraft:redstone_block');
    await world.expect('if block ~ ~ ~ minecraft:oak_fence_gate[open=true,powered=true]');
    await charge(world);
    await world.expect('if block ~ ~ ~ minecraft:oak_fence_gate[open=true,powered=true]');
  }),
  mechanicsCase('wind.decorated_pot', 'Direct wind charge impact breaks a decorated pot', 'wind-charges', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:decorated_pot');
    await world.expect('if block ~ ~ ~ minecraft:decorated_pot');
    await charge(world);
    await world.expect('if block ~ ~ ~ minecraft:air');
  }),
  mechanicsCase('wind.glass_survives', 'A wind burst does not destroy an ordinary glass block it hits', 'wind-charges', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:glass');
    await charge(world);
    await world.expect('if block ~ ~ ~ minecraft:glass');
  }),
  mechanicsCase('wind.direct_vs_area_damage', 'Wind charge collision damages the direct target but not nearby burst recipients', 'wind-charges', async (world) => {
    await testSubject(world);
    await world.command('summon minecraft:cow ~0.5 ~ ~1.5 {Tags:["cts_nearby"],NoAI:1b,NoGravity:1b,Health:20f,attributes:[{id:"minecraft:generic.max_health",base:20d}]}');
    await charge(world);
    await world.expect('if entity @e[tag=cts_subject,nbt={Health:99f}]');
    await world.expect('if entity @e[tag=cts_nearby,nbt={Health:20f}]');
    await world.command('execute store result score #motion cts run data get entity @e[tag=cts_nearby,limit=1] Motion[2] 1000');
    await world.expect('if score #motion cts matches 1..');
  }),
];
