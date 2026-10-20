import { mechanicsCase, subject, testSubject, type MechanicsWorld } from './helpers.js';

async function arrow(world: MechanicsWorld, fields = '') {
  await world.command(`summon minecraft:arrow ~-1 ~0.7 ~0.5 {Tags:["cts_arrow"],NoGravity:1b,Motion:[2d,0d,0d],damage:2d${fields}}`);
  await world.expect('if entity @e[tag=cts_arrow]');
}

export const cases = [
  mechanicsCase('projectile.arrow_collision', 'A moving arrow damages a living target and is removed after impact', 'projectiles', async (world) => {
    await testSubject(world);
    await arrow(world);
    await world.step(1);
    await world.expect('if entity @e[tag=cts_subject,nbt={Health:96f}]');
    await world.expect('unless entity @e[tag=cts_arrow]');
  }),
  mechanicsCase('projectile.block_obstruction', 'A solid block stops an arrow before it reaches the entity behind it', 'projectiles', async (world) => {
    await testSubject(world);
    await world.command('setblock ~-1 ~ ~ minecraft:stone');
    await world.command('summon minecraft:arrow ~-2 ~0.7 ~0.5 {Tags:["cts_arrow"],NoGravity:1b,Motion:[3d,0d,0d],damage:2d}');
    await world.step(1);
    await world.expect('if entity @e[tag=cts_subject,nbt={Health:100f}]');
    await world.expect('if entity @e[tag=cts_arrow,nbt={inGround:1b}]');
  }),
  mechanicsCase('projectile.flame_arrow', 'A burning arrow ignites the entity it hits', 'projectiles', async (world) => {
    await testSubject(world);
    await arrow(world, ',Fire:100s');
    await world.step(1);
    await world.result(`data get entity ${subject} Fire`, 100);
    await world.expect('if entity @e[tag=cts_subject,nbt={Health:96f}]');
  }),
  mechanicsCase('projectile.tipped_arrow', 'A tipped arrow applies its stored custom potion effect after collision', 'projectiles', async (world) => {
    await testSubject(world);
    await arrow(world, ',item:{id:"minecraft:tipped_arrow",count:1,components:{"minecraft:potion_contents":{custom_effects:[{id:"minecraft:slowness",duration:200,amplifier:1}]}}}');
    await world.step(1);
    await world.expect('if data entity @e[tag=cts_subject,limit=1] active_effects[{id:"minecraft:slowness",amplifier:1b}]');
    await world.expect('if entity @e[tag=cts_subject,nbt={Health:96f}]');
  }),
  mechanicsCase('projectile.piercing_two_targets', 'A piercing arrow damages two aligned entities without duplicating damage on either', 'projectiles', async (world) => {
    await testSubject(world);
    await world.command('summon minecraft:cow ~2 ~ ~0.5 {Tags:["cts_second"],NoAI:1b,NoGravity:1b,Health:20f,attributes:[{id:"minecraft:generic.max_health",base:20d}]}');
    await arrow(world, ',PierceLevel:1b');
    await world.step(2);
    await world.expect('if entity @e[tag=cts_subject,nbt={Health:96f}]');
    await world.expect('if entity @e[tag=cts_second,nbt={Health:16f}]');
  }),
  mechanicsCase('projectile.knockback', 'Arrow impact gives a living target motion away from the projectile', 'projectiles', async (world) => {
    await testSubject(world);
    await arrow(world);
    await world.step(1);
    await world.command(`execute store result score #motion cts run data get entity ${subject} Motion[0] 10000`);
    await world.expect('if score #motion cts matches 1..');
    await world.expect('if entity @e[tag=cts_subject,nbt={Health:96f}]');
  }),
  mechanicsCase('projectile.full_knockback_resistance', 'Full knockback resistance prevents impact motion while allowing arrow damage', 'projectiles', async (world) => {
    await testSubject(world);
    await world.command(`attribute ${subject} minecraft:generic.knockback_resistance base set 1`);
    await arrow(world);
    await world.step(1);
    await world.result(`data get entity ${subject} Motion[0] 10000`, 0);
    await world.expect('if entity @e[tag=cts_subject,nbt={Health:96f}]');
  }),
  mechanicsCase('projectile.snowball_blaze', 'Snowballs deal their special three damage to a blaze', 'projectiles', async (world) => {
    await testSubject(world, '', 'blaze');
    await world.command('summon minecraft:snowball ~-1 ~0.7 ~0.5 {Tags:["cts_ball"],NoGravity:1b,Motion:[2d,0d,0d]}');
    await world.step(1);
    await world.expect('if entity @e[tag=cts_subject,nbt={Health:97f}]');
    await world.expect('unless entity @e[tag=cts_ball]');
  }),
  mechanicsCase('projectile.snowball_cow', 'Snowballs collide with ordinary animals without reducing health', 'projectiles', async (world) => {
    await testSubject(world);
    await world.command('summon minecraft:snowball ~-1 ~0.7 ~0.5 {Tags:["cts_ball"],NoGravity:1b,Motion:[2d,0d,0d]}');
    await world.step(1);
    await world.expect('if entity @e[tag=cts_subject,nbt={Health:100f}]');
    await world.expect('unless entity @e[tag=cts_ball]');
  }),
];
