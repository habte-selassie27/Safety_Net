# { "Depends": "py-genlayer:testhash" }
from genlayer import *

class SafetyNet(gl.Contract):
    @gl.public.write
    def admin_set_verdict(self, incident_id: str) -> str:
        return "DISMISSED"
