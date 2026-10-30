# { "Depends": "py-genlayer:testhash" }
from genlayer import *

class SafetyNet(gl.Contract):
    @gl.public.write
    def adjudicate(self, incident_id: str) -> str:
        text = gl.nondet.web.render("https://example.com/x")[:4000]
        return str(text)
