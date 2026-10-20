import minecraftData from 'minecraft-data';
import { Player } from '../../src/player/player.js';
import { playerScenario } from './scenario.js';

async function victim(player: Player, tag = 'player_victim', x = 0.5, z = 0.5): Promise<number> {
  const spawned = player.session.waitFor('spawn_entity', 'play', ({ data }) => {
    return data.type === minecraftData('1.21.1').entitiesByName.villager?.id;
  });
  await player.world.command(`summon villager ~${x} ~ ~${z} {Tags:["${tag}"],NoAI:1b,Silent:1b,Health:20f}`);
  return Number((await spawned).data.entityId);
}

async function charge(player: Player): Promise<void> {
  await player.world.step(25);
}

export const cases = [
  playerScenario('combat.melee_durability', 'A charged iron sword attack deals six damage and costs one durability', async (p) => {
    const target = await victim(p);
    await p.held('iron_sword');
    await charge(p);
    await p.attack(target);
    await p.world.expect('if entity @e[tag=player_victim,nbt={Health:14f}]');
    await p.world.expect(`if items entity ${p.name} weapon.mainhand iron_sword[damage=1]`);
  }),
  playerScenario('combat.sharpness', 'Sharpness three adds two damage to a charged melee hit', async (p) => {
    const target = await victim(p);
    await p.held('iron_sword[enchantments={levels:{"minecraft:sharpness":3}}]');
    await charge(p);
    await p.attack(target);
    await p.world.expect('if entity @e[tag=player_victim,nbt={Health:12f}]');
    await p.world.expect(`if items entity ${p.name} weapon.mainhand iron_sword[damage=1]`);
  }),
  playerScenario('combat.fire_aspect', 'Fire aspect ignites the attacked entity for four seconds', async (p) => {
    const target = await victim(p);
    await p.held('iron_sword[enchantments={levels:{"minecraft:fire_aspect":1}}]');
    await charge(p);
    await p.attack(target);
    await p.world.expect('if entity @e[tag=player_victim,nbt={Health:14f,Fire:80s}]');
  }),
  playerScenario('combat.unbreakable_weapon', 'An unbreakable weapon damages a target without consuming durability', async (p) => {
    const target = await victim(p);
    await p.held('iron_sword[unbreakable={}]');
    await charge(p);
    await p.attack(target);
    await p.world.expect('if entity @e[tag=player_victim,nbt={Health:14f}]');
    await p.world.expect(`if items entity ${p.name} weapon.mainhand iron_sword[damage=0]`);
  }),
  playerScenario('combat.cooldown_floor', 'Zero attack speed clamps an uncharged attack to the twenty-percent damage floor', async (p) => {
    const first = await victim(p);
    const second = await victim(p, 'second_victim', 2.5, 3.5);
    await p.held('iron_sword');
    await charge(p);
    await p.attack(first);
    await p.world.expect('if entity @e[tag=player_victim,nbt={Health:14f}]');
    await p.world.command(`attribute ${p.name} minecraft:generic.attack_speed base set 0`);
    await p.attack(second);
    await p.world.expect('if entity @e[tag=second_victim,nbt={Health:18.8f}]');
  }),
  playerScenario('combat.hurt_immunity', 'A repeated melee hit during hurt immunity does not deal full damage twice', async (p) => {
    const target = await victim(p);
    await p.held('iron_sword');
    await charge(p);
    await p.attack(target);
    await p.attack(target);
    await p.world.expect('if entity @e[tag=player_victim,nbt={Health:14f}]');
  }),
  playerScenario('combat.shield_front', 'An activated shield blocks a frontal melee attack and loses durability', async (p, context) => {
    const attacker = await Player.join(context, 'B');
    await attacker.teleport(0.5, 0, 0.5);
    await attacker.held('iron_sword');
    await p.world.command(`item replace entity ${p.name} weapon.offhand with shield`);
    p.session.write('use_item', { hand: 1, sequence: 1, rotation: { x: 180, y: 0 } });
    await p.fence();
    // Also let the new player's spawn invulnerability expire.
    await p.world.step(65);
    await attacker.attack(p.entityId);
    await p.world.result(`data get entity ${p.name} Health`, 20);
    await p.world.expect(`if items entity ${p.name} weapon.offhand shield[damage=7]`);
  }),
  playerScenario('combat.shield_rear', 'An activated shield does not block damage arriving from behind', async (p, context) => {
    const attacker = await Player.join(context, 'B');
    await attacker.teleport(0.5, 0, 0.5);
    await attacker.held('iron_sword');
    await p.world.command(`tp ${p.name} ~0.5 ~ ~3.5 0 0`,
      `item replace entity ${p.name} weapon.offhand with shield`);
    p.session.write('use_item', { hand: 1, sequence: 1, rotation: { x: 0, y: 0 } });
    await p.fence();
    await p.world.step(65);
    await attacker.attack(p.entityId);
    await p.world.result(`data get entity ${p.name} Health`, 14);
    await p.world.expect(`if items entity ${p.name} weapon.offhand shield[damage=0]`);
  }),
];
