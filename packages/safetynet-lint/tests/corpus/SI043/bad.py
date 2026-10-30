# { "Depends": "py-genlayer:testhash" }
from genlayer import *

class SafetyNet(gl.Contract):
    @gl.public.write.payable
    def fund(self) -> None:
        pass
