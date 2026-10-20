import { interactionCase } from './helpers.js';

export const cases = [
  interactionCase('fluids.remove-water-before-first-flow', 'Removing a source before its fluid tick prevents the pending flow', async (world) => {
    await world.command('setblock ~ ~1 ~ water');
    await world.step(4);
    await world.command('setblock ~ ~1 ~ air');
    await world.step(6);
    await world.expect('if block ~ ~1 ~ air if block ~ ~ ~ air if block ~1 ~ ~ air');
  }),
  interactionCase('fluids.replace-water-before-first-flow', 'A scheduled water tick leaves a stone replacement intact', async (world) => {
    await world.command('setblock ~ ~1 ~ water');
    await world.step(4);
    await world.command('setblock ~ ~1 ~ stone');
    await world.step(6);
    await world.expect('if block ~ ~1 ~ stone if block ~ ~ ~ air');
  }),
  interactionCase('fluids.same-fluid-replacement', 'Replacing water at the same position retains its earlier scheduled fluid tick', async (world) => {
    await world.command('setblock ~ ~1 ~ water');
    await world.step(3);
    await world.command('setblock ~ ~1 ~ air', 'setblock ~ ~1 ~ water');
    await world.step(1);
    await world.expect('if block ~ ~ ~ air');
    await world.step(1);
    await world.expect('if block ~ ~ ~ water[level=8]');
  }),
  interactionCase('fluids.source-removal-drains-channel', 'Flowing water drains after its sole upstream source is removed', async (world) => {
    await world.command('fill ~-1 ~ ~-1 ~7 ~1 ~1 stone', 'fill ~ ~ ~ ~6 ~ ~ air', 'setblock ~ ~ ~ water');
    await world.step(35);
    await world.expect('if block ~5 ~ ~ water[level=5]');
    await world.command('setblock ~ ~ ~ air');
    await world.step(80);
    await world.expect('if block ~ ~ ~ air if block ~3 ~ ~ air if block ~6 ~ ~ air');
  }),
  ...[false, true].map((waterFirst) => interactionCase(
    `fluids.contact-order-${waterFirst ? 'water-first' : 'lava-first'}`,
    `Source water and source lava form obsidian when ${waterFirst ? 'water' : 'lava'} is placed first`,
    async (world) => {
      const water = 'setblock ~1 ~ ~ water';
      const lava = 'setblock ~ ~ ~ lava';
      await world.command(...(waterFirst ? [water, lava] : [lava, water]));
      await world.expect('if block ~ ~ ~ obsidian if block ~1 ~ ~ water[level=0]');
    },
  )),
  interactionCase('fluids.lava-flows-down-into-water', 'Lava flowing downward into water forms stone instead of obsidian', async (world) => {
    await world.command('setblock ~ ~ ~ water', 'setblock ~ ~1 ~ lava');
    await world.step(30);
    await world.expect('if block ~ ~ ~ stone if block ~ ~1 ~ lava[level=0]');
  }),
  interactionCase('fluids.waterlogged-source-contact', 'Water inside a slab hardens an adjacent lava source', async (world) => {
    await world.command('setblock ~1 ~ ~ oak_slab[type=bottom,waterlogged=true]', 'setblock ~ ~ ~ lava');
    await world.expect('if block ~ ~ ~ obsidian if block ~1 ~ ~ oak_slab[waterlogged=true]');
  }),
  interactionCase('fluids.flow-breaks-dust', 'Water breaks redstone dust and produces one dust item', async (world) => {
    await world.command('setblock ~1 ~ ~ redstone_wire', 'setblock ~ ~ ~ water');
    await world.step(5);
    await world.expect('if block ~1 ~ ~ water[level=1]');
    await world.expect('if entity @e[type=item,nbt={Item:{id:"minecraft:redstone",count:1}},distance=..5]');
  }),
  interactionCase('fluids.closed-gate-blocks-flow', 'Water cannot cross a closed fence gate', async (world) => {
    await world.command('fill ~-1 ~ ~-1 ~4 ~1 ~1 stone', 'fill ~ ~ ~ ~3 ~ ~ air',
      'setblock ~1 ~ ~ oak_fence_gate[facing=east,open=false]', 'setblock ~ ~ ~ water');
    await world.step(25);
    await world.expect('if block ~1 ~ ~ oak_fence_gate[open=false] if block ~2 ~ ~ air');
  }),
  interactionCase('fluids.open-gate-still-blocks-flow', 'An open fence gate still blocks water flow', async (world) => {
    await world.command('fill ~-1 ~ ~-1 ~4 ~1 ~1 stone', 'fill ~ ~ ~ ~3 ~ ~ air',
      'setblock ~1 ~ ~ oak_fence_gate[facing=east,open=true]', 'setblock ~ ~ ~ water');
    await world.step(25);
    await world.expect('if block ~1 ~ ~ oak_fence_gate[open=true] if block ~2 ~ ~ air');
  }),
  interactionCase('fluids.bubble-column-base-swap', 'Replacing soul sand with magma reverses an existing bubble column', async (world) => {
    await world.command('setblock ~ ~-1 ~ soul_sand', 'fill ~ ~ ~ ~ ~4 ~ water');
    await world.step(25);
    await world.expect('if block ~ ~3 ~ bubble_column[drag=false]');
    await world.command('setblock ~ ~-1 ~ magma_block');
    await world.step(25);
    await world.expect('if block ~ ~3 ~ bubble_column[drag=true]');
  }),
  interactionCase('fluids.bubble-column-obstruction', 'A solid obstruction breaks the bubble column above it while preserving the lower column', async (world) => {
    await world.command('setblock ~ ~-1 ~ soul_sand', 'fill ~ ~ ~ ~ ~4 ~ water');
    await world.step(25);
    await world.expect('if block ~ ~3 ~ bubble_column[drag=false]');
    await world.command('setblock ~ ~2 ~ stone');
    await world.step(25);
    await world.expect('if block ~ ~1 ~ bubble_column[drag=false] if block ~ ~2 ~ stone if block ~ ~3 ~ water[level=0]');
  }),
];
