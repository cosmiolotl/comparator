# Adding conformance cases

Add a primary case or a cohesive family of related scenarios under
`tests/<feature>/`, then register it through `tests/index.ts`. Data-driven families
must represent distinct mechanics or boundaries, with a stable ID for each case.
Registration is explicit so order and coverage remain reviewable.

Each case has a stable ID, title, required capabilities, contract reference, and
async body. Add an explicit `versions` list when the requirement differs by release.
Missing capabilities and versions produce recorded skips.

```ts
import assert from 'node:assert/strict';
import type { ConformanceCase } from '../../src/suite.js';

export default {
  id: 'java.play.example',
  title: 'Describe one externally observable requirement',
  requires: ['login', 'play'],
  reference: 'docs/conformance.md#your-contract',
  versions: ['1.21.1'],
  async run({ protocol, username }) {
    const connection = protocol.login(username);
    const login = await connection.waitFor('login', 'play');
    assert.equal(typeof login.data.entityId, 'number');
  },
} satisfies ConformanceCase;
```

Specify the normative behavior in `docs/conformance.md` before adding assertions.
Test observable outcomes, not server internals, log wording, brand strings, or
wall-clock latency. World cases may assert exact **game tick** boundaries through
the controlled fixture and vanilla commands. Keep shared expectations in the suite.

`protocol.status()` starts a status handshake. `protocol.login(username)` starts an
offline login. `waitFor(name, state)` consumes a matching received packet, including
packets received before the wait was registered. `write(name, fields)` sends a
version-encoded packet. Failures, disconnects, and deadlines reject pending waits;
case completion closes every tracked socket.

The inbox retains the most recent 64 unconsumed packets; it is not a world-state
cache. Register waits promptly and add specialized helpers before building large
gameplay scenarios. Failure traces retain at most 128 packet names per connection,
including received packets and explicit harness writes. Protocol-library automatic
writes are not currently traced. Packet payloads and authentication data are not
written to the trace.

The protocol library automates some client responses. An assertion requiring control
over those responses needs an explicit driver extension; observing a successful
join does not prove all underlying protocol rules. Keep Java packet details in
`src/protocol/` or Java-specific cases, leaving lifecycle and reporting independent.

Run a focused case against an actual implementation with `--filter <id>`. For
harness changes, add E2E scenarios that invoke the CLI through a real TCP connection,
then run `npm run check`. Do not add unit tests. Keep every source file under 400
lines and extract helpers when a feature grows.

## World scenarios

Use `scenario` from `src/world/scenario.ts`. It requires the `world` capability,
gates the case to 1.21.1, and rejects bodies without an observable assertion.

```ts
export const cases = [scenario({
  id: 'java.world.example',
  title: 'A scheduled update waits for its due tick',
  reference: 'docs/research-world.md#ticks',
  async run(world) {
    await world.command('setblock ~ ~5 ~ sand');
    await world.step(1);
    await world.expect('if block ~ ~5 ~ sand');
    await world.step(1);
    await world.expect('if block ~ ~5 ~ air');
  },
})];
```

Use relative coordinates in the provided arena and `cts_`-prefixed entity tags.
The origin is a block corner; use `~0.5` to place entities at block centers.
`world.command(...commands)` arranges state sequentially; parse failures fail the
case, but expected no-op runtime failures are allowed. Setup must have positive
controls where failure could make a negative assertion vacuous. `world.expect`
requires an explicit if/unless condition and a fresh observation token.
`world.result(command, integer)` resets its destination before storing the result;
missing results cannot reuse a previous value. `world.value` reads a command's
integer result for derived observations, not for learning expected behavior.

Use `world.step(n)` for simulation time. Never use wall-clock sleeps as a tick
oracle. `world.cycleChunkTickets()` observes loss and return of ticking readiness;
it does not prove a disk reload. Fresh arenas prevent pending updates from older
cases firing at the new fixture. No automatic retry is performed.

Do not assert random AI paths, a particular merge survivor, omitted default NBT
fields, or floating-point decimal representations without an appropriate fixture.
For each family, document primary-source evidence and run against the pinned
official baseline. Probe adjacent tick boundaries and deliberate fixture
perturbations to ensure assertions detect deviations.
