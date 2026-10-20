import { redstoneCase } from './helpers.js';

export const cases = [
  redstoneCase('lighting.lamp-immediate-activation', 'A redstone lamp lights during the powering neighbor update', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:redstone_lamp', 'setblock ~-1 ~ ~ minecraft:redstone_block');
    await world.expect('if block ~ ~ ~ minecraft:redstone_lamp[lit=true]');
  }),
  redstoneCase('lighting.lamp-delayed-shutdown', 'A lamp stays lit for four game ticks after losing power', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:redstone_lamp', 'setblock ~-1 ~ ~ minecraft:redstone_block', 'setblock ~-1 ~ ~ minecraft:air');
    await world.step(3);
    await world.expect('if block ~ ~ ~ minecraft:redstone_lamp[lit=true]');
    await world.step(1);
    await world.expect('if block ~ ~ ~ minecraft:redstone_lamp[lit=false]');
  }),
  redstoneCase('lighting.lamp-repower-before-shutdown', 'Restoring lamp power before its scheduled shutdown keeps it lit', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:redstone_lamp', 'setblock ~-1 ~ ~ minecraft:redstone_block', 'setblock ~-1 ~ ~ minecraft:air');
    await world.step(3);
    await world.command('setblock ~-1 ~ ~ minecraft:redstone_block');
    await world.step(2);
    await world.expect('if block ~ ~ ~ minecraft:redstone_lamp[lit=true]');
  }),
  redstoneCase('lighting.bulb-toggles-on-rising-edges', 'Two copper bulb rising edges toggle its light on then off', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:copper_bulb', 'setblock ~-1 ~ ~ minecraft:redstone_block');
    await world.expect('if block ~ ~ ~ minecraft:copper_bulb[lit=true,powered=true]');
    await world.command('setblock ~-1 ~ ~ minecraft:air', 'setblock ~-1 ~ ~ minecraft:redstone_block');
    await world.expect('if block ~ ~ ~ minecraft:copper_bulb[lit=false,powered=true]');
  }),
  redstoneCase('lighting.bulb-retains-light', 'A copper bulb retains its light when input power is removed', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:copper_bulb', 'setblock ~-1 ~ ~ minecraft:redstone_block', 'setblock ~-1 ~ ~ minecraft:air');
    await world.step(10);
    await world.expect('if block ~ ~ ~ minecraft:copper_bulb[lit=true,powered=false]');
  }),
  redstoneCase('lighting.bulb-sustained-input', 'Continuous copper bulb power does not repeatedly toggle its light', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:copper_bulb', 'setblock ~-1 ~ ~ minecraft:redstone_block');
    await world.step(20);
    await world.command('setblock ~ ~ ~1 minecraft:stone');
    await world.expect('if block ~ ~ ~ minecraft:copper_bulb[lit=true,powered=true]');
  }),
  redstoneCase('lighting.bulb-comparator-memory', 'Comparator output follows stored copper bulb light rather than current input power', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:comparator[facing=west]', 'setblock ~-1 ~ ~ minecraft:copper_bulb', 'setblock ~-2 ~ ~ minecraft:redstone_block');
    await world.step(2);
    await world.result('data get block ~ ~ ~ OutputSignal', 15);
    await world.command('setblock ~-2 ~ ~ minecraft:air');
    await world.step(2);
    await world.result('data get block ~ ~ ~ OutputSignal', 15);
    await world.command('setblock ~-2 ~ ~ minecraft:redstone_block');
    await world.step(2);
    await world.result('data get block ~ ~ ~ OutputSignal', 0);
  }),
  redstoneCase('lighting.bulb-does-not-conduct', 'A powered copper bulb does not conduct power into an adjacent lamp', async (world) => {
    await world.command('setblock ~ ~1 ~ minecraft:copper_bulb', 'setblock ~1 ~1 ~ minecraft:redstone_lamp', 'setblock ~-1 ~1 ~ minecraft:redstone_block');
    await world.expect('if block ~ ~1 ~ minecraft:copper_bulb[lit=true]');
    await world.expect('if block ~1 ~1 ~ minecraft:redstone_lamp[lit=false]');
  }),
];
