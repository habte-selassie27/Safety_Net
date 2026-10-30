# { "Depends": "py-genlayer:testhash" }
from genlayer import *

class SafetyNet(gl.Contract):
    verdicts: TreeMap[str, str]
    @gl.public.write
    def appeal(self, incident_id: str) -> str:
        self.verdicts[incident_id] = "DISMISSED"
        return "DISMISSED"
