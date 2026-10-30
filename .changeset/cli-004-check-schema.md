---
"@safetynet/cli": minor
"@safetynet/core": minor
---

feat(CLI-004): extract a real contract schema in `snet check`

- Parse class-level public methods only; nested helpers such as `evaluate` are skipped by indentation
- Support multi-line `def` signatures and strip `self`/type annotations from arguments
- Write `.snet/artifacts/SafetyNet.schema.json` with views, writes, enums, reason codes, and a source hash
- Report enum parity and reason-code parity against `@safetynet/core`
- Add `DUPLICATE_INCIDENT` and `E3004` to the core reason-code closed set
