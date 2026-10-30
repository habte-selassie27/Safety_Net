---
"web": minor
---

feat(CON-024): derive demo verdicts from the contract's aggregation rules

- Port the contract's `_aggregate` decision table to `src/lib/aggregate.ts` so
  the demo store and the deployed contract cannot disagree on how clause
  findings become a verdict, severity, confidence, and clause citations.
- Replace the claim-keyword verdict mapping with a deterministic clause
  evaluator plus a closed-enum claim classifier feeding a severity floor, and
  build the public rationale from the templated form.
- Cover the aggregation table, confidence downgrades, severity floors, and
  demo adjudication with tests.
- Remove the unused `useAppData` hook and `AppData` type so list surfaces have a
  single read path.
