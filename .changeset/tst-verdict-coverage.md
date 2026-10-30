---
"safetynet-test": patch
---

feat(TST-034): report committed verdict coverage after simulator tests

- Capture accepted adjudication outcomes before pytest tears down per-test fixtures.
- Print counts for each canonical verdict and identify outcomes with no coverage.
- Test outcome collection so reverted, undetermined, unrelated, and malformed transactions are excluded.
