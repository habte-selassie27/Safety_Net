"""Root pytest configuration.

Keeps the local monorepo packages importable and loads the SafetyNet test
plugin for the whole suite. Installed projects get the same plugin through the
package's pytest11 entry point.
"""

from __future__ import annotations

import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent
for candidate in (
    ROOT / "packages" / "safetynet-sim",
    ROOT / "packages" / "safetynet-test" / "src",
):
    if str(candidate) not in sys.path:
        sys.path.insert(0, str(candidate))

# When the package is installed, pytest loads it through its pytest11 entry
# point. Only load it explicitly for the source checkout.
if "safetynet_test.plugin" not in sys.modules:
    pytest_plugins = ["safetynet_test.plugin"]
