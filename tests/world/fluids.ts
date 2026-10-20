import { scenario } from '../../src/world/scenario.js';

export const cases = [
  ...[4, 5].map((ticks) => scenario({
    id: `java.world.water.downward-delay-${ticks}`, title: `Water ${ticks === 4 ? 'waits before' : 'flows on'} its fifth scheduled tick`,
    reference: 'docs/research-world.md#fluids',
    async run(world) {
      await world.command('setblock ~ ~1 ~ water');
      await world.step(ticks);
      await world.expect(`if block ~ ~ ~ ${ticks === 4 ? 'air' : 'water[level=8]'}`);
    },
  })),
  scenario({
    id: 'java.world.water.horizontal-level', title: 'Water loses one level when spreading horizontally',
    reference: 'docs/research-world.md#fluids',
    async run(world) {
      await world.command('setblock ~ ~ ~ water');
      await world.step(5);
      await world.expect('if block ~1 ~ ~ water[level=1]');
    },
  }),
  scenario({
    id: 'java.world.water.spread-limit', title: 'Water reaches seven horizontal blocks but not eight on a flat floor',
    reference: 'docs/research-world.md#fluids',
    async run(world) {
      await world.command('setblock ~ ~ ~ water');
      await world.step(45);
      await world.expect('if block ~7 ~ ~ water[level=7] if block ~8 ~ ~ air');
    },
  }),
  ...[true, false].map((enabled) => scenario({
    id: `java.world.water.source-conversion-${enabled}`, title: `Two sources ${enabled ? 'create' : 'do not create'} a source with conversion ${enabled}`,
    reference: 'docs/research-world.md#fluids',
    async run(world) {
      try {
        await world.command(`gamerule waterSourceConversion ${enabled}`, 'setblock ~ ~ ~ water', 'setblock ~2 ~ ~ water');
        await world.step(10);
        await world.expect(`if block ~1 ~ ~ water[level=${enabled ? 0 : 1}]`);
      } finally { await world.command('gamerule waterSourceConversion true'); }
    },
  })),
  ...[
    ['source', 'lava[level=0]', 'obsidian'],
    ['flowing', 'lava[level=1]', 'cobblestone'],
  ].map(([id, lava, product]) => scenario({
    id: `java.world.fluids.water-meets-${id}-lava`, title: `Water meeting ${id} lava makes ${product}`,
    reference: 'docs/research-world.md#fluids',
    async run(world) {
      await world.command('setblock ~1 ~ ~ water', `setblock ~ ~ ~ ${lava}`);
      await world.expect(`if block ~ ~ ~ ${product}`);
    },
  })),
  scenario({
    id: 'java.world.fluids.basalt', title: 'Lava adjacent to blue ice over soul soil becomes basalt',
    reference: 'docs/research-world.md#fluids',
    async run(world) {
      await world.command('setblock ~ ~-1 ~ soul_soil', 'setblock ~1 ~ ~ blue_ice', 'setblock ~ ~ ~ lava');
      await world.expect('if block ~ ~ ~ basalt');
    },
  }),
  ...[false, true].map((wet) => scenario({
    id: `java.world.sponge.${wet ? 'saturated' : 'absorption'}`, title: `${wet ? 'Wet sponge cannot absorb more' : 'Dry sponge absorbs adjacent'} water`,
    reference: 'docs/research-world.md#fluids',
    async run(world) {
      await world.command('setblock ~1 ~ ~ water', `setblock ~ ~ ~ ${wet ? 'wet_sponge' : 'sponge'}`);
      await world.expect('if block ~ ~ ~ wet_sponge');
      await world.expect(`if block ~1 ~ ~ ${wet ? 'water' : 'air'}`);
    },
  })),
  scenario({
    id: 'java.world.sponge.waterlogged-block', title: 'Sponge drains waterlogging while preserving the solid block',
    reference: 'docs/research-world.md#fluids',
    async run(world) {
      await world.command('setblock ~1 ~ ~ oak_slab[type=bottom,waterlogged=true]', 'setblock ~ ~ ~ sponge');
      await world.expect('if block ~1 ~ ~ oak_slab[waterlogged=false] if block ~ ~ ~ wet_sponge');
    },
  }),
  scenario({
    id: 'java.world.waterlogging.spreads', title: 'A waterlogged slab acts as a source for horizontal water flow',
    reference: 'docs/research-world.md#fluids',
    async run(world) {
      await world.command('setblock ~ ~ ~ oak_slab[type=bottom,waterlogged=true]', 'setblock ~1 ~ ~ stone', 'setblock ~1 ~ ~ air');
      await world.step(10);
      await world.expect('if block ~ ~ ~ oak_slab[waterlogged=true] if block ~1 ~ ~ water[level=1]');
    },
  }),
  ...[
    ['soul-sand', 'soul_sand', false],
    ['magma', 'magma_block', true],
  ].map(([id, floor, drag]) => scenario({
    id: `java.world.bubble-column.${id}`, title: `${id} creates a bubble column with drag=${drag}`,
    reference: 'docs/research-world.md#fluids',
    async run(world) {
      await world.command(`setblock ~ ~-1 ~ ${floor}`, 'fill ~ ~ ~ ~ ~3 ~ water');
      await world.step(25);
      await world.expect(`if block ~ ~2 ~ bubble_column[drag=${drag}]`);
    },
  })),
  scenario({
    id: 'java.world.bubble-column.source-removed', title: 'Removing a bubble column base restores ordinary water',
    reference: 'docs/research-world.md#fluids',
    async run(world) {
      await world.command('setblock ~ ~-1 ~ soul_sand', 'fill ~ ~ ~ ~ ~3 ~ water');
      await world.step(25);
      await world.expect('if block ~ ~2 ~ bubble_column');
      await world.command('setblock ~ ~-1 ~ stone');
      await world.step(10);
      await world.expect('if block ~ ~2 ~ water[level=0]');
    },
  }),
];
