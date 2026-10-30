---
"@safetynet/cli": minor
---

feat(ANL-010, ANL-001/002): add fuzz properties and verdict-stability measurement

- `snet fuzz` runs the seven documented properties with deterministic seeds and a replay corpus
- `snet tighten` measures stability, false-disagree, false-agree, and the weakest canonical field
- `safetynet_sim.fuzz` and `safetynet_sim.tighten` expose the harnesses to Python callers
- Reference results and limitations are recorded in `docs/research/verdict-stability.mdx`
