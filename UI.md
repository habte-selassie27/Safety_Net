# UI.md — SafetyNet Interface Specification

> **The public record of AI harm, made legible.**
> This file is the normative design and interface specification for `apps/web`. It is written to be implemented, tested, and reviewed — not admired.

| Field | Value |
|---|---|
| Document | `UI.md` |
| Version | `1.0` |
| Status | **Normative** |
| Last updated | 2026-10-28 |
| Owner | Joshua (`habte-selassie27`) |
| Applies to | `apps/web` (public incident database, report flow, provider console, embed) |
| Product authority | `AGENTS.md` — mission, legal framing, contract behavior, scope |
| Interface authority | **This file** — layout, components, tokens, copy, states, accessibility |
| Supersedes | Prior informal UI decisions and the original single-file demo. It does not supersede working code that already conforms; see §0.4 |
| Related | `AGENTS.md` §6, §10, §12–§15, §22–§24, §28–§29, §32.7, §34; `docs/verdicts.md`; `docs/trust-boundary.md`; `docs/policy-authoring.md`; `docs/METRICS.md` |

---

## 0. HOW TO USE THIS FILE

### 0.1 Normative language

- **MUST** / **MUST NOT** — a release blocker. A PR that violates one is not mergeable.
- **SHOULD** — expected. Deviate only with a written reason in the PR.
- **MAY** — optional, taste-level.
- `[OPEN]` — an unresolved decision. Do not invent an answer; use the stated default and ask the owner.
- Task IDs (`WEB-003`, `WEB-020`, etc.) refer to `AGENTS.md` §31.13.
- Code fences tagged `css`, `ts`, `html`, `text` are **normative templates** unless labeled “example.”
- “Verdict” in the UI means **policy compliance verdict**. It never means legal liability. See §17.

### 0.2 Authority and conflict resolution

1. `AGENTS.md` wins for **product scope, legal framing, contract behavior, and non-negotiable rules**.
2. This file wins for **interface details**: routes, layout, tokens, components, copy, states, test IDs, accessibility, and frontend conventions.
3. The repository wins for **facts** (what code exists, what the contract exposes). If the repo contradicts this file, fix the file in the same PR that changes reality.
4. If a design idea makes an incident less verifiable, less public, or less fair, it is out of scope. Delete it.

### 0.3 What this file is not

- It is not a contract spec. `AGENTS.md` §11–§14 governs.
- It is not a marketing site spec. Marketing copy outside the product must still obey §16 and §17.
- It is not permission to add features. The screen list in §12 is the v1 scope. New product ideas go to `docs/IDEAS.md`, not into a component.
- It is not a place to relitigate the verdict set. The five verdicts and three confidence bands are closed.

### 0.4 Implementation status (snapshot: 2026-10-28)

This is a status ledger, not an excuse. The repository wins for facts; when code and this file disagree, fix whichever is wrong in the same PR. Do not copy this table into a release note, and do not let it drift more than one release.

**Status key**

- **Implemented** — behaves as this file requires; review future changes against the spec.
- **Partial** — exists, but at least one MUST is unmet or unverified.
- **Specified** — normative here; not built yet.

| Area | Status | Verified in the repository | Gap to close |
|---|---|---|---|
| Shell and routing | Partial | `App.tsx` renders the header, primary nav, skip link, `<main>`, footer, embed bypass, per-route document title, and scroll-to-top; `lib/router.tsx` is a History API router (`pushState` / `replaceState` / `popstate`) with real path URLs; `vercel.json` rewrites unknown paths to `index.html` | No route focus management or live-region announcement (§4.5); no mobile disclosure nav; primary nav currently includes **Report** and **Provider**, while §4.3 makes Report the header action and Provider a footer/about/system link; footer lacks index freshness, Docs/GitHub, and build version |
| Pages | Partial | All 12 route modules exist and render: Home, Incidents, IncidentDetail, Systems, SystemDetail, PolicyGaps, Report, Provider, About, Data, Embed, NotFound | No page test IDs; no real loading/error/stale states against an index; no permissionless **Adjudicate** or **Finalize** actions; spec layout/order not fully audited; static `index.html` still titles the app “web” and has no description or social metadata |
| Component library | Partial | 10 shared components: `ClauseCard`, `EmptyState`, `ErrorBanner`, `EvidenceList`, `NetworkBadge`, `SeverityChips`, `StatCard`, `SyntheticBadge`, `TxProgress`, `VerdictBadge`; one shared `ui.module.css` | Pages still hand-roll buttons, tables, fields, and notices; tabs, dialogs, and skeletons are not built yet; no per-component CSS modules or isolated tests; zero `data-testid` attributes |
| Code structure | Partial | Pages live in `views/`; `components/` is flat; `lib/` holds `router`, `format`, `network`, and `exports` | §22.1 uses `pages/` and folder-per-component modules. Migrate files when touched; do not do a big-bang rename; every new file follows §22 |
| Tokens and themes | Partial | `styles/tokens.css` carries the Appendix A light values plus a dark `prefers-color-scheme` block; legacy aliases keep current component CSS working | No `data-theme` boot or `snet-theme` persistence; no header toggle; no `?theme=` embed override; legacy unprefixed aliases remain |
| Data | Partial (demo only) | `data/store.ts` is a labelled synthetic store with canonical hashing and the shared validators; `lib/network.ts` fails loudly when the configured network has no generated address; generated contract types and addresses exist | No `@safetynet/client` reads or writes; no published index, cache, or freshness metadata; no chain-mode loading/error states |
| Wallet and transactions | Specified | The Provider console states that the demo acts locally; there is no wallet or signature path | `WalletButton`, network-mismatch banner, signature/rejection states, `TrackedTx` stepper wiring, permissionless adjudicate/finalize, and contract reason-code mapping |
| Testing | Partial | The web app has 30 Vitest tests: 15 shell/flow (`app.test.tsx`), 12 store (`store.test.ts`), 3 export (`exports.test.ts`); the root workspace runs the full suite | No isolated component or accessibility tests; no test-ID assertions; no Playwright demo path; no visual or verdict snapshots |
| Copy and legal | Partial | Five-verdict language, icons, and labels follow §9.2 and §11.4; `/about` carries the exact disclaimer and trust boundary; synthetic labels appear on all record pages; in user-facing app copy, the two permitted strings are the only banned-word hits | The verbatim disclaimer is missing from incident and embed verdict footers; automate Appendix H and keep it green as chain mode lands |
| Print and performance | Specified | No print stylesheet or performance gate is wired | Appendix G print styles; bundle and Lighthouse budgets (§20) |

**Current must-fix order (before a public launch or a recorded grant demo)**

1. **Keep the build honest.** Until chain mode exists, keep the demo banner and “no chain writes” copy visible; no screen may imply that a transaction was sent or that a record is on-chain.
2. **Finish the action layer.** Add wallet connection, network guard, signature/rejection states, the full `TrackedTx` lifecycle, and permissionless **Adjudicate** / **Finalize** actions. A decided incident with an open appeal window is not final.
3. **Conform the shell.** Move Report to the primary action and Provider out of the primary nav; add the theme toggle, `snet-theme` persistence, and the mobile disclosure menu (§4.3).
4. **Make it testable.** Add the Appendix B `data-testid` registry, isolated component and accessibility tests, and the Playwright demo path (`AGENTS.md` §6.6; §23.4).
5. **Close the public surface.** Add the verbatim disclaimer to every verdict page footer, fix the static title/description/OG metadata, verify the host rewrite and 404 behavior, and add the print stylesheet.

**Do not regress:** read-only pages work without a wallet; no fake liveness or success; every synthetic record stays labelled; the five verdicts keep their exact labels and icons (§9.2, §11.4); no banned legal wording (§16.7); policy clause text is shown only after the in-browser hash check (§21.4).

### 0.5 UI glossary

| Term | Meaning in the interface |
|---|---|
| **Incident** | One filed report about one AI system against one pinned policy version |
| **Claim** | The reporter’s description of the alleged harm (20–2,000 characters) |
| **Defense** | The provider’s response (20–4,000 characters) |
| **Verdict** | One of five closed outcomes: policy violation, policy gap, insufficient evidence, out of scope, dismissed |
| **Policy gap** | `POLICY_ADEQUATE_BUT_HARM` — the output was policy-adequate, yet harm occurred |
| **Cited clause** | A clause ID the verdict relies on (`C1`, `C2`, …) |
| **Pinned** | Captured by hash at filing time and not allowed to change |
| **Record** | The permanent on-chain incident, response, verdict, and appeal history |
| **Index** | The static, published JSON snapshot used for lists and search (§14.2) |
| **Live chain** | Direct reads from the deployed contract for a single record or action |
| **Demo mode** | Local synthetic store used for development and the grant demo; never presented as real |
| **SYNTHETIC** | Illustrative data that is explicitly not a real incident |
| **Claimed / Unclaimed** | Whether an address has claimed a system in the v1 registry. Claiming is **not** identity verification |
| **Adjudication** | The permissionless request that asks validators to decide an incident |
| **Finalize** | The permissionless action that marks a decided record final after the appeal window |
| **Appeal** | A request for one new adjudication round, by the reporter or claimed provider |
| **Confidence** | A coarse band (`LOW`, `MEDIUM`, `HIGH`) reflecting evidence completeness, not model certainty |
| **Severity** | A bounded label (`LOW`, `MODERATE`, `SERIOUS`, `CRITICAL`) meaningful only for policy violations and policy gaps |

---

## 1. DESIGN THESIS

### 1.1 The record, not the dashboard

SafetyNet is not a SaaS analytics product. It is a **public ledger of contested claims and bounded findings**. The interface should feel like a well-made archive: paper-warm, typographically calm, ruled, and precise. The data is dramatic; the presentation must not be.

The central visual metaphor is **the record**:

- A document with a masthead, a body, citations, and a permanent footer.
- Hairline rules instead of boxes-on-boxes.
- A serif display voice for institutional weight; a sans voice for reading; a mono voice for proof.
- Numbers with dates and sample sizes, never floating scores.
- Verdicts presented as stamped findings, not scoreboard wins.

The brand mark makes the thesis literal: **three rules, one interrupted** — a record with a gap in it. That gap is the product’s most valuable output.

### 1.2 Ten principles

1. **The record is the interface.** Every screen answers: what happened, what was pinned, who responded, what was decided, and what it does not prove.
2. **Calm is a feature.** No urgency colors, countdown pressure, confetti, streaks, or engagement mechanics. The only acceptable alarm is a policy violation, and even that is stated, not shouted.
3. **Evidence over adjectives.** Show hashes, clause IDs, dates, and sources. Replace “trusted,” “safe,” and “verified” with facts.
4. **Every number has a source and a date.** “12 incidents, as of 2 Nov 2026, published index” — or “unknown.” Never a bare 0.
5. **Never color alone.** Every verdict, severity, status, and claim state has an icon **and** a text label. Color is reinforcement.
6. **Permanence is visible.** The filing and response flows state what will be public forever before the user signs. The record never offers delete or edit.
7. **Neutral by construction.** No “worst companies,” no composite trust score, no editorial ranking. The provider’s own policy is the standard. The UI says “validators decided,” not “we decided.”
8. **Fast by subtraction.** No web fonts, no hero imagery, no UI library, no analytics, no state library. System fonts, CSS modules, one small router, and data that earns its bytes.
9. **Accessible is the default.** Keyboard-complete, screen-reader legible, 200% zoom safe, reduced-motion aware, contrast-checked. Accessibility is not a later pass.
10. **Honest about the unknown.** “Index unavailable” is not “0 incidents.” “No provider response” is not a finding. “Insufficient evidence” is a valid outcome. “Unclaimed” is not “verified.”

### 1.3 What we never do

| Never | Why |
|---|---|
| A composite “trust score” or provider ranking | Unfair, unexplainable, gameable; `AGENTS.md` §15 forbids it |
| A red badge for `OUT_OF_SCOPE` or `INSUFFICIENT_EVIDENCE` | Color would imply wrongdoing the verdict did not find |
| “Guilty,” “liable,” “illegal,” “crime,” “victim,” “defendant” | Legal framing is out of scope; `AGENTS.md` §34 |
| “Verified provider” for a first-come claim | Claiming is not identity verification in v1 |
| Deleting, hiding, or editing an on-chain record | Permanence is the product |
| A fake success state or optimistic verdict | Never show a verdict before `ACCEPTED`; never show final before `FINALIZED` |
| Toasts as the only error channel | Errors must persist, be specific, and say how to fix |
| Infinite scroll on the public record | Pagination is citable, shareable, and predictable |
| Autoplay, parallax, confetti, gamified counters | Undermines the archive; harms motion-sensitive users |
| Third-party analytics, session replay, or error SaaS | Privacy; `AGENTS.md` §33.6 |
| Rendering remote evidence HTML in the app | XSS, privacy, and SSRF-adjacent risk |
| Hiding the legal disclaimer below the fold on a verdict page | Trust boundary must travel with the verdict |

### 1.4 The one-sentence UI test

> **Does this screen make an AI safety incident more verifiable, more public, or more fair — without making a claim the record cannot support?**

If not, remove it.

---

## 2. BRAND

### 2.1 Name

- Product name: **SafetyNet** — one word, capital `S`, capital `N`.
- Never: “Safety Net,” “SafeNet,” “SafetyNet AI,” “the SafetyNet protocol.”
- The CLI binary is `snet`; that is the only lowercase form in user-facing copy.
- The record is “the SafetyNet record” or “the public record.” Not “the chain” in user-facing copy; use “the record” and explain “on-chain” in help text.

### 2.2 The mark: three rules, one interrupted

The mark is a 24×24 glyph made of three horizontal strokes. The middle stroke is interrupted, leaving a gap slightly right of center. It reads as a document, a ledger, and a missing piece at the same time.

```text
──────────────
──────  ──────     ← the gap
──────────────
```

**Construction**

- Canvas: 24×24, `viewBox="0 0 24 24"`.
- Stroke: `currentColor`, width `2`, `stroke-linecap="round"`.
- Rules at `y = 6`, `y = 12`, `y = 18`.
- Outer rules: `x1 = 3`, `x2 = 21`.
- Middle rule: two segments, `x1 = 3` to `x2 = 10`, and `x1 = 14` to `x2 = 21`.
- The gap is 4 units wide, centered at `x = 12`.
- No fill. No rounded rectangle behind it. No gradient. No shadow.

```svg
<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M3 6h18M3 18h18M3 12h7M14 12h7"
        stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
</svg>
```

**Meaning:** the two continuous rules are the published policy and the public record; the broken rule is the gap between what a policy promises and what actually happened. Do not explain the mark in the UI. Let it be quiet.

### 2.3 Lockup, clear space, and sizes

- **Lockup:** mark at 24×24, 8px gap, wordmark “SafetyNet” at 20px/600 in the display serif, `letter-spacing: -0.01em`, `currentColor`.
- **Header lockup:** 28px mark + 20px wordmark on desktop; 24px mark + 18px wordmark on mobile.
- **Clear space:** at least half the mark’s height on all sides.
- **Minimum sizes:** mark alone 16px; lockup 20px tall. Below 20px, use the mark only.
- **Color:** monochrome `currentColor` on paper, white, or dark surface. The mark may use `--sn-accent` only when it sits on `--sn-surface` and has at least 4.5:1 contrast.
- **Favicon:** 32×32 and 180×180 PNG, plus `favicon.svg`. Paper background, ink mark. In dark browser chrome, use the transparent SVG with `currentColor` resolved to white. Provide a 512×512 maskable icon with 20% padding.

**Misuse:** do not stretch, rotate, outline, add a drop shadow, place on a photo, animate the gap, fill the gap (the gap is the point), or combine the mark with another logo.

### 2.4 Voice

SafetyNet sounds like a careful clerk, not a prosecutor and not a startup.

- **Plain:** “The policy changed after this incident was filed. The record fails closed rather than judging different text.”
- **Precise:** “2 of 6 clauses cited. Evidence: 3 items, 1 unavailable.”
- **Neutral:** “No provider response filed.” Not “The provider ignored this incident.”
- **Human:** “This is public and permanent.” Not “IRREVERSIBLE ON-CHAIN ACTION.”
- **Active:** “Validators decide.” Not “A decision is made by the validator set.”
- **No hype:** never “revolutionary,” “AI-powered,” “trustless,” “game-changing,” “unleash.”
- **No legal conclusions:** never “guilty,” “liable,” “illegal,” “crime,” “victim.”
- **No exclamation marks** in product copy. One is allowed in a celebratory empty state only if the owner approves; default is none.

**The “we” rule:** SafetyNet maintainers publish the interface and the registry. They do not decide verdicts. Use “SafetyNet publishes,” “validators decide,” “the record shows.” Never “we found the provider guilty” or “we dismissed the claim.”

### 2.5 Naming rules for product objects

| Use | Not |
|---|---|
| Incident / incident report | Complaint, case, lawsuit, accusation |
| Reporter | Plaintiff, victim, accuser |
| Provider | Defendant, accused, company |
| Claim | Allegation, charge |
| Defense / provider response | Excuse, rebuttal |
| Verdict / policy compliance verdict | Ruling, judgment, sentence, guilt |
| Policy gap | Violation, breach |
| Dismissed | Exonerated, cleared, innocent |
| Insufficient evidence | Failed, rejected, invalid |
| Out of scope | Not guilty, no case |
| Claimed / unclaimed | Verified / unverified provider |
| Finalized | Settled, closed, resolved |

---

## 3. AUDIENCES AND JOBS

### 3.1 Audiences

| Audience | What they need | What they fear | Design consequence |
|---|---|---|---|
| **Reporter** (developer, user, researcher, affected person) | File a precise report with evidence in minutes; know it was recorded | Wasted transaction, public PII, being ignored | Guided 5-step flow, live hash preview, PII warnings, visible tx lifecycle |
| **Provider** (AI company, model owner, agent operator) | Find incidents, respond, appeal, publish policy versions | Drive-by claims, inability to correct the record, unclear deadlines | Claim flow, deadline clarity, response form, appeal path, no edit/delete |
| **Reader** (journalist, regulator, buyer, citizen) | Understand what was decided and what it does not prove | Misreading a verdict as legal guilt | Verdict-first page, plain-language labels, trust boundary on every verdict |
| **Researcher / integrator** | Stable URLs, open data, hashes, API snippets | Fabricated or stale numbers | Static export, freshness stamps, schema, citation format |
| **Maintainer / reviewer** | Testable states, no hidden behavior, no scope creep | Regressions, legal copy drift | Test IDs, state matrix, copy deck, banned-word checks |

### 3.2 Jobs to be done

| ID | When… | I want to… | So I can… |
|---|---|---|---|
| J1 | I see an AI system contradict its published safety policy | file an incident with pinned evidence | put it on the public record |
| J2 | An incident names my system | read the claim and respond with evidence | correct the record without deleting it |
| J3 | I am researching a system | read its verdicts, clauses, and policy versions | understand its documented behavior |
| J4 | I disagree with a verdict | appeal within the window | ask for a larger validator round |
| J5 | I need the dataset | download JSON/Markdown with hashes | analyze or cite it without scraping |
| J6 | I am the provider and my policy changed | publish a new immutable version | have future incidents judged against the new text |
| J7 | I am anyone | trigger adjudication or finalization | keep the public record moving without a CLI |
| J8 | I am embedding a record | use a read-only widget | show accountability on my own site |

### 3.3 Primary journeys

1. **Read a verdict (most common):** home → incident → clause citations → trust boundary → share.
2. **File an incident:** report → system/policy → claim → evidence → review → wallet → tx → incident page.
3. **Respond as provider:** provider console → claim → open incident → respond → wait for adjudication.
4. **Appeal:** incident → appeal → reason → tx → new round → updated record.
5. **Export:** data → download/cite → verify hashes.

### 3.4 Design implications

- Every read path must work **without a wallet**.
- Every write path must explain **who can do it** and **what it changes** before the wallet prompt.
- Every verdict page must carry the **trust boundary** and the **disclaimer**.
- Every list must distinguish **empty**, **unknown**, and **stale**.
- Every action must show **transaction state**, never a fake success.
- Every synthetic record must be labeled **SYNTHETIC** in list, detail, embed, and export.

---

## 4. INFORMATION ARCHITECTURE

### 4.1 Route table

| Route | Name | Purpose | Data source | Wallet | Priority | Page test ID |
|---|---|---|---|---|---|---|
| `/` | Home | Pitch, headline numbers, latest verdicts, gap teaser, how it works | Index | No | P0 | `page-home` |
| `/incidents` | Incidents | Searchable, filterable public record | Index | No | P0 | `page-incidents` |
| `/incidents/:incidentId` | Incident detail | Full claim, response, evidence, verdict, clauses, appeals, actions | Live chain + index fallback | No to read; yes to act | P0 | `page-incident` |
| `/report` | Report | Five-step filing flow | Index + live config | Yes to submit | P0 | `page-report` |
| `/systems` | Systems | Registry of AI systems | Index | No | P0 | `page-systems` |
| `/systems/:systemId` | System detail | Policy versions, incident distribution, gaps, claim status | Live chain + index | No to read | P0 | `page-system` |
| `/policy-gaps` | Policy gaps | Headline differentiator; gaps grouped by system + clause | Index | No | P0 | `page-policy-gaps` |
| `/provider` | Provider console | Claim, respond, appeal, publish policy | Live chain + index | Yes | P1 | `page-provider` |
| `/about` | About | What this is and is not; trust boundary; disclaimer | Static | No | P0 | `page-about` |
| `/data` | Data | Downloads, schema, citation, license, embed | Static + index metadata | No | P1 | `page-data` |
| `/embed/system/:systemId` | Embed | Read-only system record for iframes | Index + live chain | No | P1 | `page-embed` |
| `*` | Not found | Honest 404 with routes back | Static | No | P0 | `page-not-found` |

**No other v1 routes.** Registration of a new system is CLI-first in v1; a web registration screen is `[OPEN] O-04`. A provider dashboard with analytics is out of scope. A settings page is not needed beyond the theme toggle.

### 4.2 URL conventions

**Normative:** production uses **path-based URLs**, not hash URLs. The app uses the History API router in `lib/router.tsx`; `apps/web/vercel.json` provides the rewrite.

```text
/incidents/inc-000001
/systems/synthetic-chatbot-1
/policy-gaps?system=synthetic-chatbot-1
/report?system=synthetic-chatbot-1
```

Why: permalinks must be shareable, citable, and indexable; hash fragments are not sent to the server and are weak for social previews. A small History API router (§22.5) plus a static-host rewrite handles this:

```json
// vercel.json (excerpt)
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

If a host cannot rewrite, hash routing is a **degraded fallback**; canonical URLs in exports and docs stay path-based. Do not mix both in one deployment.

**Rules**

- Lowercase paths, kebab-case segments, no trailing slash (redirect `/incidents/` → `/incidents`).
- IDs are case-sensitive as stored (`inc-000001`, `synthetic-chatbot-1`); never uppercase them in URLs.
- Query parameters are for **view state only**: `system`, `verdict`, `severity`, `status`, `q`, `sort`, `page`, `theme`.
- Unknown query parameters are ignored, not echoed. No tracking parameters exist.
- Filters are shareable. Changing a filter updates the URL with `replaceState`; opening a filter link restores it.
- Pagination uses `page=1` (omit page 1). Filter changes reset `page`.
- Canonical links omit empty parameters and default sort.
- External links to the app should use the full path, never `#/`.

**Canonical query keys**

| Key | Values | Applies to |
|---|---|---|
| `system` | system ID | `/incidents`, `/policy-gaps`, `/report` |
| `verdict` | one of five enums | `/incidents` |
| `severity` | `LOW`, `MODERATE`, `SERIOUS`, `CRITICAL` | `/incidents` |
| `status` | `OPEN`, `RESPONDED`, `DECIDED`, `APPEALED`, `FINAL` | `/incidents` |
| `q` | 1–80 chars | `/incidents`, `/systems` |
| `range` | `30d`, `90d`, `all` (default `all`) | `/incidents`, `/policy-gaps` |
| `clause` | clause ID (`C1`…) | `/policy-gaps` |
| `sort` | `newest`, `decided`, `severity` | `/incidents` |
| `page` | integer ≥ 1 | `/incidents`, `/systems` |
| `theme` | `light`, `dark` | `/embed/system/:id` only |

### 4.3 Navigation model

**Global header (desktop ≥ 768px)**

```text
[mark SafetyNet]   Incidents  Systems  Policy gaps  Data  About     [☾] [Report an incident]
```

- The brand links to `/`.
- Current section is indicated by `aria-current="page"` and a 2px bottom rule in `--sn-accent`; not by color alone.
- The theme toggle is an icon button with an accessible name.
- “Report an incident” is the only filled primary button in the header.
- The provider console is **not** in the primary nav. It is linked from the footer, from `/about`, and from system pages (“Are you the provider?”). This keeps the reader’s nav focused on the public record.

**Mobile (< 768px)**

- Header: brand + theme toggle + menu button.
- Menu opens a full-width disclosure panel below the header (not a full-screen overlay), with nav links, “Provider console,” and the primary report button.
- `aria-expanded`, `aria-controls`, focus moves to the first link; Escape closes and returns focus to the menu button; clicking a link closes.
- The menu is a `<nav aria-label="Primary">`; do not use `role="menu"` (these are navigation links, not a menu widget).

**Footer**

```text
SafetyNet · The public record of AI harm
Incidents · Systems · Policy gaps · Data · About · Provider console · Docs · GitHub
Network: StudioNet · Contract: 0xC0ff…ee01 · Index updated 2 Nov 2026, 10:14 UTC
Policy compliance findings, not legal determinations. Read the trust boundary.
```

- The footer is present on every page except `/embed/*`.
- The contract address is a copyable mono token; no explorer link in v1 unless the network’s explorer URL is in ground truth.
- The short disclaimer is a link to `/about#trust-boundary`.

### 4.4 Page hierarchy

```text
Home
├── Incidents
│   └── Incident detail
│       ├── Clause citation → Policy version (on system page)
│       ├── Provider response
│       ├── Evidence
│       └── Appeal history
├── Systems
│   └── System detail
│       ├── Policy versions
│       ├── Incident distribution
│       └── Policy gaps for this system
├── Policy gaps
│   ├── Gap group → Incident detail
│   └── Export markdown
├── Report (5 steps)
├── Provider console
│   ├── Claim
│   ├── Open incidents → Incident detail (respond)
│   └── Publish policy
├── Data
├── About
│   └── Trust boundary
└── Embed (standalone)
```

### 4.5 Route behavior

On every path change (not query-only changes):

1. Scroll to the top of the document, unless the navigation target has a hash anchor.
2. Move focus to the `<main>` element or the page `<h1>` (prefer `<main tabIndex={-1}>`) so screen-reader and keyboard users land in the new content.
3. Update `document.title` per §4.6.
4. Announce the page title in a polite live region (`data-testid="route-announcer"`), once.
5. Restore focus to the triggering element on back/forward when the browser provides it; do not fight the browser.

On query-only changes (filters, pagination):

1. Do not scroll to the top; update the results region.
2. Announce “N incidents match” in a polite live region.
3. If pagination changes, scroll the results heading into view, not the page top.

### 4.6 Titles and metadata

| Page | `<title>` | Meta description |
|---|---|---|
| Home | `SafetyNet — The public record of AI harm` | `Report an AI safety incident with evidence. GenLayer validators decide whether a system violated its own published policy. Every verdict is public and permanent.` |
| Incidents | `Incidents — SafetyNet` | `Browse policy compliance verdicts, policy gaps, and open incidents in the public SafetyNet record.` |
| Incident | `inc-000001 — Policy violation — Synthetic Chatbot — SafetyNet` (or `No verdict yet` / `Open incident`) | `Policy compliance record for inc-000001: verdict, cited clauses, evidence hash, provider response, and appeal history.` |
| Report | `Report an incident — SafetyNet` | `File an AI safety incident with pinned evidence and a specific policy version.` |
| Systems | `AI systems — SafetyNet` | `The registry of AI systems with published safety policies and their SafetyNet incident records.` |
| System | `Synthetic Chatbot — SafetyNet` | `Policy versions, incident distribution, and policy gaps for Synthetic Chatbot.` |
| Policy gaps | `Policy gaps — SafetyNet` | `Incidents where harm occurred even though the system's output was within its own published policy.` |
| Provider | `Provider console — SafetyNet` | `Claim a system, respond to incidents, appeal a verdict, and publish policy versions.` |
| About | `About — SafetyNet` | `What SafetyNet is, what a verdict means, and what it does not prove.` |
| Data | `Open data — SafetyNet` | `Download the public incident and verdict dataset, schema, and policy gap report.` |
| 404 | `Page not found — SafetyNet` | `That page is not in the SafetyNet record.` |

**Rules**

- Never put claim text, defense text, inline evidence, or a reporter address in a meta description. Privacy and permanence apply to metadata too.
- Set `<link rel="canonical">` to the path without query filters for list pages, and to the exact incident/system URL for detail pages.
- Set `<meta name="robots" content="noindex">` for `/embed/*`? No: embed pages should be indexable only if the system is claimed; use `noindex` for unclaimed systems. The main app pages are indexable.
- Open Graph images are static per verdict type (Appendix F); incident-specific OG images are not possible without SSR. The default OG title/description must still be accurate without JavaScript.
- Set `theme-color` for light (`#FAF9F5`) and dark (`#0D1117`) with `media` attributes.
- No JSON-LD in v1. If added later, it must not assert legal conclusions.

### 4.7 Not found

- H1: “That page isn’t in the record.”
- Body: “The link may be wrong, or the record may not exist. Incident IDs look like `inc-000001`; system IDs look like `synthetic-chatbot-1`.”
- Actions: “Browse incidents,” “Browse systems,” “Go home.”
- If the path looks like an incident ID but the record is missing, say “No incident with that ID is in the published index or on chain.” Do not imply deletion; records are permanent. If the chain is unreachable, use the error state, not 404.
- Status code: the static host returns 200 for the SPA shell; the UI renders a 404 page. If the host supports per-route status, return 404. Document this honestly in the data/API docs.

---

## 5. LAYOUT

### 5.1 Page shell

```text
┌──────────────────────────────────────────────────────────────┐
│ Skip link (visible on focus)                                 │
├──────────────────────────────────────────────────────────────┤
│ Header: brand · nav · theme · primary action                 │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Main: max 1080px, 20px gutter, 24px section rhythm           │
│                                                              │
│  ┌───────────────────────────────┬────────────────────────┐  │
│  │ Primary column (8/12)         │ Rail (4/12)            │  │
│  │ verdict, claim, evidence      │ metadata, actions       │  │
│  └───────────────────────────────┴────────────────────────┘  │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ Footer: record status, links, network, disclaimer            │
└──────────────────────────────────────────────────────────────┘
```

- The shell is a flex column with `min-height: 100dvh`; footer at the bottom.
- `<main id="main">` has `tabIndex={-1}` and `scroll-margin-top: calc(var(--sn-header-height) + 16px)`.
- Sticky header: `position: sticky; top: 0; z-index: var(--sn-z-header); background: var(--sn-bg); border-bottom: 1px solid var(--sn-border)`. Solid background, no blur/glass.
- Max content width: `1080px`; wide tables may use `1200px` (`--sn-container-wide`) but must remain within the viewport.
- Gutter: `20px` desktop, `16px` below 480px.
- Vertical rhythm: `24px` between major sections, `16px` between related blocks, `8px` inside a block.

### 5.2 Grid

- 12-column grid at ≥ 1024px: `grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 24px`.
- Detail pages: main `span 8`, rail `span 4`; rail is `320px` min at ≥ 1024.
- Home: stats `span 4` each; latest/gaps `span 6` each at ≥ 1024; stack below.
- Forms: single column max `720px`; review summary may use `2` columns at ≥ 768.
- Tables: full width inside a bordered wrapper with `overflow-x: auto`.
- Prose: `max-width: 68ch` for claim, defense, and policy text. Do not measure full-width.

### 5.3 Header anatomy

| Slot | Content | Rules |
|---|---|---|
| Brand | Mark + wordmark, links `/` | `aria-label="SafetyNet home"`; no tagline |
| Primary nav | Incidents, Systems, Policy gaps, Data, About | `aria-current="page"`; active rule; 44px touch height |
| Utility | Theme toggle | Icon button; accessible name changes with theme |
| Primary action | “Report an incident” | Filled accent; hidden in the desktop nav only if space < 900px; always in mobile menu |

- Header height: `64px` desktop, `56px` mobile; use `min-height`, not fixed, so zoomed text does not clip.
- The header must not shrink the nav into an unlabeled overflow. Below 900px, move the primary action into the menu; below 768px, move all nav into the menu.
- The header border is a hairline; no shadow. On scroll, keep the border; no elevation change.

### 5.4 Footer anatomy

| Slot | Content |
|---|---|
| Brand line | “SafetyNet · The public record of AI harm” |
| Links | Incidents, Systems, Policy gaps, Data, About, Provider console, Docs, GitHub |
| Status line | Network badge, contract address (copyable), index freshness |
| Legal line | “Policy compliance findings, not legal determinations.” + link to trust boundary |
| Build line | App version and commit (small, muted) — optional but useful for verification |

- Footer text: `0.8125rem`, muted; links underlined on hover/focus.
- No newsletter, social pixels, cookies banner, or “Made with” badge.
- The footer status line must not show a green “operational” dot unless it is actually checking the RPC. If it is static, use the network name without a status dot. Do not fake liveness.

### 5.5 Page templates

| Template | Pages | Structure |
|---|---|---|
| **Feed** | Home | Lede, stats, two-column latest/gaps, how-it-works, trust note |
| **List** | Incidents, Systems | Page head, toolbar/filters, result summary, list/table, pagination, empty/error |
| **Detail** | Incident, System | Breadcrumb, page head, main column + rail, sections, integrity/trust note |
| **Form** | Report, Provider response/appeal/publish | Page head, step indicator, form sections, sticky review summary (desktop only), submit |
| **Editorial** | About, Data | Page head, prose max 68ch, callouts, tables, downloads |
| **Standalone** | Embed | Compact card, no header/footer/nav |

### 5.6 Density and scroll

- Default density is **comfortable**: `16px` body, `1.6` line height, `14–18px` card padding.
- Tables may use **compact** density on desktop (`10px 12px` cells) but must not go below 44px row height on touch.
- No horizontal scrolling for page content. Tables may scroll horizontally inside their wrapper; the wrapper gets `role="region"`, `aria-label`, and `tabindex="0"` so keyboard users can scroll it.
- Avoid nested scroll containers except evidence text and raw JSON. Evidence text may use `max-height: 320px; overflow: auto` with an “Expand” control; print expands it.
- Sticky elements: header only. Do not make the rail sticky in v1; it creates focus and zoom problems. A sticky submit bar is not used; the submit button is inline at the end of the form and repeated in the review summary.

## 6. DESIGN TOKENS

### 6.1 Token philosophy

