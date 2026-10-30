---
"@safetynet/cli": minor
---

feat(CLI-011): add `snet deploy`

- wraps `genlayer deploy` with a plan and explicit confirmation
- runs the predeploy lint gate unless `--skip-checks`
- writes `deployments/<network>.json` atomically and records deployment history
- supports `--dry-run`, `--yes`, `--verify`, `--json`, `--args`, `--rpc`, and `--tag`
