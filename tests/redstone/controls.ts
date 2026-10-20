import { redstoneCase } from './helpers.js';

export const cases = [
  ...['iron_trapdoor', 'oak_fence_gate'].map((block) => redstoneCase(`control.${block}-power-cycle`, `Redstone opens and closes an ${block}`, async (world) => {
    await world.command(`setblock ~ ~ ~ minecraft:${block}`, 'setblock ~1 ~ ~ minecraft:redstone_block');
    await world.expect(`if block ~ ~ ~ minecraft:${block}[open=true,powered=true]`);
    await world.command('setblock ~1 ~ ~ minecraft:air');
    await world.expect(`if block ~ ~ ~ minecraft:${block}[open=false,powered=false]`);
  })),
  redstoneCase('control.door-upper-power', 'Power at an iron door upper half updates both halves', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:iron_door[half=lower]', 'setblock ~ ~1 ~ minecraft:iron_door[half=upper]', 'setblock ~1 ~1 ~ minecraft:redstone_block');
    await world.expect('if block ~ ~ ~ minecraft:iron_door[half=lower,open=true,powered=true]');
    await world.expect('if block ~ ~1 ~ minecraft:iron_door[half=upper,open=true,powered=true]');
    await world.command('setblock ~1 ~1 ~ minecraft:air');
    await world.expect('if block ~ ~ ~ minecraft:iron_door[open=false,powered=false]');
    await world.expect('if block ~ ~1 ~ minecraft:iron_door[open=false,powered=false]');
  }),
  redstoneCase('control.door-support-removal', 'Removing a wooden door support removes both halves', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:oak_door[half=lower]', 'setblock ~ ~1 ~ minecraft:oak_door[half=upper]', 'setblock ~ ~-1 ~ minecraft:air');
    await world.expect('if block ~ ~ ~ minecraft:air');
    await world.expect('if block ~ ~1 ~ minecraft:air');
  }),
  redstoneCase('control.redstone-primes-tnt', 'Applying power replaces TNT with one primed explosive', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:tnt', 'setblock ~1 ~ ~ minecraft:redstone_block');
    await world.expect('if block ~ ~ ~ minecraft:air');
    await world.expect('if entity @e[type=minecraft:tnt,distance=..2,nbt={fuse:80s}]');
    await world.result('execute if entity @e[type=minecraft:tnt,distance=..2]', 1);
  }),
];