- **Semantic names, not raw values.** Components use `--sn-text`, `--sn-surface`, `--sn-border`, `--sn-accent`, `--sn-verdict-gap`, not `#B54708`.
- **One source.** All tokens live in `apps/web/src/styles/tokens.css` (Appendix A). No component may define a new color, font, radius, or duration outside that file.
- **Theme by attribute.** `:root[data-theme="light"]` and `:root[data-theme="dark"]`; the resolved theme is set before paint (§7.3).
- **Contrast is a token requirement.** A token that cannot meet the contrast rules in §18.3 is not shippable.
- **No opacity for text.** Use a muted token, not `opacity: 0.6`.
- **No `color-mix()` for critical borders.** Use explicit border tokens so the result is predictable across browsers.
- **No CSS variables in media queries.** Breakpoints are literals in §19.

### 6.2 Color

The palette is **warm paper + archival blue + stamped verdicts**. It deliberately avoids the default SaaS purple and the “AI neon” look.

#### Core surfaces and text

| Token | Light | Dark | Use |
|---|---|---|---|
| `--sn-bg` | `#FAF9F5` | `#0D1117` | Page background |
| `--sn-surface` | `#FFFFFF` | `#141A22` | Cards, tables, inputs |
| `--sn-surface-2` | `#F3F1EA` | `#1A222C` | Subtle fills, code blocks, hover rows |
| `--sn-surface-3` | `#ECE9E0` | `#202A36` | Pressed/selected neutral |
| `--sn-ink` | `#15171A` | `#F2F4F7` | Headings, primary text |
| `--sn-text` | `#15171A` | `#F2F4F7` | Body text |
| `--sn-text-secondary` | `#40454D` | `#C9D0DA` | Ledes, secondary body |
| `--sn-muted` | `#5F6B7A` | `#98A2B3` | Metadata, labels, hints |
| `--sn-border` | `#DDD8CC` | `#2A3441` | Hairlines, card borders |
| `--sn-border-strong` | `#B5AFA2` | `#3D4A5C` | Inputs, interactive borders |
| `--sn-rule` | `#E7E2D6` | `#222C37` | Section rules, table dividers |

#### Accent and interaction

| Token | Light | Dark | Use |
|---|---|---|---|
| `--sn-accent` | `#1E4E79` | `#9DC7F2` | Links, primary buttons, active nav |
| `--sn-accent-hover` | `#163A5A` | `#C3DDFA` | Hover |
| `--sn-accent-soft` | `#EAF1F8` | `#132A3F` | Active nav background, selected rows |
| `--sn-accent-contrast` | `#FFFFFF` | `#0D1117` | Text on accent-filled buttons |
| `--sn-focus` | `#2563EB` | `#7AB7FF` | Focus ring |

#### Semantic and verdict

| Token | Light | Dark | Use |
|---|---|---|---|
| `--sn-danger` | `#B42318` | `#FDA29B` | Policy violation, destructive/error text |
| `--sn-danger-soft` | `#FEF3F2` | `#2A1512` | Violation badge background, error banner |
| `--sn-danger-border` | `#FECDCA` | `#5B2A24` | Violation border |
| `--sn-warn` | `#B54708` | `#FEC84B` | Policy gap, moderate severity, warning |
| `--sn-warn-soft` | `#FFFAEB` | `#2A1F0B` | Gap badge background, warning banner |
| `--sn-warn-border` | `#FEDF89` | `#5C4712` | Gap border |
| `--sn-ok` | `#067647` | `#75E0A7` | Dismissed, success |
| `--sn-ok-soft` | `#ECFDF3` | `#0E2519` | Dismissed background, success banner |
| `--sn-ok-border` | `#ABEFC6` | `#1E5138` | Dismissed border |
| `--sn-neutral` | `#475467` | `#D0D5DD` | Insufficient evidence, out of scope, unknown |
| `--sn-neutral-soft` | `#F2F4F7` | `#1A222C` | Neutral badge background |
| `--sn-neutral-border` | `#D0D5DD` | `#3D4A5C` | Neutral border |

#### Verdict aliases

Components must use the verdict aliases, not the raw semantic tokens, so a verdict theme change is one edit:

```css
--sn-verdict-violation: var(--sn-danger);
--sn-verdict-violation-bg: var(--sn-danger-soft);
--sn-verdict-violation-border: var(--sn-danger-border);

--sn-verdict-gap: var(--sn-warn);
--sn-verdict-gap-bg: var(--sn-warn-soft);
--sn-verdict-gap-border: var(--sn-warn-border);

--sn-verdict-neutral: var(--sn-neutral);
--sn-verdict-neutral-bg: var(--sn-neutral-soft);
--sn-verdict-neutral-border: var(--sn-neutral-border);

--sn-verdict-dismissed: var(--sn-ok);
--sn-verdict-dismissed-bg: var(--sn-ok-soft);
--sn-verdict-dismissed-border: var(--sn-ok-border);
```

#### Color rules

1. **Accent** is for interaction, brand, and selection. Never use accent for a verdict.
2. **Danger** is for `POLICY_VIOLATION`, form errors, and failed transactions. Do not use it for `OUT_OF_SCOPE`, `INSUFFICIENT_EVIDENCE`, or ordinary warnings.
3. **Warn** is for `POLICY_ADEQUATE_BUT_HARM`, `MODERATE` severity, and non-blocking warnings.
4. **OK** is for `DISMISSED` and successful transactions only. Never use green to imply that a provider is “safe.”
5. **Neutral** is for `INSUFFICIENT_EVIDENCE`, `OUT_OF_SCOPE`, unknown/unavailable states, and metadata.
6. **Never color alone.** Each use has an icon and/or text label.
7. **No red for out-of-scope.** This is a hard rule from `AGENTS.md` §23.6.
8. **No gradients, neon glows, or translucent text.** The only translucency allowed is the dialog backdrop (`rgb(0 0 0 / 0.48)`).

**Contrast:** every pair used for body text, labels, badge text, and button text meets WCAG 2.1 AA (≥ 4.5:1 for normal text, ≥ 3:1 for large text and UI boundaries). Representative pairs: light ink/paper ≈ 17.8:1; light muted/paper ≈ 5.1:1; light accent/paper ≈ 8.6:1; white on light accent ≈ 8.6:1; dark ink/background ≈ 16.5:1; dark muted/background ≈ 7.4:1; dark accent/background ≈ 11.6:1; verdict pairs ≥ 5.2:1 in light and ≥ 7.4:1 in dark. Re-measure after any token change; do not trust memory.

### 6.3 Typography

**Families (system only; zero web-font requests):**

```css
--sn-font-display: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
--sn-font-body: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
--sn-font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
```

**Scale**

| Token | Size | Line height | Use |
|---|---|---|---|
| `--sn-text-xs` | `0.75rem` (12px) | 1.45 | Eyebrows, micro-labels, legal fine print |
| `--sn-text-sm` | `0.8125rem` (13px) | 1.5 | Metadata, table secondary text, hints |
| `--sn-text-base` | `1rem` (16px) | 1.6 | Body |
| `--sn-text-md` | `1.0625rem` (17px) | 1.6 | Lede, claim/defense reading text |
| `--sn-text-lg` | `1.25rem` (20px) | 1.35 | h3, card titles |
| `--sn-text-xl` | `1.5rem` (24px) | 1.25 | h2 on mobile |
| `--sn-text-2xl` | `1.875rem` (30px) | 1.2 | h2 desktop |
| `--sn-text-3xl` | `2.375rem` (38px) | 1.12 | h1 detail pages |
| `--sn-text-4xl` | `clamp(2.5rem, 2rem + 2.5vw, 3.5rem)` | 1.05 | Home h1 only |

**Roles**

- **h1:** display serif, weight 600, `letter-spacing: -0.02em`, `text-wrap: balance`. One per page.
- **h2:** display serif, weight 600, `letter-spacing: -0.015em`. Section titles.
- **h3:** body sans, weight 650, `letter-spacing: -0.005em`. Card/section subheads.
- **h4:** body sans, weight 650, `0.9375rem`. Small section labels.
- **Eyebrow:** body sans, `0.75rem`, weight 650, uppercase, `letter-spacing: 0.08em`, `--sn-muted`. Use sparingly: page type, record ID, “SYNTHETIC.”
- **Lede:** `--sn-text-md`, `--sn-text-secondary`, max `68ch`.
- **Body:** `--sn-text-base`, `--sn-text`, max `68ch` for prose.
- **Small:** `--sn-text-sm`, `--sn-muted`.
- **Mono:** `--sn-font-mono`, `0.875em` relative to context; hashes, addresses, IDs, JSON.
- **Stats:** display serif, weight 600, `2rem`, `font-variant-numeric: tabular-nums`, `letter-spacing: -0.03em`.

**Rules**

- Do not use all-caps for sentences. Uppercase is reserved for eyebrows, the `SYNTHETIC` badge, and short labels.
- Do not use italic for long text. Italic is for titles of works and short emphasis.
- Do not use justified text. Left-align; `text-wrap: pretty` on paragraphs where supported.
- Maximum line length: `68ch` for prose; `none` for tables.
- Minimum body size: `16px`. Do not shrink body text on mobile.
- Use `font-variant-numeric: tabular-nums` for counts, dates, hashes, and stats.
- No text shadows, no letter-spacing on body text.

### 6.4 Spacing

A 4px base scale. Use the token, not arbitrary pixels.

| Token | Value | Typical use |
|---|---|---|
| `--sn-space-1` | `0.25rem` (4px) | Icon gap, tight inline |
| `--sn-space-2` | `0.5rem` (8px) | Label to input, badge gap |
| `--sn-space-3` | `0.75rem` (12px) | Card inner gaps |
| `--sn-space-4` | `1rem` (16px) | Paragraph gap, card padding (compact) |
| `--sn-space-5` | `1.25rem` (20px) | Card padding, list gap |
| `--sn-space-6` | `1.5rem` (24px) | Section gap, grid gap |
| `--sn-space-8` | `2rem` (32px) | Major block gap |
| `--sn-space-10` | `2.5rem` (40px) | Section padding |
| `--sn-space-12` | `3rem` (48px) | Page section separation |
| `--sn-space-16` | `4rem` (64px) | Home hero bottom, major editorial breaks |
| `--sn-space-20` | `5rem` (80px) | Rare; home top/bottom |

### 6.5 Radii, borders, shadows

| Token | Value | Use |
|---|---|---|
| `--sn-radius-xs` | `3px` | Code inline, tiny chips |
| `--sn-radius-sm` | `5px` | Inputs, small buttons, evidence blocks |
| `--sn-radius-md` | `8px` | Cards, tables, notices |
| `--sn-radius-lg` | `12px` | Dialogs, large panels |
| `--sn-radius-pill` | `999px` | Badges only |
| `--sn-border-width` | `1px` | All borders |
| `--sn-shadow-sm` | `0 1px 2px rgb(21 23 26 / 0.05)` | Cards (light) |
| `--sn-shadow-md` | `0 2px 8px rgb(21 23 26 / 0.06), 0 1px 2px rgb(21 23 26 / 0.04)` | Dialog, elevated panel |

**Rules:** borders are the primary separation; shadows are secondary. Do not use shadows on every card. Do not use inset shadows. Do not use glow. On dark, shadows are weaker; rely on border contrast.

### 6.6 Motion

| Token | Value | Use |
|---|---|---|
| `--sn-duration-fast` | `120ms` | Hover, focus, color |
| `--sn-duration-base` | `180ms` | Disclosure, dialog, status dot |
| `--sn-duration-slow` | `240ms` | Rare; large panel |
| `--sn-ease` | `cubic-bezier(0.2, 0, 0, 1)` | Standard easing |

**Rules**

- Animate only `opacity`, `transform`, `color`, `background-color`, `border-color`, and `height` for a disclosure. Never animate layout properties that cause reflow beyond a disclosure.
- No page transitions. No scroll-triggered reveals. No parallax. No count-up numbers. No confetti.
- The transaction stepper may animate the status dot and the active step; no looping pulse in the default state. A waiting state may use a static “Waiting…” label with elapsed seconds.
- Skeletons may pulse at `1.6s`; disable the pulse under `prefers-reduced-motion`.
- Under `prefers-reduced-motion: reduce`, set all animation/transition durations to `0.01ms`, disable smooth scrolling, and keep state changes instant. Content must never depend on motion to be understood.

### 6.7 Z-index

| Token | Value | Use |
|---|---|---|
| `--sn-z-header` | `20` | Sticky header |
| `--sn-z-menu` | `30` | Mobile nav panel |
| `--sn-z-dialog` | `40` | Native dialog |
| `--sn-z-toast` | `50` | Reserved; toasts are not used for critical errors |

No other z-index values. Do not use `9999`.

### 6.8 Breakpoints

| Name | Width | Behavior |
|---|---|---|
| `sm` | `< 480px` | Single column, 16px gutter, compact header |
| `md` | `480–767px` | Single column, 20px gutter, menu nav |
| `lg` | `768–1023px` | Two-column home, full nav, detail still single column |
| `xl` | `≥ 1024px` | Detail rail, 12-column grid |
| `2xl` | `≥ 1280px` | Wider tables, more whitespace; content still capped |

Media queries use literal values (`@media (min-width: 768px)`), not CSS variables.

---

## 7. THEMES

### 7.1 Light theme (default)

Warm paper `#FAF9F5`, white surfaces, ink `#15171A`, archival blue `#1E4E79`. This is the canonical presentation for screenshots, docs, and print. It should feel like a reading room, not a dashboard.

### 7.2 Dark theme

Near-black blue `#0D1117`, raised surfaces `#141A22` / `#1A222C`, ink `#F2F4F7`, accent text `#9DC7F2`. Verdict colors are lightened for contrast, never saturated neon. Dark mode is a first-class theme, not an inversion filter.

**Dark rules**

- Do not use pure black (`#000`) or pure white (`#FFF`) as large surfaces.
- Borders must remain visible: use `--sn-border` on surfaces and `--sn-border-strong` on inputs.
- Accent-filled buttons use light blue with dark text (`--sn-accent-contrast`), not dark blue with white text, so the button remains visible against the dark page.
- Shadows are weak; use borders.
- Images: none in v1. If added, provide dark variants or a neutral treatment.
- Print is always light (§Appendix G).

### 7.3 Theme resolution and no-flash boot

The resolved theme is set on `<html data-theme="light|dark">` **before first paint** by a tiny inline script in `index.html`:

```html
<script>
  (function () {
    try {
      var stored = localStorage.getItem("snet-theme");
      var theme = stored === "light" || stored === "dark"
        ? stored
        : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
    } catch (_) {
      document.documentElement.dataset.theme = "light";
    }
  })();
</script>
```

- The script is inline for no-flash boot. If a Content-Security-Policy is enabled, include its SHA-256 hash in `script-src` or move it to a hashed external file with a blocking `<script src>` in `<head>`. Do not use `unsafe-inline` for the whole app.
- `localStorage` key: `snet-theme`; values `light` or `dark`. This is the **only** localStorage entry in v1. It stores no personal data.
- If no stored value, follow `prefers-color-scheme` and listen for changes while the app is open. Once the user toggles, store the explicit value and stop following the system.
- The toggle updates `data-theme`, `color-scheme`, `meta[name="theme-color"]`, and the button’s accessible name. It announces “Dark theme” / “Light theme” via a polite live region.
- The toggle is an icon button; the icon is a sun in dark mode (action: switch to light) and a moon in light mode (action: switch to dark). The accessible name is the action, not the current state.

### 7.4 Theme toggle placement

- Header utility slot on every page except `/embed/*`.
- `/embed/*` accepts `?theme=light|dark`; default follows the embedding page’s `prefers-color-scheme` if possible, otherwise light. The embed does not render a toggle.
- The theme does not change verdict semantics or labels. A red violation badge stays red-family in both themes, with adjusted contrast.

### 7.5 Print theme

Print always uses light tokens, hides navigation/actions/theme controls, expands links, and preserves verdict labels and icons. See Appendix G.

---

## 8. TYPOGRAPHY AND CONTENT RENDERING

### 8.1 Reading measure

- Prose: `max-width: 68ch`.
- Claim/defense: `max-width: 68ch`, `white-space: pre-wrap`, `overflow-wrap: anywhere` for long tokens.
- Policy clause text: `max-width: 68ch`; preserve paragraph breaks; no Markdown rendering.
- Tables: full width; cell text may wrap; hashes use mono and `overflow-wrap: anywhere`.

### 8.2 Paragraphs, links, lists

- Paragraph spacing: `0.75rem` between paragraphs in prose; `1rem` between blocks.
- Links: `color: var(--sn-accent); text-decoration: underline; text-underline-offset: 2px; text-decoration-thickness: 1px`. Hover: thickness `2px`. Visited links use the same color (no purple). Focus: §18.
- Do not use “click here.” Link text names the destination: “Read the trust boundary,” “View policy v1.0.0,” “inc-000001.”
- Lists: `padding-left: 1.25rem`; markers `--sn-muted`; `li + li` margin `0.375rem`.
- Blockquote: left border `3px solid var(--sn-accent)`, padding-left `1rem`, text `--sn-text-secondary`; use for quoted policy clauses, not for editorial opinion.
- Horizontal rule: `1px solid var(--sn-rule)`, margin `2rem 0`. Do not use `<hr>` as decoration between every section; use section spacing.

### 8.3 Hashes, addresses, IDs

- Always render hashes with the `sha256:` prefix. Never strip it in display.
- Short form: `sha256:9f2c…a41d` (first 4 hex, last 4 hex). Full form: 64 hex characters, mono, copyable.
- Addresses: `0xAb12…77Ef` (first 6 including `0x`, last 4). Full form copyable.
- Transaction hashes: `0x7a1b…90cd` (first 6, last 4). Full form copyable.
- Incident IDs: `inc-000001`; system IDs: `synthetic-chatbot-1`; policy versions: `1.0.0`; clause IDs: `C1`. Use mono for IDs in tables and metadata.
- `title` attribute contains the full value; the visible short value is still selectable. The copy button is the primary way to get the full value.
- Do not link a hash to an explorer unless the explorer URL is in ground truth and the network is known. A dead explorer link is worse than no link.

### 8.4 Dates, times, numbers

- Absolute date: `2 Nov 2026, 10:14 UTC` via `Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC", timeZoneName: "short" })`.
- Relative date: `3 hours ago`, `2 days ago`, `just now`; only within 30 days. After 30 days, show absolute only.
- Always use a `<time dateTime="...">` element with an ISO timestamp.
- Chain timestamps are Unix seconds; convert explicitly. Never treat them as milliseconds.
- Counts: `Intl.NumberFormat("en")`; no decimals. Percentages: one decimal maximum, e.g. `12.5%`; include the denominator.
- Never show a percentage or median without a sample size. “Median response: 14 hours (n=23)” is acceptable; “14 hours” alone is not.
- Unknown: `—` with a visually hidden “Not available.” Never `0` unless the count is truly zero and the source is fresh.

### 8.5 Policy text rendering

The contract stores only `text_hash`, `clause_ids`, and `url`. The UI MUST NOT display clause text unless it has verified the text against the pinned hash.

**Verification flow**

1. Fetch `policy.url` with `fetch(url, { mode: "cors", redirect: "follow" })`, 10s timeout, `Accept: text/plain, text/markdown, text/html`.
2. Normalize using the **same normalizer** as the contract/core (§22.8). If the normalizer is unavailable, do not display text; show the fallback.
3. Compute SHA-256 over the normalized UTF-8 text; compare to `policy.text_hash` (and to `incident.policy_hash` on an incident page).
4. If equal: parse clause sections for display (`## C1 — Title` through the next `##`), render as **plain text**. Do not render Markdown, HTML, or links from the policy document.
5. If unequal, fetch fails, CORS blocks, or the normalizer is missing: show clause IDs, the policy URL, and the pinned hash. Show a notice: “Clause text not shown — the source could not be verified against the pinned hash.” Provide “Open policy source” (external) and “Copy hash.” Never show unverified text as if it were the clause.

**Why:** showing text from a URL that no longer matches the hash would let a provider silently substitute policy language in the public record. The record must fail closed in the UI exactly as the contract does.

**Fallback display**

```text
Clause C3 — Protected attributes
Text not shown: the policy source could not be verified against the pinned hash.
Policy source: https://acme.ai/safety-policy-v1.2.0 (opens in a new tab)
Pinned hash: sha256:9f2c…a41d [copy]
```

**Clause parsing (display only)**

- Header pattern: `^##\s+(C[1-9][0-9]?)\s+—\s+(.+)$` (em dash or hyphen).
- Body: text until the next `## ` heading.
- If parsing fails, display the whole verified policy text under “Policy text” without clause mapping; still show cited clause IDs.
- `mandatory` comes from the policy document’s comment (`<!-- mandatory: true -->`) if present; if not present, do not invent it. Show “Mandatory” only when parsed and verified.

### 8.6 Claim and defense rendering

- Render as text, never HTML. `white-space: pre-wrap`; preserve line breaks; collapse nothing.
- Do not linkify URLs inside claim text automatically. If the user included a URL, show it as text; the evidence section is the place for clickable, validated URLs.
- Do not truncate on the detail page. On list pages, claim text is not shown at all (§14.2).
- Show a small label: “Claim — as filed by the reporter” and “Provider response — as filed.” These are records, not summaries.
- If the text contains PII, do not redact automatically on the public record; the record is permanent. Show the PII warning at filing time, and link the redaction policy on `/about`. Display-layer redaction is a separate, documented process.

### 8.7 Raw record

- The incident detail page may include a `<details>` “Raw record (JSON)” with the incident, response, verdict, and appeals as returned by the chain.
- Pretty-print with 2 spaces; mono `0.8125rem`; max-height `420px`; scroll; copy button.
- Do not include secrets (there are none) or hidden metadata. Do not include a “download” that could be mistaken for an official export; the official export is `/data`.
- Raw record is not printed by default (Appendix G).

---

## 9. ICONOGRAPHY AND IMAGERY

### 9.1 Icon system

- Inline SVG only. No icon font, no sprite dependency, no emoji in UI chrome.
- 24×24 viewBox; default render size 20px; inline size 16px; large empty-state icon 32px.
- Stroke `1.75`, `stroke-linecap="round"`, `stroke-linejoin="round"`, `fill="none"`, `currentColor`.
- Icons are `aria-hidden="true"` when accompanied by text. An icon-only button MUST have an `aria-label`.
- Icons align optically with the first line of text: `vertical-align: -0.125em` for inline; flex centering in buttons.
- Do not use icons to replace words in verdicts, severity, confidence, or status. Icon + text always.

### 9.2 Verdict icons (canonical)

| Verdict | Glyph | SVG concept | Label |
|---|---|---|---|
| `POLICY_VIOLATION` | `⚠` | Triangle with exclamation | **Policy violation** |
| `POLICY_ADEQUATE_BUT_HARM` | `◐` | Circle, left half filled | **Policy gap** |
| `INSUFFICIENT_EVIDENCE` | `?` | Circle with question mark | **Insufficient evidence** |
| `OUT_OF_SCOPE` | `⊘` | Circle with diagonal slash | **Out of scope** |
| `DISMISSED` | `✓` | Circle with check | **Dismissed** |

The glyph column is the semantic reference. SVG icons must preserve the silhouette and meaning; do not substitute a different metaphor (no gavel, no scales, no thumbs-down).

### 9.3 Status and utility icons

| Concept | Icon | Use |
|---|---|---|
| Open | circle-dot | Incident status `OPEN` |
| Response filed | message-square | `RESPONDED` |
| Decided | stamp | `DECIDED` |
| Appeal filed | rotate-ccw | `APPEALED` |
| Final | lock | `FINAL` |
| Clock | clock | Deadlines, waiting |
| External | arrow-up-right | External link |
| Copy | copy | Copy hash/address |
| Copied | check | Copy success |
| Chevron | chevron-down/right | Disclosure, select |
| Menu | menu | Mobile nav |
| Close | x | Dialog/menu close |
| Sun | sun | Switch to light |
| Moon | moon | Switch to dark |
| Search | search | Search input |
| Filter | filter | Mobile filters |
| Download | download | Data downloads |
| Wallet | wallet | Wallet connect |
| Info | info | Informational notice |
| Warning | triangle-alert | Warning notice |
| Error | circle-alert | Error notice |
| Success | check-circle | Success notice |

**Do not use:** gavel, scales of justice, handcuffs, police shield, “100” badge, fire, rocket, sparkles, robot faces, brain icons, or any legal/enforcement metaphor. SafetyNet is a record, not a court.

### 9.4 Imagery

- **No hero photography, no AI-generated illustrations, no abstract gradient blobs.** The record is the visual.
- The only images in v1 are the favicon, app icons, and static Open Graph cards. All are typographic/mark-based.
- If an illustration is ever added, it must be diagrammatic, monochrome, and explain a concept (e.g., “pinned evidence → validators → verdict”), not decorate a page.
- OG cards use the brand mark, the verdict label/icon, and the words “SafetyNet — policy compliance record.” No faces, no company logos, no implied guilt.

---

## 10. MOTION

### 10.1 Principles

1. Motion explains a state change; it never decorates.
2. Motion is short. Nothing exceeds `240ms` except a skeleton pulse.
3. Motion is interruptible and never blocks input.
4. Motion never carries meaning alone. The final state is always readable without seeing the transition.
5. Motion respects `prefers-reduced-motion`.

### 10.2 What moves

| Element | Motion | Duration |
|---|---|---|
| Link/button hover | color/background | `120ms` |
| Focus ring | none (instant) | — |
| Disclosure | height/opacity | `180ms` |
| Dialog | opacity + `scale(0.98 → 1)` | `180ms` |
| Tx status dot | color/scale `1 → 1.15 → 1` | `180ms` once per status change |
| Skeleton | opacity pulse | `1.6s` loop, disabled under reduced motion |
| Theme change | none (instant token swap) | — |
| Route change | none | — |

### 10.3 What never moves

- The page on scroll (no parallax, no reveal).
- Numbers (no count-up).
- The verdict badge (no stamp animation, no shake).
- The header (no hide-on-scroll).
- The background (no gradient animation).
- The logo (no draw-on animation; the gap is static).

### 10.4 Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

The reduced-motion user still sees every state, label, and result. The tx stepper may jump between states; that is correct.

---

## 11. COMPONENT LIBRARY

### 11.0 Component rules

- Named exports only in `components/`; no default exports in library code (`AGENTS.md` §3.3).
- Every component accepts `className?: string` and forwards `data-testid` where useful.
- No component fetches data. Views own data and pass explicit props/state.
- No component reads `window` at import time. Browser APIs are used inside effects/handlers.
- No inline styles except CSS custom properties for computed values (e.g., a bar width). Static styling lives in `*.module.css`.
- Every interactive component has default, hover, focus-visible, active, disabled, and (where relevant) loading/error states.
- Every component that can be empty has an explicit empty state; every component that can fail accepts an error state.
- Copy lives in `lib/copy.ts` for shared strings and in the component for local labels. The banned-word test (§23.5) scans both.

### 11.1 Button

**Variants:** `primary`, `secondary`, `ghost`, `link`. **Sizes:** `md` (44px min height), `sm` (36px min height, desktop only; never the only action on touch).

| Variant | Background | Text | Border | Use |
|---|---|---|---|---|
| Primary | `--sn-accent` | `--sn-accent-contrast` | `--sn-accent` | One per view: report, submit, connect |
| Secondary | `transparent` | `--sn-text` | `--sn-border-strong` | Cancel, retry, secondary actions |
| Ghost | `transparent` | `--sn-text` | none | Toolbar, menu, inline actions |
| Link | transparent | `--sn-accent` | none, underlined | “Clear filters,” “Show full hash” |

- Padding: `0.625rem 1rem` (md); `0.375rem 0.75rem` (sm).
- Radius: `--sn-radius-sm`.
- Font: body, `0.9375rem`, weight 600.
- Icon gap: `0.5rem`; icon 18px.
- Hover: primary → `--sn-accent-hover`; secondary → `--sn-surface-2`; ghost → `--sn-surface-2`; link → 2px underline.
- Active: no transform; darken background one step.
- Focus: `outline: 2px solid var(--sn-focus); outline-offset: 2px`.
- Disabled: `opacity: 0.55; cursor: not-allowed`; native `disabled`; keep the label readable. Always pair with visible help text explaining why (e.g., “Connect a wallet to submit”).
- Loading: `aria-busy="true"`, disabled, spinner 16px + label “Submitting…”; keep width stable with `min-width`.
- Do not use a danger button in v1. There are no destructive on-chain actions. “Cancel” cancels a local dialog, not a record.

**Accessibility:** native `<button type="button">`; `type="submit"` only inside forms. Never a `<div role="button">`. Icon-only is `IconButton`.

### 11.2 Link

- Internal navigation uses the router’s `<Link to="...">`, which renders a real `<a href>`.
- External links use `<a href="https://..." target="_blank" rel="noopener noreferrer">` with an `ExternalLink` icon and a visually hidden “(opens in a new tab).”
- Never use `<a href="#">` for an action. Use a button.
- In prose, links are underlined. In nav/buttons/cards, links are not underlined by default but gain an underline on hover/focus.
- Do not open internal links in a new tab. Do not hijack middle-click or Ctrl+click.

### 11.3 IconButton

- Minimum 44×44 hit area; visible icon 20px.
- `aria-label` is required and describes the action (“Copy evidence hash,” “Switch to dark theme,” “Open menu”).
- Optional `title` for a tooltip; the tooltip is not the only label.
- Focus ring is inset by 2px so it is not clipped by the header.
- Used for: theme toggle, mobile menu, copy, dialog close, search clear.

### 11.4 Badge

A badge is a compact, non-interactive label. It is never the only indicator of a state; adjacent text or the badge label itself carries the meaning.

#### VerdictBadge

| Verdict | `data-verdict` | Icon | Label | Background | Text |
|---|---|---|---|---|---|
| `POLICY_VIOLATION` | `POLICY_VIOLATION` | triangle-alert | **Policy violation** | `--sn-verdict-violation-bg` | `--sn-verdict-violation` |
| `POLICY_ADEQUATE_BUT_HARM` | `POLICY_ADEQUATE_BUT_HARM` | half-circle | **Policy gap** | `--sn-verdict-gap-bg` | `--sn-verdict-gap` |
| `INSUFFICIENT_EVIDENCE` | `INSUFFICIENT_EVIDENCE` | help-circle | **Insufficient evidence** | `--sn-verdict-neutral-bg` | `--sn-verdict-neutral` |
| `OUT_OF_SCOPE` | `OUT_OF_SCOPE` | slash-circle | **Out of scope** | `--sn-verdict-neutral-bg` | `--sn-verdict-neutral` |
| `DISMISSED` | `DISMISSED` | check-circle | **Dismissed** | `--sn-verdict-dismissed-bg` | `--sn-verdict-dismissed` |
| no verdict | `NONE` | dot | **No verdict yet** | `--sn-verdict-neutral-bg` | `--sn-verdict-neutral` |

- Padding `0.1875rem 0.5625rem`; pill radius; `font-size: 0.8125rem`; weight 650.
- Border `1px solid` the matching border token.
- Icon 14px; gap 6px; `aria-hidden`.
- The label is always visible. Do not use a tooltip as the label.
- `data-testid="verdict-badge"`; include `data-verdict` for tests.
- On dark, the same semantic mapping; tokens handle contrast.

#### StatusBadge

| Status | Label | Icon | Tone |
|---|---|---|---|
| `OPEN` | **Open** | circle-dot | neutral |
| `RESPONDED` | **Response filed** | message-square | neutral/accent |
| `DECIDED` | **Decided** | stamp | accent |
| `APPEALED` | **Appeal filed** | rotate-ccw | warn |
| `FINAL` | **Final** | lock | neutral strong |

- Never use “Pending” for incident status; “pending” is reserved for transaction status.
- `OPEN` does not mean “unanswered forever”; show the response deadline next to it when relevant.

#### ClaimBadge

| State | Label | Style | Help |
|---|---|---|---|
| Claimed | **Claimed** | outline accent, solid border | “Claimed by `0x…`. Claiming is not identity verification in v1.” |
| Unclaimed | **Unclaimed** | dashed neutral border | “No provider has claimed this system in the registry. Only a claimed provider can respond.” |

- Never use “Verified,” “Official,” or a checkmark for claim status.
- The badge may be a link to a help disclosure; if so, it is a button, not a badge. Prefer a separate help icon.

#### SyntheticBadge

- Text: **SYNTHETIC** (uppercase, 0.6875rem, weight 700, letter-spacing 0.08em).
- Dashed `--sn-border-strong`, `--sn-neutral-soft` background, `--sn-neutral` text.
- `title="Illustrative data — not a real incident."`
- Present on every synthetic record: list row, detail header, evidence block, embed, export, OG card if synthetic.
- Never dismissible. Never hidden by a filter without an explicit “Show synthetic” control (not in v1).

#### NetworkBadge

- Dot + network name (`StudioNet`, `Local`, `Bradbury`).
- Dot colors: green only if the app has a successful chain read in the current session; gray if unknown; amber if the wallet is on the wrong network.
- Text is always present. Do not use a dot alone.
- `data-testid="network-badge"`.

#### CountChip

- Used for counts (“3 cited,” “12 incidents”).
- `--sn-surface-2`, `--sn-border`, `--sn-muted`, 0.75rem, radius 4px.
- Not used for verdicts. A count is not a verdict.

### 11.5 SeverityMeter

- Renders 4 bars + a text label.
- Only for `POLICY_VIOLATION` and `POLICY_ADEQUATE_BUT_HARM`. For other verdicts, render nothing in compact contexts; in a table cell, render `—` with a visually hidden “Not applicable.”
- Bars: 4px wide, heights 8/11/14/17px, `--sn-border-strong` for off, `currentColor` for on.
- Colors: `LOW` → `--sn-neutral`; `MODERATE` → `--sn-warn`; `SERIOUS` → `--sn-danger`; `CRITICAL` → `--sn-danger`.
- Label: **Low**, **Moderate**, **Serious**, **Critical** (title case). Do not uppercase in running text.
- Wrapper `aria-label="Severity: Serious"`; bars `aria-hidden`.
- Do not show a numeric severity score. There is none.
- `data-testid="severity-meter"` + `data-severity`.

### 11.6 ConfidenceLabel

- Text: **Low confidence**, **Medium confidence**, **High confidence**.
- Optional 3-dot meter, but the text is mandatory.
- `LOW` gets a visible note on the incident page: “Low confidence — evidence was missing, unavailable, or contradictory.”
- Explain in `/about`: confidence reflects evidence completeness and consistency, not the strength of a model’s opinion and not a probability of guilt.
- Do not color confidence like a verdict. Use neutral text; low confidence may use a subtle warn icon, not red.
- `data-testid="confidence-label"`.

### 11.7 Card

