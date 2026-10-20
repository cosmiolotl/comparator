# Storage and inventory reference notes

These 136 scenarios target **Minecraft Java Edition 1.21.1**. They exercise server behavior through commands and observed world state; none is a unit test. A successful assertion has a specific expected count, component, block state, entity state, or command result. The suite does not accept an arbitrary output from the tested server as its own oracle.

| Area | Cases | Source file |
| --- | ---: | --- |
| Comparator container fullness | 6 | `tests/storage/analog.ts` |
| Hopper transfer and inventory boundaries | 32 | `tests/storage/hoppers.ts` |
| Furnace, blast furnace, smoker | 20 | `tests/storage/furnaces.ts` |
| Droppers and dispensers | 18 | `tests/storage/dispensers.ts` |
| Item components and predicates | 20 | `tests/storage/components.ts` |
| Command storage and NBT operations | 25 | `tests/storage/nbt.ts` |
| Cloning and block entity state | 15 | `tests/storage/cloning.ts` |

## Reference build

The primary executable reference is the server linked by Mojang's [Java 1.21.1 release announcement](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-21-1). Its distribution SHA-1 is `59353fb40c36d304f2035d51e7d6e6baa98dc05c`. The [official server download](https://piston-data.mojang.com/v1/objects/59353fb40c36d304f2035d51e7d6e6baa98dc05c/server.jar) and the corresponding official server mappings identify the implementation examined for underspecified boundary behavior. No fork's optimizations are treated as the reference.

The fixture freezes gameplay, prepares a fresh loaded arena, and advances an exact number of game ticks. Mojang documents the semantics of `tick freeze` and `tick step` in [23w43a](https://www.minecraft.net/en-us/article/minecraft-snapshot-23w43a). Real-time sleeps are not evidence that a gameplay deadline has elapsed.

Validation on 2026-10-19: all 136 storage scenarios passed against the official 1.21.1 server. Three deliberate fixture perturbations were also rejected at the intended assertions: shortening the hopper cooldown observation by one tick, advancing the pre-completion furnace observation by one tick, and removing custom stack-size overrides. These are assertion-sensitivity checks, not tests of a separately modified server implementation.

## Hoppers

[Mojang's hopper overview](https://www.minecraft.net/en-us/article/hopper) describes directional transfer, extraction from above, item collection, and redstone locking. The timing and slot-order cases are version-specific probes of 1.21.1 `HopperBlockEntity` (`drh` in the official mappings), especially `pushItemsTick`, `tryMoveItems`, `ejectItems`, and `tryMoveInItem`.

Checks distinguish transfer from item-entity pickup, inspect both sides of a transfer, and cover occupied slots, full destinations, limited stack sizes, component identity, furnace sided slots, and shulker nesting. The eight-tick cooldown is checked immediately after output and on both sides of its expiry. A separate case checks that an initially empty hopper cannot forward its newly pulled item during that same tick.

## Container signals

The 1.21.1 `AbstractContainerMenu.getRedstoneSignalFromContainer` calculation normalizes each occupied slot by its stack limit before averaging over inventory capacity. The six fixtures require output levels 0, 1, 8, and 15 at key fullness boundaries, 3 for one unstackable item in a five-slot hopper, and 2 for one item with a custom maximum stack size of two. Both the comparator's recorded output and an actual connected wire must agree. After command-based slot setup, an explicit neighbor update schedules comparator evaluation; the tests then wait four game ticks. A solid floor prevents hopper output.

## Furnaces

Timing fixtures start with an empty block, then insert ingredients using `item replace`. This intentionally follows the inventory setter that calculates recipe duration. Inspecting official 1.21.1 `AbstractFurnaceBlockEntity` (`dpv`) showed that loading NBT with a missing `CookTimeTotal` reads zero; inventing incomplete furnace NBT would test a malformed fixture rather than ordinary smelting.

The tests cover completion boundaries, fuel ignition, blocked output, unused fuel, post-removal burning, cooling, remainder buckets, sponge drying, recipe accounting, and the different recipe classes. Expected durations are tied to the release's built-in recipe data and `serverTick`/`getBurnDuration` behavior. The schema is deliberately pinned: Mojang's [1.21.4 release notes](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-21-4) document later changes to furnace NBT field names, so these assertions must not silently run against that version.

## Dispensers

Reference behavior comes from the 1.21.1 `DispenserBlock`, `DropperBlock`, `DispenseItemBehavior`, and `ShearsDispenseItemBehavior` implementations. Each fixture has one occupied source slot, removing random slot selection from the observation. Tests require the four-tick activation boundary, a new power edge for a second activation, inventory capacity checks, component preservation, and the difference between dispensing an item and invoking its special behavior.

Projectile direction noise and random wool counts are intentionally outside the assertions. The tests still require the correct entity type, consumption, block transformation, or durability change. Shears are tested against a stationary adult sheep; pumpkin carving is not assumed to be a dispenser behavior.

## Item components

The [official 1.20.5 release notes](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-20-5) define the component-based item format used by 1.21.1, including integer counts, default component omission, explicit component removal, slot ranges, inline modifiers, and exact versus partial predicates.

Cases test serialization and semantic use separately: a default damage value must match an item predicate even when absent from serialized component patches. Count predicates operate per stack, while the command result sums matching items. Copy operations are followed by source mutation to detect accidental aliasing. Stack-limit overrides are exercised through an actual hopper transfer.

The reference build normalizes numeric lists in component SNBT into typed arrays during parsing. The numeric custom-data fixture explicitly checks an integer array. The subset/order predicate fixture uses a string list, so it actually tests list matching rather than accidentally demanding subset matching for an integer array.

## Command storage

Mojang introduced shared, namespaced command storage in [19w38a](https://www.minecraft.net/en-us/article/minecraft-snapshot-19w38a). [The official Village & Pillage notes](https://feedback.minecraft.net/hc/en-us/articles/360027306551-Minecraft-Village-Pillage-1-14-0-Java) describe data modification operations and filtered paths. [23w03a](https://www.minecraft.net/en-us/article/minecraft-snapshot-23w03a) documents string extraction and its inclusive start/exclusive end indices.

The storage fixtures cover recursive merge, replacement, insertion, removal, wildcard/filter updates, quoted keys, type identity, arrays, homogeneous-list rejection, numeric flooring, scaling, slicing, independent copies, namespace isolation, and dimension sharing. Every scenario initializes the storage subtree it reads, so its result does not depend on execution order. Failed mutations are checked for both a zero result and unchanged data.

## Cloning

Cloning scenarios observe 1.21.1 `CloneCommands` behavior with container inventories and nested components, named and locked containers, explicit timers, independent copies, relocation, filtered/masked/replace modes, block states, overwrite behavior, and overlap rejection. Entity exclusion is checked independently of the block copy.

These checks cover the in-memory block entity and command-storage representations. They **do not prove disk durability, chunk unload/reload persistence, crash recovery, or clean server restart persistence**. No read-after-write or `save-all` result is presented as a substitute for an actual restart test. Player UI transactions, crafting screens, brewing, container minecarts, loot-table randomness, and every possible inventory interaction remain outside this group's coverage.
