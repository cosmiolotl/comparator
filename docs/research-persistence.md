# Persistence contracts (Java 1.21.1)

## Save boundary

These tests use Mojang's verified 1.21.1 server and its official mappings:
[release](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-21-1),
[server mappings](https://piston-data.mojang.com/v1/objects/03f8985492bda0afc0898465341eb0acef35f570/server.txt).
Relevant implementation anchors are `MinecraftServer.saveEverything`,
`ServerLevel.save`, `LevelTicks.save`, `ChunkSerializer`,
`EntityStorage`, and `DimensionDataStorage`.

Each case removes its remote arena's force-load tickets and observes that the
chunks no longer tick. It completes `save-all flush` before the adapter either
requests orderly shutdown or kills the owned process. The adapter reopens the
same world. The harness freezes the replacement server before loading the remote
arena, preserving its remaining simulation delays through startup.

Assertions cover sparse inventories, nested components, scoreboard and command
storage, block states, entity identities/passengers, furnace and hopper counters,
pending fluid work, and item age. A new process is required: ticket cycling alone
does not satisfy this profile.

The crash mode tests process termination after an acknowledged flush. It does not
simulate power loss, an operating-system crash, torn filesystem writes, full
disks, or preservation of changes made after that flush. Adapters must own the
process they terminate; an ordinary externally managed server has no implicit
restart or crash capability.

## Player data

Player cases disconnect before the save boundary and reconnect with the same
offline identity after process restart. They intentionally bypass the ordinary
player fixture reset on reconnection. `PlayerDataStorage`, `ServerPlayer.save`,
`PlayerList.save`, and the player inventory/ender-chest serializers anchor these
contracts. Assertions check actual server inventory slots, components, position,
experience, creative mode, and respawn location, including the position packet
received by the reconnected client.

Reconnection restores the normal 20 TPS before opening the player socket. The
restart fixture otherwise leaves a frozen world at 1000 TPS for nonplayer tick
tests. Official `ServerLoginPacketListenerImpl.tick` (`arw.d()` in the pinned
artifact) increments its timeout counter regardless of world freezing and
disconnects at 600 server ticks. Accelerating that clock can expire a valid login
during protocol switching. The fixture controls this clock before reconnecting;
it does not retry rejected logins or weaken the persistence assertions.
