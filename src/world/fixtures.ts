import type { SuiteConfig } from '../config.js';
import { Rcon } from '../control/rcon.js';
import { World } from './world.js';

export async function connectControl(config: SuiteConfig, signal: AbortSignal): Promise<Rcon> {
  if (!config.control) throw new Error('Missing RCON control configuration');
  const { host, port, passwordEnv } = config.control;
  const password = process.env[passwordEnv];
  if (!password) throw new Error(`Set the RCON password environment variable ${passwordEnv}`);
  return Rcon.connect(host, port, password, signal);
}

export async function createWorld(config: SuiteConfig, signal: AbortSignal, arena: number): Promise<World> {
  const connection = await connectControl(config, signal);
  return new World(connection, { x: 1000000 + arena * 64, y: 160, z: 1000000 }, signal);
}

export async function releaseWorld(config: SuiteConfig, world: World, signal: AbortSignal): Promise<void> {
  const connection = await connectControl(config, signal);
  const { x, y, z } = world.origin;
  try {
    await connection.command(`execute positioned ${x}.0 ${y}.0 ${z}.0 run kill @e[type=!minecraft:player,distance=..100]`);
    await connection.command(`execute positioned ${x}.0 ${y}.0 ${z}.0 run forceload remove ~-16 ~-16 ~31 ~31`);
  } finally {
    connection.close();
  }
}

export async function restoreClock(config: SuiteConfig, signal: AbortSignal): Promise<void> {
  const connection = await connectControl(config, signal);
  try {
    await connection.command('tick freeze');
    await connection.command('tick rate 20');
    await connection.command('tick unfreeze');
  } finally {
    connection.close();
  }
}
