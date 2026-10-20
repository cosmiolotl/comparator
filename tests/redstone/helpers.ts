import { scenario } from '../../src/world/scenario.js';

export type RedstoneWorld = Parameters<Parameters<typeof scenario>[0]['run']>[0];

export function redstoneCase(
  id: string,
  title: string,
  run: (world: RedstoneWorld) => Promise<void>,
) {
  return scenario({
    id: `java.redstone.${id}`,
    title,
    reference: `docs/research-redstone.md#${id.split('.')[0]}`,
    run,
  });
}

export function position(x: number, y = 0, z = 0): string {
  return `~${x} ~${y} ~${z}`;
}

export async function comparatorInput(
  world: RedstoneWorld,
  strength: number,
  side: 'rear' | 'north' | 'south',
): Promise<void> {
  if (strength === 0) return;
  const wireLength = 16 - strength;
  const coordinates = (distance: number) => {
    if (side === 'rear') return position(-distance);
    return position(0, 0, side === 'north' ? -distance : distance);
  };
  for (let distance = 1; distance <= wireLength; distance++) {
    await world.command(`setblock ${coordinates(distance)} minecraft:redstone_wire`);
  }
  await world.command(`setblock ${coordinates(wireLength + 1)} minecraft:redstone_block`);
}
