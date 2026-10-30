---
"@safetynet/cli": patch
---

chore(sim): make `safetynet-sim` pass `mypy --strict`

- Type the storage containers, mock registries, RPC bridge, and shim.
- Split `MockLLM.when` and `MockWeb.when` so their signatures no longer conflict.
- Remove method/attribute name collision in the fluent mock builder.
