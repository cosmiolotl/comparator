# Nature and AI evidence for Java 1.21.1

These integration cases exercise actual animal goals, villagers, block random ticks,
configured world-generation features, constructed mobs, spawners, farming, and raid
eligibility. Player-dependent cases connect a real protocol client and use the shared
player driver. Most fixture setup remains through RCON.

The implementation evidence is the
[official Mojang server JAR](https://piston-data.mojang.com/v1/objects/59353fb40c36d304f2035d51e7d6e6baa98dc05c/server.jar)
(SHA-1 `59353fb40c36d304f2035d51e7d6e6baa98dc05c`) and its
[official mappings](https://piston-data.mojang.com/v1/objects/03f8985492bda0afc0898465341eb0acef35f570/server.txt)
(SHA-1 `03f8985492bda0afc0898465341eb0acef35f570`), with targeted local
`javap -p -c` inspection. All expectations are pinned to Java 1.21.1 and validated on
that unmodified server.

## Breeding

`BreedGoal` (`bzy`) and `Animal` (`cfe`) establish mate search, goal progression,
offspring creation, parental cooldown, and love-mode reset. Cow, pig, and sheep cases
observe one actual baby, both parental cooldowns, and the baby's negative age.
The 80-tick observation allows the goal's initial scheduling without asserting which
parent's AI executes first. Both parents are close and confined on valid ground.

Negative cases cover only one willing parent, incompatible species, and disabled AI.
The disabled-AI case re-enables both parents and verifies successful breeding.
Setting contradictory NBT such as both a positive cooldown and forced love mode is
not used as a substitute for a player feeding check.

## Feeding

Real `use_entity` packets feed a cow with wheat in survival mode. The cases distinguish
adult love mode, cooldown rejection, and baby growth acceleration. They check exact
remaining food counts as well as the animal's age and love timer. These test the
interaction path rather than assigning the expected state through commands.

## AI

`Zombie`, `ZombieVillager`, `Villager`, navigation goals, `AcquirePoi`,
`AssignProfessionFromJobSite`, and `ResetProfession` supply the relevant behavior.
The zombie case requires actual movement toward a villager and a real melee hit; a
separate solid-wall case prevents that hit.

Villagers claim a composter, become farmers, and lose an untraded profession when the
workstation is removed. Babies and nitwits cannot claim that job. The cases observe
both profession and the actual job-site memory.

Conversion tests distinguish two behaviors: a curing zombie villager can complete its
conversion with AI disabled, while an ordinary zombie's drowned-conversion countdown
pauses with AI disabled. Re-enabling the latter provides a positive completion check.
Loaded conversion timers isolate the transformation itself; they do not claim to test
the golden-apple interaction or the complete underwater exposure countdown.

## Random-ticks

`ServerChunkCache`, `ServerLevel.tickChunk`, and `LeavesBlock` (`dki`) establish
player proximity, section sampling, and leaf decay. A force-loaded arena without a
nearby player does not provide the required random ticking.

The tests put a real player above a complete 16×16×16 section containing 4,096 eligible
leaf blocks. With randomTickSpeed=1 and exactly one game tick, whichever coordinate
is sampled must be a leaf. The expected remaining count is therefore exactly 4,095,
without a statistical pass condition or an assumed random seed.

Controls check disabled random ticks and persistent leaves. A waterlogged decay case
also requires precisely one water block at the vacated position. Random ticking is
disabled again before destructive counting and in cleanup.

## Generation

`TreeFeature` (`edq`), its tree configurations, and the oak/birch configured features
establish valid ground, obstacle rejection, trunk placement, and foliage.
Successful cases require the base trunk and a nonempty canopy. Fully obstructed
volumes must reject the feature without replacing the obstruction.

Tree height and individual canopy coordinates are intentionally not fixed: those
details legitimately vary with randomness. These checks cover bounded configured
feature behavior, not biome selection, noise terrain, carvers, structure placement,
or a complete generated-chunk fingerprint.

## Spawners

`BaseSpawner` (`dby`) and `SpawnData.CustomSpawnRules` (`ddo$a`) establish player
activation range, countdowns, nearby entity caps, difficulty gating, and independence
from the natural-spawning gamerule.

Fixtures use a fixed spawn position and custom full-range light rules to avoid a
randomly invalid candidate or a lighting lottery. A successful spawn must produce
one configured zombie and reset the delay exactly. Range and peaceful controls
include a return to an eligible state. A nearby-cap case places the existing zombie
away from the candidate bounding box, so collision cannot masquerade as cap rejection.

These are spawner eligibility tests. They do not measure natural spawn distributions,
per-player mob caps, or pack sizes.

## Raids

[Mojang's Java 1.21 notes](https://www.minecraft.net/pt-pt/article/minecraft-java-edition-1-21)
describe the change from Bad Omen to Raid Omen before a raid begins.
`BadOmenMobEffect` (`brs`) additionally establishes the spectator and peaceful guards.

A real villager claims a real bed before the player receives Bad Omen. The positive
case observes Raid Omen replacing Bad Omen. Peaceful and spectator cases retain Bad
Omen. Player effects tick even while world ticking is frozen, so these cases use
ordinary tick rate during the short observation and clear both effects afterward.
They stop before Raid Omen expires and do not claim wave composition, raid victory,
hero rewards, or complete raid spawning coverage.

## Constructs

`CarvedPumpkinBlock` (`dgs`) detects snow and iron golem patterns when the head is
placed. Cases require the actual entity and consumed structure blocks. Iron golems
also retain the player-created flag. Missing-arm and uncarved-pumpkin cases include
successful completion after the invalid pattern is corrected.

## Farming

`FarmBlock` (`div`) establishes its scheduled conversion when covered and the
entity-fall/mobGriefing checks for trampling.
The cow fall is long enough that its random comparison always succeeds; landing
damage proves the entity completed the fall. The cases check soil, crop survival,
and the immature crop's seed drop, with mobGriefing restored afterward.

## Limits

These cases add representative behavior rather than every AI or random process.
Remaining areas include complete navigation/path tie-breaking, every mob goal and
brain schedule, bee/sniffer behavior, village gossip and trading economics, full raid
waves, natural-spawn distributions, random crop growth rates, random loot frequencies,
and general terrain generation. Probability-based assertions would need a separately
identified statistical profile; the strict vanilla baseline does not use them.

## Validation

The complete 40-case family passed on the official server. Its first 37 cases also
passed four complete earlier runs. Live negative probes removed parental love
mode, disabled the random-tick sample, and set the spawner's spawn count to zero; all
three produced the expected assertion failure.
