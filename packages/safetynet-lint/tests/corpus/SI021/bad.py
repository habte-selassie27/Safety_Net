# { "Depends": "py-genlayer:testhash" }
from genlayer import *

class SafetyNet(gl.Contract):
    @gl.public.write
    def adjudicate(self, incident_id: str) -> str:
        claim = "x"
        return gl.nondet.exec_prompt(f"Judge this: {claim}")
