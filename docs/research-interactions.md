# Interaction evidence for Java 1.21.1

All cases here are command-driven integration tests against the official unmodified Java
1.21.1 server. RCON arranges fixtures; block states, block entities, entity positions, and
exact game-time boundaries are the observations. Each expectation is fixed independently
of the target implementation.

Primary artifacts:

- [Mojang server JAR](https://piston-data.mojang.com/v1/objects/59353fb40c36d304f2035d51e7d6e6baa98dc05c/server.jar),
  SHA-1 `59353fb40c36d304f2035d51e7d6e6baa98dc05c`.
- [Mojang official server mappings](https://piston-data.mojang.com/v1/objects/03f8985492bda0afc0898465341eb0acef35f570/server.txt),
  SHA-1 `03f8985492bda0afc0898465341eb0acef35f570`.
- Targeted local `javap -p -c` inspection of those artifacts supplied the implementation
  evidence below. This repository does not redistribute decompiled server source.

## Timing

`DiodeBlock`, `RepeaterBlock`, `RedstoneLampBlock`, `RedstoneTorchBlock`, and
`LevelTicks` establish scheduled updates, locking, de-duplication, and burnout.
Tests distinguish state changes before tick processing from scheduled block ticks.
Replacing a block with a different block discards a pending type-specific update;
reintroducing the same block at that position can consume its earlier update.

Seven rapid torch shutdowns still permit relighting. The eighth burns the torch out.
Recovery is checked immediately before and at the scheduled 160-tick recovery, measured
from the eighth shutdown rather than the end of the final on/off cycle.
Returning a repeater input before its falling tick keeps the output on. Locking either
a pending rise or fall suppresses that transition until unlocking schedules a fresh delay.

## Pistons

`PistonBaseBlock` (`dsv`), `PistonMovingBlockEntity` (`dsy`), and
`PistonStructureResolver` establish block-event ordering, short-pulse handling, moving
block state, break reactions, collision displacement, and sticky-block behavior.

One- and two-tick sticky-piston inputs leave the pushed block behind; the tested
three-tick input retrieves it. Opposing pistons competing for the same head position
follow the deliberately ordered block events. Both construction orders have independent
expected results. A moved observer emits its own post-movement pulse.

Pushing a waterlogged slab drains its moved state. Poppy, dust, and torch are destroyed
with item drops instead of moving as solid blocks. Entity observations distinguish
the honey block's inset collision surface from a full block and slime's imparted
velocity. An armor stand's no-gravity fixture isolates piston displacement from
subsequent ordinary movement. A 0.001-block comparison tolerance covers floating-point
representation only; it does not allow a materially different push distance.

## Fluids

`FlowingFluid`, `WaterFluid`, `LavaFluid`, `SpongeBlock`, and `BubbleColumnBlock`
establish scheduled flow and contact behavior. Cases remove and replace a source before
its scheduled tick, drain a confined channel, distinguish contact ordering, and check
downward lava into water separately from adjacent source hardening.

Water breaks redstone dust with its item drop. Both open and closed fence gates block
flow. Waterlogged slabs participate in lava hardening. Bubble columns propagate base
changes and stop above solid obstructions.

## Geometry

The same delayed redstone transition and fluid update are independently checked in
chunk interiors, each horizontal edge direction, and corners. Additional cases cover
negative chunk coordinates, corner-shaped dust attenuation, and a vertical piston
crossing a 16-block section boundary. Coordinates remain aligned to fresh fixture
arenas. These are selected permutations, not a claim that every circuit has rotational
symmetry or that construction order is irrelevant.

## Targets

[Mojang's target introduction](https://www.minecraft.net/en-us/article/block-week--target)
describes projectile-dependent target activation and signal strength by impact location.
`TargetBlock` (`dog`) supplies the exact square-distance signal formula, 20-tick arrow
duration, 8-tick other-projectile duration, and rejection of strength/duration changes
while an existing target tick is pending.

The cases launch actual arrows and snowballs with fixed motion and no gravity. They
observe both the target and downstream dust at center, offset, edge, and corner impacts.
These are actual projectile collisions, not preconfigured target power states.

## Tripwire

`TripWireBlock` (`dop`) and `TripWireHookBlock` (`doq`) establish line attachment,
entity detection, ten-tick rechecks, and armed/disarmed removal behavior.

Tests assemble hooks and string, then use a real item entity to activate the line.
They check both hooks, release timing, armed removal pulses, missing opposite hooks,
and a marker entity that must not trigger. Disarmed command removal intentionally
suppresses source notification: the hooks retain their unpowered attached state until
another string segment changes. This test does not claim to cover the player's shears
packet or item durability.

## Sculk

[Mojang's 1.20 release notes](https://feedback.minecraft.net/hc/en-us/articles/16499677456781-Minecraft-Java-Edition-1-20-Trails-Tales)
document the current sensor phases, filtering, frequency groups, and neighboring-chunk
requirements. `SculkSensorBlock` (`dms`), `CalibratedSculkSensorBlock` (`dgl`),
their block entities, and `VibrationSystem` provide the pinned 1.21.1 details.

Sensors receive vibrations emitted by actual trapdoor transitions. Tests check travel
time, attenuation, regular/calibrated active phases, cooldown boundaries, wool
occlusion with a positive control after removal, waterlogging, filtering, and the
comparator's frequency output. Opening is frequency 10; closing is frequency 9.
Same-tick competing events select the closer source even when it was emitted second.
Events received while active are discarded, with a subsequent ready-state activation
confirming the fixture remains live.

## Chunks

Chunk entity-ticking readiness and block-ticking eligibility are distinct states.
Removing one corner's force-load ticket while neighboring tickets remain can stop
entity ticking without stopping scheduled block or fluid ticks. The suite checks
those transitions explicitly instead of treating `execute if loaded` as proof of disk
eviction or the absence of block ticking.

A separate sculk fixture retains only a northwest ticket. Its neighboring central
chunk still ticks blocks, but the next neighbors no longer meet sculk's readiness
requirement. A vibration stays queued until the surrounding tickets return.
Readiness is observed from server state, never inferred from a fixed sleep.
All altered ticket layouts are restored in `finally` blocks.

## Validation

The complete interaction family passed 84/84 cases twice on the official server. Deliberate
live fixture changes that stopped an arrow, replaced wool with stone, and removed the
side-repeater lock each made its associated assertion fail. These checks exercise
failure sensitivity without accepting modified target behavior.
