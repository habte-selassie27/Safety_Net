# Fuzz properties

`snet fuzz` runs seven deterministic property checks against the adjudication
path (ANL-010). It uses the in-process simulator with mocked LLM and web calls,
so it needs no network, API key, or model access.

```bash
snet fuzz --cases 100 --seed 1
snet fuzz --property injection-resistance
snet fuzz --json --corpus .snet/fuzz-corpus
```

## Properties

| Property | Statement | What it catches |
|---|---|---|
| `verdict-reflexive` | Identical evidence and policy produce the identical canonical verdict | Non-determinism between two filings |
| `verdict-monotone-evidence` | Adding a clearly violating clause match cannot flip `POLICY_VIOLATION` to `DISMISSED` | Aggregation that weakens as violations accumulate |
| `policy-version-lock` | Publishing a newer policy version does not change the verdict for an incident filed against an older version | Policy drift and mutable pinning |
| `evidence-cap-enforced` | Oversized item counts, oversized manifests, and unknown keys are rejected without changing the incident counter | Missing caps or non-atomic validation |
| `injection-resistance` | Instruction injection in the claim/evidence does not change the verdict and stays inside the fenced data blocks | Missing fencing or instruction leakage |
| `appeal-supersedes-not-deletes` | An appeal preserves the prior verdict in the appeal record and history | Overwriting a public verdict |
| `no-free-text-comparison` | The payload crossing the equivalence boundary contains only closed enums, clause IDs, and a bounded reason code | Model prose or unbounded data in the consensus payload |

## Corpus

Failures are written to `.snet/fuzz-corpus/<property>.json` as seed and case
index pairs:

```json
{
  "version": 1,
  "property": "policy-version-lock",
  "cases": [{ "seed": 1, "case": 7 }]
}
```

The next run replays these cases first. Raw evidence and claim text are not
stored in the corpus, so a shared corpus does not leak reporter content. A case
that passes again is removed from the corpus.

The property checks are deterministic by seed. `--cases` controls newly
generated cases per property; replayed corpus cases are additional.

## Limits

- The suite tests the contract's logic under controlled mocks. It cannot prove
  that a particular model will resist every jailbreak.
- Prompt fencing is a mitigation, not a guarantee (AGENTS.md §33.3). Add new
  adversarial strings to the security corpus as they are discovered.
- `no-free-text-comparison` inspects the simulator's recorded payload. It does
  not inspect a real validator's internal work, only the value the contract
  passes to the equivalence helper.
- The default target is `SafetyNet.adjudicate`; scenario-specific workflows
  should be covered by `snet simulate` and `snet tighten`.
