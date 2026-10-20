# Composed mechanics research: Java 1.21.1

These cases exercise actual transfers, crafting, brewing, projectile collisions,
damage, explosions, and player interactions. Expectations are pinned to Java
1.21.1, including observable quirks in that release.

The group contains 119 cases: networks 12, crafters 16, brewing 19, container
minecarts 10, defenses and equipment 13, clouds 8, projectiles 9, explosions 7,
wind charges 10, sorters 3, vaults 7, and trial spawners 5. Vault and trial cases
require `world`, `login`, and `play`; the other 107 require `world`.

Primary evidence:

- [Mojang's 1.21 release notes](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-21)
  describe the crafter, wind charges, trial spawners, vaults, and enchantment changes.
- [Mojang's 1.20.5 component specification](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-20-5)
  defines the item components used by the fixtures.
- [Official 1.21.1 server](https://piston-data.mojang.com/v1/objects/59353fb40c36d304f2035d51e7d6e6baa98dc05c/server.jar),
  SHA-1 `59353fb40c36d304f2035d51e7d6e6baa98dc05c`, is the executable oracle.
- [Official server mappings](https://piston-data.mojang.com/v1/objects/03f8985492bda0afc0898465341eb0acef35f570/server.txt),
  SHA-1 `03f8985492bda0afc0898465341eb0acef35f570`, identify the implementation
  classes inspected with `javap -c -p`. Downloaded artifacts remain local.

## Networks

`HopperBlockEntity` and `AbstractFurnaceBlockEntity` govern the composed paths.
Cases verify conservation through hopper chains, component identity after multiple
transfers, locking at the cooldown boundary, competing inputs with one free item
space, furnace extraction, and a lava bucket's journey during ongoing burning.
Competition assertions constrain the inventory totals rather than assume an
unspecified winner among block entities.

The comparator sorter uses 41 iron ingots plus four component-marked filler items.
Its comparator reads strength two at rest, rises to three for a matching surplus
item, and drives a torch inverter that unlocks extraction. Cases check the one
captured output item, preserved filter stock, return to the locked state, and
rejection of other item types or components.

## Crafters

`CrafterBlock` and `CrafterBlockEntity` (`dhr`, `dqv`) establish the scheduled
four-tick activation, one craft per power edge, recipe lookup, remainder ejection,
and insertion rules. Fixtures exercise the actual block inventory and output:
planks, shaped sticks, cake with three bucket remainders, full and partially full
destinations, and output into air.

Input cases distinguish disabled cells, empty cells, and smaller compatible
stacks. Comparator cases distinguish occupied-cell count from stack fullness.
These are recipe-engine and automation checks, not player crafting-grid checks.

## Brewing

`BrewingStandBlockEntity` (`dqk`) starts a 400-tick timer on its ignition tick;
completion therefore occurs on the 401st tick of a cold fixture. One powder
creates twenty charges, and a valid brew reserves one immediately. Cancellation
does not refund that charge. Tests cover ingredient replacement, removed bottles,
all three simultaneous bottle slots, sided hopper access, and potion extension,
amplification, corruption, splash conversion, and lingering conversion.

Two deliberately version-specific behaviors were confirmed in bytecode and on
the official server:

- `PotionBrewing.mix` (`cwt`) constructs a replacement potion stack, discarding
  unrelated custom components. A positive precondition proves the input carried
  custom data before the conversion.
- Brewing subtracts one ingredient before checking that stack's crafting
  remainder. Consuming the last dragon breath leaves no bottle in this version;
  consuming from a larger stack ejects one glass bottle and retains the remainder
  of the ingredient stack. Both boundaries are tested.

## Container minecarts

`MinecartHopper` (`cpd`) has an enabled flag, but no block-hopper eight-tick
transfer cooldown in this version. A stationary cart pulls one inventory item per
tick and can collect a full loose stack. Actual powered and unpowered activator
rails toggle collection.

Cases also check extracting from chest and disabled hopper minecarts, component
preservation, full receivers, the absence of autonomous output from hopper carts,
and destruction drops. Inventory drops are summed because vanilla may split a
stack into several item entities.

## Equipment and combat

`LivingEntity`, the 1.21 data-driven enchantment definitions, and dispenser
behaviors provide the contracts. Tests combine armor, resistance, and absorption,
then isolate equipped enchantment damage reduction for protection, fire,
explosions, projectiles, and falls. Excess protection is capped. Stored
enchantments and protection against unrelated damage types remain ineffective.

An empty attribute-modifier component does not remove the equipment's default
armor in this version. A nonempty explicit zero modifier isolates enchantment
protection, and each such case asserts zero computed armor before damaging.

Unbreakable, last durability, and failed-use cases operate an actual dispenser
flint and steel. They check fire placement and remaining item durability or
destruction, rather than only component serialization.

## Clouds

`AreaEffectCloud` (`bsn`) evaluates victims every five ticks. Tests bracket first
application and the wait period; clearing an effect does not clear the cloud's
per-entity reapplication cache. A newly arriving entity has its own cache entry.
Other cases verify instant effect scaling, radius-on-use, duration-on-use, and
radial exclusion outside the circle.

## Projectiles

`AbstractArrow`, `Arrow`, and thrown projectiles (`cnd`, `cnf`) are observed after
actual movement and collision. Cases cover ordinary and piercing hits, solid
obstruction, ignition, custom tipped-arrow effects, impact motion and full
knockback resistance, and the snowball's distinct behavior against blazes and
ordinary animals. Fixed initial velocity and noncritical arrows remove random
critical damage from these fixtures.

## Explosions

`Explosion` and the TNT entity calculate damage and motion from exposure. Fixed
positions and zero initial TNT motion permit expected damage and motion at
three decimal places. An obsidian wall blocks exposure: in this version the damage
formula still applies its minimum one damage while imparting zero motion.

Other cases cover TNT destruction independent of mob griefing, water shielding
blocks, creeper griefing suppression while entity damage remains active, and
TNT chain priming. Chain fuse length is intentionally random: its allowed
interval, successful priming, and removal of the original block are asserted.

## Wind charges

`AbstractWindCharge` and `WindCharge` (`cof`, `coh`) govern collision and burst
behavior. Actual projectiles toggle levers and wooden gates, press buttons,
extinguish candles, open wooden trapdoors, and break decorated pots. Iron
trapdoors, powered gates, and ordinary glass provide negative controls. A direct
target takes collision damage while another entity receives motion without
burst damage. Assertions do not depend on the randomized burst radius.

## Vaults

`VaultBlockEntity`, its server operations, and `VaultState` (`dsk`, `dsk$b`,
`dsp`) are exercised with actual logged-in players and block-use packets.
Cases check survival activation, spectator exclusion, incorrect keys, required
key counts, the fourteen-tick unlocking boundary, a single reward per player,
and independent eligibility for a second player.

The configured loot table is vanilla's `minecraft:blocks/diamond_block`, which
provides one deterministic reward. The key item is explicitly configured.
Reward assertions total every matching dropped stack in the arena and the
players' authoritative inventories. The second-player case waits for its
ejection and requires two rewards in total.
These fixtures test vault behavior and player identity; they do not claim to
test default trial-chamber loot probabilities or every reward.

## Trial spawners

`TrialSpawner`, `TrialSpawnerConfig`, `TrialSpawnerData`, and `TrialSpawnerState`
(`dsf`, `dsg`, `dsh`, `dsi`) are exercised with real players. Configured encounters
use one stationary pig at a fixed unobstructed position and explicit valid light
rules. Grass supports the pig's placement; custom light rules do not bypass
species placement eligibility. Tests verify registration, actual spawning, simultaneous count, spectator
exclusion, the mob-spawning gamerule, encounter completion, reward ejection,
cooldown, and Bad Omen conversion into an ominous trial and Trial Omen.

The fixture configures a 200-tick cooldown and deterministic vanilla reward.
This bounds validation time and removes random spawn positions and reward
selection. It does not test all default encounter compositions, combat AI,
ominous item distributions, or all multiplayer difficulty scaling.

## Validation

The official server passed all 119 cases in two complete runs on 2026-10-20. Four separate live
fixture perturbations were rejected by the unchanged assertions: suppressing
crafter activation, observing brewing one tick early, removing Protection from
equipment, and presenting the wrong vault key. These probes check assertion
sensitivity and do not modify the expected results of the committed cases.

A subsequent focused run passed all 17 reward and output cases after tightening
whole-inventory and dropped-stack totals. Three additional live perturbations
added duplicate vault rewards, crafter output, and brewing remainders; each
failed its unchanged aggregate-count assertion.
