# Conformance contract

Comparator specifies a growing subset of vanilla-compatible Java Edition server
behavior. It is not an official Mojang certification. Normative requirements live
here alongside their executable checks. Implementation adapters cannot substitute
different expected results.

## Preconditions

- A directly reachable Java Edition TCP endpoint supports the configured version.
- The server accepts offline players without account authentication or profile keys.
- Status is enabled when the `status` capability is declared.
- Test players are permitted to connect: no whitelist, login plugin, proxy
  forwarding requirement, or exhausted player slots.
- The target uses vanilla offline identities for the `login` capability.

Version translation and proxy-specific forwarding require their own future cases.
Timeouts bound the harness; they are configurable operational limits, not a
Minecraft latency specification. Connection failure or timeout for a declared
capability is a failure, never an inferred skip. Cases run once without retries.

## java.status.response

The status response contains JSON with a version object, players object, and MOTD
text component. `version.protocol` equals the protocol number associated with the
configured Minecraft release. `version.name` is a string; no particular brand or
version display text is required. `players.online` and `players.max` are nonnegative
integers. The check does not require an exact player count or enforce online <= max.

The initial MOTD check accepts string, array, and object components without fully
validating their internal schema. Player samples and favicons are not yet tested.

## java.status.ping

After status, the server echoes the exact signed 64-bit ping payload. A nonzero
negative payload exercises both halves of the value. A status response alone is
insufficient: a missing, truncated, or changed pong fails.

## java.login.offline

An offline login produces Login Success with the requested username and its
case-sensitive vanilla offline UUID. This is the UUID v3 derived from the UTF-8
bytes of `OfflinePlayer:<username>` using MD5 with UUID version and variant bits.
The test calculates the expected identity independently of the protocol library.

This checks offline identity policy in addition to packet shape. Servers deliberately
using a different identity policy need a separately specified profile. Login Success
does not imply a player has entered play on releases with a configuration state.

## java.play.join

The server follows Login Success with the clientbound play Login packet (often
called Join Game), assigning a signed 32-bit integer entity ID. The protocol client
performs version-specific configuration acknowledgements when required.

This establishes entry into play, not a fully spawned, playable world. Position,
chunks, registries, movement, inventory, blocks, chat, and entity packet behavior
need additional protocol cases. The command profile covers separate observations.

## Evidence and versioning

The wire layout comes from the pinned
[PrismarineJS protocol definitions](https://github.com/PrismarineJS/minecraft-data/tree/master/data/pc).
The offline identity algorithm can also be inspected in the
[protocol implementation](https://github.com/PrismarineJS/node-minecraft-protocol/blob/master/src/datatypes/uuid.js).
These community implementations are useful references; they are not the complete
Minecraft specification. Tests should document their own precise requirements.

Keep case IDs stable. When requirements change, update the suite version and this
document. Gate genuinely version-specific cases with their `versions` metadata;
do not parse or compare dotted versions lexicographically. Reports record the
configured version, declared capabilities, and every selected result. A filtered
or partially skipped run cannot establish conformance beyond that selection.

## Controlled world profile

The `world` capability requires Java 1.21.1 vanilla commands via RCON on the same
instance as the configured game endpoint. It adds 508 cases covering fixed
observations documented in the [coverage catalog](coverage.md) and its research
links. The command implementation is part of this profile's observable contract.
Adapters may arrange fixtures but must not calculate or substitute expected values.

Each case receives a fresh arena at Y=160, with a stone floor at relative Y=-1.
The cleared region spans X/Z=-16..31 and Y=0..31. All nine chunks must report
entity-ticking readiness before setup. The Overworld clock is frozen, tick rate
is 1000 for efficient controlled stepping, difficulty is normal, daylight is 6000,
weather is clear, random ticks/natural spawning/daylight/weather/fire spread are
disabled, mob griefing is disabled, and ordinary item/entity drops are enabled.
Fluid conversion rules start with vanilla defaults. Fixtures with unusual global
changes must restore them; this profile requires a disposable server instance.

`World.step(n)` reads game time before requesting steps and waits for exactly n
ticks of advancement. More ticks fail; fewer ticks eventually hit the deadline.
Wall-clock sleeps are only polling backoff. Assertions use command success,
explicit scoreboard results, block states, entity selection, and NBT observations.
Every predicate response must contain the current random observation token. Empty
responses, command parse errors, missing results, and disconnects cannot pass.

Expected command failures are asserted explicitly. Commands that execute no branch
produce no stored result, not an implicit zero. Case assertions must distinguish
absence, zero, and default-omitted NBT fields according to vanilla behavior.

Cleanup closes connections, removes nearby nonplayer entities, and releases arena
tickets. Adapter cleanup runs even when world cleanup fails, with its own deadline.
Suite cleanup restores a running 20 TPS clock. It does not restore the complete
world or all administrative settings; use a dedicated disposable instance.

Save/ticket-cycle checks do not prove disk eviction, restart durability, or crash
recovery. See the precise [chunk lifecycle evidence](research-world.md#chunk-lifecycle).
