import { redstoneCase } from './helpers.js';

const instruments = [
  { support: 'dirt', instrument: 'harp' },
  { support: 'stone', instrument: 'basedrum' },
  { support: 'sand', instrument: 'snare' },
  { support: 'glass', instrument: 'hat' },
  { support: 'oak_planks', instrument: 'bass' },
  { support: 'clay', instrument: 'flute' },
  { support: 'gold_block', instrument: 'bell' },
  { support: 'packed_ice', instrument: 'chime' },
  { support: 'white_wool', instrument: 'guitar' },
  { support: 'bone_block', instrument: 'xylophone' },
  { support: 'iron_block', instrument: 'iron_xylophone' },
  { support: 'soul_sand', instrument: 'cow_bell' },
  { support: 'pumpkin', instrument: 'didgeridoo' },
  { support: 'emerald_block', instrument: 'bit' },
  { support: 'hay_block', instrument: 'banjo' },
  { support: 'glowstone', instrument: 'pling' },
];

export const cases = instruments.map(({ support, instrument }) =>
  redstoneCase(`note.instrument-${instrument}`, `Changing note block support to ${support} selects ${instrument}`, async (world) => {
    await world.command('setblock ~ ~-1 ~ minecraft:barrier', 'setblock ~ ~ ~ minecraft:note_block', `setblock ~ ~-1 ~ minecraft:${support}`);
    await world.expect(`if block ~ ~ ~ minecraft:note_block[instrument=${instrument}]`);
  }),
);
