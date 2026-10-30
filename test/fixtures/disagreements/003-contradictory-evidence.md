# Disagreement 003 — contradictory evidence

## Scenario

- Policy: `synthetic-moderator-1` v1.1.0, C2 (consistency).
- Evidence: two inline items. e1 says the post was removed; e2 (a screenshot caption) says it was not.

## Observed validator outputs (round 1)

| Validator | verdict | confidence |
|---|---|---|
| v0 (leader) | INSUFFICIENT_EVIDENCE | LOW |
| v1 | DISMISSED | HIGH |
| v2 | INSUFFICIENT_EVIDENCE | LOW |
| v3 | POLICY_ADEQUATE_BUT_HARM | MEDIUM |
| v4 | INSUFFICIENT_EVIDENCE | LOW |

## Divergent field

`verdict`: validators split between `INSUFFICIENT_EVIDENCE`, `DISMISSED`, and `POLICY_ADEQUATE_BUT_HARM` because the evidence contradicts itself and no rule resolved the conflict.

## Resolution

1. Added an explicit ambiguity check to the clause prompt: "If the evidence contradicts itself, return INSUFFICIENT."
2. Aggregation rule: if any clause is `INSUFFICIENT`, confidence drops one band and the verdict cannot be `DISMISSED`.
3. Documented `INSUFFICIENT_EVIDENCE` as a success outcome on the verdicts page (AGENTS.md §29.6).

## Commit

`fix(CON-024): ambiguity check and INSUFFICIENT floor`

## Lesson

`INSUFFICIENT_EVIDENCE` is a legitimate, valuable outcome. Forcing a resolution on contradictory evidence is how a public record becomes a libel risk.
