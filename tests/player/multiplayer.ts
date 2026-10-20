import assert from 'node:assert/strict';
import { Player } from '../../src/player/player.js';
import { playerScenario } from './scenario.js';

function slotChange(player: Player, slot: number, count: number): Promise<unknown> {
  return player.session.waitFor('set_slot', 'play', ({ data }) => {
    return data.windowId === player.inventory.windowId && data.slot === slot
      && (data.item as { itemCount: number }).itemCount === count;
  });
}

export const cases = [
  playerScenario('multiplayer.shared_container', 'Two open chest views synchronize after one player takes a stack', async (p, context) => {
    const q = await Player.join(context, 'B');
    await p.world.command('setblock ~ ~ ~ chest{Items:[{Slot:0b,id:"minecraft:apple",count:7}]}');
    await p.open();
    await q.open();
    const changed = slotChange(q, 0, 0);
    await p.click(0);
    await changed;
    q.inventory.expect(0, 'air', 0);
    q.inventory.expect(-1, 'air', 0);
    p.inventory.expect(-1, 'apple', 7);
    await p.world.expect('unless data block ~ ~ ~ Items[0]');
  }),
  playerScenario('multiplayer.last_item', 'Competing clicks on the final item conserve exactly one item', async (p, context) => {
    const q = await Player.join(context, 'B');
    await p.world.command('setblock ~ ~ ~ chest{Items:[{Slot:0b,id:"minecraft:diamond",count:1}]}');
    await p.open();
    await q.open();
    const changed = [slotChange(p, 0, 0), slotChange(q, 0, 0)];
    p.inventory.click(0);
    q.inventory.click(0);
    await Promise.all([p.fence(), q.fence(), ...changed]);
    assert.equal(p.inventory.cursor.itemCount + q.inventory.cursor.itemCount, 1);
    assert.equal(p.inventory.count('diamond') + q.inventory.count('diamond'), 1);
    await p.world.expect('unless data block ~ ~ ~ Items[0]');
    await p.closeContainer();
    await q.closeContainer();
    const heldByFirst = await p.world.value(`clear ${p.name} diamond 0`);
    const heldBySecond = await p.world.value(`clear ${q.name} diamond 0`);
    assert.equal(heldByFirst + heldBySecond, 1, 'The authoritative inventories must conserve one diamond');
    await p.world.expect('unless entity @e[type=item,distance=..80,nbt={Item:{id:"minecraft:diamond"}}]');
  }),
  playerScenario('multiplayer.hopper_mutation', 'A hopper extraction updates both clients viewing its source chest', async (p, context) => {
    const q = await Player.join(context, 'B');
    await p.world.command('setblock ~ ~ ~ chest{Items:[{Slot:0b,id:"minecraft:apple",count:2}]}',
      'setblock ~ ~-1 ~ hopper[facing=down]{TransferCooldown:0}');
    await p.open();
    await q.open();
    const changed = [slotChange(p, 0, 1), slotChange(q, 0, 1)];
    await p.world.step(1);
    await Promise.all(changed);
    p.inventory.expect(0, 'apple', 1);
    q.inventory.expect(0, 'apple', 1);
    await p.world.expect('if data block ~ ~-1 ~ Items[{Slot:0b,id:"minecraft:apple",count:1}]');
  }),
  playerScenario('multiplayer.break_open_container', 'Breaking an open chest closes both menus and drops its contents once', async (p, context) => {
    const q = await Player.join(context, 'B');
    await p.world.command('setblock ~ ~ ~ chest{Items:[{Slot:0b,id:"minecraft:diamond",count:3}]}');
    await p.open();
    await q.open();
    const closed = [p.session.waitFor('close_window', 'play'), q.session.waitFor('close_window', 'play')];
    await p.world.command('setblock ~ ~ ~ air destroy');
    await Promise.all(closed);
    assert.equal(p.inventory.windowId, 0);
    assert.equal(q.inventory.windowId, 0);
    await p.world.expect('if entity @e[type=item,distance=..3,nbt={Item:{id:"minecraft:diamond",count:3}}]');
    await p.world.result('execute if entity @e[type=item,distance=..3,nbt={Item:{id:"minecraft:diamond"}}]', 1);
  }),
  playerScenario('multiplayer.independent_cursors', 'A player cursor remains private while the other viewer deposits items', async (p, context) => {
    const q = await Player.join(context, 'B');
    await q.held('diamond', 2);
    await p.world.command('setblock ~ ~ ~ chest{Items:[{Slot:0b,id:"minecraft:apple",count:7}]}');
    await p.open();
    await q.open();
    await p.click(0);
    await q.click(54);
    const changed = slotChange(p, 1, 2);
    await q.click(1);
    await changed;
    p.inventory.expect(-1, 'apple', 7);
    q.inventory.expect(-1, 'air', 0);
    p.inventory.expect(1, 'diamond', 2);
    await p.world.expect('if data block ~ ~ ~ Items[{Slot:1b,id:"minecraft:diamond",count:2}]');
  }),
  playerScenario('multiplayer.ender_inventory', 'Ender chest contents remain private to each player', async (p, context) => {
    const q = await Player.join(context, 'B');
    await p.held('diamond', 2);
    await p.world.command('setblock ~ ~ ~ ender_chest');
    await p.open();
    await p.click(54, 0, 1);
    await p.closeContainer();
    await q.open();
    q.inventory.expect(0, 'air', 0);
    assert.equal(q.inventory.count('diamond'), 0);
    await p.world.expect(`if data entity ${p.name} EnderItems[{Slot:0b,id:"minecraft:diamond",count:2}]`);
    await p.world.expect(`unless data entity ${q.name} EnderItems[0]`);
  }),
  playerScenario('inventory.disconnect_cursor', 'Disconnect drops a cursor stack without duplicating it into reloaded player data', async (p, context) => {
    await p.world.command('setblock ~ ~ ~ chest{Items:[{Slot:0b,id:"minecraft:apple",count:7}]}');
    await p.open();
    await p.click(0);
    p.session.close();
    while (await p.world.value(`execute if entity ${p.name}`) !== 0) context.signal.throwIfAborted();
    const resumed = new Player(context, p.name);
    await resumed.session.waitFor('login', 'play');
    await resumed.session.waitFor('position', 'play');
    await resumed.fence();
    await p.world.expect(`unless data entity ${p.name} Inventory[{id:"minecraft:apple"}]`);
    await p.world.expect('if entity @e[type=item,distance=..6,nbt={Item:{id:"minecraft:apple",count:7}}]');
    await p.world.result('execute if entity @e[type=item,distance=..80,nbt={Item:{id:"minecraft:apple"}}]', 1);
    await p.world.expect('unless data block ~ ~ ~ Items[0]');
  }),
];
