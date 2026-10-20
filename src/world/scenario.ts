import type { ConformanceCase } from '../suite.js';
import type { World } from './world.js';

interface Scenario {
  id: string;
  title: string;
  reference: string;
  run(world: World): Promise<void>;
}

export function scenario(definition: Scenario): ConformanceCase {
  return {
    ...definition,
    requires: ['world'],
    versions: ['1.21.1'],
    async run({ world }) {
      if (!world) throw new Error('This case requires the controlled world fixture');
      await definition.run(world);
      world.verifyAssertions();
    },
  };
}
