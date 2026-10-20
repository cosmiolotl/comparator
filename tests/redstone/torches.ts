import { redstoneCase } from './helpers.js';

export const cases = [
  redstoneCase('torch.turn-off-delay', 'A floor torch inverts its powered support after two game ticks', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:stone', 'setblock ~ ~1 ~ minecraft:redstone_torch', 'setblock ~ ~ ~ minecraft:redstone_block');
    await world.step(1);
    await world.expect('if block ~ ~1 ~ minecraft:redstone_torch[lit=true]');
    await world.step(1);
    await world.expect('if block ~ ~1 ~ minecraft:redstone_torch[lit=false]');
  }),
  redstoneCase('torch.turn-on-delay', 'An extinguished torch relights two game ticks after support power disappears', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:redstone_block', 'setblock ~ ~1 ~ minecraft:redstone_torch[lit=false]', 'setblock ~ ~ ~ minecraft:stone');
    await world.step(1);
    await world.expect('if block ~ ~1 ~ minecraft:redstone_torch[lit=false]');
    await world.step(1);
    await world.expect('if block ~ ~1 ~ minecraft:redstone_torch[lit=true]');
  }),
  redstoneCase('torch.wall-attachment-inversion', 'A wall torch responds to power in the block it is attached to', async (world) => {
    await world.command('setblock ~-1 ~1 ~ minecraft:stone', 'setblock ~ ~1 ~ minecraft:redstone_wall_torch[facing=east]', 'setblock ~-1 ~1 ~ minecraft:redstone_block');
    await world.step(2);
    await world.expect('if block ~ ~1 ~ minecraft:redstone_wall_torch[lit=false]');
    await world.command('setblock ~-1 ~1 ~ minecraft:stone');
    await world.step(2);
    await world.expect('if block ~ ~1 ~ minecraft:redstone_wall_torch[lit=true]');
  }),
  redstoneCase('torch.no-downward-output', 'A floor torch powers a side lamp without powering its supporting lamp', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:redstone_lamp', 'setblock ~1 ~1 ~ minecraft:redstone_lamp', 'setblock ~ ~1 ~ minecraft:redstone_torch');
    await world.step(4);
    await world.expect('if block ~ ~ ~ minecraft:redstone_lamp[lit=false]');
    await world.expect('if block ~1 ~1 ~ minecraft:redstone_lamp[lit=true]');
  }),
  redstoneCase('torch.strong-upward-output', 'A torch strongly powers the solid block above it', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:stone', 'setblock ~ ~2 ~ minecraft:stone', 'setblock ~1 ~2 ~ minecraft:redstone_lamp', 'setblock ~ ~1 ~ minecraft:redstone_torch');
    await world.expect('if block ~1 ~2 ~ minecraft:redstone_lamp[lit=true]');
  }),
  redstoneCase('torch.burnout-and-recovery', 'Eight rapid torch shutdowns cause burnout followed by cooldown recovery', async (world) => {
    await world.command('setblock ~8 ~ ~8 minecraft:stone', 'setblock ~8 ~1 ~8 minecraft:redstone_torch');
    for (let cycle = 1; cycle <= 8; cycle++) {
      await world.command('setblock ~8 ~ ~8 minecraft:redstone_block');
      await world.step(2);
      await world.expect('if block ~8 ~1 ~8 minecraft:redstone_torch[lit=false]');
      await world.command('setblock ~8 ~ ~8 minecraft:stone');
      await world.step(2);
      await world.expect(`if block ~8 ~1 ~8 minecraft:redstone_torch[lit=${cycle < 8}]`);
    }
    await world.step(160);
    await world.expect('if block ~8 ~1 ~8 minecraft:redstone_torch[lit=true]');
  }),
];
