# Integrating an implementation

The default `external` adapter connects to an already running instance. Start your
Rust executable, JVM process, Python program, container, or remote instance using
your existing tooling, wait for readiness, and invoke Comparator. No source-level
integration is needed. Target CPU architecture and runner CPU architecture can differ.

Copy `comparator.config.json` to an ignored `comparator.local.json`, give it a useful
implementation name, and set the endpoint and exact Minecraft release. Use
`implementors/status-only.json` as a starting point for an incomplete server.

## Optional lifecycle hooks

Set `adapter` to a path exporting a default object implementing
[`ServerAdapter`](../src/adapter.ts). Both TypeScript and ESM JavaScript modules work
through the CLI's TypeScript loader. Paths resolve relative to the config file.

| Hook | Purpose |
| --- | --- |
| `setup(config, signal)` | Provision a server or wait until it is ready |
| `beforeEach(caseId, signal)` | Arrange fixtures or reset the world |
| `afterEach(caseId, signal)` | Remove fixtures after connections close |
| `teardown(signal)` | Release resources owned by the adapter |

All hooks are optional. `setup` and `teardown` run once per invocation. Before/after
hooks run only for eligible cases. `afterEach` is attempted even when `beforeEach`
fails; `teardown` is attempted even when setup fails. Cleanup receives a fresh
deadline so an aborted case can still release resources. Listing cases never loads
an adapter or invokes a hook.

The case deadline includes `beforeEach`, world fixture setup when selected, and
the assertion body. World cleanup, adapter cleanup, clock restoration, and each
suite hook have separate deadlines, all using `timeoutMs`. Hook failures are visible:
per-case failures appear on that case; suite lifecycle failures appear in JSON's
`errors` and as JUnit error testcases. SIGINT/SIGTERM cancel the run, then attempt
cleanup and write reports.

Pass the provided AbortSignal to I/O and stop work when it aborts. A deadline cannot
forcibly preempt synchronous JavaScript or stop arbitrary background work. Adapters
must track the processes they start, clean them up in teardown, and never terminate
an instance owned by somebody else. Stop supervised servers after checks complete.

## HTTP reset example

[`implementors/http-reset.ts`](../implementors/http-reset.ts) is a working optional
adapter for a test control service. It posts `{ "caseId": "..." }` before each
eligible case and requires a successful HTTP response. Your service should finish
resetting and preparing the instance before replying.

Add `"adapter": "./implementors/http-reset.ts"` to a root-level configuration, then:

```powershell
$env:COMPARATOR_RESET_URL = 'http://127.0.0.1:3000/reset'
npm run cts -- --config comparator.local.json --strict
```

Or in a POSIX shell:

```sh
COMPARATOR_RESET_URL=http://127.0.0.1:3000/reset npm run cts -- --config comparator.local.json --strict
```

An adapter can use a different control mechanism without changing the tests. The
control service arranges fixtures; protocol observations remain the test oracle.
The starter cases need no reset adapter because each creates fresh connections
and a unique offline username. They still create player data on real servers;
use a disposable instance or reset player data between full runs.

## Server CI

Build and start your implementation using its own CI configuration. Once ready:

```sh
npm ci
npm run cts -- --profile protocol --host 127.0.0.1 --port 25565 --version 1.21.1 --strict
```

Publish `reports/run-*/junit.xml` and `results.json` even when the command fails, and
stop the server in an always-run cleanup step. Use separate instances and report
directories for parallel targets. Repository CI validates the harness with synthetic
TCP peers; implementor CI should run the same catalog against the actual software.

## World control

[vanilla-world.json](../implementors/vanilla-world.json) selects all 512 cases and
declares `world`. Supply its `control.passwordEnv` environment variable and point
both game and RCON endpoints at the same dedicated instance. The config contains
the environment variable name, never the password. Listing does not read the
password or connect. A missing password, rejected authentication, or unavailable
command for declared world support fails visibly.

World fixtures arrange state through standard vanilla commands, keep simulation
frozen during setup, and step by game ticks. They change world state and global
settings; use a disposable world. Cases receive new arena coordinates and do not
reuse the previous case's scheduled updates. Only one Comparator run may control
an instance at a time. Do not let external players, plugins, datapacks, or adapters
advance time or modify fixtures during a case.

For world-only CI use `--profile world --strict`; for complete selected coverage
omit the profile flag with the world config. Capabilities and release gates remain
visible in JSON/JUnit. The shipped baseline launcher verifies and starts Mojang's
1.21.1 server and stops its own process when finished; it does not stop external
servers. See the [README](../README.md#run-the-gameplay-catalog).
