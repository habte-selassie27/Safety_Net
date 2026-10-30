import json
CONTRACT = "contracts/safetynet.py"
ARGS = [8, 20000, 24, 72, 1, 48, "example.com,raw.githubusercontent.com"]

def _mkurl(host):
    return json.dumps({"schemaVersion":1,"items":[{"id":"e1","kind":"url","url":"https://%s/x"%host,"contentSha256":"sha256:"+"b"*64,"maxChars":2000}]})

def _try(sn, url_host):
    try:
        sn.file_incident("bot", "1.0.0", "the bot gave dosage advice to a user", "sha256:"+"c"*64, _mkurl(url_host))
        return "ACCEPTED"
    except Exception as e:
        return str(e)

def test_ssrf_matrix(direct_deploy):
    sn = direct_deploy(CONTRACT, *ARGS)
    sn.register_system("bot", "Bot", "acme", "1.0.0", "sha256:"+"a"*64, ["C1"], "https://example.com/policy")
    for host in ["127.0.0.1","localhost","169.254.169.254","10.0.0.1","192.168.0.1","example.com.evil.com"]:
        r = _try(sn, host)
        assert "DISALLOWED" in r or "DISALLOWED_EVIDENCE_HOST" in r, (host, r)
        print("rejected:", host, "->", r)
    # allowed host passes filing (may still need other checks but host ok)
    r = _try(sn, "example.com")
    print("allowed example.com ->", r)