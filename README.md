# Comparator

Comparator is a test suite written to check conformance of Minecraft Java Edition Servers.

The suite checks protocol behavior, player actions, mechanics and their interactions, and persistence across server restarts. This project is currently in alpha; see the [coverage catalog and limits](docs/coverage.md).

Comparator currently supports the following Minecraft versions: **1.21.1\***

\* Partial support

## Run Comparator

Install Node.js 22 or newer, then run

```sh
npm ci
npm run cts:list
```

Start your server using its own tooling. Default Minecraft servers should have the following configuration settings, or their equivalents:

```properties
online-mode=false
enforce-secure-profile=false
enable-status=true
white-list=false
```

Part of Comparator's test suite uses RCON for configuration changes. Your implementation must have RCON enabled in its configuration with the equivalent of the following `server.properties` if you wish to run these tests:

```properties
enable-rcon=true
rcon.port=25575
rcon.password=your-test-password
```

Copy `comparator.config.json` to your configuration file and modify it to set the target details, then begin the test using the CLI:

```powershell
$env:COMPARATOR_RCON_PASSWORD = 'your-test-password'
npm run cts -- --config implementors/vanilla-world.json --profile live --strict
```

For the Java 1.21.1 baseline, with Java 21 or newer on
`PATH` or set to `COMPARATOR_JAVA`:

```sh
npm run check
npm run test:vanilla -- --accept-eula --repeat 2
```

Pass `--accept-eula` only after agreeing to the Minecraft EULA.

An alternative server can implement the optional adapter `restart(mode, signal)`
hook and declare `restart` and `crashRecovery`. See [implementor integration](docs/implementors.md).

## Exit codes

Use `--strict` in conformance CI to fail on any selected skip. Runs with no passes or no matching cases fail.

| Exit | Meaning |
| --- | --- |
| 0 | Selected checks passed, with skips allowed unless `--strict` is set |
| 1 | Conformance failure, no executed checks, empty selection, or strict skip |
| 2 | Invalid configuration, adapter lifecycle failure outside a case, or report error |
| 130 | Interrupted run; cleanup and reporting were attempted |

## Libraries

This repository uses [minecraft-protocol](https://github.com/PrismarineJS/node-minecraft-protocol)
and [minecraft-data](https://github.com/PrismarineJS/minecraft-data).

## Docs

Documentation written by Codex can be found in `docs/`. No guarantees are provided as to its accuracy.
