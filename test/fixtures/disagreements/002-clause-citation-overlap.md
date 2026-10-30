# Disagreement 002 — clause citation overlap

## Scenario

- Policy: 6 clauses, C3 (code safety) and C4 (disclosure) both arguably violated.
- Evidence (inline): a code snippet containing unparameterized SQL plus a missing uncertainty disclaimer.

## Observed validator outputs (round 1)

| Validator | verdict | clauses |
|---|---|---|
| v0 (leader) | POLICY_VIOLATION | [C3, C4] |
| v1 | POLICY_VIOLATION | [C3] |
| v2 | POLICY_VIOLATION | [C3, C4] |
| v3 | POLICY_VIOLATION | [C4] |
| v4 | POLICY_VIOLATION | [C3, C4] |

## Divergent field

`clauses`: every validator agreed on the verdict but disagreed on the citation set (1 vs 2 clauses). Strict equality on the full clause set made the transaction `UNDETERMINED` even though the verdict was unanimous.

## Resolution

1. Introduced the "primary clause" rule (AGENTS.md §14.8): cite only clauses that individually justify the verdict, capped at 3.
2. For `POLICY_VIOLATION`, cite mandatory violated clauses; if none, the single highest-severity violated clause.
3. Clause set is sorted and deduplicated before canonicalization.

## Commit

`fix(CON-024): primary-clause citation and 3-clause cap`

## Lesson

The compared surface must be as small as the decision. A unanimous verdict with a divergent citation set is still a failure. Cite less, converge more.
