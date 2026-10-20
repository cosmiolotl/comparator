import { mechanicsCase, subject, testSubject, type MechanicsWorld } from './helpers.js';

async function explode(world: MechanicsWorld) {
  await world.command('summon minecraft:tnt ~2.5 ~ ~0.5 {Tags:["cts_tnt"],NoGravity:1b,Motion:[0d,0d,0d],fuse:1s}');
  await world.expect('if entity @e[tag=cts_tnt]');
  await world.step(1);
  await world.expect('unless entity @e[tag=cts_tnt]');
}

export const cases = [
  mechanicsCase('explosion.exposed_damage', 'An exposed stationary entity receives the expected TNT explosion damage', 'explosions', async (world) => {
    await testSubject(world);
    await explode(world);
    await world.result(`data get entity ${subject} Health 1000`, 62258);
  }),
  mechanicsCase('explosion.solid_occlusion', 'Complete obsidian occlusion reduces TNT damage to one and eliminates knockback', 'explosions', async (world) => {
    await testSubject(world);
    await world.command('fill ~1 ~ ~-2 ~1 ~3 ~3 minecraft:obsidian');
    await explode(world);
    await world.expect('if entity @e[tag=cts_subject,nbt={Health:99f,Motion:[0d,0d,0d]}]');
    await world.expect('if block ~1 ~1 ~ minecraft:obsidian');
  }),
  mechanicsCase('explosion.knockback', 'Exposed TNT blast motion points away from the explosion', 'explosions', async (world) => {
    await testSubject(world);
    await explode(world);
    await world.result(`data get entity ${subject} Motion[0] 1000`, -638);
    await world.result(`data get entity ${subject} Motion[1] 1000`, 394);
  }),
  mechanicsCase('explosion.tnt_ignores_mob_griefing', 'TNT destroys fragile blocks even when mob griefing is disabled', 'explosions', async (world) => {
    await world.command('setblock ~3 ~ ~ minecraft:glass');
    await world.expect('if block ~3 ~ ~ minecraft:glass');
    await explode(world);
    await world.expect('if block ~3 ~ ~ minecraft:air');
  }),
  mechanicsCase('explosion.water_shields_blocks', 'Water at the TNT explosion origin protects adjacent blocks from destruction', 'explosions', async (world) => {
    await world.command('setblock ~2 ~ ~ minecraft:water', 'setblock ~3 ~ ~ minecraft:glass');
    await explode(world);
    await world.expect('if block ~3 ~ ~ minecraft:glass');
    await world.expect('if block ~2 ~ ~ minecraft:water');
  }),
  mechanicsCase('explosion.chain_priming', 'An explosion primes nearby TNT blocks with a shortened fuse', 'explosions', async (world) => {
    await world.command('setblock ~3 ~ ~ minecraft:tnt');
    await world.expect('if block ~3 ~ ~ minecraft:tnt');
    await explode(world);
    await world.expect('if block ~3 ~ ~ minecraft:air');
    await world.expect('if entity @e[type=minecraft:tnt,tag=!cts_tnt]');
    await world.command('execute store result score #fuse cts run data get entity @e[type=minecraft:tnt,limit=1] fuse');
    // Vanilla deliberately randomizes this fuse; its guaranteed interval is the contract.
    await world.expect('if score #fuse cts matches 9..29');
  }),
  mechanicsCase('explosion.creeper_griefing_false', 'Disabling mob griefing preserves blocks while a creeper still damages entities', 'explosions', async (world) => {
    await testSubject(world);
    await world.command('setblock ~3 ~ ~ minecraft:glass',
      'summon minecraft:creeper ~2.5 ~ ~0.5 {Tags:["cts_creeper"],NoAI:1b,NoGravity:1b,ignited:1b,Fuse:1s,ExplosionRadius:3b}');
    await world.step(1);
    await world.expect('unless entity @e[tag=cts_creeper]');
    await world.expect('if block ~3 ~ ~ minecraft:glass');
    await world.command(`execute store result score #health cts run data get entity ${subject} Health 1000`);
    await world.expect('if score #health cts matches 1..99999');
  }),
];
