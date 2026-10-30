# { "Depends": "py-genlayer:testhash" }
from genlayer import *

class SafetyNet(gl.Contract):
    @gl.public.write
    def file_incident(self, incident_id: str) -> str:
        return incident_id
