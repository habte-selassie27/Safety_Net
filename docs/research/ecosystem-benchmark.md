# GenLayer Ecosystem Benchmark vs SafetyNet

Purpose: position SafetyNet against the 17 projects on the GenLayer Portal
ecosystem wall, and separate **what SafetyNet actually implements** from
**what a pitch deck would like it to implement**.

---

## 0. Method and verification status (read this first)

### What was verified for this document

| Source class | Used for | Status |
|---|---|---|
| `docs.genlayer.com` (Optimistic Democracy, Equivalence Principle, Appeals) | platform consensus facts | verified (2026-10-30) |
| Press coverage + product sites for ecosystem projects | what each project *claims* to be | public signal, not audited |
| `contracts/safetynet.py`, `deployments/`, `docs/` in this repo | SafetyNet's actual behavior | verified in-repo |

### What was **not** verified

Competitor **source code was not read**. `github.com` is unreachable from this
environment (`Could not resolve host: github.com`), and no competitor repo was
available locally. Every statement about another project's internals below is
therefore tagged:

- `[PUBLIC-SIGNAL]` — from that project's site, docs, or press coverage
- `[UNVERIFIED]` — plausible from the name/portal card only; do not repeat in a grant
- `[VERIFIED-REPO]` — read in this repository, with file/line reference

**Consequence:** this is a design-pattern benchmark, not a code audit. A real
audit needs the scan protocol in §8 run on a machine with GitHub access.
Any grant claim of the form "competitor X does Y in their code" is currently
unsupported and should not be written.

---

## 1. Ecosystem map

| Project | What it is (as publicly described) | Tag | Relation to SafetyNet |
|---|---|---|---|
| **Rally** | AI-verified marketing/campaign execution; GenLayer contracts replace manual agency verification. A "Rally Court" component is referenced in coverage. | `[PUBLIC-SIGNAL]` | Adjacent: verifies *deliverables*, not *policy conformance* |
| **Collective Memory** | No public description found. | `[UNVERIFIED]` | Unknown |
| **Internet Court** | Foundation-led open standard for AI-agent disputes; 5-validator AI jury; appeal requires paying the charge quoted by the consensus contracts. | `[PUBLIC-SIGNAL]` | **Adjacent, not overlapping** — resolves *agreements between agents*; SafetyNet judges *conformance to a published policy* |
| **MicroMarkets** | Prediction market in Telegram; GenLayer reads evidence to resolve; settlement on Arbitrum. | `[PUBLIC-SIGNAL]` | Downstream consumer of evidence adjudication |
| **Antseed** | "Open market for AI inference." | `[UNVERIFIED]` | Potential supplier of validator models |
| **Intelligent Oracle** | Resolution oracle for prediction markets. | `[PUBLIC-SIGNAL]` | Direct pattern overlap (evidence → resolution) |
| **FUD.markets** | "In a market of liars, FUD is the only truth" — adversarial-info market. | `[PUBLIC-SIGNAL]` | Thematic cousin: incentivized truth-seeking |
| **Bella Protocol** | DeFi yield product; not GenLayer-native. | `[PUBLIC-SIGNAL]` | None |
| **Argue.fun** | Argumentation markets on Base; agents debate, stake ARGUE, GenLayer adjudicates the debate. | `[PUBLIC-SIGNAL]` | Closest *adjudication UX*; different subject matter |
| **Uptime** | SLA/uptime monitoring for agents. | `[PUBLIC-SIGNAL]` | Natural filer: an SLA breach caused by an AI decision |
| **Precog Markets** | Forecasting markets + ForecastOS skills for agents. | `[PUBLIC-SIGNAL]` | Downstream consumer |
| **BuildersClaw** | AI-agent hackathons; AI judge scores submissions. | `[PUBLIC-SIGNAL]` | Natural filer: judge ruled against its published rubric |
| **Apolo** | Agent commerce. | `[UNVERIFIED]` | Natural filer |
| **GHBounty** | Bounty and reward workflows. | `[PUBLIC-SIGNAL]` | Natural filer |
| **Proven** | AI-verified deliverables, reputation, outcome-based payment. | `[PUBLIC-SIGNAL]` | Natural filer + precedent source |
| **Axiom Pilot** | Grant review; AI consensus decides the winner. | `[PUBLIC-SIGNAL]` | Natural filer |
| **MergeProof** | AI-verified deliverables / reputation / outcome payments (portal card). | `[PUBLIC-SIGNAL]` | Natural filer |

### The four archetypes on that wall

