# Simulator coverage and fidelity limits

`safetynet-sim` models the GenLayer leader/validator/appeal flow in-process so
adjudication logic can be tested deterministically with no network and no API
keys. It is **not** the real network.

> sim mode approximates consensus; run `--mode network` before shipping.

## What is modeled

| Concept | Status | Notes |
|---|---|---|
| `TreeMap[K, V]` | Yes | set/get/in/len/iterate/items; record-of-mapping semantics |
| `DynArray[T]` | Yes | append, index, assign, iterate |
| `u256` / `i256` | Yes | construction bounds enforced |
| `Address` | Yes | bytes/int/hex, `str()` round-trips |
| Contract loading | Yes | real `contracts/safetynet.py` runs under the shim |
| `@gl.public.view` / `@gl.public.write` | Yes | discovered by conventional method call |
| `@allow_storage` | Yes | no-op in sim |
| `gl.message.sender_address` | Yes | per-execution sender |
| `gl.block.timestamp` | Yes | fixed epoch, advanced by `warp`/`warp_by` |
| `gl.vm.UserError` | Yes | surfaces as `REVERTED` with the reason code |
| `gl.nondet.exec_prompt` | Yes | mocked; unmocked calls fail loudly |
| `gl.nondet.web.render` | Yes | mocked; `text`/`html` modes |
| `gl.eq_principle.strict_eq` | Yes | payload compared across executions |
| `gl.eq_principle.prompt_comparative` | Approximated | payload is still compared with strict equality |
| `gl.eq_principle.prompt_non_comparative` | Approximated | payload is still compared with strict equality |
| Leader election | Yes | deterministic; `set_leader` forces the next round only |
| Validator votes | Yes | agree / disagree / timeout / abstain |
| Majority rule | Yes | strictly greater than `majority * set_size` |
| Appeals / validator growth | Yes | `new_size = size * appeal_growth + 1` |
| Timeouts / offline validators | Yes | vote becomes `TIMEOUT`; an offline forced leader models a leader timeout |
| Fault injection | Yes | lazy, malicious (incl. leader payload), flaky, abstain, garbage, offline, stale web, tampered evidence, LLM provider error |
| Cost counters | Yes | nondet blocks (leader), LLM/web calls (all), work units, `gas_like` |
| Snapshots / revert | Yes | full state incl. mocks, validators, and forced leader |
| JSON-RPC stdio bridge | Yes | protocol v1; mismatch and unknown config keys are rejected |

## What is not modeled

- Real leader-selection and validator-set selection algorithms.
- The real finality window; `ACCEPTED` and `FINALIZED` are logical states.
- Different LLM backends producing emergent disagreement. Use `mock_llm.noise`
  to simulate wobble; use `--mode network` for real behavior.
- Contract-to-contract calls, async messages, and gas. `TxResult.gas_like` is a
  deterministic cost model (§17.8), not real gas.
- `gl.nondet.web.request` (raises `E3001`).
- Real HTTP redirects. The contract's URL allowlist is enforced at filing time;
  redirect handling must be verified in network mode (SEC-002).
- The contract does not yet consume the simulator's tamper flag. The simulator
  marks `trace.tampered` when a mocked fetch hash differs from the expected
  `contentSha256`, but §12.6 tamper handling in the contract is a follow-up.

## Loud failure policy

Any SDK member outside the subset raises `SimUnsupportedFeature` with code
`E3001` and a suggestion to run `--mode direct` or `--mode network`. The shim
never silently no-ops.

## Running the simulator tests

```bash
python -m pytest packages/safetynet-sim/tests -q
```

The determinism test runs the same adjudication 100 times and asserts identical
traces. The shim signature test compares the modeled signatures against the
ground-truth snapshot, and against the real SDK when it is installed.
