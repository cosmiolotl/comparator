import { playerNatureCase } from './helpers.js';

const configurations = [
  { id: 'decay', speed: 1, persistent: false, waterlogged: false, count: 4095 },
  { id: 'disabled', speed: 0, persistent: false, waterlogged: false, count: 4096 },
  { id: 'persistent', speed: 1, persistent: true, waterlogged: false, count: 4096 },
  { id: 'waterlogged', speed: 1, persistent: false, waterlogged: true, count: 4095 },
];

export const cases = configurations.map(({ id, speed, persistent, waterlogged, count }) => playerNatureCase(
  `random-ticks.leaves-${id}`, `A complete section of ${id} leaves preserves the exact one-sample decay count`,
  async (player) => {
    const world = player.world;
    await world.command('setblock ~8 ~19 ~8 stone');
    await player.teleport(8.5, 20, 8.5);
    await world.command(`fill ~ ~ ~ ~15 ~15 ~15 oak_leaves[distance=7,persistent=${persistent},waterlogged=${waterlogged}]`);
    try {
      await world.command(`gamerule randomTickSpeed ${speed}`);
      await world.step(1);
      await world.command('gamerule randomTickSpeed 0');
      await world.result('fill ~ ~ ~ ~15 ~15 ~15 stone replace oak_leaves', count);
      if (waterlogged) await world.result('fill ~ ~ ~ ~15 ~15 ~15 glass replace water', 1);
    } finally {
      await world.command('gamerule randomTickSpeed 0');
    }
  },
));