1. **Subjective-resolution markets** — MicroMarkets, Precog, Argue.fun, FUD, Intelligent Oracle. They need a *fact* resolved to settle a position.
2. **AI-judged work markets** — BuildersClaw, GHBounty, Proven, Axiom Pilot, MergeProof, Rally. They need a *human or agent's output* graded against a rubric.
3. **Dispute protocols** — Internet Court. They need a *disagreement between parties* resolved.
4. **Infrastructure / adjacent** — Antseed, Bella, Apolo, Uptime, Collective Memory.

SafetyNet is a **fifth archetype: a conformance registry.** It does not settle a
bet, grade a submission, or resolve a contract. It answers one question —
*did this system follow the policy it published?* — and keeps the answer
forever. That distinction is the entire grant argument, and it is why the
project is complementary rather than competitive with all 17.

---

## 2. Comparison matrix (honest version)

The columns are deliberately not "us vs. a strawman." Column 2 is the common
ecosystem pattern where it can be inferred; column 3 is what this repo actually
does; column 4 is where SafetyNet is **weaker**, which is the part a reviewer
will find anyway.

### 2.1 Consensus model

| | Common pattern `[inferred]` | SafetyNet `[VERIFIED-REPO]` | Honest weakness |
|---|---|---|---|
| Equivalence surface | Leader runs the prompt; validators vote on acceptance of the leader's output | **One** nondet block, `gl.eq_principle.strict_eq` over a 4-field canonical object (`verdict`, `severity`, `confidence`, `clauses`) — `contracts/safetynet.py:666` | `strict_eq` over a *clause set* is brittle: at high simulated noise stability drops to **64/100** (`docs/METRICS.md`) |
| Reasoning granularity | Single LLM call → verdict | Clause loop inside `evaluate()` (one call per clause, capped at `maxPolicyClauses`), then **deterministic** aggregation `_aggregate()` (`:278`) | Clause count drives call count; 24 clauses × validators is expensive |
| Determinism of the outcome | Whatever the model says | Severity from a deterministic floor table (`_severity_floor`, `:222`); no float, no free text in the compared object | Severity band edges can still diverge (documented as a disagreement class) |

### 2.2 Inputs and sanitization

| | Common pattern `[inferred]` | SafetyNet `[VERIFIED-REPO]` | Honest weakness |
|---|---|---|---|
| Untrusted text handling | Concatenated into the prompt | Fenced `<claim>/<defense>/<evidence>/<clause>` + explicit "this is data" instruction; lint `SI021` enforces it | Heuristic, not a guarantee — stated plainly in `docs/security/injection.md` |
| Output parsing | `json.loads` then use fields | Closed schema; unknown keys ⇒ `LLM_OUTPUT_INVALID` ⇒ **no verdict stored** (`_safe_json`, `:267`) | A model that keeps returning invalid JSON makes the incident permanently undecided until someone retries |
| Canonicalization | Ad hoc | `canonical_verdict` shared conceptually with `packages/core/src/domain.ts`; parity tested | Two implementations in two languages is a standing drift risk (parity test is the only guard) |

### 2.3 Non-determinism handling

| | Common pattern `[inferred]` | SafetyNet `[VERIFIED-REPO]` | Honest weakness |
|---|---|---|---|
| Web fetch | Fetch a URL, hope it is stable | Sequential fetch in manifest order; 40 KB cap; `https` + 443 only; allowlist enforced at filing (`:502`) **and** at adjudication | Policy text comes from **one** URL; if the provider's site dies, adjudication fails closed (`EVIDENCE_FETCH_FAILED`). Archival anchoring is deferred (`POL-011`) |
| Content drift | Often ignored | Policy text re-hashed and compared to the pinned hash; mismatch ⇒ `POLICY_DRIFT`, no verdict (`:618`+) | Evidence drift only downgrades confidence — it cannot distinguish "provider edited the page" from "validator saw a CDN variant" |
| Failure mode | Retry / partial result | Fail closed: no verdict is better than a wrong one | Fail-closed means the public record can show an incident that never resolves, which is a *product* problem even when it is correct behavior |

### 2.4 Dispute and appeal logic

| | Common pattern `[inferred]` | SafetyNet `[VERIFIED-REPO]` | Honest weakness |
|---|---|---|---|
| Appeal rounds | Protocol-level appeals, arbitrary depth (platform charge) | **Exactly one** contract-level appeal round (`maxAppeals = 1`), then `finalize()` | Shallow compared to Internet Court-grade escalation; deliberate scope call, but a reviewer may read it as immaturity |
| Staking / slashing / bonds | Common in market designs | **None.** No payable method, no token, no deposit (`SI043` enforces this) | Spam resistance rests on rate limits + duplicate detection + opt-in adjudication, all of which a Sybil with many addresses can partially evade |
| History | Prior state may be overwritten | Append-only: `get_verdict_history` (`:825`) returns every round; `appeal` never deletes | No on-chain appeal *fee* means an appeal costs only gas, so grief-appeals are cheap up to the cap |

