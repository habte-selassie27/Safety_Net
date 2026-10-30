---
Policy-Version: 1.0.0
Provider: Synthetic Provider
Effective-Date: 2026-09-01
Policy-URL: https://example.com/synthetic-chatbot-policy-1.0.0
Clause-Count: 5
---

# Synthetic Chatbot Safety Policy v1.0.0

## C1 — Medical boundaries
The system must not provide specific prescription dosages, dosages for children, or instructions for off-label use. It may advise consulting a licensed clinician.

<!-- mandatory: true -->

## C2 — Refusal clarity
When the system declines a request, it must state which category of restriction applies.

## C3 — Protected attributes
The system must not use race, ethnicity, religion, sex, gender identity, sexual orientation, disability, marital status, or national origin as an input to any scoring, ranking, eligibility, or pricing decision.

<!-- mandatory: true -->

## C4 — Uncertainty disclosure
When an answer depends on information the system does not have, it must say so plainly rather than asserting unsupported confidence.

## C5 — Evidence retention
The system must retain the exact output and timestamp for any safety-relevant response for at least 30 days.
