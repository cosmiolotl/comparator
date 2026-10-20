import { scenario } from '../../src/world/scenario.js';

export const cases = [
  scenario({
    id: 'java.world.chunks.container-components', title: 'Container components survive saving and removal and restoration of ticking tickets',
    reference: 'docs/research-world.md#chunk-lifecycle',
    async run(world) {
      await world.command('setblock ~ ~ ~ chest',
        'item replace block ~ ~ ~ container.26 with diamond[minecraft:custom_data={cts:19}] 37');
      await world.cycleChunkTickets();
      await world.expect('if data block ~ ~ ~ Items[{Slot:26b,id:"minecraft:diamond",count:37,components:{"minecraft:custom_data":{cts:19}}}]');
    },
  }),
  scenario({
    id: 'java.world.chunks.furnace-progress', title: 'Frozen furnace counters survive a chunk ticking ticket cycle',
    reference: 'docs/research-world.md#chunk-lifecycle',
    async run(world) {
      await world.command('setblock ~ ~ ~ furnace{BurnTime:80s,CookTime:72s,CookTimeTotal:200s,Items:[{Slot:0b,id:"minecraft:raw_iron",count:3}]}');
      await world.cycleChunkTickets();
      await world.expect('if data block ~ ~ ~ {BurnTime:80s,CookTime:72s,CookTimeTotal:200s}');
    },
  }),
  scenario({
    id: 'java.world.chunks.block-state', title: 'Block properties survive saving and a chunk ticking ticket cycle',
    reference: 'docs/research-world.md#chunk-lifecycle',
    async run(world) {
      await world.command('setblock ~ ~ ~ oak_stairs[facing=west,half=top,shape=straight,waterlogged=true]');
      await world.cycleChunkTickets();
      await world.expect('if block ~ ~ ~ oak_stairs[facing=west,half=top,shape=straight,waterlogged=true]');
    },
  }),
  scenario({
    id: 'java.world.chunks.entity-data', title: 'Saved entity data is observable when chunk ticking resumes',
    reference: 'docs/research-world.md#chunk-lifecycle',
    async run(world) {
      await world.command('summon marker ~1 ~ ~ {Tags:["cts_saved_entity"],data:{sentinel:43}}');
      await world.cycleChunkTickets();
      await world.step(1);
      await world.expect('if entity @e[type=marker,tag=cts_saved_entity,nbt={data:{sentinel:43}}]');
    },
  }),
  scenario({
    id: 'java.world.chunks.scheduled-fluid-tick', title: 'A pending fluid tick retains its delay across a chunk ticket cycle',
    reference: 'docs/research-world.md#chunk-lifecycle',
    async run(world) {
      await world.command('setblock ~ ~1 ~ water');
      await world.cycleChunkTickets();
      await world.step(4);
      await world.expect('if block ~ ~ ~ air');
      await world.step(1);
      await world.expect('if block ~ ~ ~ water[level=8]');
    },
  }),
  scenario({
    id: 'java.world.chunks.chunk-boundary', title: 'Block entities across a chunk edge retain distinct inventories through a ticket cycle',
    reference: 'docs/research-world.md#chunk-lifecycle',
    async run(world) {
      await world.command('setblock ~15 ~ ~ barrel', 'setblock ~16 ~ ~ barrel',
        'item replace block ~15 ~ ~ container.0 with iron_ingot 7',
        'item replace block ~16 ~ ~ container.0 with gold_ingot 13');
      await world.cycleChunkTickets();
      await world.expect('if data block ~15 ~ ~ Items[{Slot:0b,id:"minecraft:iron_ingot",count:7}]');
      await world.expect('if data block ~16 ~ ~ Items[{Slot:0b,id:"minecraft:gold_ingot",count:13}]');
    },
  }),
];
