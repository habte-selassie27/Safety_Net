"""Secret canary: ensure no key-like strings appear in contract source."""
CONTRACT = "contracts/safetynet.py"

def test_no_hardcoded_key():
    src = open(CONTRACT).read()
    import re
    # 64-hex or 0x-prefixed 64-hex
    assert not re.search(r"0x[0-9a-fA-F]{64}", src), "hardcoded 64-hex key in contract"
    assert "d64e58bf" not in src