---
"@safetynet/cli": minor
---

feat(CLI-002): offline `snet init` templates and venv setup

- Refuse any non-empty target directory with `E2001` (including the current directory)
- Validate `--template` (`policy | incident | provider-claim`) with `E1005`
- Generate the full policy tree, contract copy, `gltest.config.yaml`, and `.gitignore`
- Create a `.venv` and best-effort install `safetynet-test` (local editable when available); offline failures are warnings
- `--json` prints `{ ok, dir, template }`
- `snet test` loads the bundled pytest plugin explicitly so fresh projects work without a pip install
- Add `--snet-network` to the pytest plugin options
