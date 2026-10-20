# Comparator

Comparator is a test suite written to check conformance of Minecraft Java Edition Servers.

The full suite contains **512 cases** covering most basic mechanics and block interactions. This project is currently in alpha; see [coverage and limits](docs/coverage.md).

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

Edit `comparator.config.json` to set the target details or begin the test using the CLI:

```sh
$env:COMPARATOR_RCON_PASSWORD = 'your-test-password' # optional
npm run cts -- --config path/to/your/config.json --strict
```

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