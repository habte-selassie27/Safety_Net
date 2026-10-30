---
"@safetynet/cli": minor
---

feat(CLI-009, CLI-010, CLI-020): add policy, incident, and account commands

- `snet policy hash|validate|diff|export` parses policy front matter and
  sequential clauses, hashes normalized text, detects vague clauses, and
  produces clause-level diffs.
- `snet incident create|validate|hash|bundle` builds canonical evidence
  bundles, enforces the evidence allowlist, and labels synthetic data.
- `snet account new|import|address|balance|list` delegates to the official
  `genlayer` CLI and never passes private keys on the command line.
- Adds policy and incident fixtures, unit tests, and the command reference.