- Surface, 1px border, radius 8px, padding 20px (16px on mobile), `--sn-shadow-sm`.
- `Card` is static. `CardLink` wraps a single link around the card only when the card contains no other interactive elements.
- If the card contains a copy button or secondary link, make the title a link and keep the card static.
- Hover on `CardLink`: border `--sn-border-strong`; no lift/translate.
- Focus: focus ring on the link, not the card.
- Do not nest cards more than one level. Use rules and spacing instead.

### 11.8 Stat

- Label: eyebrow style, `--sn-muted`.
- Value: display serif, 2rem, tabular; `—` if unknown.
- Hint: `0.8125rem`, `--sn-muted`, includes source/date or “Synthetic demo data.”
- Optional trend? **No.** No arrows, no deltas, no sparklines. A public record is not a growth dashboard.
- `aria-label`: “12 incidents filed, as of 2 Nov 2026” so the label/value/hint read as one phrase.
- `data-testid="stat"`.

### 11.9 Table

- Wrapper: `border: 1px solid var(--sn-border); border-radius: var(--sn-radius-md); background: var(--sn-surface); overflow-x: auto`.
- `<table>` with `<caption>` (visually hidden if the page heading already names it; captions are still required).
- Header cells: `scope="col"`, `0.75rem`, uppercase, letter-spacing 0.06em, `--sn-muted`, weight 600.
- Cells: `0.875rem`, padding `10px 12px`, `border-bottom: 1px solid var(--sn-rule)`.
- Last row: no bottom border.
- Hover row: `--sn-surface-2`.
- Numeric cells: right-aligned, tabular.
- Row link: the first cell contains the link; the row itself is not clickable. If the whole row should be clickable, use a real link in the first cell with a larger hit area via `::after`; ensure no other links in the row.
- Sortable headers: `<button>` inside `<th>` with `aria-sort` on the `<th>` (`ascending`/`descending`/`none`). Do not use clickable `<th>` alone.
- Empty: do not render an empty table; render `EmptyState`.
- Mobile: horizontal scroll inside the wrapper; wrapper `tabindex="0"`, `role="region"`, `aria-label="Systems table, scrollable"`. Do not hide columns without a “Show all” control.
- `data-testid="table"`.

### 11.10 Tabs

**Not used in v1.** Use sections with an in-page anchor nav for the provider console, and `<details>` for raw JSON/advanced help. Tabs hide content from print and from screen-reader browse mode, and add keyboard complexity for no benefit at this size.

### 11.11 Disclosure (`<details>`)

- Native `<details>`/`<summary>`; no custom JS unless animation requires it.
- Summary: 44px min height, 600 weight, chevron rotates 180° on open (`180ms`), focus ring.
- Content padding: `0.75rem 0 0 1.5rem`.
- Used for: raw JSON, “How to read a policy gap,” advanced evidence details, long hash help.
- Never used for the verdict, claim, response, evidence list, or disclaimer. Those are always visible.
- Print: raw JSON omitted; help content may remain closed (acceptable because it is not part of the record).

### 11.12 Dialog

- Native `<dialog>` with `showModal()`.
- Max width `520px`; width `calc(100% - 32px)`; padding `24px`; radius `--sn-radius-lg`; border; `--sn-shadow-md`.
- Backdrop: `rgb(0 0 0 / 0.48)`.
- Structure: title (`h2`), body, actions (secondary then primary). Close button top-right with `aria-label="Close dialog"`.
- Focus moves to the first focusable element or the title; Escape closes; focus returns to the trigger.
- No nested dialogs. No dialog that contains a form longer than 3 fields; use a page/section instead.
- Used for: confirm adjudication, confirm finalize, confirm claim, disconnect wallet? Disconnect can be immediate with an undo? No undo; confirm.
- `aria-labelledby` / `aria-describedby`; `data-testid="dialog"`.
- Do not use `alert()`/`confirm()`.

### 11.13 Form fields

- Label above the field, `0.875rem`, weight 600; required indicator `*` with a legend “* Required” at the top of the form.
- Help text below the label or field, `0.8125rem`, `--sn-muted`; linked via `aria-describedby`.
- Error text below the field, `0.8125rem`, `--sn-danger`, prefixed with an error icon; linked via `aria-describedby`; `aria-invalid="true"`.
- Input height: 44px; padding `0.625rem 0.75rem`; border `--sn-border-strong`; radius `--sn-radius-sm`; background `--sn-surface`.
- Focus: `outline: 2px solid var(--sn-focus); outline-offset: 0; border-color: var(--sn-focus)`.
- Disabled: `--sn-surface-2`, `--sn-muted`, `cursor: not-allowed`.
- Read-only: `--sn-surface-2`, selectable text.
- Textarea: min-height 140px (claim), 120px (defense), 100px (appeal reason); `resize: vertical`.
- Select: native `<select>`; custom chevron via background SVG or wrapper; do not build a custom select for simple choices.
- Checkbox/radio: 20×20, accent color, label clickable, description below; group in `<fieldset>` with `<legend>`.
- Placeholder is an example, never a label. Do not use placeholder for format instructions; use help text.
- Autocomplete: `off` for claim/defense/appeal reason; `url` for policy URL; `off` for hashes/versions.
- Spellcheck: `true` for claim/defense/reason; `false` for hashes/IDs/URLs.
- Error summary at the top of the form on submit: “There are 3 problems with this form,” list of links to fields. Focus the summary. Inline errors remain.

### 11.14 CharacterCounter

- Text: `1,240 / 2,000 characters`.
- Counts Unicode code points (`[...text].length`), matching Python `len` for the contract’s validation. Do not count UTF-16 code units.
- Normal state: `--sn-muted`. Near limit (≥ 90%): `--sn-warn`. Over: `--sn-danger`.
- `aria-live`: only announce at 20 characters remaining and when over the limit; do not announce every keystroke.
- Linked to the field via `aria-describedby`; visible at all times for bounded fields.
- `data-testid="char-counter"`.

### 11.15 Notice / Banner

| Variant | Icon | Background | Border | Use |
|---|---|---|---|---|
| Info | info | `--sn-surface-2` | `--sn-border` | Context, how-to, non-blocking |
| Warning | triangle-alert | `--sn-warn-soft` | `--sn-warn-border` | Permanence, late response, stale index |
| Error | circle-alert | `--sn-danger-soft` | `--sn-danger-border` | Failed load, failed tx, validation summary |
| Success | check-circle | `--sn-ok-soft` | `--sn-ok-border` | Accepted tx, copied, claimed |

- Structure: icon, title (600), body, optional action link/button.
- Border-radius `--sn-radius-md`; padding `12px 14px`; body `0.875rem`.
- `role="status"` for success/info; `role="alert"` for errors that appear after an action. Do not use `role="alert"` for a page that is already an error page (the heading is enough).
- Dismissible only for info/success; warning/error persist until resolved.
- Never use a toast for a transaction failure or a form error.
- `data-testid="notice"` + `data-variant`.

### 11.16 EmptyState

- Structure: optional 32px icon, title (`h3` or `p` strong), body (max 48ch), optional action.
- Centered within its section; dashed border only for a full-section empty state; plain text for a small inline empty.
- Copy is honest and specific: “No incidents match these filters.” Not “Nothing to see here!”
- Variants: no records, no matches, no gaps, no open incidents, not measured.
- `data-testid="empty-state"`.

### 11.17 ErrorState

- Title: what failed, in plain language.
- Body: why, and what to do now.
- Code: mono, small, `data-testid="error-code"`; show the contract reason code or client error kind, not a raw stack.
- Actions: “Try again,” “Go back,” “Read the error guide” (docs link), “Copy diagnostics” (only if a diagnostics bundle exists; never include secrets/evidence).
- Details: `<details>` “Technical details” with a sanitized message; no stack traces unless `--trace`/dev build.
- Page-level errors use `role="alert"` and focus the heading on mount. Section-level errors are inline notices.
- `data-testid="error-state"`.

### 11.18 Skeleton

- Shapes that match the final layout: list rows, detail header + 3 sections, stat cards.
- `aria-hidden="true"` on shapes; wrapper `aria-busy="true"` with a visually hidden “Loading…”.
- Background `--sn-surface-2`; radius matching the final element; optional pulse.
- Render a skeleton immediately; do not show a spinner for more than 400ms before a skeleton (`AGENTS.md` §23.3).
- No layout shift: reserve the same height as the loaded content within reason.
- `data-testid="skeleton"`.

### 11.19 TxProgress

The most important stateful component. It must never lie.

**Status union**

```ts
type TxStatus =
  | "PENDING"
  | "PROPOSING"
  | "COMMITTING"
  | "REVEALING"
  | "ACCEPTED"
  | "FINALIZED"
  | "UNDETERMINED"
  | "CANCELED"
  | "ERROR"; // client-only
```

**Step order:** `PENDING → PROPOSING → COMMITTING → REVEALING → ACCEPTED → FINALIZED`.

**Labels**

| Status | Visible label | Detail |
|---|---|---|
| `PENDING` | **Pending** | “Submitted. Waiting for the network.” |
| `PROPOSING` | **Proposing** | “The leader is executing the transaction.” |
| `COMMITTING` | **Committing** | “Validators are voting on the result.” |
| `REVEALING` | **Revealing** | “Votes are being revealed.” |
| `ACCEPTED` | **Accepted** | “Consensus reached. The finality window is open.” |
| `FINALIZED` | **Finalized** | “The record is final.” |
| `UNDETERMINED` | **Validators did not converge** | “No verdict was stored. The incident is unchanged.” |
| `CANCELED` | **Transaction cancelled** | “No record was written.” |
| `ERROR` | **Transaction failed** | “No record was written. Check the hash before retrying.” |

**Behavior**

- Steps before the current one are marked done; the current step is active; later steps are upcoming.
- If the network skips `REVEALING`, mark it done when `ACCEPTED` arrives; do not leave a stuck step.
- On terminal failure, mark the first step failed and show the explanation; do not show a success check.
- Show elapsed time from the first event, e.g. `12.4s`; update once per second while waiting; stop on terminal.
- Show the tx hash as soon as it exists; link to the explorer only if the explorer URL is known. Otherwise show “Hash: 0x… [copy].”
- Show “Still waiting…” after 60s; show a timeout notice after 180s (StudioNet) / 600s (testnets) with “Check status” and the hash. Do not auto-resubmit.
- `role="status"`, `aria-live="polite"`; announce only status changes, not the elapsed counter.
- On `ACCEPTED`, the UI may show the new verdict with the label **“Accepted — awaiting finality”** and the appeal window. It must not label it “Final” until `FINALIZED`.
- On `UNDETERMINED`, do not show a verdict. Offer “Try adjudication again” only if the incident is still eligible; explain that repeated failure may mean ambiguous evidence.
- `data-testid="tx-progress"` + `data-status`.

**Copy for the confirmation dialog before a write**

> This submits a transaction to the {network} network. Independent validators review the pinned evidence against the pinned policy. **You are not deciding the verdict.** The record is public and permanent.

For `finalize`:

> This marks the record final after the appeal window. It does not change the verdict.

For `appeal`:

> This starts a new adjudication round with a larger validator set. The current verdict stays in the record.

### 11.20 Hash and Address

**Hash**

- Props: `label`, `value` (full `sha256:...`), `short` (optional), `copyable` (default true), `className`.
- Display: `<code>` with short value; `title` full; copy button with `aria-label="Copy {label}"`; after copy, check icon + “Copied” for 2s.
- If the value is malformed, show it as `Invalid hash` with the raw value in a `<details>`; do not pretend it is a hash.
- `data-testid="hash"`.

**Address**

- Same pattern; short `0xAb12…77Ef`; optional `label` (“Reporter,” “Provider,” “Claimed by”).
- Do not link to an explorer unless ground truth provides one.
- `data-testid="address"`.

**Copy behavior:** `navigator.clipboard.writeText` with a fallback that selects the text and shows “Press Ctrl/Cmd+C to copy.” Announce success via a visually hidden polite live region. Never copy a private key (none exist in the app).

### 11.21 EvidenceItem

- Card per item, `data-testid="evidence-item"`, `data-evidence-id`.
- Header: `e1` mono, kind badge **Inline** / **URL**, optional status badges **Unavailable at adjudication** / **Hash mismatch at adjudication** (only if the data says so).
- Note: human note, `0.8125rem`, `--sn-muted`; never used in adjudication; label it “Note (not used in adjudication).”
- Inline: `<pre>` or `<div>` with `white-space: pre-wrap`, max-height 320px with “Expand”; warning “Inline evidence is public and permanent.”
- URL: host + full URL as an external link (only if `https:`); hash; “This page does not fetch the URL. Validators do.” Do not render remote content.
- Footer: `contentSha256`, `maxChars`, optional `retrievedAt`.
- If the manifest is invalid/unreadable, show an error state with the evidence hash; do not render raw JSON as if it were evidence.
- `data-testid="evidence-item"`.

### 11.22 ClauseCard

- Header: clause ID (mono), title, `Mandatory` badge if verified, `Cited` badge if in the verdict.
- Body: verified clause text as plain paragraphs. If unverified, the fallback from §8.5.
- Footer: “Policy v1.2.0” link to `/systems/:id#policy-1.2.0`; hash copy.
- Cited cards use `--sn-verdict-gap-bg` at low intensity? No: use a left border `3px solid var(--sn-warn)` + “Cited” badge, not a full amber background. Amber is reserved for the gap verdict; overuse dilutes it.
- `data-testid="clause-card"`, `data-clause-id`, `data-cited="true|false"`.

### 11.23 VerdictSummary

- Top: verdict badge, severity (if applicable), confidence, round, ruled date.
- Rationale: templated text from the contract; render as a paragraph, not a quote. Never label it “AI explanation.”
- Clause chips: “C1,” “C3” with links to the clause cards; if no clauses, “No clause cited.”
- Evidence: “3 items considered · 1 unavailable” only if the data supports it; otherwise “Evidence hash …” and a link to the evidence section.
- Footer: trust note (§11.24) and “How to read this verdict” link to `/about#verdicts`.
- No verdict: “No verdict yet” + status + what happens next (“Adjudication opens after the response deadline on …” or “Adjudication can be requested now”).
- `data-testid="verdict-summary"`.

### 11.24 TrustNote

**Short variant (lists, home, footers):**

> Policy compliance findings, not legal determinations. [Read the trust boundary →]

**Verdict-page variant (must be verbatim, `AGENTS.md` §34.3):**

> SafetyNet publishes policy compliance findings produced by independent validators against a provider's own published policy. A finding is not a legal determination, not an assessment of liability, and not a statement that an AI system is safe or unsafe in general. Evidence is supplied by reporters and is not independently authenticated. Always consult the original sources and the cited policy version.

- The full disclaimer appears on `/about` and on every incident page that has a verdict, adjacent to the verdict summary and again in the page footer.
- `data-testid="trust-note"` and `data-testid="legal-disclaimer"` on the verbatim block.
- Never collapse the disclaimer into a tooltip.

### 11.25 PolicyVersionTable

- Columns: Version, Effective, Published, Clauses, Hash, Source, Supersedes.
- Current version row: `Current` badge; no sorting by default (versions chronological, newest first).
- Hash: `Hash` component, short form.
- Source: external link with host; if missing, “Not provided.”
- Supersedes: version string or “—.”
- No edit/delete actions. A provider publishes a new version; the table only grows.
- `data-testid="policy-version-table"`.

### 11.26 IncidentRow / IncidentCard

- A list item, not a full table row, for `/incidents`:
  - Line 1: system display name (strong) + verdict badge.
  - Line 2: incident ID (mono), status badge, synthetic badge.
  - Line 3: filed/decided date, clause count, confidence (if verdict).
  - No claim text, no evidence text, no reporter address.
- Whole card is a link to the incident; no nested links. If a status badge needs help, use a separate info link outside the card link or omit.
- Hover: border strong; focus ring on the card link.
- `data-testid="incident-row"` + `data-incident-id`.

### 11.27 FilterBar

- Desktop: a row with search (flex 1), system select, verdict select, severity select, status select, sort select, “Clear all” link.
- Mobile: a `<details>` “Filters” summary with the controls stacked; active filter count in the summary (“Filters (2)”).
- Search input: label “Search incidents,” placeholder “Incident ID, system, or clause”; debounce 250ms; do not search claim text (not in the index).
- Selects: visible labels (not placeholder-only); “All systems,” “All verdicts,” etc.
- Active filters: chips below the bar with an “×” button each; “Clear all.”
- Result summary: “24 incidents · filtered by Policy gap” in `aria-live="polite"`.
- URL sync per §4.2; no full page reload.
- `data-testid="filter-bar"`.

### 11.28 Pagination

- Previous / Next buttons + “Page 2 of 7” text; optional page-number buttons for ≤ 7 pages.
- 44px targets; disabled at ends with `aria-disabled` and no dead link.
- Updates `page` in the URL; scrolls the results heading into view; announces “Page 2 of 7.”
- No infinite scroll. No “Load more” that hides content from the URL.
- `data-testid="pagination"`.

### 11.29 Timeline

- Ordered list (`<ol>`) with a vertical rule; each item has a dot, label, date, and body.
- Verdict entries: round number, verdict badge, severity/confidence, clauses, rationale link.
- Appeal entries: “Appeal to round 2,” appellant (short address), reason, prior verdict.
- Current round: `aria-current="step"` and a subtle accent rule; not color alone (“Current” label).
- No animation on load.
- `data-testid="timeline"`.

### 11.30 CopyButton

- Icon button with `aria-label="Copy …"`; 44px target; `title` optional.
- On success: icon changes to check, label becomes “Copied” for 2s; a visually hidden polite live region announces “Copied.”
- On failure: show a small inline message “Copy failed — select the text and copy manually.” Do not silently fail.
- Never copies claim/evidence text; only hashes, addresses, IDs, URLs, and JSON the user explicitly opened.

### 11.31 SystemPicker

An accessible combobox for choosing a system in `/report`, `/provider` claim, and publish policy.

- Input: label “AI system”; placeholder “Search by name or system ID.”
- Listbox: `role="listbox"`, options `role="option"` with `aria-selected`; show display name, system ID (mono), claim badge, current policy version.
- Keyboard: ArrowDown/Up moves the active option; Enter selects; Escape closes; Tab closes and moves to the next field; type-ahead filters.
- `aria-expanded`, `aria-controls`, `aria-activedescendant`; announce the number of results.
- No results: “No system matches. Systems are registered through the CLI in v1.” (Unless `O-04` changes.)
- Selected state: a compact selected card below the input with “Change” button.
- `data-testid="system-picker"`.

### 11.32 StepIndicator

- Steps: **System, Claim, Evidence, Review, Submit**.
- Current step: `aria-current="step"`, accent number/dot, bold label.
- Completed: check icon + link back (clickable); upcoming: muted, not clickable.
- Mobile: “Step 3 of 5 — Evidence” with a progress rule; do not squeeze five labels into 320px.
- Not a tablist. Do not use `role="tab"`.
- `data-testid="step-indicator"`.

### 11.33 WalletButton

- States:
  - **No provider:** button “Connect wallet” disabled? No: show a button that opens a notice “No browser wallet found. Install a wallet that supports EIP-1193.” Link to a neutral explainer, not a specific vendor.
  - **Disconnected:** “Connect wallet.”
  - **Connecting:** “Connecting…” + spinner; disabled.
  - **Connected:** `0xAb12…77Ef` with chevron; menu: “Copy address,” “Disconnect.”
  - **Wrong network:** `0xAb12…77Ef` + amber dot; banner elsewhere; writes disabled.
- Never request a private key, seed phrase, or signature that is not a transaction.
- Session-only connection; do not store the address in localStorage.
- `data-testid="wallet-button"`.

### 11.34 NetworkMismatchBanner

- Appears when a wallet is connected to a chain other than the app’s configured chain.
- Copy: “Wrong network. SafetyNet is on **StudioNet**. Your wallet is on **{chainName}**.”
- Action: “Switch network” if `wallet_switchEthereumChain` is available; otherwise “How to switch” opens a help disclosure with the chain ID and RPC URL from ground truth.
- Writes are disabled until the network matches. Reads continue.
- Do not auto-switch the user’s wallet without a click.
- `data-testid="network-mismatch"`.

### 11.35 FreshnessNote

- “Index updated **2 Nov 2026, 10:14 UTC** (3 hours ago).”
- If the index is older than 24h: warning tone + “Detail pages still read the live chain.”
- If the timestamp is missing/invalid: “Index freshness unknown. Detail pages read the live chain.”
- If the index failed to load: do not render a freshness note; render `ErrorState`.
- `data-testid="freshness-note"`.

### 11.36 ProviderBadge

- Alias of `ClaimBadge`, used on system pages and incident headers.
- Always accompanied by a help link: “What does claimed mean?” → `/about#claiming`.
- Never “verified.”

### 11.37 Other primitives

These are small and may live in `components/primitives/`:

| Primitive | Notes |
|---|---|
| `PageHeader` | Eyebrow, h1, lede, actions; consistent spacing |
| `Breadcrumbs` | `<nav aria-label="Breadcrumb">`, `<ol>`, current page text not a link |
| `Section` | `<section aria-labelledby>` with h2 and optional action |
| `Prose` | Max 68ch wrapper; no global styles leakage |
| `SearchInput` | Label + input + clear button; 250ms debounce |
| `Select` | Native select + label + help/error |
| `TextField` / `Textarea` | Label, help, error, counter slot |
| `Checkbox` | Native input + label + description |
| `RadioGroup` | Fieldset/legend + native radios |
| `ErrorSummary` | Focusable summary with links to fields |
| `InlineCode` | Mono, surface-2, radius 3 |
| `Kbd` | Keyboard hint; mono; border |
| `Spinner` | 16px, only inside a button; `aria-hidden`; text label outside |
| `VisuallyHidden` | Standard sr-only utility |
| `SkipLink` | First focusable element; jumps to `#main` |

## 12. PAGE SPECIFICATIONS

### 12.1 Home (`/`)

**Purpose:** explain the product in ten seconds, prove the record is alive, and route readers to incidents, gaps, and the report flow.

**Data:** published index. In demo mode, the local store. No wallet.

**Layout (in order — do not reorder without owner approval):**

1. **Hero**
   - Eyebrow: “The public record.”
   - H1: **The public record of AI harm.**
   - Lede (max 60ch): “Report an AI safety incident with evidence. The AI provider answers. GenLayer validators decide whether the system violated its own published safety policy. Every verdict is permanent, queryable, and free to check.”
   - Actions: primary **Report an incident** → `/report`; secondary **Browse the record** → `/incidents`.
   - If demo: `SyntheticBadge` + “Demo data — synthetic” above the H1.
   - No hero image. A single hairline rule below the hero, full content width.
2. **Headline numbers** — three `Stat` cards:
   - Incidents filed
   - Verdicts reached
   - Policy gaps found
   - Hints include the source/date: “Published index · 2 Nov 2026” or “Synthetic demo data.” If the index is unavailable, each value is `—` and a single inline `ErrorState` explains that the index could not be loaded. Never show `0` for an unavailable index.
3. **Latest verdicts** — up to 5, sorted by `ruled_at` descending; `IncidentRow` compact. Section link “All incidents →.” Empty: “No verdicts yet. File the first incident.” with link.
4. **Policy gaps teaser** — up to 3 groups, each with system name, clause ID/title, count, and a link to `/policy-gaps`. Empty: “No policy gaps recorded yet.” with link to the explainer.
5. **How it works** — four steps, numbered, plain text:
   1. **File** — “Pin the evidence hashes and the exact policy version.”
   2. **Respond** — “The claimed provider can file a response. Silence is not a finding.”
   3. **Adjudicate** — “Anyone can request adjudication. Independent validators decide.”
   4. **Appeal** — “The reporter or provider can request one larger round within the window.”
6. **Trust note** — short disclaimer + link to `/about#trust-boundary`.

**Rules:** no claim text, no evidence text, no provider ranking, no carousel, no auto-rotating content. The page must be useful with JavaScript disabled only to the extent the static shell renders; the data is client-fetched, so show a meaningful loading/error state, not a blank page.

**Test IDs:** `page-home`, `home-hero`, `home-stats`, `home-latest`, `home-gaps`, `home-how`, `home-trust`.

### 12.2 Incidents (`/incidents`)

**Purpose:** the public, searchable record of every incident and verdict.

**Data:** published index. No wallet.

**Layout:**

1. `PageHeader`: eyebrow “The record”; H1 **Incidents**; lede “Every filed incident, its status, and its policy compliance verdict.” Right-side action: **Report an incident**.
2. `FreshnessNote` for the index.
3. `FilterBar`:
   - Search: “Search incident ID, system, or clause.”
   - System select (from index systems).
   - Verdict select (five verdicts + “No verdict yet”).
   - Severity select (disabled when the verdict filter is a non-severity verdict; see below).
   - Status select.
   - Date range: “All time,” “Last 30 days,” “Last 90 days” (`range=30d|90d|all`; default `all`).
   - Sort: “Newest filed” (default), “Recently decided,” “Severity.”
   - “Clear all” link when any filter is active.
4. **Result summary** in a polite live region: “24 incidents · filtered by Policy gap.” Include the active filters in plain words, not raw enums.
5. **Incident list**: a `Table` at ≥ 768px and `IncidentRow` cards below 768px, from the same data (§19.3), 25 per page. Each row shows system name, verdict badge, incident ID, status, filed/decided date, clause count, confidence, and `SYNTHETIC` when applicable. No claim text.
6. `Pagination`.
7. `TrustNote` short.

**Filter semantics**

- All filters combine with AND.
- `q` matches incident ID, system display name, system ID, clause IDs, and the verdict label; case-insensitive substring; trim; max 80 characters. It does **not** search claim text or evidence text.
- `severity` only applies to `POLICY_VIOLATION` and `POLICY_ADEQUATE_BUT_HARM`. When the verdict filter is `DISMISSED`, `INSUFFICIENT_EVIDENCE`, or `OUT_OF_SCOPE`, disable the severity select, remove `severity` from the URL, and show the helper “Severity applies to policy violations and policy gaps.”
- `range` filters on `filed_at`; “Recently decided” sort uses `ruled_at`.
- Sort tie-breakers: `newest` → `filed_at` desc, then incident ID desc; `decided` → `ruled_at` desc (undecided last), then incident ID desc; `severity` → `CRITICAL` → `LOW`, non-severity verdicts last, then `ruled_at` desc.
- Changing any filter resets `page` to 1 and uses `replaceState`; do not add a history entry per keystroke. Pagination uses `pushState`.

**States**

| State | What renders |
|---|---|
| Loading | Header + filter skeleton + 5 row skeletons |
| Empty (no incidents at all) | “No incidents yet.” + “File the first incident” |
| Empty (filters) | “No incidents match these filters.” + “Clear filters” |
| Error (index) | `ErrorState`: “The published index could not be loaded.” + retry; no fake rows |
| Partial | If the index has incidents but a system name is missing, show the system ID mono; do not hide the row |
| Demo | Global demo banner + `SYNTHETIC` on every row |

**Test IDs:** `page-incidents`, `filter-bar`, `result-summary`, `incident-list-table`, `incident-list-cards`, `incident-row`, `pagination`, `incidents-empty`, `incidents-error`.

### 12.3 Incident detail (`/incidents/:incidentId`)

**Purpose:** the complete public record for one incident: what was claimed, what the provider said, what evidence was pinned, what validators decided, what it does not prove, and what can happen next.

**Data:** live chain for the incident, response, verdict, appeals, history, policy, and config. The published index supplies the system display name and a fallback summary. Chain wins on conflict; if the index disagrees, show a stale-index notice.

**Layout (desktop ≥ 1024px):**

```text
Breadcrumb: Incidents / inc-000001
┌──────────────────────────────────────────────┬──────────────────────┐
│ Eyebrow: Incident record · inc-000001        │ Actions              │
│ H1: System display name                      │ Record details       │
│ Verdict badge · severity · confidence · date │ Integrity check      │
│ Policy v1.0.0 · round 1 · status             │ Related links        │
├──────────────────────────────────────────────┤                      │
│ Verdict summary                              │                      │
│ Cited clauses                                │                      │
│ Claim                                        │                      │
│ Provider response                            │                      │
│ Evidence                                     │                      │
│ Policy version                               │                      │
│ Appeal history                               │                      │
│ Raw record                                   │                      │
├──────────────────────────────────────────────┴──────────────────────┤
│ Full legal disclaimer + trust boundary link                        │
└─────────────────────────────────────────────────────────────────────┘
```

**Header**

- Breadcrumb: “Incidents” link → `/incidents`; current `inc-000001` as text.
- Eyebrow: `Incident record · inc-000001`.
- H1: system display name (link to `/systems/:id`).
- Badge row: `VerdictBadge` (or “No verdict yet”), `SeverityMeter` only for violation/gap, `ConfidenceLabel`, `StatusBadge`, `SyntheticBadge`.
- Meta line: “Policy v1.0.0 · filed 2 Nov 2026, 10:14 UTC · round 1 of 2 · 0 appeals.”
- If the provider is unclaimed: `ClaimBadge` “Unclaimed” + help link.
- If the incident is synthetic: `SyntheticBadge` + “Illustrative data — not a real incident.”

**Rail — Actions**

Render only what the connected user can do, and always explain why an action is unavailable.

| Incident state | Condition | Action | Who |
|---|---|---|---|
| `OPEN` | Before `response_deadline` | No adjudication yet; show “Response window closes …” | — |
| `OPEN` | At/after deadline | **Run adjudication** | Anyone with a wallet |
| `OPEN` | Connected address is the claimed provider | **Respond as provider** (link to form) | Claimed provider |
| `RESPONDED` | — | **Run adjudication** | Anyone with a wallet |
| `DECIDED` | Appeal window open, appeals < max | **Appeal this verdict** | Reporter or claimed provider |
| `DECIDED` | Appeal window closed | **Finalize record** | Anyone with a wallet |
| `APPEALED` | — | **Run adjudication** (next round) | Anyone with a wallet |
| `FINAL` | — | No action; “This record is final.” | — |

- If the wallet is disconnected, the action button is present but opens the wallet connect flow; copy: “Connect a wallet to submit this transaction.”
- If the wallet is on the wrong network, disable the action and show the network mismatch banner.
- If the connected address is not eligible for appeal, show the reason: “Only the reporter or claimed provider can appeal this verdict.” Do not show a disabled button without an explanation.
- If the provider is unclaimed, response is impossible; show “No provider has claimed this system, so no response can be filed.” Do not imply the provider refused.

**Rail — Record details**

A `<dl>` with:

- System (link)
- Policy version (link to `/systems/:id#policy-<version>`)
- Reporter (`Address`, short)
- Filed (`<time>`)
- Response deadline (`<time>` + “estimated” if the chain clock is unavailable)
- Status
- Evidence hash (`Hash`, copy)
- Policy hash (`Hash`, copy)
- Verdict round / appeals
- Synthetic (yes/no)

**Rail — Integrity check**

A client-side hash consistency panel, clearly labeled as such:

- Evidence: verdict `evidence_hash` vs incident `evidence_hash` → “Match” / “Mismatch.”
- Policy: verdict `policy_hash` vs incident `policy_hash` vs policy record `text_hash` → “Match” / “Mismatch.”
- If a check cannot run (missing verdict/policy), show “Not available yet” — not a pass.
- If any mismatch: warning notice “Hash mismatch. Do not rely on this page until it is resolved.” + link to the evidence/policy section + a report-a-problem link. Do not disable reading; do disable writes.
- Label: “Hash consistency check (client-side). This verifies that the record fields agree; it does not authenticate the evidence.”

**Main — Verdict summary**

- `VerdictSummary` per §11.23.
- For `POLICY_VIOLATION`: “The evidence shows the system’s output violated a cited clause of its published policy.”
- For `POLICY_ADEQUATE_BUT_HARM`: “The output was within the provider’s published policy, yet harm occurred. This is a policy gap.”
- For `INSUFFICIENT_EVIDENCE`: “The evidence was missing, unverifiable, or contradictory. This is a valid outcome, not a penalty.”
- For `OUT_OF_SCOPE`: “The claim does not concern the system’s published safety policy.”
- For `DISMISSED`: “The evidence did not support a policy violation.”
- No verdict: “No verdict yet.” + what happens next.
- Always show the full trust note adjacent, not only at the bottom.

**Main — Cited clauses**

- H2 “Cited clauses” + count.
- `ClauseCard` for each cited clause, sorted by clause ID.
- Each card shows the verified clause text or the fallback (§8.5), the `Mandatory` badge only if verified, and a “Cited” badge.
- If the verdict cites no clauses: “No clause cited.” For `OUT_OF_SCOPE`/`INSUFFICIENT_EVIDENCE`, this is expected; explain in one sentence.
- A link “View all policy versions” → `/systems/:id#policies`.

**Main — Claim**

- H2 “Claim.”
- Sub-label: “As filed by the reporter.”
- Full claim text, `pre-wrap`, max 68ch.
- A note: “This text is public and permanent.” Do not editorialize on its truth.
- If the claim contains likely PII, do not redact; show the redaction-policy link in the page footer. (The filing UI warned; the record is permanent.)

**Main — Provider response**

- H2 “Provider response.”
- If present: provider address, responded date, `Late` badge if the response was after the deadline, full defense text, optional response evidence.
- If absent: “No provider response filed.” + “A missing response is a fact about the record, not a finding.” + the response deadline.
- If the system is unclaimed: “No provider has claimed this system, so no response can be filed.” + claim help.
- Never say “ignored,” “refused,” or “silent.”

**Main — Evidence**

- H2 “Evidence” + item count + manifest hash.
- `EvidenceItem` for each item in manifest order.
- Inline evidence: public/permanent warning; full text or expandable if long.
- URL evidence: host, URL, hash, “not fetched by this page,” optional unavailable/tampered badge.
- If the manifest is malformed: `ErrorState` with the evidence hash; do not render raw as evidence.
- If there is no evidence (should not happen for a valid incident): “No evidence items.” + hash, and a warning that this is unexpected.

**Main — Policy version**

- H2 “Policy version.”
- Version, effective date, published date, clause count, pinned hash, source URL, supersedes.
- `PolicyVersionTable` may be used if multiple versions are relevant; otherwise a compact `<dl>`.
- If the policy source cannot be verified: the fallback notice from §8.5.
- Link to `/systems/:id#policy-<version>`.

**Main — Appeal history**

- H2 “Appeal history.”
- If none: “No appeals filed.” + the appeal window close date if decided.
- If present: `Timeline` with each round and appeal. The current verdict is labeled “Current”; prior verdicts remain visible. Never show only the latest.
- If history is unavailable but an appeal exists, show the current verdict + appeal records with a notice “Full round history could not be loaded.”

**Main — Raw record**

- `<details>` “Raw record (JSON)” with the incident, response, verdict, and appeals. Copy button. Not printed by default.
- If the JSON is large, max-height 420px with scroll.

**Page footer**

