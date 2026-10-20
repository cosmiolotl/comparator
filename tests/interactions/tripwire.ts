import type { World } from '../../src/world/world.js';
import { interactionCase } from './helpers.js';

async function line(world: World): Promise<void> {
  await world.command('setblock ~-1 ~ ~ stone', 'setblock ~5 ~ ~ stone',
    'setblock ~ ~ ~ tripwire_hook[facing=east]', 'setblock ~4 ~ ~ tripwire_hook[facing=west]',
    'fill ~1 ~ ~ ~3 ~ ~ tripwire');
  await world.step(10);
  await world.expect('if block ~ ~ ~ tripwire_hook[attached=true,powered=false] if block ~4 ~ ~ tripwire_hook[attached=true,powered=false]');
}

export const cases = [
  interactionCase('tripwire.item-triggers-both-hooks', 'An item touching connected tripwire powers both hooks', async (world) => {
    await line(world);
    await world.command('summon item ~2.5 ~0.05 ~0.5 {Tags:["trigger"],NoGravity:1b,Item:{id:"minecraft:stone",count:1}}');
    await world.step(1);
    await world.expect('if block ~2 ~ ~ tripwire[powered=true] if block ~ ~ ~ tripwire_hook[powered=true] if block ~4 ~ ~ tripwire_hook[powered=true]');
  }),
  interactionCase('tripwire.item-release-delay', 'Tripwire releases on its ten-tick entity recheck after the item leaves', async (world) => {
    await line(world);
    await world.command('summon item ~2.5 ~0.05 ~0.5 {Tags:["trigger"],NoGravity:1b,Item:{id:"minecraft:stone",count:1}}');
    await world.step(1);
    await world.expect('if block ~ ~ ~ tripwire_hook[powered=true]');
    await world.command('kill @e[tag=trigger]');
    await world.step(9);
    await world.expect('if block ~ ~ ~ tripwire_hook[powered=true]');
    await world.step(1);
    await world.expect('if block ~2 ~ ~ tripwire[powered=false] if block ~ ~ ~ tripwire_hook[powered=false] if block ~4 ~ ~ tripwire_hook[powered=false]');
  }),
  interactionCase('tripwire.break-armed-line', 'Breaking armed tripwire emits a temporary powered hook state before detaching', async (world) => {
    await line(world);
    await world.command('setblock ~2 ~ ~ air');
    await world.expect('if block ~ ~ ~ tripwire_hook[powered=true] if block ~4 ~ ~ tripwire_hook[powered=true]');
    await world.step(10);
    await world.expect('if block ~ ~ ~ tripwire_hook[attached=false,powered=false] if block ~4 ~ ~ tripwire_hook[attached=false,powered=false]');
  }),
  interactionCase('tripwire.break-disarmed-line', 'Removing disarmed tripwire suppresses the hook notification until another segment changes', async (world) => {
    await line(world);
    await world.command('setblock ~2 ~ ~ tripwire[disarmed=true,attached=true,east=true,west=true]', 'setblock ~2 ~ ~ air');
    await world.expect('if block ~ ~ ~ tripwire_hook[powered=false] if block ~4 ~ ~ tripwire_hook[powered=false]');
    await world.step(10);
    await world.expect('if block ~ ~ ~ tripwire_hook[attached=true,powered=false]');
    await world.command('setblock ~1 ~ ~ air');
    await world.step(10);
    await world.expect('if block ~ ~ ~ tripwire_hook[attached=false,powered=false]');
  }),
  interactionCase('tripwire.missing-opposite-hook', 'An interrupted tripwire line cannot attach with only one hook', async (world) => {
    await line(world);
    await world.command('setblock ~4 ~ ~ air');
    await world.step(10);
    await world.expect('if block ~ ~ ~ tripwire_hook[attached=false,powered=false] if block ~2 ~ ~ tripwire[attached=false]');
  }),
  interactionCase('tripwire.marker-does-not-trigger', 'A marker entity overlapping tripwire does not trigger it', async (world) => {
    await line(world);
    await world.command('summon marker ~2.5 ~0.05 ~0.5 {Tags:["trigger"]}');
    await world.step(10);
    await world.expect('if entity @e[tag=trigger,type=marker]');
    await world.expect('if block ~2 ~ ~ tripwire[powered=false] if block ~ ~ ~ tripwire_hook[powered=false]');
  }),
];
