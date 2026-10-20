import assert from 'node:assert/strict';
import { Player } from '../../src/player/player.js';
import type { ConformanceCase } from '../../src/suite.js';

export const cases: ConformanceCase[] = ['clean', 'crash'].flatMap((mode) => [
  {
    id: `java.persistence.${mode}.player-inventories`,
    title: `Player inventory, offhand, and ender chest survive ${mode} restart`,
    requires: mode === 'clean' ? ['world', 'login', 'play', 'restart'] : ['world', 'login', 'play', 'restart', 'crashRecovery'],
    versions: ['1.21.1'],
    reference: 'docs/research-persistence.md#player-data',
    async run(context) {
      const { world, restart } = context;
      assert.ok(world && restart);
      const player = await Player.join(context);
      await world.command(
        `item replace entity ${player.name} hotbar.0 with diamond_sword[damage=19,custom_data={saved:7}]`,
        `item replace entity ${player.name} weapon.offhand with shield[damage=8]`,
        `item replace entity ${player.name} enderchest.7 with diamond[custom_data={vault:31}] 23`,
      );
      await player.fence();
      await world.expect(`if items entity ${player.name} hotbar.0 diamond_sword[damage=19,custom_data={saved:7}]`);
      player.session.close();
      await world.expectEventually(`unless entity ${player.name}`);
      await world.command('tick rate 1000');
      await world.step(40);
      await restart(mode === 'clean' ? 'clean' : 'crash');
      // Reconnect without Player.join: its normal fixture reset deliberately clears inventories.
      // Login expires after 600 server ticks even while the world is frozen.
      await world.command('tick rate 20');
      const rejoined = new Player(context, player.name);
      await rejoined.session.waitFor('login', 'play');
      await rejoined.session.waitFor('position', 'play');
      await rejoined.fence();
      await world.expect(`if items entity ${player.name} hotbar.0 diamond_sword[damage=19,custom_data={saved:7}]`);
      await world.expect(`if items entity ${player.name} weapon.offhand shield[damage=8]`);
      await world.expect(`if items entity ${player.name} enderchest.7 diamond[count=23,custom_data={vault:31}]`);
      await world.result(`execute if items entity ${player.name} inventory.* diamond`, 0);
    },
  },
  {
    id: `java.persistence.${mode}.player-position-experience`,
    title: `Player position, game mode, experience, and spawn point survive ${mode} restart`,
    requires: mode === 'clean' ? ['world', 'login', 'play', 'restart'] : ['world', 'login', 'play', 'restart', 'crashRecovery'],
    versions: ['1.21.1'],
    reference: 'docs/research-persistence.md#player-data',
    async run(context) {
      const { world, restart } = context;
      assert.ok(world && restart);
      const player = await Player.join(context);
      await world.command(`gamemode creative ${player.name}`, `experience set ${player.name} 17 levels`,
        `experience set ${player.name} 3 points`, `spawnpoint ${player.name} ~2 ~ ~2`);
      await player.teleport(1.5, 0, 4.5);
      player.session.close();
      await world.expectEventually(`unless entity ${player.name}`);
      await world.command('tick rate 1000');
      await world.step(40);
      await restart(mode === 'clean' ? 'clean' : 'crash');
      await world.command('tick rate 20');
      const rejoined = new Player(context, player.name);
      await rejoined.session.waitFor('login', 'play');
      await rejoined.session.waitFor('position', 'play');
      await rejoined.fence();
      assert.equal(rejoined.position.x, world.origin.x + 1.5);
      assert.equal(rejoined.position.y, world.origin.y);
      assert.equal(rejoined.position.z, world.origin.z + 4.5);
      await world.result(`experience query ${player.name} levels`, 17);
      await world.result(`experience query ${player.name} points`, 3);
      await world.expect(`if entity @a[name=${player.name},gamemode=creative]`);
      await world.expect(`if entity @a[name=${player.name},nbt={SpawnX:${world.origin.x + 2},SpawnY:${world.origin.y},SpawnZ:${world.origin.z + 2},SpawnDimension:"minecraft:overworld"}]`);
    },
  },
]);