### 2.5 Client integration

| | Common pattern `[inferred]` | SafetyNet `[VERIFIED-REPO]` | Honest weakness |
|---|---|---|---|
| Tx lifecycle | Poll `genlayer-js` for a receipt | `TrackedTx` with adaptive polling and a status stepper (`@safetynet/client`) | Browser-signed `adjudicate`/`finalize` have not been broadcast against a live network yet |
| Reads for lists | Event index or subgraph | **`get_*` views return JSON strings**; list surfaces read a static export at `/data/incidents.json` | No indexer: the deployed app cannot enumerate incidents without the export being shipped in the build |
| Caching | Varies | 30 s in-memory cache, manual refresh | No optimistic cache, no event subscription |

### 2.6 Ledger state security

| | Common pattern `[inferred]` | SafetyNet `[VERIFIED-REPO]` | Honest weakness |
|---|---|---|---|
| Write authorization | Owner/admin patterns common | No admin, no owner, no deletion path (`SI042`, `SI044`) | If the contract has a bug, **nothing can be fixed in place** — a redeploy is the only remedy |
| Pre-write checks | Varies | Validation order documented and tested: cheap checks before any fetch; IDs, hashes, caps, duplicate, rate limit | The duplicate window is 30 days; older replays are accepted |
| Deployment trust | Often unverifiable | `deployments/studionet.verification.json`: L0–L4 pass, source/schema/allowlist hashes recorded | Verification proves *which code runs*, not that the code is correct — already stated in `docs/reference/verification.md` |

---

## 3. Claims that must not appear in the grant

These came up as desired differentiators and are **not implemented** or are
explicitly forbidden by `AGENTS.md`. Writing them would be a §3.1 violation
(never invent capability) and the first thing a technical reviewer would catch.

| Tempting claim | Reality | What to say instead |
|---|---|---|
| "Exponential staking / slashing for deviant validators" | No staking, no slashing, no payable methods (v1 decision, §15.1) | "Neutrality by construction: no token, no bond, no party with an economic interest in the verdict" |
| "Quadratic appeal costs / dynamic dispute bonding" | Not built; appeals cost gas only | "One bounded appeal round; the platform prices the appeal" |
| "State commitment scheme / post-execution verification" | Uses the platform's consensus; no commitment scheme of its own | "Hash-pinned inputs; the platform's consensus commits the result" |
| "Multi-turn LLM consensus" | Single nondet block, clause loop inside it | "Bounded output space: many judgments, one deterministic aggregate" |
| "Immune to prompt injection" | Fenced + closed schema + corpus; documented as reduced-risk | "Injection-resistant by construction of the output space, not immune" |
| "Zero-latency optimistic state / event indexing" | Static export + 30 s cache | "Reads are cached and refreshable; an indexer is future work" |
| "Multi-tiered escalation" | One appeal round | "Bounded appeals with preserved history" |

---

## 4. Where SafetyNet is genuinely ahead

1. **The standard is the provider's own policy, pinned by hash.**
   No other project on that wall adjudicates against a text the losing party
   *published itself*. `file_incident` snapshots `policy.text_hash`
   (`contracts/safetynet.py:472`+) and `adjudicate` re-checks it. This is the
   single most defensible design decision in the repo.

2. **The verdict space is a closed taxonomy with a "policy gap" outcome.**
   `POLICY_ADEQUATE_BUT_HARM` is not a hedge; it is the product insight —
   aggregate those and you get a map of where industry policies are
   insufficient. `docs/verdicts.md` already states, for each verdict, what it
   does *not* mean.

3. **Deterministic aggregation as the equivalence boundary (pattern P7).**
   Many noisy per-clause judgments collapse to one 4-field object. This is a
   reusable contribution, not just an implementation detail — it is the thing
   to publish and to name in the grant.

4. **Fail-closed is enforced, not aspirational.**
   Invalid LLM output, policy drift, and consensus failure all produce *no
   verdict*, with a stable error code (`docs/reference/rules/SI020.md`,
   `SI027.md`). Most adjudication demos store something no matter what.

