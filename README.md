# SafetyNet

**The public, neutral, verifiable record of AI harm.**

> SafetyNet is the public record of AI harm. Anyone can report an AI safety incident with evidence. The AI provider answers. GenLayer validators decide whether the system violated its own published safety policy. Every verdict is permanent, queryable, and free to check — a neutral trust layer for the AI age.

**Status:** StudioNet prototype (`v0.1.0`) · 19 public contract methods · no token · no admin · no deletion.

---

## The problem

AI systems cause measurable harm every day: a chatbot gives a dosage its own policy forbids, an agent scores a loan using a protected attribute, a coding assistant emits a vulnerable snippet its safety card said it would block, a moderator removes a post its policy allows.

Today that pipeline is controlled by the companies that built the systems:

```
harm → company logs it privately → company investigates itself → company decides
       (maybe) a blog post, months later, with no evidence
```

Third-party trackers collect reports, but they are centralized, unverifiable, and non-adversarial. There is no neutral place where anyone can file a report, the provider must answer, independent parties judge the claim against the provider's **own published policy**, and the result cannot be quietly deleted.

SafetyNet is that place.

## How it works

1. **Report.** Anyone files an incident against one registered AI system and one pinned policy version. Evidence is hashed into a bounded manifest; raw evidence never goes on-chain.
2. **Respond.** The claimed provider submits a defense before the response deadline. Silence is recorded as a fact — not as an admission — and a verdict is still reachable.
3. **Adjudicate.** GenLayer validators independently fetch the pinned evidence and policy, evaluate each clause, and reduce their findings to a small canonical verdict object. Only that object crosses the equivalence boundary.
4. **Read, appeal, cite.** The verdict is public and permanent. Either party can appeal once within 72 hours; appeals append a new round and never overwrite the prior verdict.

```
report + evidence ──▶ provider response ──▶ validator adjudication ──▶ permanent verdict
       │                      │                       │                      │
  pinned hashes         deadline + record      clause-level review     public + appealable
```

## Why GenLayer

SafetyNet's core operation is "read this AI output, read this policy clause, decide whether the output violated the clause." That is natural-language reasoning over contested evidence. Solidity cannot do it. A single oracle cannot be trusted not to favor the payer. An LLM API in a centralized backend is a single point of censorship and failure. GenLayer is the only architecture where independent validators fetch the same evidence, reason independently, and must reach consensus on a bounded verdict — with an appeal path when they disagree.

## Verdicts

A verdict is a **policy compliance finding**, not a legal determination.

| Verdict | Meaning |
|---|---|
| `POLICY_VIOLATION` | The evidence shows the output violated a specific policy clause. |
| `POLICY_ADEQUATE_BUT_HARM` | The output complied with policy, yet harm still occurred — a policy gap. |
| `INSUFFICIENT_EVIDENCE` | Evidence is missing, unverifiable, or contradictory. A valid outcome, not a failure. |
| `OUT_OF_SCOPE` | The claim does not concern the system's published safety policy. |
| `DISMISSED` | The evidence shows the output complied with the cited policy. |

Severity (`LOW`, `MODERATE`, `SERIOUS`, `CRITICAL`) comes from a deterministic table, never from free-form model output. Confidence is a coarse band (`LOW`, `MEDIUM`, `HIGH`), never a 0–100 score. The compared payload is a closed enum object:

```json
{ "verdict": "POLICY_VIOLATION", "severity": "SERIOUS", "confidence": "HIGH", "clauses": ["C1"] }
```

## Policy gaps

Most incident trackers ask "did the system break the law?" SafetyNet asks a sharper question: **"did the system break its own promise?"**

`POLICY_ADEQUATE_BUT_HARM` is the verdict no other tracker produces: the provider followed its published policy, and harm still happened. Aggregated by clause, those verdicts become a map of where AI safety policies are insufficient — the `/policy-gaps` view in the web app and `data/policy-gaps.md` in the open dataset.

## Live deployment

| | |
|---|---|
| Network | StudioNet (gasless), chain ID `61999` |
| Contract | `0x7E2D9405CfC642F3abda3048cc2F265f7586317e` ([registry](deployments/studionet.json)) |
| Deploy tx | `0x80e030b7a1a34607c2f20cb7aedac17c8a2fcc868fc22cb5bc8a1c903e1c10d2` |
| Deployed | 2026-10-28 |
| Verification | [`deployments/studionet.verification.json`](deployments/studionet.verification.json) — L0 registry, L1 schema, L2 source, L3 probes, L4 config all pass |

The registry is the source of truth for addresses: `deployments/<network>.json`. The web app fails loudly if the selected network has no recorded deployment.

## Architecture

The contract is the product. Everything else exists to make it testable, deployable, and legible.

