import { position, redstoneCase } from './helpers.js';

const directions = [
  { name: 'east', x: 1, y: 0, z: 0 },
  { name: 'west', x: -1, y: 0, z: 0 },
  { name: 'north', x: 0, y: 0, z: -1 },
  { name: 'south', x: 0, y: 0, z: 1 },
  { name: 'up', x: 0, y: 1, z: 0 },
  { name: 'down', x: 0, y: -1, z: 0 },
].map(({ name, x, y, z }) => redstoneCase(`piston.extension-${name}`, `A ${name}-facing piston moves its block and clears its head on retraction`, async (world) => {
  const head = position(x, 3 + y, z);
  const destination = position(x * 2, 3 + y * 2, z * 2);
  const power = position(0, name === 'down' ? 4 : 2);
  await world.command(`setblock ~ ~3 ~ minecraft:piston[facing=${name}]`, `setblock ${head} minecraft:stone`, `setblock ${power} minecraft:redstone_block`);
  await world.step(4);
  await world.expect(`if block ~ ~3 ~ minecraft:piston[extended=true,facing=${name}]`);
  await world.expect(`if block ${head} minecraft:piston_head[facing=${name},type=normal]`);
  await world.expect(`if block ${destination} minecraft:stone`);
  await world.command(`setblock ${power} minecraft:air`);
  await world.step(4);
  await world.expect('if block ~ ~3 ~ minecraft:piston[extended=false]');
  await world.expect(`if block ${head} minecraft:air`);
  await world.expect(`if block ${destination} minecraft:stone`);
}));

const limits = [1, 12, 13].map((count) => redstoneCase(`piston.push-limit-${count}`, `A piston ${count <= 12 ? 'moves' : 'rejects'} a line of ${count} blocks`, async (world) => {
  await world.command('setblock ~ ~ ~ minecraft:piston[facing=east]', `fill ~1 ~ ~ ~${count} ~ ~ minecraft:stone`, 'setblock ~-1 ~ ~ minecraft:redstone_block');
  await world.step(4);
  await world.expect(`if block ~ ~ ~ minecraft:piston[extended=${count <= 12}]`);
  await world.expect(`if block ~${count + 1} ~ ~ minecraft:${count <= 12 ? 'stone' : 'air'}`);
  await world.expect(`if block ~1 ~ ~ minecraft:${count <= 12 ? 'piston_head' : 'stone'}`);
}));

const immovable = [
  'obsidian', 'crying_obsidian', 'bedrock', 'chest',
  'furnace', 'enchanting_table', 'ender_chest', 'respawn_anchor',
].map((block) => redstoneCase(`piston.immovable-${block}`, `A piston cannot move ${block}`, async (world) => {
  await world.command('setblock ~ ~ ~ minecraft:piston[facing=east]', `setblock ~1 ~ ~ minecraft:${block}`, 'setblock ~-1 ~ ~ minecraft:redstone_block');
  await world.step(4);
  await world.expect('if block ~ ~ ~ minecraft:piston[extended=false]');
  await world.expect(`if block ~1 ~ ~ minecraft:${block}`);
  await world.expect('if block ~2 ~ ~ minecraft:air');
}));

const adhesion = [
  { adhesive: 'slime_block', neighbor: 'stone', moves: true },
  { adhesive: 'slime_block', neighbor: 'honey_block', moves: false },
  { adhesive: 'slime_block', neighbor: 'white_glazed_terracotta', moves: false },
  { adhesive: 'honey_block', neighbor: 'stone', moves: true },
].map(({ adhesive, neighbor, moves }) => redstoneCase(`piston.adhesion-${adhesive}-${neighbor}`, `${adhesive} ${moves ? 'carries' : 'does not carry'} an adjacent ${neighbor}`, async (world) => {
  await world.command(
    'setblock ~ ~3 ~ minecraft:piston[facing=east]',
    `setblock ~1 ~3 ~ minecraft:${adhesive}`,
    `setblock ~1 ~3 ~1 minecraft:${neighbor}`,
    'setblock ~ ~2 ~ minecraft:redstone_block',
  );
  await world.step(4);
  await world.expect('if block ~ ~3 ~ minecraft:piston[extended=true]');
  await world.expect(`if block ~2 ~3 ~ minecraft:${adhesive}`);
  await world.expect(`if block ~${moves ? 2 : 1} ~3 ~1 minecraft:${neighbor}`);
  await world.expect(`if block ~${moves ? 1 : 2} ~3 ~1 minecraft:air`);
}));

