import { scenario } from '../../src/world/scenario.js';

export type StorageWorld = Parameters<Parameters<typeof scenario>[0]['run']>[0];

export function storageCase(
  id: string,
  title: string,
  section: string,
  run: (world: StorageWorld) => Promise<void>,
) {
  return scenario({ id: `java.storage.${id}`, title, reference: `docs/research-storage.md#${section}`, run });
}

export function stack(slot: number, id: string, count = 1, components?: string): string {
  const extra = components ? `,components:${components}` : '';
  return `{Slot:${slot}b,id:"minecraft:${id}",count:${count}${extra}}`;
}

export function inventory(entries: readonly string[]): string {
  return `{Items:[${entries.join(',')}]}`;
}

export async function expectStack(world: StorageWorld, position: string, slot: number, id: string, count = 1) {
  await world.expect(`if data block ${position} Items[${stack(slot, id, count)}]`);
}

export async function expectEmpty(world: StorageWorld, position: string) {
  await world.expect(`if data block ${position} Items`);
  await world.result(`data get block ${position} Items`, 0);
}

export async function pulse(world: StorageWorld, ticks = 4) {
  await world.command('setblock ~-1 ~1 ~ minecraft:redstone_block');
  await world.step(ticks);
}
