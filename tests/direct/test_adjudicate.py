import json

from safetynet_test.policies import policy_text_hash

CONTRACT = "contracts/safetynet.py"
ARGS = [8, 20000, 24, 72, 1, 48, "example.com"]
POLICY_URL = "https://example.com/policy"
POLICY_TEXT = "## C1 — Medical\nThe system must not provide dosage advice.\n"
POLICY_HASH = policy_text_hash(POLICY_TEXT)


def _sha256(s):
    import hashlib

    return "sha256:" + hashlib.sha256(s.encode()).hexdigest()


def _manifest():
    return json.dumps(
        {
            "schemaVersion": 1,
            "items": [
                {
                    "id": "e1",
                    "kind": "inline",
                    "text": "Take 4000mg",
                    "contentSha256": "sha256:" + "b" * 64,
                    "maxChars": 2000,
                }
            ],
        }
    )


def test_adjudicate_violation(direct_vm, direct_deploy):
    sn = direct_deploy(CONTRACT, *ARGS)
    sn.register_system(
        "bot-1", "Bot", "acme", "1.0.0", POLICY_HASH, ["C1"], POLICY_URL
    )
    inc = sn.file_incident(
        "bot-1",
        "1.0.0",
        "the bot gave dosage advice to a user",
        "sha256:" + "c" * 64,
        _manifest(),
    )
    direct_vm.mock_web(POLICY_URL, {"status": 200, "body": POLICY_TEXT})
    direct_vm.mock_llm(
        ".*",
        '{"clause_id":"C1","finding":"VIOLATED","reason_code":"EXPLICIT"}',
    )
    assert "POLICY_VIOLATION" in str(sn.adjudicate(inc))
    record = json.loads(sn.get_verdict(inc))
    assert record["verdict"] == "POLICY_VIOLATION"
    assert record["severity"] == "SERIOUS"


def test_appeal_and_finalize(direct_vm, direct_deploy):
    sn = direct_deploy(CONTRACT, *ARGS)
    sn.register_system(
        "bot-2", "Bot2", "acme", "1.0.0", POLICY_HASH, ["C1"], POLICY_URL
    )
    inc = sn.file_incident(
        "bot-2",
        "1.0.0",
        "the bot gave dosage advice to a user",
        "sha256:" + "c" * 64,
        _manifest(),
    )
    direct_vm.mock_web(POLICY_URL, {"status": 200, "body": POLICY_TEXT})
    direct_vm.mock_llm(
        ".*",
        '{"clause_id":"C1","finding":"VIOLATED","reason_code":"EXPLICIT"}',
    )
    assert "POLICY_VIOLATION" in str(sn.adjudicate(inc))
    sn.appeal(inc, "I disagree with the verdict because evidence was misread")
    sn.finalize(inc)
    assert json.loads(sn.get_incident(inc))["status"] == "FINAL"
