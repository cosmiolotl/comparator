import { scenario } from '../../src/world/scenario.js';
import type { World } from '../../src/world/world.js';

function lightCondition(position: string, level: number): string {
  const [x, y, z] = position.split(' ').map(Number);
  return `if predicate {condition:"minecraft:location_check",offsetX:${x},offsetY:${y},offsetZ:${z},predicate:{light:{light:${level}}}}`;
}

async function chamber(world: World): Promise<void> {
  await world.command('fill ~-4 ~ ~-4 ~12 ~8 ~4 stone', 'fill ~-3 ~1 ~-3 ~11 ~7 ~3 air');
  await world.step(1);
  await world.expectEventually(lightCondition('0 2 0', 0));
}

export const cases = [
  ...[
    { id: 'torch-source', source: 'torch', offset: 0, light: 14 },
    { id: 'torch-attenuation', source: 'torch', offset: 3, light: 11 },
    { id: 'soul-torch', source: 'soul_torch', offset: 2, light: 8 },
    { id: 'sea-lantern', source: 'sea_lantern', offset: 4, light: 11 },
    { id: 'glowstone', source: 'glowstone', offset: 1, light: 14 },
  ].map(({ id, source, offset, light }) => scenario({
    id: `java.environment.light.${id}`,
    title: `${source} produces light ${light} at distance ${offset} in an enclosed chamber`,
    reference: 'docs/research-environment.md#lighting',
    async run(world) {
      await chamber(world);
      await world.command('setblock ~ ~1 ~ stone', `setblock ~ ~2 ~ ${source}`);
      await world.step(1);
      await world.expectEventually(lightCondition(`${offset} 2 0`, light));
    },
  })),
  scenario({
    id: 'java.environment.light.removal', title: 'Removing the only emitter removes its propagated light',
    reference: 'docs/research-environment.md#lighting',
    async run(world) {
      await chamber(world);
      await world.command('setblock ~ ~2 ~ sea_lantern');
      await world.step(1);
      await world.expectEventually(lightCondition('2 2 0', 13));
      await world.command('setblock ~ ~2 ~ air');
      await world.step(1);
      await world.expectEventually(lightCondition('2 2 0', 0));
    },
  }),
  scenario({
    id: 'java.environment.light.solid-barrier', title: 'A complete opaque partition blocks emitted light',
    reference: 'docs/research-environment.md#lighting',
    async run(world) {
      await chamber(world);
      await world.command('setblock ~ ~2 ~ sea_lantern');
      await world.step(1);
      await world.expectEventually(lightCondition('2 2 0', 13));
      await world.command('fill ~1 ~1 ~-3 ~1 ~7 ~3 stone');
      await world.step(1);
      await world.expectEventually(lightCondition('0 2 0', 15));
      await world.expectEventually(lightCondition('2 2 0', 0));
    },
  }),
  scenario({
    id: 'java.environment.light.glass-barrier', title: 'A glass partition transmits emitted light',
    reference: 'docs/research-environment.md#lighting',
    async run(world) {
      await chamber(world);
      await world.command('setblock ~ ~2 ~ sea_lantern', 'fill ~1 ~1 ~-3 ~1 ~7 ~3 glass');
      await world.step(1);
      await world.expectEventually(lightCondition('2 2 0', 13));
    },
  }),
];
