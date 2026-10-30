---
"@safetynet/cli": minor
---

feat(TST-001..012): add the `safetynet-test` pytest fixtures and wire `snet test`

- `deploy`, `sim`, `gf`, `policy`, `evidence`, `mock_llm`, and `mock_web` fixtures
- string-compatible write results with the full transaction and trace attached
- verdict, vote, budget, revert, and policy-pinning assertions
- deterministic property strategies and a failure-time consensus trace
- `snet test --seed/--validators` and automatic plugin loading
