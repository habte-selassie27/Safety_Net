---
"@safetynet/cli": minor
---

feat(SIM-004..012): deepen simulator faults, counters, and RPC conformance

- model a forced offline leader as a leader timeout, then elect a fresh leader
  for the appeal round
- let a malicious leader propose a configured payload so honest validators can
  reject it
- surface `validator_work_units` and `tampered` on `ConsensusTrace` and
  `TxResult`, and add the deterministic `gas_like` cost model
- snapshot and restore the forced leader
- reject JSON-RPC protocol-version mismatches and unknown `sim.init` config keys
  with structured `data.code` errors
- add regression tests for leader timeout, malicious leader, garbage validator,
  stale web per validator, tampered evidence, LLM provider failure, and RPC
  error paths
