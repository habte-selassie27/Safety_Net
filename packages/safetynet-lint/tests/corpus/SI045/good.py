# { "Depends": "py-genlayer:testhash" }
from genlayer import *

class SafetyNet(gl.Contract):
    appeals: TreeMap[str, str]
    @gl.public.write
    def appeal(self, incident_id: str) -> str:
        self.appeals[incident_id] = "round-2"
        return "APPEALED"
