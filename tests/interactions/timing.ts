import { interactionCase } from './helpers.js';

const pendingLocks = [false, true].map((powered) => interactionCase(
  `timing.lock-pending-${powered ? 'fall' : 'rise'}`,
  `Locking a repeater suppresses its pending ${powered ? 'falling' : 'rising'} edge until unlocked`,
  async (world) => {
    await world.command('setblock ~ ~ ~ repeater[facing=west,delay=4]');
    if (powered) await world.command('setblock ~-1 ~ ~ redstone_block');
    await world.step(8);
    await world.expect(`if block ~ ~ ~ repeater[powered=${powered}]`);
    await world.command(`setblock ~-1 ~ ~ ${powered ? 'air' : 'redstone_block'}`);
    await world.step(3);
    await world.command('setblock ~ ~ ~-1 repeater[facing=north]', 'setblock ~ ~ ~-2 redstone_block');
    await world.step(2);
    await world.expect(`if block ~ ~ ~ repeater[locked=true,powered=${powered}]`);
    await world.step(3);
    await world.expect(`if block ~ ~ ~ repeater[locked=true,powered=${powered}]`);
    await world.command('setblock ~ ~ ~-2 air');
    await world.step(2);
    await world.expect(`if block ~ ~ ~ repeater[locked=false,powered=${powered}]`);
    await world.step(7);
    await world.expect(`if block ~ ~ ~ repeater[powered=${powered}]`);
    await world.step(1);
    await world.expect(`if block ~ ~ ~ repeater[powered=${!powered}]`);
  },
));

export const cases = [
  ...pendingLocks,
  interactionCase('timing.repeater-input-return', 'Returning input during the pending falling delay keeps a repeater powered', async (world) => {
    await world.command('setblock ~ ~ ~ repeater[facing=west,delay=2]', 'setblock ~-1 ~ ~ redstone_block');
    await world.step(4);
    await world.expect('if block ~ ~ ~ repeater[powered=true]');
    await world.command('setblock ~-1 ~ ~ air');
    await world.step(1);
    await world.command('setblock ~-1 ~ ~ redstone_block');
    await world.step(3);
    await world.expect('if block ~ ~ ~ repeater[powered=true]');
  }),
  interactionCase('timing.repeater-replaced-before-due', 'A pending repeater tick cannot turn an unrelated replacement into a repeater', async (world) => {
    await world.command('setblock ~ ~ ~ repeater[facing=west,delay=4]', 'setblock ~-1 ~ ~ redstone_block');
    await world.step(7);
    await world.command('setblock ~ ~ ~ stone');
    await world.step(1);
    await world.expect('if block ~ ~ ~ stone');
  }),
  interactionCase('timing.repeater-same-block-replacement', 'Replacing a repeater at the same position retains its earlier scheduled block tick', async (world) => {
    await world.command('setblock ~ ~ ~ repeater[facing=west,delay=4]', 'setblock ~-1 ~ ~ redstone_block');
    await world.step(4);
    await world.command('setblock ~ ~ ~ air', 'setblock ~ ~ ~ repeater[facing=west,delay=4]');
    await world.step(3);
    await world.expect('if block ~ ~ ~ repeater[powered=false]');
    await world.step(1);
    await world.expect('if block ~ ~ ~ repeater[powered=true]');
  }),
  interactionCase('timing.lamp-repowered-before-off', 'Repowering a lamp before its scheduled turn-off prevents an off transition', async (world) => {
    await world.command('setblock ~ ~ ~ redstone_lamp', 'setblock ~-1 ~ ~ redstone_block');
    await world.expect('if block ~ ~ ~ redstone_lamp[lit=true]');
    await world.command('setblock ~-1 ~ ~ air');
    await world.step(3);
    await world.command('setblock ~-1 ~ ~ redstone_block');
    await world.step(1);
    await world.expect('if block ~ ~ ~ redstone_lamp[lit=true]');
    await world.command('setblock ~-1 ~ ~ air');
    await world.step(4);
    await world.expect('if block ~ ~ ~ redstone_lamp[lit=false]');
  }),
  ...[7, 8].map((cycles) => interactionCase(`timing.torch-burnout-${cycles}`, `${cycles} rapid torch transitions ${cycles === 8 ? 'burn out' : 'do not burn out'} the torch`, async (world) => {
    await world.command('setblock ~ ~ ~ stone', 'setblock ~ ~1 ~ redstone_torch');
    for (let index = 0; index < cycles; index++) {
      await world.command('setblock ~ ~ ~ redstone_block');
      await world.step(2);
      await world.expect('if block ~ ~1 ~ redstone_torch[lit=false]');
      await world.command('setblock ~ ~ ~ stone');
      await world.step(2);
    }
    await world.expect(`if block ~ ~1 ~ redstone_torch[lit=${cycles < 8}]`);
    if (cycles === 8) {
      await world.step(157);
      await world.expect('if block ~ ~1 ~ redstone_torch[lit=false]');
      await world.step(1);
      await world.expect('if block ~ ~1 ~ redstone_torch[lit=true]');
    }
  })),
  interactionCase('timing.same-tick-piston-pulse', 'Power added and removed before tick processing does not extend a piston', async (world) => {
    await world.command('setblock ~ ~ ~ piston[facing=east]', 'setblock ~1 ~ ~ stone',
      'setblock ~-1 ~ ~ redstone_block', 'setblock ~-1 ~ ~ air');
    await world.step(4);
    await world.expect('if block ~ ~ ~ piston[extended=false] if block ~1 ~ ~ stone if block ~2 ~ ~ air');
  }),
  interactionCase('timing.same-tick-repeater-pulse', 'A repeater preserves a same-tick rising pulse in its scheduled update', async (world) => {
    await world.command('setblock ~ ~ ~ repeater[facing=west]', 'setblock ~-1 ~ ~ redstone_block', 'setblock ~-1 ~ ~ air');
    await world.step(1);
    await world.expect('if block ~ ~ ~ repeater[powered=false]');
    await world.step(1);
    await world.expect('if block ~ ~ ~ repeater[powered=true]');
    await world.step(2);
    await world.expect('if block ~ ~ ~ repeater[powered=false]');
  }),
];
