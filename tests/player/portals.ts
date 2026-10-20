import assert from 'node:assert/strict';
import type { CaseContext } from '../../src/suite.js';
import type { Player } from '../../src/player/player.js';
import { connectControl } from '../../src/world/fixtures.js';
import { playerScenario } from './scenario.js';

interface Destination { x: number; y: number; z: number }

async function pairedPortals(
  player: Player, context: CaseContext, run: (destination: Destination) => Promise<void>,
): Promise<void> {
  const world = player.world;
  const destination = { x: world.origin.x / 8, y: 80, z: world.origin.z / 8 };
  const { x, y, z } = destination;
  const nether = `execute in minecraft:the_nether positioned ${x}.0 ${y}.0 ${z}.0 run`;
  context.deferCleanup('Nether portal region cleanup', async (signal) => {
    const connection = await connectControl(context.config, signal);
    try {
      await connection.command(`${nether} kill @e[tag=cts_transit_item,distance=..10]`);
      await connection.command(`${nether} fill ~-4 ~-1 ~-4 ~5 ~6 ~4 air`);
    } finally {
      connection.close();
    }
  });
  context.deferCleanup('Nether portal ticket release', async (signal) => {
    const connection = await connectControl(context.config, signal);
    try {
      await connection.command(`${nether} forceload remove ~ ~`);
    } finally {
      connection.close();
    }
  });
  await world.command(`${nether} forceload add ~ ~`);
  while (await world.value(`${nether} execute if loaded ~ ~ ~`) !== 1) context.signal.throwIfAborted();
  await world.command(
    `${nether} fill ~-4 ~-1 ~-4 ~5 ~6 ~4 air`,
    `${nether} fill ~-4 ~ ~-4 ~5 ~ ~4 stone`,
    `${nether} fill ~-1 ~ ~ ~2 ~4 ~ obsidian`,
    `${nether} fill ~ ~1 ~ ~1 ~3 ~ air`,
    `${nether} setblock ~ ~1 ~ fire`,
    'fill ~-4 ~ ~-4 ~5 ~ ~4 stone',
    'fill ~-1 ~ ~ ~2 ~4 ~ obsidian',
    'fill ~ ~1 ~ ~1 ~3 ~ air',
    'setblock ~ ~1 ~ fire',
  );
  await player.teleport(0.5, 1, 3.5);
  await world.expect('if block ~ ~1 ~ nether_portal');
  await world.result(`${nether} execute if block ~ ~1 ~ nether_portal`, 1);
  await run(destination);
}

async function enter(player: Player): Promise<void> {
  await player.teleport(0.5, 1, 1.5);
  player.session.discard('respawn');
  player.session.discard('position');
  const changedDimension = player.session.waitFor('respawn', 'play');
  await player.move(0.5, 1, 0.5);
  await changedDimension;
  await player.session.waitFor('position', 'play');
  await player.fence();
}

async function expectDestination(player: Player, destination: Destination): Promise<void> {
  await player.world.expect(`if entity @a[name=${player.name},nbt={Dimension:"minecraft:the_nether"}]`);
  assert.ok(Math.abs(player.position.x - destination.x) < 3, 'The portal must use the prepared scaled destination');
  assert.ok(Math.abs(player.position.z - destination.z) < 3, 'Portal destination Z must use the one-to-eight scale');
  assert.ok(player.position.y >= destination.y + 1 && player.position.y <= destination.y + 3);
}

export const cases = [
  playerScenario('portal.creative_transit', 'Entering a Nether portal in creative mode uses its scaled counterpart', async (p, context) => {
    await pairedPortals(p, context, async (destination) => {
      await p.world.command(`gamemode creative ${p.name}`);
      await p.held('diamond', 3);
      await enter(p);
      await expectDestination(p, destination);
      await p.world.expect(`if items entity ${p.name} hotbar.0 diamond[count=3]`);
      await p.teleport(0.5, 1, 3.5);
    });
  }),
  playerScenario('portal.survival_cooldown', 'Survival portal travel preserves inventory and prevents an immediate return', async (p, context) => {
    await pairedPortals(p, context, async (destination) => {
      await p.held('diamond', 3);
      await enter(p);
      await expectDestination(p, destination);
      const cooldown = await p.world.value(`data get entity ${p.name} PortalCooldown`);
      assert.ok(cooldown > 0 && cooldown <= 300, 'Portal travel starts a positive bounded cooldown');
      await p.world.command(`gamemode creative ${p.name}`);
      const arrival = { ...p.position };
      for (const offset of [2, 0]) {
        p.position = { ...arrival, z: arrival.z + offset };
        p.session.write('position', { ...p.position, onGround: true });
        await p.fence();
      }
      await p.world.step(2);
      await expectDestination(p, destination);
      await p.world.expect(`if items entity ${p.name} hotbar.0 diamond[count=3]`);
      p.position = { ...arrival, z: arrival.z + 2 };
      p.session.write('position', { ...p.position, onGround: true });
      await p.fence();
      await p.world.command('tick rate 1000');
      await p.world.step(300);
      await p.world.result(`data get entity ${p.name} PortalCooldown`, 0);
      await p.world.command('tick rate 20');
      p.session.discard('respawn');
      p.session.discard('position');
      const returned = p.session.waitFor('respawn', 'play');
      p.position = arrival;
      p.session.write('position', { ...p.position, onGround: true });
      await returned;
      await p.session.waitFor('position', 'play');
      await p.fence();
      await p.world.expect(`if entity @a[name=${p.name},nbt={Dimension:"minecraft:overworld"}]`);
      assert.ok(Math.abs(p.position.x - p.world.origin.x) < 3);
      assert.ok(Math.abs(p.position.z - p.world.origin.z) < 3);
      await p.world.expect(`if items entity ${p.name} hotbar.0 diamond[count=3]`);
      await p.teleport(0.5, 1, 3.5);
    });
  }),
  playerScenario('portal.item_transit', 'A dropped item travels through the portal without duplication or component loss', async (p, context) => {
    await pairedPortals(p, context, async ({ x, y, z }) => {
      await p.world.command('summon item ~0.5 ~1 ~1.2 {Tags:["cts_transit_item"],NoGravity:1b,Motion:[0d,0d,-0.2d],PickupDelay:32767s,Item:{id:"minecraft:diamond",count:3,components:{"minecraft:custom_data":{sentinel:71}}}}');
      await p.world.expect('if entity @e[tag=cts_transit_item,distance=..8]');
      await p.world.step(3);
      await p.world.expect('unless entity @e[tag=cts_transit_item,distance=..8]');
      const destination = `execute in minecraft:the_nether positioned ${x - 1}.0 ${y}.0 ${z - 1}.0 run`;
      await p.world.result(`${destination} execute if entity @e[tag=cts_transit_item,dx=4,dy=4,dz=4,nbt={Item:{id:"minecraft:diamond",count:3,components:{"minecraft:custom_data":{sentinel:71}}}}]`, 1);
      await p.world.result('execute in minecraft:the_nether if entity @e[tag=cts_transit_item]', 1);
    });
  }),
];
