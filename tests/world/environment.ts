import { scenario } from '../../src/world/scenario.js';

export const cases = [
  ...[
    ['local', '~-8 ~-8 ~-8 ~7 ~7 ~7', '~ ~ ~'],
    ['negative', '~-16 ~-8 ~-16 ~-1 ~7 ~-1', '~-8 ~ ~-8'],
  ].map(([id, range, probe]) => scenario({
    id: `java.world.biome.${id}`, title: `Fillbiome updates a ${id} volume including the sampled biome`,
    reference: 'docs/research-world.md#environment',
    async run(world) {
      await world.result(`fillbiome ${range} minecraft:desert`, 64);
      await world.expect(`if biome ${probe} minecraft:desert`);
      await world.command(`fillbiome ${range} minecraft:plains`);
      await world.expect(`if biome ${probe} minecraft:plains`);
    },
  })),
  scenario({
    id: 'java.world.biome.quart-boundary', title: 'Biome fills quantize their endpoints to four-block cells',
    reference: 'docs/research-world.md#environment',
    async run(world) {
      await world.result('fillbiome ~ ~ ~ ~3 ~3 ~3 desert', 1);
      await world.result('fillbiome ~3 ~3 ~3 ~4 ~4 ~4 plains', 8);
    },
  }),
  ...[true, false].map((enabled) => scenario({
    id: `java.world.drops.tile-drops-${enabled}`, title: `Block destruction ${enabled ? 'produces' : 'suppresses'} drops with doTileDrops=${enabled}`,
    reference: 'docs/research-world.md#environment',
    async run(world) {
      await world.command(`gamerule doTileDrops ${enabled}`, 'setblock ~ ~ ~ diamond_block', 'setblock ~ ~ ~ air destroy');
      await world.expect(`${enabled ? 'if' : 'unless'} entity @e[type=item,nbt={Item:{id:"minecraft:diamond_block"}}]`);
      await world.expect('if block ~ ~ ~ air');
    },
  })),
  scenario({
    id: 'java.world.coordinates.local-forward', title: 'Local forward coordinates respect the command source yaw',
    reference: 'docs/research-world.md#commands',
    async run(world) {
      await world.command('execute rotated 0 0 run setblock ^ ^ ^2 gold_block');
      await world.expect('if block ~ ~ ~2 gold_block');
    },
  }),
  scenario({
    id: 'java.world.coordinates.local-left', title: 'Local left coordinates rotate with the source yaw',
    reference: 'docs/research-world.md#commands',
    async run(world) {
      await world.command('execute rotated 90 0 run setblock ^2 ^ ^ gold_block');
      await world.expect('if block ~ ~ ~2 gold_block');
    },
  }),
  scenario({
    id: 'java.world.coordinates.negative-floor', title: 'Negative fractional relative block coordinates floor toward negative infinity',
    reference: 'docs/research-world.md#commands',
    async run(world) {
      await world.command('setblock ~-0.1 ~ ~-0.1 gold_block');
      await world.expect('if block ~-1 ~ ~-1 gold_block if block ~ ~ ~ air');
    },
  }),
  scenario({
    id: 'java.world.coordinates.align', title: 'Execute align floors position before subsequent relative offsets',
    reference: 'docs/research-world.md#commands',
    async run(world) {
      await world.command('execute positioned ~0.75 ~0.75 ~0.75 align xyz run setblock ~0.5 ~0.5 ~0.5 gold_block');
      await world.expect('if block ~ ~ ~ gold_block if block ~1 ~1 ~1 air');
    },
  }),
];
