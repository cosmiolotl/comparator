# World behavior research (Java 1.21.1)

The world catalog covers command arithmetic, coordinates, block updates, fluids,
biomes, drops, and clock boundaries. Each case has a fixed expected outcome. The
reference server is Mojang's unmodified 1.21.1 dedicated server, not an alternative
implementation. Results from a target never become that target's expectations.

## Primary evidence

- [Mojang's version manifest](https://piston-meta.mojang.com/mc/game/version_manifest_v2.json)
  identifies the exact release artifacts and SHA-1 digests. The baseline server
  digest is `59353fb40c36d304f2035d51e7d6e6baa98dc05c`; its official server mappings
  digest is `03f8985492bda0afc0898465341eb0acef35f570`.
- [Java 1.21.1 release notes](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-21-1)
  establish the release boundary. Later experimental redstone behavior is excluded.
- [Java 1.20.3 release notes](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-20-3)
  describe freeze, step, sprint, and administrative permissions.
- [Java 1.19.4 release notes](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-19-4)
  describe biome filling and the fluid source conversion gamerules.

Release notes are not a complete behavioral specification. The official artifact
and mappings provide implementation evidence; actual isolated runs validate the
precise command/NBT expectations. Research summaries describe observations, without
redistributing Mojang's source or binaries.

## Scoreboard

`OperationArgument` and `ScoreboardCommand` implement signed 32-bit scoreboard
arithmetic. The cases distinguish wrapping overflow, floor division, floor modulo,
division by zero, source preservation, swapping both operands, missing scores,
inclusive ranges, and removal versus a zero score. Expected values are literals in
the catalog, not computed by the server implementation under test.

## Commands

`ExecuteCommand`, `FillCommand`, and command coordinate arguments provide the
contracts. Cases check branch effects and stored results, success flags, inclusive fill
volumes, keep/replace/outline/hollow behavior, local coordinate rotation, negative
fractional flooring, and aligned execution positions. Commands that produce no
result must not accidentally satisfy an assertion using a previous score.

## Blocks

`FallingBlock`, `FallingBlockEntity`, `ConcretePowderBlock`, and the corresponding
support-sensitive block classes are the source anchors. Cases distinguish delayed
falling, landing, support removal, item conversion at a torch, water hardening,
non-hardening lava contact, and connection recomputation. Fixtures explicitly
provide floors and attachment surfaces; random ticks are disabled.

## Fluids

`WaterFluid`, `LavaFluid`, `FlowingFluid`, `SpongeBlock`, and `BubbleColumnBlock`
anchor the fluid contracts. Cases use the Overworld, a flat stone floor, explicit
source/flow levels, and controlled ticks. They check the five-tick water scheduling
boundary, horizontal attenuation and reach, source conversion rules, lava reaction
products, sponge saturation and waterlogging, and bubble-column direction/removal.
The suite does not infer Nether flow timing from Overworld tests.

## Ticks

`TickCommand`, `ServerTickRateManager`, `ServerLevel`, and the scheduled block tick
queue anchor the clock contracts. A case starts frozen, arranges its fixture, and
requests an exact number of steps. The harness observes game time until the count
has completed, rejecting overshoot. A small polling delay is only a transport
backoff; it never determines how many game ticks have elapsed. Daytime and game
time are tested separately, including day rollover and disabled daylight cycles.

## Environment

`FillBiomeCommand` and the four-block biome sampling cells anchor biome cases.
Biome queries use fuzzy sampling, so positive biome probes have an eight-block
margin of the same biome. Quantization boundaries are asserted using the number
of quart entries changed; they do not assume an unfuzzed biome query at an edge.
Drop cases exercise `doTileDrops` using block destruction and observable item
entities. These do not cover biome world generation, terrain seed equivalence,
weather probability distributions, or natural spawning distributions.

## Limits

All world cases are restricted to 1.21.1. A matching release is necessary but does
not itself imply all cases passed. Reports are the evidence of executed cases.
Random outcomes, full terrain generation, client prediction, and exhaustive
cross-dimension interactions remain outside this catalog.

## Chunk lifecycle

These cases issue `save-all flush`, remove the arena's force-load tickets, observe
loss of ticking readiness, then restore the tickets and wait for readiness. They
cover container components, furnace progress, block properties, entity data,
pending fluid ticks, and block entities on opposite sides of a chunk boundary.
The clock remains frozen, so pending scheduled delays have a fixed boundary.

`ExecuteCommand.isChunkLoaded` also requires entity-ticking status and entity
readiness. A false result does **not** prove a chunk object was evicted from memory.
These are save and ticket lifecycle checks, not proof of a disk round trip. Actual
process restart, crash durability, player-data persistence, and filesystem failure
recovery need a future adapter-controlled restart profile.