- Full legal disclaimer (verbatim) + trust boundary link + “Request a display-layer redaction” link + “Report a problem with this page” link (GitHub issue template; no on-chain deletion).

**States**

| State | What renders |
|---|---|
| Loading | Header skeleton + rail skeleton + section skeletons; no blank page |
| Not found (chain + index) | 404 page with ID format help |
| Chain unavailable, index available | Header + verdict summary from index + “Live record unavailable” error; hide claim/evidence/response (not in index); disable actions |
| Index stale vs chain | Chain wins; notice “The published index is out of date for this record. Showing the live chain.” |
| No verdict | Header + status + actions/eligibility + claim/response/evidence; no empty verdict card |
| Policy unverifiable | Clause IDs + fallback; no unverified text |
| Integrity mismatch | Warning; reads allowed; writes disabled |

**Test IDs:** `page-incident`, `incident-header`, `incident-verdict`, `incident-actions`, `record-details`, `integrity-check`, `cited-clauses`, `claim-text`, `provider-response`, `evidence-section`, `policy-section`, `policy-unverified`, `appeal-history`, `raw-record`, `legal-disclaimer`.

### 12.4 Report (`/report`)

**Purpose:** file a precise, bounded incident with pinned evidence and a specific policy version, while making permanence and PII risk impossible to miss.

**Data:** index for system/policy selection; live `get_config` for caps/window; live chain for submit. Wallet required only at step 5.

**Layout:** single column max 720px; `PageHeader`; `StepIndicator`; form; a review summary card that is visible on step 4 and repeated above the submit button. On desktop ≥ 1024, a right rail may show “What you will need” and “Permanence” notes; on mobile they stack above the form.

**Entry:** `/report` or `/report?system=synthetic-chatbot-1`. If `system` is present and valid, preselect it and its current policy version; still show step 1 for confirmation. If invalid, show “That system isn’t in the index” and allow search.

**Step 1 — System and policy**

- `SystemPicker` (searchable; name/ID; claim badge; current policy).
- Policy version select for the selected system; show effective date, clause count, pinned hash (short + copy).
- A notice: “This incident will be judged against this policy version. Later versions do not apply retroactively.”
- If unclaimed: `ClaimBadge` “Unclaimed” + “No provider has claimed this system. A response may not be filed. The incident can still be adjudicated.”
- Continue disabled until a system and version are selected.
- Link: “Not in the registry? Systems are registered through the CLI in v1.” (unless `O-04` changes).

**Step 2 — Claim**

- Label “What happened?”
- Help: “Describe the system’s behavior and the clause you believe it contradicts. 20–2,000 characters.”
- Textarea, 8 rows, `pre-wrap`, spellcheck on.
- `CharacterCounter`.
- PII warning (always visible): “Remove names, emails, phone numbers, handles, and addresses unless they are necessary to understand the claim.”
- If likely PII is detected (email, phone, @handle, or a personal name pattern is too unreliable — do not guess names), show a warning and a required checkbox: “This information is necessary to understand the claim.” The submit path is blocked until checked. Do not auto-redact.
- “Good claim” example in a disclosure:
  > “The assistant gave a specific prescription dosage despite clause C1, which forbids dosage instructions. The transcript is attached as inline evidence.”
- “Avoid” example:
  > “This company is dangerous and should be shut down.”
  > Explanation: “Describe the system’s behavior and cite a clause. The record is not a place for general allegations.”
- Continue disabled until 20–2,000 code points.

**Step 3 — Evidence**

- At least one item required. Max items from `get_config.max_evidence_items` (default 8); max bytes from `max_evidence_bytes` (default 20,000); show “3 of 8 items · 4,120 of 20,000 bytes.”
- Add item: **Inline text** or **URL**.
- Each item card:
  - ID auto-assigned `e1`, `e2`, …; not user-editable.
  - Kind badge.
  - **Inline:** textarea (max 2,000 chars), live `contentSha256`, `maxChars` (200–8,000; default 2,000), optional note (≤ 300 chars). Warning: “Inline evidence is public and permanent.”
  - **URL:** URL input (`https`, ≤ 300 chars, allowlist), “Captured text” textarea (the exact text the reporter saw; hashed locally, **not submitted**), live `contentSha256`, `maxChars` (default 4,000), optional note. Warning: “Validators will fetch this URL. If the page changes or disappears, the evidence may be marked unavailable or tampered.”
  - Remove item button (with confirm if it has content).
  - “Move up/down” optional; manifest order is display order. If not implemented, state that order is the order added.
- Allowlist check is client-side for immediate feedback; the contract is authoritative. Show the allowed hosts in a disclosure.
- Do not fetch the URL from the browser. The app hashes the captured text only.
- If the URL is valid but `contentSha256` is missing, block “Continue” with “Add the captured text so the evidence can be pinned.”
- If total bytes exceed the cap, show the overage and block.
- `[OPEN] O-01`: the exact hash basis for URL evidence must match the contract’s fetch/normalization. Until resolved, the UI labels captured-text hashes as “hash of captured text” and warns that a mismatch may downgrade confidence.

**Step 4 — Review**

- Summary:
  - System + policy version + pinned policy hash.
  - Claim (full text).
  - Evidence items (IDs, kinds, hashes, notes; inline text preview).
  - Canonical manifest JSON in a `<details>` (pretty-printed; copy button).
  - Evidence hash (full manifest hash) — this is the value submitted.
  - Caps: items/bytes within limits.
- Required checkbox: **“I understand this is public and permanent.”**
- Required checkbox if PII warning was triggered: “This information is necessary to understand the claim.”
- A warning: “Once submitted, this record cannot be edited or deleted.”
- “Back” and “Continue to submit.”

**Step 5 — Submit**

- Wallet gate: if disconnected, show `WalletButton` and a short explanation; do not lose form state.
- Network mismatch: banner; submit disabled.
- Summary of the transaction: method `file_incident`, system, policy version, evidence hash, claim hash (not full claim), network, contract address.
- Confirmation checkbox is already on step 4; the submit button is the final action. No extra modal unless the user has not connected a wallet.
- Submit button: **Submit incident report**.
- On submit: build the canonical manifest with the shared core helper, compute the evidence hash, validate again, call `file_incident`, show `TxProgress`.
- On `ACCEPTED`: navigate to `/incidents/:id` using the returned incident ID. Announce “Incident filed.” If the ID is unavailable, go to `/incidents` and show the tx hash.
- On `UNDETERMINED`/`CANCELED`/`ERROR`: stay on step 5; show the failure; keep the form data; explain that no record was written. On timeout, show the hash and “Check the transaction before retrying.”
- On wallet rejection: inline notice “You cancelled the signature. No record was written.” Stay on step 5.
- In demo mode: no wallet; the submit button says **Submit incident report (demo)**; on success, show “Simulated in demo mode — no transaction was sent.” and navigate to the local incident. The global demo banner remains.

**Navigation and drafts**

- Back/forward between steps preserves in-memory state.
- No localStorage draft (v1 stores only the theme). Warn on page unload/refresh if the form has content: `beforeunload` with the browser’s generic prompt. Do not use a custom modal for unload.
- Leaving via a nav link while the form is dirty opens a confirm dialog: “Discard this report?” / “Keep editing.”
- If the index/policy changes while the form is open, do not silently switch the pinned version. On step 4, re-read the policy and compare hashes; if changed, show “The policy changed while you were filing. Review the pinned version before submitting.” Block submit until re-confirmed.

**States:** loading (system/config), index error, no systems, policy list empty, validation errors, wallet missing, wrong network, submitting, undetermined, timeout, accepted, demo.

**Test IDs:** `page-report`, `step-indicator`, `report-step-system`, `system-picker`, `policy-version-select`, `report-step-claim`, `claim-input`, `pii-warning`, `report-step-evidence`, `evidence-editor`, `evidence-item-editor`, `report-step-review`, `manifest-preview`, `evidence-hash`, `permanence-checkbox`, `report-step-submit`, `tx-progress`.

### 12.5 Systems (`/systems`)

**Purpose:** the registry of AI systems with claim status, policy versions, and incident counts — no ranking, no score.

**Data:** published index. No wallet.

**Layout:**

1. `PageHeader`: eyebrow “Registry”; H1 **AI systems**; lede “Every system in the registry, its published policy versions, and its incident record.” Action: “Report an incident.”
2. `FreshnessNote`.
3. Toolbar: search (“Search by name, system ID, or provider”), claim filter (“All,” “Claimed,” “Unclaimed”).
4. Table:
   - **System** (display name + system ID mono; link)
   - **Provider** (provider ID)
   - **Claim** (`ClaimBadge`)
   - **Policy versions** (count + current version)
   - **Incidents** (count)
   - **Policy gaps** (count)
   - **Latest activity** (date)
5. Pagination (25 per page).
6. `TrustNote` short.

**Rules**

- No “trust score,” “risk score,” “safety rating,” or stars.
- Claim counts are facts; they are not a ranking. Default sort: system name A–Z. Sort options: name, incidents (desc), latest activity (desc). If sorted by incidents, label the column and state the sample; do not call it “most unsafe.”
- “Claimed” is not “verified.” The help link explains.
- Empty: “No systems in the registry yet.” + CLI registration note.
- No matches: “No systems match this search.” + clear.
- Error: `ErrorState` for the index; no fake rows.
- Mobile: the table is replaced by cards from the same data (§19.3). Never drop the claim, policy, or incident fields — they move into the card body.

**Test IDs:** `page-systems`, `systems-search`, `claim-filter`, `systems-table`, `systems-cards`, `system-row`, `systems-empty`.

### 12.6 System detail (`/systems/:systemId`)

**Purpose:** everything a reader needs about one system’s published policies and incident record.

**Data:** live chain for system/policies; index for incident counts and list; live for individual incidents.

**Layout:**

1. Breadcrumb: Systems / system ID.
2. Header:
   - Eyebrow: “System record · synthetic-chatbot-1.”
   - H1: display name.
   - Meta: provider ID, `ClaimBadge`, `SyntheticBadge` if demo, created date.
   - Actions: **Report an incident about this system** → `/report?system=...`; **Provider console** → `/provider` (for claimed systems, label “Provider console”; for unclaimed, “Claim this system”).
   - If unclaimed: notice “No provider has claimed this system in the registry. Only a claimed provider can respond. Claiming is first-come in v1 and is not identity verification.”
3. **Policy versions** (`#policies`):
   - `PolicyVersionTable`.
   - Current version highlighted.
   - Each version: effective/published dates, clause count, hash, source URL, supersedes.
   - Expandable clause list for the current version if the text can be verified (§8.5); otherwise show IDs and the fallback.
   - No edit/delete. Link “Publish a new version” → `/provider?system=...` for the claimed provider.
4. **Incident record**:
   - Distribution bars by verdict, with labels, icons, counts, and percentages (denominator = decided incidents). No chart library; CSS bars.
   - Counts: incidents filed, decided, no verdict yet, policy gaps.
   - A table/list of the latest 10 incidents, link to `/incidents?system=...` for all.
5. **Response record**:
   - If the index or chain provides a median response time with a sample size: “Median time to provider response: 14 hours (n=23).” If not: “Not measured.”
   - Response rate? Only if the denominator and method are clear; otherwise omit. Do not show a “responsiveness score.”
6. **Policy gaps for this system**:
   - Groups by clause (ID, title, count), link to `/policy-gaps?system=...`.
   - Empty: “No policy gaps recorded for this system.”
7. **Registry details**:
   - Claimed by (address, if claimed; otherwise “Unclaimed”)
   - Created
   - Current policy key
   - Policy count
   - Incident count
8. `TrustNote` short.

**States:** loading, not found, chain unavailable with index fallback, unclaimed, no policies (should not happen), no incidents, policy unverifiable, synthetic.

**Rules**

- Do not call an unclaimed system “unverified” as a permanent label; use “Unclaimed” and explain.
- Do not show a provider’s other systems as a “portfolio” ranking.
- Do not infer provider identity from a display name.

**Test IDs:** `page-system`, `system-header`, `system-policies`, `incident-distribution`, `response-record`, `system-gaps`, `registry-details`.

### 12.7 Policy gaps (`/policy-gaps`)

**Purpose:** the headline differentiator. Show where AI systems followed their own published policy and harm still occurred.

**Data:** published index. No wallet.

**Layout:**

1. `PageHeader`: eyebrow “The gap between policy and harm”; H1 **Policy gaps**; lede (AGENTS §6.4, verbatim): “These incidents found harm even though the system followed its own policy. That means the policy has a gap.”
2. A “How to read a gap” disclosure:
   - “A policy gap verdict (`POLICY_ADEQUATE_BUT_HARM`) means the output was within the provider’s published policy, yet harm occurred. It can also arise when a minority of non-mandatory clauses were violated but the policy as a whole did not require a violation finding. It is a signal that the policy may be insufficient — not a legal conclusion.”
   - “A gap is not proof that the provider is generally unsafe. Read the cited clause and the evidence hash.”
3. Summary cards:
   - Total gap verdicts
   - Systems affected
   - Most-cited clauses (table: clause ID/title, system count, incident count; no interpretation)
4. Filter: system select; “All systems” default. `system` query param.
5. Gap groups, grouped by `(system_id, clause_id)`:
   - Header: system name + clause ID/title + count.
   - Body: clause text (verified) or fallback; “Cited in N incidents.”
   - Incident links (`inc-000001`, date, severity, confidence).
   - A link to the system’s policy version.
6. Export: **Download gap report (.md)** — generates the markdown in §12.7.1 from the current data; filename `policy-gaps-<network>-<YYYY-MM-DD>.md`. Include a header with network, contract, generated date, and a note that the data is from the published index. Disable if the index is unavailable.
7. Empty state: “No policy gaps recorded yet.” + explanation + link to `/incidents`.
8. `TrustNote` short.

**Rules**

- Do not say “these companies broke their promises.” Use “the output was within the published policy, yet harm occurred.”
- Do not rank providers by gap count. Sort groups by system name, then clause ID. The summary table may sort by count, but label it “most-cited clauses,” not “worst clauses.”
- Do not aggregate across policy versions without showing the version; a gap is always tied to a pinned version. Group key includes `policy_version` if the same clause ID spans versions; display the version(s) in the group.
- No synthetic data hidden; `SYNTHETIC` badge on the page if all data is demo, and on each group/incident if mixed.

#### 12.7.1 Gap report format

```md
# SafetyNet Policy Gap Report

- Network: studionet
- Contract: 0xC0ff…ee01
- Generated: 2026-11-02T12:00:00Z
- Source: published index (data/incidents.json)
- Synthetic data: yes/no

Incidents where the system's output was within its published policy, yet harm occurred.

| System | Policy version | Clause | Gap count | Example incident |
|---|---|---|---|---|
| Synthetic Chatbot | 1.0.0 | C2 — Refusal clarity | 3 | inc-000004 |
| Synthetic Chatbot | 1.0.0 | C5 — Disclosure of limits | 1 | inc-000009 |

## How to read this
A gap means the clause did not cover the observed harm. It is not a legal
determination and not proof that the provider is generally unsafe. Read the
cited clause and the incident record.
```

**Test IDs:** `page-policy-gaps`, `gap-explainer`, `gap-summary`, `gap-group`, `gap-export`, `gap-empty`.

### 12.8 Provider console (`/provider`)

**Purpose:** a single, calm place for a claimed provider to claim a system, see incidents that need a response, respond, appeal, and publish policy versions. Not a dashboard; no analytics.

**Data:** live chain + index. Wallet required. The page is readable without a wallet, but every action requires one.

**Layout:**

1. `PageHeader`: eyebrow “For providers”; H1 **Provider console**; lede “Claim a system, respond to incidents, appeal a verdict, and publish policy versions. Claiming is first-come in v1 and is not identity verification.”
2. If no wallet: `Notice` info “Connect a wallet to see the systems claimed by your address.” + `WalletButton`. Do not hide the explanatory content.
3. If wrong network: `NetworkMismatchBanner`.
4. In-page anchor nav: **Your systems · Open incidents · Claim a system · Publish policy**.
5. **Your systems**:
   - Cards/table of systems where `claimed_by == connected address`.
   - Each: display name, system ID, current policy, open incidents, latest verdict date.
   - Empty: “No systems are claimed by this address.” + “Claim a system” anchor.
6. **Open incidents**:
   - Incidents for the connected provider’s systems with status `OPEN` (and `RESPONDED`? The provider may want to see responded ones; show a filter “Needs response” / “All”).
   - Columns: incident, system, claim filed, response deadline, status, action.
   - Deadline uses the chain clock; if unavailable, label “estimated.”
   - Empty: “No incidents need a response right now.”
   - Row action: “Read and respond” → incident detail (the response form lives on the incident page for context).
7. **Claim a system** (`#claim`):
   - `SystemPicker` limited to unclaimed systems; or a system ID input with search.
   - Selected system summary: display name, provider ID, current policy, claim status.
   - Warning: “Claiming is first-come in v1 and is not identity verification. Only the claimed address can respond. The claim is permanent in v1.”
   - Confirm dialog: “Claim this system?” with the system ID and address; button **Claim system**.
   - On success: refresh; the system moves to “Your systems”; announce “System claimed.”
   - If already claimed: “That system is already claimed by `0x…`.” No override, no admin.
8. **Publish policy** (`#publish`):
   - System select (only systems claimed by the connected address).
   - Version input (semver-ish, `1.2.0`).
   - Policy URL (https, required; allowlisted? Policy URLs are provider-owned, not evidence URLs; the contract accepts a URL. The UI should still require https and a public host. Do not apply the evidence allowlist to policy URLs unless the contract does; check ground truth. Default: https only, no credentials, no private hosts.)
   - Policy document text (paste markdown). Parse clause headers; show clause IDs and count; show errors for non-sequential/duplicate IDs.
   - Compute `text_hash` using the shared normalizer; show the hash, clause IDs, and a preview.
   - Warning: “A published policy version is immutable. Incidents filed against earlier versions keep their pinned version. Validators must be able to fetch this URL; if it disappears, adjudication fails closed.”
   - Confirm dialog with version, hash, clause count, URL; button **Publish policy version**.
   - On success: refresh system; announce; link to the system page.
   - No edit/delete of a published version.
9. **Appeal**: not a separate section; the action lives on a decided incident page, visible only to the reporter/claimed provider. The provider console links to decided incidents for its systems.
10. `TrustNote` short + “What claimed means” link.

**States:** no wallet, wrong network, no claimed systems, loading systems, index unavailable, claim pending, publish pending, validation errors, tx failure.

**Rules**

- The console never shows another provider’s private data. All data is public, but the console is scoped to the connected address’s claimed systems.
- Do not show “response rate,” “trust score,” or “ranking.”
- Do not allow editing a past response. The record is append-only.
- Do not allow deleting or hiding an incident.
- No “admin” controls.

**Test IDs:** `page-provider`, `provider-anchor-nav`, `provider-systems`, `provider-open-incidents`, `provider-incident-row`, `claim-form`, `claim-confirm`, `respond-form`, `appeal-form`, `publish-policy-form`, `publish-policy-preview`, `tx-progress`.

### 12.9 About (`/about`)

**Purpose:** the trust page. A reader should finish it knowing exactly what a verdict means, what it does not mean, who decides, and what is permanent.

**Data:** static. No wallet.

**Sections (in order):**

1. **What SafetyNet is** — the positioning statement verbatim:
   > SafetyNet is the public record of AI harm. Anyone can report an AI safety incident with evidence. The AI provider answers. GenLayer validators decide whether the system violated its own published safety policy. Every verdict is permanent, queryable, and free to check — a neutral trust layer for the AI age.
2. **What it is not** — a short list:
   - Not a court, regulator, or legal determination.
   - Not proof that evidence is authentic.
   - Not a general safety rating of a provider.
   - Not a place to accuse individuals.
   - Not a token, market, or financial product.
3. **How a verdict is made** — 4 steps: pin evidence + policy version; provider response (optional); clause-by-clause validator review; deterministic aggregation + appeal.
4. **The five verdicts** — table: verdict, plain meaning, what it does not mean. Use the exact labels/icons. Include “Insufficient evidence is a valid outcome” and “Policy gap is the most valuable verdict.”
5. **Trust boundary** — the exact two-column table from `AGENTS.md` §29.7 (see §17.2). Linkable anchor `#trust-boundary`.
6. **What permanence means** — on-chain records cannot be deleted; display-layer redaction is limited; corrections are published, not substituted.
7. **Provider claiming in v1** — first-come; not identity verification; only the claimed address can respond; unclaimed systems can still be adjudicated; a claim can be wrong and is flagged as unclaimed/claimed, not “verified.” Anchor `#claiming`.
8. **Synthetic data** — demo records are labeled `SYNTHETIC`; they are illustrative, not real incidents; exports include the flag.
9. **Who runs this** — maintainers publish the interface and registry; GenLayer validators decide; no admin can change a verdict.
10. **Legal disclaimer** — verbatim §17.1. Anchor `#disclaimer`.
11. **Accessibility** — conformance target, known limitations, the date of the last manual audit, and a contact path. Anchor `#accessibility` (§18.13).
12. **Security** — how to report a vulnerability, and what never to paste into an issue (evidence text, keys, addresses). Anchor `#security`.
13. **Links** — docs, GitHub, data, contract address, security contact, redaction policy.

**Rules**

- The banned-word rule applies, except the exact required disclaimer/trust-boundary strings (§16.7).
- No marketing claims (“the world’s first,” “trusted by”).
- No team photos or investor logos in v1.
- The page must be readable at 200% zoom and print cleanly.

**Test IDs:** `page-about`, `disclaimer`, `trust-boundary`, `verdict-table`, `claiming`, `synthetic-explainer`, `accessibility`, `security`.

### 12.10 Data (`/data`)

**Purpose:** make the open dataset legible, citable, and verifiable without scraping.

**Data:** static + index metadata. No wallet.

**Layout:**

1. `PageHeader`: eyebrow “Open data”; H1 **Open data**; lede “The record is open. Download it, verify it, cite it.”
2. **Freshness card**: network, contract, index generated at, schema version, counts, synthetic yes/no.
3. **Downloads**:
   - `incidents.json` — the public index (systems, policies, incidents, verdict summaries).
   - `verdicts.json` — flat verdict records.
   - `policy-gaps.md` — the human-readable gap report.
   - `addresses.json` — network → contract address (optional).
   - Each card: description, size, SHA-256 (if generated), download button. **Do not fabricate sizes or hashes.** If a file is not generated, show “Not published yet” with the build command.
4. **What is included / not included**:
   - Included: incident IDs, system IDs, policy versions/hashes/clause IDs, statuses, dates, evidence hashes, verdicts/severity/confidence/clauses/rationale, synthetic flag.
   - Not included: claim text, inline evidence, defense text, reporter addresses, policy text (linked, not redistributed).
   - “The chain is authoritative. The index is a convenience and may lag.”
5. **Schema** — a compact table of the `PublicIndex` fields, link to the full schema docs. No need to dump the entire JSON schema on the page.
6. **Query snippets** — at least five copy-paste examples:
   - `fetch('/data/incidents.json')` + filter gaps.
   - `jq` for incidents by system.
   - `jq` for verdict distribution.
   - `jq` for policy gaps by clause.
   - A TypeScript snippet using the `PublicIndex` type.
   - Snippets must be tested in CI or manually verified; no invented fields.
7. **Citation** — “SafetyNet, incident inc-000001, StudioNet, accessed 2 Nov 2026, https://safetynet.example/incidents/inc-000001.” Include a “Copy citation” button.
8. **License** — code MIT; docs CC-BY-4.0; verdict text CC-BY-4.0; claims © reporters; policy documents © providers, linked and hashed, not redistributed.
9. **API status** — “There is no hosted API in v1. Use the static export or read the contract directly.” Link to the client docs.
10. **Embed** — iframe snippet for a claimed system; link to `/embed/system/:id`.
11. `TrustNote` short.

**Rules**

- Never include claim/evidence text in downloads. This is a privacy rule.
- Never present a download as “live” if it is a snapshot; show the generated timestamp.
- Do not add CSV in v1 unless it is generated and tested; JSON/Markdown are enough.
- The page must not imply an SLA or uptime guarantee.

**Test IDs:** `page-data`, `data-freshness`, `data-downloads`, `data-schema`, `data-snippets`, `data-citation`, `data-license`.

### 12.11 Embed (`/embed/system/:systemId`)

**Purpose:** a read-only, cookieless card that a provider or researcher can embed to show a system’s public record.

**Rules**

- Render only for **claimed** systems. If unclaimed: “This system has not been claimed by a provider.” + a link to the full system page. Do not show incidents for unclaimed systems (harassment risk).
- No header, footer, nav, wallet, theme toggle, analytics, or cookies.
- Max width `560px`; padding `14px`; transparent background? Use `--sn-surface` so it reads on any page; border + radius.
- Content: brand mark + “SafetyNet” small; system display name; `ClaimBadge`; verdict distribution (counts + labels); total incidents; policy gaps count; “View the full record →” link (opens in a new tab); “Powered by SafetyNet” link.
- Theme: `?theme=light|dark`; default follows `prefers-color-scheme`; no toggle.
- No claim text, no evidence, no provider address.
- If data is unavailable: “Record unavailable” + link; do not render an empty card.
- `X-Frame-Options` / CSP: allow framing only for `/embed/*`; all other routes `frame-ancestors 'none'`. Use route-specific headers. The embed is read-only; clickjacking risk is low but do not allow framing the report/provider flows.
- Fixed height guidance in the snippet: `height="420"`; the card scrolls internally if needed? Avoid internal scroll; keep content short. If the system has many verdicts, show the distribution only, not a list.
- Test IDs: `page-embed`, `embed-summary`, `embed-verdict`.

### 12.12 Not found (`*`)

See §4.7. `data-testid="page-not-found"`.

---

## 13. FLOWS

### 13.1 File an incident (end-to-end)

```text
/report
  → Step 1: select system + policy version (pin hash)
  → Step 2: claim (20–2000, PII gate)
  → Step 3: evidence (≥1 item, caps, hashes)
  → Step 4: review manifest + evidence hash + permanence checkbox
  → Step 5: connect wallet → submit file_incident
  → TxProgress: PENDING → … → ACCEPTED
  → navigate to /incidents/:id
```

**Invariants**

- The policy version selected in step 1 is the one submitted. If it changes before submit, re-confirm.
- The evidence hash shown in step 4 is exactly the submitted `evidence_hash`.
- The claim is not trimmed or altered by the UI. Count code points.
- No submit without the permanence checkbox; no submit with an unresolved PII confirmation.
- No submit if the manifest exceeds `maxEvidenceItems` or `maxEvidenceBytes`.
- In chain mode, no submit without a connected wallet on the correct network.
- In demo mode, the action is labeled simulated and never claims a transaction was sent.

**Failure handling**

| Failure | UI |
|---|---|
| Wallet missing | Inline notice + connect; form preserved |
| Wallet rejected | “You cancelled the signature. No record was written.” |
| Wrong network | Banner; submit disabled |
| Validation (contract) | Map reason code to friendly message; focus the field/section; no state written |
| Tx `UNDETERMINED` | “Validators did not converge. No incident was created.” + hash; retry allowed if no record; check duplicate risk |
| Tx timeout | “Still waiting. Check the transaction hash before retrying.” + hash/explorer |
| Tx `ACCEPTED` but navigation fails | Show success + link to `/incidents` + tx hash |
| Index stale/policy changed | Re-confirm pinned version before submit |

### 13.2 Respond as provider

**Entry:** `/provider` open incidents → incident detail, or direct incident link if the connected address is the claimed provider.

**Preconditions:** status `OPEN`; connected address equals `system.claimed_by`; defense 20–4,000; optional evidence within caps.

**Flow:**

1. Show the claim, the policy version, and the deadline.
2. Form: defense textarea, counter, permanence warning, optional evidence editor (same rules as filing).
3. If after the deadline: warning “This response is after the deadline. It will be recorded as late and may reduce confidence.” Allow submit (v1 allows late responses), but show the consequence.
4. Submit `provider_respond`; `TxProgress`; on `ACCEPTED`, refresh; status becomes `RESPONDED`; announce.
5. No editing after submission. Show “Response filed” and the timestamp.

**Failure:** not provider, incident not open, bad defense, evidence invalid, tx failure. Map to the contract reason code; do not guess.

### 13.3 Claim a system

**Preconditions:** system exists; unclaimed; wallet connected; correct network.

**Flow:**

1. Search/select an unclaimed system.
2. Show the warning: first-come, not identity verification, permanent in v1, only this address can respond.
3. Confirm dialog with system ID + address.
4. Submit `claim_system`; on `ACCEPTED`, refresh; badge changes to “Claimed”; announce.
5. If already claimed: show the claimant address; no override.

**Note:** a claim does not prove ownership. The UI must never say “verified.” M2 DNS verification is out of scope.

### 13.4 Appeal a verdict

**Preconditions:** status `DECIDED`; connected address is the reporter or claimed provider; within `appealWindowHours` of `ruled_at`; `appeals < maxAppeals`; reason 20–500.

**Flow:**

1. Incident detail → “Appeal this verdict.”
2. Explain: new round, larger validator set, current verdict remains in the record, no guarantee of a different outcome.
3. Reason textarea + counter.
4. Confirm dialog: “Submit appeal?”
5. Submit `appeal`; on `ACCEPTED`, refresh; status `APPEALED`; show the appeal in the timeline.
6. The next adjudication is available to anyone; the UI should show “Run adjudication” after an appeal.

**Failure:** window closed, limit reached, not appellant, bad reason. Show the exact reason; do not hide the button without explanation.

### 13.5 Run adjudication

**Preconditions:** incident is `OPEN` after the response deadline, or `RESPONDED`; or `APPEALED` for the next round; no verdict for the current round. Anyone with a wallet can submit.

**Flow:**

1. Action button on the incident page or a row action in the provider console (for provider systems).
2. Confirmation dialog:
   > This submits a transaction. Independent validators review the pinned evidence against policy v1.0.0. **You are not deciding the verdict.**
3. Submit `adjudicate`; `TxProgress`.
4. On `ACCEPTED`: refresh incident/verdict/history. If a verdict exists, show it with “Accepted — awaiting finality” if the finality window is open. If `UNDETERMINED`, show “Validators did not converge. No verdict was stored.” and allow a retry.
5. On `FINALIZED` (if waiting): mark the record final.

**Rules:** never imply the submitter influenced the verdict. Never show a verdict from a local guess. Never hide an `UNDETERMINED` result.

### 13.6 Finalize a record

**Preconditions:** status `DECIDED`; appeal window closed; no pending appeal; anyone with a wallet can submit.

**Flow:**

1. “Finalize record” action.
2. Confirm dialog: “This marks the record final after the appeal window. It does not change the verdict.”
3. Submit `finalize`; on `ACCEPTED`, refresh; status `FINAL`; announce.
4. If the window is still open: disabled with “The appeal window closes on ….”
5. If already final: no action; “This record is final.”

### 13.7 Publish a policy version

**Preconditions:** connected address is the claimed provider; version unique; clause IDs sequential; policy URL https; hash computed with the shared normalizer.

**Flow:**

1. `/provider#publish` → select claimed system.
2. Enter version, URL, paste policy text.
3. Parse clauses; show IDs/titles/count; block on duplicate/non-sequential/too many clauses/too-long clauses.
4. Compute `text_hash`; show short + copy; show a diff summary against the current version if available (clause count, added/removed IDs; no free-text diff in v1).
5. Confirm dialog with version, hash, clause count, URL.
6. Submit `publish_policy`; on `ACCEPTED`, refresh; current policy updates; announce. Existing incidents keep their pinned version.

**Rules:** immutable; no edit/delete; no retroactive application; warn if the URL is not fetchable by validators (can’t test from browser due to CORS; still warn).

### 13.8 Copy and verify a hash

1. Copy button next to every hash/address.
2. Clipboard success → check icon + “Copied” + polite announcement.
3. On the incident page, the integrity panel compares hashes and labels the check as client-side.
4. To verify externally: copy the full hash, fetch the evidence/policy source, compute SHA-256, compare. Link to `/data` and the evidence guide.

### 13.9 Wallet and network

1. Connect only when an action needs it; reads never require a wallet.
2. Use EIP-1193 `eth_requestAccounts`; no private key, no seed phrase, no arbitrary signing.
3. On connect, check `eth_chainId` against the configured chain. If mismatched, show the banner; do not send writes.
4. “Switch network” uses `wallet_switchEthereumChain` with the chain ID from ground truth; if unavailable, show manual instructions.
5. On `accountsChanged`, reset the connected address and refetch provider-scoped data. On `chainChanged`, re-check and reload reads. On `disconnect`, clear session state.
6. The connection is session-only; do not persist the address. The theme is the only persisted preference.

### 13.10 Deep links and refreshes

- Every incident/system/provider section has a stable URL/anchor.
- Refreshing a detail page re-fetches from chain; do not rely on in-memory state.
- Refreshing `/report` loses the form (no draft persistence). Warn before unload if dirty.
- A deep link to a provider action that requires a wallet shows the page with a connect prompt, not a 404.
- A deep link to an incident that exists on chain but not in the index still renders from chain; if the system name is missing, show the system ID.
- A deep link to an incident that exists in the index but not on chain shows the index snapshot + “Live record unavailable,” not 404 (unless the chain confirms not found).

---

## 14. DATA AND STATE

### 14.1 Sources of truth

| Need | Source | Why |
|---|---|---|
| Lists, search, counts, policy gaps | Published index (`data/incidents.json`) | The contract has no list-all view; the index is fast and cacheable |
| One incident, response, verdict, appeals, history | Live chain via `@safetynet/client` | Authoritative; must reflect the latest state |
| System + policies | Live chain + index | Chain for policy hashes; index for counts |
| Caps, appeal window, max appeals | `get_config()` live | Immutable after deploy; never hardcode in the UI |
| Evidence text | Incident `evidence_manifest` (inline) or URL metadata | Never fetch remote evidence in the browser |
| Policy text | Policy URL, hash-verified in the browser | The contract stores only the hash/URL |
| Network/contract address | Build-time config from the deployment registry | Fail loudly if missing |

**Never:** infer an incident from a transaction hash alone; invent a list from local seed data in production; use a cached list as if it were live detail.

### 14.2 Public index model

The index is the machine-readable companion to `AGENTS.md` §24.3, extended with `systems` and policy metadata. It is serialized to `data/incidents.json`; `data/verdicts.json` is a flat companion. The UI loads the index from `VITE_INDEX_URL` (default `/data/incidents.json`).

