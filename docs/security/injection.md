# Prompt injection: what SafetyNet does and does not guarantee

SafetyNet adjudicates incidents by asking independent validators to read
untrusted evidence and policy text. That text is attacker-controlled, so
prompt injection is a real risk. This note documents the mitigations and
their limits (SEC-014).

## Mitigations in v1

1. **Fencing.** Every untrusted field is wrapped in a named tag
   (`<claim>`, `<defense>`, `<evidence>`, `<clause>`) and the prompt states
   explicitly that the fenced text is data, not instructions. Linter rule
   `SI021` requires the fence and the "treat as data" instruction.
2. **Closed output schema.** The model returns a fixed JSON object with a
   closed set of keys and enum values. Unknown keys or out-of-range values
   make the output invalid, which fails the transaction (`LLM_OUTPUT_INVALID`)
   instead of storing a verdict.
3. **No free text in the compared object.** The equivalence payload is a
   four-field canonical object (verdict, severity, confidence, clauses). Even
   if injection changes the model's prose, it cannot change the verdict unless
   it changes one of those four fields.
4. **Injection is noted, not rewarded.** If a model detects an injection
   attempt it returns `reason_code: "injection-attempt"` (or
   `injection-attempt` in the rationale). That note does not by itself flip
   the verdict.
5. **Corpus.** `SEC-010` maintains at least 20 adversarial strings: direct
   instruction overrides, role-play jailbreaks, JSON-injection attempts, fake
   system messages, unicode homoglyph tags, zero-width characters, and
   `</claim>`/`<evidence>` tag spoofing.

## What this does NOT guarantee

- Fencing reduces risk; it does not eliminate it. A sufficiently clever
  payload can still influence a model's classification.
- Validators run different models in production; a payload that fools one may
  not fool another, which is why consensus (not a single call) is the
  protection.
- The simulator's mocked LLMs do not reproduce emergent injection behavior.
  Use `--mode network` and recorded cassettes before shipping a prompt change.

## What to do if injection is found in the wild

1. Reproduce in sim with `mock_llm.inject(...)`.
2. Add the payload to the `SEC-010` corpus.
3. Tighten the fence or the output schema; never loosen the equivalence check.
4. Record the case in `test/fixtures/disagreements/` if it caused an
   `UNDETERMINED` or a flipped verdict.
