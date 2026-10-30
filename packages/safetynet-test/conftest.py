"""Make the package and simulator importable when tests run from the repo."""

from __future__ import annotations

import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "packages" / "safetynet-test" / "src"))
sys.path.insert(0, str(ROOT / "packages" / "safetynet-sim"))