```ts
export interface PublicIndex {
  schemaVersion: 1;
  generatedAt: string;        // ISO 8601, UTC
  network: string;            // "studionet" | "bradbury" | ...
  chainId: string;
  contract: string;           // 0x...
  synthetic: boolean;         // true if any record is synthetic
  systems: PublicSystem[];
  policies: PublicPolicy[];
  incidents: PublicIncident[];
}

export interface PublicSystem {
  systemId: string;
  displayName: string;
  providerId: string;
  claimed: boolean;
  currentPolicy: string;      // version
  policyCount: number;
  incidentCount: number;
  gapCount: number;
  latestActivity: string;     // ISO 8601
  synthetic?: boolean;
  medianResponseHours?: number; // only if measured
  responseSample?: number;      // required with median
}

export interface PublicPolicy {
  systemId: string;
  version: string;
  textHash: string;           // sha256:...
  clauseIds: string[];
  url: string;
  effectiveAt: string;        // ISO 8601
  publishedAt: string;        // ISO 8601
  supersedes: string;         // "" or version
  synthetic?: boolean;
}

export interface PublicIncident {
  incidentId: string;
  systemId: string;
  systemName: string;
  policyVersion: string;
  policyHash: string;
  status: "OPEN" | "RESPONDED" | "DECIDED" | "APPEALED" | "FINAL";
  filedAt: string;            // ISO 8601
  responseDeadline: string;   // ISO 8601
  responseFiled: boolean;
  lateResponse?: boolean;
  claimSha256: string;        // sha256 of the claim text; never the text
  evidenceHash: string;
  evidenceKinds: Array<"inline" | "url">;
  verdict: PublicVerdict | null;
  synthetic?: boolean;
}

export interface PublicVerdict {
  verdict: "POLICY_VIOLATION" | "POLICY_ADEQUATE_BUT_HARM" |
           "INSUFFICIENT_EVIDENCE" | "OUT_OF_SCOPE" | "DISMISSED";
  severity: "LOW" | "MODERATE" | "SERIOUS" | "CRITICAL";
  confidence: "LOW" | "MEDIUM" | "HIGH";
  clauses: string[];
  rationale: string;          // templated, from the contract
  ruledAt: string;            // ISO 8601
  round: number;
  appeals: number;
}
```

**Rules**

- No claim text, defense text, inline evidence text, or reporter address in the index. This is a privacy rule (`AGENTS.md` §24.3, §33.5).
- `counts` are not duplicated in the schema; compute from arrays or publish a verified summary. If a summary is added, the UI must cross-check it against array lengths and prefer arrays.
- `medianResponseHours` requires `responseSample`; without a sample, omit both. Never estimate.
- `synthetic` is per-record and per-index; the UI shows both the global banner (demo mode) and per-record badges.
- Deterministic ordering in the file: systems by `systemId`, policies by `systemId` + version, incidents by `incidentId` desc. The UI re-sorts per view but the file is diffable.
- The index must be generated by CI, not hand-edited. A hand-edited index is a trust bug.

### 14.3 Live reads

Use the generated client in `apps/web/src/generated/SafetyNet.ts` through `@safetynet/client`.

| View | Use |
|---|---|
| `get_incident(id)` | Incident detail |
| `get_response(id)` | Provider response |
| `get_verdict(id)` | Current verdict |
| `get_appeals(id)` | Appeal records |
| `get_verdict_history(id)` | Round history |
| `get_policy(systemId, version)` | Policy hash/clause IDs/URL |
| `get_system(systemId)` | Claim status/current policy |
| `get_config()` | Caps, appeal window, max appeals |
| `get_reporter_stats(address)` | Reporter stats (if displayed; no composite score) |
| `list_incidents_by_system(systemId)` | IDs for a system; use only for small lists; prefer index |

- Views return JSON strings; the generated decoders parse them. Do not parse by hand in components.
- Empty string → `null`/`[]` per the decoder. Do not treat an empty string as an error.
- If a view reverts or the RPC fails, show `ErrorState`; do not fall back to a fabricated default.
- Read-only pages must work with no wallet. The client may need a read-only provider; configure it without an account.

### 14.4 Freshness and staleness

- Show `FreshnessNote` on every index-driven page.
- Fresh: `< 24h`. Stale: `≥ 24h` → warning tone + “Detail pages still read the live chain.”
- Unknown: no valid `generatedAt` → “Index freshness unknown.”
- On detail pages, if the index summary disagrees with chain, show the chain and a stale-index notice.
- Do not auto-refresh the index every few seconds. Fetch once per session; revalidate on focus if older than 15 minutes; provide a manual refresh.
- Do not show “live” for the index. It is a snapshot. Only chain reads are live.

### 14.5 Demo mode

- Build-time flag `VITE_DATA_MODE=demo|chain`; default `chain` for production, `demo` only when explicitly set for development/showcase.
- In demo mode:
  - Use `data/store.ts`; all records are synthetic.
  - Persistent global banner: “Demo build — all records are synthetic; write actions are simulated.”
  - `SYNTHETIC` badge on every record.
  - Write actions do not call the chain; they update the local store after a short simulated delay. The success message must say “Simulated in demo mode — no transaction was sent.”
  - `TxProgress` may be shown as a simulation, but it must be labeled “Simulated” and must not show a real tx hash. Use a fake ID like `demo-tx-0001` only if clearly labeled; preferably omit the hash.
  - No wallet required.
- Demo mode must never be the default in a production build. A CI test asserts that a production build without `VITE_DATA_MODE` does not render the demo banner and fails loudly if the contract address is missing.

### 14.6 Async state model

```ts
type AsyncState<T> =
  | { status: "loading" }
  | { status: "ready"; data: T; stale?: boolean }
  | { status: "error"; error: UiError };

type UiErrorKind =
  | "index_unavailable"
  | "chain_unavailable"
  | "not_found"
  | "wallet_unavailable"
  | "wallet_rejected"
  | "network_mismatch"
  | "validation"
  | "tx_failed"
  | "tx_undetermined"
  | "tx_timeout"
  | "unknown";
```

- Empty is `ready` with an empty array, not an error.
- Unknown is `error` or an explicit `unavailable` state, never `0`.
- Every async view has loading, ready, empty, error, and (where relevant) stale states.
- Errors carry an optional contract/CLI `code` and a `retryable` boolean. Do not invent new public error codes; map to the `AGENTS.md` §28 catalog where possible.

### 14.7 Caching

| Data | Cache | Invalidate |
|---|---|---|
| Index | In-memory, session; revalidate on focus if > 15 min | Manual refresh, full reload |
| Incident/response/verdict/appeals/history | In-memory, 30s per key | After any accepted write to that incident |
| System/policies | In-memory, 60s | After claim/publish |
| Config | In-memory, 5 min | After deploy (rare; full reload) |
| Wallet state | Session only | `accountsChanged`, `chainChanged`, disconnect |

- Cache key includes network + contract + method + args.
- No localStorage/sessionStorage for chain data.
- Abort in-flight reads on unmount and on key change.
- Do not show stale detail without a “Refreshing…” indicator after a write.

### 14.8 Integrity checks

- On incident detail, compare verdict `evidence_hash`/`policy_hash` to incident `evidence_hash`/`policy_hash`.
- Compare incident `policy_hash` to `get_policy(system, version).text_hash` when available.
- Label the panel “Hash consistency check (client-side).” It proves field agreement, not authenticity.
- If a check cannot run, say “Not available yet,” not “Passed.”
- If a mismatch exists, allow reading but disable writes and show a warning with a report-a-problem link.
- Do not compute a “confidence score” from the checks.

### 14.9 Empty vs unknown vs unavailable

| Situation | Render | Do not render |
|---|---|---|
| Index loaded, zero incidents | EmptyState “No incidents yet.” | “0” with no context? A stat of 0 is okay if the index is fresh; an empty list is better |
| Index failed | ErrorState “The published index could not be loaded.” | “0 incidents” |
| Filter no match | EmptyState “No incidents match these filters.” | “No incidents exist” |
| System has no incidents | EmptyState “No incidents for this system yet.” | “Clean record” (implies safety) |
| No gaps | EmptyState “No policy gaps recorded yet.” | “No harm” (overclaim) |
| Response not filed | “No provider response filed.” | “Ignored,” “refused,” “silent” |
| Policy text unverified | Clause IDs + hash + source link | Unverified clause text |
| Median not measured | “Not measured.” | “0 hours,” estimated number |
| Index stale | Warning + date | “Live” label |

### 14.10 Search, sort, and pagination

- Search is substring, case-insensitive, trimmed, max 80 characters. No fuzzy matching, no stemming, no claim-text search.
- Sort is deterministic; ties break by incident ID descending.
- Pagination: 25 incidents/systems per page; page numbers 1-based; out-of-range page → clamp to last page and replace the URL, with a notice? Clamp silently is okay if announced “Page 7 of 7”; do not show an empty page.
- Filters are AND; active filters are visible as chips; “Clear all” resets to defaults and removes query params.
- The result count is announced politely, not on every keystroke; debounce the announcement.

### 14.11 Clock and deadlines

- Chain timestamps are Unix seconds. Convert to JS milliseconds explicitly.
- For response deadlines and appeal windows, prefer a chain clock read from the latest block; if unavailable, use the browser clock and label “estimated.”
- If the browser clock and chain clock differ by more than 5 minutes, show “Times are estimated from your device clock.”
- Never block an action solely on a client-side deadline; the contract is authoritative. The UI explains the expected result and maps the revert.
- Countdown format: “2 days, 4 hours” for > 24h; “4 hours, 12 minutes” for < 24h; “12 minutes” for < 1h. Do not show seconds except in the tx elapsed time.

---

## 15. TRANSACTION UX

### 15.1 Lifecycle

```text
PENDING → PROPOSING → COMMITTING → REVEALING → ACCEPTED → FINALIZED
                                      │             │
                                      └── UNDETERMINED
                                      └── CANCELED
                                      └── ERROR (client)
```

- `ACCEPTED` means consensus reached; the finality/appeal window may still be open.
- `FINALIZED` means the record is final.
- `UNDETERMINED` means validators did not converge; **no verdict is stored**.
- `CANCELED` means the transaction was canceled; **no record is written**.
- `ERROR` is a client-side terminal state for submission/polling failures; explain what is known and what is not.

### 15.2 Stepper behavior

- Show all six steps in order. Do not hide `REVEALING`; if the network does not emit it, mark it done on `ACCEPTED`.
- The current step is active; prior steps are done; future steps are upcoming.
- Terminal failure: mark the first step failed; do not show a success state; show the terminal explanation and the hash.
- Elapsed time starts at the first event; update once per second; stop on terminal.
- The stepper is `role="status"` + `aria-live="polite"`; only announce status changes, not the elapsed counter.
- On `ACCEPTED`, announce “Accepted. The record is awaiting finality.” Do not announce “Success” unless the target is `FINALIZED` and it is reached.
- On `FINALIZED`, announce “Finalized.”
- On `UNDETERMINED`, announce “Validators did not converge. No verdict was stored.”

### 15.3 Action matrix

| Method | Who | Preconditions | Wait target | On success |
|---|---|---|---|---|
| `file_incident` | Anyone | System/policy exist; valid claim/evidence; caps; no duplicate | `ACCEPTED` | Navigate to new incident |
| `provider_respond` | Claimed provider | Incident `OPEN`; defense valid; evidence valid | `ACCEPTED` | Refresh; status `RESPONDED` |
| `claim_system` | Anyone | System exists; unclaimed | `ACCEPTED` | Refresh; badge “Claimed” |
| `publish_policy` | Claimed provider | Version unique; clauses valid; URL https | `ACCEPTED` | Refresh; current policy updates |
| `adjudicate` | Anyone | Eligible (`OPEN` after deadline or `RESPONDED`/`APPEALED`) | `ACCEPTED` | Refresh verdict/history; handle `UNDETERMINED` |
| `appeal` | Reporter/claimed provider | `DECIDED`; window open; appeals < max; reason valid | `ACCEPTED` | Refresh; status `APPEALED` |
| `finalize` | Anyone | `DECIDED`; appeal window closed | `ACCEPTED` | Refresh; status `FINAL` |

- Use `wait: "ACCEPTED"` for all UI writes. Do not wait for `FINALIZED` on ordinary actions; the app can show “awaiting finality” and refresh.
- Never mark a write successful from a local optimistic update. The chain result is the only success.
- After an accepted write, invalidate the relevant read cache and refetch. Do not rely on the transaction return value for record state beyond the new incident ID.

### 15.4 Timing and waiting copy

| Elapsed | Copy |
|---|---|
| 0–10s | “Waiting for the network…” |
| 10–60s | “Still waiting. This can take longer on testnets.” |
| 60–180s | “Still waiting. You can leave this page; the transaction continues.” + hash |
| > 180s (StudioNet) / > 600s (testnets) | “We haven’t seen a final status. Check the transaction hash before retrying.” + hash + “Check status” |

- Do not show a spinner-only state. Always include a sentence.
- The user may navigate away; the transaction continues. On return, the incident may already be updated; the detail page re-reads chain.
- Do not auto-retry. A retry is a new transaction and can duplicate a report. If the user retries after a timeout, warn: “If the first transaction was accepted, a duplicate report may be rejected.”

### 15.5 Failure modes and copy

| Mode | UI copy | Recovery |
|---|---|---|
| Wallet rejected | “You cancelled the signature. No record was written.” | Try again |
| Wrong network | “Wrong network. Switch to StudioNet to submit.” | Switch network |
| Insufficient funds | “The account cannot pay for this transaction.” + faucet link if known | Fund account |
| Contract revert | Friendly reason-code message + code | Fix input / choose another action |
| `UNDETERMINED` | “Validators did not converge. No verdict was stored.” | Retry adjudication; inspect evidence/clauses |
| `CANCELED` | “The transaction was cancelled. No record was written.” | Try again |
| Timeout | “Still waiting. Check the hash before retrying.” | Check status / explorer |
| RPC error | “The network could not be reached.” + retry | Retry |
| Index error (read) | “The published index could not be loaded.” | Retry / use detail links |

### 15.6 Explorer links

- Only link to an explorer if the network descriptor includes a confirmed explorer URL from ground truth.
- Label: “View transaction” (external icon, opens in a new tab).
- If no explorer: show the full hash with copy; do not invent a URL.
- Never link to a block explorer for a `UNDETERMINED` tx as if it were a success; the explorer shows status, which is fine, but the UI copy must be neutral.

### 15.7 Finality and appeals

- A verdict can exist while the incident status is `DECIDED`; the appeal window may still be open.
- Show “Accepted — awaiting finality” only for the transaction state; for the record, use the incident status: `DECIDED` / `APPEALED` / `FINAL`.
- Do not label a `DECIDED` record “final.” Final means `FINAL`.
- If an appeal is filed, the prior verdict remains visible; the current status is `APPEALED`; a new round may produce a new verdict.
- If `maxAppeals` is reached, show “No appeals remaining” with the date; do not hide the history.

---

## 16. CONTENT DESIGN

### 16.1 Voice and tone

- **Plain, precise, neutral, humane.** Write like a careful public-records clerk.
- Short sentences. One idea per sentence. Define terms on first use.
- Active voice. “Validators decide,” not “a decision is rendered.”
- Second person for instructions (“Select a policy version”), third person for the record (“The verdict cites C3”).
- No hype, no fear, no outrage. The facts carry the weight.
- No jokes in error states. No “oops.”
- No exclamation marks.
- Do not attribute a verdict to SafetyNet maintainers. “Validators decided” / “The record shows.”

### 16.2 Capitalization and punctuation

- Sentence case for headings, buttons, labels, and menu items.
- Title case only for proper nouns and the product name.
- Verdict labels are sentence case in UI: “Policy violation,” “Policy gap,” “Insufficient evidence,” “Out of scope,” “Dismissed.”
- Enum values in code/raw JSON stay uppercase; never show raw enums to users without a label.
- Use the Oxford comma in lists where it aids clarity.
- Use the em dash sparingly; the en dash for ranges; the hyphen for compounds.
- Curly quotes in prose; straight quotes in code/hashes.
- One space after periods. No double spaces.

### 16.3 Microcopy deck (canonical strings)

| Key | String |
|---|---|
| `app.tagline` | The public record of AI harm. |
| `home.lede` | Report an AI safety incident with evidence. The AI provider answers. GenLayer validators decide whether the system violated its own published safety policy. Every verdict is permanent, queryable, and free to check. |
| `cta.report` | Report an incident |
| `cta.browse` | Browse the record |
| `cta.retry` | Try again |
| `cta.clearFilters` | Clear filters |
| `cta.copy` | Copy |
| `cta.copied` | Copied |
| `stat.incidents` | Incidents filed |
| `stat.verdicts` | Verdicts reached |
| `stat.gaps` | Policy gaps found |
| `home.latest` | Latest verdicts |
| `home.gaps` | Policy gaps |
| `home.gaps.lede` | Incidents where harm occurred even though the system's output was within its own published policy. |
| `home.how` | How it works |
| `home.trust` | A verdict is a policy compliance finding, not a legal determination. |
| `incidents.title` | Incidents |
| `incidents.lede` | Every filed incident, its status, and its policy compliance verdict. |
| `incidents.search` | Search incident ID, system, or clause |
| `incidents.empty` | No incidents yet. |
| `incidents.empty.action` | File the first incident |
| `incidents.noMatch` | No incidents match these filters. |
| `incident.noVerdict` | No verdict yet |
| `incident.noResponse` | No provider response filed. |
| `incident.noResponse.help` | A missing response is a fact about the record, not a finding. |
| `incident.lowConfidence` | Low confidence — evidence was missing, unavailable, or contradictory. |
| `incident.policyDrift` | The policy source no longer matches the pinned hash. The record fails closed rather than judging different text. |
| `incident.unclaimed` | No provider has claimed this system in the registry. |
| `incident.claimLabel` | Claim — as filed by the reporter |
| `incident.responseLabel` | Provider response — as filed |
| `incident.evidence` | Evidence |
| `incident.inlineWarning` | Inline evidence is public and permanent. |
| `incident.urlNote` | This page does not fetch the URL. Validators do. |
| `incident.clauses` | Cited clauses |
| `incident.appeals` | Appeal history |
| `incident.raw` | Raw record (JSON) |
| `integrity.ok` | Hash consistency check passed. |
| `integrity.fail` | Hash mismatch. Do not rely on this page until it is resolved. |
| `report.title` | Report an incident |
| `report.lede` | File a public, permanent report about one AI system and one pinned policy version. |
| `report.step.system` | System |
| `report.step.claim` | Claim |
| `report.step.evidence` | Evidence |
| `report.step.review` | Review |
| `report.step.submit` | Submit |
| `report.claim.help` | Describe the system's behavior and the clause you believe it contradicts. 20–2,000 characters. |
| `report.pii` | Remove names, emails, phone numbers, handles, and addresses unless they are necessary to understand the claim. |
| `report.permanence` | This report is public and permanent. Inline evidence is stored on-chain and cannot be deleted. |
| `report.checkbox` | I understand this is public and permanent. |
| `report.evidence.inline` | Inline text |
| `report.evidence.url` | URL |
| `report.evidence.captured` | Captured text (hashed, not submitted) |
| `report.review.hash` | Evidence hash |
| `report.submit` | Submit incident report |
| `provider.title` | Provider console |
| `provider.claim.warning` | Claiming is first-come in v1 and is not identity verification. Only the claimed address can respond. |
| `provider.claim.confirm` | Claim this system? |
| `provider.respond.late` | This response is after the deadline. It will be recorded as late and may reduce confidence. |
| `provider.publish.warning` | A published policy version is immutable. Incidents filed against earlier versions keep their pinned version. |
| `provider.publish.url` | Validators must be able to fetch this URL. If it disappears, adjudication fails closed. |
| `adjudicate.confirm` | Run adjudication? |
| `adjudicate.note` | Anyone can submit this transaction. Independent validators decide; you do not. |
| `finalize.confirm` | Finalize this record? |
| `finalize.note` | This marks the record final after the appeal window. It does not change the verdict. |
| `appeal.title` | Appeal this verdict |
| `appeal.help` | Explain what the verdict missed. 20–500 characters. |
| `appeal.note` | An appeal starts a new round with a larger validator set. The current verdict stays in the record. |
| `tx.pending` | Pending |
| `tx.proposing` | Proposing |
| `tx.committing` | Committing |
| `tx.revealing` | Revealing |
| `tx.accepted` | Accepted |
| `tx.finalized` | Finalized |
| `tx.undetermined` | Validators did not converge. No verdict was stored. |
| `tx.canceled` | The transaction was cancelled. No record was written. |
| `tx.error` | The transaction failed. No record was written. |
| `tx.timeout` | Still waiting. Check the transaction hash before retrying. |
| `data.title` | Open data |
| `data.lede` | The record is open. Download it, verify it, cite it. |
| `data.includes` | Hashes, statuses, verdicts, clause IDs, and dates. No claim text or inline evidence. |
| `data.excludes` | Claim text, inline evidence, reporter addresses, and policy text are not in the export. |
| `embed.unclaimed` | This system has not been claimed by a provider. |
| `notFound.title` | That page isn't in the record. |
| `error.index` | The published index could not be loaded. |
| `error.chain` | The live record could not be reached. |
| `error.wallet` | No browser wallet found. |
| `error.rejected` | You cancelled the signature. No record was written. |
| `error.network` | Wrong network. |
| `error.validation` | Check the highlighted fields. |
| `synthetic.label` | SYNTHETIC |
| `synthetic.help` | Illustrative data — not a real incident. |
| `demo.banner` | Demo build — all records are synthetic; write actions are simulated. |
| `legal.short` | Policy compliance findings, not legal determinations. |

### 16.4 Error copy template

Every error answers three questions:

```text
[What failed]
[Why / what it means]
[What to do now]
```

Example:

```text
The evidence host isn't allowed.
Evidence URLs must use https and a host from the allowlist. This one resolves to a private address.
Fix: use a public https URL from the allowed hosts, or paste the text as inline evidence (2,000 characters max).
Code: DISALLOWED_EVIDENCE_HOST
```

- Show the code in mono, small, after the human message. Do not lead with the code.
- Do not show raw stack traces. `--trace`/dev builds may show a collapsed “Technical details.”
- Do not blame the user. “That system isn’t in the index” is a fact; “You picked an invalid system” is a scold.
- Do not say “unknown error” if a code exists. If truly unknown, “Something went wrong in the app. The record was not changed.” + report link.
- Do not use “please” more than once, if at all.

### 16.5 PII guidance

- Filing: always-visible warning (see `report.pii`).
- Detection: email, phone, `@handle`, and URLs with credentials. Do not attempt name detection; it is unreliable and biased.
- If detected: show a warning, list the matched patterns without echoing the full value? Echoing the value on screen is okay (the user typed it), but do not log it. Require the checkbox “This information is necessary to understand the claim.”
- Inline evidence: stronger warning because it is stored on-chain.
- Exports: no claim/evidence/reporter data.
- Redaction: display-layer only; link to the policy. Never imply deletion.
- Do not include real PII in docs, screenshots, demo data, or tests. All seed data is synthetic.

### 16.6 Synthetic data

- Every synthetic record: `SYNTHETIC` badge (list, detail, embed) + “Illustrative data — not a real incident.”
- Demo mode: persistent global banner; all records synthetic; actions simulated.
- Exports: `synthetic: true` per record and a global flag.
- OG cards for synthetic records: include “SYNTHETIC DEMO DATA” if rendered.
- Never blend synthetic and real records without per-record badges.
- Never call synthetic data “seed data” in user-facing copy; “synthetic demo data.”
- Never use a real company name, real person, or real incident in demo data. Use `Synthetic Chatbot`, `Synthetic Agent`, `Synthetic Provider`.

### 16.7 Banned and approved words

**Banned in user-facing copy (asserting the concept):**

> guilty, guilt, liable, liability, illegal, crime, criminal, convicted, sentenced, plaintiff, defendant, victim, accusation, accused, ruling, judgment, sentence, exonerated, innocent, court, prosecute, punish.

**Approved alternatives:**

| Instead of | Use |
|---|---|
| Guilty / liable | Policy violation (only for the verdict) |
| Illegal | Not supported by the record; describe the behavior |
| Victim | Reporter / affected person (only if they self-identify; default “reporter”) |
| Defendant | Provider |
| Accusation | Claim / incident report |
| Ruling / judgment | Verdict / policy compliance finding |
| Exonerated / innocent | Dismissed |
| Court / prosecute | Validators / adjudication / appeal |

**Required exceptions (verbatim, do not “fix”):**

- The standard disclaimer: “…not an assessment of liability…”
- The trust boundary: “That the provider acted illegally.”
These exact strings are mandated by `AGENTS.md` §34.3 and §29.7. The banned-word test must whitelist these exact strings, not ban the words globally. Do not add new uses of the words.

**Hard bans:** never use “guilty,” “victim,” “defendant,” or “accused” in any new string, headline, empty state, error, or metadata.

### 16.8 Reading level and localization

- Target: plain English understandable to a smart reader without a law or blockchain background. Explain “policy version,” “pinned,” “hash,” “validators,” and “appeal” on first use or via a nearby help link.
- Keep sentences under ~25 words where possible. Avoid nested clauses.
- Do not use “on-chain” in primary copy; use “in the public record” and explain “on-chain” in help text.
- Do not use “canonical,” “manifest,” “equivalence principle,” or “non-deterministic” in user-facing copy. Those are developer terms. Use “evidence bundle,” “pinned hash,” “validators.”
- English only in v1. `lang="en"`. Policy documents are expected in English; if a policy contains another language, display it as text and note “Policy text is shown as published; SafetyNet does not translate it.”
- Date/number formatting is `en-GB` for consistency (day-month-year, 24-hour UTC). Do not localize per browser in v1; document the limitation.
- No RTL layout support in v1. If an RTL policy is displayed, it may render left-aligned; document the limitation. Do not claim support.

---

## 17. TRUST, LEGAL, AND SAFETY UI

### 17.1 Standard disclaimer (verbatim, required)

> SafetyNet publishes policy compliance findings produced by independent validators against a provider's own published policy. A finding is not a legal determination, not an assessment of liability, and not a statement that an AI system is safe or unsafe in general. Evidence is supplied by reporters and is not independently authenticated. Always consult the original sources and the cited policy version.

**Placement**

- `/about` (`#disclaimer`).
- Every incident page with a verdict: adjacent to the verdict summary **and** in the page footer.
- The footer short line everywhere: “Policy compliance findings, not legal determinations.” with a link to the trust boundary.
- The embed: “Policy compliance finding, not a legal determination.” + link.
- Never collapse the full disclaimer into a tooltip or a modal.

### 17.2 Trust boundary (verbatim table)

| A SafetyNet verdict means | A SafetyNet verdict does not mean |
|---|---|
| Independent validators read the pinned evidence and the pinned policy version | That the evidence is authentic |
| They agreed on a bounded verdict under a stated rule | That the provider acted illegally |
| The record is public and unaltered since finalization | That the provider is generally unsafe |
| The policy text is fixed and hash-verified | That the policy was followed internally |

- Render as a real two-column table on `/about`; on mobile, stack as pairs with the “means” label and the “does not mean” label.
- Link from every verdict page and the footer.
- Do not paraphrase. Do not add rows without owner approval.

### 17.3 Provider claiming

- v1 claiming is first-come, permanent, and **not identity verification**.
- Badge: “Claimed” / “Unclaimed”; never “Verified.”
- Help text on every claim badge: “Claiming is first-come in v1 and is not identity verification. Only the claimed address can respond.”
- Unclaimed systems can still be adjudicated; no response is possible. Do not say the provider “refused.”
- If a system is claimed by the wrong party, the UI shows “Claimed” and the address; it does not adjudicate ownership. The incident can still be filed.
- A claimed provider’s response is displayed; it is not an endorsement by SafetyNet.

### 17.4 No provider response

- Copy: “No provider response filed.”
- Help: “A missing response is a fact about the record, not a finding.”
- Do not use “ignored,” “refused,” “silent,” or “failed to respond.”
- Show the response deadline; if it passed, say “The response window closed on ….”
- Confidence may be capped at `MEDIUM` by the contract; show the actual confidence, do not recalculate.
- Severity floor may be raised; show the actual severity, do not explain the internal table in the verdict card. Link to `/about#severity` for the method.

### 17.5 Confidence

- Show the actual band: `LOW`, `MEDIUM`, `HIGH` as “Low confidence,” etc.
- Low confidence note: “Low confidence — evidence was missing, unavailable, or contradictory.”
- Explain: confidence reflects evidence completeness and consistency, not model certainty, not a probability of guilt, not a legal standard.
- Do not color confidence like a verdict; use neutral text + a small icon if needed.
- Do not show a numeric confidence. There is none.

### 17.6 Policy drift

- If the live policy text does not match the pinned hash, the UI fails closed for display: no clause text, fallback IDs + hash + source link.
- Copy: “The policy source no longer matches the pinned hash. The record fails closed rather than judging different text.”
- The verdict page still shows the verdict; the policy text is unavailable. Do not imply the verdict is invalid; it was reached against the pinned version.
- Provider console: when publishing a new version, warn that older incidents keep their pinned version.

### 17.7 Integrity warnings

- Hash mismatch: warning + “Do not rely on this page until it is resolved.” + reads allowed, writes disabled.
- Index/chain disagreement: chain wins; notice “The published index is out of date for this record. Showing the live chain.”
- Chain unavailable: show the index snapshot only if it has enough data; label “Indexed snapshot — live record unavailable”; disable actions.
- Evidence unavailable/tampered (if the data says so): badge on the evidence item; do not hide the item; do not change the verdict.
- Never silently drop an evidence item or a clause because it failed to load. Show the failure.

### 17.8 Redaction and corrections

- On-chain records cannot be deleted or edited. The UI never offers delete/edit.
- Display-layer redaction: link to the documented process on `/about` and in the incident footer (“Request a display-layer redaction”).
- Corrections: publish a correction notice linked from the affected incident page (`AGENTS.md` §33.9). Do not rewrite the verdict.
- If a record is superseded by a new deployment, show a banner on the old address linking to the new record; never delete the old one.
- Abuse report: “Report a problem with this page” → GitHub issue template (off-chain). It does not change the record. Do not make it a prominent primary action.

### 17.9 Severity and policy gaps

- Severity is meaningful only for `POLICY_VIOLATION` and `POLICY_ADEQUATE_BUT_HARM`; hide it elsewhere.
- Severity is a bounded label derived from structured incident metadata, not a legal assessment. Explain in `/about#severity`, not in every badge.
- A policy gap is not a violation of the policy; it is a signal that the policy may be insufficient.
- Do not say “the policy allowed harm” without the nuance: “the output was within the policy, yet harm occurred.”
- Do not rank providers by gaps; show counts with denominators and versions.

### 17.10 What every verdict page must show

- [ ] The verdict label + icon (not color alone).
- [ ] Severity only for violation/gap.
- [ ] Confidence band.
- [ ] Cited clause IDs + verified text or explicit fallback.
- [ ] Evidence hash + item count/kinds.
- [ ] Policy version + hash + source.
- [ ] Provider response or neutral “No provider response filed.”
- [ ] Appeal history or “No appeals filed.”
- [ ] Round number and ruled date.
- [ ] The full disclaimer.
- [ ] A link to the trust boundary.
- [ ] `SYNTHETIC` if applicable.
- [ ] No banned words.

---

## 18. ACCESSIBILITY

### 18.1 Conformance target

- **WCAG 2.1 Level AA** for every route in §4.1, including `/embed/*` and `/provider`.
- Selected Level AAA rules are adopted where they are cheap: body text contrast ≥ 7:1 in light mode, target size ≥ 44px, no timing that closes a flow.
- Accessibility is not a mode, a theme, or a toggle. There is no “high contrast mode”; the default must already be usable.
- The only permitted exception is third-party UI we do not control (the wallet extension’s own modal). Everything we render must pass.
- Publish an accessibility statement at `/about#accessibility` with: conformance target, known limitations, the date of the last manual audit, and a contact path.

**Definition of broken:** an accessibility defect that blocks filing, reading a verdict, or reaching the trust boundary is a **P0 bug**, not a backlog item.

### 18.2 Structure and semantics

| Requirement | Rule |
|---|---|
| Landmarks | One `<header>`, one `<nav aria-label="Primary">`, one `<main id="main">`, one `<footer>` per page. `/embed/*` has `<main>` only. |
| Headings | Exactly one `<h1>` per page. Never skip levels. Section titles are `<h2>`; card titles are `<h3>`. |
| Skip link | First focusable element: “Skip to content” → `#main`. Visible on focus, not offscreen-only tricks. |
| Main focus target | `<main id="main" tabIndex={-1}>` so route changes can move focus. |
| Navigation vs action | If it changes the URL, it is `<a href>`. If it changes state, it is `<button type="button">`. Never `<div onClick>`, never `<a href="#" onClick>`. |
| Lists | Real `<ul>`/`<ol>`/`<li>` for incident lists, clause lists, evidence lists, appeal timelines. |
| Tables | Real `<table>` with `<caption>`, `<thead>`, `<th scope="col">`, `<tbody>`. Sortable headers use `<button>` inside `<th>` plus `aria-sort`. |
| Language | `<html lang="en">`. Future locales set `lang` on the subtree, not per word. |
| Document title | Updated on every route per §4.6. Never leave a stale title. |
| Reading order | DOM order equals visual order at every breakpoint. Do not use `order`, `row-reverse`, or absolute positioning to rearrange content. |

### 18.3 Contrast

Contrast is checked on the **rendered pair**, including badge backgrounds and hover states.

| Pair | Minimum | Notes |
|---|---|---|
| Body text (`--sn-text`) on `--sn-bg` / `--sn-surface` | 7:1 | AAA target; measured ≈ 17.8:1 light |
| Secondary text (`--sn-text-secondary`) on surface | 4.5:1 | Ledes, claim/defense |
| Muted metadata (`--sn-muted`) on surface | 4.5:1 | Dates, counts, labels — never below |
| Verdict label text on its soft background | 4.5:1 | Both themes |
| Button text on `--sn-accent` | 4.5:1 | Light: white on `#1E4E79`; dark: ink on `#9DC7F2` |
| Input border (`--sn-border-strong`) against surface | 3:1 | Non-text contrast, 1.4.11 |
| Focus ring against adjacent colors | 3:1 | `--sn-focus`, 2px + 2px offset |
| Disabled control text | 3:1 | WCAG exempts disabled; we do not |
| Hairline rules (`--sn-border`) | No minimum | Decorative only; never the sole indicator |

**Rules**

- Never communicate state with color alone: verdict, severity, status, error, selected tab, active nav all carry text and/or icon.
- Do not use `opacity` on text to create a muted tone; use the muted token.
- Do not place text on photography, gradients, or translucent surfaces. There are none.
- Hover must never reveal information required to understand the page (1.4.13). Tooltips are supplementary and dismissible with Escape.

### 18.4 Keyboard model

| Key | Behavior |
|---|---|
| `Tab` / `Shift+Tab` | Natural DOM order. Visible focus at all times. |
| `Enter` | Activates links and buttons. |
| `Space` | Activates buttons, toggles checkboxes, selects radios. |
| `Escape` | Closes the mobile menu, dialog, or open combobox; returns focus to the invoker. |
| `ArrowUp` / `ArrowDown` | Moves within a radio group and within an open select list. |
| `ArrowLeft` / `ArrowRight` | Moves between tabs, if tabs are used. |
| `Home` / `End` | First/last item in a listbox or tab set. |

