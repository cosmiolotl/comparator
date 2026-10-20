import { interactionCase } from './helpers.js';

export const cases = [
  ...[1, 2, 3].map((pulse) => interactionCase(
    `pistons.sticky-pulse-${pulse}`, `A sticky piston ${pulse < 3 ? 'drops' : 'retrieves'} its block after a ${pulse}-tick pulse`,
    async (world) => {
      await world.command('setblock ~ ~3 ~ sticky_piston[facing=east]', 'setblock ~1 ~3 ~ stone', 'setblock ~ ~2 ~ redstone_block');
      await world.step(pulse);
      await world.expect('if block ~ ~3 ~ sticky_piston[extended=true]');
      await world.command('setblock ~ ~2 ~ air');
      await world.step(5);
      await world.expect('if block ~ ~3 ~ sticky_piston[extended=false]');
      await world.expect(`if block ~${pulse < 3 ? 2 : 1} ~3 ~ stone if block ~${pulse < 3 ? 1 : 2} ~3 ~ air`);
    },
  )),
  interactionCase('pistons.moving-block-states', 'A moving piston exposes a moving block before its stationary head and pushed block', async (world) => {
    await world.command('setblock ~ ~3 ~ piston[facing=east]', 'setblock ~1 ~3 ~ stone', 'setblock ~ ~2 ~ redstone_block');
    await world.step(1);
    await world.expect('if block ~ ~3 ~ piston[extended=true] if block ~2 ~3 ~ moving_piston');
    await world.expect('if data block ~2 ~3 ~ {extending:1b,blockState:{Name:"minecraft:stone"}}');
    await world.step(3);
    await world.expect('if block ~1 ~3 ~ piston_head if block ~2 ~3 ~ stone');
  }),
  interactionCase('pistons.opposing-heads-block', 'Two powered pistons facing each other cannot push the other extended head', async (world) => {
    await world.command('setblock ~ ~3 ~ piston[facing=east]', 'setblock ~3 ~3 ~ piston[facing=west]',
      'setblock ~ ~2 ~ redstone_block', 'setblock ~3 ~2 ~ redstone_block');
    await world.step(5);
    await world.expect('if block ~ ~3 ~ piston[extended=true] if block ~3 ~3 ~ piston[extended=true]');
    await world.expect('if block ~1 ~3 ~ piston_head[facing=east] if block ~2 ~3 ~ piston_head[facing=west]');
  }),
  ...[false, true].map((rightFirst) => interactionCase(
    `pistons.opposed-event-order-${rightFirst ? 'right' : 'left'}`,
    `The ${rightFirst ? 'right' : 'left'} piston wins an ordered same-tick contest for one head position`,
    async (world) => {
      await world.command('setblock ~ ~3 ~ piston[facing=east]', 'setblock ~2 ~3 ~ piston[facing=west]');
      const left = 'setblock ~ ~2 ~ redstone_block';
      const right = 'setblock ~2 ~2 ~ redstone_block';
      await world.command(...(rightFirst ? [right, left] : [left, right]));
      await world.step(5);
      await world.expect(`if block ~ ~3 ~ piston[extended=${!rightFirst}] if block ~2 ~3 ~ piston[extended=${rightFirst}]`);
      await world.expect(`if block ~1 ~3 ~ piston_head[facing=${rightFirst ? 'west' : 'east'}]`);
    },
  )),
  ...['torch', 'redstone_wire', 'poppy'].map((block) => interactionCase(
    `pistons.breaks-${block}`, `A piston breaks ${block} instead of moving it as a solid block`,
    async (world) => {
      await world.command('setblock ~1 ~-1 ~ grass_block', 'setblock ~ ~ ~ piston[facing=east]',
        `setblock ~1 ~ ~ ${block}`, 'setblock ~-1 ~ ~ redstone_block');
      await world.step(5);
      await world.expect('if block ~ ~ ~ piston[extended=true] if block ~1 ~ ~ piston_head if block ~2 ~ ~ air');
      const item = block === 'redstone_wire' ? 'redstone' : block;
      await world.expect(`if entity @e[type=item,nbt={Item:{id:"minecraft:${item}",count:1}},distance=..5]`);
    },
  )),
  interactionCase('pistons.drains-waterlogged-slab', 'Moving a waterlogged slab removes its waterlogging at the destination', async (world) => {
    await world.command('setblock ~ ~3 ~ piston[facing=east]', 'setblock ~1 ~3 ~ oak_slab[waterlogged=true,type=bottom]',
      'setblock ~ ~2 ~ redstone_block');
    await world.step(4);
    await world.expect('if block ~ ~3 ~ piston[extended=true] if block ~2 ~3 ~ oak_slab[waterlogged=false,type=bottom]');
  }),
  interactionCase('pistons.observer-after-movement', 'An observer moved by a piston retains its facing and emits a post-movement pulse', async (world) => {
    await world.command('setblock ~1 ~3 ~ observer[facing=east]');
    await world.step(5);
    await world.expect('if block ~1 ~3 ~ observer[powered=false,facing=east]');
    await world.command('setblock ~ ~3 ~ piston[facing=east]', 'setblock ~ ~2 ~ redstone_block');
    await world.step(4);
    await world.expect('if block ~2 ~3 ~ observer[facing=east]');
    await world.step(1);
    await world.expect('if block ~2 ~3 ~ observer[powered=true]');
    await world.step(2);
    await world.expect('if block ~2 ~3 ~ observer[powered=false]');
  }),
  ...['stone', 'slime_block', 'honey_block'].map((block) => interactionCase(
    `pistons.displaces-entity-${block}`, `A moving ${block} displaces an entity in front of the piston`,
    async (world) => {
      await world.command('setblock ~ ~3 ~ piston[facing=east]', `setblock ~1 ~3 ~ ${block}`,
        'summon armor_stand ~2.5 ~3 ~0.5 {Tags:["pushed"],NoGravity:1b,Invulnerable:1b}',
        'setblock ~ ~2 ~ redstone_block');
      await world.step(4);
      await world.expect(`if block ~2 ~3 ~ ${block}`);
      const displacement = block === 'honey_block' ? 3.1975 : 3.26;
      await world.result(`execute positioned ~${displacement} ~3 ~0.5 if entity @e[tag=pushed,distance=..0.001]`, 1);
      await world.result('data get entity @e[tag=pushed,limit=1] Motion[0] 1000', block === 'slime_block' ? 960 : 0);
    },
  )),
];
