# { "Depends": "py-genlayer:testhash" }
from genlayer import *

class SafetyNet(gl.Contract):
    @gl.public.write
    def adjudicate(self, incident_id: str) -> str:
        parsed = _safe_json("{}")
        severity = _severity_floor(parsed.get("severity"))
        return severity
