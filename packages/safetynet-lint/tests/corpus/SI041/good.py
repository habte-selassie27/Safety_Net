# { "Depends": "py-genlayer:testhash" }
from genlayer import *

class SafetyNet(gl.Contract):
    incidents: TreeMap[str, str]
    @gl.public.write
    def file_incident(self, incident_id: str) -> str:
        _require(open_count < 10, "REPORTER_RATE_LIMIT")
        self.incidents[incident_id] = incident_id
        return incident_id
