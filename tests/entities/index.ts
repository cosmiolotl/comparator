import { cases as attributes } from './attributes.js';
import { cases as combat } from './combat.js';
import { cases as items } from './items.js';
import { cases as physics } from './physics.js';
import { cases as relationships } from './relationships.js';
import { cases as timers } from './timers.js';

export const cases = [...attributes, ...combat, ...timers, ...items, ...relationships, ...physics];
