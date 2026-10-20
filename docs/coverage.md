# Coverage and limits

The 0.2.0 catalog has **512 executable conformance cases**. The four protocol
cases retain their previous release support. All 508 gameplay cases are explicitly
restricted to Java **1.21.1**; unsupported versions produce visible skips.

| Area | Cases | Behaviors |
| --- | ---: | --- |
| Protocol | 4 | Status structure, ping payload, offline UUID, play entry |
| Redstone | 150 | Wire attenuation, repeater delay/locking, comparator modes, piston limits/adhesion/quasi-connectivity, observers, torches, lamps, bulbs, rails, controls, plates, note instruments |
| Entities | 130 | Attribute operations/bounds, combat, effects, age/lifetime timers, item merging, relationships, deterministic physics |
| Storage | 136 | Container analog output, hopper transfer/cooldowns/sided access, furnace timing/fuels, dropper/dispenser behavior, components, command NBT storage, cloning |
| World | 92 | Signed scoreboard arithmetic, execute/fill semantics, gravity/support, connections, fluids, tick boundaries, biome cells, drops, coordinates, save/ticket lifecycle |

Data-driven cases have separate stable IDs and distinct input conditions or
boundaries. They do not gain a pass by merely registering a block or entity type.
Each world case must make at least one observable assertion. Expectations are
fixed in the suite, never learned from the implementation being tested.

## Research and evidence

The reference artifact is Mojang's Java 1.21.1 server, SHA-1
`59353fb40c36d304f2035d51e7d6e6baa98dc05c`. Research uses the official mappings,
targeted bytecode inspection, official release documentation, and isolated runs
against that artifact. Mechanic-level source anchors and subtleties are recorded in:

- [Redstone research](research-redstone.md)
- [Entity research](research-entities.md)
- [Storage research](research-storage.md)
- [World research](research-world.md)

The baseline command is `npm run test:vanilla -- --accept-eula --repeat 2`, after
agreeing to the Minecraft EULA. Machine-readable reports record actual selected
case results. `npm run check` uses synthetic TCP/RCON peers to check the harness,
including wrong arithmetic, missing observations, extra ticks, bad authentication,
and malformed/fragmented frames; those E2E tests are not a vanilla certification.

### Local validation, 2026-10-19

Three complete runs against the verified official server passed **512/512**, with
zero failures or skips. Two ran consecutively on one instance; the final run used
a fresh instance after numeric-feedback parsing was hardened. Their durations
were 113.3, 117.0, and 127.4 seconds on Windows x64 with Node 24.19.0. JSON and
JUnit evidence is under `reports/vanilla/` (ignored runtime artifacts).

`npm run check` passed strict TypeScript checking and **21 harness E2E tests**.
Five additional live-server fixture perturbations were rejected: suppressed
redstone power, an early repeater observation, an early hopper transfer, a late
furnace observation, and removal of an item stack-size component. These probes
test assertion sensitivity; they do not replace testing a different server.
All managed vanilla processes were stopped after validation.

## Determinism

The harness freezes simulation before setup, waits for all arena chunks to be
entity-ticking, controls gamerules, and advances exact game ticks. It polls the
game clock rather than translating milliseconds into ticks. New arenas prevent
old scheduled ticks from contaminating later cases. Tests run sequentially with
no automatic retry, so a failure cannot be hidden by a later pass.

Random AI and random tick outcomes are avoided or constrained. Fixed timeouts are
operational limits, not expected gameplay timing. Raise `timeoutMs` for a slower
machine; never widen a tick boundary to hide a mismatch.

## Known gaps

512 cases cannot establish every behavior of every Notchian release. Uncovered
areas include full world generation and lighting, natural spawning distributions,
mob navigation and all species-specific AI, villagers/raids, complete crafting and
loot tables, sculk/tripwire/target systems, all dimension/portal interactions,
client movement and inventory interaction packet sequences, multiplayer ordering,
and exhaustive chunk scheduling interactions.

Save/ticket-cycle cases observe loss and return of ticking readiness. Vanilla's
`execute if loaded` does not establish that a chunk object was evicted. Therefore
these cases **do not prove disk round-trip, process restart, or crash durability**.
Player data persistence and storage-failure recovery also remain future coverage.

The command profile requires vanilla command semantics and RCON. It does not
certify that equivalent actions taken through player packets behave identically.
A server intentionally omitting commands must report that profile as skipped;
the runner will not silently treat unimplemented mechanics as passing.
