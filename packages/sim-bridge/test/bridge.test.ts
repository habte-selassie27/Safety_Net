import { describe, expect, it } from "vitest";

import { SimBridge } from "../src/bridge";

function resolvePython(): string {
  const candidates = [
    process.env.SNET_PYTHON,
    "/home/izzy/.venvs/gltest/bin/python",
    "python3",
    "python",
  ].filter(Boolean) as string[];
  for (const candidate of candidates) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { execFileSync } = require("node:child_process");
      execFileSync(candidate, ["-c", "import safetynet_sim"], { stdio: "ignore" });
      return candidate;
    } catch {
      // try next
    }
  }
  return "python3";
}

describe("SimBridge", () => {
  it.skip("round-trips init over JSON-RPC (manual smoke test)", async () => {
    const bridge = new SimBridge({
      python: resolvePython(),
      cwd: process.cwd().replace(/\/packages\/sim-bridge$/, ""),
      config: { validators: 3, seed: 7 },
    });
    try {
      await bridge.start();
      const snapshot = await bridge.snapshot();
      expect(typeof snapshot).toBe("string");
      await bridge.shutdown();
    } catch (error) {
      await bridge.shutdown();
      throw error;
    }
  }, 30_000);
});