| Path | Responsibility |
|---|---|
| `contracts/safetynet.py` | Intelligent Contract: system registry, policies, incidents, responses, adjudication, verdicts, appeals |
| `packages/core` | Shared types, verdict enums, config, adapters, validation, hashing |
| `packages/cli` | `snet` CLI: init, check, lint, test, deploy, verify, export, simulate, fuzz, tighten, bench |
| `packages/safetynet-test` | pytest plugin: fixtures, `mock_llm` / `mock_web`, cheatcodes, assertions |
| `packages/safetynet-sim` | Deterministic leader/validator/appeal simulator plus JSON-RPC bridge |
| `packages/safetynet-lint` | Domain lint rules (`SI001`–`SI099`) for evidence, determinism, injection, permanence |
| `packages/deploy` · `packages/client` · `packages/codegen` | Deployment automation, typed client, schema → TypeScript codegen |
| `packages/patterns` | Reusable equivalence patterns (P1–P8) |
| `apps/web` | Public incident database, filing flow, provider console, policy-gap report |
| `tests/direct` | Contract gate tests against the GenLayer SDK |
| `tests/e2e` | Playwright specs for the demo path and filing flow |

Non-determinism is confined to one block inside `adjudicate()`. Evidence is fetched sequentially and capped; the policy hash is re-checked before a verdict is stored; any drift, malformed model output, or failure to converge fails closed with no verdict written.

## Quickstart

**Prerequisites:** Node.js ≥ 20, pnpm, Python ≥ 3.11 with `pytest` and `hypothesis` (for the simulator and test library).

```bash
git clone https://github.com/habte-selassie27/Safety_Net.git
cd Safety_Net
pnpm install
pnpm test
```

Run the CLI from source (the `snet` package is not published yet):

```bash
pnpm exec tsx packages/cli/src/index.ts --help
pnpm exec tsx packages/cli/src/index.ts check contracts/safetynet.py
```

`check` parses the contract, validates its header and storage, extracts the method schema, and verifies that every reason code the contract can raise exists in `@safetynet/core`.

### Run the web app

```bash
pnpm --filter web dev
```

The app starts in **demo mode** with built-in synthetic incidents, so it works with no wallet and no network. To read the StudioNet deployment directly:

```bash
VITE_DATA_MODE=chain pnpm --filter web dev
```

Chain mode uses the generated address in `apps/web/src/generated/addresses.ts`; override with `VITE_SNET_CONTRACT_ADDRESS` if needed.

### Scaffold a project

```bash
pnpm exec tsx packages/cli/src/index.ts init my-policy --no-install
```

This works offline: templates are bundled, the contract is copied into the project, and a `.gitignore`, `gltest.config.yaml`, policy fixture, and runnable tests are generated. Drop `--no-install` to create a `.venv` and install `safetynet-test` (best-effort; the exact manual command is printed if the install cannot complete).

## CLI

```bash
snet <command> --help
```

| Command | Purpose |
|---|---|
| `snet init [dir]` | Scaffold a policy, incident, or provider-claim project |
| `snet check [contract]` | Static validation + schema and reason-code extraction |
| `snet lint [paths]` | SafetyNet-domain lint rules with text/json/sarif/github output |
| `snet test [path]` | Run tests (sim by default; direct/network wiring in progress) |
| `snet policy hash\|validate\|diff\|export` | Policy hashing, clause checks, clause-level diff |
| `snet incident create\|validate\|hash\|bundle` | Build and validate evidence manifests |
| `snet simulate <scenario>` | Run a consensus scenario and print the trace |
| `snet fuzz` | Property-test adjudication invariants |
| `snet tighten` | Measure verdict stability under evidence noise |
| `snet deploy [contract]` | Deploy with a plan, confirmation, and atomic registry write |
| `snet verify [contract]` | Verify address, schema, source, probes, and config |
| `snet export <kind>` | Export incidents, verdicts, policy gaps, or addresses (hashes only) |
| `snet report` / `snet bench` | Profile nondeterministic work / benchmark a network |
| `snet doctor` | Environment diagnostics and redacted support bundle |
| `snet account`, `snet node`, `snet snapshot` | Key management, local node wrapper, simulator state |

## Contract API

**Writes (8)**

| Method | Caller | Purpose |
|---|---|---|
| `register_system` | anyone | Register a system and its first policy version |
| `publish_policy` | provider | Publish a new immutable policy version |
| `claim_system` | provider | Bind a system to the caller |
| `file_incident` | anyone | File a claim with a pinned policy hash and evidence manifest |
| `provider_respond` | claimed provider | Submit a defense before the deadline |
| `adjudicate` | anyone | Run the non-deterministic adjudication round |
| `appeal` | reporter or provider | Append an appeal inside the 72-hour window |
| `finalize` | anyone | Close the appeal window and mark the verdict final |

**Views (11)**

`get_config`, `get_incident_count`, `get_system`, `get_policy`, `get_incident`, `get_response`, `get_verdict`, `get_appeals`, `get_verdict_history`, `get_reporter_stats`, `list_incidents_by_system`.

All state is on-chain and public. Raw evidence is never stored — only its hash and a bounded manifest. Inline evidence is public forever, and the filing UI says so before submission.

