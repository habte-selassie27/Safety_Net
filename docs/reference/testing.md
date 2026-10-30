# Testing SafetyNet contracts (`safetynet-test`)

`safetynet-test` is a pytest plugin for exercising SafetyNet adjudication in
the deterministic simulator. It provides fixtures for deploying the contract,
building policies and evidence, mocking LLM/web calls, and asserting on
verdicts and consensus traces.

```bash
snet test packages/safetynet-test/tests
snet test --seed 42 --validators 5
```

`--mode` currently accepts `sim` only. Direct and network suites are run with
the official `gltest` runner until the CLI adapters land.

## Fixtures

| Fixture | Returns | Purpose |
|---|---|---|
| `deploy` | callable | Deploy `contracts/safetynet.py` with the default domain config |
| `policy` | builder | `policy.version("1.0.0").clause("C1", text, mandatory=True)` |
| `evidence` | builder | `evidence.inline(text)` / `evidence.url(url, text=...)` |
| `mock_llm` | registry | Match by `contains`, `regex`, `exact`, `hash`, clause, or validator |
| `mock_web` | registry | Serve policy/evidence URLs; `mock_web.policy(policy)` |
| `gf` | cheatcodes | `prank`, `warp`, `snapshot`, `expect_revert`, `expect_status` |
| `sim` | simulator | Direct access to leader/validator state |
| `context` | `TestContext` | Sender, last transaction, last trace |

## A complete test

```python
from safetynet_test import assert_verdict


def test_medical_dosage(deploy, policy, evidence, mock_web, mock_llm):
    sn = deploy()
    pol = policy.version("1.0.0").clause(
        "C1",
        "The system must not provide specific prescription dosages.",
        mandatory=True,
    )
    sn.write.register_system(
        "synthetic-chatbot-1", "Synthetic Chatbot", "synthetic-provider",
        pol.version_value, pol.hash(), pol.clause_ids(), pol.url,
    )
    mock_web.policy(pol)
    mock_llm.clause("C1").respond(
        {"clause_id": "C1", "finding": "VIOLATED", "reason_code": "EXPLICIT"}
    )

    ev = evidence.inline("SYNTHETIC TRANSCRIPT: Take 4000mg hourly.")
    inc_id = sn.write.file_incident(
        "synthetic-chatbot-1", "1.0.0",
        "SYNTHETIC: the assistant gave a prescription dosage.",
        ev.hash(), ev.manifest_json(),
    )
    tx = sn.write.adjudicate(inc_id)
    assert tx.status == "ACCEPTED"
    assert_verdict(sn.read.get_verdict(inc_id),
                   verdict="POLICY_VIOLATION", severity="SERIOUS")
```

`sn.write.*` returns a string-compatible `WriteResult`, so it can be used as
an incident id and also exposes `.status`, `.votes`, `.nondet_blocks`, and
`.trace`.

## Determinism and failures

The simulator is seeded. `snet test --seed N --validators M` forwards both
values. On a failed consensus test, print the trace:

```python
from safetynet_test import print_trace

print_trace(tx)
```

Unmocked LLM or web calls fail loudly with a copy-paste suggestion. The
simulator approximates consensus; run the direct/network suites before
shipping a contract change.
