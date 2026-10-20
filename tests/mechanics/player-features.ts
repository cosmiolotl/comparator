import type { CaseContext, ConformanceCase } from '../../src/suite.js';
import { Player } from '../../src/player/player.js';

export function featureCase(
  id: string, title: string, section: string,
  run: (player: Player, context: CaseContext) => Promise<void>,
): ConformanceCase {
  return {
    id: `java.mechanics.${id}`, title, requires: ['world', 'login', 'play'], versions: ['1.21.1'],
    reference: `docs/research-mechanics.md#${section}`,
    async run(context) {
      const player = await Player.join(context);
      await run(player, context);
      player.world.verifyAssertions();
    },
  };
}
