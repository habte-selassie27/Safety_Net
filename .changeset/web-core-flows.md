---
"web": minor
---

feat(WEB-024, WEB-030, WEB-034): complete the core record flows in the web app

- Wire permissionless `adjudicate` and `finalize`, plus `appeal`, to the deployed
  contract through `@safetynet/client`, with wallet/network guards and live tx
  status in place of demo-only mutations.
- Add an in-app system registration flow (`register_system`) so a provider can
  register a system and publish its first policy version from the console.
- Read every list surface (home, systems, policy gaps, data, embed) through one
  record-index hook, which returns the published index in chain mode instead of
  an empty record.
- Add Tabs, Dialog, and Skeleton components with happy-dom tests.
