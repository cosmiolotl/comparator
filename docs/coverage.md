# Coverage and limits

The 0.3.0 catalog has **865 executable conformance cases**, 353 more than 0.2.0.
The four basic protocol cases retain their previous release support. All 861 gameplay cases are explicitly
restricted to Java **1.21.1**; unsupported versions produce visible skips.

| Area | Cases | Behaviors |
| --- | ---: | --- |
| Protocol | 4 | Status structure, ping payload, offline UUID, play entry |
| Redstone | 150 | Wire attenuation, repeater delay/locking, comparator modes, piston limits/adhesion/quasi-connectivity, observers, torches, lamps, bulbs, rails, controls, plates, note instruments |
| Entities | 130 | Attribute operations/bounds, combat, effects, age/lifetime timers, item merging, relationships, deterministic physics |
| Storage | 136 | Container analog output, hopper transfer/cooldowns/sided access, furnace timing/fuels, dropper/dispenser behavior, components, command NBT storage, cloning |
| World | 92 | Signed scoreboard arithmetic, execute/fill semantics, gravity/support, connections, fluids, tick boundaries, biome cells, drops, coordinates, save/ticket lifecycle |
| Composed mechanics | 119 | Hopper networks and sorters, crafters, brewing, container minecarts, enchantment damage, clouds, projectile impacts, explosions, wind charges, vaults, trial spawners |
| Interaction ordering | 84 | Pending repeater updates, piston pulses, torch burnout/recovery, observer propagation, sculk, tripwire, targets, fluid interactions, chunk edges and ticking levels |
| Environment | 20 | Light sources/attenuation/occlusion/removal, portal frames, dimension-dependent fluid rules |
| Nature and AI | 40 | Breeding and actual feeding, zombie navigation, villager jobs, conversions, random leaf decay, configured trees, spawners, raid eligibility, constructed mobs, trampling |
| Player actions | 70 | Real inventory clicks, crafting/remainders, placement/digging, combat/shields/durability, multiplayer contention, death/respawn, dimensions/portals, vehicles, rejected connections |
| Persistence | 20 | Orderly restart and process kill after save flush; containers/components, scores/storage, block states, entities/passengers, pending timers, player inventories/position/experience |

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
- [Composed mechanics research](research-mechanics.md)
- [Interaction ordering research](research-interactions.md)
- [Environment research](research-environment.md)
- [Nature and AI research](research-nature.md)
- [Player action research](research-player.md)
- [Persistence research](research-persistence.md)

The baseline command is `npm run test:vanilla -- --accept-eula --repeat 2`, after
agreeing to the Minecraft EULA. Machine-readable reports record actual selected
case results. `npm run check` uses synthetic TCP/RCON peers to check the harness,
including wrong arithmetic, missing observations, extra ticks, bad authentication,
and malformed/fragmented frames; those E2E tests are not a vanilla certification.

The `live` profile selects 845 cases without process control. The `persistence`
profile selects 20 cases and requires an owned-process restart adapter. The
default configuration declares only basic protocol capabilities, so its gameplay
cases are visibly skipped. Use `implementors/vanilla-world.json` with
`--profile live --strict` for an existing disposable server.

### Local validation, 2026-10-20

The final complete catalog run against the verified official Java 1.21.1 server
passed **865 of 865 cases**, with zero failures, skips, or harness errors, in
15 minutes 11 seconds. This includes all 20 actual process-restart cases and
the reconnect-clock correction described below. The launcher exited successfully;
its temporary server stopped and both game and RCON listeners closed.

Strict TypeScript checking and all **32 harness E2E checks** pass. The harness
checks include live TCP packet callbacks, invalid protocol/RCON responses,
save rejection, saved-state loss, restart requests, profile selection, and
independently awaited cleanup after case or cleanup timeouts.

Twenty additional live-server fixture perturbations were rejected by their
unchanged assertions: three interaction faults, three nature faults, four
mechanics faults, three player-action faults, one light-source fault, and six
duplicate-item/output faults. These probes test assertion sensitivity; they do
not replace running a candidate server.

