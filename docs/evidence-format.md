# Evidence format

Evidence manifest is canonical JSON: sorted keys, compact separators, UTF-8.

```
canonical_json(obj) = json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
evidence_hash = "sha256:" + sha256(canonical_json(manifest)).hexdigest()
```

Rules: 1..8 items, ≤20KB total, ids e1..e99 unique, kinds url/inline, https only, allowlisted hosts, inline text ≤2000 chars, maxChars 200..8000, contentSha256 required. Unknown keys rejected.