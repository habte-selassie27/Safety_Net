# { "Depends": "py-genlayer:testhash" }
from genlayer import *

class SafetyNet(gl.Contract):
    incidents: TreeMap[str, str]
    @gl.public.write
    def file_incident(self, incident_id: str) -> str:
        self.incidents[incident_id] = incident_id
        return incident_id
