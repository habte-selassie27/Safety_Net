---
"@safetynet/cli": minor
---

feat(LNT-002..004, LNT-010..033): deep SI lint engine

- Add an AST `ModuleModel` with contracts, storage, public methods, and
  non-deterministic call extraction.
- Implement the full SI rule catalog, including prompt fencing, SSRF URL
  provenance, policy pinning, deterministic severity, and permanence rules.
- Add suppression parsing with mandatory reasons and unused-suppression
  reporting.
- Add presets (`recommended`, `strict`, `predeploy`, `minimal`), rule
  overrides, `--explain`, `--list-rules`, and `--write-docs`.
- Add text, JSON, SARIF, GitHub, and markdown reporters.
- Add bad/good corpus coverage per rule, golden tests for the reference
  contract and catalog, and a false-positive measurement report.
- Wire `snet lint` flags and multi-path support.
