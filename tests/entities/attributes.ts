import { scenario } from '../../src/world/scenario.js';

type World = Parameters<Parameters<typeof scenario>[0]['run']>[0];
const subject = '@e[tag=cts_subject,limit=1]';

function attributeCase(id: string, title: string, run: (world: World) => Promise<void>) {
  return scenario({
    id: `java.entities.attributes.${id}`, title,
    reference: 'docs/research-entities.md#attributes',
    run: async (world) => {
      await world.command('summon minecraft:husk ~ ~ ~ {Tags:["cts_subject"],NoAI:1b,NoGravity:1b}');
      await run(world);
    },
  });
}

const arithmetic = [
  { id: 'addition', title: 'Add-value modifier adds to the base', modifiers: ['5 add_value'], expected: 15 },
  { id: 'negative-addition', title: 'Negative add-value modifier subtracts from the base', modifiers: ['-4 add_value'], expected: 6 },
  { id: 'base-multiplier', title: 'Base multiplier adds its fraction of the base', modifiers: ['0.5 add_multiplied_base'], expected: 15 },
  { id: 'total-multiplier', title: 'Total multiplier multiplies the running value', modifiers: ['0.5 add_multiplied_total'], expected: 15 },
  { id: 'addition-before-base', title: 'Base multipliers include add-value modifiers', modifiers: ['4 add_value', '0.5 add_multiplied_base'], expected: 21 },
  { id: 'base-multipliers-sum', title: 'Multiple base multipliers sum their fractions', modifiers: ['0.5 add_multiplied_base', '0.5 add_multiplied_base'], expected: 20 },
  { id: 'total-multipliers-product', title: 'Multiple total multipliers multiply successively', modifiers: ['1 add_multiplied_total', '2 add_multiplied_total'], expected: 60 },
  { id: 'operation-order', title: 'Attribute operations apply addition, base, then total', modifiers: ['1 add_multiplied_total', '0.5 add_multiplied_base', '4 add_value'], expected: 42 },
  { id: 'negative-base-multiplier', title: 'Negative base multiplier reduces the computed value', modifiers: ['-0.5 add_multiplied_base'], expected: 5 },
  { id: 'negative-total-multiplier', title: 'Negative total multiplier reduces the computed value', modifiers: ['-0.5 add_multiplied_total'], expected: 5 },
].map(({ id, title, modifiers, expected }) => attributeCase(id, title, async (world) => {
  await world.command(`attribute ${subject} minecraft:generic.max_health base set 10`);
  for (const [index, modifier] of modifiers.entries()) {
    await world.command(`attribute ${subject} minecraft:generic.max_health modifier add cts:m${index} ${modifier}`);
  }
  await world.result(`attribute ${subject} minecraft:generic.max_health get`, expected);
}));

const clamps = [
  { id: 'health-minimum', attribute: 'max_health', base: -10, expected: 1, scale: 1 },
  { id: 'health-maximum', attribute: 'max_health', base: 2000, expected: 1024, scale: 1 },
  { id: 'armor-minimum', attribute: 'armor', base: -10, expected: 0, scale: 1 },
  { id: 'armor-maximum', attribute: 'armor', base: 100, expected: 30, scale: 1 },
  { id: 'toughness-maximum', attribute: 'armor_toughness', base: 100, expected: 20, scale: 1 },
  { id: 'knockback-resistance-minimum', attribute: 'knockback_resistance', base: -1, expected: 0, scale: 1 },
  { id: 'knockback-resistance-maximum', attribute: 'knockback_resistance', base: 2, expected: 1, scale: 1 },
  { id: 'movement-minimum', attribute: 'movement_speed', base: -1, expected: 0, scale: 1 },
  { id: 'scale-minimum', attribute: 'scale', base: 0, expected: 1, scale: 16 },
  { id: 'scale-maximum', attribute: 'scale', base: 20, expected: 16, scale: 1 },
].map(({ id, attribute, base, expected, scale }) => attributeCase(id, `Computed ${attribute} clamps at its ${id.split('-').at(-1)}`, async (world) => {
  await world.command(`attribute ${subject} minecraft:generic.${attribute} base set ${base}`);
  await world.result(`attribute ${subject} minecraft:generic.${attribute} get ${scale}`, expected);
}));

