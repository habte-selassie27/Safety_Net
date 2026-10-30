# { "Depends": "py-genlayer:testhash" }
from genlayer import *

def parse(raw: str) -> str:
    return json.loads(raw)
