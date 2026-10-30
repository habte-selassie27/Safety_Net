# { "Depends": "py-genlayer:testhash" }
from genlayer import *

class SafetyNet(gl.Contract):
    incidents: TreeMap[str, str]
    verdicts: TreeMap[str, str]
    @gl.public.write
    def adjudicate(self, incident_id: str) -> str:
        inc = self.incidents[incident_id]
        self.verdicts[incident_id] = "DISMISSED"
        return "DISMISSED"
