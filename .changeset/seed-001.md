---
"@safetynet/cli": minor
---

feat(SEED-001): add synthetic seed fixtures and `snet seed`

- five labelled `SYNTHETIC` incidents covering four systems and five expected verdicts
- canonical policy hashes computed from the fixture text, not illustrative values
- deterministic simulator runner with `--seed`, `--validators`, `--no-adjudicate`, and `--json`
- mismatch reporting for every verdict field; public-network seeding stays disabled
