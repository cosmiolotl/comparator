# Redstone contracts for Java 1.21.1

These 150 scenarios exercise server behavior through commands, block states, entity
queries, and comparator block-entity output. They are end-to-end conformance cases,
not unit tests. Their version gate is deliberate: they do not claim that all Java
versions share these rules or that 150 cases exhaust redstone behavior.

Research used Mojang's [1.21.1 release](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-21-1),
the [official server artifact](https://piston-data.mojang.com/v1/objects/59353fb40c36d304f2035d51e7d6e6baa98dc05c/server.jar),
and [official server mappings](https://piston-data.mojang.com/v1/objects/03f8985492bda0afc0898465341eb0acef35f570/server.txt).
The artifact SHA-1 is `59353fb40c36d304f2035d51e7d6e6baa98dc05c`; the mappings
SHA-1 is `03f8985492bda0afc0898465341eb0acef35f570`. The nested
`versions/1.21.1/server-1.21.1.jar` was inspected with `javap -c -p`, resolving
obfuscated names using those mappings. No server implementation code is vendored.

Timing uses game ticks. Mojang documents frozen simulation and explicit stepping
in [23w43a](https://www.minecraft.net/en-us/article/minecraft-snapshot-23w43a).
Each case has an isolated, loaded arena, a stone floor, frozen simulation, and
disabled random ticks. A wall-clock delay is never an assertion of elapsed game
time. Assertions immediately before and at a scheduled transition distinguish an
incorrect early transition from an incorrect late transition.

The [24w33a redstone experiment](https://www.minecraft.net/en-us/article/minecraft-snapshot-24w33a)
postdates 1.21.1 and explicitly changes wire update ordering. Those experimental
rules are not an oracle for these cases. Race outcomes that depend on location or
orientation are not generalized from a single build.

## Wire

Twenty cases cover the complete 15-to-0 attenuation range, source removal, solid
block conduction, climbing, and blocked headroom. Each attenuation case builds
an actual dust line and observes its resulting power; it does not assign the
expected power property directly.

Primary implementation references: `RedStoneWireBlock` (`dmb`),
`calculateTargetStrength` (mapped source lines 281–302), `getConnectingSide`
(227–246), and `getSignal` (393–404). The attenuation subtracts one from the
strongest neighboring wire, while direct external power is considered separately.

## Repeater

Sixteen cases cover all four rising and falling delays, locked-on and locked-off
memory, unlocking, rejected front/side inputs, dust not acting as a lock, weak
signal regeneration, support loss, and stretching a short input pulse.

Primary references: `RepeaterBlock` (`dmg`), `getDelay` (50), `isLocked` (73),
`sideInputDiodesOnly` (78), and `DiodeBlock` (`dia`), `tick` and
`getInputSignal`. The inspected delay calculation multiplies the delay property
by two. Diode `facing` denotes the input-facing direction in these command-built
fixtures, so `facing=west` reads input to the west and emits eastward.

## Comparator

Thirty-two cases exercise comparison/subtraction boundaries, equality,
side-input maximum selection, zero clamping, the lowest nonzero signal, maximum
signals, all cake bite levels, cauldron levels, two-tick transitions, and reading
through opaque versus transparent blocks. Side and rear values are produced by
real dust attenuation rather than by writing a comparator's output NBT.

Mojang's [comparator guide](https://www.minecraft.net/en-us/article/taking-inventory--redstone-comparator)
describes the two modes and strongest-side rule. Exact equality and timing are
resolved from `ComparatorBlock` (`dhi`), `calculateOutputSignal` (70–84),
`shouldTurnOn` (89–99), `getInputSignal` (104–127), and `getDelay` (48).
`OutputSignal` is read as an integer result, not matched against translated RCON
prose. The cake and cauldron cases check their analog output functions.

## Piston

Twenty-eight cases cover six movement directions, 1/12/13-block lines, eight
immovable blocks, normal and sticky retraction, failed sticky pulling, slime and
honey adhesion, glazed terracotta separation, total branching load, and Java
quasi-connectivity including the missing-neighbor-update condition.

Mojang's [piston article](https://www.minecraft.net/en-us/article/block-week-piston)
corroborates the twelve-block limit and sticky pulling. Exact implementation
references are `PistonBaseBlock` (`dsv`), `getNeighborSignal` (162–180),
`isPushable` (257–300), and `PistonStructureResolver` (`dsz`),
`canStickToEachOther` (82–88), `addBlockLine` (92–182), and
`addBranchingBlocks` (202–216). Adhesion fixtures sit above the arena floor so the
floor cannot accidentally become part of the moving structure. Movement tests
inspect the base, head, moved block, and vacated location after animation settles.

## Observer

Seven cases cover the two-tick activation delay, two-tick output pulse, watched
state changes and removal, ignored back/side updates, and coalesced updates while
a pulse is pending. The back/side cases inspect every tick during the possible
pulse window rather than only inspecting the final off state.
Every observer fixture lets the placement pulse finish and asserts an off
precondition before applying the event being tested.

Primary references: `ObserverBlock` (`dlj`), `updateShape`, `startSignal`, and
`tick`. The inspected scheduling constants are two game ticks for both the delay
and pulse. Mojang's [observer article](https://www.minecraft.net/en-us/article/block-week-observer)
also warns that Java and Bedrock observers detect different events; it is not
used to import Bedrock behavior into these tests.

## Torch

Six cases cover delayed inversion on both edges, wall attachment, output
direction, strong upward power, and burnout/recovery. Burnout is produced by
eight actual off transitions, each followed by an attempted relight. The case
asserts the first seven relights and the eighth failure, then cooldown recovery.

Primary references: `RedstoneTorchBlock` (`dmd`), `tick` (78–99),
`neighborChanged` (103–106), `getDirectSignal` (110–113), and
`isToggledTooFrequently` (150–165). Inspected constants are a two-tick toggle
delay, eight shutdowns within the retained 60-tick history, and a 160-tick restart.
The recovery check is a settled deadline; it does not claim to test every
intermediate cooldown tick. Wall attachment uses `RedstoneWallTorchBlock` (`dme`).

## Lighting

Eight cases distinguish lamp immediate activation, four-tick shutdown, canceled
shutdown, and copper bulb toggle memory, sustained input, analog output, and
nonconductivity. Copper bulb assertions operate at the neighbor update itself,
which catches an implementation that retains an obsolete scheduled toggle delay.

Primary references: `RedstoneLampBlock` (`dmc`), `neighborChanged` and `tick`;
`CopperBulbBlock` (`dhm`), `checkAndFlip` and `getAnalogOutputSignal`. Mojang's
[1.21 release notes](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-21)
document copper bulb rising-edge toggling, retained light, nonconductivity, and
the lit comparator value of 15.

## Control

Five cases cover trapdoor/fence-gate power cycles, door upper/lower state
coupling, support removal, and redstone TNT ignition. TNT ignition must remove
the source block and produce exactly one primed entity with the initial fuse.

Primary references: `TrapDoorBlock` (`dom`), `FenceGateBlock` (`dix`),
`DoorBlock` (`die`), and `TntBlock` (`doi`), particularly their neighbor-change
handlers. `PrimedTnt` saves its fuse under lowercase `fuse` in 1.21.1.

## Rail

Six cases check powered/activator rail propagation boundaries, source removal,
separation of rail types, detector activation, and delayed detector release.

Primary references: `PoweredRailBlock` (`dlv`), `findPoweredRailSignal`, whose
recursion stops at eight; `DetectorRailBlock` (`dhz`), `checkPressed`, whose
scheduled recheck uses twenty game ticks. Fixtures keep the tracks straight and
flat, eliminating shape changes and slope acceleration as alternate causes.

## Pressure

Six cases exercise light-plate nonzero/cap boundaries and heavy-plate rounding
and saturation. They count entities, not stack items. Distinct item component
data prevents merges, and an independent selector assertion checks fixture
population. All cases first observe the empty plate's zero state.

Primary reference: `WeightedPressurePlateBlock` (`dpp`), `getSignalStrength`
(43–49), which clamps entity count to maximum weight and rounds the scaled
15-level result upward. The block registrations supply maximum weights 15 and
150 for light and heavy plates respectively.

## Note

Sixteen cases change the support under an existing note block and assert the
server-selected instrument, covering all ordinary support-based instruments.
They exercise neighbor-driven instrument selection, not direct writes to the
instrument property. They do not claim to verify emitted audio packets, mob-head
instruments, or note pitch.

Primary references: `NoteBlock` (`dlh`), `setInstrument` (54–61) and
`updateShape` (71–76), together with the instrument properties in `Blocks`
registrations. Mojang's [note-block article](https://www.minecraft.net/en-us/article/block-week-note-block)
provides contextual examples; the version-pinned server defines the exact table.

## Validation

On 2026-10-19, all 150 cases passed against the official Java 1.21.1 server artifact
identified above: zero failures and zero skips. All IDs are unique and TypeScript
strict checking passed. The baseline runs uncovered and corrected two fixture
hazards: observer placement pulses, and the need to request a comparator update
after command placement of an analog source behind a solid block.

Two separate negative probes ran against that same real server. One deliberately
removed a dust power source; the other advanced a repeater observation one game
tick too far. Both failed at their intended strength/timing assertion. These are
fixture perturbations that check assertion sensitivity, not claims to have tested
every possible alternative server implementation.
