import type { CaseContext, ConformanceCase } from '../../src/suite.js';
import { Player } from '../../src/player/player.js';
import { scenario } from '../../src/world/scenario.js';
import type { World } from '../../src/world/world.js';

export function natureCase(id: string, title: string, run: (world: World) => Promise<void>) {
  return scenario({ id: `java.nature.${id}`, title, reference: `docs/research-nature.md#${id.split('.')[0]}`, run });
}

export function playerNatureCase(
  id: string, title: string, run: (player: Player, context: CaseContext) => Promise<void>,
): ConformanceCase {
  return {
    id: `java.nature.${id}`, title, requires: ['world', 'login', 'play'], versions: ['1.21.1'],
    reference: `docs/research-nature.md#${id.split('.')[0]}`,
    async run(context) {
      const player = await Player.join(context);
      await player.world.command(`gamemode creative ${player.name}`, 'tick rate 1000');
      await run(player, context);
      player.world.verifyAssertions();
    },
  };
}

export async function countEntities(world: World, selector: string, expected: number): Promise<void> {
  await world.command('scoreboard players set #entities cts 0',
    `execute as ${selector} run scoreboard players add #entities cts 1`);
  await world.expect(`if score #entities cts matches ${expected}`);
}