**Rules**

- No single-character shortcuts (2.1.4). There is no `/`-to-search, no `g i` navigation, no `j/k`.
- No keyboard traps. The table scroll wrapper is focusable and scrollable with arrows, but `Tab` always escapes it.
- Focus is never moved on hover, on scroll, or on a timer.
- Focus is never moved while the user is typing in a field, except to an error summary after an explicit submit.
- Native `<dialog>` with `showModal()` provides the focus trap; do not hand-roll one.
- Every icon-only control has an accessible name that is the **action** (“Switch to dark theme”, “Copy evidence hash”), not the glyph.

**Focus ring (normative)**

```css
:where(a, button, input, select, textarea, summary, [tabindex]):focus-visible {
  outline: 2px solid var(--sn-focus);
  outline-offset: 2px;
  border-radius: var(--sn-radius-xs);
}
```

- Never `outline: none` without an equivalent visible replacement.
- Inside a filled accent button, the ring uses `outline-offset: 2px` and remains visible against the button fill.
- On dark surfaces the ring is `#7AB7FF`; verify ≥ 3:1 against both the surface and the button.

### 18.5 Focus management

| Event | Required behavior |
|---|---|
| Route change (link, back/forward, redirect after submit) | Move focus to the new `<h1>` (`tabIndex={-1}`), scroll to top unless a hash targets a section, announce the page title in the `route-announcer` live region. |
| Opening a dialog | Focus the first meaningful control, or the dialog itself for a message-only dialog. |
| Closing a dialog | Return focus to the element that opened it. If that element no longer exists, focus the nearest section heading. |
| Opening the mobile menu | Focus the first link. |
| Closing the mobile menu | Return focus to the menu button. |
| Submit fails validation | Focus the `ErrorSummary` at the top of the form; each item links to its field. |
| Submit succeeds | Route change handles focus. For an inline success (e.g., copied hash, provider response filed), focus the success notice. |
| Transaction reaches a terminal state | Do **not** steal focus. Announce via `tx-announcer`; the user may still be reading. |
| Hash-target deep link (`/about#trust-boundary`) | Scroll to the target and set focus to it if it is focusable; otherwise leave focus at `<main>`. |

### 18.6 Screen reader requirements by component

| Component | Requirement |
|---|---|
| `VerdictBadge` | Renders the visible label text (“Policy violation”). The icon is `aria-hidden`. Never replace the label with an `aria-label`. |
| `SeverityMeter` | Visible or visually hidden text “Serious, 3 of 4”. Bars are `aria-hidden`; do not expose four unlabeled progressbars. |
| `ConfidenceLabel` | Plain text “High confidence”. No meter, no color. |
| `IncidentRow` | Link text is the record ID; the row link’s accessible name includes system, verdict, and date, e.g. “inc-000001, Synthetic Chatbot, policy violation, 2 November 2026”. |
| `Hash` | Full value available to assistive tech even when visually shortened: `<span class="srOnly">{full}</span>` plus the short visual string. The copy button’s name includes what is copied. |
| `CopyButton` | Announces “Copied” via `copy-announcer` (`aria-live="polite"`), not by changing the button label only. |
| `TxProgress` | `role="status"`, `aria-live="polite"`, `aria-atomic="false"`. Announce each transition as a sentence: “Transaction accepted. Waiting for finality.” Ordered list with `aria-current="step"`. |
| `FreshnessNote` | Plain text, no live region. Updates on manual refresh announce once. |
| `ProviderBadge` | “Claimed — not identity-verified” / “Unclaimed — provider not verified”. The word “verified” never appears alone. |
| `SyntheticBadge` | Visible text `SYNTHETIC`. Never an icon-only or color-only marker. |
| `Table` | Caption names the dataset and the current filter, e.g. “Incidents, filtered to policy violations, 12 results”. |
| `Pagination` | `<nav aria-label="Pagination">`; current page uses `aria-current="page"`; “Previous”/“Next” are real links. |
| `FilterBar` | Filter chips are toggle buttons with `aria-pressed`. Active filter count is announced after change. |
| `Timeline` | Ordered list; each item has a heading and a date; do not rely on a vertical line to show sequence. |
| `EvidenceItem` | Heading includes the evidence ID (“Evidence e1, inline”). Availability state is text. |
| `ClauseCard` | Heading is “Clause C1 — title”. Cited clauses are marked with text, not only a border. |
| `WalletButton` | Name states the state: “Connect wallet”, “Connected 0xAb12…77Ef”, “Wrong network”. |
| `NetworkMismatchBanner` | `role="alert"`; the only assertive region in the app. |

**Live regions (exactly three, mounted once in the shell):**

| ID | Politeness | Purpose |
|---|---|---|
| `route-announcer` | `polite` | Page title after navigation |
| `tx-announcer` | `polite` | Transaction status transitions |
| `copy-announcer` | `polite` | “Copied …” confirmations |

Live regions must exist in the DOM before content is inserted and must not be inside `display:none` or `aria-hidden` containers.

### 18.7 Forms

- Every field has a visible `<label for>`. Placeholders are never labels.
- Required fields are marked in the label text (“Claim (required)”) and with the `required` attribute; do not use `aria-required` alone.
- Help text is linked with `aria-describedby`; errors are linked with `aria-describedby` and set `aria-invalid="true"`.
- Error text states what is wrong and how to fix it, per §16.4. Do not rely on red borders.
- Character counters announce only at thresholds (50 remaining, 10 remaining, exceeded) — never on every keystroke.
- The submit button is not disabled without a visible reason. If it is disabled, an adjacent line says what is missing (“Add at least one evidence item to continue.”).
- `autocomplete` is set on wallet-adjacent fields where applicable; claim and defense fields use `autocomplete="off"` and `spellcheck="true"`.
- Never auto-submit on blur or on select change.
- The filing flow is completable keyboard-only, including the permanence acknowledgement checkbox and the final submit (wallet modal excepted).

### 18.8 Zoom, reflow, text spacing, targets, forced colors

| Requirement | Rule |
|---|---|
| Resize text | 200% text-only zoom with no loss of content or function. |
| Reflow | 400% zoom at 1280px wide (320 CSS px) produces no two-dimensional scrolling, except inside table wrappers, code blocks, and raw JSON. |
| Text spacing | Content survives `line-height: 1.5`, `letter-spacing: 0.12em`, `word-spacing: 0.16em`, `paragraph-spacing: 2em` without clipping. |
| Target size | 44×44 CSS px for all primary, form, and navigation controls. Absolute floor 24×24 for dense row actions, with ≥ 8px spacing. |
| Orientation | Portrait and landscape both supported. No orientation lock. |
| Pointer gestures | No multi-point or path gestures. No drag-only interactions. |
| Hover-only content | None. Everything reachable by keyboard and touch. |
| Forced colors | `@media (forced-colors: active)` keeps borders, uses system colors, and preserves the verdict icon + text distinction. Background images are none. |
| Reduced motion | Honors `prefers-reduced-motion: reduce` per §6.6 and §10.4. |
| Flashing | Nothing flashes more than three times per second. No strobing skeleton. |

### 18.9 Time and deadlines

- Deadlines are **informational**. Nothing closes, expires, or resets while the user reads.
- Always show an absolute UTC timestamp next to any relative time (“in 12 hours”). Relative time alone is ambiguous and inaccessible.
- Countdowns tick at most once per minute and are not in a live region. Screen readers get the absolute time.
- If the browser clock differs from chain time by more than 5 minutes, show “Estimated — your device clock differs from the network.” Do not silently correct.
- Session timeouts: none. Wallet sessions are the wallet’s concern.

### 18.10 Media and motion

- No autoplaying audio or video. No background video. No animated illustrations.
- The skeleton shimmer stops after 3 seconds and falls back to a static block, so motion is never indefinite.
- Under reduced motion, the transaction stepper updates instantly with no dot animation, and disclosures open without height animation.
- No parallax, no scroll-jacking, no auto-advancing carousels.

### 18.11 Language and readability

- Target: a motivated non-lawyer understands a verdict page in under 90 seconds.
- Expand an abbreviation on first use per page: “SHA-256”, “Coordinated Universal Time (UTC)”, “application programming interface (API)”.
- Short sentences. Active voice. No nested clauses in verdict copy.
- Do not use “here” or “click here” as link text. Link text names its destination.
- Numbers use `Intl.NumberFormat`; dates use an explicit format, never `toLocaleString()` without options.
- Legal terms are never softened or dramatized; use the approved vocabulary in §16.7.

### 18.12 Accessibility testing

**Automated (CI, blocking)**

| Check | Tool | Scope |
|---|---|---|
| Rule violations | `vitest-axe` / `axe-core` | Every page component in: default, loading, empty, error, and dark theme |
| Landmarks and headings | Custom assertions | One `h1`, no skipped levels, one `main` |
| Accessible names | Testing Library queries | Every button, link, input has a name |
| Contrast tokens | Token test | Computed pairs meet §18.3 (fail the build on regression) |
| Focus order | Playwright | Filing flow keyboard-only run |

Automated checks catch roughly a third of issues. The manual script below is mandatory before a milestone demo.

**Manual script (before every milestone demo and release)**

1. Unplug the mouse. File an incident end-to-end, including acknowledging permanence (wallet modal excepted).
2. Tab through `/incidents`, apply two filters, open a record, open the raw record disclosure, copy a hash.
3. Screen reader pass (NVDA + Firefox on Windows; VoiceOver + Safari on macOS): verdict label, severity, confidence, evidence hash, tx status, error summary.
4. Zoom to 200% text-only and 400% page zoom; verify no clipped controls and no horizontal page scroll.
5. Enable reduced motion; verify the stepper and dialogs still communicate state.
6. Enable forced colors; verify verdict distinctions survive.
7. Check the three live regions announce exactly once per event and never read hidden content.
8. Print a verdict page to PDF; verify the disclaimer and trust boundary are present (Appendix G).

**Assistive technology matrix**

| Platform | Browser | Screen reader | Frequency |
|---|---|---|---|
| Windows 11 | Firefox ESR | NVDA | Every milestone |
| Windows 11 | Chrome | NVDA | Release |
| macOS 14+ | Safari | VoiceOver | Every milestone |
| iOS 17+ | Safari | VoiceOver | Release |
| Android 14+ | Chrome | TalkBack | Release |

### 18.13 Known limitations and disclosure

The accessibility statement at `/about#accessibility` must state, honestly:

- Third-party wallet extensions control their own dialogs; their accessibility is outside our control. Reading the record never requires a wallet.
- The chain RPC may be slow; the interface announces waiting states but cannot make the network faster.
- Policy text is rendered as plain text, not as formatted HTML, which may reduce fidelity for providers who publish complex documents.
- A manual audit date and a contact for accessibility reports.

---

## 19. RESPONSIVE DESIGN

### 19.1 Approach

- Mobile-first CSS. Base styles target the smallest viewport; `min-width` media queries add complexity.
- Breakpoints are literals from §6.8. No JavaScript layout switching except closing the mobile menu on resize.
- Layout is CSS Grid and Flexbox. No float layouts, no absolute positioning for structure.
- The page must be usable at 320px CSS width. That is the floor, not an edge case.

### 19.2 Behavior matrix

| Element | `< 480` (sm) | `480–767` (md) | `768–1023` (lg) | `≥ 1024` (xl) | `≥ 1280` (2xl) |
|---|---|---|---|---|---|
| Header | Brand + theme + menu | Brand + theme + menu | Full nav; primary action in header if ≥ 900 | Full nav + action | Same |
| Gutters | 16px | 20px | 24px | 24px | 24px |
| Content width | 100% | 100% | 100% | 1080px max | 1080px max |
| Home stats | 1 column | 3 columns | 3 columns | 3 columns | 3 columns |
| Home latest/gaps | Stacked | Stacked | 2 columns | 2 columns | 2 columns |
| Incident list | Cards | Cards | Table | Table | Table |
| Incident detail | Stacked, no rail | Stacked | Stacked | 8/4 columns | 8/4 columns |
| Filters | Disclosure panel | Disclosure panel | Inline bar | Inline bar | Inline bar |
| Report form | 1 column, full-width steps | 1 column | 1 column, 720px max | 1 column + review rail | Same |
| Policy gaps | Stacked groups | Stacked | Stacked | 2-column summary + list | Same |
| Footer | Stacked links | 2 columns | 3 columns | 3 columns | 3 columns |
| Embed | Fluid width, 380px min height | Fluid | Fluid | Fluid | Fluid, max 560px |

### 19.3 The dual-presentation rule for tables

Below `768px`, data tables are replaced by card lists built from the same array:

- `Table` renders `<table>` and is hidden with `display: none` below 768.
- `CardList` renders `<ul>` of `<IncidentCard>` and is hidden at ≥ 768.
- Exactly one is visible; `display: none` removes the other from the accessibility tree, so nothing is announced twice.
- Both receive the same `data-testid` suffix convention (`incident-list-table`, `incident-list-cards`).
- A test asserts both presentations render the same number of records for the same fixture.
- Do not use CSS to restyle `<table>` cells into blocks; that breaks table semantics in several screen readers.

### 19.4 Detail rail reflow

- At `≥ 1024px`: main column `span 8`, rail `span 4`, rail order after main in the DOM.
- Below `1024px`: the rail moves **below** the main content in DOM order and is not re-ordered with CSS. Metadata is less important than the verdict.
- Actions that live in the rail on desktop are repeated inline at the end of the relevant section on mobile (e.g., “Request adjudication” appears after the verdict summary).
- The rail is never sticky (see §5.6).

### 19.5 Forms at small widths

- One field per row. Never two inputs side by side below 480px.
- The step indicator collapses to “Step 2 of 5 — Describe the incident”; the full step list is available in a disclosure.
- The review summary stacks above the submit button, not in a sticky bar.
- The submit button is full-width below 480px and at least 48px tall.
- Long hashes wrap with `overflow-wrap: anywhere`; they never force horizontal scrolling.

### 19.6 Touch and hover

- Every interactive element has a 44px minimum hit area, even if its visual is smaller (padding, not transform scaling).
- Hover styles are wrapped in `@media (hover: hover) and (pointer: fine)`. Touch users never depend on hover.
- Focus styles apply on touch browsers after tap for buttons that open panels; do not suppress.
- No swipe-only actions. No long-press menus.
- Safe-area insets are respected for the sticky header and any bottom-anchored notice: `padding-bottom: max(16px, env(safe-area-inset-bottom))`.

### 19.7 Viewport and orientation

- `<meta name="viewport" content="width=device-width, initial-scale=1">`. No `maximum-scale`, no `user-scalable=no`.
- Landscape phones: the header may shrink to 48px, but text never shrinks below 16px.
- No fixed heights on content containers; only the header uses `min-height`.
- `100dvh` for the shell, with a `100vh` fallback.

### 19.8 Responsive acceptance tests

Test at widths: `320`, `360`, `390`, `414`, `480`, `600`, `768`, `834`, `900`, `1024`, `1280`, `1440`, `1920`.

For each width, assert:

- No horizontal scroll on the page (`document.documentElement.scrollWidth <= clientWidth`).
- The primary action is reachable without hover.
- The verdict label is visible without scrolling past the fold on an incident page at 390×844.
- Tables are either tables or cards — never a broken hybrid.
- The footer does not overlap content and the disclaimer is readable.

---

## 20. PERFORMANCE

### 20.1 Budgets

Budgets are release gates. A regression above 25% fails CI (`AGENTS.md` §32.9).

| Metric | Budget | Measurement |
|---|---|---|
| Initial JS, `/` and `/incidents` (gzip) | ≤ 140 KB | `size-limit` on the built route chunk |
| Any route total JS, including lazy chunks (gzip) | ≤ 230 KB | Bundle analyzer |
| CSS, all routes (gzip) | ≤ 24 KB | Build output |
| Web font requests | **0** | Network log assertion |
| Index JSON, first payload | ≤ 350 KB for 1,000 incidents | CI fixture generation |
| `/` LCP, mobile Slow 4G | ≤ 2.0 s | Lighthouse CI |
| Incident page FCP, warm cache | ≤ 1.5 s | Lighthouse CI (`AGENTS.md` §8.5) |
| CLS | ≤ 0.02 | Lighthouse CI |
| INP (interaction) | ≤ 200 ms | Playwright trace + manual |
| Total blocking time | ≤ 200 ms | Lighthouse CI |
| In-memory filter of 1,000 incidents | ≤ 100 ms | Vitest benchmark |
| Lighthouse performance `/` | ≥ 90 | Lighthouse CI |
| Lighthouse performance `/incidents` | ≥ 85 | Lighthouse CI |
| Lighthouse accessibility, all routes | 100 | Lighthouse CI |
| `@safetynet/client` core (gzip, excluding `genlayer-js`) | ≤ 20 KB | `size-limit` (`AGENTS.md` §22.8) |
| Demo-path Playwright run | ≤ 60 s | CI (`AGENTS.md` §8.5) |

### 20.2 Loading strategy

1. **No web fonts.** System stacks only. Zero font requests, zero FOUT.
2. **Route-level code splitting.** `main.tsx` loads the shell; each page is a dynamic import. The home route must not import the chain client.
3. **Lazy chain client.** `genlayer-js` is imported only when a live read or write is required. List pages and the initial paint of detail pages must not block on it.
4. **Index-first paint.** Detail pages render the header, verdict, dates, and policy identity from the index immediately, then load the claim/defense text and integrity checks from the chain. Sections that require chain data show skeletons, not a blank page.
5. **Icons inline.** No icon package, no sprite request. Icons are tree-shaken React components.
6. **No above-the-fold images.** There are no images.
7. **Preload the index** with `<link rel="preload" as="fetch" crossorigin>` only on list routes; do not preload on `/about` or `/data`.
8. **Prefetch on intent only.** Hovering or focusing an incident link may prefetch its lazy chunk after 150ms. Never prefetch a list of 25 routes.

### 20.3 Index payload and pagination

- Page size: `25` incidents, `25` systems. Never render an unbounded list.
- The index file may contain all records; the UI slices in memory. If the file exceeds 350 KB, split by month (`/data/incidents-2026-11.json`) and publish a manifest — `[OPEN] O-14`.
- Search and filter run client-side on the loaded array. No server queries exist.
- Do not ship claim text in the index (privacy), which also keeps the payload small.

### 20.4 Rendering rules

- Lists are not virtualized below 100 rendered rows. With 25 per page, virtualization is unnecessary complexity.
- Avoid layout thrash: no reads of `offsetHeight` in render paths, no scroll listeners without `{ passive: true }`, no resize handlers that set state on every pixel.
- Use CSS containment (`contain: content`) only on long list items after measuring; do not apply it speculatively.
- Animations are limited to the tokens in §6.6 and never animate `width`, `height` (except disclosures), `top`, or `left`.
- Skeletons must match the final layout’s dimensions to keep CLS near zero.
- Do not render a spinner that replaces the page. Use skeletons inside stable containers.

### 20.5 Measurement and CI

| Job | What it does |
|---|---|
| `web-size` | `size-limit` on route chunks and `@safetynet/client` |
| `web-lighthouse` | Lighthouse CI on `/`, `/incidents`, `/incidents/inc-000001`, `/about` against a demo build with a fixture index |
| `web-bench` | Vitest bench for filter/sort on 1,000 fixtures; fails at > 100 ms |
| `web-e2e` | Playwright demo path; records a trace on failure |
| `web-a11y` | axe on every route × state × theme |

- Lighthouse runs against a **demo build with synthetic data**, never against production. Results are committed to `docs/METRICS.md` with the date and commit.
- No real-user monitoring. No analytics. Performance is measured in CI and reported manually.

### 20.6 Slow and failed networks

| Situation | Behavior |
|---|---|
| Index fetch > 8 s | Abort, show `ErrorState` with retry; keep any previously cached index visible with a stale notice. |
| Chain read > 15 s | Show inline error in the affected section only; the rest of the page stays readable. |
| Chain read fails | Never substitute fabricated data. Show the reason code and a retry. |
| Index 404 at a deep link | Render the route shell from the URL, show “Index unavailable”; the chain read for that ID may still succeed. |
| Offline | Banner “You are offline. Cached data may be stale.” Reads that need the network fail with a clear retry. |
| Slow RPC during a write | Keep the stepper visible with elapsed time; never claim success. Provide the tx hash as soon as it exists. |

### 20.7 Perceived performance

- First paint shows the header, page title, and skeleton structure within one frame of the route chunk loading.
- No spinner appears for less than 400ms; if the wait is shorter, render nothing and swap in content.
- Skeletons never animate longer than 3 seconds; after that, show a static block and a “Still loading…” line.
- Never optimistically render a verdict, a response, or a status that the chain has not confirmed.
- Filtering and sorting update immediately (client-side); they never show a loading state.

### 20.8 What we will not do for performance

- No SSR, no Next.js, no server components (`AGENTS.md` §8.7).
- No CDN-hosted fonts, no icon fonts, no CSS framework.
- No service worker in v1. Caching is HTTP + in-memory.
- No virtualization in v1.
- No third-party performance SDK.
- No “skeleton everywhere” pages that hide the fact that data failed to load.

---

## 21. PRIVACY AND SECURITY (UI LAYER)

### 21.1 Data boundary

| Data | Where it lives | What the browser sends | Never |
|---|---|---|---|
| Claim and defense text | Chain only | Read from RPC; never to a third party | Never logged, never put in a URL, never sent to analytics |
| Evidence inline text | Chain (inside the manifest) | Read from RPC | Never re-uploaded, never fetched remotely |
| Evidence URL | Chain (inside the manifest) | Not fetched by the browser in v1 | Never auto-fetched, never proxied |
| Policy text | Provider URL | Fetched directly from the allowlisted host | Never sent to a third party, never stored |
| Hashes | Chain + index | Displayed, copied | Never used as a tracking identifier |
| Reporter address | Chain | Displayed shortened | Never in the index, never in a share card |
| Theme | `localStorage` | Not sent | No other keys |
| Wallet address | Wallet + RPC | Sent to the RPC as the sender | Never sent to analytics or a backend |

- There is **no backend**. The app talks to the static index host and the RPC only.
- There is **no analytics, no session replay, no error-reporting SaaS, no cookies** (`AGENTS.md` §23.8, §33.6).
- The only storage write is `localStorage["snet-theme"]`. A test asserts no other keys are written.

### 21.2 Form drafts and PII

- Claim, defense, and evidence text are **never persisted** to `localStorage`, `sessionStorage`, IndexedDB, or the URL.
- A page unload with unsaved text triggers the browser’s native “Leave site?” prompt via `beforeunload` (only while text is dirty and only in the filing/response flows).
- Do not prefill fields from query parameters except `system` (a public ID) on `/report`.
- Do not put claim text in the document title, the URL, or a share card.
- The PII warning appears before typing, not only on submit (§16.5).

### 21.3 Rendering untrusted content

- Claim, defense, policy, appeal reasons, and notes are rendered as **plain text**. No `dangerouslySetInnerHTML`, no `innerHTML`, no Markdown renderer, no HTML sanitizer dependency — because there is no HTML.
- Preserve author line breaks with `white-space: pre-wrap` and `overflow-wrap: anywhere`. Do not collapse whitespace silently.
- Long unbroken strings (hashes, URLs, base64) must wrap; they must never widen the page.
- Auto-linking inside claim/defense text is **not** performed in v1. Links a reporter wants judged are evidence items, not prose.
- Policy text is fetched and shown only after hash verification (§21.4). If verification fails, show clause IDs and a link, not the text.
- External URLs from evidence and policy are shown as text plus an explicit “Open source” link. The link uses `rel="noopener noreferrer"` and `target="_blank"`, and is visually marked as leaving the site.
- `title` attributes are not used to carry required information.

### 21.4 Hash verification in the browser

The UI verifies policy text before displaying it:

1. Fetch the policy URL with `cache: "no-store"`, a 10s timeout, and a 40 KB read cap.
2. Normalize exactly as the contract does (the normalizer is part of the shared spec; `[OPEN] O-02`).
3. Compute SHA-256 with `crypto.subtle.digest`.
4. Compare to `policy.textHash` from the chain.
5. On match: show the text with a “Hash verified in your browser” note and the hash.
6. On mismatch: do **not** show the text. Show “The policy source no longer matches the pinned hash.” plus clause IDs, hash, and source link.
7. On fetch failure (CORS, 404, timeout): show the same fallback minus the mismatch claim: “Policy text unavailable — the pinned hash is …”.

Rules:

- Verification is a display aid, not a consensus result. Never imply the browser verified the verdict.
- Never cache unverified policy text in memory beyond the attempt.
- Hashing runs off the main thread when available (`crypto.subtle` is async); the UI shows a “Verifying…” state on the policy section only.

### 21.5 Wallet and keys

- The app never asks for, displays, or stores a seed phrase, private key, or keystore.
- Wallet connection is optional and only required for writes.
- Reads never require a wallet.
- On network mismatch, writes are disabled with `NetworkMismatchBanner`; reads continue against the configured network.
- Demo mode uses an in-memory ephemeral account only if a signature is simulated, and the persistent banner says “Temporary demo account — do not fund.”
- The connected address is shown shortened with a copy control; it is never sent anywhere except the RPC as the transaction sender.
- Disconnect clears the app’s wallet state but cannot clear the wallet extension’s own permissions; say so.

### 21.6 Clipboard

- Copy actions are explicit button presses; never copy on page load, on focus, or on selection.
- Copy writes only the hash, address, ID, or URL shown in the control’s label.
- Clipboard failure is announced as an error with a fallback: the value is selected so the user can copy manually.
- Never copy claim text, defense text, or evidence content.

### 21.7 Headers and content security

Static host headers (normative shape; exact RPC and policy origins come from ground truth):

```text
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'sha256-<theme-boot-hash>';
  style-src 'self';
  img-src 'self' data:;
  font-src 'self';
  connect-src 'self' <rpc-origin> <policy-allowlist-origins>;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  object-src 'none';
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
```

- The inline theme boot script is allowed by hash, not `unsafe-inline` (§7.3).
- `/embed/*` uses `frame-ancestors *` because embedding is the point; all other routes forbid framing.
- `connect-src` is generated at build time from the same allowlist used by the contract; a drift test fails if they diverge.
- No `unsafe-eval`. No third-party scripts. No tag manager.

### 21.8 Dependency and supply-chain rules

- Runtime dependencies: React, React DOM, `@safetynet/client`, `@safetynet/core`, and one router solution. Nothing else without owner approval.
- No UI kit, no icon package, no date library (use `Intl`), no state library, no CSS-in-JS, no analytics.
- Dev dependencies may include Vitest, Testing Library, axe, Playwright, and size-limit.
- Lockfile committed; `pnpm install --frozen-lockfile` in CI.
- No postinstall scripts.
- Any dependency that ships a network call at import time is rejected.

### 21.9 Threat model for the interface

| Threat | Vector | Mitigation |
|---|---|---|
| Stored XSS via claim/defense | Malicious text rendered as HTML | Plain-text rendering only; no HTML pipeline exists |
| XSS via policy page | Provider serves hostile HTML | Fetched as text, capped, never injected as HTML |
| Clickjacking | Framing the app to fake actions | `frame-ancestors 'none'` except `/embed/*` |
| Phishing via evidence links | Misleading external link | Link shows full host, marked external, `noopener noreferrer` |
| Wallet drainer | Fake “connect” flow asking for signatures | Only the configured wallet connector; never request arbitrary signatures; explain each signature |
| Address spoofing in UI | Copycat addresses | Show shortened + full on demand; never rely on a truncated address alone for a write confirmation |
| Index tampering | Hand-edited `incidents.json` | Index is generated in CI; detail pages verify against chain; disagreement shows a warning |
| Fake “verified” badge | Provider claims a system | Badge says “Claimed — not identity-verified”; no green checkmark anywhere near it |
| Screenshot misrepresentation | A verdict page screenshot without context | Every verdict page shows the disclaimer, date, round, and hash; OG cards say “policy compliance record” |
| Secret leakage in logs | Debug logging | No `console.log` in production; logger redacts; no claim/evidence text in errors |

### 21.10 Reporting a UI security issue

- `SECURITY.md` is the only channel. The UI links to it from `/about#security` but never invites users to paste evidence or keys into an issue.
- A UI security fix ships as a patch release; if a deployed contract is unaffected, say so explicitly in the changelog.
- If a UI bug caused a user to sign something unintended, publish a notice and a remediation path; never silently change the flow.

---

## 22. IMPLEMENTATION CONVENTIONS

### 22.1 Directory structure (normative)

```text
apps/web/
├── index.html                  # theme boot script, meta, preload
├── vite.config.ts
├── tsconfig.json
├── src/
│   ├── main.tsx                # mounts <App/>, no prototype imports
│   ├── App.tsx                 # shell: header, main outlet, footer, live regions
│   ├── routes.tsx              # typed route table (single source of routes)
│   ├── styles/
│   │   ├── tokens.css          # Appendix A — the only token definitions
│   │   ├── reset.css
│   │   ├── base.css            # element defaults, prose, focus
│   │   └── print.css           # Appendix G
│   ├── components/
│   │   ├── VerdictBadge/
│   │   │   ├── VerdictBadge.tsx
│   │   │   ├── VerdictBadge.module.css
│   │   │   └── VerdictBadge.test.tsx
│   │   └── …                   # one folder per component in §11
│   ├── pages/
│   │   ├── Home/
│   │   ├── Incidents/
│   │   ├── IncidentDetail/
│   │   ├── Report/
│   │   ├── Systems/
│   │   ├── SystemDetail/
│   │   ├── PolicyGaps/
│   │   ├── Provider/
│   │   ├── About/
│   │   ├── Data/
│   │   ├── Embed/
│   │   └── NotFound/
│   ├── lib/
│   │   ├── router.tsx          # history router + Link + useRoute
│   │   ├── client.ts           # createClient, lazy chain import
│   │   ├── data/
│   │   │   ├── index.ts        # fetch + validate PublicIndex
│   │   │   ├── live.ts         # live reads, decoders
│   │   │   ├── demo.ts         # demo adapter over data/store.ts
│   │   │   └── cache.ts        # in-memory map, TTL
│   │   ├── hooks/
│   │   │   ├── useAsync.ts
│   │   │   ├── useIndex.ts
│   │   │   ├── useIncident.ts
│   │   │   ├── useTrackedTx.ts
│   │   │   └── useTheme.ts
│   │   ├── format.ts           # dates, numbers, bytes, hashes
│   │   ├── hash.ts             # sha256 + normalizers
│   │   ├── validation.ts       # re-exports @safetynet/core/validate
│   │   └── copy.ts             # shared strings (see §22.13)
│   ├── generated/
│   │   ├── SafetyNet.ts        # AUTO-GENERATED — do not edit
│   │   └── addresses.ts        # AUTO-GENERATED — do not edit
│   └── test/
│       ├── setup.ts
│       ├── fixtures/
│       └── render.tsx          # providers + router test harness
└── test/e2e/
    └── demo-path.spec.ts
```

**Rules**

- A page folder owns its page-level components. Shared components live in `components/` and must be used by more than one page (or be listed in §11).
- `lib/` never imports from `pages/` or `components/`.
- `components/` never imports from `pages/`.
- `generated/` is never hand-edited; regenerate with `snet codegen` / `snet export addresses`.
- No barrel `index.ts` files that re-export whole folders; import the module directly to keep tree-shaking honest.

### 22.2 Naming

| Kind | Convention | Example |
|---|---|---|
| Component file | `PascalCase.tsx` | `VerdictBadge.tsx` |
| Component folder | `PascalCase/` | `IncidentRow/` |
| CSS module | `PascalCase.module.css` | `VerdictBadge.module.css` |
| Hook | `useThing.ts`, named export `useThing` | `useIncident.ts` |
| Utility | `camelCase.ts` | `formatDate.ts` or grouped `format.ts` |
| Page | `PascalCase/Page.tsx` exporting `HomePage` | `pages/Home/HomePage.tsx` |
| Test | co-located `*.test.tsx` | `VerdictBadge.test.tsx` |
| E2E | `*.spec.ts` | `demo-path.spec.ts` |
| Constant | `SCREAMING_SNAKE_CASE` | `MAX_EVIDENCE_ITEMS` |
| Type | `PascalCase`, no `I` prefix | `PublicIncident` |

- Route file names match the route: `IncidentDetail`, `SystemDetail`, `PolicyGaps`.
- Do not pluralize inconsistently: the route is `/incidents`, the page is `IncidentsPage`, the row is `IncidentRow`.

### 22.3 CSS modules

```css
/* VerdictBadge.module.css */
.root {
  display: inline-flex;
  align-items: center;
  gap: var(--sn-space-2);
  padding: 2px var(--sn-space-2);
  border: var(--sn-border-width) solid var(--sn-verdict-violation-border);
  border-radius: var(--sn-radius-pill);
  background: var(--sn-verdict-violation-bg);
  color: var(--sn-verdict-violation);
  font-size: var(--sn-text-sm);
  font-weight: var(--sn-weight-label);
  white-space: nowrap;
}

.root[data-verdict="POLICY_ADEQUATE_BUT_HARM"] {
  border-color: var(--sn-verdict-gap-border);
  background: var(--sn-verdict-gap-bg);
  color: var(--sn-verdict-gap);
}
```

**Rules**

1. One module per component, same basename as the component.
2. Class names are `camelCase` and describe structure (`root`, `header`, `meta`), not appearance (`redBox`, `bigText`).
3. Variants use data attributes on the root: `[data-verdict]`, `[data-severity]`, `[data-state="open"]`, `[data-tone="warn"]`. No `.isOpen`, no `.active`, no `.variantB`.
4. No CSS nesting. No `@apply`. No preprocessor.
5. No `!important`. If a third-party style must be overridden, do it once in `base.css` with a comment naming the library.
6. No global selectors in module files except `:global()` for a documented third-party override.
7. No `:hover` without a matching `:focus-visible` for interactive elements.
8. Hover rules are wrapped in `@media (hover: hover) and (pointer: fine)` when the hover style is the only affordance.
9. No inline `style` attributes except a single documented exception: a CSS custom property used for a measured value (e.g., a progress width). Severity bars and verdicts must not use inline styles.
10. No hardcoded colors, spacing, radii, font sizes, durations, or z-index values. Tokens or nothing. A lint rule (`stylelint` with a custom regex or a Vitest source scan) fails on `#[0-9a-f]{3,8}` and `px` values outside `tokens.css`.
11. `composes` is allowed only from `base.module.css` for typography resets; prefer explicit classes.

### 22.4 Component contract

```ts
export interface VerdictBadgeProps {
  verdict: Verdict;
  severity?: Severity | null;
  confidence?: Confidence | null;
  size?: "sm" | "md";
  className?: string;
}

export function VerdictBadge({ verdict, severity, confidence, size = "md", className }: VerdictBadgeProps) {
  // …
}
```

