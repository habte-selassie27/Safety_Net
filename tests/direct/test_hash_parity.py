import json, hashlib
CONTRACT = "contracts/safetynet.py"

def canonical(obj):
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)

def test_canonical_hash_stable():
    m = {"schemaVersion": 1, "items": [{"id": "e1", "kind": "inline", "text": "hi", "contentSha256": "sha256:"+"b"*64, "maxChars": 2000}]}
    c = canonical(m)
    h = "sha256:" + hashlib.sha256(c.encode("utf-8")).hexdigest()
    # recompute
    assert h == "sha256:" + hashlib.sha256(canonical(m).encode("utf-8")).hexdigest()
    print("hash:", h)