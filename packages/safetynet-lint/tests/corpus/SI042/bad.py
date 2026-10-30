# { "Depends": "py-genlayer:testhash" }
from genlayer import *

class SafetyNet(gl.Contract):
    verdicts: TreeMap[str, str]
    @gl.public.write
    def wipe(self, incident_id: str) -> str:
        del self.verdicts[incident_id]
        return "ok"
