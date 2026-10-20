import { comparatorInput, redstoneCase } from './helpers.js';

const inputs = [
  { rear: 0, north: 0, south: 0 },
  { rear: 0, north: 15, south: 0 },
  { rear: 1, north: 0, south: 0 },
  { rear: 1, north: 1, south: 0 },
  { rear: 7, north: 6, south: 0 },
  { rear: 7, north: 8, south: 0 },
  { rear: 12, north: 3, south: 8 },
  { rear: 15, north: 15, south: 15 },
];

const arithmetic = (['compare', 'subtract'] as const).flatMap((mode) => inputs.map(({ rear, north, south }) => {
  const strongestSide = Math.max(north, south);
  let expected = Math.max(rear - strongestSide, 0);
  if (mode === 'compare') expected = rear >= strongestSide ? rear : 0;
  return redstoneCase(`comparator.${mode}-${rear}-${north}-${south}`, `Comparator ${mode} with rear ${rear} and sides ${north}/${south} outputs ${expected}`, async (world) => {
    await world.command(`setblock ~ ~ ~ minecraft:comparator[facing=west,mode=${mode}]`);
    await comparatorInput(world, rear, 'rear');
    await comparatorInput(world, north, 'north');
    await comparatorInput(world, south, 'south');
    await world.step(3);
    await world.result('data get block ~ ~ ~ OutputSignal', expected);
    await world.expect(`if block ~ ~ ~ minecraft:comparator[powered=${expected > 0}]`);
  });
}));

const analogBlocks = [
  ...Array.from({ length: 7 }, (_, bites) => ({ name: `cake-bites-${bites}`, block: `cake[bites=${bites}]`, signal: 14 - bites * 2 })),
  { name: 'empty-cauldron', block: 'cauldron', signal: 0 },
  ...[1, 2, 3].map((level) => ({ name: `water-cauldron-${level}`, block: `water_cauldron[level=${level}]`, signal: level })),
  { name: 'lava-cauldron', block: 'lava_cauldron', signal: 3 },
].map(({ name, block, signal }) => redstoneCase(`comparator.analog-${name}`, `Comparator reads ${signal} from ${name}`, async (world) => {
  await world.command('setblock ~ ~ ~ minecraft:comparator[facing=west]', `setblock ~-1 ~ ~ minecraft:${block}`);
  await world.step(3);
  await world.result('data get block ~ ~ ~ OutputSignal', signal);
}));

export const cases = [
  ...arithmetic,
  ...analogBlocks,
  redstoneCase('comparator.rising-delay', 'A comparator waits two game ticks before raising its output', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:comparator[facing=west]', 'setblock ~-1 ~ ~ minecraft:redstone_block');
    await world.step(1);
    await world.result('data get block ~ ~ ~ OutputSignal', 0);
    await world.step(1);
    await world.result('data get block ~ ~ ~ OutputSignal', 15);
  }),
  redstoneCase('comparator.falling-delay', 'A comparator waits two game ticks before clearing its output', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:comparator[facing=west]', 'setblock ~-1 ~ ~ minecraft:redstone_block');
    await world.step(2);
    await world.command('setblock ~-1 ~ ~ minecraft:air');
    await world.step(1);
    await world.result('data get block ~ ~ ~ OutputSignal', 15);
    await world.step(1);
    await world.result('data get block ~ ~ ~ OutputSignal', 0);
  }),
  ...[{ block: 'stone', expected: 14 }, { block: 'glass', expected: 0 }].map(({ block, expected }) =>
    redstoneCase(`comparator.read-through-${block}`, `A comparator reads ${expected} from cake behind ${block}`, async (world) => {
      // Command placement behind a solid block needs a neighbor update to request a fresh read.
      await world.command(
        'setblock ~ ~ ~ minecraft:comparator[facing=west]',
        `setblock ~-1 ~ ~ minecraft:${block}`,
        'setblock ~-2 ~ ~ minecraft:cake',
        'setblock ~ ~ ~1 minecraft:stone',
      );
      await world.step(3);
      await world.result('data get block ~ ~ ~ OutputSignal', expected);
    }),
  ),
];
