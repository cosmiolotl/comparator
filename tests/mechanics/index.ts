import { cases as networkCases } from './networks.js';
import { cases as crafterCases } from './crafters.js';
import { cases as brewingCases } from './brewing.js';
import { cases as minecartCases } from './minecarts.js';
import { cases as defenseCases } from './defenses.js';
import { cases as cloudCases } from './clouds.js';
import { cases as projectileCases } from './projectiles.js';
import { cases as explosionCases } from './explosions.js';
import { cases as windCases } from './wind.js';
import { cases as sorterCases } from './sorters.js';
import { cases as vaultCases } from './vaults.js';
import { cases as trialCases } from './trial-spawners.js';

export const cases = [
  ...networkCases, ...crafterCases, ...brewingCases, ...minecartCases,
  ...defenseCases, ...cloudCases, ...projectileCases, ...explosionCases, ...windCases, ...sorterCases,
  ...vaultCases, ...trialCases,
];
