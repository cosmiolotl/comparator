import { cases as breeding } from './breeding.js';
import { cases as ai } from './ai.js';
import { cases as randomTicks } from './random-ticks.js';
import { cases as generation } from './generation.js';
import { cases as spawners } from './spawners.js';
import { cases as raids } from './raids.js';
import { cases as constructs } from './constructs.js';
import { cases as farming } from './farming.js';
import { cases as feeding } from './feeding.js';

export const cases = [...breeding, ...ai, ...randomTicks, ...generation, ...spawners, ...raids, ...constructs, ...farming, ...feeding];
