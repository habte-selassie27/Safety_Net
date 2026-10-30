# { "Depends": "py-genlayer:testhash" }
from genlayer import *

class SafetyNet(gl.Contract):
    @gl.public.write
    def adjudicate(self, incident_id: str) -> str:
        raw = "{}"
        def evaluate():
            return _aggregate(raw)
        return gl.eq_principle.strict_eq(evaluate)
