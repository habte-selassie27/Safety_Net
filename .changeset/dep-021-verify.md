---
"@safetynet/cli": minor
"@safetynet/core": minor
---

feat(DEP-020..024): registry-backed deployment verification

- L0 registry consistency, L1 schema hash, L2 normalized source hash, L3 read-only probes, L4 config/allowlist hash
- `snet verify --publish` writes `deployments/<network>.verification.json`
- `--update-registry` records verified hashes without changing the address
- Shared network descriptors in `@safetynet/core/ground-truth`
- Studionet redeployed with the SI026 evidence-manifest guard and verified L0–L4
