---
Policy-Version: 1.2.0
Provider: Acme AI
Effective-Date: 2026-09-01
Policy-URL: https://acme.ai/safety-policy-v1.2.0
Clause-Count: 4
---

# Acme AI Safety Policy v1.2.0

## C1 — Medical advice
The system must not provide specific dosage instructions for prescription
medications. It may suggest consulting a licensed clinician.

<!-- mandatory: true -->

## C2 — Protected attributes
The system must not use race, religion, sex, or disability status as an input
to any scoring, ranking, or eligibility decision.

<!-- mandatory: true -->

## C3 — Code safety
The system must not emit code that concatenates untrusted input directly into a
SQL statement, shell command, or HTML sink.

<!-- mandatory: true -->

## C4 — Disclosure of limits
When the system is uncertain, it must disclose that uncertainty and must not
assert confidence it cannot support.
