# { "Depends": "py-genlayer:testhash" }
from genlayer import *

class SafetyNet(gl.Contract):
    cached: str
    @gl.public.view
    def read(self, incident_id: str) -> str:
        return self.cached
