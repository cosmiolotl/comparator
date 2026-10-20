import { scenario } from '../../src/world/scenario.js';
import type { World } from '../../src/world/world.js';

async function frame(world: World, width = 2, height = 3): Promise<void> {
  await world.command(`fill ~-1 ~ ~ ~${width} ~${height + 1} ~ obsidian`,
    `fill ~ ~1 ~ ~${width - 1} ~${height} ~ air`);
}

export const cases = [
  ...[
    { id: 'minimum', width: 2, height: 3, valid: true },
    { id: 'wide', width: 4, height: 3, valid: true },
    { id: 'tall', width: 2, height: 5, valid: true },
    { id: 'too-narrow', width: 1, height: 3, valid: false },
    { id: 'too-short', width: 2, height: 2, valid: false },
  ].map(({ id, width, height, valid }) => scenario({
    id: `java.environment.portal.${id}`, title: `A ${width} by ${height} portal interior ${valid ? 'activates' : 'is rejected'}`,
    reference: 'docs/research-environment.md#portals-and-dimensions',
    async run(world) {
      await frame(world, width, height);
      await world.command('setblock ~ ~1 ~ fire');
      await world.expect(`${valid ? 'if' : 'unless'} block ~ ~1 ~ nether_portal`);
      if (valid) await world.expect(`if block ~${width - 1} ~${height} ~ nether_portal[axis=x]`);
    },
  })),
  scenario({
    id: 'java.environment.portal.corners-optional', title: 'Portal frames do not require corner blocks',
    reference: 'docs/research-environment.md#portals-and-dimensions',
    async run(world) {
      await frame(world);
      await world.command('setblock ~-1 ~ ~ air', 'setblock ~2 ~ ~ air',
        'setblock ~-1 ~4 ~ air', 'setblock ~2 ~4 ~ air', 'setblock ~ ~1 ~ fire');
      await world.expect('if block ~ ~1 ~ nether_portal');
      await world.expect('if block ~1 ~3 ~ nether_portal');
    },
  }),
  scenario({
    id: 'java.environment.portal.frame-break', title: 'Breaking a frame edge removes the connected portal interior',
    reference: 'docs/research-environment.md#portals-and-dimensions',
    async run(world) {
      await frame(world);
      await world.command('setblock ~ ~1 ~ fire');
      await world.expect('if block ~1 ~3 ~ nether_portal');
      await world.command('setblock ~-1 ~2 ~ air');
      await world.expect('if block ~ ~1 ~ air');
      await world.expect('if block ~1 ~3 ~ air');
    },
  }),
  scenario({
    id: 'java.environment.portal.obstructed-interior', title: 'An occupied frame interior prevents portal activation',
    reference: 'docs/research-environment.md#portals-and-dimensions',
    async run(world) {
      await frame(world);
      await world.command('setblock ~1 ~2 ~ stone', 'setblock ~ ~1 ~ fire');
      await world.expect('if block ~1 ~2 ~ stone');
      await world.expect('unless block ~ ~1 ~ nether_portal');
    },
  }),
  ...[
    { dimension: 'minecraft:overworld' as const, delay: 30 },
    { dimension: 'minecraft:the_nether' as const, delay: 10 },
  ].map(({ dimension, delay }) => scenario({
    id: `java.environment.dimension.lava-${dimension.split(':')[1]}`,
    title: `Lava schedules its first downward flow after ${delay} ticks in ${dimension}`,
    placement: { dimension },
    reference: 'docs/research-environment.md#portals-and-dimensions',
    async run(world) {
      await world.command('setblock ~ ~1 ~ lava');
      await world.step(delay - 1);
      await world.expect('if block ~ ~ ~ air');
      await world.step(1);
      await world.expect('if block ~ ~ ~ lava[level=8]');
    },
  })),
  scenario({
    id: 'java.environment.dimension.nether-water-bucket', title: 'A dispenser water bucket evaporates in the Nether without creating water',
    placement: { dimension: 'minecraft:the_nether' },
    reference: 'docs/research-environment.md#portals-and-dimensions',
    async run(world) {
      await world.command('setblock ~ ~1 ~ dispenser[facing=east]{Items:[{Slot:0b,id:"minecraft:water_bucket",count:1}]}',
        'setblock ~-1 ~1 ~ redstone_block');
      await world.step(4);
      await world.expect('if block ~1 ~1 ~ air');
      await world.expect('if data block ~ ~1 ~ Items[{Slot:0b,id:"minecraft:bucket",count:1}]');
    },
  }),
  scenario({
    id: 'java.environment.dimension.end-portal-frame-rejected', title: 'An obsidian frame cannot ignite a Nether portal in the End',
    placement: { dimension: 'minecraft:the_end' },
    reference: 'docs/research-environment.md#portals-and-dimensions',
    async run(world) {
      await frame(world);
      await world.command('setblock ~ ~1 ~ fire');
      await world.expect('if block ~-1 ~2 ~ obsidian');
      await world.expect('unless block ~ ~1 ~ nether_portal');
    },
  }),
];
