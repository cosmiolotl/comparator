import { redstoneCase } from './helpers.js';

const thresholds = [
  { kind: 'light', entities: 1, output: 1 },
  { kind: 'light', entities: 15, output: 15 },
  { kind: 'light', entities: 16, output: 15 },
  { kind: 'heavy', entities: 10, output: 1 },
  { kind: 'heavy', entities: 11, output: 2 },
  { kind: 'heavy', entities: 150, output: 15 },
] as const;

export const cases = thresholds.map(({ kind, entities, output }) =>
  redstoneCase(`pressure.${kind}-${entities}-entities`, `${kind} weighted plate produces ${output} from ${entities} separate item entities`, async (world) => {
    const block = `${kind}_weighted_pressure_plate`;
    await world.command(`setblock ~ ~ ~ minecraft:${block}`);
    await world.expect(`if block ~ ~ ~ minecraft:${block}[power=0]`);
    for (let index = 0; index < entities; index++) {
      // Unique custom data prevents merging from changing the entity count.
      await world.command(`summon minecraft:item ~0.5 ~0.1 ~0.5 {Tags:["cts_weight"],NoGravity:1b,Item:{id:"minecraft:stone",count:1,components:{"minecraft:custom_data":{cts_weight:${index}}}}}`);
    }
    await world.step(1);
    await world.expect(`if block ~ ~ ~ minecraft:${block}[power=${output}]`);
    await world.result('execute if entity @e[tag=cts_weight]', entities);
  }),
);