export const cases = [
  ...directions,
  ...limits,
  ...immovable,
  ...adhesion,
  ...['piston', 'sticky_piston'].map((block) => redstoneCase(`piston.retraction-${block}`, `${block} ${block === 'sticky_piston' ? 'pulls' : 'leaves'} the moved block after a sustained pulse`, async (world) => {
    await world.command(`setblock ~ ~ ~ minecraft:${block}[facing=east]`, 'setblock ~1 ~ ~ minecraft:stone', 'setblock ~-1 ~ ~ minecraft:redstone_block');
    await world.step(5);
    await world.expect('if block ~2 ~ ~ minecraft:stone');
    await world.command('setblock ~-1 ~ ~ minecraft:air');
    await world.step(4);
    await world.expect(`if block ~ ~ ~ minecraft:${block}[extended=false]`);
    const destination = block === 'sticky_piston' ? 1 : 2;
    await world.expect(`if block ~${destination} ~ ~ minecraft:stone`);
    await world.expect(`if block ~${3 - destination} ~ ~ minecraft:air`);
  })),
  redstoneCase('piston.sticky-cannot-pull-obsidian', 'A sticky piston retracts without pulling an immovable replacement', async (world) => {
    await world.command('setblock ~ ~ ~ minecraft:sticky_piston[facing=east]', 'setblock ~1 ~ ~ minecraft:stone', 'setblock ~-1 ~ ~ minecraft:redstone_block');
    await world.step(5);
    await world.command('setblock ~2 ~ ~ minecraft:obsidian', 'setblock ~-1 ~ ~ minecraft:air');
    await world.step(4);
    await world.expect('if block ~ ~ ~ minecraft:sticky_piston[extended=false]');
    await world.expect('if block ~1 ~ ~ minecraft:air');
    await world.expect('if block ~2 ~ ~ minecraft:obsidian');
  }),
  redstoneCase('piston.quasi-connectivity-needs-update', 'Quasi-connected power extends a piston only when a neighbor notifies it', async (world) => {
    await world.command('setblock ~ ~3 ~ minecraft:piston[facing=east]', 'setblock ~ ~5 ~ minecraft:redstone_block');
    await world.step(4);
    await world.expect('if block ~ ~3 ~ minecraft:piston[extended=false]');
    await world.command('setblock ~ ~3 ~1 minecraft:stone');
    await world.step(4);
    await world.expect('if block ~ ~3 ~ minecraft:piston[extended=true]');
  }),
  redstoneCase('piston.quasi-connectivity-removal', 'Removing quasi-connected power leaves a piston extended until a neighbor update', async (world) => {
    await world.command('setblock ~ ~5 ~ minecraft:redstone_block', 'setblock ~ ~3 ~ minecraft:piston[facing=east]');
    await world.step(4);
    await world.expect('if block ~ ~3 ~ minecraft:piston[extended=true]');
    await world.command('setblock ~ ~5 ~ minecraft:air');
    await world.step(4);
    await world.expect('if block ~ ~3 ~ minecraft:piston[extended=true]');
    await world.command('setblock ~ ~3 ~1 minecraft:stone');
    await world.step(4);
    await world.expect('if block ~ ~3 ~ minecraft:piston[extended=false]');
  }),
  redstoneCase('piston.front-power-ignored', 'A piston does not take power from its moving face', async (world) => {
    await world.command('setblock ~ ~3 ~ minecraft:piston[facing=east]', 'setblock ~1 ~3 ~ minecraft:redstone_block');
    await world.step(4);
    await world.expect('if block ~ ~3 ~ minecraft:piston[extended=false]');
    await world.expect('if block ~1 ~3 ~ minecraft:redstone_block');
  }),
  redstoneCase('piston.branch-push-limit', 'Thirteen attached slime blocks exceed the total piston movement limit', async (world) => {
    await world.command('setblock ~ ~3 ~ minecraft:piston[facing=east]', 'fill ~1 ~3 ~ ~1 ~3 ~12 minecraft:slime_block', 'setblock ~ ~2 ~ minecraft:redstone_block');
    await world.step(4);
    await world.expect('if block ~ ~3 ~ minecraft:piston[extended=false]');
    await world.expect('if block ~1 ~3 ~12 minecraft:slime_block');
    await world.expect('if block ~2 ~3 ~ minecraft:air');
  }),
];
