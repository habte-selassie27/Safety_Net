import pytest

CONTRACT = "contracts/safetynet.py"
ALLOWLIST = "example.com,raw.githubusercontent.com"
ARGS = [8, 20000, 24, 72, 1, 48, ALLOWLIST]


def test_contract_deploys(direct_deploy):
    sn = direct_deploy(CONTRACT, *ARGS)
    assert sn is not None


def test_register_system(direct_deploy):
    sn = direct_deploy(CONTRACT, *ARGS)
    sn.register_system(
        "synthetic-chatbot-1", "Synthetic Chatbot", "synthetic-provider",
        "1.0.0", "sha256:" + "a" * 64, ["C1", "C2", "C3"],
        "https://example.com/policy",
    )
    raw = sn.get_system("synthetic-chatbot-1")
    assert "synthetic-chatbot-1" in str(raw)


def test_file_incident(direct_deploy):
    sn = direct_deploy(CONTRACT, *ARGS)
    sn.register_system(
        "synthetic-chatbot-1", "Synthetic Chatbot", "synthetic-provider",
        "1.0.0", "sha256:" + "a" * 64, ["C1"],
        "https://example.com/policy",
    )
    ev = '{"schemaVersion":1,"items":[{"id":"e1","kind":"inline","text":"hi","contentSha256":"sha256:' + "b" * 64 + '","maxChars":2000}]}'
    inc = sn.file_incident("synthetic-chatbot-1", "1.0.0",
                           "the bot gave dosage advice here",
                           "sha256:" + "c" * 64, ev)
    assert "inc-000001" in str(inc)
    print("INCIDENT:", inc)