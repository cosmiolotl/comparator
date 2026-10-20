import { scenario } from '../../src/world/scenario.js';

type World = Parameters<Parameters<typeof scenario>[0]['run']>[0];
const subject = '@e[tag=cts_subject,limit=1]';

function timerCase(id: string, title: string, run: (world: World) => Promise<void>) {
  return scenario({ id: `java.entities.timers.${id}`, title, reference: 'docs/research-entities.md#entity-timers', run });
}

async function cow(world: World, fields = '') {
  await world.command(`summon minecraft:cow ~ ~ ~ {Tags:["cts_subject"],NoAI:1b,NoGravity:1b${fields}}`);
  await world.expect('if entity @e[tag=cts_subject]');
}

export const cases = [
  timerCase('baby-age', 'Baby age advances toward zero once per tick', async (world) => {
    await cow(world, ',Age:-20');
    await world.step(3);
    await world.result(`data get entity ${subject} Age`, -17);
  }),
  timerCase('breeding-cooldown', 'Positive breeding cooldown decreases once per tick', async (world) => {
    await cow(world, ',Age:20');
    await world.step(3);
    await world.result(`data get entity ${subject} Age`, 17);
  }),
  timerCase('maturation-boundary', 'Baby age reaches zero without crossing into breeding cooldown', async (world) => {
    await cow(world, ',Age:-1');
    await world.step(2);
    await world.result(`data get entity ${subject} Age`, 0);
  }),
  timerCase('breeding-cooldown-boundary', 'Breeding cooldown stops at zero without making an animal a baby', async (world) => {
    await cow(world, ',Age:1');
    await world.step(2);
    await world.result(`data get entity ${subject} Age`, 0);
  }),
  timerCase('love-countdown', 'An animal love timer decreases once per tick', async (world) => {
    await cow(world, ',InLove:20');
    await world.step(3);
    await world.result(`data get entity ${subject} InLove`, 17);
  }),
  timerCase('love-expiration', 'Love mode expires at zero', async (world) => {
    await cow(world, ',InLove:1');
    await world.step(2);
    await world.result(`data get entity ${subject} InLove`, 0);
  }),
  timerCase('chicken-lays-egg', 'Adult chickens lay an egg when their egg timer expires', async (world) => {
    await world.command('summon minecraft:chicken ~ ~ ~ {Tags:["cts_subject"],NoAI:1b,NoGravity:1b,EggLayTime:1}');
    await world.step(1);
    await world.expect('if entity @e[type=minecraft:item,nbt={Item:{id:"minecraft:egg",count:1}}]');
  }),
  timerCase('baby-chicken-no-egg', 'Baby chickens do not advance their egg timer', async (world) => {
    await world.command('summon minecraft:chicken ~ ~ ~ {Tags:["cts_subject"],NoAI:1b,NoGravity:1b,Age:-20,EggLayTime:1}');
    await world.step(2);
    await world.result(`data get entity ${subject} EggLayTime`, 1);
    await world.expect('unless entity @e[type=minecraft:item,nbt={Item:{id:"minecraft:egg"}}]');
  }),
  timerCase('cloud-age', 'Area effect cloud age advances during its wait period', async (world) => {
    await world.command('summon minecraft:area_effect_cloud ~ ~ ~ {Tags:["cts_subject"],Age:0,WaitTime:10,Duration:20,Radius:2f}');
    await world.step(3);
    await world.result(`data get entity ${subject} Age`, 3);
  }),
  timerCase('cloud-expiration', 'Area effect clouds disappear at their exact duration boundary', async (world) => {
    await world.command('summon minecraft:area_effect_cloud ~ ~ ~ {Tags:["cts_subject"],WaitTime:0,Duration:3,Radius:2f}');
    await world.step(2);
    await world.expect('if entity @e[tag=cts_subject]');
    await world.step(1);
    await world.expect('unless entity @e[tag=cts_subject]');
  }),
  timerCase('cloud-wait-extends-life', 'Cloud wait time is added to active duration', async (world) => {
    await world.command('summon minecraft:area_effect_cloud ~ ~ ~ {Tags:["cts_subject"],WaitTime:3,Duration:2,Radius:2f}');
    await world.step(4);
    await world.expect('if entity @e[tag=cts_subject]');
    await world.step(1);
    await world.expect('unless entity @e[tag=cts_subject]');
  }),
  timerCase('cloud-growth', 'Active cloud radius changes once per tick', async (world) => {
    await world.command('summon minecraft:area_effect_cloud ~ ~ ~ {Tags:["cts_subject"],WaitTime:0,Duration:20,Radius:2f,RadiusPerTick:0.5f}');
    await world.step(2);
    await world.result(`data get entity ${subject} Radius`, 3);
  }),
  timerCase('cloud-wait-no-growth', 'Waiting clouds defer radius-per-tick changes', async (world) => {
    await world.command('summon minecraft:area_effect_cloud ~ ~ ~ {Tags:["cts_subject"],WaitTime:3,Duration:20,Radius:2f,RadiusPerTick:0.5f}');
    await world.step(2);
    await world.result(`data get entity ${subject} Radius`, 2);
    await world.step(1);
    await world.result(`data get entity ${subject} Radius 2`, 5);
  }),
  timerCase('cloud-minimum-radius', 'Shrinking clouds survive radius one-half and disappear below it', async (world) => {
    await world.command('summon minecraft:area_effect_cloud ~ ~ ~ {Tags:["cts_subject"],WaitTime:0,Duration:20,Radius:1f,RadiusPerTick:-0.5f}');
    await world.step(1);
    await world.result(`data get entity ${subject} Radius 2`, 1);
    await world.step(1);
    await world.expect('unless entity @e[tag=cts_subject]');
  }),
  timerCase('tnt-countdown', 'Primed TNT fuse decreases once per tick', async (world) => {
    await world.command('summon minecraft:tnt ~ ~10 ~ {Tags:["cts_subject"],NoGravity:1b,fuse:5s}');
    await world.step(2);
    await world.result(`data get entity ${subject} fuse`, 3);
  }),
  timerCase('tnt-explosion-boundary', 'Primed TNT disappears precisely when its fuse reaches zero', async (world) => {
    await world.command('summon minecraft:tnt ~ ~10 ~ {Tags:["cts_subject"],NoGravity:1b,fuse:2s}');
    await world.step(1);
    await world.expect('if entity @e[tag=cts_subject]');
    await world.step(1);
    await world.expect('unless entity @e[tag=cts_subject]');
  }),
  timerCase('ignited-creeper', 'Ignited creepers process their fuse with AI disabled', async (world) => {
    await world.command('summon minecraft:creeper ~ ~ ~ {Tags:["cts_subject"],NoAI:1b,NoGravity:1b,ignited:1b,Fuse:3s,ExplosionRadius:0b}');
    await world.step(2);
    await world.expect('if entity @e[tag=cts_subject]');
    await world.step(1);
    await world.expect('unless entity @e[tag=cts_subject]');
  }),
  timerCase('effect-duration', 'Finite status-effect duration decrements once per tick', async (world) => {
    await cow(world);
    await world.command(`effect give ${subject} minecraft:speed 1 0 true`);
    await world.step(3);
    await world.result(`data get entity ${subject} active_effects[0].duration`, 17);
  }),
  timerCase('effect-expiration', 'Status effects expire at their exact duration boundary', async (world) => {
    await cow(world);
    await world.command(`effect give ${subject} minecraft:speed 1 0 true`);
    await world.step(19);
    await world.expect('if entity @e[tag=cts_subject,nbt={active_effects:[{id:"minecraft:speed",duration:1}]}]');
    await world.step(1);
    await world.expect('unless entity @e[tag=cts_subject,nbt={active_effects:[{id:"minecraft:speed"}]}]');
  }),
  timerCase('infinite-effect', 'Infinite status effects preserve their duration sentinel while ticking', async (world) => {
    await cow(world);
    await world.command(`effect give ${subject} minecraft:speed infinite 0 true`);
    await world.step(5);
    await world.expect('if entity @e[tag=cts_subject,nbt={active_effects:[{id:"minecraft:speed",duration:-1}]}]');
  }),
  timerCase('stronger-effect', 'A stronger status effect immediately overrides a weaker effect', async (world) => {
    await cow(world);
    await world.command(`effect give ${subject} minecraft:speed 10 0 true`, `effect give ${subject} minecraft:speed 1 1 true`);
    await world.expect('if entity @e[tag=cts_subject,nbt={active_effects:[{id:"minecraft:speed",amplifier:1b,duration:20}]}]');
  }),
  timerCase('shorter-effect', 'Equal-amplifier shorter effects do not shorten the current duration', async (world) => {
    await cow(world);
    await world.command(`effect give ${subject} minecraft:speed 10 0 true`, `effect give ${subject} minecraft:speed 1 0 true`);
    await world.expect('if entity @e[tag=cts_subject,nbt={active_effects:[{id:"minecraft:speed",duration:200}]}]');
  }),
  timerCase('longer-effect', 'Equal-amplifier longer effects extend the current duration', async (world) => {
    await cow(world);
    await world.command(`effect give ${subject} minecraft:speed 1 0 true`, `effect give ${subject} minecraft:speed 10 0 true`);
    await world.expect('if entity @e[tag=cts_subject,nbt={active_effects:[{id:"minecraft:speed",duration:200}]}]');
  }),
  timerCase('hidden-effect-resumes', 'A weaker hidden effect resumes with elapsed time deducted', async (world) => {
    await cow(world);
    await world.command(`attribute ${subject} minecraft:generic.movement_speed base set 0.5`);
    await world.command(`effect give ${subject} minecraft:speed 10 0 true`, `effect give ${subject} minecraft:speed 1 1 true`);
    await world.step(20);
    await world.expect('if entity @e[tag=cts_subject,nbt={active_effects:[{id:"minecraft:speed",duration:180}]}]');
    await world.result(`attribute ${subject} minecraft:generic.movement_speed get 100`, 60);
  }),
  timerCase('selective-effect-clear', 'Clearing one effect preserves other active effects', async (world) => {
    await cow(world);
    await world.command(`effect give ${subject} minecraft:speed 10 0 true`, `effect give ${subject} minecraft:glowing 10 0 true`, `effect clear ${subject} minecraft:speed`);
    await world.expect('unless entity @e[tag=cts_subject,nbt={active_effects:[{id:"minecraft:speed"}]}]');
    await world.expect('if entity @e[tag=cts_subject,nbt={active_effects:[{id:"minecraft:glowing"}]}]');
  }),
];
