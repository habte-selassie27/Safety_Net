# Contract schema artifact

`snet check` parses `contracts/safetynet.py` and writes a machine-readable schema to
`.snet/artifacts/SafetyNet.schema.json`. Codegen (`snet codegen`) and the docs generator
read this file, so it must be deterministic for a given source.

## Shape

```json
{
  "contract": "SafetyNet",
  "sourceHash": "sha256:…",
  "enums": {
    "verdicts": ["POLICY_VIOLATION", "POLICY_ADEQUATE_BUT_HARM", "INSUFFICIENT_EVIDENCE", "OUT_OF_SCOPE", "DISMISSED"],
    "severities": ["LOW", "MODERATE", "SERIOUS", "CRITICAL"],
    "confidences": ["LOW", "MEDIUM", "HIGH"],
    "incidentStatuses": ["OPEN", "RESPONDED", "DECIDED", "APPEALED", "FINAL"]
  },
  "reasonCodes": {
    "contract": ["BAD_CLAIM", "POLICY_DRIFT", "…"],
    "unknown": [],
    "unused": ["EVIDENCE_TOO_LARGE"]
  },
  "parity": {
    "verdicts": true,
    "severities": true,
    "confidences": true,
    "incidentStatuses": true,
    "reasonCodes": true
  },
  "methods": {
    "views": [{ "name": "get_incident", "type": "view", "args": ["incident_id"], "returns": "str" }],
    "writes": [{ "name": "file_incident", "type": "write", "args": ["system_id", "policy_version", "claim", "evidence_hash", "evidence_manifest"], "returns": "str" }],
    "summary": { "total": 19, "views": 11, "writes": 8 }
  }
}
```

## Rules

- Only class-level public methods are listed. Nested helpers (for example the `evaluate`
  closure inside `adjudicate`) are skipped by indentation, and names starting with `_` are
  treated as internal.
- `self` is removed from `args`; annotations are stripped so the schema stays language-neutral.
- `sourceHash` is `sha256` over the source with the file's bytes unchanged. A deployment
  registry records the same hash so `snet verify` can compare them.
- `parity` compares the contract's enum tuples with `@safetynet/core`. A `false` value is a
  drift bug: the UI and the contract would disagree about a closed set.
- `reasonCodes.unknown` must be empty. Every code the contract can raise has to exist in
  `REASON_CODES` so the web app can render a friendly message. Codes listed in
  `reasonCodes.unused` are reserved: they exist in core but no current code path raises them.

## Regenerating

```bash
snet check contracts/safetynet.py
```

The artifact is written under `.snet/`, which is gitignored. CI regenerates it on every run
and fails if `parity` contains a `false` value.
