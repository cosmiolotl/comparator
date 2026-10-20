import offline from './login/offline.js';
import join from './play/join.js';
import ping from './status/ping.js';
import response from './status/response.js';
import type { ConformanceCase } from '../src/suite.js';
import { cases as redstone } from './redstone/index.js';
import { cases as entities } from './entities/index.js';
import { cases as storage } from './storage/index.js';
import { cases as world } from './world/index.js';
import { cases as mechanics } from './mechanics/index.js';
import { cases as persistence } from './persistence/index.js';
import { cases as environment } from './environment/index.js';
import { cases as interactions } from './interactions/index.js';
import { cases as players } from './player/index.js';
import { cases as nature } from './nature/index.js';

export const cases: readonly ConformanceCase[] = [
  response, ping, offline, join, ...world, ...redstone, ...entities, ...storage,
  ...mechanics, ...interactions, ...environment, ...nature, ...players, ...persistence,
];
