# { "Depends": "py-genlayer:testhash" }
from genlayer import *

class SafetyNet(gl.Contract):
    @gl.public.write
    def adjudicate(self, incident_id: str) -> str:
        items = []
        return gl.nondet.exec_prompt(f"<evidence>{_render_evidence(items)}</evidence>")