export const cases = [
  ...arithmetic,
  ...clamps,
  attributeCase('base-is-independent', 'Base queries exclude active modifiers', async (world) => {
    await world.command(`attribute ${subject} minecraft:generic.max_health base set 10`);
    await world.command(`attribute ${subject} minecraft:generic.max_health modifier add cts:bonus 7 add_value`);
    await world.result(`attribute ${subject} minecraft:generic.max_health base get`, 10);
    await world.result(`attribute ${subject} minecraft:generic.max_health get`, 17);
  }),
  attributeCase('base-change-recomputes', 'Changing an attribute base recomputes existing multipliers', async (world) => {
    await world.command(`attribute ${subject} minecraft:generic.max_health modifier add cts:bonus 0.5 add_multiplied_base`);
    await world.command(`attribute ${subject} minecraft:generic.max_health base set 40`);
    await world.result(`attribute ${subject} minecraft:generic.max_health get`, 60);
  }),
  attributeCase('removal-recomputes', 'Removing a modifier restores the computed base value', async (world) => {
    await world.command(`attribute ${subject} minecraft:generic.max_health base set 10`);
    await world.command(`attribute ${subject} minecraft:generic.max_health modifier add cts:bonus 7 add_value`);
    await world.command(`attribute ${subject} minecraft:generic.max_health modifier remove cts:bonus`);
    await world.result(`attribute ${subject} minecraft:generic.max_health get`, 10);
  }),
  attributeCase('duplicate-id-rejected', 'Duplicate modifier IDs do not replace an existing modifier', async (world) => {
    await world.command(`attribute ${subject} minecraft:generic.max_health base set 10`);
    await world.command(`attribute ${subject} minecraft:generic.max_health modifier add cts:bonus 3 add_value`);
    await world.result(`attribute ${subject} minecraft:generic.max_health modifier add cts:bonus 9 add_value`, 0);
    await world.result(`attribute ${subject} minecraft:generic.max_health get`, 13);
  }),
  attributeCase('id-per-attribute', 'The same modifier ID is independent on different attributes', async (world) => {
    await world.command(`attribute ${subject} minecraft:generic.max_health base set 10`);
    await world.command(`attribute ${subject} minecraft:generic.armor base set 0`);
    await world.command(`attribute ${subject} minecraft:generic.max_health modifier add cts:bonus 3 add_value`);
    await world.command(`attribute ${subject} minecraft:generic.armor modifier add cts:bonus 7 add_value`);
    await world.result(`attribute ${subject} minecraft:generic.max_health get`, 13);
    await world.result(`attribute ${subject} minecraft:generic.armor get`, 7);
  }),
  attributeCase('modifier-query', 'Modifier queries return the modifier amount rather than the final value', async (world) => {
    await world.command(`attribute ${subject} minecraft:generic.max_health modifier add cts:bonus 0.5 add_multiplied_total`);
    await world.result(`attribute ${subject} minecraft:generic.max_health modifier value get cts:bonus 100`, 50);
  }),
  attributeCase('speed-effect', 'Speed applies its movement attribute multiplier', async (world) => {
    await world.command(`attribute ${subject} minecraft:generic.movement_speed base set 0.5`);
    await world.command(`effect give ${subject} minecraft:speed 20 0 true`);
    await world.result(`attribute ${subject} minecraft:generic.movement_speed get 100`, 60);
  }),
  attributeCase('slowness-effect', 'Slowness subtracts its movement attribute fraction', async (world) => {
    await world.command(`attribute ${subject} minecraft:generic.movement_speed base set 1`);
    await world.command(`effect give ${subject} minecraft:slowness 20 1 true`);
    // Vanilla promotes the float constant -0.15f to double before applying it.
    await world.result(`attribute ${subject} minecraft:generic.movement_speed get 100`, 69);
  }),
  attributeCase('strength-effect', 'Strength amplifier adds three attack damage per level', async (world) => {
    await world.command(`attribute ${subject} minecraft:generic.attack_damage base set 5`);
    await world.command(`effect give ${subject} minecraft:strength 20 1 true`);
    await world.result(`attribute ${subject} minecraft:generic.attack_damage get`, 11);
  }),
  attributeCase('weakness-removal', 'Clearing weakness removes its attack damage modifier', async (world) => {
    await world.command(`attribute ${subject} minecraft:generic.attack_damage base set 10`);
    await world.command(`effect give ${subject} minecraft:weakness 20 0 true`);
    await world.result(`attribute ${subject} minecraft:generic.attack_damage get`, 6);
    await world.command(`effect clear ${subject} minecraft:weakness`);
    await world.result(`attribute ${subject} minecraft:generic.attack_damage get`, 10);
  }),
];
