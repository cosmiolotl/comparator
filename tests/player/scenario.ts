import type { ConformanceCase, CaseContext } from '../../src/suite.js';
import { Player } from '../../src/player/player.js';

export function playerScenario(
  id: string, title: string, run: (player: Player, context: CaseContext) => Promise<void>,
): ConformanceCase {
  return {
    id: `java.player.${id}`, title, requires: ['world', 'login', 'play'], versions: ['1.21.1'],
    reference: 'docs/research-player.md#player-input',
    async run(context) {
      const player = await Player.join(context);
      await run(player, context);
      player.world.verifyAssertions();
    },
  };
}
