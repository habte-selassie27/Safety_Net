# { "Depends": "py-genlayer:testhash" }
from genlayer import *

class SafetyNet(gl.Contract):
    @gl.public.write
    def adjudicate(self, incident_id: str) -> str:
        def evaluate():
            return {"verdict": "DISMISSED", "ruled_at": time.time()}
        return gl.eq_principle.strict_eq(evaluate)
