import { scenario } from '../../src/world/scenario.js';

const arithmetic = [
  ['assign', '=', 7, -4, -4],
  ['add', '+=', 7, -4, 3],
  ['subtract', '-=', 7, -4, 11],
  ['multiply', '*=', -7, -4, 28],
  ['divide-positive', '/=', 7, 3, 2],
  ['divide-negative-dividend', '/=', -7, 3, -3],
  ['divide-negative-divisor', '/=', 7, -3, -3],
  ['remainder-negative-dividend', '%=', -7, 3, 2],
  ['remainder-negative-divisor', '%=', 7, -3, -2],
  ['minimum', '<', 7, -4, -4],
  ['maximum', '>', -7, -4, -4],
  ['add-overflow', '+=', 2147483647, 1, -2147483648],
  ['subtract-underflow', '-=', -2147483648, 1, 2147483647],
  ['multiply-overflow', '*=', 65536, 65536, 0],
  ['divide-overflow', '/=', -2147483648, -1, -2147483648],
] as const;

export const cases = [
  ...arithmetic.map(([id, operator, left, right, expected]) => scenario({
    id: `java.world.scoreboard.${id}`,
    title: `Scoreboard ${id}: ${left} ${operator} ${right} produces ${expected}`,
    reference: 'docs/research-world.md#scoreboard',
    async run(world) {
      await world.command(
        `scoreboard players set #left cts ${left}`,
        `scoreboard players set #right cts ${right}`,
        `scoreboard players operation #left cts ${operator} #right cts`,
      );
      await world.expect(`if score #left cts matches ${expected}`);
      await world.expect(`if score #right cts matches ${right}`, 'Non-swap operations preserve their source');
    },
  })),
  ...['/=', '%='].map((operator) => scenario({
    id: `java.world.scoreboard.${operator === '/=' ? 'divide' : 'remainder'}-zero`,
    title: `${operator} by zero fails without changing the destination`,
    reference: 'docs/research-world.md#scoreboard',
    async run(world) {
      await world.command('scoreboard players set #left cts 17', 'scoreboard players set #right cts 0');
      await world.result(`scoreboard players operation #left cts ${operator} #right cts`, 0);
      await world.expect('if score #left cts matches 17');
    },
  })),
  scenario({
    id: 'java.world.scoreboard.swap', title: 'Swap updates both score holders',
    reference: 'docs/research-world.md#scoreboard',
    async run(world) {
      await world.command('scoreboard players set #left cts 9', 'scoreboard players set #right cts -2',
        'scoreboard players operation #left cts >< #right cts');
      await world.expect('if score #left cts matches -2 if score #right cts matches 9');
    },
  }),
  scenario({
    id: 'java.world.scoreboard.reset', title: 'Reset removes a score instead of setting it to zero',
    reference: 'docs/research-world.md#scoreboard',
    async run(world) {
      await world.command('scoreboard players set #subject cts 0', 'scoreboard players reset #subject cts');
      await world.expect('unless score #subject cts matches -2147483648..2147483647');
    },
  }),
  scenario({
    id: 'java.world.scoreboard.missing-source', title: 'An arithmetic operation creates a missing source with value zero',
    reference: 'docs/research-world.md#scoreboard',
    async run(world) {
      await world.command('scoreboard players set #left cts 3', 'scoreboard players operation #left cts += #missing cts');
      await world.expect('if score #left cts matches 3 if score #missing cts matches 0');
    },
  }),
  ...[true, false].map((success) => scenario({
    id: `java.world.execute.store-success-${success}`,
    title: `Execute store success records ${success ? 'one on success' : 'zero on failure'}`,
    reference: 'docs/research-world.md#commands',
    async run(world) {
      await world.command(`execute store success score #success cts run execute if block ~ ~-1 ~ ${success ? 'stone' : 'dirt'}`);
      await world.expect(`if score #success cts matches ${success ? 1 : 0}`);
    },
  })),
  scenario({
    id: 'java.world.execute.range-inclusive', title: 'Score ranges include both signed endpoints',
    reference: 'docs/research-world.md#commands',
    async run(world) {
      await world.command('scoreboard players set #low cts -5', 'scoreboard players set #high cts 5');
      await world.expect('if score #low cts matches -5..5 if score #high cts matches -5..5');
      await world.expect('unless score #low cts matches -4..4 unless score #high cts matches -4..4');
    },
  }),
  scenario({
    id: 'java.world.execute.fork-result', title: 'Execute as runs every branch and stores each command result',
    reference: 'docs/research-world.md#commands',
    async run(world) {
      for (let index = 0; index < 3; index++) await world.command(`summon marker ~${index} ~ ~ {Tags:["cts_branch"]}`);
      await world.result('execute as @e[tag=cts_branch] run scoreboard players set @s cts 7', 7);
      await world.result('execute if entity @e[tag=cts_branch,scores={cts=7}]', 3);
    },
  }),
];
