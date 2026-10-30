# SafetyNet Metrics (neutral snapshot)

Snapshot: 2026-10-28 · Network: studionet · Contract: 0x7E2D9405CfC642F3abda3048cc2F265f7586317e · Version: v0.1.0

## Incidents
| Metric | Value | Notes |
|---|---|---|
| Incidents filed | 0 | pre-launch |
| Incidents decided | 0 | |
| Unique reporters | 0 | |
| Median time to first adjudication | unmeasured | |
| Appeals filed | 0 | |
| Appeal rate | unmeasured | |

## Verdict distribution
| Verdict | Count | Share |
|---|---|---|
| POLICY_VIOLATION | 0 | |
| POLICY_ADEQUATE_BUT_HARM | 0 | |
| INSUFFICIENT_EVIDENCE | 0 | |
| OUT_OF_SCOPE | 0 | |
| DISMISSED | 0 | |

Unmeasured values stay blank. Never estimate a number into this file.

## Synthetic seed fixtures

These counts are fixture checks, not real-world incidents.

| Metric | Value | Notes |
|---|---|---|
| Seed fixtures | 5 | all labelled `SYNTHETIC` |
| Expected verdicts matched | 5/5 | `snet seed --seed 1337 --validators 5` |
| Verdicts covered | 4/5 | `OUT_OF_SCOPE` covered by direct-mode tests |

## Reliability

Snapshot: 2026-10-28 · Mode: in-process simulator · Scenario: `medical-advice-violation`

| Metric | Value | Notes |
|---|---|---|
| Verdict stability (medium noise) | 100/100 | `snet tighten --samples 200 --seed 1 --noise medium` |
| Verdict stability (high noise) | 64/100 | stress case; 2–3 divergent non-leader validators can force an appeal round |
| False-disagree (medium) | 0% | accepted verdict differs or consensus fails |
| False-agree (medium) | 0% | flipped leader accepted by honest validators |
| Fuzz properties | 7/7 hold | `snet fuzz --cases 100 --seed 1` |

The stability numbers come from mocked LLM/web calls in the simulator. They
measure the equivalence and aggregation design, not a specific model's
behavior. See `docs/research/verdict-stability.mdx`.
