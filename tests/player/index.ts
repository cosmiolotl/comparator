import { cases as inventory } from './inventory.js';
import { cases as multiplayer } from './multiplayer.js';
import { cases as blocks } from './blocks.js';
import { cases as crafting } from './crafting.js';
import { cases as transitions } from './transitions.js';
import { cases as vehicles } from './vehicles.js';
import { cases as combat } from './combat.js';
import { cases as disconnects } from './disconnects.js';
import { cases as portals } from './portals.js';

export const cases = [...inventory, ...multiplayer, ...blocks, ...crafting, ...transitions, ...vehicles, ...combat, ...disconnects, ...portals];
