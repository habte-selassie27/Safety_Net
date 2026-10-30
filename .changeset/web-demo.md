---
"@safetynet/core": minor
---

feat(WEB-002..004, WEB-012, WEB-020..026, WEB-030..060): public web app demo

- History API router with real path permalinks and a Vercel SPA rewrite
- Labelled synthetic demo store covering filing, provider response, claim,
  appeal, policy publish, filtering, policy gaps, and reporter stats
- Five-step report flow with canonical evidence hashing, allowlist checks,
  PII warnings, permanence acknowledgement, and transaction progress
- Provider console, public incident/system pages, policy-gap view, open-data
  export, trust-boundary page, and read-only embed
- Browser-safe `@safetynet/core/validate` module shared by the web app and CLI
- `--sn-*` design tokens and serif/blue public-record styling
- Render, flow, store, hashing, and export tests (63 passing)
