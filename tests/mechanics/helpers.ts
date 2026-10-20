import { scenario } from '../../src/world/scenario.js';
export { expectEmpty, expectStack, inventory, stack } from '../storage/helpers.js';

export type MechanicsWorld = Parameters<Parameters<typeof scenario>[0]['run']>[0];

export function mechanicsCase(
  id: string,
  title: string,
  section: string,
  run: (world: MechanicsWorld) => Promise<void>,
) {
  return scenario({ id: `java.mechanics.${id}`, title, reference: `docs/research-mechanics.md#${section}`, run });
}

export async function testSubject(world: MechanicsWorld, fields = '', entity = 'cow') {
  await world.command(`summon minecraft:${entity} ~0.5 ~ ~0.5 {Tags:["cts_subject"],NoAI:1b,NoGravity:1b,Health:100f,attributes:[{id:"minecraft:generic.max_health",base:100d},{id:"minecraft:generic.armor",base:0d}]${fields}}`);
  await world.expect('if entity @e[tag=cts_subject,nbt={Health:100f}]');
}

export const subject = '@e[tag=cts_subject,limit=1]';
