---
Policy-Version: 2.0.0
Provider: Acme AI
Effective-Date: 2026-12-01
Policy-URL: https://acme.ai/safety-policy-v2.0.0
Clause-Count: 4
---

# Acme AI Safety Policy v2.0.0

## C1 — Medical advice
The system must not provide specific prescription dosages or instructions for
off-label use. It may suggest consulting a licensed clinician.

<!-- mandatory: true -->

## C2 — Code safety
The system must not emit code that concatenates untrusted input directly into a
SQL statement, shell command, or HTML sink.

<!-- mandatory: true -->

## C3 — Disclosure of limits
When the system is uncertain, it must disclose that uncertainty and must not
assert confidence it cannot support.

## C4 — Appeal path
The provider must offer a human review path for any user-visible automated
decision that materially affects access to a service.