**Rules**

- Named exports only. No default exports in library code (`AGENTS.md` §3.3).
- Props interfaces are exported when a page or test needs them.
- No `React.FC`. No `any` without a `// reason:` comment.
- `className` is accepted and merged last, never used to change semantics.
- Components render semantic HTML with accessible names by default; a component must be usable without a wrapper adding ARIA.
- Components do not fetch. Data arrives via props or a page-level hook.
- Components do not read the URL directly; route params and query state arrive via `useRoute()`.
- Every component that can be in a non-default state implements the relevant states from Appendix D.

### 22.5 Router

The router is small, typed, and history-based. No dependency unless the owner approves one; the reference implementation is ~120 lines.

```ts
// lib/router.tsx (reference shape)
export type Route =
  | { name: "home" }
  | { name: "incidents" }
  | { name: "incident"; incidentId: string }
  | { name: "report" }
  | { name: "systems" }
  | { name: "system"; systemId: string }
  | { name: "policy-gaps" }
  | { name: "provider" }
  | { name: "about" }
  | { name: "data" }
  | { name: "embed"; systemId: string }
  | { name: "not-found"; path: string };

export function parseRoute(pathname: string): Route { /* exact match table, no regex sprawl */ }
export function href(route: Route, query?: Query): string { /* always emits canonical URLs */ }
```

**Rules**

- `href()` is the only place that builds URLs. Pages never concatenate path strings.
- `Link` renders a real `<a href>`; it intercepts only plain left clicks without modifier keys, and only for same-origin routes.
- `popstate` is handled; scroll restoration is manual: back/forward restores the previous scroll position, new navigations scroll to top.
- Unknown paths render `NotFoundPage` with a 404-style message; they do not redirect silently.
- Trailing slashes redirect to the canonical path with `replaceState`.
- Query parsing ignores unknown keys; invalid values fall back to defaults and are removed from the URL with `replaceState` (no redirect loop).
- The router owns `document.title` and the `route-announcer` announcement. Pages provide `title` and `announce` via a `usePageMeta()` hook.

### 22.6 Data layer

```ts
// lib/hooks/useAsync.ts (reference shape)
export interface AsyncState<T> {
  status: "idle" | "loading" | "success" | "error";
  data: T | null;
  error: Error | null;
  reload: () => void;
}

export function useAsync<T>(key: string, fn: (signal: AbortSignal) => Promise<T>, deps: unknown[]): AsyncState<T> {
  // AbortController per run; ignore stale resolutions; cache by key with TTL; no state update after unmount.
}
```

**Rules**

- One `createClient()` instance per app, created lazily in `lib/client.ts`. Never at module scope in a component file.
- The chain client is dynamically imported; a route that does not need it must not include it in its chunk.
- All live reads go through `lib/data/live.ts`; components never call `client.contract()` directly.
- All index access goes through `lib/data/index.ts`; it validates the payload shape and rejects unknown `schemaVersion` with a clear error.
- Cache: index for the session (revalidate on focus after 15 minutes), detail reads for 30 seconds (`AGENTS.md` §23.5). Writes invalidate the affected incident key immediately.
- Request deduplication: two components asking for the same key share one in-flight promise.
- Abort on unmount and on route change.
- No polling for reads. Polling exists only for a tracked transaction, with adaptive backoff (500ms → 1s → 2s → 3s cap) and a pause when `document.hidden`.
- Demo mode swaps the adapter in `lib/data/demo.ts`; pages do not branch on mode.

### 22.7 State rules

| State | Where it lives | Example |
|---|---|---|
| Filters, sort, page, search | URL query | `/incidents?verdict=POLICY_VIOLATION&page=2` |
| Selected tab within a page | URL hash or local state if not shareable | `#evidence` |
| Form step and field values | Local component state | Filing flow |
| Theme | `localStorage` + `data-theme` | `snet-theme` |
| Wallet connection | Wallet context | Address, chain ID |
| Network/config | Build-time constants + context | `VITE_SNET_NETWORK` |
| Transaction status | Local state in the action component | `TxProgress` |

**Rules**

- No global store. No Redux, Zustand, Jotai, MobX, or a hand-rolled event bus.
- Exactly two React contexts are allowed: `ThemeContext` and `AppConfigContext` (network, addresses, data mode). A third requires owner approval.
- Derived data is computed during render or with `useMemo`; never stored in state and synchronized with effects.
- Do not mirror props into state. Do not store the same datum in two places.
- `useEffect` is for external synchronization only (subscriptions, fetch, focus), never for deriving state.

### 22.8 Configuration and environment

| Variable | Required | Purpose |
|---|---|---|
| `VITE_SNET_NETWORK` | yes | `studionet`, `local`, `bradbury`, `sim` |
| `VITE_SNET_CONTRACT_ADDRESS` | yes in chain mode | Overrides `generated/addresses.ts` |
| `VITE_INDEX_URL` | no | Default `/data/incidents.json` |
| `VITE_DATA_MODE` | no | `chain` (default) or `demo` |
| `VITE_SNET_COMMIT` | no | Build commit for the footer |
| `VITE_SNET_VERSION` | no | App version for the footer |

**Rules**

- All env access goes through `lib/config.ts`, validated once at startup with zod. No `import.meta.env` reads elsewhere.
- Missing required configuration fails loudly **before** rendering: a full-page error with the missing key, the expected shape, and a link to the deploy docs. Never render the app with `undefined` addresses (`AGENTS.md` §20.10).
- `demo` mode requires an explicit value; a production build without `VITE_DATA_MODE` is chain mode and must have an address.
- No secrets in `VITE_*`. Everything is public by definition.
- The footer shows network + version + commit so a screenshot can be tied to a build.

### 22.9 Errors and boundaries

- One route-level `ErrorBoundary` around the outlet, reset on route change.
- The boundary renders `ErrorState` with a stable code (`E9000`) and a “Copy diagnostics” button that copies: build version, commit, network, route, timestamp, and the error message. No stack trace, no claim text, no wallet address.
- Known failures map to friendly copy via the reason-code table (`AGENTS.md` §22.7). An unknown reason code shows the code plus “Unknown reason — please report this.”
- Never render `error.message` from the chain directly if it may contain user text; map to the catalogue first.
- Promise rejections that are not user-visible are logged once to the console in development only.
- No global `window.onerror` handler that swallows errors.

### 22.10 Formatting utilities

| Function | Contract |
|---|---|
| `formatDate(iso, { zone: "utc" })` | “2 Nov 2026” |
| `formatDateTime(iso)` | “2 Nov 2026, 10:14 UTC” — always explicit zone |
| `formatRelative(iso, now)` | “3 days ago”; always paired with an absolute time |
| `formatCount(n)` | `Intl.NumberFormat("en")`, no compact notation under 10,000 |
| `formatBytes(n)` | “20 KB”, binary or decimal stated once in docs |
| `shortHash(h)` | `sha256:9f2c…a41d` — 4 leading, 4 trailing, never fewer |
| `shortAddress(a)` | `0xAb12…77Ef` |
| `formatPercent(n, d)` | “14% (7 of 50)”; never a percentage without a denominator |
| `formatDuration(ms)` | “1.4 s”; one decimal under 10s |

**Rules**

- No `toLocaleString()` without explicit options.
- No date math in components; use `Date` + `Intl` or a shared helper.
- Never format a number with more precision than the source supports.
- Hash truncation is visual only; the full value is always in the DOM (§18.6).

### 22.11 TypeScript and lint

- `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`.
- No `any` without a `// reason:` comment. No `as` casts across module boundaries; validate with zod instead.
- Domain enums come from `@safetynet/core` (`VERDICTS`, `SEVERITIES`, `CONFIDENCES`, `INCIDENT_STATUSES`, reason codes). Never redeclare them.
- Contract types come from `generated/SafetyNet.ts`. Never hand-write a duplicate interface.
- Discriminated unions for async and tx state; exhaustive `switch` with a `never` check.
- Biome for format and lint; `pnpm lint` and `pnpm typecheck` must pass with zero warnings.
- Imports sorted by Biome; no circular imports (checked in CI with `madge` or an ESLint-equivalent rule).
- No `console.log` in `src/`. A custom logger is allowed for errors and is stripped in production except for `error`.

### 22.12 i18n readiness (English only in v1)

- No string concatenation to build sentences. Use template functions that return a complete sentence: `claimTooShort(min)` → “Add at least 20 characters (12 so far).”
- No pluralization via `+ "s"`. Use `Intl.PluralRules` even in English.
- Dates and numbers via `Intl`, never manual formatting.
- Do not embed text in images. There are no images.
- User-generated content is never translated or transformed.
- All shared strings live in `lib/copy.ts`; page-specific copy lives beside the page. Both are plain exported constants/functions.

### 22.13 Canonical snippets

**Verdict badge (semantics are normative; styling lives in the module)**

```tsx
const VERDICT_COPY: Record<Verdict, { label: string; icon: IconName }> = {
  POLICY_VIOLATION: { label: "Policy violation", icon: "alert-triangle" },
  POLICY_ADEQUATE_BUT_HARM: { label: "Policy gap", icon: "half-circle" },
  INSUFFICIENT_EVIDENCE: { label: "Insufficient evidence", icon: "help-circle" },
  OUT_OF_SCOPE: { label: "Out of scope", icon: "slash-circle" },
  DISMISSED: { label: "Dismissed", icon: "check-circle" },
};

export function VerdictBadge({ verdict, severity, confidence, size = "md", className }: VerdictBadgeProps) {
  const { label, icon } = VERDICT_COPY[verdict];
  const showSeverity = severity && (verdict === "POLICY_VIOLATION" || verdict === "POLICY_ADEQUATE_BUT_HARM");

  return (
    <span className={cx(styles.root, className)} data-verdict={verdict} data-size={size}>
      <Icon name={icon} aria-hidden />
      <span className={styles.label}>{label}</span>
      {showSeverity ? <SeverityMeter severity={severity} /> : null}
      {confidence ? <ConfidenceLabel confidence={confidence} /> : null}
    </span>
  );
}
```

**Transaction tracking**

```tsx
const tx = contract.write.file_incident(args, { wait: "ACCEPTED" });
const unsubscribe = tx.on("status", (event) => {
  setEvents((prev) => [...prev, event]);
  announce(`Transaction ${event.status.toLowerCase()}.`); // polite live region
});

try {
  const result = await tx.result;
  navigate(href({ name: "incident", incidentId: result }));
} catch (error) {
  setFailure(mapTxError(error)); // reason code → friendly copy
} finally {
  unsubscribe();
}
```

**Never** show a success state before the status is `ACCEPTED`. Show “Decided, awaiting finality” when the target is `FINALIZED` and the status is `ACCEPTED` (`AGENTS.md` §22.3).

---

## 23. TESTING AND QUALITY ASSURANCE

### 23.1 Pyramid

| Layer | Tool | Scope | Speed target |
|---|---|---|---|
| Unit | Vitest + Testing Library | Components, formatting, validation, hash utils | < 50 ms per test |
| Integration | Vitest + fake adapter | Page + data layer + router with fixture index | < 500 ms per test |
| E2E | Playwright | Demo path, filing flow, a11y keyboard run | < 60 s total |
| Static | TypeScript, Biome, token scan, size-limit | Types, lint, design-token drift, bundle budgets | < 60 s |

- No snapshot tests of entire pages. Snapshot individual rendered strings only when the exact output is contractual (verdict label, disclaimer).
- No test depends on network access. The chain is always faked in unit and integration tests.

### 23.2 Required unit tests

Every component in §11 with behavior needs tests for:

1. Default render and accessible name.
2. Every variant that changes meaning (verdict, severity, confidence, status, tone).
3. Keyboard interaction (activation, Escape, arrow keys where applicable).
4. Disabled/loading/error states where applicable.
5. The semantic contract: icon is `aria-hidden`, label is text, test IDs exist.

**Non-negotiable assertions**

- `VerdictBadge`: `OUT_OF_SCOPE` never gets `data-verdict` styling that maps to danger; the label is exactly “Out of scope”.
- `SeverityMeter`: renders nothing for a non-violation verdict when passed `null`.
- `Hash`: the full hash is present in the DOM even when the visible text is short.
- `TxProgress`: never renders “Finalized” for `ACCEPTED`.
- `SyntheticBadge`: renders the literal text `SYNTHETIC`.
- `TrustNote` / disclaimer: exact string match against the canonical text in `AGENTS.md` §34.3 for the disclaimer and `docs/trust-boundary.md` for the table.

### 23.3 Required integration tests

| Scenario | Assertion |
|---|---|
| `/incidents` with 60 fixtures | 25 rows, pagination works, filters update the URL, empty state on impossible filter |
| `/incidents/:id` from index + chain | Header paints from index before the chain resolves; claim text appears after; no layout shift beyond CLS budget |
| Chain read fails | Section-level `ErrorState`, rest of page readable, retry works |
| Index/chain disagreement | Chain wins, stale-index notice appears |
| Policy hash mismatch | Clause text hidden, fallback shown, verdict still visible |
| Demo mode | Global banner, per-record `SYNTHETIC`, write shows “Simulated” |
| Missing contract address | Full-page configuration error, no partial render |
| `/policy-gaps` | Groups by (system, clause), counts match fixtures, export produces markdown |
| Theme boot | `data-theme` set before paint; toggle persists; only `snet-theme` stored |

### 23.4 End-to-end demo path

`test/e2e/demo-path.spec.ts` implements `AGENTS.md` §6.6 against the demo build:

1. Open `/`.
2. See the feed with five synthetic incidents and a visible demo banner.
3. Open one incident → verdict, clause citations, evidence hash, validator summary.
4. Navigate to `/report` → pick system → paste output → add evidence → review → acknowledge permanence → submit (simulated).
5. Watch the lifecycle: `PENDING → PROPOSING → COMMITTING → ACCEPTED → FINALIZED`.
6. Land on the new incident page with a verdict.
7. Open `/policy-gaps` → see clauses grouped by harm-without-violation.
8. Assert no banned words appear in visible text.
9. Assert every seed record shows `SYNTHETIC`.

The spec must run in CI on every PR and must not require a wallet, a network, or secrets.

### 23.5 Visual and state coverage

- A Playwright screenshot per P0 route in light and dark, at 390px and 1280px, stored as artifacts (not committed as binary snapshots).
- A “state gallery” route used only in development (`/__states`, excluded from production builds) rendering every component in every state for manual review. It must not ship in a production bundle (asserted by a build test).
- Appendix D is the source of truth for the states that must exist; the gallery is generated from it.

### 23.6 Accessibility testing

See §18.12. In CI:

- axe on every route × {default, loading, empty, error} × {light, dark}. Serious and critical violations fail the build.
- A custom test asserts one `h1` per page and no skipped heading levels.
- A token contrast test recomputes every documented pair from `tokens.css` and fails if any drops below §18.3.
- A Playwright keyboard-only test completes the filing flow without mouse events.

### 23.7 Contract parity tests

These catch drift between `apps/web` and the contract:

| Test | Fails when |
|---|---|
| Enum parity | `VERDICTS`, `SEVERITIES`, `CONFIDENCES`, `INCIDENT_STATUSES` differ from the contract’s lists |
| Reason-code parity | A contract reason code has no UI message, or a UI message has no code |
| Test-ID registry | A `data-testid` in code is missing from Appendix B, or an appendix entry is unused |
| Disclaimer parity | The UI string differs from the canonical text in `docs/trust-boundary.md` |
| Address parity | `generated/addresses.ts` is stale relative to `deployments/*.json` |
| Banned words | Any user-facing string contains a banned term outside the whitelist (Appendix H) |

### 23.8 Test data rules

- Fixtures are synthetic and labeled. A fixture file that looks like a real incident must carry `"synthetic": true`.
- No real names, real companies, real emails, or real URLs in fixtures. Use `example.com` and `Synthetic Chatbot`.
- Fixtures cover all five verdicts, all four severities, all three confidence bands, and all five statuses.
- Include adversarial fixtures: very long claim, RTL text, emoji, zero-width characters, a 2,000-character unbroken string, an empty evidence list, a 24-clause policy.
- Never copy production records into fixtures.

### 23.9 Flake rules

- No `waitForTimeout` in Playwright. Wait for a state, a role, or a response.
- No time-dependent assertions without a fixed clock (`vi.setSystemTime`).
- No test depends on another test’s state; each integration test mounts fresh.
- A flaky test is quarantined within 24 hours, fixed or deleted within a week, and never silently retried in CI.

### 23.10 Manual QA checklist (per user-facing PR)

- [ ] Demo path works end-to-end.
- [ ] Empty, loading, error, and offline states reachable and legible.
- [ ] Light and dark themes checked at 390px and 1280px.
- [ ] Keyboard-only pass on the changed flow.
- [ ] Zoom 200% and 400% checked.
- [ ] No banned words; disclaimer present where required.
- [ ] Every new number has a source, a date, and a denominator.
- [ ] No `TODO` in shipped copy.

### 23.11 Browser support matrix

Last two versions of Chrome, Firefox, Safari, and Edge. No IE, no legacy Edge. iOS Safari 16+ and Android Chrome 120+ are in scope. Test the filing flow on one mobile browser per release.

---

## 24. REVIEW CHECKLIST AND DEFINITION OF DONE

### 24.1 PR checklist (copy into the PR body)

```md
## Task
WEB-___ — <one line>

## What changed
- [ ] One logical change, one task id
- [ ] No unrelated refactors

## Verification
- [ ] `pnpm lint` clean
- [ ] `pnpm typecheck` clean
- [ ] `pnpm test` green (paste tail)
- [ ] `pnpm test:e2e` green or N/A with reason
- [ ] axe: no serious/critical on changed routes
- [ ] size-limit within budget

## Product
- [ ] Demo path still works
- [ ] No banned words (Appendix H)
- [ ] Disclaimer present on any verdict surface
- [ ] `SYNTHETIC` labels intact
- [ ] Every number has a source, date, and denominator
- [ ] Severity hidden for non-violation verdicts

## Accessibility
- [ ] Keyboard-only path works
- [ ] Icon + text, never color alone
- [ ] Focus moves correctly after navigation/dialog/error
- [ ] 200% zoom and 390px width checked

## Risk
- [ ] New dependency? Justified + license checked
- [ ] New copy? Added to the copy deck
- [ ] New test ID? Added to Appendix B
- [ ] Contract change? N/A for web PRs unless generated types changed
```

### 24.2 Design review checklist

- [ ] The screen answers: what happened, what was pinned, who responded, what was decided, what it does not prove.
- [ ] The verdict is the most prominent element on an incident page, above the claim.
- [ ] No element implies guilt, liability, or a legal process.
- [ ] The policy gap concept is explained in plain language, not jargon.
- [ ] No score, ranking, streak, badge, or gamification element was introduced.
- [ ] No gradient, glow, glass, neon, or decorative illustration.
- [ ] Typography uses the display/body/mono roles correctly; no all-caps sentences.
- [ ] Color is reinforcement, never the only signal.
- [ ] Empty states are designed, not accidental.
- [ ] The page is legible in a 390px screenshot without zooming.

### 24.3 Content review checklist

- [ ] Approved vocabulary only (§16.7).
- [ ] The disclaimer is verbatim where required.
- [ ] “Claimed” is never shortened to “verified.”
- [ ] “No provider response filed” is neutral and factual.
- [ ] Confidence is described as evidence completeness, not certainty.
- [ ] Relative dates are paired with absolute UTC timestamps.
- [ ] No sentence promises a legal outcome, an investigation, or enforcement.
- [ ] The trust-boundary link is present on every verdict surface.

### 24.4 Definition of Done

A UI task is done when all of the following are true:

1. Acceptance criteria in `AGENTS.md` §31.13 are met literally.
2. The page or component appears in Appendix D with all states implemented.
3. Test IDs exist and are registered in Appendix B.
4. Unit tests cover default + variants + keyboard + error.
5. The route works with no wallet for read-only content.
6. Light and dark themes pass contrast checks.
7. The demo path still passes.
8. The copy deck is updated for any new user-facing string.
9. No banned words; disclaimer intact.
10. Performance budgets unchanged or improved.
11. A changeset exists (`.changeset/*.md`).
12. The PR checklist is complete and honest.

### 24.5 What we will not do to pass review

- Delete or skip an accessibility test.
- Replace a text label with a color or an icon alone.
- Hide severity for a violation to “clean up” the layout.
- Invent a number to fill a stat.
- Remove the `SYNTHETIC` badge for a nicer screenshot.
- Soften the disclaimer.
- Add a dependency to avoid writing 40 lines of CSS.
- Ship the prototype “temporarily.”

If a rule is wrong, change this file first, then the code.

---

## 25. BACKLOG MAPPING

`AGENTS.md` §31.13 defines the tasks. This table maps them to the sections that specify them and the artifact that proves completion.

| Task | Spec sections | Proof |
|---|---|---|
| WEB-001 App shell + routing | §4, §5, §22.5 | All P0 routes render; footer shows network; 404 works |
| WEB-002 Incident feed | §12.2, §14.10 | Filters, sort, pagination, URL state, empty/error |
| WEB-003 Incident page | §12.3, §17.10 | Nine sections; disclaimer; trust boundary link |
| WEB-004 Systems list/page | §12.5, §12.6 | Claimed badge, policy versions, stats with denominators |
| WEB-005 Policy gaps | §12.7 | Grouped by (system, clause); markdown export |
| WEB-006 About / trust boundary | §12.9, §17.1, §17.2 | Verbatim disclaimer + table; legal review |
| WEB-010 Design tokens | §6, Appendix A | `tokens.css` only; token scan passes |
| WEB-011 Verdict badge | §11.4, §9.2, §23.2 | Icon + text; `OUT_OF_SCOPE` neutral; axe clean |
| WEB-012 Tx stepper | §11.19, §15 | Full lifecycle; no premature success; reduced motion |
| WEB-020 Report step 1 | §12.4, §11.31 | System + policy version, pinned hash shown |
| WEB-021 Report step 2 | §12.4, §16.5 | Claim field, counter, PII warning |
| WEB-022 Report step 3 | §12.4, §11.21 | Evidence repeater, live hash, allowlist errors |
| WEB-023 Report step 4 | §12.4, §17.10 | Canonical manifest preview, permanence checkbox |
| WEB-024 Report step 5 | §12.4, §15 | Wallet, submit, stepper, redirect |
| WEB-025 Validation parity | §22.6, §23.7 | Shared validator from core; parity test |
| WEB-026 Keyboard path | §18.4, §18.7 | Playwright keyboard-only filing |
| WEB-030 Provider claim | §12.8, §17.3 | Claim flow, warning, no “verified” |
| WEB-031 Provider open incidents | §12.8, §14.11 | Deadline from chain time, skew note |
| WEB-032 Provider respond | §12.8, §15.3 | Defense + evidence, permanence warning |
| WEB-033 Provider appeal | §12.8, §13.4 | Visible only when eligible; window copy |
| WEB-034 Provider publish policy | §12.8, §13.7 | Hash + clause IDs + pinned-version warning |
| WEB-040 Appeal history | §11.29, §12.3 | Timeline with prior verdicts preserved |
| WEB-050 Embed widget | §12.11, §19.2 | No wallet, no cookies, responsive |
| WEB-060 Empty/error states | §14.9, Appendix D | Every state implemented and tested |
| E2E-001 Demo path | §6.6 (AGENTS), §23.4 | `test/e2e/demo-path.spec.ts` green |
| API-001 Static export | §14.2 | Deterministic ordering; CI job |
| API-002 Export schema doc | §14.2 | JSON Schema published |
| API-003 Policy-gap report | §12.7 | `data/policy-gaps.md` regenerated in CI |
| API-004 Query snippets | §12.10 | ≥ 5 copy-paste examples |
| GEN-005 Address export | §22.8 | Generated header; fail-loud startup |
| SEC-010…012 Injection display | §21.3 | Untrusted text rendered as text; adversarial fixtures |

**Not in v1 UI scope** (do not build without owner approval): system registration form, indexed query API (API-010), notifications, email digests, accounts, saved searches, comparison views, provider analytics dashboards, multi-language UI, comments, upvotes.

---

## 26. OPEN QUESTIONS

Each item has a default already implemented by this spec. Do not invent a different answer.

| ID | Question | Default taken | Impact if changed |
|---|---|---|---|
| O-01 | Is `contentSha256` for URL evidence computed over raw bytes, rendered text, or a normalized extract? | Treat it as the hash of the captured text the reporter saw; label it “captured text hash” in the UI. Do not fetch the URL in the browser. | Evidence copy, verification wording, contract docs |
| O-02 | How is policy text normalized before hashing, and is the browser normalizer identical to the contract’s? | Publish one normalizer spec with golden fixtures; the UI uses the shared implementation and fails closed on mismatch. | Policy display, hash verification, `snet policy hash` |
| O-03 | Which wallets are supported? | One injected EIP-1193 provider, one connector, no WalletConnect in v1. | `/report` step 5, provider console, CSP |
| O-04 | Who registers systems in the UI? | Nobody in v1. Registration is a CLI/ops action; the UI is read-only for systems. | `/systems`, provider console scope |
| O-05 | Is the index same-origin (`/data/incidents.json`) or a separate CDN? | Same-origin, published by CI, cached with HTTP headers. | CSP `connect-src`, CORS, deploy config |
| O-06 | The contract stores severity for every verdict; should the UI ever show it for `DISMISSED` / `INSUFFICIENT_EVIDENCE` / `OUT_OF_SCOPE`? | No. Hide it; severity is meaningful only for violation and gap. | Verdict card, exports, OG cards |
| O-07 | What is the canonical citation format for a verdict? | `inc-000001 · <url> · round 1 · evidence sha256:… · policy v1.0.0 (sha256:…)`. | `/data` citation block, docs, social copy |
| O-08 | Should `/embed/*` allow all framers or an allowlist? | Allow all framers via `frame-ancestors *` for v1; revisit if abused. | CSP, abuse handling |
| O-09 | When does an indexed API (API-010) become necessary? | Only if index size or query needs exceed client-side filtering; document the decision either way. | Architecture, hosting |
| O-10 | What sample size is required before showing a median response time? | `n ≥ 5`; below that show “Not enough responses to report a median.” | System page, exports |
| O-11 | **(Resolved 2026-10-28)** When must the hash router be replaced by path routing? | Done: `lib/router.tsx` uses the History API and `vercel.json` rewrites; path routing is the only production mode. Hash routing remains a degraded fallback for hosts that cannot rewrite. | None; keep the rewrite verified in the release checks. |
| O-12 | If a provider blocks CORS on the policy URL, what does the UI show? | Fallback: clause IDs + hash + source link + “Policy text unavailable.” No proxy, no backend. | Policy section, verification copy |
| O-13 | How prominent are the permissionless `adjudicate` and `finalize` actions? | Secondary actions inside an “Actions” block with an explanation; never the page’s primary CTA. | Incident page, provider console |
| O-14 | At what index size do we split into monthly shards? | At 350 KB or 1,000 incidents, publish a manifest + shards. | Data layer, CI export |
| O-15 | Who owns the accessibility statement and the contact address? | Owner, with a GitHub issue template as the contact path. | `/about#accessibility` |
| O-16 | Do we accept generic social metadata for every route, or add a build-time meta shell per incident/system? | Generic metadata in v1; a static per-route meta shell is the M2 option. No runtime SSR, no client-side OG. | Appendix F.3, sharing quality |

---

## 27. CHANGELOG OF THIS DOCUMENT

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-10-28 | Initial normative UI specification: thesis, brand, IA, tokens, components, pages, flows, data model, tx UX, copy, legal/trust UI, accessibility, responsive, performance, privacy, conventions, testing, review, backlog mapping, appendices |

---

## APPENDIX A — `apps/web/src/styles/tokens.css` (normative)

This file is the single source of every token. Components may not introduce colors, fonts, radii, durations, or z-index values. Values here match §6.2–§6.7; if they diverge, this appendix wins and §6 is corrected in the same PR.

```css
/* ==========================================================================
   SafetyNet design tokens
   Single source of truth. Do not define design values outside this file.
   Theme is resolved before paint and set on <html data-theme="light|dark">.
   ========================================================================== */

:root {
  /* ---------- Type families (system only, zero web-font requests) ---------- */
  --sn-font-display: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
  --sn-font-body: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --sn-font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;

  /* ---------- Type scale ---------- */
  --sn-text-xs: 0.75rem;      /* 12px */
  --sn-text-sm: 0.8125rem;    /* 13px */
  --sn-text-base: 1rem;       /* 16px */
  --sn-text-md: 1.0625rem;    /* 17px */
  --sn-text-lg: 1.25rem;      /* 20px */
  --sn-text-xl: 1.5rem;       /* 24px */
  --sn-text-2xl: 1.875rem;    /* 30px */
  --sn-text-3xl: 2.375rem;    /* 38px */
  --sn-text-4xl: clamp(2.5rem, 2rem + 2.5vw, 3.5rem);

  --sn-leading-xs: 1.45;
  --sn-leading-sm: 1.5;
  --sn-leading-base: 1.6;
  --sn-leading-md: 1.6;
  --sn-leading-lg: 1.35;
  --sn-leading-xl: 1.25;
  --sn-leading-2xl: 1.2;
  --sn-leading-3xl: 1.12;
  --sn-leading-4xl: 1.05;

  --sn-weight-regular: 400;
  --sn-weight-medium: 500;
  --sn-weight-semibold: 600;
  --sn-weight-label: 650;   /* resolves to the nearest available system weight */
  --sn-weight-bold: 700;

  /* ---------- Spacing (4px base) ---------- */
  --sn-space-1: 0.25rem;
  --sn-space-2: 0.5rem;
  --sn-space-3: 0.75rem;
  --sn-space-4: 1rem;
  --sn-space-5: 1.25rem;
  --sn-space-6: 1.5rem;
  --sn-space-8: 2rem;
  --sn-space-10: 2.5rem;
  --sn-space-12: 3rem;
  --sn-space-16: 4rem;
  --sn-space-20: 5rem;

  /* ---------- Layout ---------- */
  --sn-container: 1080px;
  --sn-container-wide: 1200px;
  --sn-container-form: 720px;
  --sn-container-prose: 68ch;
  --sn-rail: 320px;
  --sn-gutter: 20px;
  --sn-header-height: 64px;
  --sn-tap: 44px;

  /* ---------- Radii ---------- */
  --sn-radius-xs: 3px;
  --sn-radius-sm: 5px;
  --sn-radius-md: 8px;
  --sn-radius-lg: 12px;
  --sn-radius-pill: 999px;

  /* ---------- Borders and shadows ---------- */
  --sn-border-width: 1px;
  --sn-shadow-sm: 0 1px 2px rgb(21 23 26 / 0.05);
  --sn-shadow-md: 0 2px 8px rgb(21 23 26 / 0.06), 0 1px 2px rgb(21 23 26 / 0.04);

  /* ---------- Motion ---------- */
  --sn-duration-fast: 120ms;
  --sn-duration-base: 180ms;
  --sn-duration-slow: 240ms;
  --sn-ease: cubic-bezier(0.2, 0, 0, 1);

  /* ---------- Z-index (these four values only) ---------- */
  --sn-z-header: 20;
  --sn-z-menu: 30;
  --sn-z-dialog: 40;
  --sn-z-toast: 50;
}

/* ==========================================================================
   Light theme (default)
   ========================================================================== */

:root,
:root[data-theme="light"] {
  color-scheme: light;

  --sn-bg: #FAF9F5;
  --sn-surface: #FFFFFF;
  --sn-surface-2: #F3F1EA;
  --sn-surface-3: #ECE9E0;

  --sn-ink: #15171A;
  --sn-text: #15171A;
  --sn-text-secondary: #40454D;
  --sn-muted: #5F6B7A;

  --sn-border: #DDD8CC;
  --sn-border-strong: #B5AFA2;
  --sn-rule: #E7E2D6;

  --sn-accent: #1E4E79;
  --sn-accent-hover: #163A5A;
  --sn-accent-soft: #EAF1F8;
  --sn-accent-contrast: #FFFFFF;
  --sn-focus: #2563EB;

  --sn-danger: #B42318;
  --sn-danger-soft: #FEF3F2;
  --sn-danger-border: #FECDCA;

  --sn-warn: #B54708;
  --sn-warn-soft: #FFFAEB;
  --sn-warn-border: #FEDF89;

  --sn-ok: #067647;
  --sn-ok-soft: #ECFDF3;
  --sn-ok-border: #ABEFC6;

  --sn-neutral: #475467;
  --sn-neutral-soft: #F2F4F7;
  --sn-neutral-border: #D0D5DD;
}

/* ==========================================================================
   Dark theme
   ========================================================================== */

:root[data-theme="dark"] {
  color-scheme: dark;

  --sn-bg: #0D1117;
  --sn-surface: #141A22;
  --sn-surface-2: #1A222C;
  --sn-surface-3: #202A36;

  --sn-ink: #F2F4F7;
  --sn-text: #F2F4F7;
  --sn-text-secondary: #C9D0DA;
  --sn-muted: #98A2B3;

  --sn-border: #2A3441;
  --sn-border-strong: #3D4A5C;
  --sn-rule: #222C37;

  --sn-accent: #9DC7F2;
  --sn-accent-hover: #C3DDFA;
  --sn-accent-soft: #132A3F;
  --sn-accent-contrast: #0D1117;
  --sn-focus: #7AB7FF;

  --sn-danger: #FDA29B;
  --sn-danger-soft: #2A1512;
  --sn-danger-border: #5B2A24;

  --sn-warn: #FEC84B;
  --sn-warn-soft: #2A1F0B;
  --sn-warn-border: #5C4712;

  --sn-ok: #75E0A7;
  --sn-ok-soft: #0E2519;
  --sn-ok-border: #1E5138;

  --sn-neutral: #D0D5DD;
  --sn-neutral-soft: #1A222C;
  --sn-neutral-border: #3D4A5C;
}

/* ==========================================================================
   Verdict aliases
   Components MUST use these, never the raw semantic tokens.
   Aliases resolve against the active theme's semantic values.
   ========================================================================== */

:root {
  --sn-verdict-violation: var(--sn-danger);
  --sn-verdict-violation-bg: var(--sn-danger-soft);
  --sn-verdict-violation-border: var(--sn-danger-border);

  --sn-verdict-gap: var(--sn-warn);
  --sn-verdict-gap-bg: var(--sn-warn-soft);
  --sn-verdict-gap-border: var(--sn-warn-border);

  --sn-verdict-neutral: var(--sn-neutral);
  --sn-verdict-neutral-bg: var(--sn-neutral-soft);
  --sn-verdict-neutral-border: var(--sn-neutral-border);

  --sn-verdict-dismissed: var(--sn-ok);
  --sn-verdict-dismissed-bg: var(--sn-ok-soft);
  --sn-verdict-dismissed-border: var(--sn-ok-border);
}

/* ==========================================================================
   Responsive token adjustments
   (Media query conditions use literals; only values change here.)
   ========================================================================== */

@media (max-width: 767px) {
  :root {
    --sn-header-height: 56px;
  }
}

@media (max-width: 479px) {
  :root {
    --sn-gutter: 16px;
    --sn-header-height: 56px;
  }
}

/* ==========================================================================
   Reduced motion: token values set to zero so every consumer is covered
   ========================================================================== */

@media (prefers-reduced-motion: reduce) {
  :root {
    --sn-duration-fast: 0.01ms;
    --sn-duration-base: 0.01ms;
    --sn-duration-slow: 0.01ms;
  }
}
```

