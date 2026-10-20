# Entity conformance research: Java 1.21.1

These 130 cases specify observable behavior for Java 1.21.1. They exercise a
running server through commands and exact simulation ticks. Their fixtures use
fresh, force-loaded arenas, frozen daylight, disabled natural spawning, and
explicit entity state. These are server integration cases, not unit tests.

## Evidence

The primary implementation reference is Mojang's
[1.21.1 server distribution](https://piston-data.mojang.com/v1/objects/59353fb40c36d304f2035d51e7d6e6baa98dc05c/server.jar),
SHA-1 `59353fb40c36d304f2035d51e7d6e6baa98dc05c`, interpreted using the
[official server mappings](https://piston-data.mojang.com/v1/objects/03f8985492bda0afc0898465341eb0acef35f570/server.txt).
The Java 1.21.1 implementation was inspected with `javap -p -c`; implementation
observations below are version-specific, not promises about future releases.
No Mojang source or binaries are redistributed with the test library.

The official [1.21 release notes](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-21)
document the current lowercase entity attribute representation and namespaced
modifier IDs. The [1.20.5 release notes](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-20-5)
describe the gravity, scale, and other physical attributes. The
[1.19.4 release notes](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-19-4)
specify ride rejection rules, entity relations, damage commands, and infinite
effect durations. Exact numerical expectations were checked against the pinned
vanilla server; release notes alone are not a complete behavioral specification.

## Attributes

`attributes.ts` contains 30 cases for modifier arithmetic, operation ordering,
identity, removal, bounds, and effects that modify attributes. Each case changes
an attribute or applies an effect and observes the resulting computed value.
An attribute value merely echoed from entity NBT would not satisfy the arithmetic
or clamping checks.

Add-value operations precede base multipliers. Base multipliers use the value
after additions and add their contributions; total multipliers multiply
successively. Modifier IDs are unique within an attribute and can be reused on
another attribute. Base queries exclude modifiers. Computed values clamp to the
attribute's bounds, including health, armor, toughness, resistance, movement,
and scale boundaries represented by these cases.

An intentional numerical edge case preserves vanilla's promoted float constants:
Slowness II multiplies movement by `1 + 2 * -0.15000000596046448`. With base 1,
`attribute ... get 100` therefore returns **69**, not 70. This expectation comes
from `MobEffects` (`bsb`) and a live vanilla observation; it must not be rounded
to a mathematically cleaner decimal.

## Combat and effects

`combat.ts` contains 30 cases for health changes, fractional damage, the hurt
cooldown, death removal, invulnerability, armor/toughness, resistance, absorption,
fire resistance, instantaneous effects, and undead effect behavior.

The hurt cooldown suppresses equal or weaker hits during its protected interval;
a stronger hit applies only its excess. The cases distinguish nine ticks from
the ten-tick boundary. A dying entity remains in the world for nineteen ticks and
is removed on tick twenty. General entity selectors already exclude dead living
entities, so the removal check uses a direct UUID rather than mistaking selector
exclusion for physical removal.

Armor checks use `minecraft:mob_attack`: `minecraft:generic` bypasses armor in
this release. Magic bypasses armor; void damage bypasses resistance; generic-kill
damage bypasses the Invulnerable flag. Absorption is consumed before health.
Command-applied instantaneous effects are processed on the following entity
tick, including the reversed healing/harming behavior of undead entities.

Fixture health is explicitly initialized and positively asserted before immunity
checks. This prevents a missing subject from satisfying a negative assertion.

## Entity timers

`timers.ts` contains 25 cases for baby ages, breeding cooldowns, love timers,
chicken eggs, effect cloud aging and radii, TNT, creepers, and status effects.

`AgeableMob` (`bsl`) advances negative ages toward zero and decreases positive
ages toward zero. Timer behavior is checked independently from random movement.
Adult chickens lay an egg when their timer expires; baby chickens leave that
timer unchanged. The tests assert the egg, not the subsequently randomized reset
interval.

`AreaEffectCloud` (`bsn`) expires when its age reaches wait time plus duration.
Radius changes start at the wait boundary, happen once per tick, and remove a
shrinking cloud below radius 0.5. Both sides of these boundaries are checked.
`PrimedTnt` (`cji`) stores its fuse under lowercase `fuse`; this is distinct from
the creeper's uppercase `Fuse`. Ignited creepers process their fuse with AI
disabled.

Finite status effects decrement per tick and expire exactly at zero; infinite
duration preserves `-1`. Stronger effects can hide weaker effects. The weaker
effect resumes with elapsed time deducted, and the resumed movement modifier is
checked as well as its duration. The saved representation omits default
amplifier zero; assertions do not require an absent default field to exist.

## Item entities

`items.ts` contains 20 cases for age, pickup delay, merging, damage, and fire
immunity. `ItemEntity` (`cjh`) increments age before checking the 6000-tick
despawn threshold. Age `-32768` and pickup delay `32767` are independent sentinels.
Ordinary negative ages continue advancing and ordinary pickup delay stops at
zero.

Merging requires compatible stacks, compatible ownership, and a combined count
within the item's stack limit. In this version, two nearby stacks of 40 do not
partially merge into 64 and 16. The cases include differing components,
sixteen-item stacks, unstackable equipment, and both sentinels. They allow the
normal forty-tick neighbor scan and keep item motion fixed, rather than assuming
an immediate merge or selecting a particular survivor when either is valid.

Item health is integer-valued: subtracting half a damage point from health 5
stores 4. Exhausted health removes an item immediately. Netherite's default
fire-resistant component prevents fire damage.

## Relationships

`relationships.ts` contains 15 cases for mounting, dismounting, cycle rejection,
direct passenger traversal, boat control, damage attribution, and origin
relationships for projectiles, dropped items, and clouds.

Relationship assertions count successful command branches explicitly. An empty
relation executes no branch; it is different from a command returning integer
zero. Passenger traversal visits direct passengers, excluding nested passengers.
Positive fixture assertions precede negative relationship checks.

## Physics

`physics.ts` contains 10 cases for item acceleration and drag, NoGravity, floor
collision, living gravity attributes, and projectile collisions. Item motion
uses exact starting velocities. Scaled integer observations avoid relying on
formatted decimal output; positional checks permit one millionth of a block for
floating-point representation, far below a meaningful physics deviation.

Living physics fixtures keep AI enabled and set movement speed to zero. Vanilla
`NoAI` suppresses ordinary travel, so a NoAI fixture would be inappropriate for
testing the gravity attribute. Arrow embedding and snowball removal are separate
collision outcomes. The snowball is positively observed before the removal
check.

## Scope and validation limits

The vanilla baseline validates these deterministic, command-driven observations.
The cases do not establish complete entity conformance. Client movement and
interaction packets, navigation, targeting, breeding genetics, random drops,
projectile aim, raids, villagers, dimension transfer, unload/reload persistence,
and the full set of mob-specific behaviors need additional fixtures. No result
should be described as proving every Notchian entity mechanic.
