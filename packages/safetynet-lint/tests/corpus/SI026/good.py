# { "Depends": "py-genlayer:testhash" }
from genlayer import *

def parse(raw: str) -> str:
    try:
        return json.loads(raw)
    except Exception:
        return "{}"
