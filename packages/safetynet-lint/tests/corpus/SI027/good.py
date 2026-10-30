# { "Depends": "py-genlayer:testhash" }
from genlayer import *

class SafetyNet(gl.Contract):
    verdicts: TreeMap[str, str]
    @gl.public.write
    def adjudicate(self, incident_id: str) -> str:
        policy = {"url": "https://example.com/p", "text_hash": "sha256:x"}
        text = gl.nondet.web.render(policy.url)
        _require(_sha256(text) == policy.text_hash, "POLICY_DRIFT")
        self.verdicts[incident_id] = "DISMISSED"
        return "DISMISSED"
