# Policy, incident, and account commands

SafetyNet's policy and incident tools are local and deterministic: they parse,
validate, hash, and bundle files without touching the network. Account commands
delegate to the official `genlayer` CLI so the existing OS-keychain account is
reused and private keys are never passed on a command line.

## Policy (`snet policy`)

```bash
snet policy hash policies/acme-v1.2.0.md
snet policy validate policies/acme-v1.2.0.md
snet policy validate policies/acme-v1.2.0.md --strict
snet policy diff policies/acme-v1.2.0.md policies/acme-v2.0.0.md
snet policy export policies/acme-v1.2.0.md --out policy.json
```

- `hash` prints `sha256:` over normalized text (BOM removed, CRLF → LF,
  trailing spaces removed, one final LF). Use `--json` for the raw hash too.
- `validate` checks front matter (`Policy-Version`, `Provider`,
  `Effective-Date`), sequential `C1..Cn` clause IDs, clause lengths, and the
  clause count. Vague clauses produce `E2025` warnings; `--strict` makes
  warnings fail.
- `diff` compares by clause ID and reports added, removed, and changed clauses.
- `export` emits the machine-readable clause list used by the web app and
  deployment scripts.

Clause headers must look like:

```md
## C1 — Medical advice
```

`<!-- mandatory: true -->` marks a clause that can justify a
`POLICY_VIOLATION` on its own.

## Incidents (`snet incident`)

```bash
snet incident create \
  --system synthetic-chatbot-1 \
  --policy-version 1.2.0 \
  --claim "SYNTHETIC: the assistant gave a prescription dosage." \
  --evidence evidence.json \
  --synthetic \
  --out incident.json

snet incident validate incident.json
snet incident hash incident.json
snet incident bundle incident.json --out bundle/
```

The incident file embeds the evidence manifest and records:

- `evidence_hash` — sha256 of the canonical manifest;
- `incident_hash` — sha256 of the canonical incident fields;
- `canonical_manifest_json` — the exact bytes hashed.

`validate` rejects unknown keys, out-of-range claims, malformed manifests, and
evidence URLs that are not https, use an IP literal, or fall outside the
allowlist. The default allowlist matches the current studionet deployment and
can be overridden with `SNET_EVIDENCE_ALLOWLIST` or `--allowlist`.

Likely PII in a claim produces a warning, not a rejection. Inline evidence is
public and permanent after filing; remove names, emails, handles, and phone
numbers unless they are necessary to the claim.

`bundle` writes a self-contained directory with `incident.json`,
`manifest.json`, `hashes.json`, and `README.txt`. It never fetches URL evidence.

## Accounts (`snet account`)

```bash
snet account list
snet account new --name demo --keystore ./demo.json
snet account import --name imported
snet account address --name demo
snet account balance --name demo --network studionet
```

- `new` and `import` are interactive: `genlayer` prompts for the keystore
  password. SafetyNet never accepts a private key as a command-line argument.
- `--keystore` on `new` copies the generated keystore to the requested path.
- New accounts are not made active unless `--set-active` is passed, so an
  existing deployment account is not silently replaced.
- `balance` uses the RPC URL from `packages/core/src/ground-truth.ts`.

`SNET_PK` remains the supported way to provide a key to `snet deploy` in CI and
other non-interactive environments. Never commit it or paste it into a command
that will be logged.
