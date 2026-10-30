# SafetyNet Data Schema (static export)

- API-002: JSON Schema for `data/*.json` exports.
- API-004: copy-paste query snippets.

## Static export format

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-11-02T12:00:00Z",
  "network": "studionet",
  "contract": "0xC0ff…ee01",
  "policies": [ { "systemId": "…", "version": "1.0.0", "textHash": "sha256:…", "clauseIds": ["C1"], "url": "…" } ],
  "incidents": [
    {
      "incidentId": "inc-000001",
      "systemId": "…",
      "policyVersion": "1.0.0",
      "policyHash": "sha256:…",
      "status": "FINAL",
      "filedAt": 1762000000,
      "claimSha256": "sha256:…",
      "evidenceHash": "sha256:…",
      "evidenceKinds": ["inline"],
      "verdict": { "verdict": "…", "severity": "…", "confidence": "…", "clauses": ["C1"], "rationale": "…", "round": 1, "appeals": 0 }
    }
  ]
}
```

## Privacy rules

- Never include claim text or inline evidence by default.
- Include `claimSha256` so a researcher can verify a claim they obtained elsewhere.
- Deterministic ordering (by incident id).

## Query snippets

```bash
snet export incidents --format json --out data/incidents.json
snet export verdicts --format json --out data/verdicts.json
snet export policy-gaps --format md --out data/policy-gaps.md
snet export addresses --format ts --out apps/web/src/generated/addresses.ts
```

```bash
curl -s "https://safetynet.dev/api/incidents?system=synthetic-chatbot-1&verdict=POLICY_VIOLATION"
```
