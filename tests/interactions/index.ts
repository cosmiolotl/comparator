import { cases as timing } from './timing.js';
import { cases as fluids } from './fluids.js';
import { cases as geometry } from './geometry.js';
import { cases as pistons } from './pistons.js';
import { cases as targets } from './targets.js';
import { cases as tripwire } from './tripwire.js';
import { cases as sculk } from './sculk.js';
import { cases as chunks } from './chunks.js';

export const cases = [...timing, ...fluids, ...geometry, ...pistons, ...targets, ...tripwire, ...sculk, ...chunks];
