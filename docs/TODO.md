# SafetyNet — Remaining Work (TODO)

Living checklist. Update as items ship. External/blocked items are marked.
Last updated: 2026-10-30.

## A. Code / incremental polish

- [ ] **A1.** Finish migrating `SystemDetail.tsx` to `Card`/`TrustNote`
  (`Button` migration is done).
- [ ] **A2.** Migrate `Report.tsx` to `Card`/`Button`/`Notice`/`FormField`/`StepIndicator`.
- [ ] **A3.** Migrate `Provider.tsx` to `Card`/`Button`/`Notice`/`FormField`.
- [ ] **A4.** Migrate `IncidentDetail.tsx` to `Card`/`Notice`/`ClauseCard`/`VerdictSummary`
  (`Button` migration is done).
- [ ] **A5.** Clause verification in browser (UI.md §17.4): show clause text only after in-browser hash check; add normalizer parity with contract.
- [ ] **A6.** Severity hiding consistency: Incidents table uses `SeverityChips` everywhere; show `—` for non-applicable verdicts.
- [ ] **A7.** Confidence notes everywhere (low-confidence note currently only on IncidentDetail).
- [ ] **A8.** Live-chain export: implement `snet export incidents/verdicts/policy-gaps` to read from a deployed contract (genlayer-js reader in CLI).
- [ ] **A9.** Changeset config exists and `pnpm changeset status` passes; a full `pnpm changeset version` dry-run remains.
- [x] **A10.** Axe-core scan in CI + keyboard-only filing test (Playwright).
- [ ] **A11.** Visual/verdict snapshot tests.

## B. Deployment / grant readiness (needs funded account)

- [ ] **B1.** Fund StudioNet account (faucet).
- [ ] **B2.** `snet deploy --network studionet --tag v0.x.y --verify`.
- [ ] **B3.** `snet seed --network studionet` (5 synthetic incidents).
- [ ] **B4.** Populate `docs/METRICS.md` with real counts.
- [ ] **B5.** Bradbury testnet deploy (M2, needs funded Bradbury account).

## C. External (needs human / partner)

- [ ] **C1.** Pilot partner (PILOT-001): written agreement with an AI safety org.
- [ ] **C2.** Showcase recording (DOC-021): 10-minute live demo.
- [ ] **C3.** Ground-truth snapshot refresh (`docs/ground-truth.md`).
- [ ] **C4.** Docs site build verification (`apps/docs`).

## Order of attack (recommended)

1. A1–A4 (component migration) — mechanical, low risk.
2. A5–A7 (page conformance) — small, high value.
3. A8 (live-chain export) — needs design + test against sim.
4. A9–A11 (testing) — quality gates.
5. B1–B4 — blocked on funding.
6. C1–C4 — external.

## Completed in the 2026-10-30 UI pass

- Dark-first public-record theme with a mint signal accent, dot-grid atmosphere,
  warm light mode, glass sticky header, pill navigation, and rebuilt home hero.
- Mobile navigation now covers tablet widths (1024px breakpoint) with no
  horizontal overflow from 390px through 1920px.
- Shared Card/Button/stat/badge/table/form styling refreshed across every route.
- `Card` forwards arbitrary HTML attributes so `data-testid` and ARIA metadata
  survive the wrapper.
- Playwright axe scan covers `/`, `/incidents`, `/systems`, `/policy-gaps`,
  `/about`, and `/data` at WCAG 2.1 A/AA serious/critical levels.
