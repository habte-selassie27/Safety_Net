---
"@safetynet/client": minor
"@safetynet/cli": minor
---

feat(GEN-002..005): typed client runtime with TrackedTx, React hooks, generated decoders and address export

- `createClient` + `contract<T>()` with typed reads/writes and per-method JSON decoders
- `TrackedTx` adaptive polling, page-visibility pause, status events, typed failures
- `ReadController`/`WriteController` + `useRead`/`useWrite` React bindings
- `FakeAdapter` for sim/demo/tests
- `genlayer-js` confined to one adapter file
- `snet codegen` now introspects the contract (params, dataclasses, enums) and emits raw + parsed APIs with a schema hash
- `snet export addresses --format ts|json|env` generates `apps/web/src/generated/addresses.ts`; the web app fails loudly on a missing network address
