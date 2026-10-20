import { scenario } from '../../src/world/scenario.js';

const gravity = [
  { id: 'sand-landing', block: 'sand', setup: [], destination: 'sand' },
  { id: 'anvil-facing', block: 'anvil[facing=east]', setup: [], destination: 'anvil[facing=east]' },
  { id: 'concrete-water-contact', block: 'white_concrete_powder', setup: ['setblock ~ ~ ~ water'], destination: 'white_concrete' },
  { id: 'concrete-lava-contact', block: 'white_concrete_powder', setup: ['setblock ~ ~ ~ lava'], destination: 'white_concrete_powder' },
  { id: 'sand-through-water', block: 'sand', setup: ['fill ~ ~ ~ ~ ~2 ~ water'], destination: 'sand' },
] as const;

const supported = [
  ['torch', 'torch', '~ ~-1 ~'],
  ['wall-torch', 'wall_torch[facing=east]', '~-1 ~ ~'],
  ['wire', 'redstone_wire', '~ ~-1 ~'],
  ['rail', 'rail', '~ ~-1 ~'],
  ['ladder', 'ladder[facing=east]', '~-1 ~ ~'],
  ['snow', 'snow[layers=1]', '~ ~-1 ~'],
] as const;

export const cases = [
  ...gravity.map(({ id, block, setup, destination }) => scenario({
    id: `java.world.gravity.${id}`, title: `${block} resolves gravity with ${id} behavior`,
    reference: 'docs/research-world.md#blocks',
    async run(world) {
      await world.command(...setup, `setblock ~ ~5 ~ ${block}`);
      await world.step(30);
      await world.expect(`if block ~ ~ ~ ${destination}`);
      await world.expect('if block ~ ~5 ~ air');
    },
  })),
  scenario({
    id: 'java.world.gravity.support-removal', title: 'Removing support schedules a formerly stable sand block to fall',
    reference: 'docs/research-world.md#blocks',
    async run(world) {
      await world.command('setblock ~ ~4 ~ stone', 'setblock ~ ~5 ~ sand');
      await world.step(4);
      await world.expect('if block ~ ~5 ~ sand');
      await world.command('setblock ~ ~4 ~ air');
      await world.step(30);
      await world.expect('if block ~ ~ ~ sand');
    },
  }),
  scenario({
    id: 'java.world.gravity.torch-drop', title: 'Sand falling onto a torch becomes an item instead of a block',
    reference: 'docs/research-world.md#blocks',
    async run(world) {
      await world.command('setblock ~ ~ ~ torch', 'setblock ~ ~5 ~ sand');
      await world.step(30);
      await world.expect('if block ~ ~ ~ torch');
      await world.expect('if entity @e[type=item,nbt={Item:{id:"minecraft:sand",count:1}}]');
    },
  }),
  scenario({
    id: 'java.world.gravity.concrete-side-water', title: 'Concrete powder hardens from adjacent water before falling',
    reference: 'docs/research-world.md#blocks',
    async run(world) {
      await world.command('setblock ~1 ~ ~ water', 'setblock ~ ~ ~ white_concrete_powder');
      await world.expect('if block ~ ~ ~ white_concrete');
    },
  }),
  ...supported.map(([id, block, support]) => scenario({
    id: `java.world.support.${id}`, title: `${id} breaks after its required support is removed`,
    reference: 'docs/research-world.md#blocks',
    async run(world) {
      await world.command(`setblock ${support} stone`, `setblock ~ ~ ~ ${block}`);
      await world.expect(`if block ~ ~ ~ ${block}`);
      await world.command(`setblock ${support} air`);
      await world.step(2);
      await world.expect('if block ~ ~ ~ air');
    },
  })),
  scenario({
    id: 'java.world.support.cactus-adjacent-solid', title: 'A solid horizontal neighbor invalidates cactus placement',
    reference: 'docs/research-world.md#blocks',
    async run(world) {
      await world.command('setblock ~ ~-1 ~ sand', 'setblock ~ ~ ~ cactus', 'setblock ~1 ~ ~ stone');
      await world.step(2);
      await world.expect('if block ~ ~ ~ air');
    },
  }),
  scenario({
    id: 'java.world.support.sugarcane-column', title: 'Removing the bottom cane breaks the unsupported column',
    reference: 'docs/research-world.md#blocks',
    async run(world) {
      await world.command('setblock ~1 ~-1 ~ water', 'setblock ~ ~-1 ~ sand',
        'fill ~ ~ ~ ~ ~2 ~ sugar_cane', 'setblock ~ ~ ~ air');
      await world.step(4);
      await world.expect('if block ~ ~1 ~ air if block ~ ~2 ~ air');
    },
  }),
  ...[
    ['fence-solid', 'oak_fence', 'stone', 'oak_fence[east=true]'],
    ['fence-glass', 'oak_fence', 'glass', 'oak_fence[east=true]'],
    ['pane-glass', 'glass_pane', 'glass', 'glass_pane[east=true]'],
    ['wall-solid', 'cobblestone_wall', 'stone', 'cobblestone_wall[east=low]'],
  ].map(([id, center, neighbor, expected]) => scenario({
    id: `java.world.connections.${id}`, title: `${id} recomputes its connection after a neighbor change`,
    reference: 'docs/research-world.md#blocks',
    async run(world) {
      await world.command(`setblock ~ ~ ~ ${center}`, `setblock ~1 ~ ~ ${neighbor}`);
      await world.expect(`if block ~ ~ ~ ${expected}`);
    },
  })),
  scenario({
    id: 'java.world.fill.volume', title: 'Fill counts an inclusive three dimensional volume',
    reference: 'docs/research-world.md#commands',
    async run(world) {
      await world.result('fill ~ ~ ~ ~2 ~2 ~2 stone', 27);
      await world.expect('if block ~2 ~2 ~2 stone if block ~3 ~2 ~2 air');
    },
  }),
  scenario({
    id: 'java.world.fill.keep', title: 'Fill keep preserves occupied blocks and counts only replacements',
    reference: 'docs/research-world.md#commands',
    async run(world) {
      await world.command('setblock ~1 ~ ~ gold_block');
      await world.result('fill ~ ~ ~ ~2 ~ ~ stone keep', 2);
      await world.expect('if block ~1 ~ ~ gold_block');
    },
  }),
  scenario({
    id: 'java.world.fill.filter', title: 'Fill replace affects only matching source blocks',
    reference: 'docs/research-world.md#commands',
    async run(world) {
      await world.command('fill ~ ~ ~ ~2 ~ ~ stone', 'setblock ~1 ~ ~ dirt');
      await world.result('fill ~ ~ ~ ~2 ~ ~ gold_block replace stone', 2);
      await world.expect('if block ~1 ~ ~ dirt');
    },
  }),
  ...['outline', 'hollow'].map((mode) => scenario({
    id: `java.world.fill.${mode}`, title: `Fill ${mode} ${mode === 'hollow' ? 'clears' : 'preserves'} the interior`,
    reference: 'docs/research-world.md#commands',
    async run(world) {
      await world.command('setblock ~1 ~1 ~1 gold_block', `fill ~ ~ ~ ~2 ~2 ~2 stone ${mode}`);
      await world.expect(`if block ~1 ~1 ~1 ${mode === 'hollow' ? 'air' : 'gold_block'} if block ~2 ~2 ~2 stone`);
    },
  })),
];
