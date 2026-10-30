# { "Depends": "py-genlayer:testhash" }
from genlayer import *

class SafetyNet(gl.Contract):
    @gl.public.view
    def get_verdict(self, incident_id: str) -> str:
        return "DISMISSED"
