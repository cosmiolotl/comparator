import { redstoneCase } from './helpers.js';

export const cases = [
  redstoneCase('observer.activation-delay', 'An observer begins its pulse two game ticks after the watched block changes', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:observer[facing=west]');
    await world.step(4);
    await world.expect('if block ~ ~ ~ minecraft:observer[powered=false]');
    await world.command('setblock ~-1 ~ ~ minecraft:stone');
    await world.step(1);
    await world.expect('if block ~ ~ ~ minecraft:observer[powered=false]');
    await world.step(1);
    await world.expect('if block ~ ~ ~ minecraft:observer[powered=true]');
  }),
  redstoneCase('observer.pulse-width', 'An observer output lasts exactly two game ticks', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:observer[facing=west]', 'setblock ~1 ~ ~ minecraft:redstone_wire');
    await world.step(4);
    await world.expect('if block ~ ~ ~ minecraft:observer[powered=false]');
    await world.command('setblock ~-1 ~ ~ minecraft:stone');
    await world.step(2);
    await world.expect('if block ~1 ~ ~ minecraft:redstone_wire[power=15]');
    await world.step(1);
    await world.expect('if block ~ ~ ~ minecraft:observer[powered=true]');
    await world.step(1);
    await world.expect('if block ~ ~ ~ minecraft:observer[powered=false]');
    await world.expect('if block ~1 ~ ~ minecraft:redstone_wire[power=0]');
  }),
  redstoneCase('observer.state-change', 'An observer detects a watched block property change without a type change', async (world) => {
    await world.command('setblock ~-1 ~ ~ minecraft:cake[bites=0]', 'setblock ~ ~ ~ minecraft:observer[facing=west]');
    await world.step(4);
    await world.expect('if block ~ ~ ~ minecraft:observer[powered=false]');
    await world.command('setblock ~-1 ~ ~ minecraft:cake[bites=1]');
    await world.step(2);
    await world.expect('if block ~ ~ ~ minecraft:observer[powered=true]');
  }),
  ...[{ name: 'back', coordinate: '~1 ~ ~' }, { name: 'side', coordinate: '~ ~ ~1' }].map(({ name, coordinate }) =>
    redstoneCase(`observer.ignores-${name}`, `An observer ignores changes on its ${name}`, async (world) => {
      await world.command('setblock ~ ~ ~ minecraft:observer[facing=west]');
      await world.step(4);
      await world.expect('if block ~ ~ ~ minecraft:observer[powered=false]');
      await world.command(`setblock ${coordinate} minecraft:stone`);
      for (let tick = 0; tick < 4; tick++) {
        await world.step(1);
        await world.expect('if block ~ ~ ~ minecraft:observer[powered=false]');
      }
    }),
  ),
  redstoneCase('observer.removal', 'An observer detects removal of its watched block', async (world) => {
    await world.command('setblock ~-1 ~ ~ minecraft:stone', 'setblock ~ ~ ~ minecraft:observer[facing=west]');
    await world.step(4);
    await world.expect('if block ~ ~ ~ minecraft:observer[powered=false]');
    await world.command('setblock ~-1 ~ ~ minecraft:air');
    await world.step(2);
    await world.expect('if block ~ ~ ~ minecraft:observer[powered=true]');
  }),
  redstoneCase('observer.pending-update-coalesces', 'A second change during an observer delay does not queue a second pulse', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:observer[facing=west]');
    await world.step(4);
    await world.expect('if block ~ ~ ~ minecraft:observer[powered=false]');
    await world.command('setblock ~-1 ~ ~ minecraft:stone');
    await world.step(1);
    await world.command('setblock ~-1 ~ ~ minecraft:dirt');
    await world.step(1);
    await world.expect('if block ~ ~ ~ minecraft:observer[powered=true]');
    await world.step(2);
    await world.expect('if block ~ ~ ~ minecraft:observer[powered=false]');
    await world.step(2);
    await world.expect('if block ~ ~ ~ minecraft:observer[powered=false]');
  }),
];
