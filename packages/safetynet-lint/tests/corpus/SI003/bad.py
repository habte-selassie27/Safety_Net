# { "Depends": "py-genlayer:testhash" }
from genlayer import *

class SafetyNet(gl.Contract):
    @gl.public.view
    def get(self, incident_id):
        return str(incident_id)
