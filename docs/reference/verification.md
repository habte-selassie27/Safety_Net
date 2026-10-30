# Verification

`snet verify` proves **which code is running** at a deployed address and that it
matches the audited local source. It is a deployment-integrity check, not a
statement that the contract has no bugs or that past verdicts were correct.

## Contract profile report

`snet report` statically profiles methods, equivalence helpers, direct LLM/web call sites, storage fields, and SafetyNet lint findings. Validator call counts are estimates based on the requested validator count; the report does not submit transactions or claim measured latency or a calibrated numeric risk score.

```bash
snet report contracts/safetynet.py --validators 5 --format md
snet report --format json --out reports/contract-profile.json
```

## Command

```bash
snet verify --network studionet
snet verify --network studionet --publish
snet verify --network studionet --update-registry --publish
snet verify --network studionet --strict --json
```

| Flag | Meaning |
|---|---|
| `--network <name>` | Network whose `deployments/<name>.json` registry is used (default `studionet`) |
| `--address <addr>` | Verify a specific address; it must match the registry entry (E7002 if not) |
| `--rpc <url>` | Override the network RPC URL from `packages/core/src/ground-truth.ts` |
| `--strict` | Treat `PARTIAL` (an unavailable level) as a failure |
| `--publish` | Write `deployments/<network>.verification.json` |
| `--update-registry` | After all substantive levels pass, record source/schema/allowlist hashes. It never changes the address. |
| `--json` | Print one JSON report instead of the human summary |

Exit code `0` means verified (or partial without `--strict`), `7` means a
verification mismatch or a strict partial, `3` means a configuration error.

## Levels

| Level | What it checks | Method |
|---|---|---|
| **L0 registry** | The address is recorded, status is `ACCEPTED`/`FINALIZED`, and the registry source path exists | Read `deployments/<network>.json` |
| **L1 schema** | Local source schema hash equals the on-chain schema hash | `gen_getContractSchemaForCode` (local source) vs `gen_getContractSchema` (deployed address) |
| **L2 source** | Normalized local source hash equals the normalized on-chain code hash | `gen_getContractCode` |
| **L3 probes** | Read-only methods return the expected shapes | `get_config`, `get_incident_count`, `get_incident`, `get_verdict` |
| **L4 config** | `get_config()` domain values and evidence-allowlist hash match the registry | `get_config` |

### Normalization (normalizer: 1)

Source text is normalized before hashing:

1. Remove a UTF-8 BOM.
2. Convert CRLF and lone CR to LF.
3. Remove trailing whitespace at end-of-file only.
4. Append exactly one LF.
5. Hash the UTF-8 bytes with SHA-256 and prefix `sha256:`.

Comments are **not** stripped: the pinned SDK header is part of the audited
source. Schema hashes use canonical JSON (recursively sorted keys, compact
separators). The evidence-allowlist hash covers the sorted, lowercase,
deduplicated list of hosts.

## Reading the output

```text
Verify SafetyNet @ 0x98Ef…91dB (studionet)
  L0 registry     ✔ address 0x98Ef…91dB recorded (tx 0xfff493…)
  L1 schema       ✔ 19 methods match (schema sha256:735c…1095)
  L2 source       ✔ on-chain code hash == local (sha256:d8be…f984)
  L3 probes       ✔ 5/5 read probes passed
  L4 config       ✔ domain config matches registry; allowlist sha256:4390…5dec

Result: VERIFIED
```

A mismatch prints the two hashes and, for schema differences, the method names
that differ. The command never silently downgrades a mismatch to a pass.

## The public artifact

`--publish` writes `deployments/<network>.verification.json`:

- network, chain id, contract name, address, timestamp
- every level with its status and evidence
- local/on-chain source and schema hashes
- allowlist hash and the registry hash that was verified

Regenerate it after every deployment and link it from the release notes. It is
the reproducible record a reviewer can compare against the tagged commit.

## What verification proves

- The deployed address is the one recorded in the public registry.
- The deployed code and schema match the audited local source under the stated
  normalizer.
- The deployed contract returns the documented read-only shapes.
- The immutable domain configuration and allowlist match the deployment record.

## What verification does **not** prove

- That the contract has no bugs.
- That the validator set is honest.
- That past verdicts were correct.
- That evidence submitted by reporters is authentic.
- That a policy was followed internally by a provider.

Those limits are part of the trust boundary (`docs/trust-boundary.md` and
`AGENTS.md` §6.5). Verification is deliberately narrow: it proves **which code
is running**.
