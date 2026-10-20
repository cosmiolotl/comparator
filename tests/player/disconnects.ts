import assert from 'node:assert/strict';
import { Player } from '../../src/player/player.js';
import { playerScenario } from './scenario.js';

export const cases = [
  playerScenario('lifecycle.invalid_movement', 'A non-finite movement coordinate produces the vanilla disconnect reason', async (p) => {
    const disconnected = p.session.waitForDisconnect();
    p.session.write('position', { ...p.position, x: Number.NaN, onGround: true });
    const packet = await disconnected;
    assert.match(JSON.stringify(packet.data.reason), /multiplayer\.disconnect\.invalid_player_movement/);
  }),
  playerScenario('lifecycle.duplicate_login', 'A second login replaces the first session without duplicating the player', async (p, context) => {
    const disconnected = p.session.waitForDisconnect();
    const replacement = new Player(context, p.name);
    await replacement.session.waitFor('login', 'play');
    await replacement.session.waitFor('position', 'play');
    const packet = await disconnected;
    assert.match(JSON.stringify(packet.data.reason), /multiplayer\.disconnect\.duplicate_login/);
    await replacement.fence();
    await p.world.result(`execute if entity @a[name=${p.name}]`, 1);
  }),
];
