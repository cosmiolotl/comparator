import assert from 'node:assert/strict';
import minecraftData from 'minecraft-data';
import type { Packet, PacketSession } from '../protocol/session.js';

export interface Item {
  itemCount: number;
  itemId?: number;
  components?: { type: string; data: unknown }[];
}

export class Inventory {
  windowId = 0;
  stateId = 0;
  slots: Item[] = [];
  cursor: Item = { itemCount: 0 };

  constructor(private readonly session: PacketSession) {
    session.observe((packet) => this.receive(packet));
  }

  private receive({ name, data }: Packet): void {
    if (name === 'open_window') {
      this.windowId = Number(data.windowId);
      this.slots = [];
    }
    if (name === 'close_window') this.windowId = 0;
    if (name === 'window_items' && data.windowId === this.windowId) {
      this.slots = data.items as Item[];
      this.cursor = data.carriedItem as Item;
      this.stateId = Number(data.stateId);
    }
    if (name !== 'set_slot') return;
    if (data.windowId === 255) {
      this.cursor = data.item as Item;
      this.stateId = Number(data.stateId);
    } else if (data.windowId === this.windowId) {
      this.slots[Number(data.slot)] = data.item as Item;
      this.stateId = Number(data.stateId);
    }
  }

  click(slot: number, button = 0, mode = 0, stateId = this.stateId): void {
    this.session.write('window_click', {
      windowId: this.windowId, stateId, slot, mouseButton: button, mode,
      changedSlots: [], cursorItem: { itemCount: 0 },
    });
    // The packet predicts an empty cursor; vanilla only sends a correction when it differs.
    this.cursor = { itemCount: 0 };
  }

  expect(slot: number, name: string, count: number): void {
    const item = slot === -1 ? this.cursor : this.slots[slot];
    assert.ok(item, `Missing observed inventory slot ${slot}`);
    assert.equal(item.itemCount, count, `Slot ${slot} ${name} count`);
    if (count > 0) assert.equal(item.itemId, minecraftData('1.21.1').itemsByName[name]?.id, `Slot ${slot} item`);
  }

  count(name: string): number {
    const id = minecraftData('1.21.1').itemsByName[name]?.id;
    return this.slots.reduce((total, item) => total + (item.itemId === id ? item.itemCount : 0), 0)
      + (this.cursor.itemId === id ? this.cursor.itemCount : 0);
  }
}