Validation also exposed an older anvil fixture that assumed a five-block fall
could not damage the anvil. Its orientation check now uses a one-block fall,
below vanilla's landing-damage threshold, and passed 24 separate arena runs.
This removes random wear without accepting a changed facing or failed fall.

Saved-player reconnects restore normal 20 TPS before opening the connection.
Vanilla's 600-server-tick login timeout still advances while simulation is
frozen; the fixture's accelerated clock had made valid reconnects unreliable.
The correction preserves the original inventory and position assertions and
does not retry failed logins. All four saved-player cases passed four consecutive
runs after the correction: 16 passes, zero failures, skips, or harness errors.

## Determinism

The harness freezes simulation before setup, waits for all arena chunks to be
entity-ticking, controls gamerules, and advances exact game ticks. It polls the
game clock rather than translating milliseconds into ticks. New arenas are
256 blocks apart to isolate pending updates and village points of interest.
Tests run sequentially with no automatic retry, so a failure cannot be hidden
by a later pass.

Players continue processing while simulation is frozen in vanilla. Player cases
use a server-thread packet fence and explicit client observations; they do not
claim exact player-tick timing. Lighting propagation and disconnect removal use
bounded eventual observations because they are asynchronous. Simulation boundary
assertions still use exact ticks, never eventual success.

Random outcomes are constrained where possible. Selected AI and random-tick
cases assert outcomes over a documented window, rather than an exact random
schedule. This is practical baseline evidence, not a proof against every random
seed. Fixed timeouts are operational limits, not expected gameplay timing.
Raise `timeoutMs` for a slower machine; never widen a tick boundary to hide a mismatch.

## Known gaps

865 cases do not establish every behavior of every Notchian release. Current
depth limits include:

- Full terrain/structure generation, skylight across generated terrain, and
  statistical natural spawning distributions. Tree cases use configured features;
  spawning cases primarily exercise configured spawner blocks.
- Every species' AI, village economy/trading/gossip, complete raid waves, boss
  fights, and every trial encounter. Current raid cases cover eligibility and omen
  conversion; configured trial fixtures use deterministic mobs and rewards.
- Every crafting recipe, loot table, enchantment, item, and component combination.
  Representative interactions validate the engines and selected boundaries.
- Arbitrary network interleavings, full client prediction and movement validation,
  signed chat, online authentication, proxies, and protocol fuzzing. Multiplayer
  contention cases exercise controlled packet order, not every simultaneous race.
- All redstone update permutations, scheduled-tick priority combinations, portal
  search ties and coordinate limits, and interactions across partially loaded
  dimensions. Existing cases cover selected explicit layouts and boundaries.
- Unflushed state, OS/power loss, disk-full or corrupted-region recovery, region
  compaction, and upgrades between Minecraft versions.

Save/ticket-cycle cases only observe loss and return of ticking readiness;
`execute if loaded` does not prove chunk-object eviction. Separate persistence
cases actually reopen the same saved world in a new process. Their crash mode
kills that process **after an acknowledged save flush** and makes no promise
about unsaved writes or storage-device failures.

RCON command semantics are part of the world contract. Player cases additionally
exercise actual gameplay packets, but a command-only case does not establish the
equivalent player action. Missing capabilities remain visible skips; strict mode
rejects partial coverage.

## Extending coverage

Choose a specific uncovered contract and give it a stable case ID, primary-source
reference, positive precondition, and observable result. Add a nearby negative
control or timing boundary so a no-op implementation cannot pass. Use real player
actions when packet handling is part of the behavior. For interactions, vary one
factor at a time: orientation, coordinate sign, chunk boundary, tick delay,
inventory capacity, components, player order, or restart point.

Validate on the pinned official artifact, repeat on fresh arenas, then deliberately
perturb the input and confirm the unchanged assertion fails. Keep expected values
fixed; never record a candidate server's output as its own expected behavior.
See [authoring cases](authoring-tests.md) for the available drivers and fixtures.
