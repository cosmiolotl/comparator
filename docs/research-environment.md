# Environment contracts (Java 1.21.1)

Primary implementation evidence is Mojang's verified 1.21.1 dedicated server
and [official mappings](https://piston-data.mojang.com/v1/objects/03f8985492bda0afc0898465341eb0acef35f570/server.txt).
Fixtures control weather, daylight, dimension, and chunk readiness. Expected
values are version-specific literals; the target does not supply its own oracle.

## Lighting

`BlockLightEngine`, `LightEngine`, `LightPredicate`, and `LocationPredicate`
anchor the cases. Enclosed opaque chambers exclude skylight. Tests observe
actual light through location predicates, including attenuation, emitter removal,
opaque partitions, and transparent partitions. They do not infer lighting from
the visual state of a lamp.
The opaque-partition case first observes transmitted light, then requires darkness
after inserting the partition. An initially dark, unfinished light update cannot
satisfy that negative control.
Lighting is processed asynchronously by the chunk light engine. These assertions
poll for the specified light value under the case deadline; they do not claim a
one-game-tick lighting completion deadline. No fixture action or case is retried.

## Portals and dimensions

`PortalShape`, `BaseFireBlock`, `NetherPortalBlock`, `LavaFluid`, and `BucketItem`
anchor minimum frame dimensions, optional corners, interior obstruction,
frame breakage, and dimension-dependent lava/water behavior. Each dimension
gets its own fresh forced arena and cleanup scoped to that dimension.

Portal frame checks do not establish portal destination selection, entity
transit, or player movement synchronization. Separate
[player cases](research-player.md#player-input) exercise actual player and item
travel through paired portals.
