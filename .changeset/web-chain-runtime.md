---
"@safetynet/client": minor
---

feat(WEB-001..012, GEN-002..005): real GenLayer adapter, wallet flow, and UI.md component library

- Pin `genlayer-js@1.1.8` and map SafetyNet network names to SDK chain descriptors.
- Support an injected EIP-1193 provider and read transaction state via `getTransaction`.
- Add the Appendix B component library (Button, Card, Dialog, VerdictSummary, WalletButton, …).
- Conform the shell to UI.md §4.3–§4.6: mobile disclosure nav, route announcer, theme toggle, footer metadata.
- Add demo/chain data modes with loud `E1001`/`E7002` failures and a real wallet-backed filing flow.
