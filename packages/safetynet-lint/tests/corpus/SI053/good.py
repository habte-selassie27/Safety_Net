# { "Depends": "py-genlayer:testhash" }
from genlayer import *

class SafetyNet(gl.Contract):
    incidents: TreeMap[str, str]
    @gl.public.write
    def adjudicate(self, incident_id: str) -> str:
        for key in self.incidents:
            pass
        return "ok"
