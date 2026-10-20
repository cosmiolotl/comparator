import { cases as comparators } from './comparators.js';
import { cases as controls } from './controls.js';
import { cases as lighting } from './lighting.js';
import { cases as notes } from './notes.js';
import { cases as observers } from './observers.js';
import { cases as pistons } from './pistons.js';
import { cases as pressure } from './pressure.js';
import { cases as rails } from './rails.js';
import { cases as repeaters } from './repeaters.js';
import { cases as torches } from './torches.js';
import { cases as wire } from './wire.js';

export const cases = [
  ...wire, ...repeaters, ...comparators, ...pistons, ...observers,
  ...torches, ...lighting, ...controls, ...rails, ...pressure, ...notes,
];
