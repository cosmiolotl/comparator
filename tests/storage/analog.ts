import { storageCase } from './helpers.js';

interface FullnessCase {
  id: string;
  title: string;
  slots: readonly { item: string; count: number }[];
  signal: number;
}

const fullnessCases: readonly FullnessCase[] = [
  { id: 'empty', title: 'An empty hopper gives a zero comparator signal', slots: [], signal: 0 },
  { id: 'single_item', title: 'A single stackable item produces the minimum nonzero signal', slots: [{ item: 'stone', count: 1 }], signal: 1 },
  { id: 'half_full', title: 'A hopper with every slot half full produces signal eight', slots: Array.from({ length: 5 }, () => ({ item: 'stone', count: 32 })), signal: 8 },
  { id: 'full', title: 'A completely full hopper produces signal fifteen', slots: Array.from({ length: 5 }, () => ({ item: 'stone', count: 64 })), signal: 15 },
  { id: 'unstackable', title: 'Container fullness treats one unstackable item as a full slot', slots: [{ item: 'diamond_sword', count: 1 }], signal: 3 },
  { id: 'custom_stack_size', title: 'Container fullness uses an overridden item stack limit', slots: [{ item: 'stone[max_stack_size=2]', count: 1 }], signal: 2 },
];

export const analogCases = fullnessCases.map(({ id, title, slots, signal }) =>
  storageCase(`analog.${id}`, title, 'container-signals', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:hopper[facing=down]',
      'setblock ~1 ~ ~ minecraft:comparator[facing=west]', 'setblock ~2 ~ ~ minecraft:redstone_wire');
    for (const [slot, { item, count }] of slots.entries()) {
      await world.command(`item replace block ~ ~ ~ container.${slot} with minecraft:${item} ${count}`);
    }
    // Command-filled hopper slots do not notify a neighboring comparator in 1.21.1.
    await world.command('setblock ~1 ~1 ~ minecraft:stone');
    await world.step(4);
    await world.expect(`if block ~2 ~ ~ minecraft:redstone_wire[power=${signal}]`);
    await world.result('data get block ~1 ~ ~ OutputSignal', signal);
  }),
);
