# { "Depends": "py-genlayer:testhash" }
from genlayer import *

class SafetyNet(gl.Contract):
    @gl.public.write
    def adjudicate(self, incident_id: str) -> str:
        fetched_text = "page"
        return gl.nondet.exec_prompt(f"<evidence>{fetched_text}</evidence>")