## Web app

| Route | Screen |
|---|---|
| `/` | Latest verdicts, headline counts, policy-gap teaser |
| `/incidents` · `/incidents/:id` | Searchable record · full incident, clause citations, evidence hashes, appeal history |
| `/systems` · `/systems/:id` | AI system registry · policy versions, verdict distribution, response times |
| `/policy-gaps` | `POLICY_ADEQUATE_BUT_HARM` grouped by system and clause |
| `/report` | Five-step filing flow with live hash preview and permanence acknowledgement |
| `/provider` | Claim a system, answer incidents, appeal |
| `/data` | Download the open dataset |
| `/embed/system/:id` | Read-only embeddable record |

Reading never requires a wallet. Verdict badges always carry an icon and text label, never color alone. The app has no third-party analytics and sends no evidence text anywhere except the contract.

## Testing

```bash
pnpm test          # TypeScript: 206 passed, 1 skipped
pnpm typecheck     # all packages + web app
python -m pytest packages/safetynet-sim/tests packages/safetynet-test/tests   # 77 passed, 1 skipped
```

The contract gate suite lives in `tests/direct/test_gate.py` and exercises 20 contract scenarios: mandatory violations, policy gaps, contradictory evidence, policy drift, SSRF, oversized manifests, duplicates, rate limits, appeals, validator splits, malformed model output, and prompt injection. The Python simulator tests run without network access; the direct-mode suite requires the GenLayer SDK.

End-to-end specs are in `tests/e2e/`:

```bash
pnpm exec playwright install chromium
pnpm exec playwright test
```

## Repository layout

```
Safety_Net/
├── contracts/safetynet.py        # the Intelligent Contract
├── packages/
│   ├── core/                     # types, enums, adapters, validation
│   ├── cli/                      # snet
│   ├── safetynet-test/           # pytest plugin + cheatcodes
│   ├── safetynet-sim/            # consensus simulator
│   ├── safetynet-lint/           # SI rules
│   ├── deploy/ client/ codegen/  # deployment + typed client
│   └── patterns/ plugin-api/ sim-bridge/
├── apps/web/                     # public record + filing + provider console
├── tests/direct/                 # contract gate tests
├── tests/e2e/                    # Playwright demo path
├── docs/                         # guides, research, security, reference
├── templates/                    # offline `snet init` templates
└── deployments/                  # public deployment registry + verification
```

## Status and roadmap

**Working today:** contract with policy pinning, deterministic aggregation, and appeals; CLI with check/lint/test/simulate/fuzz/tighten/deploy/verify/export; pytest plugin and deterministic simulator; SI lint rules; web app in demo and chain modes; StudioNet deployment with L0–L4 verification; static dataset export with hashes only.

**Next:**

- Bradbury testnet deployment (requires a funded account).
- Pilot with an AI safety organization (requires a written agreement).
- `snet test --mode direct|network` backend depth.
- Docs site build-out.

**Not in v1:** token, staking, slashing, payments, on-chain deletion, admin overrides, automated incident crawling. Permanence is the product; moderation is display-layer only.

## Trust boundary

| A SafetyNet verdict means | A SafetyNet verdict does **not** mean |
|---|---|
| Independent validators read the pinned evidence and the pinned policy version | That the evidence is authentic |
| They agreed on a bounded verdict under a stated consensus rule | That the provider acted illegally |
| The record is public and unaltered since finalization | That the provider is generally unsafe |
| The policy text is fixed and hash-verified | That the policy was followed internally |

## Documentation

- [`AGENTS.md`](AGENTS.md) — the full project specification and engineering rules
- [`docs/verdicts.md`](docs/verdicts.md) — the five verdicts with worked examples
- [`docs/trust-boundary.md`](docs/trust-boundary.md) — what a verdict proves and does not prove
- [`docs/policy-authoring.md`](docs/policy-authoring.md) — how to write checkable clauses
- [`docs/evidence-format.md`](docs/evidence-format.md) — manifests, canonical hashing, privacy
- [`docs/reference/contract-schema.md`](docs/reference/contract-schema.md) — extracted schema and reason-code parity
- [`docs/reference/verification.md`](docs/reference/verification.md) — verification levels
- [`docs/security/ssrf.md`](docs/security/ssrf.md) · [`docs/security/injection.md`](docs/security/injection.md) — threat notes
- [`docs/research/verdict-stability.mdx`](docs/research/verdict-stability.mdx) — disagreement corpus and stability work

## Disclaimer

> SafetyNet publishes policy compliance findings produced by independent validators against a provider's own published policy. A finding is not a legal determination, not an assessment of liability, and not a statement that an AI system is safe or unsafe in general. Evidence is supplied by reporters and is not independently authenticated. Always consult the original sources and the cited policy version.

## License

Code is [MIT licensed](LICENSE). Verdict text and documentation are CC-BY-4.0. Incident claims and inline evidence remain © their reporters; public exports contain hashes only.
