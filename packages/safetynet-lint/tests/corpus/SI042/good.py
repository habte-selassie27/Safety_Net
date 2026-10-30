# { "Depends": "py-genlayer:testhash" }
from genlayer import *

class SafetyNet(gl.Contract):
    verdicts: TreeMap[str, str]
    verdict_history: TreeMap[str, str]
    @gl.public.write
    def record(self, incident_id: str) -> str:
        self.verdict_history[incident_id] = "prior"
        self.verdicts[incident_id] = "DISMISSED"
        return "ok"
