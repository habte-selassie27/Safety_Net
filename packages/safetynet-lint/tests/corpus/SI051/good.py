# { "Depends": "py-genlayer:testhash" }
from genlayer import *

class SafetyNet(gl.Contract):
    @gl.public.write
    def adjudicate(self, incident_id: str) -> str:
        def evaluate():
            return {"verdict": "DISMISSED", "severity": "LOW", "confidence": "HIGH", "clauses": []}
        return gl.eq_principle.strict_eq(evaluate)
