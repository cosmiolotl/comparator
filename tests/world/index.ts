import { cases as blocks } from './blocks.js';
import { cases as commands } from './commands.js';
import { cases as environment } from './environment.js';
import { cases as fluids } from './fluids.js';
import { cases as ticks } from './ticks.js';
import { cases as chunks } from './chunk-lifecycle.js';

export const cases = [...commands, ...blocks, ...fluids, ...ticks, ...environment, ...chunks];
