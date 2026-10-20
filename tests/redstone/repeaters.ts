import { redstoneCase } from './helpers.js';

const delays = [1, 2, 3, 4].flatMap((delay) => [
  redstoneCase(`repeater.rising-delay-${delay}`, `Repeater setting ${delay} delays a rising edge by ${delay * 2} game ticks`, async (world) => {
    await world.command(`setblock ~ ~ ~ minecraft:repeater[facing=west,delay=${delay}]`, 'setblock ~-1 ~ ~ minecraft:redstone_block');
    await world.step(delay * 2 - 1);
    await world.expect('if block ~ ~ ~ minecraft:repeater[powered=false]');
    await world.step(1);
    await world.expect('if block ~ ~ ~ minecraft:repeater[powered=true]');
  }),
  redstoneCase(`repeater.falling-delay-${delay}`, `Repeater setting ${delay} delays a falling edge by ${delay * 2} game ticks`, async (world) => {
    await world.command(`setblock ~ ~ ~ minecraft:repeater[facing=west,delay=${delay}]`, 'setblock ~-1 ~ ~ minecraft:redstone_block');
    await world.step(delay * 2);
    await world.expect('if block ~ ~ ~ minecraft:repeater[powered=true]');
    await world.command('setblock ~-1 ~ ~ minecraft:air');
    await world.step(delay * 2 - 1);
    await world.expect('if block ~ ~ ~ minecraft:repeater[powered=true]');
    await world.step(1);
    await world.expect('if block ~ ~ ~ minecraft:repeater[powered=false]');
  }),
]);

export const cases = [
  ...delays,
  ...[false, true].map((initialPower) => redstoneCase(`repeater.lock-${initialPower ? 'on' : 'off'}`, `A side repeater locks the ${initialPower ? 'on' : 'off'} output state`, async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:repeater[facing=west]');
    if (initialPower) await world.command('setblock ~-1 ~ ~ minecraft:redstone_block');
    await world.step(2);
    await world.command('setblock ~ ~ ~-1 minecraft:repeater[facing=north]', 'setblock ~ ~ ~-2 minecraft:redstone_block');
    await world.step(2);
    await world.expect(`if block ~ ~ ~ minecraft:repeater[locked=true,powered=${initialPower}]`);
    await world.command(`setblock ~-1 ~ ~ minecraft:${initialPower ? 'air' : 'redstone_block'}`);
    await world.step(8);
    await world.expect(`if block ~ ~ ~ minecraft:repeater[locked=true,powered=${initialPower}]`);
    await world.command('setblock ~ ~ ~-2 minecraft:air');
    await world.step(6);
    await world.expect(`if block ~ ~ ~ minecraft:repeater[locked=false,powered=${!initialPower}]`);
  })),
  ...[['front', '~1 ~ ~'], ['side', '~ ~ ~1']].map(([name, source]) => redstoneCase(`repeater.reject-${name}`, `A repeater does not accept its ${name} as a rear input`, async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:repeater[facing=west]', `setblock ${source} minecraft:redstone_block`);
    await world.step(8);
    await world.expect('if block ~ ~ ~ minecraft:repeater[powered=false,locked=false]');
  })),
  redstoneCase('repeater.side-dust-does-not-lock', 'Powered side dust does not lock a repeater', async (world) => {
    await world.command(
      'setblock ~ ~ ~ minecraft:repeater[facing=west]',
      'setblock ~ ~ ~1 minecraft:redstone_wire',
      'setblock ~ ~ ~2 minecraft:redstone_block',
      'setblock ~-1 ~ ~ minecraft:redstone_block',
    );
    await world.step(2);
    await world.expect('if block ~ ~ ~ minecraft:repeater[powered=true,locked=false]');
  }),
  redstoneCase('repeater.regenerates-weak-input', 'A repeater regenerates strength one to strength fifteen', async (world) => {
    await world.command('fill ~-15 ~ ~ ~-1 ~ ~ minecraft:redstone_wire', 'setblock ~-16 ~ ~ minecraft:redstone_block');
    await world.command('setblock ~ ~ ~ minecraft:repeater[facing=west]', 'setblock ~1 ~ ~ minecraft:redstone_wire');
    await world.step(3);
    await world.expect('if block ~-1 ~ ~ minecraft:redstone_wire[power=1]');
    await world.expect('if block ~1 ~ ~ minecraft:redstone_wire[power=15]');
  }),
  redstoneCase('repeater.support-removal', 'A repeater breaks when its supporting block disappears', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:repeater', 'setblock ~ ~-1 ~ minecraft:air');
    await world.expect('if block ~ ~ ~ minecraft:air');
  }),
  redstoneCase('repeater.short-pulse-stretch', 'A maximum-delay repeater stretches a one-game-tick input pulse', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:repeater[facing=west,delay=4]', 'setblock ~-1 ~ ~ minecraft:redstone_block');
    await world.step(1);
    await world.command('setblock ~-1 ~ ~ minecraft:air');
    await world.step(7);
    await world.expect('if block ~ ~ ~ minecraft:repeater[powered=true]');
    await world.step(7);
    await world.expect('if block ~ ~ ~ minecraft:repeater[powered=true]');
    await world.step(1);
    await world.expect('if block ~ ~ ~ minecraft:repeater[powered=false]');
  }),
];
