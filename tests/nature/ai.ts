import { natureCase } from './helpers.js';

export const cases = [
  natureCase('ai.zombie-seeks-villager', 'A zombie navigates toward a villager and performs a melee attack', async (world) => {
    await world.command('fill ~-2 ~3 ~-2 ~12 ~3 ~2 stone',
      'summon villager ~9.5 ~ ~0.5 {Tags:["victim"],NoAI:1b}',
      'attribute @e[tag=victim,limit=1] minecraft:generic.max_health base set 100',
      'data merge entity @e[tag=victim,limit=1] {Health:100f}',
      'summon zombie ~0.5 ~ ~0.5 {Tags:["hunter"],IsBaby:0b,PersistenceRequired:1b}');
    await world.result('data get entity @e[tag=victim,limit=1] Health', 100);
    await world.step(120);
    await world.result('execute at @e[tag=victim,limit=1] if entity @e[tag=hunter,distance=..2]', 1);
    await world.command('execute store result score #health cts run data get entity @e[tag=victim,limit=1] Health');
    await world.expect('if score #health cts matches 1..99');
  }),
  natureCase('ai.solid-wall-blocks-attack', 'A solid wall prevents a nearby zombie from reaching or attacking a villager', async (world) => {
    await world.command('fill ~-2 ~ ~-2 ~3 ~3 ~2 stone hollow', 'fill ~-1 ~ ~-1 ~2 ~2 ~1 air',
      'fill ~1 ~ ~-2 ~1 ~3 ~2 stone',
      'summon villager ~2.5 ~ ~0.5 {Tags:["victim"],NoAI:1b}',
      'summon zombie ~0.5 ~ ~0.5 {Tags:["hunter"],IsBaby:0b,PersistenceRequired:1b}');
    await world.step(120);
    await world.expect('if entity @e[tag=hunter] if entity @e[tag=victim]');
    await world.result('data get entity @e[tag=victim,limit=1] Health', 20);
  }),
  natureCase('ai.villager-profession-from-workstation', 'An unemployed adult villager claims a composter and becomes a farmer', async (world) => {
    await world.command('time set 2000', 'setblock ~2 ~ ~ composter',
      'summon villager ~0.5 ~ ~0.5 {Tags:["worker"],VillagerData:{type:"minecraft:plains",profession:"minecraft:none",level:1}}');
    await world.step(200);
    await world.expect('if entity @e[tag=worker,nbt={VillagerData:{profession:"minecraft:farmer"}}]');
    await world.expect('if data entity @e[tag=worker,limit=1] Brain.memories."minecraft:job_site"');
  }),
  natureCase('ai.villager-loses-untraded-job', 'An untraded villager loses its profession when its claimed workstation disappears', async (world) => {
    await world.command('time set 2000', 'setblock ~2 ~ ~ composter',
      'summon villager ~0.5 ~ ~0.5 {Tags:["worker"],VillagerData:{type:"minecraft:plains",profession:"minecraft:none",level:1}}');
    await world.step(200);
    await world.expect('if entity @e[tag=worker,nbt={VillagerData:{profession:"minecraft:farmer"}}]');
    await world.command('setblock ~2 ~ ~ air');
    await world.step(200);
    await world.expect('if entity @e[tag=worker,nbt={VillagerData:{profession:"minecraft:none"}}]');
    await world.expect('unless data entity @e[tag=worker,limit=1] Brain.memories."minecraft:job_site"');
  }),
  natureCase('ai.nitwit-cannot-claim-job', 'A nitwit remains unemployed despite an available workstation', async (world) => {
    await world.command('time set 2000', 'setblock ~2 ~ ~ composter',
      'summon villager ~0.5 ~ ~0.5 {Tags:["worker"],VillagerData:{type:"minecraft:plains",profession:"minecraft:nitwit",level:1}}');
    await world.step(200);
    await world.expect('if entity @e[tag=worker,nbt={VillagerData:{profession:"minecraft:nitwit"}}]');
    await world.expect('unless data entity @e[tag=worker,limit=1] Brain.memories."minecraft:job_site"');
  }),
  natureCase('ai.baby-cannot-claim-job', 'A baby villager cannot claim a workstation before maturation', async (world) => {
    await world.command('time set 2000', 'setblock ~2 ~ ~ composter',
      'summon villager ~0.5 ~ ~0.5 {Tags:["worker"],Age:-24000,VillagerData:{type:"minecraft:plains",profession:"minecraft:none",level:1}}');
    await world.step(200);
    await world.expect('if entity @e[tag=worker,nbt={VillagerData:{profession:"minecraft:none"}}]');
    await world.expect('unless data entity @e[tag=worker,limit=1] Brain.memories."minecraft:job_site"');
  }),
  natureCase('ai.zombie-villager-conversion', 'A curing zombie villager converts and retains its villager profession', async (world) => {
    await world.command('summon zombie_villager ~ ~ ~ {Tags:["curing"],NoAI:1b,PersistenceRequired:1b,ConversionTime:2,VillagerData:{type:"minecraft:desert",profession:"minecraft:librarian",level:2}}');
    await world.step(1);
    await world.expect('if entity @e[type=zombie_villager,tag=curing]');
    await world.step(1);
    await world.expect('unless entity @e[type=zombie_villager,tag=curing]');
    await world.expect('if entity @e[type=villager,nbt={VillagerData:{type:"minecraft:desert",profession:"minecraft:librarian",level:2}}]');
  }),
  natureCase('ai.zombie-conversion-paused-no-ai', 'A zombie drowned-conversion timer pauses with disabled AI and resumes when AI returns', async (world) => {
    await world.command('summon zombie ~ ~ ~ {Tags:["converting"],NoAI:1b,IsBaby:0b,DrownedConversionTime:2,PersistenceRequired:1b}');
    await world.step(3);
    await world.expect('if entity @e[type=zombie,tag=converting]');
    await world.result('data get entity @e[tag=converting,limit=1] DrownedConversionTime', 2);
    await world.command('data merge entity @e[tag=converting,limit=1] {NoAI:0b}');
    await world.step(3);
    await world.expect('unless entity @e[type=zombie,tag=converting]');
    await world.expect('if entity @e[type=drowned,distance=..5]');
  }),
];
