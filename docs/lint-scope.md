# Lint scope: SI rules vs `genvm-linter`

`genvm-linter` and the official GenLayer VS Code extension cover Python syntax,
SDK API correctness, and generic contract hygiene. SafetyNet does **not**
duplicate those checks. The `SI` catalog is scoped to semantics that only make
sense for an incident/policy adjudication contract.

## Boundary rule

A check belongs in `SI` only if it protects one of these SafetyNet guarantees:

1. Evidence integrity and SSRF safety.
2. Policy version pinning.
3. Verdict determinism at the equivalence boundary.
4. Prompt-injection resistance.
5. Adjudication fairness and fail-closed behavior.
6. Permanence: no deletion or silent overwrite of a verdict.

If a check would make sense for any GenLayer contract, it belongs upstream in
`genvm-linter`; it must not be added here.

## Catalog

| ID | Name | Category | Default | Upstream candidate? |
|---|---|---|---|---|
| SI001 | missing-or-unpinned-sdk-header | compat | error | Yes — generic reproducibility |
| SI002 | multiple-or-zero-contract-classes | compat | error | Yes — generic contract layout |
| SI003 | public-method-missing-annotations | compat | warn | Yes — generic schema/codegen |
| SI010 | unsupported-storage-type | compat | error | Yes — generic storage hygiene |
| SI012 | free-text-in-equivalence-payload | determinism | error | No — SafetyNet verdict payload |
| SI013 | missing-canonicalization | determinism | error | No — SafetyNet canonical verdict |
| SI014 | vague-policy-clause-reference | policy | warn | No — policy authoring |
| SI015 | raw-numeric-confidence-compared | determinism | error | No — verdict confidence bands |
| SI016 | non-canonical-object-compared | determinism | error | No — equivalence boundary |
| SI017 | missing-insufficient-outcome | fairness | error | No — verdict space |
| SI018 | severity-from-llm-without-floor | determinism | warn | No — SafetyNet severity floor |
| SI020 | verdict-before-policy-pin-check | policy | error | No — pinned policy version |
| SI021 | prompt-injection-unfenced-input | injection | error | No — incident evidence fencing |
| SI022 | evidence-fetched-without-cap | evidence | error | No — evidence caps |
| SI023 | url-not-from-manifest-or-allowlist | evidence | error | No — SSRF/allowlist |
| SI024 | evidence-text-stored-on-chain | evidence | error | No — PII/permanence |
| SI025 | raw-evidence-logged | evidence | warn | No — PII |
| SI026 | llm-json-parsed-without-guard | injection | error | No — fail-closed adjudication |
| SI027 | policy-hash-not-rechecked | policy | error | No — policy drift |
| SI030 | too-many-nondet-blocks | determinism | warn | No — adjudication budget |
| SI031 | nondet-in-loop-unbounded | determinism | error | No — adjudication cost |
| SI032 | nondet-in-view | determinism | warn | Partly — generic view hygiene |
| SI033 | unbounded-prompt-interpolation | injection | warn | No — evidence prompt budget |
| SI040 | missing-duplicate-check | fairness | error | No — incident anti-spam |
| SI041 | missing-reporter-rate-limit | fairness | warn | No — incident anti-spam |
| SI042 | deletion-or-overwrite-of-verdict | permanence | error | No — public record |
| SI043 | payable-method-present | fairness | error | No — v1 no-money rule |
| SI044 | admin-override-present | permanence | error | No — neutrality |
| SI045 | verdict-overwritten-on-appeal | permanence | error | No — appeal history |
| SI050 | nondeterministic-python-in-det-path | determinism | error | Partly — generic determinism |
| SI051 | time-or-random-in-compared-value | determinism | error | No — equivalence boundary |
| SI052 | float-in-storage-or-compare | determinism | warn | Partly — generic determinism |
| SI053 | dict-ordering-dependence | determinism | warn | Partly — generic determinism |
| SI054 | set-iteration-order | determinism | warn | Partly — generic determinism |
| SI060 | pattern-misuse-p1-p8 | determinism | warn | No — SafetyNet pattern library |
| SI090 | todo-in-contract | style | info | No — public-record hygiene |
| SI099 | unused-suppression | style | info | Yes — generic suppression hygiene |
| SI000 | suppression-or-parse-error | style | error | Yes — generic suppression/parse |

## Presets

| Preset | Use | Contents |
|---|---|---|
| `recommended` | Local dev and CI | All rules at default severity |
| `strict` | Pre-release | Warnings promoted to errors |
| `predeploy` | Deploy gate | Evidence, permanence, fairness, policy, injection, determinism rules |
| `minimal` | Quick scaffold check | SI001, SI002, SI010, SI020, SI021 |

## Suppression policy

Suppressions use a reason after `--`:

```python
# safetynet-disable-next-line SI030 -- two calls are needed for clause grouping
result = _evaluate_two_groups()
```

- A suppression for an `error` rule without a reason produces `SI000`.
- A suppression that matches no finding produces `SI099`.
- SI023 (SSRF), SI042 (verdict deletion), SI043 (payable), and SI044 (admin
  override) should not be suppressed in shipping code. The engine cannot
  enforce "never suppress" without a special case; reviewers must treat any
  suppression of these four as a blocking issue.

## False-positive measurement

Run:

```bash
snet lint --fp-report
```

or directly:

```bash
PYTHONPATH=packages/safetynet-lint python -m safetynet_lint.cli --fp-report
```

The report is committed at `docs/lint-fp.md`. The current result is 38/38 rules
clean on `contracts/` and on each rule's own `good.py` fixture.

## Tests

- `packages/safetynet-lint/tests/corpus/<RULE>/bad.py` must fire the rule.
- `packages/safetynet-lint/tests/corpus/<RULE>/good.py` must not fire the rule.
- `packages/safetynet-lint/tests/test_golden.py` pins the reference contract to
  zero findings and the catalog to a stable ID/severity snapshot.
- Reporter tests cover text, JSON, SARIF, GitHub annotations, and markdown.
