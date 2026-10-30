// @vitest-environment happy-dom
import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { VerdictBadge } from "./VerdictBadge";

let root: Root | null = null;
let container: HTMLElement | null = null;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  root?.unmount();
  container?.remove();
  root = null;
  container = null;
});

async function render(verdict: string | null) {
  await act(async () => {
    root?.render(<VerdictBadge verdict={verdict} />);
  });
}

describe("VerdictBadge", () => {
  it("renders POLICY_VIOLATION with icon and label", async () => {
    await render("POLICY_VIOLATION");
    const badge = container?.querySelector("[data-testid='verdict-badge']");
    expect(badge?.getAttribute("data-verdict")).toBe("POLICY_VIOLATION");
    expect(badge?.textContent).toContain("Policy violation");
  });

  it("renders null as No verdict", async () => {
    await render(null);
    expect(container?.textContent).toContain("No verdict");
  });

  it("renders all five verdicts", async () => {
    const verdicts = [
      "POLICY_VIOLATION",
      "POLICY_ADEQUATE_BUT_HARM",
      "INSUFFICIENT_EVIDENCE",
      "OUT_OF_SCOPE",
      "DISMISSED",
    ];
    for (const v of verdicts) {
      await render(v);
      const badge = container?.querySelector("[data-testid='verdict-badge']");
      expect(badge?.getAttribute("data-verdict")).toBe(v);
    }
  });
});
