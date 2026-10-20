import { analogCases } from './analog.js';
import { cloningCases } from './cloning.js';
import { componentCases } from './components.js';
import { dispenserCases } from './dispensers.js';
import { furnaceCases } from './furnaces.js';
import { hopperCases } from './hoppers.js';
import { nbtCases } from './nbt.js';

export const cases = [
  ...analogCases,
  ...hopperCases,
  ...furnaceCases,
  ...dispenserCases,
  ...componentCases,
  ...nbtCases,
  ...cloningCases,
];
