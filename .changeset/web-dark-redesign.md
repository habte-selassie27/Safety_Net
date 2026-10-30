---
"web": minor
---

feat(WEB-010, WEB-011, WEB-001): dark-first public-record UI refresh

- New dark-first theme with a mint signal accent, dot-grid atmosphere, and
  warm archival-paper light mode; dark is now the default
- Glass sticky header, pill navigation, branded logo mark, and a richer
  four-column footer with network and legal context
- Rebuilt home hero with a live verdict preview card, headline stats,
  latest-verdict feed, policy-gap teaser, four-step explainer, and CTA band
- Shared card, stat, badge, table, form, and button styles refreshed across
  every route; mobile navigation now covers tablet widths without overflow
- Card now forwards arbitrary HTML attributes so test IDs and ARIA metadata
  survive the shared component wrapper
- Accessibility spec (`tests/e2e/a11y.spec.ts`) covers six public routes with
  axe WCAG 2.1 A/AA serious/critical checks and a keyboard path smoke test
