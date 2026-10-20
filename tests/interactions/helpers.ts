import { scenario } from '../../src/world/scenario.js';
import type { World } from '../../src/world/world.js';
import type { WorldPlacement } from '../../src/suite.js';

export function interactionCase(id: string, title: string, run: (world: World) => Promise<void>, placement?: WorldPlacement) {
  return scenario({
    id: `java.interactions.${id}`,
    title,
    reference: `docs/research-interactions.md#${id.split('.')[0]}`,
    run,
    ...(placement ? { placement } : {}),
  });
}

export function position(x: number, y = 0, z = 0): string {
  return `~${x} ~${y} ~${z}`;
}