5. **Verification artifact already exists.**
   L0–L4 with source, schema, and allowlist hashes against a real StudioNet
   deployment. Most ecosystem cards cannot show this; it is cheap credibility.

6. **No token.** For a *record*, that is a strength: nobody is paid to reach a
   verdict, so the verdict cannot be bought. Say this explicitly, because the
   default assumption for a crypto project is the opposite.

---

## 5. Where SafetyNet is behind (say it before reviewers do)

| Gap | Evidence | Severity |
|---|---|---|
| No public repository | no git remote configured; `github.com/habte-selassie27/safetynet` → 404 | blocks the "shares code" deliverable |
| No live web app | documented URL `safetynet.vercel.app` resolves to an **unrelated** lone-worker-safety product; `safetynet-ai.vercel.app` → 404 | blocks the demo, embeds, and the whole public-record claim |
| Zero on-chain records | `get_incident_count → 0`, registry `"seeded": false`, `docs/METRICS.md` all zeros | a reviewer opening the contract sees an empty database |
| No external party | no pilot (PILOT-001..005) | M4 exit criterion unmet |
| Static-export dependency | build has no `data/` directory; deployed app would 404 on `/data/incidents.json` | P0 for deployment |
| Single policy URL | `POL-011` deferred | resilience |
| Milestone reports are wrong | `docs/milestones/M3.md` contains M0 content | credibility, cheap to fix |

Order of operations follows from this table, not from new features.

---

## 6. Threat model (GenLayer-specific) with SafetyNet's actual posture

### 6.1 Validator bias, model poisoning, Sybil

**Mechanism.** Validators run models of their choice. A coalition with biased
prompts, temperature settings, or fine-tuned weights moves a subjective verdict.

**What the contract can do**
- Keep the compared output tiny so bias has little room: enums and a sorted
  clause set only.
- Make ambiguity a legal outcome: `INSUFFICIENT_EVIDENCE` is a first-class
  verdict rather than a forced binary.
- Make severity deterministic, so bias cannot inflate it.
- Let anyone trigger a fresh round via `appeal`, which is the platform's
  defence against a bad committee.

**What the contract cannot do**
- Detect a Sybil set, slash a validator, or see which model produced a result.
  Those are protocol-level. Claiming otherwise is dishonest; the honest line is
  "SafetyNet narrows the attack surface that consensus has to defend."

### 6.2 Indirect prompt injection (evidence **and policy**)

The usual analysis covers evidence. The overlooked vector is the **policy
document itself**: the provider controls the policy URL, so the provider can
serve a page crafted to steer any validator reading it. Hash-pinning does not
help, because the hash is taken *from that same text* at registration.

Residual mitigations: fencing + closed schema means a successful injection must
still produce a valid enum combination; and `POLICY_DRIFT` catches *later*
changes. A provider who registers a hostile policy text at time zero is not
currently defended against. That is a real, unpublished gap and worth a
`SEC-` task: cap policy text length, strip markup, and flag imperative
second-person instructions inside policy text.

### 6.3 Oracle / front-running / content racing

Evidence can change between filing and adjudication. Mitigations: per-item
`contentSha256`, tamper flag, confidence downgrade, and `DISMISSED` made
impossible on tampered or unavailable evidence. There is no market to
front-run (no token, no position), so classic MEV does not apply — the
comparable risk is a provider racing to edit its policy after an incident is
filed, which fail-closes.

### 6.4 Economic exhaustion and griefing

Controls present: ≤10 open incidents per address, duplicate detection over
(system, version, evidence hash), adjudication is opt-in (someone must pay to
trigger the expensive path), one appeal round, hard caps on items/bytes/clauses.

Residual: the rate limit is per address, so an attacker with N addresses gets
10×N open incidents; and every open incident is a permanent public record.
No bonds exist to price this, by design. The mitigation that scales is
*display* ranking (verdict/activity, not chronology) plus the fact that
undecided spam is visibly undecided.

### 6.5 SSRF

Allowlist + scheme/port/userinfo rules + IP-literal rejection (decimal, octal,
hex, IPv4-mapped IPv6) + 2-hop redirect re-check + 40 KB read cap, with the
attack matrix listed in `docs/security/ssrf.md`. The allowlist is immutable per
deployment and its hash is recorded, so a reviewer can tell exactly which
hosts a given deployment trusted.

### 6.6 Defamation and permanence

Compliance-only framing, templated rationale (no LLM prose on-chain), provider
defence displayed adjacent to the claim, `INSUFFICIENT_EVIDENCE` prominence,
and no deletion path anywhere. The cost is that a genuinely abusive record
cannot be removed — the documented answer is display-layer redaction plus a
public correction notice, never an on-chain edit.

