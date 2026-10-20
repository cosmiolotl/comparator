import { storageCase, type StorageWorld } from './helpers.js';

const target = 'storage comparator:storage case';

function nbtCase(id: string, title: string, initial: string, run: (world: StorageWorld) => Promise<void>) {
  return storageCase(`nbt.${id}`, title, 'command-storage', async (world) => {
    await world.command(`data modify ${target} set value ${initial}`);
    await run(world);
  });
}

export const nbtCases = [
  nbtCase('recursive_merge', 'Compound merge replaces selected leaves and retains unmentioned siblings', '{nested:{one:1,two:2},keep:3}', async (world) => {
    await world.command(`data modify ${target} merge value {nested:{one:9,three:4}}`);
    await world.expect('if data storage comparator:storage case{nested:{one:9,two:2,three:4},keep:3}');
  }),
  nbtCase('set_replaces_compound', 'Setting a compound removes its previous children', '{nested:{one:1,two:2}}', async (world) => {
    await world.command(`data modify ${target}.nested set value {three:3}`);
    await world.expect('if data storage comparator:storage case.nested{three:3}');
    await world.expect('unless data storage comparator:storage case.nested.one');
    await world.result(`data get ${target}.nested`, 1);
  }),
  nbtCase('append', 'Appending adds a list element after its existing entries', '{list:[1,2]}', async (world) => {
    await world.command(`data modify ${target}.list append value 3`);
    await world.result(`data get ${target}.list[2]`, 3);
    await world.result(`data get ${target}.list`, 3);
  }),
  nbtCase('prepend', 'Prepending shifts existing list entries toward higher indices', '{list:[2,3]}', async (world) => {
    await world.command(`data modify ${target}.list prepend value 1`);
    await world.result(`data get ${target}.list[0]`, 1);
    await world.result(`data get ${target}.list[1]`, 2);
    await world.result(`data get ${target}.list`, 3);
  }),
  nbtCase('insert', 'List insertion places an element before the specified index', '{list:[1,3]}', async (world) => {
    await world.command(`data modify ${target}.list insert 1 value 2`);
    await world.result(`data get ${target}.list[1]`, 2);
    await world.result(`data get ${target}.list[2]`, 3);
  }),
  nbtCase('negative_insert', 'An insertion index of minus one appends to a list', '{list:[1,2]}', async (world) => {
    await world.command(`data modify ${target}.list insert -1 value 3`);
    await world.result(`data get ${target}.list[-1]`, 3);
    await world.result(`data get ${target}.list`, 3);
  }),
  nbtCase('negative_index_write', 'Negative list indices address entries relative to the end', '{list:[1,2,3]}', async (world) => {
    await world.command(`data modify ${target}.list[-2] set value 8`);
    await world.result(`data get ${target}.list[1]`, 8);
    await world.result(`data get ${target}.list[-1]`, 3);
  }),
  nbtCase('remove_compacts_list', 'Removing a list element compacts later entries', '{list:[1,2,3]}', async (world) => {
    await world.command(`data remove ${target}.list[1]`);
    await world.result(`data get ${target}.list`, 2);
    await world.result(`data get ${target}.list[1]`, 3);
  }),
  nbtCase('wildcard_write', 'The list wildcard modifies every matching element', '{list:[{value:1},{value:2},{value:3}]}', async (world) => {
    await world.result(`data modify ${target}.list[].value set value 8`, 3);
    await world.result(`data get ${target}.list[0].value`, 8);
    await world.result(`data get ${target}.list[2].value`, 8);
  }),
  nbtCase('filtered_write', 'A compound list filter changes only entries with matching fields', '{list:[{kind:"a",value:1},{kind:"b",value:2},{kind:"a",value:3}]}', async (world) => {
    await world.command(`data modify ${target}.list[{kind:"a"}].value set value 9`);
    await world.result(`data get ${target}.list[0].value`, 9);
    await world.result(`data get ${target}.list[1].value`, 2);
    await world.result(`data get ${target}.list[2].value`, 9);
  }),
  nbtCase('create_path', 'Data modification creates missing intermediate compounds', '{}', async (world) => {
    await world.command(`data modify ${target}.first.second.third set value 7`);
    await world.expect('if data storage comparator:storage case{first:{second:{third:7}}}');
  }),
  nbtCase('quoted_key', 'Quoted NBT path keys preserve dots and namespace separators', '{}', async (world) => {
    await world.command(`data modify ${target}."cts:key.with.dots" set value 7`);
    await world.result(`data get ${target}."cts:key.with.dots"`, 7);
    await world.expect('unless data storage comparator:storage case.cts');
  }),
  nbtCase('numeric_type_identity', 'NBT matching distinguishes byte and integer values', '{value:1b}', async (world) => {
    await world.expect('if data storage comparator:storage case{value:1b}');
    await world.expect('unless data storage comparator:storage case{value:1}');
    await world.command(`data modify ${target}.value set value 1`);
    await world.expect('if data storage comparator:storage case{value:1}');
    await world.expect('unless data storage comparator:storage case{value:1b}');
  }),
  nbtCase('int_array', 'Integer arrays support indexed access and preserve their array type', '{values:[I;1,2,3]}', async (world) => {
    await world.command(`data modify ${target}.values[1] set value 8`);
    await world.expect('if data storage comparator:storage case{values:[I;1,8,3]}');
    await world.result(`data get ${target}.values`, 3);
  }),
  nbtCase('long_array', 'Long arrays retain values beyond the signed integer range', '{values:[L;2147483648L,9223372036854775807L]}', async (world) => {
    await world.command(`data modify ${target}.copy set from ${target}.values`);
    await world.expect('if data storage comparator:storage case{copy:[L;2147483648L,9223372036854775807L]}');
  }),
  nbtCase('homogeneous_list_rejection', 'Java 1.21.1 lists reject appended entries of a different tag type', '{list:[1,2]}', async (world) => {
    await world.result(`data modify ${target}.list append value "different type"`, 0);
    await world.result(`data get ${target}.list`, 2);
    await world.result(`data get ${target}.list[1]`, 2);
  }),
  nbtCase('negative_floor', 'Numeric data query results round negative fractional values downward', '{value:-1.25d}', async (world) => {
    await world.result(`data get ${target}.value`, -2);
  }),
  nbtCase('numeric_scale', 'Data query applies the scale before flooring its numeric result', '{value:1.25d}', async (world) => {
    await world.result(`data get ${target}.value 10`, 12);
    await world.result(`data get ${target}.value -10`, -13);
  }),
  nbtCase('collection_lengths', 'Data query distinguishes list length, string length, and compound child count', '{list:[4,5,6],text:"hello",object:{a:1,b:{nested:2}}}', async (world) => {
    await world.result(`data get ${target}.list`, 3);
    await world.result(`data get ${target}.text`, 5);
    await world.result(`data get ${target}.object`, 2);
  }),
  nbtCase('string_slice', 'String extraction includes the start index and excludes the end', '{text:"abcdef"}', async (world) => {
    await world.command(`data modify ${target}.slice set string ${target}.text 1 4`);
    await world.expect('if data storage comparator:storage case{slice:"bcd"}');
  }),
  nbtCase('negative_string_slice', 'Negative string slice bounds count from the end', '{text:"abcdef"}', async (world) => {
    await world.command(`data modify ${target}.slice set string ${target}.text -3 -1`);
    await world.expect('if data storage comparator:storage case{slice:"de"}');
  }),
  nbtCase('copy_independence', 'Copied compound data is independent of subsequent source mutation', '{source:{values:[1,2]}}', async (world) => {
    await world.command(`data modify ${target}.copy set from ${target}.source`, `data modify ${target}.source.values[0] set value 9`);
    await world.result(`data get ${target}.copy.values[0]`, 1);
    await world.result(`data get ${target}.source.values[0]`, 9);
  }),
  nbtCase('namespace_isolation', 'Different command storage namespaces retain independent roots', '{value:1}', async (world) => {
    await world.command('data modify storage comparator_other:storage case set value {value:2}');
    await world.result(`data get ${target}.value`, 1);
    await world.result('data get storage comparator_other:storage case.value', 2);
  }),
  nbtCase('dimension_shared', 'Command storage is shared across dimensions', '{value:7}', async (world) => {
    await world.command(`execute in minecraft:the_nether run data modify ${target}.value set value 9`);
    await world.result(`data get ${target}.value`, 9);
  }),
  nbtCase('no_change_result', 'Setting an unchanged NBT value reports no modification', '{value:7}', async (world) => {
    await world.result(`data modify ${target}.value set value 7`, 0);
    await world.result(`data modify ${target}.value set value 8`, 1);
    await world.result(`data get ${target}.value`, 8);
  }),
];
