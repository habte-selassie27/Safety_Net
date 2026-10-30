# ADR-001: Linter runs in Python

## Decision
The SafetyNet linter runs in Python, shelling out from the TS CLI. The TS CLI
may request text, JSON, SARIF, GitHub annotations, or markdown from the Python
engine.

## Rationale
- The contract is Python; parsing fidelity matters.
- `genvm-linter` already covers generic syntax and SDK API checks; the SI rules
  only add SafetyNet-domain semantics.
- The Python `ast` module gives a precise `ModuleModel` without a second parser.
- The same package can later run in Pyodide or a worker if needed.

## Structure (v0.2)
- `model.py` — AST extraction: contracts, storage fields, public methods,
  decorators, non-deterministic calls, and source segments.
- `rules.py` — rule metadata plus one check per SI rule.
- `engine.py` — presets, overrides, suppression intervals, file discovery, and
  the lint runner.
- `reporters.py` — text, JSON, SARIF 2.1.0, GitHub annotations, markdown, and
  `--explain` / `--list-rules`.
- `measure.py` — per-rule false-positive measurement against `contracts/` and
  each rule's known-good corpus fixture.

## Consequences
- The CLI consumes structured output only through `safetynet_lint.cli`.
- Suppressions are parsed from source comments, not from a separate config.
- Rule behavior is pinned by `tests/corpus/<RULE>/{bad,good}.py`,
  `tests/golden/safetynet.json`, and `tests/golden/rules.json`.
