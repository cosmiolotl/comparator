import type { ConformanceCase } from '../../src/suite.js';
import type { World } from '../../src/world/world.js';
import { cases as playerCases } from './players.js';

interface PersistenceContract {
  id: string;
  title: string;
  setup(world: World): Promise<void>;
  verify(world: World): Promise<void>;
}

const contracts: PersistenceContract[] = [
  {
    id: 'container-components', title: 'Sparse inventories and nested components survive reopening the world',
    setup: (world) => world.command('setblock ~ ~ ~ chest',
      'item replace block ~ ~ ~ container.26 with shulker_box[container=[{slot:4,item:{id:"minecraft:diamond",count:7,components:{"minecraft:custom_data":{sentinel:19L}}}}]]',
      'item replace block ~ ~ ~ container.2 with stone[max_stack_size=2,custom_data={label:"saved"}] 2'),
    verify: async (world) => {
      await world.result('data get block ~ ~ ~ Items', 2);
      await world.expect('if items block ~ ~ ~ container.2 stone[count=2,max_stack_size=2,custom_data={label:"saved"}]');
      await world.expect('if items block ~ ~ ~ container.26 shulker_box[container=[{slot:4,item:{id:"minecraft:diamond",count:7,components:{"minecraft:custom_data":{sentinel:19L}}}}]]');
    },
  },
  {
    id: 'storage-scores', title: 'Command storage types, scores, and absent scores survive process restart',
    setup: (world) => world.command(`data merge storage comparator:persist {value:{small:7b,large:9000000000L,list:[I;1,-2,3],arena:${world.origin.x}}}`,
      'scoreboard players set #saved cts -2147483648', `scoreboard players set #arena cts ${world.origin.x}`,
      'scoreboard players reset #absent cts'),
    verify: async (world) => {
      await world.expect(`if data storage comparator:persist {value:{small:7b,large:9000000000L,list:[I;1,-2,3],arena:${world.origin.x}}}`);
      await world.expect('if score #saved cts matches -2147483648');
      await world.expect(`if score #arena cts matches ${world.origin.x}`);
      await world.expect('unless score #absent cts matches -2147483648..2147483647');
    },
  },
  {
    id: 'block-state', title: 'Waterlogging, orientation, and latched block state survive reopening',
    setup: (world) => world.command('setblock ~ ~ ~ oak_stairs[facing=west,half=top,waterlogged=true]',
      'setblock ~3 ~ ~ copper_bulb[lit=true,powered=false]'),
    verify: async (world) => {
      await world.expect('if block ~ ~ ~ oak_stairs[facing=west,half=top,waterlogged=true]');
      await world.expect('if block ~3 ~ ~ copper_bulb[lit=true,powered=false]');
    },
  },
  {
    id: 'entity-passengers', title: 'Entity identity and passenger links survive disk loading',
    setup: (world) => world.command('summon boat ~ ~ ~ {Tags:["cts_saved_boat"],NoGravity:1b,Passengers:[{id:"minecraft:pig",Tags:["cts_saved_rider"],NoAI:1b,NoGravity:1b,Health:7f}]}',
      'execute as @e[tag=cts_saved_boat,limit=1] run data modify storage comparator:persist boat set from entity @s UUID',
      'execute as @e[tag=cts_saved_rider,limit=1] run data modify storage comparator:persist rider set from entity @s UUID'),
    verify: async (world) => {
      await world.result('execute if entity @e[tag=cts_saved_boat]', 1);
      await world.result('execute if entity @e[tag=cts_saved_rider]', 1);
      await world.result('data get entity @e[tag=cts_saved_boat,limit=1] UUID', 4);
      await world.result('data get entity @e[tag=cts_saved_rider,limit=1] UUID', 4);
      await world.result('data get storage comparator:persist boat', 4);
      await world.result('data get storage comparator:persist rider', 4);
      // With both UUID arrays present, an unchanged copy must report no modification.
      await world.result('execute as @e[tag=cts_saved_boat,limit=1] run data modify storage comparator:persist boat set from entity @s UUID', 0);
      await world.result('execute as @e[tag=cts_saved_rider,limit=1] run data modify storage comparator:persist rider set from entity @s UUID', 0);
      await world.expect('if entity @e[tag=cts_saved_boat,nbt={Passengers:[{Tags:["cts_saved_rider"],Health:7f}]}]');
    },
  },
  {
    id: 'furnace-progress', title: 'Furnace progress resumes at the saved completion boundary',
    setup: (world) => world.command('setblock ~ ~ ~ furnace',
      'item replace block ~ ~ ~ container.0 with raw_iron',
      'data merge block ~ ~ ~ {BurnTime:50s,CookTime:198s,CookTimeTotal:200s}'),
    verify: async (world) => {
      await world.expect('if data block ~ ~ ~ {BurnTime:50s,CookTime:198s,CookTimeTotal:200s}');
      await world.step(1);
      await world.expect('unless data block ~ ~ ~ Items[{Slot:2b}]');
      await world.step(1);
      await world.expect('if data block ~ ~ ~ Items[{Slot:2b,id:"minecraft:iron_ingot",count:1}]');
    },
  },
  {
    id: 'hopper-cooldown', title: 'Hopper transfer cooldown survives restarting and expires on its saved boundary',
    setup: (world) => world.command('setblock ~ ~ ~ barrel',
      'setblock ~ ~1 ~ hopper[facing=down]{TransferCooldown:3,Items:[{Slot:0b,id:"minecraft:stone",count:2}]}'),
    verify: async (world) => {
      await world.result('data get block ~ ~1 ~ TransferCooldown', 3);
      await world.step(2);
      await world.expect('unless data block ~ ~ ~ Items[]');
      await world.step(1);
      await world.expect('if data block ~ ~ ~ Items[{Slot:0b,id:"minecraft:stone",count:1}]');
      await world.expect('if data block ~ ~1 ~ Items[{Slot:0b,id:"minecraft:stone",count:1}]');
    },
  },
  {
    id: 'scheduled-fluid', title: 'A saved fluid tick retains its remaining delay across restart',
    setup: async (world) => {
      await world.command('setblock ~ ~1 ~ water');
      await world.step(2);
      await world.expect('if block ~ ~ ~ air');
    },
    verify: async (world) => {
      await world.step(2);
      await world.expect('if block ~ ~ ~ air');
      await world.step(1);
      await world.expect('if block ~ ~ ~ water[level=8]');
    },
  },
  {
    id: 'item-lifetime', title: 'Saved item age and components resume without duplication',
    setup: (world) => world.command('summon item ~ ~2 ~ {Tags:["cts_saved_item"],NoGravity:1b,Age:5998s,PickupDelay:200s,Item:{id:"minecraft:diamond",count:3,components:{"minecraft:custom_data":{marker:71}}}}'),
    verify: async (world) => {
      await world.result('execute if entity @e[tag=cts_saved_item]', 1);
      await world.expect('if entity @e[tag=cts_saved_item,nbt={Age:5998s,PickupDelay:200s,Item:{id:"minecraft:diamond",count:3,components:{"minecraft:custom_data":{marker:71}}}}]');
      await world.step(1);
      await world.expect('if entity @e[tag=cts_saved_item,nbt={Age:5999s}]');
      await world.step(1);
      await world.expect('unless entity @e[tag=cts_saved_item]');
    },
  },
];

export const cases: ConformanceCase[] = [...playerCases, ...['clean', 'crash'].flatMap((mode) => contracts.map((contract): ConformanceCase => ({
  id: `java.persistence.${mode}.${contract.id}`,
  title: `${contract.title} (${mode === 'clean' ? 'orderly shutdown' : 'process kill after save flush'})`,
  requires: mode === 'clean' ? ['world', 'restart'] : ['world', 'restart', 'crashRecovery'],
  versions: ['1.21.1'],
  reference: 'docs/research-persistence.md#save-boundary',
  async run({ world, restart }) {
    if (!world || !restart) throw new Error('Persistence requires a controlled world and restart hook');
    await contract.setup(world);
    await restart(mode === 'clean' ? 'clean' : 'crash');
    await contract.verify(world);
    world.verifyAssertions();
  },
})))];