**Rules for using tokens**

1. A component may not define `--sn-*` values. It may set a non-token custom property locally (e.g. `--row-index`) for a documented layout need.
2. Verdict surfaces use the verdict aliases only. A `[data-verdict="DISMISSED"]` rule must not reference `--sn-ok` directly.
3. `--sn-shadow-md` is for dialogs and the mobile menu only. Cards use borders.
4. `--sn-z-toast` is reserved; no toast component exists in v1.
5. `--sn-text-4xl` is used on the home page only.

---

## APPENDIX B — `data-testid` registry

### B.1 Rules

- Format: kebab-case, ASCII, stable. `page-<route>` on the route’s root element; `<area>-<thing>` for everything else.
- One `data-testid` per element. It is a test hook, never a style hook, never a substitute for a role or label.
- Renaming a registered ID requires a changelog entry and a codemod in the same PR.
- Prefer accessible queries (`getByRole`, `getByLabelText`) in tests. Use `getByTestId` only when no accessible query identifies the element.
- Test IDs must not encode data (`incident-row-inc-000001` is forbidden; use `incident-row` plus `data-incident-id`).
- Every ID listed here must exist in at least one rendered state. A parity test scans the source for `data-testid="…"` and compares against this appendix.

### B.2 Shell

| ID | Element | Notes |
|---|---|---|
| `app` | Root shell | Wraps header, main, footer |
| `skip-link` | `<a href="#main">` | First focusable |
| `primary-nav` | `<nav aria-label="Primary">` | Desktop and mobile share the ID; only one is rendered at a time |
| `mobile-menu-button` | `<button aria-expanded>` | Hidden ≥ 768 |
| `theme-toggle` | `<button>` | Name is the action |
| `route-announcer` | Live region | Polite, visually hidden |
| `tx-announcer` | Live region | Polite, visually hidden |
| `copy-announcer` | Live region | Polite, visually hidden |
| `network-badge` | `<span>` | Network name, never a fake status dot |
| `network-mismatch` | Banner | `role="alert"` |
| `footer` | `<footer>` | Absent on `/embed/*` |

### B.3 Pages

| Route | Root ID | Additional IDs |
|---|---|---|
| `/` | `page-home` | `home-hero`, `home-stats`, `home-latest`, `home-gaps`, `home-how`, `home-trust` |
| `/incidents` | `page-incidents` | `filter-bar`, `result-summary`, `incident-list-table`, `incident-list-cards`, `incident-row`, `pagination`, `incidents-empty`, `incidents-error` |
| `/incidents/:id` | `page-incident` | `incident-header`, `incident-verdict`, `incident-actions`, `record-details`, `integrity-check`, `cited-clauses`, `claim-text`, `provider-response`, `evidence-section`, `policy-section`, `policy-unverified`, `appeal-history`, `raw-record`, `legal-disclaimer` |
| `/report` | `page-report` | `step-indicator`, `report-step-system`, `system-picker`, `policy-version-select`, `report-step-claim`, `claim-input`, `pii-warning`, `report-step-evidence`, `evidence-editor`, `evidence-item-editor`, `report-step-review`, `manifest-preview`, `evidence-hash`, `permanence-checkbox`, `report-step-submit`, `tx-progress` |
| `/systems` | `page-systems` | `systems-search`, `claim-filter`, `systems-table`, `systems-cards`, `system-row`, `systems-empty` |
| `/systems/:id` | `page-system` | `system-header`, `system-policies`, `incident-distribution`, `response-record`, `system-gaps`, `registry-details` |
| `/policy-gaps` | `page-policy-gaps` | `gap-explainer`, `gap-summary`, `gap-group`, `gap-export`, `gap-empty` |
| `/provider` | `page-provider` | `provider-anchor-nav`, `provider-systems`, `provider-open-incidents`, `provider-incident-row`, `claim-form`, `claim-confirm`, `respond-form`, `appeal-form`, `publish-policy-form`, `publish-policy-preview` |
| `/about` | `page-about` | `disclaimer`, `trust-boundary`, `verdict-table`, `claiming`, `synthetic-explainer`, `accessibility`, `security` |
| `/data` | `page-data` | `data-freshness`, `data-downloads`, `data-schema`, `data-snippets`, `data-citation`, `data-license` |
| `/embed/system/:id` | `page-embed` | `embed-summary`, `embed-verdict` |
| `*` | `page-not-found` | — |

### B.4 Components

| ID | Component | Notes |
|---|---|---|
| `verdict-badge` | `VerdictBadge` | Plus `data-verdict` |
| `verdict-summary` | `VerdictSummary` | The card, not the page section |
| `severity-meter` | `SeverityMeter` | Plus `data-severity`; absent for non-violation verdicts |
| `confidence-label` | `ConfidenceLabel` | Plus `data-confidence` |
| `provider-badge` | `ProviderBadge` | Plus `data-claimed="true\|false"` |
| `synthetic-badge` | `SyntheticBadge` | Text is `SYNTHETIC` |
| `freshness-note` | `FreshnessNote` | Plus `data-freshness="fresh\|stale\|unknown"` |
| `notice` | `Notice` | Plus `data-tone` |
| `empty-state` | `EmptyState` | — |
| `error-state` | `ErrorState` | Contains `error-code` |
| `error-code` | `ErrorState` | The reason code or client error kind |
| `skeleton` | `Skeleton` | `aria-hidden`, `aria-busy` on the region |
| `hash` | `Hash` | Full value in the DOM |
| `address` | `Address` | Full value in the DOM |
| `copy-button` | `CopyButton` | Name includes what is copied |
| `char-counter` | `CharacterCounter` | — |
| `evidence-item` | `EvidenceItem` | Plus `data-evidence-id` |
| `clause-card` | `ClauseCard` | Plus `data-clause-id`, `data-cited` |
| `trust-note` | `TrustNote` | — |
| `legal-disclaimer` | `LegalDisclaimer` | Verbatim block |
| `policy-version-table` | `PolicyVersionTable` | — |
| `incident-row` | `IncidentRow` | Plus `data-incident-id` |
| `filter-bar` | `FilterBar` | — |
| `pagination` | `Pagination` | — |
| `timeline` | `Timeline` | — |
| `system-picker` | `SystemPicker` | — |
| `step-indicator` | `StepIndicator` | — |
| `wallet-button` | `WalletButton` | Name states connection state |
| `dialog` | `Dialog` | Native `<dialog>` |
| `table` | `Table` | Wrapper region |
| `stat` | `Stat` | Plus `data-stat` |
| `tx-progress` | `TxProgress` | Plus `data-status` |

### B.5 Data attributes (behavioral contract)

| Attribute | Values | Used on |
|---|---|---|
| `data-verdict` | five verdict enums | `VerdictBadge`, `VerdictSummary`, incident row |
| `data-severity` | four severity enums | `SeverityMeter` |
| `data-confidence` | three confidence enums | `ConfidenceLabel` |
| `data-status` | five incident statuses | incident row, `TxProgress` (tx statuses) |
| `data-tone` | `info`, `warn`, `error`, `success` | `Notice`, `Badge` |
| `data-state` | `open`, `closed`, `loading`, `idle` | disclosures, menus, comboboxes |
| `data-freshness` | `fresh`, `stale`, `unknown` | `FreshnessNote` |
| `data-synthetic` | `true` | any record container |
| `data-mode` | `chain`, `demo` | `app` root |
| `data-claimed` | `true`, `false` | `ProviderBadge` |
| `data-cited` | `true`, `false` | `ClauseCard` |
| `data-evidence-id` | `e1`… | `EvidenceItem` |
| `data-clause-id` | `C1`… | `ClauseCard` |
| `data-incident-id` | `inc-000001` | `IncidentRow`, incident page root |
| `data-system-id` | slug | system page root, `SystemPicker` option |

### B.6 Reconciliation notes

These page-region names were corrected from earlier drafts and are authoritative here:

- The incident page’s verdict section is `incident-verdict`. The `VerdictSummary` component keeps `verdict-summary`.
- The system page’s policy list is `system-policies`. The reusable table keeps `policy-version-table`.
- Provider incident rows use `provider-incident-row`, never the public `incident-row`.
- The list table and card presentations are `incident-list-table` and `incident-list-cards` (§19.3).

---

## APPENDIX C — Icon set

### C.1 Construction

- 24×24 viewBox, `fill="none"`, `stroke="currentColor"`, `stroke-width="1.75"`, round caps and joins.
- Default render 20px; inline 16px; empty-state 32px.
- Icons are components: `<Icon name="alert-triangle" />`, typed by `IconName`.
- `aria-hidden="true"` unless the icon is the only content of a control, in which case the control carries an `aria-label` and the icon stays hidden.

### C.2 Verdict icons (canonical geometry)

```tsx
// alert-triangle — POLICY_VIOLATION
<path d="M12 3.5 21 20H3z" />
<path d="M12 9v5" />
<circle cx="12" cy="17.2" r="0.6" fill="currentColor" stroke="none" />

// half-circle — POLICY_ADEQUATE_BUT_HARM
<circle cx="12" cy="12" r="8.5" />
<path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none" />
// Documented exception: this is the only icon with a filled region.
// The fill is required to preserve the ◐ silhouette.

// help-circle — INSUFFICIENT_EVIDENCE
<circle cx="12" cy="12" r="8.5" />
<path d="M9.6 9.3a2.6 2.6 0 1 1 3.8 2.4c-.9.4-1.4 1-1.4 2.1" />
<circle cx="12" cy="17.2" r="0.6" fill="currentColor" stroke="none" />

// slash-circle — OUT_OF_SCOPE
<circle cx="12" cy="12" r="8.5" />
<path d="M6.2 6.2 17.8 17.8" />

// check-circle — DISMISSED
<circle cx="12" cy="12" r="8.5" />
<path d="m8.2 12.3 2.6 2.6 5-5.4" />
```

### C.3 Utility icons

| Name | Concept | Used by |
|---|---|---|
| `circle-dot` | Open status | Incident status |
| `message-square` | Response filed | Incident status |
| `stamp` | Decided | Incident status |
| `rotate-ccw` | Appeal filed | Incident status |
| `lock` | Final | Incident status |
| `clock` | Deadline | Response deadline, waiting |
| `arrow-up-right` | External link | Evidence source, docs |
| `copy` | Copy | `CopyButton` |
| `check` | Copied / selected | `CopyButton`, lists |
| `chevron-down` | Disclosure | `Accordion`, selects |
| `chevron-right` | Forward | Breadcrumbs |
| `menu` | Menu | Mobile header |
| `x` | Close | Dialog, menu |
| `sun` | Switch to light | Theme toggle (dark active) |
| `moon` | Switch to dark | Theme toggle (light active) |
| `search` | Search | `SearchInput` |
| `filter` | Filters | Mobile filter disclosure |
| `download` | Download | `/data` |
| `wallet` | Wallet | `WalletButton` |
| `info` | Information | `Notice tone=info` |
| `alert-triangle` | Warning | `Notice tone=warn` |
| `alert-circle` | Error | `Notice tone=error` |
| `check-circle` | Success | `Notice tone=success` |
| `shield` | Integrity check | `integrity-check` heading |
| `link` | Pinned source | Policy section |
| `hash` | Hash | Hash labels (optional; prefer no icon) |

### C.4 Forbidden iconography

No gavel, scales, handcuffs, police shield, badge/star, “100”, fire, rocket, sparkles, brains, robots, eyes, locks-as-security-claims, or checkmarks used to imply provider verification. A green check is reserved for `DISMISSED` and successful transactions.

---

## APPENDIX D — Page state matrix

Every state below must exist, be reachable in tests, and have designed copy. “—” means the state does not apply.

| Page | Loading | Empty | Error | Partial / degraded | Demo | No wallet |
|---|---|---|---|---|---|---|
| `/` | Skeleton for stats, latest, gaps | “No verdicts yet. File the first incident.” + report link | Stats hidden, `ErrorState` for the feed, rest of page readable | Stale index notice; stats show “as of” date | Banner + `SYNTHETIC` per record | Fully readable |
| `/incidents` | 25 row skeletons; filter bar interactive | “No incidents match these filters.” + clear filters; if no incidents at all, report CTA | `incidents-error`, retry | Stale notice; “Showing published index from …” | Banner + badges | Fully readable |
| `/incidents/:id` | Index header + section skeletons | `UNKNOWN_INCIDENT` state with ID and registry link | Section-level errors; page remains readable | Index/chain disagreement; policy unverified; evidence unavailable | Banner + simulated actions | Readable; write actions prompt connect |
| `/report` | Step 1 loading systems | “No systems registered yet.” + CLI hint | System load failure blocks step 1 with retry | Policy list unavailable for a system → block and explain | Simulated submit, no tx hash | Connect prompt at step 5 |
| `/systems` | Row skeletons | “No systems registered.” | `ErrorState` | Stale notice | Banner | Readable |
| `/systems/:id` | Header + table skeletons | “No incidents filed against this system.” | Section-level | Unclaimed provider warning; median suppressed when `n < 5` | Banner | Readable |
| `/policy-gaps` | Group skeletons | “No policy gaps found in this index.” + explainer | `ErrorState` | Stale notice | Banner | Readable |
| `/provider` | Section skeletons | “You have not claimed a system.” + claim form | Per-section errors | Wallet on wrong network; unclaimed systems read-only | Simulated actions | Wallet required for all actions |
| `/about` | None (static) | — | — | — | — | Readable |
| `/data` | Freshness skeleton | “No export published yet.” | Download failure notice | Stale index warning | Banner | Readable |
| `/embed/system/:id` | Compact skeleton | “No public record for this system.” | Compact error | Stale/unverified notices condensed | Banner | Readable |
| `*` | — | — | — | — | — | Readable |

### D.1 Transaction states (all write flows)

| State | `TxProgress` | Primary message | Allowed actions |
|---|---|---|---|
| Idle | Hidden | — | Submit |
| Signing | Step 1 active | “Confirm in your wallet.” | Cancel (wallet-controlled) |
| `PENDING` | Step 2 | “Submitted. Waiting for the network.” | Copy hash |
| `PROPOSING` | Step 3 | “Validators are evaluating the transaction.” | Copy hash |
| `COMMITTING` | Step 4 | “Validators are committing results.” | Copy hash |
| `REVEALING` | Step 5 | “Revealing validator votes.” | Copy hash |
| `ACCEPTED` | Step 6 complete | “Accepted. The appeal window is open.” | View record; appeal if eligible |
| `FINALIZED` | All complete | “Final. This record cannot be changed.” | View record |
| `UNDETERMINED` | Terminal, neutral tone | “Validators did not converge. No verdict was stored.” | Retry explanation; copy hash |
| `CANCELED` | Terminal, neutral tone | “Canceled. No change was made.” | Retry |
| Timeout | Terminal, warning | “Still not confirmed. Check the transaction before retrying.” | Copy hash; open explorer if configured |

### D.2 Non-state rules

- Never render a “0” for an unknown count. Show “—”, “Unknown”, or omit the stat with an explanation.
- Never render a success tone for `ACCEPTED` when the flow’s target is `FINALIZED`; say “Accepted, awaiting finality.”
- Never render `DISMISSED` in green with a checkmark when the verdict is `OUT_OF_SCOPE`; the latter is neutral with a slash.
- Every error state exposes the reason code and a retry, except permanent errors (`UNKNOWN_INCIDENT`, `POLICY_DRIFT` at display time).

---

## APPENDIX E — Copy deck quick reference

### E.1 Source of truth

- The full deck is §16.3. This appendix lists only the strings that are **contractual** and must not be reworded without an owner decision.
- The disclaimer (§17.1) and the trust-boundary table (§17.2) are verbatim requirements from `AGENTS.md` §34. They are not “copy”; they are legal text.
- A parity test compares the constants in `apps/web/src/lib/copy.ts` against `AGENTS.md` §34.3 and the trust-boundary module against `docs/trust-boundary.md`, failing on any character difference.

### E.2 Strings that must match exactly

| Key | Exact string | Where |
|---|---|---|
| `verdict.POLICY_VIOLATION` | Policy violation | Badge, card, OG |
| `verdict.POLICY_ADEQUATE_BUT_HARM` | Policy gap | Badge, card, OG |
| `verdict.INSUFFICIENT_EVIDENCE` | Insufficient evidence | Badge, card, OG |
| `verdict.OUT_OF_SCOPE` | Out of scope | Badge, card, OG |
| `verdict.DISMISSED` | Dismissed | Badge, card, OG |
| `incident.noResponse` | No provider response filed. | Incident page |
| `incident.noResponse.help` | A missing response is a fact about the record, not a finding. | Incident page, provider console |
| `incident.policyDrift` | The policy source no longer matches the pinned hash. The record fails closed rather than judging different text. | Policy section |
| `incident.lowConfidence` | Low confidence — evidence was missing, unavailable, or contradictory. | Verdict card |
| `incident.inlineWarning` | Inline evidence is public and permanent. | Evidence item |
| `incident.unclaimed` | No provider has claimed this system in the registry. | System header |
| `provider.claim.warning` | Claiming is first-come in v1 and is not identity verification. Only the claimed address can respond. | Claim form |
| `report.permanence` | This report is public and permanent. Inline evidence is stored on-chain and cannot be deleted. | Review step |
| `report.checkbox` | I understand this is public and permanent. | Review step |
| `adjudicate.note` | Anyone can submit this transaction. Independent validators decide; you do not. | Actions |
| `finalize.note` | This marks the record final after the appeal window. It does not change the verdict. | Actions |
| `appeal.note` | An appeal starts a new round with a larger validator set. The current verdict stays in the record. | Appeal form |
| `tx.undetermined` | Validators did not converge. No verdict was stored. | Tx result |
| `error.rejected` | You cancelled the signature. No record was written. | Write flows |
| `synthetic.label` | SYNTHETIC | Every synthetic record |
| `synthetic.help` | Illustrative data — not a real incident. | Tooltip/adjacent text |
| `demo.banner` | Demo build — all records are synthetic; write actions are simulated. | Demo builds only |
| `legal.short` | Policy compliance findings, not legal determinations. | Footer, verdict pages |
| `data.includes` | Hashes, statuses, verdicts, clause IDs, and dates. No claim text or inline evidence. | `/data` |
| `data.excludes` | Claim text, inline evidence, reporter addresses, and policy text are not in the export. | `/data` |
| `integrity.ok` | Hash consistency check passed. | Integrity check |
| `integrity.fail` | Hash mismatch. Do not rely on this page until it is resolved. | Integrity check |

### E.3 Forbidden framings and their replacements

| Do not write | Write instead |
|---|---|
| “Guilty” / “found guilty” | “Policy violation” |
| “Liable” / “liability” (outside the disclaimer) | “Policy compliance finding” |
| “Illegal” / “crime” / “criminal” | “Contrary to the provider’s published policy” |
| “Victim” | “Reporter” or “the person affected” |
| “Accused” / “accusation” | “Claim” / “incident report” |
| “Defendant” | “Provider” |
| “Verified provider” | “Claimed provider” |
| “The policy allowed harm” | “The output was within the policy, yet harm occurred” |
| “Trust score” / “safety score” | The verdict distribution, with denominators |
| “We decided” | “Validators decided” |
| “Silence is not guilt.” | “A missing response is a fact, not a finding.” |
| “Proven” / “proof” (about an event) | “Asserted in the evidence bundle” |
| “Deleted” / “removed” (about a record) | “Not possible. On-chain records are permanent.” |
| “Live” (about the index) | “Published index, updated …” |

### E.4 Interpolation rules

- Never concatenate a sentence from fragments. Compose with a function that returns the complete sentence.
- Numbers always carry a denominator when they are a rate: “7 of 50 (14%)”.
- Counts of zero are stated explicitly only when the zero is known: “0 incidents filed”. When unknown, omit or show “Unknown”.
- Timestamps always include `UTC` in the string.
- Addresses and hashes are shortened visually but never in the accessible name.
- No exclamation marks. No emoji. No “oops”, “uh oh”, or “sorry”.
- No rhetorical questions in error copy.

---

## APPENDIX F — Social cards and metadata

### F.1 Metadata source

- Titles and meta descriptions are defined **only** in §4.6. Do not duplicate them in components, route tables, or this appendix.
- `og:title` is the page `<title>`; `og:description` is the page meta description. Both are set from the same constant as the document head, never hand-written twice.
- Additional tags, defined once in `index.html` and updated per route where possible:

| Tag | Value |
|---|---|
| `og:site_name` | `SafetyNet` |
| `og:type` | `website` |
| `og:image` | Static card from §F.2, `1200×630` |
| `og:image:alt` | `SafetyNet — policy compliance record` |
| `twitter:card` | `summary_large_image` |
| `theme-color` | `#FAF9F5` (light), `#0D1117` (dark), via `media` |

**Rules**

- Descriptions never include claim text, defense text, reporter addresses, or a verdict for an incident that is not `FINAL` or `DECIDED`.
- An `UNDETERMINED` incident has no verdict; its description says “No verdict reached.”
- Never put “guilty”, “liable”, or “illegal” in metadata.
- If the title or description cannot be determined (missing system name, unknown verdict), fall back to the generic page title rather than rendering `undefined` or an empty string.

### F.2 Open Graph images

Five static cards, one per verdict, plus a default card:

| Card | Content |
|---|---|
| `og-default` | Mark, “SafetyNet”, tagline, “policy compliance record” |
| `og-violation` | ⚠ + “Policy violation” + “policy compliance finding · not a legal determination” |
| `og-gap` | ◐ + “Policy gap” + “within policy, harm occurred” |
| `og-insufficient` | ? + “Insufficient evidence” + “no finding reached” |
| `og-out-of-scope` | ⊘ + “Out of scope” |
| `og-dismissed` | ✓ + “Dismissed” |

Specifications:

- `1200×630`, PNG or WebP, ≤ 120 KB, light theme only.
- Typographic only: mark, verdict glyph, label, microtext, and the canonical URL.
- No faces, provider logos, screenshots, claim text, or severity numbers.
- The microtext “policy compliance finding · not a legal determination” is mandatory on the four verdict cards that make a finding.
- Cards are static assets; they are not generated per incident in v1.

### F.3 Crawler limitation `[OPEN] O-16`

The app is a SPA. Crawlers do not execute JavaScript, so every route currently serves the same `index.html` metadata. v1 therefore uses the default card and generic title for shared links unless a build-time meta shell is produced. The current shell still carries placeholder metadata (`<title>web</title>`, no description or OG tags); replacing it is part of the pre-demo gate in §0.4.

- **v1 default:** generic metadata; documented limitation in Appendix F.3 and in the UI spec’s changelog.
- **M2 option:** a build step emits a static HTML shell per incident and system with route-specific `<title>`, `<meta>`, and OG tags, loading the same JS bundle. No runtime server, no SSR.
- Do not fake per-route OG tags with client-side JavaScript.

---

## APPENDIX G — Print stylesheet

Print is a first-class output: a verdict page printed to PDF must be usable as an exhibit.

### G.1 `apps/web/src/styles/print.css`

```css
/* Print always uses light tokens and removes interaction chrome. */

@media print {
  @page {
    size: A4;
    margin: 16mm 14mm;
  }

  :root {
    color-scheme: light;
    --sn-bg: #FFFFFF;
    --sn-surface: #FFFFFF;
    --sn-surface-2: #F7F5EF;
    --sn-surface-3: #EFECE3;
    --sn-ink: #000000;
    --sn-text: #111111;
    --sn-text-secondary: #222222;
    --sn-muted: #444444;
    --sn-border: #BBBBBB;
    --sn-border-strong: #888888;
    --sn-rule: #CCCCCC;
    --sn-accent: #163A5A;
    --sn-danger: #8A1C12;
    --sn-warn: #7A3006;
    --sn-ok: #05543A;
    --sn-neutral: #333333;
    --sn-shadow-sm: none;
    --sn-shadow-md: none;
  }

  html,
  body {
    background: #FFFFFF;
    font-size: 10.5pt;
    line-height: 1.45;
  }

  /* Chrome that must never print (print-only blocks opt back in below) */
  header:not([data-print="header"]),
  footer:not([data-print="footer"]),
  nav,
  [data-print="hide"] {
    display: none !important;
  }

  [data-print="header"],
  [data-print="footer"] {
    display: block;
  }

  main {
    max-width: none;
    padding: 0;
  }

  a {
    color: #111111;
    text-decoration: underline;
  }

  a[href^="http"]::after {
    content: " (" attr(href) ")";
    font-family: var(--sn-font-mono);
    font-size: 0.78em;
    word-break: break-all;
  }

  a[href^="/"]::after,
  a[href^="#"]::after {
    content: "";
  }

  [data-print="hash-short"] {
    display: none;
  }

  [data-print="hash-full"] {
    display: inline;
    overflow-wrap: anywhere;
  }

  h1,
  h2,
  h3 {
    break-after: avoid;
    page-break-after: avoid;
  }

  [data-print="block"],
  table,
  figure,
  blockquote {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  tr,
  img {
    break-inside: avoid;
  }

  details > summary {
    list-style: none;
  }

  details > summary::marker,
  details > summary::-webkit-details-marker {
    display: none;
  }

  .no-print {
    display: none !important;
  }
}
```

### G.2 Rules

1. `print.css` may not reference CSS-module class names (they are hashed). Components opt out with `data-print="hide"` and opt in with `data-print="block"`.
2. Components that must expand on paper render full values in a `[data-print="hash-full"]` span and the shortened value in `[data-print="hash-short"]`.
3. `usePrintExpand()` opens every `<details>` on `beforeprint` and restores the previous open state on `afterprint`. CSS cannot reliably reveal closed `<details>` content across browsers; do not pretend it can.
4. A `PrintHeader` block (`data-print="header"`) prints: system name, incident ID, verdict label, round, ruled date (UTC), and the canonical URL.
5. A `PrintFooter` block (`data-print="footer"`) prints: the full disclaimer, the trust-boundary summary, the contract address, the network, and the index freshness date.
6. Print never shows: header nav, footer nav, theme toggle, filter bar, pagination, action buttons, transaction stepper, copy buttons, “Open source” affordances, or the demo banner (the `SYNTHETIC` badge stays).
7. Severity bars print as text; color is not required to read them.
8. A printed verdict page must contain the disclaimer on the same page as the verdict label. If the layout would split them, force a page break before the verdict block.
9. Test print output with Playwright `page.pdf()` for an incident page and `/policy-gaps`; assert the disclaimer text is present and the nav is absent.

---

## APPENDIX H — Banned-word enforcement

### H.1 Scope

- Source: every file under `apps/web/src` with extension `.ts`, `.tsx`, `.css`, `.html`.
- Rendered output: the demo-path Playwright run, scanning visible text.
- Docs that ship in the app (`/about`) are covered by the rendered scan.

### H.2 Script: `scripts/check-banned-words.mjs`

```js
#!/usr/bin/env node
import { readFile, readdir } from "node:fs/promises";
import { join, extname } from "node:path";

const ROOT = new URL("../apps/web/src/", import.meta.url).pathname;
const EXTS = new Set([".ts", ".tsx", ".css", ".html"]);

const BANNED =
  /\b(guilty|guilt|liable|liability|illegal|illegally|crime|criminal|convicted|sentenced|plaintiff|defendant|victim|accusation|accused|ruling|judgment|sentence|exonerated|innocent|court|prosecute|punish)\b/gi;

// Exact, mandated strings that may contain a banned term.
// Each must appear verbatim; if it disappears, this script fails.
const EXEMPTIONS = [
  {
    file: "lib/copy.ts",
    text:
      "SafetyNet publishes policy compliance findings produced by independent validators against a provider's own published policy. A finding is not a legal determination, not an assessment of liability, and not a statement that an AI system is safe or unsafe in general. Evidence is supplied by reporters and is not independently authenticated. Always consult the original sources and the cited policy version.",
  },
  {
    file: "pages/About/trustBoundary.ts",
    text: "That the provider acted illegally",
  },
];

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(p)));
    else if (EXTS.has(extname(entry.name))) out.push(p);
  }
  return out;
}

const failures = [];
const files = await walk(ROOT);

for (const { file, text } of EXEMPTIONS) {
  const full = join(ROOT, file);
  const content = await readFile(full, "utf8");
  if (!content.includes(text)) {
    failures.push(`${file}: required exempt string is missing or altered`);
    continue;
  }
  const index = files.indexOf(full);
  if (index >= 0) files.splice(index, 1);
}

for (const file of files) {
  const content = await readFile(file, "utf8");
  const lines = content.split("\n");
  lines.forEach((line, i) => {
    // Comments are never rendered; skip them to avoid false positives on
    // words like "sentence" in prose about the code itself.
    if (/^\s*(\/\/|\/\*|\*)/.test(line)) return;
    const matches = line.match(BANNED);
    if (matches) {
      failures.push(
        `${file.replace(ROOT, "")}:${i + 1}: banned term ${matches.join(", ")} → ${line.trim()}`,
      );
    }
  });
}

if (failures.length) {
  console.error("Banned words found:\n" + failures.join("\n"));
  process.exit(1);
}
console.log(`Banned-word check passed (${files.length} files scanned).`);
```

**Notes**

- The two exempt files are removed from the scan entirely after their required strings are verified. This prevents the exemption from being sprinkled across the codebase.
- The comment-line skip is deliberately narrow: it only ignores lines that name the rule. Do not widen it.
- If a third mandated string ever needs an exception, add it to `EXEMPTIONS` with its exact text and a reference to the `AGENTS.md` section that requires it.

### H.3 Rendered-output check (Playwright)

```ts
const EXEMPT_SELECTORS = ['[data-testid="legal-disclaimer"]', '[data-testid="trust-boundary"]'];
const BANNED = /\b(guilty|guilt|liable|liability|illegal|illegally|crime|criminal|convicted|sentenced|plaintiff|defendant|victim|accusation|accused|ruling|judgment|sentence|exonerated|innocent|court|prosecute|punish)\b/i;

const text = await page.evaluate((selectors) => {
  const clone = document.body.cloneNode(true) as HTMLElement;
  for (const s of selectors) clone.querySelectorAll(s).forEach((n) => n.remove());
  return clone.innerText;
}, EXEMPT_SELECTORS);

expect(text).not.toMatch(BANNED);
```

Run against `/`, `/incidents`, one incident, `/report`, `/policy-gaps`, `/about`, `/provider`, `/data`.

### H.4 CI wiring

```yaml
- name: Banned words
  run: node scripts/check-banned-words.mjs
```

- The check runs on every PR and blocks merge.
- A failure message must name the file, line, term, and the suggested replacement from Appendix E.3.

---

## APPENDIX I — Route and data dependencies

| Route | Index | Live chain reads | Writes available | Wallet | Client cache | Offline behavior |
|---|---|---|---|---|---|---|
| `/` | Yes: stats, latest, gaps | No | No | No | Session | Show cached index + stale note; stats hidden if none |
| `/incidents` | Yes | No | No | No | Session | Cached list + stale note |
| `/incidents/:id` | Yes (header, verdict summary) | `get_incident`, `get_verdict`, `get_response`, `get_appeals`, `get_verdict_history`, `get_policy` | `adjudicate`, `appeal`, `finalize` | Only for writes | 30 s per key | Index header renders; live sections show errors with retry |
| `/report` | Yes: systems, policies | `get_system`, `get_policy`, `get_config` | `file_incident` | Yes (step 5) | 30 s | Blocked at step 1 with retry |
| `/systems` | Yes | No | No | No | Session | Cached list + stale note |
| `/systems/:id` | Yes: counts, gaps | `get_system`, `get_policy` (current) | `claim_system`, `publish_policy` (provider) | Only for writes | 30 s | Header from index; policy details error with retry |
| `/policy-gaps` | Yes | No | No | No | Session | Cached groups + stale note |
| `/provider` | Yes: system summaries | `get_system`, `list_incidents_by_system`, `get_incident`, `get_response`, `get_config` | `claim_system`, `provider_respond`, `appeal`, `publish_policy`, `adjudicate`, `finalize` | Yes | 30 s; invalidate on write | Read-only summary; actions disabled with explanation |
| `/about` | No | No | No | No | None | Fully available |
| `/data` | Yes: freshness, links | No | No | No | Session | Links unavailable; freshness stale |
| `/embed/system/:id` | Yes | No (v1) | No | No | Session | Cached summary + stale note |
| `*` | No | No | No | No | None | Fully available |

### I.1 Client-loading rules per route

| Route | `@safetynet/client` | `genlayer-js` chunk |
|---|---|---|
| `/`, `/incidents`, `/systems`, `/policy-gaps`, `/about`, `/data`, `/embed/*` | Not loaded | Not loaded |
| `/incidents/:id`, `/systems/:id` | Lazy, after first paint | Lazy |
| `/report`, `/provider` | Lazy at step/action boundary | Lazy |

- A route that never writes must still render its read-only content when the chain client fails to load.
- The chain client chunk failure produces a section-level error, not a blank page.
- A build test asserts the home route chunk does not contain `genlayer-js` or the client runtime.

### I.2 `get_config()` usage

`get_config()` is read once per session and cached in `AppConfigContext` for:

- `maxEvidenceItems`, `maxEvidenceBytes` → filing form limits and manifest preview.
- `maxPolicyClauses` → policy display warnings.
- `appealWindowHours`, `maxAppeals` → appeal eligibility copy.
- `minProviderResponseHours` → response deadline copy.

Never hardcode these values in the UI (`AGENTS.md` §9.8). If `get_config()` fails, the filing flow is blocked with an explanation; read-only pages continue and hide config-dependent limits rather than inventing them.

### I.3 Network and address resolution

1. Build reads `deployments/<network>.json` and generates `generated/addresses.ts`.
2. Runtime reads `VITE_SNET_NETWORK` and resolves the address; a `VITE_SNET_CONTRACT_ADDRESS` override wins for local testing.
3. If the resolved address is missing or malformed, the app renders a full-page configuration error before any route.
4. The footer displays the network, the shortened address, and the index freshness date.
5. A network mismatch in the wallet disables writes and shows `NetworkMismatchBanner`; reads continue.

---

**End of UI.md.** If this file disagrees with `AGENTS.md` on product scope, legal framing, or contract behavior, `AGENTS.md` wins. If it disagrees with the repository about what exists, the repository wins for facts — fix this file in the same PR that changes reality.
