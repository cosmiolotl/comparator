import { scenario } from '../../src/world/scenario.js';

export const cases = [
  scenario({
    id: 'java.world.ticks.frozen-clock', title: 'Administrative commands do not advance frozen game time',
    reference: 'docs/research-world.md#ticks',
    async run(world) {
      const before = await world.value('time query gametime');
      for (let index = 0; index < 5; index++) await world.command('list');
      await world.result('time query gametime', before);
    },
  }),
  scenario({
    id: 'java.world.ticks.single-step', title: 'A one-tick step advances the game clock exactly once',
    reference: 'docs/research-world.md#ticks',
    async run(world) {
      const before = await world.value('time query gametime');
      await world.step(1);
      await world.result('time query gametime', (before + 1) % 2147483647);
    },
  }),
  scenario({
    id: 'java.world.ticks.consecutive-steps', title: 'Consecutive steps do not lose or duplicate boundary ticks',
    reference: 'docs/research-world.md#ticks',
    async run(world) {
      const before = await world.value('time query gametime');
      await world.step(2);
      await world.step(3);
      await world.step(1);
      await world.result('time query gametime', (before + 6) % 2147483647);
    },
  }),
  ...[false, true].map((enabled) => scenario({
    id: `java.world.ticks.daylight-${enabled}`, title: `Daytime ${enabled ? 'advances with' : 'is independent of'} stepped ticks when daylight cycle is ${enabled}`,
    reference: 'docs/research-world.md#ticks',
    async run(world) {
      await world.command(`gamerule doDaylightCycle ${enabled}`, 'time set 6000');
      await world.step(17);
      await world.result('time query daytime', enabled ? 6017 : 6000);
    },
  })),
  scenario({
    id: 'java.world.ticks.day-rollover', title: 'Daytime wraps at 24000 while the day count increments',
    reference: 'docs/research-world.md#ticks',
    async run(world) {
      await world.command('gamerule doDaylightCycle true', 'time set 23999');
      await world.step(1);
      await world.result('time query daytime', 0);
      await world.result('time query day', 1);
    },
  }),
  scenario({
    id: 'java.world.ticks.time-set-preserves-gametime', title: 'Setting daytime does not reset the monotonic game clock',
    reference: 'docs/research-world.md#ticks',
    async run(world) {
      const before = await world.value('time query gametime');
      await world.command('time set 100');
      await world.result('time query gametime', before);
    },
  }),
  scenario({
    id: 'java.world.ticks.frozen-scheduled-block', title: 'Scheduled falling-block updates remain pending while frozen',
    reference: 'docs/research-world.md#ticks',
    async run(world) {
      await world.command('setblock ~ ~5 ~ sand');
      for (let index = 0; index < 5; index++) await world.command('list');
      await world.expect('if block ~ ~5 ~ sand');
      await world.expect('unless entity @e[type=falling_block]');
    },
  }),
  scenario({
    id: 'java.world.ticks.scheduled-before-deadline', title: 'A falling-block scheduled update does not run one tick early',
    reference: 'docs/research-world.md#ticks',
    async run(world) {
      await world.command('setblock ~ ~5 ~ sand');
      await world.step(1);
      await world.expect('if block ~ ~5 ~ sand');
      await world.step(1);
      await world.expect('if block ~ ~5 ~ air');
      await world.expect('if entity @e[type=falling_block]');
    },
  }),
  scenario({
    id: 'java.world.ticks.replaced-scheduled-block', title: 'Replacing a scheduled sand block cancels its obsolete falling action',
    reference: 'docs/research-world.md#ticks',
    async run(world) {
      await world.command('setblock ~ ~5 ~ sand', 'setblock ~ ~5 ~ stone');
      await world.step(3);
      await world.expect('if block ~ ~5 ~ stone');
      await world.expect('unless entity @e[type=falling_block]');
    },
  }),
  scenario({
    id: 'java.world.ticks.rate-does-not-advance', title: 'Changing the tick rate does not unfreeze or advance simulation',
    reference: 'docs/research-world.md#ticks',
    async run(world) {
      const before = await world.value('time query gametime');
      await world.command('tick rate 100', 'tick rate 1000');
      await world.result('time query gametime', before);
    },
  }),
  scenario({
    id: 'java.world.ticks.random-ticks-disabled', title: 'Disabled random ticks preserve unhydrated farmland during simulation',
    reference: 'docs/research-world.md#ticks',
    async run(world) {
      await world.command('setblock ~ ~ ~ farmland[moisture=7]');
      await world.step(100);
      await world.expect('if block ~ ~ ~ farmland[moisture=7]');
    },
  }),
];
