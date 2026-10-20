import type { Player } from '../../src/player/player.js';
import { featureCase } from './player-features.js';
import { expectLooseItems } from './item-counts.js';

async function trial(player: Player) {
  const { x, y, z } = player.world.origin;
  // Trial spawners still apply mob placement rules; keep the ray endpoint just above its grass floor.
  const spawn = `{entity:{id:"minecraft:pig",Tags:["cts_trial_mob"],NoAI:1b,Pos:[${x + 3.5}d,${y + 0.1}d,${z + 0.5}d]},custom_spawn_rules:{block_light_limit:{min_inclusive:0,max_inclusive:15},sky_light_limit:{min_inclusive:0,max_inclusive:15}}}`;
  const config = `{spawn_range:2,total_mobs:1f,simultaneous_mobs:1f,total_mobs_added_per_player:0f,simultaneous_mobs_added_per_player:0f,ticks_between_spawn:1,spawn_potentials:[{weight:1,data:${spawn}}],loot_tables_to_eject:[{weight:1,data:"minecraft:blocks/diamond_block"}]}`;
  await player.world.command('gamerule doMobSpawning true', 'setblock ~3 ~-1 ~ minecraft:grass_block',
    `setblock ~ ~ ~ minecraft:trial_spawner{normal_config:${config},ominous_config:${config},target_cooldown_length:200}`);
}

async function expectSpawned(player: Player) {
  await player.world.expect('if block ~ ~ ~ minecraft:trial_spawner[trial_spawner_state=active]');
  await player.world.result('execute if entity @e[tag=cts_trial_mob]', 1);
  await player.world.result('data get block ~ ~ ~ total_mobs_spawned', 1);
  await player.world.result('data get block ~ ~ ~ current_mobs', 1);
}

export const cases = [
  featureCase('trial.player_activation', 'A trial spawner detects a nearby player and spawns its configured encounter', 'trial-spawners', async (player) => {
    await trial(player);
    await player.world.step(80);
    await expectSpawned(player);
    await player.world.result('data get block ~ ~ ~ registered_players', 1);
    await player.world.step(20);
    await player.world.result('execute if entity @e[tag=cts_trial_mob]', 1);
  }),
  featureCase('trial.spectator_excluded', 'A trial spawner ignores a spectator until that player becomes eligible', 'trial-spawners', async (player) => {
    await player.world.command(`gamemode spectator ${player.name}`);
    await trial(player);
    await player.world.step(40);
    await player.world.expect('unless entity @e[tag=cts_trial_mob]');
    await player.world.expect('if block ~ ~ ~ minecraft:trial_spawner[trial_spawner_state=waiting_for_players]');
    await player.world.command(`gamemode survival ${player.name}`);
    await player.world.step(80);
    await expectSpawned(player);
  }),
  featureCase('trial.spawning_gamerule', 'Disabling mob spawning blocks trial encounters until the gamerule is enabled', 'trial-spawners', async (player) => {
    await trial(player);
    await player.world.command('gamerule doMobSpawning false');
    await player.world.step(40);
    await player.world.expect('unless entity @e[tag=cts_trial_mob]');
    await player.world.command('gamerule doMobSpawning true');
    await player.world.step(80);
    await expectSpawned(player);
  }),
  featureCase('trial.completion_reward_cooldown', 'Completing a trial ejects its reward and enters cooldown without respawning', 'trial-spawners', async (player) => {
    await trial(player);
    await player.world.step(80);
    await expectSpawned(player);
    await player.world.command('kill @e[tag=cts_trial_mob]');
    await player.world.step(100);
    await player.world.expect('if block ~ ~ ~ minecraft:trial_spawner[trial_spawner_state=cooldown]');
    await player.world.expect('unless entity @e[tag=cts_trial_mob]');
    await expectLooseItems(player.world, 'diamond_block', 1, [player.name]);
    await player.world.step(40);
    await player.world.expect('if block ~ ~ ~ minecraft:trial_spawner[trial_spawner_state=cooldown]');
    await player.world.expect('unless entity @e[tag=cts_trial_mob]');
    await expectLooseItems(player.world, 'diamond_block', 1, [player.name]);
  }),
  featureCase('trial.bad_omen_conversion', 'An eligible player Bad Omen changes a trial to ominous and becomes Trial Omen', 'trial-spawners', async (player) => {
    await trial(player);
    await player.world.command(`effect give ${player.name} minecraft:bad_omen infinite 0 true`);
    await player.world.step(40);
    await player.world.expect('if block ~ ~ ~ minecraft:trial_spawner[ominous=true]');
    await player.world.expect(`unless data entity ${player.name} active_effects[{id:"minecraft:bad_omen"}]`);
    await player.world.expect(`if data entity ${player.name} active_effects[{id:"minecraft:trial_omen"}]`);
  }),
];
