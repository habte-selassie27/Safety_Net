# { "Depends": "py-genlayer:testhash" }
from genlayer import *

class SafetyNet(gl.Contract):
    evidence_text: TreeMap[str, str]
    @gl.public.write
    def adjudicate(self, incident_id: str) -> str:
        fetched = "page"
        self.evidence_text[incident_id] = fetched
        return fetched
