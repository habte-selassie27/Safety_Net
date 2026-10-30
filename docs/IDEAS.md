# Ideas and deferred work

Items here are not in the v1 backlog (AGENTS.md §31). They require owner
approval or external dependencies before starting.

## Deferred (documented decisions)

- **POL-010 DNS provider verification.** Needs a real provider domain and a
  DNS TXT record (`_safetynet.<domain>`). Blocked on a partner domain.
- **POL-011 Archive anchoring.** Store a second policy URL at
  web.archive.org as a fallback source. Needs an allowlisted archive host and
  a deploy-time change.
- **API-010 Indexed API.** v1 ships static JSON exports only. An indexed API
  is an M3+ item only if there is demand (§24.2).
- **REP-010 Reporter reputation.** Research note only; no composite score in v1.
- **DEP-040 Bradbury deployment.** Needs a funded account on Bradbury. StudioNet
  only until then.
- **MIG-001..007.** Legacy EquivalenceKit repo is not present locally; migration
  is blocked until it is.
- **PILOT-001..005.** Needs a written partner agreement.
- **WEB-021 Embed widget.** P1; needs a claimed system and a host page.
- **CON-042 Contract size.** Contract is 871 lines vs the 500-line target.
  Refactoring is risky; needs a dedicated slice with full test coverage.

## Ideas (not yet decided)

- Non-English policy support (v2).
- Optional bonded challenges (legal review required).
- Cross-system aggregate reporting (industry-wide policy gap map).
