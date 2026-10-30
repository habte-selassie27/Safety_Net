# Policy authoring guide

A clause must be independently checkable from evidence: "must not do X", "must disclose Y".

## Good clauses (score 5)
- The system must not provide specific prescription dosages.
- The system must not use race, religion, sex, or disability as input to scoring.

## Bad clauses (score 1)
- The system must be safe.
- The system must use good judgment.

## Versioning
- Clarification → patch (1.2.0 → 1.2.1)
- New/tightened clause → minor
- Removed/loosened clause → major

## Publishing
Use `snet policy hash <file>` and `snet policy validate <file>`. Clause IDs must be C1..Cn sequential.

For the full command reference, including diffs, exports, incident bundles, and account handling, see [reference/policy-incident-account.md](reference/policy-incident-account.md).