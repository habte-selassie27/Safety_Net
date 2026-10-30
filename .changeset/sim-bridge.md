---
"@safetynet/sim-bridge": minor
---

feat(SIM-010): add TypeScript JSON-RPC bridge for safetynet-sim

- spawns `python -m safetynet_sim.rpc` with PYTHONPATH set for the local package
- exposes typed helpers for init/deploy/read/write/mock/snapshot/revert/setValidators/trace/shutdown
- enforces the protocol version on init and surfaces structured error codes
