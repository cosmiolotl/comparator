import { Player } from '../../src/player/player.js';
import { featureCase } from './player-features.js';
import { expectLooseItems } from './item-counts.js';

async function vault(player: Player, key = '{id:"minecraft:trial_key",count:1}') {
  await player.world.command(`setblock ~ ~ ~ minecraft:vault{config:{loot_table:"minecraft:blocks/diamond_block",key_item:${key}}}`);
  await player.world.step(20);
  await player.world.expect('if block ~ ~ ~ minecraft:vault[vault_state=active]');
}

async function unlock(player: Player) {
  await player.held('minecraft:trial_key', 2);
  await player.useBlock(0, 0, 0);
  await player.world.expect('if block ~ ~ ~ minecraft:vault[vault_state=unlocking]');
  await player.world.expect(`if items entity ${player.name} weapon.mainhand minecraft:trial_key[count=1]`);
  await player.world.result('data get block ~ ~ ~ server_data.rewarded_players', 1);
}

export const cases = [
  featureCase('vault.player_activation', 'A nearby eligible survival player activates an inactive vault', 'vaults', async (player) => {
    await vault(player);
    await player.world.result('data get block ~ ~ ~ shared_data.connected_players', 1);
    await player.world.expect('unless data block ~ ~ ~ server_data.rewarded_players');
  }),
  featureCase('vault.spectator_excluded', 'Spectators do not activate a vault but become eligible after switching to survival', 'vaults', async (player) => {
    await player.world.command(`gamemode spectator ${player.name}`,
      'setblock ~ ~ ~ minecraft:vault{config:{loot_table:"minecraft:blocks/diamond_block",key_item:{id:"minecraft:trial_key",count:1}}}');
    await player.world.step(20);
    await player.world.expect('if block ~ ~ ~ minecraft:vault[vault_state=inactive]');
    await player.world.command(`gamemode survival ${player.name}`);
    await player.world.step(20);
    await player.world.expect('if block ~ ~ ~ minecraft:vault[vault_state=active]');
  }),
  featureCase('vault.wrong_key', 'A wrong vault key is retained without registering a reward', 'vaults', async (player) => {
    await vault(player);
    await player.held('minecraft:ominous_trial_key');
    await player.useBlock(0, 0, 0);
    await player.world.expect('if block ~ ~ ~ minecraft:vault[vault_state=active]');
    await player.world.expect(`if items entity ${player.name} weapon.mainhand minecraft:ominous_trial_key[count=1]`);
    await player.world.expect('unless data block ~ ~ ~ server_data.rewarded_players');
  }),
  featureCase('vault.key_count', 'A vault requiring two keys rejects one and consumes exactly two when supplied', 'vaults', async (player) => {
    await vault(player, '{id:"minecraft:trial_key",count:2}');
    await player.held('minecraft:trial_key');
    await player.useBlock(0, 0, 0);
    await player.world.expect('if block ~ ~ ~ minecraft:vault[vault_state=active]');
    await player.world.expect(`if items entity ${player.name} weapon.mainhand minecraft:trial_key[count=1]`);
    await player.held('minecraft:trial_key', 3);
    await player.useBlock(0, 0, 0);
    await player.world.expect('if block ~ ~ ~ minecraft:vault[vault_state=unlocking]');
    await player.world.expect(`if items entity ${player.name} weapon.mainhand minecraft:trial_key[count=1]`);
  }),
  featureCase('vault.unlock_boundary', 'A vault waits fourteen ticks before leaving its unlocking phase', 'vaults', async (player) => {
    await vault(player);
    await unlock(player);
    await player.world.step(13);
    await player.world.expect('if block ~ ~ ~ minecraft:vault[vault_state=unlocking]');
    await expectLooseItems(player.world, 'diamond_block', 0, [player.name]);
    await player.world.step(1);
    await player.world.expect('if block ~ ~ ~ minecraft:vault[vault_state=ejecting]');
    await player.world.step(20);
    await expectLooseItems(player.world, 'diamond_block', 1, [player.name]);
  }),
  featureCase('vault.reward_once', 'A player already rewarded by a vault cannot consume a second key for another reward', 'vaults', async (player) => {
    await vault(player);
    await unlock(player);
    await player.world.step(60);
    await expectLooseItems(player.world, 'diamond_block', 1, [player.name]);
    await player.world.expect('if block ~ ~ ~ minecraft:vault[vault_state=inactive]');
    await player.useBlock(0, 0, 0);
    await player.world.step(20);
    await player.world.expect(`if items entity ${player.name} weapon.mainhand minecraft:trial_key[count=1]`);
    await player.world.result('data get block ~ ~ ~ server_data.rewarded_players', 1);
    await expectLooseItems(player.world, 'diamond_block', 1, [player.name]);
  }),
  featureCase('vault.independent_players', 'A second player can unlock the same vault after its first player has been rewarded', 'vaults', async (player, context) => {
    await vault(player);
    await unlock(player);
    await player.world.step(60);
    await expectLooseItems(player.world, 'diamond_block', 1, [player.name]);
    const second = await Player.join(context, '_b');
    await player.world.step(20);
    await player.world.expect('if block ~ ~ ~ minecraft:vault[vault_state=active]');
    await player.world.command(`item replace entity ${second.name} weapon.offhand with minecraft:trial_key`);
    await second.useBlock(0, 0, 0, 1, 1);
    await player.world.expect('if block ~ ~ ~ minecraft:vault[vault_state=unlocking]');
    await player.world.result('data get block ~ ~ ~ server_data.rewarded_players', 2);
    await player.world.expect(`unless items entity ${second.name} weapon.offhand minecraft:trial_key`);
    await player.world.step(60);
    await expectLooseItems(player.world, 'diamond_block', 2, [player.name, second.name]);
    await player.world.expect('if block ~ ~ ~ minecraft:vault[vault_state=inactive]');
  }),
];
