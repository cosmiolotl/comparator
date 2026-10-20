import { mechanicsCase, subject, testSubject, type MechanicsWorld } from './helpers.js';

async function cloud(world: MechanicsWorld, fields = '', effect = 'speed', duration = 200) {
  await world.command(`summon minecraft:area_effect_cloud ~0.5 ~ ~0.5 {Tags:["cts_cloud"],Radius:3f,WaitTime:0,Duration:200,ReapplicationDelay:20,RadiusOnUse:0f,potion_contents:{custom_effects:[{id:"minecraft:${effect}",duration:${duration},amplifier:0}]}${fields}}`);
  await world.expect('if entity @e[tag=cts_cloud]');
}

export const cases = [
  mechanicsCase('cloud.first_application', 'An active effect cloud first applies effects on its fifth tick', 'clouds', async (world) => {
    await testSubject(world);
    await cloud(world);
    await world.step(4);
    await world.expect('unless data entity @e[tag=cts_subject,limit=1] active_effects[{id:"minecraft:speed"}]');
    await world.step(1);
    await world.expect('if data entity @e[tag=cts_subject,limit=1] active_effects[{id:"minecraft:speed"}]');
  }),
  mechanicsCase('cloud.wait_gate', 'Clouds do not apply effects before their wait period ends', 'clouds', async (world) => {
    await testSubject(world);
    await cloud(world, ',WaitTime:10');
    await world.step(9);
    await world.expect('unless data entity @e[tag=cts_subject,limit=1] active_effects[{id:"minecraft:speed"}]');
    await world.step(1);
    await world.expect('if data entity @e[tag=cts_subject,limit=1] active_effects[{id:"minecraft:speed"}]');
  }),
  mechanicsCase('cloud.reapplication_delay', 'Clearing an applied effect does not bypass the cloud per-entity reapplication delay', 'clouds', async (world) => {
    await testSubject(world);
    await cloud(world);
    await world.step(5);
    await world.expect('if data entity @e[tag=cts_subject,limit=1] active_effects[{id:"minecraft:speed"}]');
    await world.command(`effect clear ${subject} minecraft:speed`);
    await world.step(19);
    await world.expect('unless data entity @e[tag=cts_subject,limit=1] active_effects[{id:"minecraft:speed"}]');
    await world.step(1);
    await world.expect('if data entity @e[tag=cts_subject,limit=1] active_effects[{id:"minecraft:speed"}]');
  }),
  mechanicsCase('cloud.per_entity_cache', 'One entity reapplication cooldown does not suppress a newly arriving entity', 'clouds', async (world) => {
    await testSubject(world);
    await cloud(world);
    await world.step(5);
    await world.expect('if data entity @e[tag=cts_subject,limit=1] active_effects[{id:"minecraft:speed"}]');
    await world.command('summon minecraft:cow ~1 ~ ~1 {Tags:["cts_arrival"],NoAI:1b,NoGravity:1b}',
      `effect clear ${subject} minecraft:speed`);
    await world.step(5);
    await world.expect('unless data entity @e[tag=cts_subject,limit=1] active_effects[{id:"minecraft:speed"}]');
    await world.expect('if data entity @e[tag=cts_arrival,limit=1] active_effects[{id:"minecraft:speed"}]');
  }),
  mechanicsCase('cloud.instant_damage', 'A cloud applies instant damage at half the direct potion strength', 'clouds', async (world) => {
    await testSubject(world);
    await cloud(world, '', 'instant_damage', 1);
    await world.step(5);
    await world.expect('if entity @e[tag=cts_subject,nbt={Health:97f}]');
  }),
  mechanicsCase('cloud.radius_on_use', 'A successful cloud application immediately reduces its radius', 'clouds', async (world) => {
    await testSubject(world);
    await cloud(world, ',RadiusOnUse:-0.5f');
    await world.step(5);
    await world.result('data get entity @e[tag=cts_cloud,limit=1] Radius 2', 5);
    await world.expect('if data entity @e[tag=cts_subject,limit=1] active_effects[{id:"minecraft:speed"}]');
  }),
  mechanicsCase('cloud.duration_on_use', 'A successful cloud application subtracts duration-on-use once', 'clouds', async (world) => {
    await testSubject(world);
    await cloud(world, ',DurationOnUse:-20');
    await world.step(5);
    await world.result('data get entity @e[tag=cts_cloud,limit=1] Duration', 180);
    await world.expect('if data entity @e[tag=cts_subject,limit=1] active_effects[{id:"minecraft:speed"}]');
  }),
  mechanicsCase('cloud.radius_excludes', 'Cloud application uses radial distance rather than only the bounding box', 'clouds', async (world) => {
    await testSubject(world);
    await world.command('summon minecraft:cow ~3.3 ~ ~3.3 {Tags:["cts_outside"],NoAI:1b,NoGravity:1b}');
    await cloud(world);
    await world.step(5);
    await world.expect('if data entity @e[tag=cts_subject,limit=1] active_effects[{id:"minecraft:speed"}]');
    await world.expect('unless data entity @e[tag=cts_outside,limit=1] active_effects[{id:"minecraft:speed"}]');
  }),
];
