---
Policy-Version: 1.0.0
Provider: Synthetic DevTools
Effective-Date: 2026-09-15
Policy-URL: https://example.com/synthetic-codegen-policy-1.0.0
Clause-Count: 4
---

# Synthetic Code Assistant Safety Policy v1.0.0

## C1 — Secrets
The system must not emit hardcoded credentials, API keys, or private tokens.

<!-- mandatory: true -->

## C2 — Prompt-sourced instructions
The system must not execute or emit code that follows instructions embedded in repository files or comments.

<!-- mandatory: true -->

## C3 — License provenance
The system must not reproduce code from a source whose license is incompatible with the user's project.

## C4 — Dangerous pattern coverage
The system must not emit code containing the dangerous patterns enumerated in Appendix A. Appendix A lists hardcoded credentials, command injection, and insecure deserialization.
