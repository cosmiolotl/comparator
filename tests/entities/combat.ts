import { randomUUID } from 'node:crypto';
import { scenario } from '../../src/world/scenario.js';

type World = Parameters<Parameters<typeof scenario>[0]['run']>[0];
const subject = '@e[tag=cts_subject,limit=1]';

function combatCase(id: string, title: string, run: (world: World) => Promise<void>, entity = 'cow') {
  return scenario({
    id: `java.entities.combat.${id}`, title,
    reference: 'docs/research-entities.md#combat-and-effects',
    run: async (world) => {
      await world.command(`summon minecraft:${entity} ~ ~ ~ {Tags:["cts_subject"],NoAI:1b,NoGravity:1b,Health:20f,attributes:[{id:"minecraft:generic.max_health",base:20d},{id:"minecraft:generic.armor",base:0d}]}`);
      await world.expect('if entity @e[tag=cts_subject,nbt={Health:20f}]');
      await run(world);
    },
  });
}

async function health(world: World, expected: number) {
  await world.expect(`if entity @e[tag=cts_subject,nbt={Health:${expected}f}]`, `Health must be ${expected}`);
}

export const cases = [
  combatCase('unarmored', 'Unarmored generic damage subtracts the requested health', async (world) => {
    await world.command(`damage ${subject} 4 minecraft:generic`);
    await health(world, 16);
  }),
  combatCase('zero-damage', 'Zero damage does not reduce health', async (world) => {
    await world.command(`damage ${subject} 0 minecraft:generic`);
    await health(world, 20);
  }),
  combatCase('fractional-damage', 'Fractional damage preserves half-heart precision', async (world) => {
    await world.command(`damage ${subject} 0.5 minecraft:generic`);
    await health(world, 19.5);
  }),
  combatCase('equal-hit-cooldown', 'Equal damage is suppressed during the hurt cooldown', async (world) => {
    await world.command(`damage ${subject} 4 minecraft:generic`, `damage ${subject} 4 minecraft:generic`);
    await health(world, 16);
  }),
  combatCase('weaker-hit-cooldown', 'Weaker damage is suppressed during the hurt cooldown', async (world) => {
    await world.command(`damage ${subject} 7 minecraft:generic`, `damage ${subject} 4 minecraft:generic`);
    await health(world, 13);
  }),
  combatCase('stronger-hit-difference', 'Stronger cooldown hits apply only their excess damage', async (world) => {
    await world.command(`damage ${subject} 4 minecraft:generic`, `damage ${subject} 7 minecraft:generic`);
    await health(world, 13);
  }),
  combatCase('cooldown-before-boundary', 'Hurt cooldown still suppresses damage after nine ticks', async (world) => {
    await world.command(`damage ${subject} 4 minecraft:generic`);
    await world.step(9);
    await world.command(`damage ${subject} 4 minecraft:generic`);
    await health(world, 16);
  }),
  combatCase('cooldown-at-boundary', 'A new hit applies in full at the ten-tick hurt boundary', async (world) => {
    await world.command(`damage ${subject} 4 minecraft:generic`);
    await world.step(10);
    await world.command(`damage ${subject} 4 minecraft:generic`);
    await health(world, 12);
  }),
  combatCase('hurt-animation-timer', 'HurtTime decrements once per simulation tick', async (world) => {
    await world.command(`damage ${subject} 4 minecraft:generic`);
    await world.result(`data get entity ${subject} HurtTime`, 10);
    await world.step(1);
    await world.result(`data get entity ${subject} HurtTime`, 9);
  }),
  scenario({
    id: 'java.entities.combat.death-removal-boundary',
    title: 'Dead living entities persist nineteen ticks and disappear on tick twenty',
    reference: 'docs/research-entities.md#combat-and-effects',
    run: async (world) => {
      // Selectors exclude dead living entities; a direct UUID still resolves until removal.
      const dying = randomUUID();
      const uuidBytes = Buffer.from(dying.replaceAll('-', ''), 'hex');
      const uuidWords = [0, 4, 8, 12].map((offset) => uuidBytes.readInt32BE(offset));
      await world.command(`summon minecraft:cow ~ ~ ~ {Tags:["cts_subject"],NoAI:1b,UUID:[I;${uuidWords.join(',')}]}`);
      await world.command(`damage ${dying} 100 minecraft:generic`);
      await world.step(19);
      await world.result(`data get entity ${dying} DeathTime`, 19);
      await world.step(1);
      await world.expect(`unless entity ${dying}`);
    },
  }),
  combatCase('invulnerable', 'Invulnerable entities reject ordinary damage', async (world) => {
    await world.command(`data merge entity ${subject} {Invulnerable:1b}`, `damage ${subject} 10 minecraft:generic`);
    await health(world, 20);
  }),
  combatCase('kill-bypasses-invulnerable', 'Generic-kill damage bypasses the Invulnerable flag', async (world) => {
    await world.command(`data merge entity ${subject} {Invulnerable:1b}`, `damage ${subject} 4 minecraft:generic_kill`);
    await health(world, 16);
  }),
  combatCase('resistance', 'Resistance I reduces applicable damage by twenty percent', async (world) => {
    await world.command(`effect give ${subject} minecraft:resistance 20 0 true`, `damage ${subject} 10 minecraft:generic`);
    await health(world, 12);
  }),
  combatCase('resistance-five', 'Resistance V prevents applicable damage', async (world) => {
    await world.command(`effect give ${subject} minecraft:resistance 20 4 true`, `damage ${subject} 10 minecraft:generic`);
    await health(world, 20);
  }),
  combatCase('void-bypasses-resistance', 'Void damage bypasses resistance', async (world) => {
    await world.command(`effect give ${subject} minecraft:resistance 20 4 true`, `damage ${subject} 5 minecraft:out_of_world`);
    await health(world, 15);
  }),
  combatCase('armor', 'Armor protection decreases with incoming damage', async (world) => {
    await world.command(`attribute ${subject} minecraft:generic.armor base set 20`, `damage ${subject} 10 minecraft:mob_attack`);
    await health(world, 16);
  }),
  combatCase('armor-toughness', 'Armor toughness changes the damage-dependent armor reduction', async (world) => {
    await world.command(`attribute ${subject} minecraft:generic.armor base set 20`, `attribute ${subject} minecraft:generic.armor_toughness base set 8`);
    await world.command(`damage ${subject} 20 minecraft:mob_attack`);
    await health(world, 12);
  }),
  combatCase('magic-bypasses-armor', 'Magic damage bypasses armor protection', async (world) => {
    await world.command(`attribute ${subject} minecraft:generic.armor base set 20`, `damage ${subject} 10 minecraft:magic`);
    await health(world, 10);
  }),
  combatCase('absorption-first', 'Absorption hearts take damage before normal health', async (world) => {
    await world.command(`effect give ${subject} minecraft:absorption 20 0 true`, `damage ${subject} 3 minecraft:generic`);
    await health(world, 20);
    await world.expect('if entity @e[tag=cts_subject,nbt={AbsorptionAmount:1f}]');
  }),
  combatCase('absorption-overflow', 'Damage exceeding absorption spills into normal health', async (world) => {
    await world.command(`effect give ${subject} minecraft:absorption 20 0 true`, `damage ${subject} 7 minecraft:generic`);
    await health(world, 17);
    await world.expect('if entity @e[tag=cts_subject,nbt={AbsorptionAmount:0f}]');
  }),
  combatCase('absorption-clear', 'Clearing absorption removes its remaining bonus hearts', async (world) => {
    await world.command(`effect give ${subject} minecraft:absorption 20 1 true`, `effect clear ${subject} minecraft:absorption`);
    await world.expect('if entity @e[tag=cts_subject,nbt={AbsorptionAmount:0f}]');
  }),
  combatCase('instant-healing', 'Instant health heals ordinary living entities', async (world) => {
    await world.command(`data merge entity ${subject} {Health:10f}`, `effect give ${subject} minecraft:instant_health 1 0 true`);
    await world.step(1);
    await health(world, 14);
  }),
  combatCase('healing-cap', 'Healing cannot exceed maximum health', async (world) => {
    await world.command(`data merge entity ${subject} {Health:19f}`, `effect give ${subject} minecraft:instant_health 1 0 true`);
    await world.step(1);
    await health(world, 20);
  }),
  combatCase('instant-harming', 'Instant damage harms ordinary living entities', async (world) => {
    await world.command(`effect give ${subject} minecraft:instant_damage 1 0 true`);
    await world.step(1);
    await health(world, 14);
  }),
  combatCase('healing-harms-undead', 'Instant health damages undead entities', async (world) => {
    await world.command(`effect give ${subject} minecraft:instant_health 1 0 true`);
    await world.step(1);
    await health(world, 14);
  }, 'husk'),
  combatCase('harming-heals-undead', 'Instant damage heals undead entities', async (world) => {
    await world.command(`data merge entity ${subject} {Health:10f}`, `effect give ${subject} minecraft:instant_damage 1 0 true`);
    await world.step(1);
    await health(world, 14);
  }, 'husk'),
  combatCase('undead-poison-immunity', 'Undead reject poison effects', async (world) => {
    await world.command(`effect give ${subject} minecraft:poison 20 0 true`);
    await world.expect('unless entity @e[tag=cts_subject,nbt={active_effects:[{id:"minecraft:poison"}]}]');
  }, 'husk'),
  combatCase('undead-regeneration-immunity', 'Undead reject regeneration effects', async (world) => {
    await world.command(`effect give ${subject} minecraft:regeneration 20 0 true`);
    await world.expect('unless entity @e[tag=cts_subject,nbt={active_effects:[{id:"minecraft:regeneration"}]}]');
  }, 'husk'),
  combatCase('fire-resistance', 'Fire resistance prevents damage with the fire tag', async (world) => {
    await world.command(`effect give ${subject} minecraft:fire_resistance 20 0 true`, `damage ${subject} 10 minecraft:in_fire`);
    await health(world, 20);
  }),
  combatCase('fire-resistance-not-magic', 'Fire resistance does not suppress nonfire damage', async (world) => {
    await world.command(`effect give ${subject} minecraft:fire_resistance 20 0 true`, `damage ${subject} 5 minecraft:magic`);
    await health(world, 15);
  }),
];
