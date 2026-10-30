# { "Depends": "py-genlayer:testhash" }
from genlayer import *

class SafetyNet(gl.Contract):
    policies: TreeMap[str, str]
    @gl.public.write
    def adjudicate(self, incident_id: str) -> str:
        for clause_id in policy.clause_ids:
            gl.nondet.exec_prompt("judge")
        return "ok"
