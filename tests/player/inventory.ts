import assert from 'node:assert/strict';
import { playerScenario } from './scenario.js';
import type { Player } from '../../src/player/player.js';

async function chest(player: Player, items = '{Slot:0b,id:"minecraft:apple",count:7}'): Promise<void> {
  await player.world.command(`setblock ~ ~ ~ chest{Items:[${items}]}`);
  await player.open();
}

export const cases = [
  playerScenario('inventory.pickup', 'Left click picks up the complete stack', async (p) => {
    await chest(p);
    await p.click(0);
    p.inventory.expect(0, 'air', 0);
    p.inventory.expect(-1, 'apple', 7);
    await p.world.expect('unless data block ~ ~ ~ Items[0]');
  }),
  playerScenario('inventory.split', 'Right click splits an odd stack with the larger half on the cursor', async (p) => {
    await chest(p);
    await p.click(0, 1);
    p.inventory.expect(0, 'apple', 3);
    p.inventory.expect(-1, 'apple', 4);
    await p.world.expect('if data block ~ ~ ~ Items[{Slot:0b,count:3}]');
  }),
  playerScenario('inventory.place_one', 'Right click places exactly one cursor item', async (p) => {
    await chest(p);
    await p.click(0);
    await p.click(1, 1);
    p.inventory.expect(1, 'apple', 1);
    p.inventory.expect(-1, 'apple', 6);
    await p.world.expect('if data block ~ ~ ~ Items[{Slot:1b,count:1}]');
  }),
  playerScenario('inventory.merge_limit', 'Click merging stops at the item stack limit', async (p) => {
    await chest(p, '{Slot:0b,id:"minecraft:apple",count:7},{Slot:1b,id:"minecraft:apple",count:60}');
    await p.click(0);
    await p.click(1);
    p.inventory.expect(1, 'apple', 64);
    p.inventory.expect(-1, 'apple', 3);
    await p.world.expect('if data block ~ ~ ~ Items[{Slot:1b,count:64}]');
  }),
  playerScenario('inventory.swap_types', 'Different item types swap between cursor and slot', async (p) => {
    await chest(p, '{Slot:0b,id:"minecraft:apple",count:7},{Slot:1b,id:"minecraft:diamond",count:2}');
    await p.click(0);
    await p.click(1);
    p.inventory.expect(-1, 'diamond', 2);
    p.inventory.expect(1, 'apple', 7);
    await p.world.expect('if data block ~ ~ ~ Items[{Slot:1b,id:"minecraft:apple",count:7}]');
  }),
  playerScenario('inventory.shift_to_player', 'Shift-click transfers a chest stack into the last hotbar slot', async (p) => {
    await chest(p);
    await p.click(0, 0, 1);
    p.inventory.expect(0, 'air', 0);
    p.inventory.expect(62, 'apple', 7);
    await p.world.expect(`if data entity ${p.name} Inventory[{Slot:8b,id:"minecraft:apple",count:7}]`);
  }),
  playerScenario('inventory.shift_to_chest', 'Shift-click merges a player stack before filling an empty chest slot', async (p) => {
    await p.held('apple', 10);
    await chest(p, '{Slot:0b,id:"minecraft:apple",count:60}');
    await p.click(54, 0, 1);
    p.inventory.expect(0, 'apple', 64);
    p.inventory.expect(1, 'apple', 6);
    await p.world.expect(`unless data entity ${p.name} Inventory[{id:"minecraft:apple"}]`);
  }),
  playerScenario('inventory.hotbar_swap', 'Number-key swap exchanges a container slot and selected hotbar slot', async (p) => {
    await p.world.command(`item replace entity ${p.name} hotbar.2 with diamond 2`);
    await chest(p);
    await p.click(0, 2, 2);
    p.inventory.expect(0, 'diamond', 2);
    await p.world.expect(`if data entity ${p.name} Inventory[{Slot:2b,id:"minecraft:apple",count:7}]`);
  }),
  playerScenario('inventory.offhand_swap', 'Offhand swap exchanges the hovered container stack', async (p) => {
    await p.world.command(`item replace entity ${p.name} weapon.offhand with shield`);
    await chest(p);
    await p.click(0, 40, 2);
    p.inventory.expect(0, 'shield', 1);
    await p.world.expect(`if data entity ${p.name} Inventory[{Slot:-106b,id:"minecraft:apple",count:7}]`);
  }),
  playerScenario('inventory.drop_one', 'Drop-key removes one item from a container slot', async (p) => {
    await chest(p);
    await p.click(0, 0, 4);
    p.inventory.expect(0, 'apple', 6);
    await p.world.expect('if entity @e[type=item,distance=..6,nbt={Item:{id:"minecraft:apple",count:1}}]');
  }),
  playerScenario('inventory.drop_stack', 'Control-drop removes the entire container stack', async (p) => {
    await chest(p);
    await p.click(0, 1, 4);
    p.inventory.expect(0, 'air', 0);
    await p.world.expect('if entity @e[type=item,distance=..6,nbt={Item:{id:"minecraft:apple",count:7}}]');
  }),
  playerScenario('inventory.cursor_drop_one', 'Right click outside drops one cursor item', async (p) => {
    await chest(p);
    await p.click(0);
    await p.click(-999, 1);
    p.inventory.expect(-1, 'apple', 6);
    await p.world.expect('if entity @e[type=item,distance=..6,nbt={Item:{id:"minecraft:apple",count:1}}]');
  }),
  playerScenario('inventory.cursor_drop_stack', 'Left click outside drops the complete cursor stack', async (p) => {
    await chest(p);
    await p.click(0);
    await p.click(-999);
    p.inventory.expect(-1, 'air', 0);
    await p.world.expect('if entity @e[type=item,distance=..6,nbt={Item:{id:"minecraft:apple",count:7}}]');
  }),
  playerScenario('inventory.drag_even', 'Left dragging distributes evenly and retains the remainder', async (p) => {
    await chest(p);
    await p.click(0);
    await p.click(-999, 0, 5);
    await p.click(1, 1, 5);
    await p.click(2, 1, 5);
    await p.click(-999, 2, 5);
    p.inventory.expect(1, 'apple', 3);
    p.inventory.expect(2, 'apple', 3);
    p.inventory.expect(-1, 'apple', 1);
    await p.world.result('data get block ~ ~ ~ Items', 2);
  }),
  playerScenario('inventory.drag_single', 'Right dragging deposits one item into each selected slot', async (p) => {
    await chest(p);
    await p.click(0);
    await p.click(-999, 4, 5);
    await p.click(1, 5, 5);
    await p.click(2, 5, 5);
    await p.click(-999, 6, 5);
    p.inventory.expect(1, 'apple', 1);
    p.inventory.expect(2, 'apple', 1);
    p.inventory.expect(-1, 'apple', 5);
    await p.world.result('data get block ~ ~ ~ Items', 2);
  }),
  playerScenario('inventory.double_collect', 'Double click collects matching stacks onto the cursor', async (p) => {
    await chest(p, '{Slot:0b,id:"minecraft:apple",count:1},{Slot:1b,id:"minecraft:apple",count:20},{Slot:2b,id:"minecraft:apple",count:30}');
    await p.click(0);
    await p.click(0, 0, 6);
    p.inventory.expect(-1, 'apple', 51);
    await p.world.expect('unless data block ~ ~ ~ Items[0]');
  }),
  playerScenario('inventory.stale_state', 'A stale inventory state executes the click and sends authoritative contents', async (p) => {
    await chest(p);
    p.session.discard('window_items');
    const resync = p.session.waitFor('window_items', 'play', (packet) => packet.data.windowId === p.inventory.windowId);
    await p.click(0, 0, 0, -1);
    await resync;
    p.inventory.expect(-1, 'apple', 7);
    p.inventory.expect(0, 'air', 0);
    await p.world.expect('unless data block ~ ~ ~ Items[0]');
  }),
  playerScenario('inventory.wrong_window', 'Clicks for another window do not change the open container', async (p) => {
    await chest(p);
    p.session.write('window_click', {
      windowId: p.inventory.windowId + 1, stateId: p.inventory.stateId, slot: 0, mouseButton: 0,
      mode: 0, changedSlots: [], cursorItem: { itemCount: 0 },
    });
    await p.fence();
    p.inventory.expect(0, 'apple', 7);
    p.inventory.expect(-1, 'air', 0);
    await p.world.expect('if data block ~ ~ ~ Items[{Slot:0b,count:7}]');
  }),
  playerScenario('inventory.close_cursor', 'Closing a container returns its cursor stack to player inventory', async (p) => {
    await chest(p);
    await p.click(0);
    await p.closeContainer();
    await p.world.expect(`if data entity ${p.name} Inventory[{id:"minecraft:apple",count:7}]`);
    await p.world.expect('unless data block ~ ~ ~ Items[0]');
  }),
  playerScenario('inventory.survival_clone', 'Survival middle-click cannot clone an item stack', async (p) => {
    await chest(p);
    await p.click(0, 2, 3);
    p.inventory.expect(0, 'apple', 7);
    p.inventory.expect(-1, 'air', 0);
    assert.equal(p.inventory.count('apple'), 7);
    await p.world.expect('if data block ~ ~ ~ Items[{Slot:0b,count:7}]');
  }),
  playerScenario('inventory.component_identity', 'Different custom data prevents click merging', async (p) => {
    await chest(p, '{Slot:0b,id:"minecraft:apple",count:7,components:{"minecraft:custom_data":{variant:1}}},{Slot:1b,id:"minecraft:apple",count:3,components:{"minecraft:custom_data":{variant:2}}}');
    await p.click(0);
    await p.click(1);
    p.inventory.expect(-1, 'apple', 3);
    p.inventory.expect(1, 'apple', 7);
    await p.world.expect('if data block ~ ~ ~ Items[{Slot:1b,components:{"minecraft:custom_data":{variant:1}}}]');
  }),
];
