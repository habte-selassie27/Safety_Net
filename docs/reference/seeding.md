# Synthetic seed fixtures (SEED-001)

`snet seed` loads the five synthetic demo incidents into the in-process
simulator, adjudicates each one with deterministic LLM and web mocks, and
checks the result against the fixture's expected verdict.

```bash
snet seed
snet seed --json
snet seed --no-adjudicate
snet seed --seed 1337 --validators 5
```

Everything printed by the command is labelled `SYNTHETIC DATA — not real
incidents`. The fixtures live in `test/fixtures/seed/`:

```
seed-v1.json
policies/
  synthetic-chatbot-1@1.0.0.md
  synthetic-agent-loan@2.0.0.md
  synthetic-codegen-1@1.0.0.md
  synthetic-moderator-1@1.1.0.md
```

## What the runner does

1. Loads the fixture and rejects anything not marked `"synthetic": true`.
2. Reads each policy file and computes its canonical `sha256:` hash with the
   same normalization as `snet policy hash`.
3. Deploys `contracts/safetynet.py` in the simulator.
4. Registers the systems, claims the claimed ones, files the incidents, and
   files the provider responses.
5. Serves the exact policy text and evidence through `mock_web`, and each
   clause finding through `mock_llm`.
6. Adjudicates, then compares `verdict`, `severity`, `confidence`, and
   `clauses` to the fixture. A mismatch makes the command exit 1.

The runner is deterministic for a given `--seed` and `--validators` value. It
does not use the web app's illustrative hashes; policy and evidence hashes are
computed from the fixture text.

## The five fixtures

| Fixture | Expected verdict | Severity | Confidence |
|---|---|---|---|
| `medical-dosage` | `POLICY_VIOLATION` | `SERIOUS` | `HIGH` |
| `loan-protected-attribute` | `POLICY_VIOLATION` | `CRITICAL` | `HIGH` |
| `codegen-policy-gap` | `POLICY_ADEQUATE_BUT_HARM` | `MODERATE` | `MEDIUM` |
| `moderation-consistency` | `DISMISSED` | `LOW` | `HIGH` |
| `chatbot-unverifiable-screenshot` | `INSUFFICIENT_EVIDENCE` | `LOW` | `LOW` |

`OUT_OF_SCOPE` is covered by the direct-mode gate tests, not by the demo set.

## Public-network seeding is disabled

The simulator-only restriction is intentional. Public seeding requires:

- an allowlisted HTTPS host that serves the exact policy text, and
- owner approval to write permanent synthetic records to StudioNet.

Until both exist, `snet seed --network studionet` exits with `E3001` and writes
nothing.
