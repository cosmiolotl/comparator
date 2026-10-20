# Player packet and interaction research

## Player input

These cases target Java 1.21.1. RCON builds fixtures and reads authoritative state;
the tested inventory clicks, crafting, placement, breaking, movement, attacks,
shield use, boat interaction, and respawn requests travel over the actual player
connection. The fixture uses offline identities and never grants operator status.

Primary evidence:

- The [official 1.21.1 server](https://piston-data.mojang.com/v1/objects/59353fb40c36d304f2035d51e7d6e6baa98dc05c/server.jar),
  SHA-1 `59353fb40c36d304f2035d51e7d6e6baa98dc05c`.
- The matching [official Mojang mappings](https://piston-data.mojang.com/v1/objects/03f8985492bda0afc0898465341eb0acef35f570/server.txt),
  SHA-1 `03f8985492bda0afc0898465341eb0acef35f570`.
- [Java 1.20.3 tick documentation](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-20-3):
  players and their ridden entities are excluded from normal tick freezing.
- [Java 1.20.5 item components](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-20-5)
  and [Java 1.21 enchantments](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-21).

The mappings identify `ServerGamePacketListenerImpl` (`aru`),
`AbstractContainerMenu` (`cpu`), `ServerStatsCounter` (`avv`), and `Player` (`cmx`).
Targeted `javap -p -c` inspection established handler ordering, menu cleanup, and
the statistics response used by the driver. Assertions were then exercised against
the verified official server, rather than derived from the target being tested.
The pinned protocol library supplies packet serialization, not behavioral oracles.

### Synchronization

`ServerGamePacketListenerImpl.handleClientCommand` first moves handling to the
server thread. `REQUEST_STATS` invokes `ServerStatsCounter.sendStats`, which emits
a response even when the changed-statistics map is empty. The driver sends that
request after each operation and awaits its response as an ordered packet fence.
It does not substitute wall-clock sleeps for a server acknowledgement.

The driver acknowledges teleport IDs and resolves relative position flags before
echoing its position. Chunk batches receive flow-control acknowledgements, and
fixture teleportation waits for the destination chunk. This matters for frozen
worlds: a newly spawned entity can otherwise precede the client's chunk tracking
and never produce its spawn packet until simulation resumes.

Inventory state comes from `window_items` and `set_slot`. Java 1.21.1's encoded
cursor container ID is unsigned byte 255. Each test click sends an empty predicted
cursor; the local prediction is therefore empty until a server correction arrives.
The client does not maintain a second implementation of inventory rules.
Normal clicks use the observed state ID. The stale-state case deliberately sends
an old ID and requires a full authoritative resynchronization.

Players run at the normal 20 TPS while nonplayer simulation remains frozen.
Tick stepping establishes sufficient charge, shield activation, and spawn
invulnerability expiry; these cases do not claim exact player-tick boundary
coverage. The zero-speed cooldown case makes the damage-floor expectation exact
without depending on two network requests arriving in the same tick.

### Behavioral distinctions

- `AbstractContainerMenu.removed` returns cursor items to a living, connected
  player's inventory, but drops the stack when that player has disconnected.
  Close-menu and disconnect cases intentionally assert different outcomes.
- Container clicks with a stale state ID still execute before the server sends a
  full state. A click for the wrong container ID does not execute.
- Left and right dragging have separate distribution rules. Shift-clicking uses
  the actual menu transfer order; a chest transfers toward the last hotbar slot.
- Component identity participates in stack merging, so custom-data variants
  exchange positions instead of combining.
- A simultaneous last-item race accepts either winner, requires both views to
  converge, then closes both menus and counts the authoritative inventories.
  Their sum must be one, with no dropped duplicate. Disconnect and death checks
  require both the exact dropped stack quantity and exactly one matching entity.
  These assertions do not fix an arbitrary cross-connection arrival order.
- Boat passenger packets include player IDs, but ordinary entity serialization
  omits player passengers. Vehicle assertions use `execute on passengers` and
  actual passenger packets instead of assuming player passenger NBT exists.
- A pending teleport blocks movement until acknowledged. Collision tests inspect
  the authoritative position, rather than merely accepting the client's sent
  coordinates.
- Normal iron-sword damage, Sharpness, Fire Aspect, hurt immunity, the cooldown
  floor, shield direction, shield durability, and unbreakable item effects have
  actual attack or harvesting cases. These are not serialization-only checks.
- Crafting uses inventory transactions for the personal grid and workbench.
  Cake verifies three empty-bucket remainders after consuming milk buckets.
- Non-finite movement is deliberately rejected with the vanilla reason; a
  duplicate identity replaces its previous session. Expected rejection has an
  explicit harness API and does not turn arbitrary disconnections into passes.
- Paired Nether portals exercise actual creative and survival player traversal,
  coordinate scaling, inventory retention, return cooldown, and dropped-item
  transport. `NetherPortalBlock`, `PortalProcessor`, and `PortalForcer` identify
  the relevant vanilla paths. The fixture prepares and cleans a bounded
  destination region without resetting the shared world observation token.
  Source-absence assertions use a distance constraint: an unconstrained `@e`
  selector can find entities in other dimensions. After survival arrival, the
  cooldown case switches to creative before reentry, isolating cooldown from
  survival's portal warmup. It then waits outside until cooldown is zero and
  requires the same portal to return the player as a positive control.
  Destination clearing and ticket release are separate runner-awaited cleanup
  phases, each with a fresh connection and deadline.

### Scope limits

These cases are representative protocol-driven interactions, not a complete
client. They do not cover every menu, recipe, movement exploit, combat combination,
enchantment, vehicle, authenticated online login, signed chat, resource-pack flow,
or exact scheduling among multiple network connections. Portal cases check actual
travel and cooldown behavior, but not an exact player dwell-time boundary, every
orientation, or automatic destination-portal generation. Player restart cases are
maintained with the persistence profile and require a restart-capable adapter.
