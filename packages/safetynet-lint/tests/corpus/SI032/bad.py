# { "Depends": "py-genlayer:testhash" }
from genlayer import *

class SafetyNet(gl.Contract):
    @gl.public.view
    def read(self, incident_id: str) -> str:
        return gl.nondet.web.render("https://example.com/x")