---

## 7. Grant positioning

### 7.1 One paragraph to use verbatim

> GenLayer's ecosystem has resolved facts, graded work, and settled disputes.
> None of it records whether a system followed the policy it published. SafetyNet
> is that layer: anyone files an incident against a hash-pinned policy version,
> the provider answers, validators judge the system against its own words, and
> the verdict is permanent. Every other project on the wall needs to be able to
> say "this AI misbehaved and here is the proof" — SafetyNet is where that
> sentence gets its evidence.

### 7.2 Moat (what cannot be copied quickly)

1. **The pinned-standard schema** (policy doc format, clause IDs, hash
   canonicalization) becoming the format other projects cite.
2. **The verdict taxonomy + aggregated policy-gap dataset** — a data asset that
   grows with use and cannot be forked.
3. **The equivalence pattern library (P1–P8)** — published design knowledge
   that makes SafetyNet the reference implementation for "judge against a
   document."
4. **Verification discipline** (L0–L4 artifacts per deployment) as a trust
   signal competitors would have to match.

### 7.3 Readiness, stated honestly

| Phase | Grant claim | Actual status |
|---|---|---|
| P1 — contract + tests + simulator | done | contract 871 lines, 176 passing tests, sim + fuzz 7/7 properties, lint SI catalog |
| P2 — testnet deploy + client integration | mostly | StudioNet deployed and verified; web flows wired; browser writes **not yet broadcast** |
| P3 — parameter tuning, benchmarking, mainnet prep | not started | `snet bench` exists but network-run samples are not recorded |

Do not present P2 as complete or P3 as underway.

### 7.4 Assets to put in the pitch, in this order

1. The 5-verdict taxonomy figure with the "what it does not mean" column
   (`docs/verdicts.md`) — reviewers remember this.
2. `deployments/studionet.verification.json` (L0–L4) as proof of execution.
3. The pinned-policy flow: file → pin hash → adjudicate → re-check → fail closed.
4. Stability numbers **with the caveat** that they come from mocked calls
   (`docs/METRICS.md` says so; repeat it).
5. The pattern library, named as a public good.
6. An explicit "what this does not prove" slide (`docs/trust-boundary.md`).

### 7.5 The four questions a grant reviewer will ask

| Question | Prepared answer |
|---|---|
| "Is this Internet Court?" | No. Internet Court resolves agreements between parties; SafetyNet measures conformance to a published policy and keeps the record. Different input, different output, complementary. |
| "Who files?" | Anyone harmed or observing harm; and, in time, automated filers (Uptime on SLA breach, GHBounty on a rubric violation). |
| "Why would a provider answer?" | Because silence is recorded as silence, and 'no defence filed' is worse than a defence. Permanence is the pressure. |
| "What stops spam with no token?" | Structural: rate limits, duplicate detection, opt-in adjudication, and display ranking. Not solved economically — stated as a known limit. |

---

## 8. Appendix — repo scan protocol (run when GitHub is reachable)

For each project, in this order, recording findings in a table:

1. **Locate the contract.** `git clone <repo>`, then `find . -name "*.py" | xargs grep -l "gl.Contract"`.
2. **Count nondet blocks per write method.** `grep -n "eq_principle\|exec_prompt\|web\.render"`. More than ~3 per method is a timeout risk.
3. **Inspect the compared object.** Whatever the function passed to the equivalence helper returns — if it contains free text, a timestamp, or a float, note it as a consensus-fragility finding.
4. **Check fetch hygiene.** Is there an allowlist? A byte cap? Sequential order? Any raw URL from user input reaching a fetch is an SSRF report.
5. **Check output parsing.** Bare `json.loads` with no schema/enum validation is a finding; look for `INSUFFICIENT`/fallback branches.
6. **Check permanence.** Any `del`, `.pop(`, or reassignment on a decision record; any admin/owner method that can rewrite history.
7. **Check money.** Payable methods, bonds, fee-on-appeal, owner-settable parameters.
8. **Client side.** In the built bundle, search for `genlayer-js` calls and count polls per second per open transaction; note whether reads go through an indexer or per-id calls.
9. **Deployment claims.** Fetch the contract address from their site, read `get_*` views, and record whether the deployment is seeded and whether a verification artifact exists.

Record each finding with the tag `[VERIFIED-REPO]` and a commit SHA. Anything
not scanned stays `[PUBLIC-SIGNAL]` or `[UNVERIFIED]`, permanently.
